import type { Express } from "express";
import { createServer, type Server } from "http";
import { Server as SocketIOServer } from "socket.io";
import { storage } from "./storage";
import { log } from "./index";
import { generateToken, isLiveKitConfigured, getUsageStats, muteParticipant, isHost, getRoomHost, endMeetingForAll } from "./livekit";
import { setupAuth } from "./auth";
import { db } from "./db";
import { meetings, meetingNotes, meetingTasks, meetingDocs, contacts, smtpSettings, meetingInvites, meetingWhiteboards, meetingParticipants, meetingRecordings } from "@shared/schema";
import path from "path";
import fs from "fs";
import { eq, gte, and, lte, desc } from "drizzle-orm";
import { encryptPassword, decryptPassword, sendMeetingInvite, testSmtpConnection } from "./mail-service";
import { 
  type ServerToClientEvents, 
  type ClientToServerEvents,
  type Participant
} from "@shared/schema";

interface SocketData {
  participantId?: string;
  roomId?: string;
}

// Map socket ID to participant ID for routing WebRTC signals
const socketToParticipant = new Map<string, { participantId: string; socketId: string }>();
const participantToSocket = new Map<string, string>();

// Host presence tracking - roomId -> { hostIdentity, lastSeen }
const hostPresence = new Map<string, { hostIdentity: string; lastSeen: Date }>();

// Waiting room - roomId -> Set of socket IDs waiting
const waitingRooms = new Map<string, Set<string>>();

// Waiting participant data - socketId -> { roomId, visitorId, displayName }
const waitingParticipantData = new Map<string, { roomId: string; visitorId: string; displayName: string }>();

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  setupAuth(app);

  // Set up Socket.IO
  const io = new SocketIOServer<ClientToServerEvents, ServerToClientEvents, {}, SocketData>(
    httpServer,
    {
      cors: {
        origin: "*",
        methods: ["GET", "POST"],
      },
      path: "/socket.io",
    }
  );

  io.on("connection", (socket) => {
    log(`Socket connected: ${socket.id}`, "socket.io");

    socket.on("join-room", async (data, callback) => {
      try {
        const { roomId, participantName } = data;

        // Add participant to storage
        const participant = await storage.addParticipant(roomId, participantName);
        
        socket.data.participantId = participant.id;
        socket.data.roomId = roomId;

        // Track socket-participant mapping
        participantToSocket.set(participant.id, socket.id);
        socketToParticipant.set(socket.id, { participantId: participant.id, socketId: socket.id });

        // Join the socket room
        socket.join(roomId);

        // Get existing participants
        const existingParticipants = await storage.getParticipantsByRoom(roomId);
        const otherParticipants = existingParticipants.filter(p => p.id !== participant.id);

        // Notify existing participants about new joiner
        socket.to(roomId).emit("participant-joined", participant);

        // Send existing participants to new joiner
        socket.emit("existing-participants", otherParticipants);

        log(`Participant ${participantName} (${participant.id}) joined room ${roomId}`, "socket.io");

        callback({ participant });
      } catch (error: any) {
        log(`Error joining room: ${error.message}`, "socket.io");
        socket.emit("error", { message: "Failed to join room" });
      }
    });

    socket.on("leave-room", async () => {
      const { participantId, roomId } = socket.data;
      
      if (participantId && roomId) {
        // Remove from mappings
        participantToSocket.delete(participantId);
        socketToParticipant.delete(socket.id);

        // Remove from storage
        await storage.removeParticipant(participantId);

        // Leave socket room
        socket.leave(roomId);

        // Notify others
        socket.to(roomId).emit("participant-left", participantId);

        log(`Participant ${participantId} left room ${roomId}`, "socket.io");
      }

      socket.data.participantId = undefined;
      socket.data.roomId = undefined;
    });

    socket.on("update-participant", async (data) => {
      const { participantId, roomId } = socket.data;
      
      if (participantId && roomId) {
        const updated = await storage.updateParticipant(participantId, data);
        if (updated) {
          io.to(roomId).emit("participant-updated", { ...data, id: participantId });
        }
      }
    });

    // WebRTC signaling - relay offer to target participant
    socket.on("webrtc-offer", (data) => {
      const { targetId, sdp } = data;
      const { participantId } = socket.data;
      
      if (!participantId) return;

      const targetSocketId = participantToSocket.get(targetId);
      if (targetSocketId) {
        log(`Relaying WebRTC offer from ${participantId} to ${targetId}`, "socket.io");
        io.to(targetSocketId).emit("webrtc-offer", {
          fromId: participantId,
          sdp,
        });
      }
    });

    // WebRTC signaling - relay answer to target participant
    socket.on("webrtc-answer", (data) => {
      const { targetId, sdp } = data;
      const { participantId } = socket.data;
      
      if (!participantId) return;

      const targetSocketId = participantToSocket.get(targetId);
      if (targetSocketId) {
        log(`Relaying WebRTC answer from ${participantId} to ${targetId}`, "socket.io");
        io.to(targetSocketId).emit("webrtc-answer", {
          fromId: participantId,
          sdp,
        });
      }
    });

    // WebRTC signaling - relay ICE candidate to target participant
    socket.on("webrtc-ice-candidate", (data) => {
      const { targetId, candidate } = data;
      const { participantId } = socket.data;
      
      if (!participantId) return;

      const targetSocketId = participantToSocket.get(targetId);
      if (targetSocketId) {
        log(`Relaying ICE candidate from ${participantId} to ${targetId}`, "socket.io");
        io.to(targetSocketId).emit("webrtc-ice-candidate", {
          fromId: participantId,
          candidate,
        });
      }
    });

    // Host presence management
    socket.on("host-presence", async (data) => {
      const { roomId, isPresent } = data;
      
      if (isPresent) {
        // Host joined - mark presence and admit all waiting participants
        hostPresence.set(roomId, { hostIdentity: socket.id, lastSeen: new Date() });
        log(`Host joined room ${roomId}`, "socket.io");
        
        // Notify room that host joined
        io.to(`waiting:${roomId}`).emit("host-joined", { roomId });
        
        // Admit all waiting participants
        const waitingSet = waitingRooms.get(roomId);
        if (waitingSet) {
          const waitingSocketIds = Array.from(waitingSet);
          for (const waitingSocketId of waitingSocketIds) {
            const waitingData = waitingParticipantData.get(waitingSocketId);
            if (waitingData) {
              try {
                // Generate token for waiting participant
                const result = await generateToken(roomId, waitingData.displayName);
                
                // Mark as admitted in database
                await db.update(meetingParticipants)
                  .set({ status: 'admitted', admittedAt: new Date() })
                  .where(and(
                    eq(meetingParticipants.roomId, roomId),
                    eq(meetingParticipants.visitorId, waitingData.visitorId)
                  ));
                
                // Send admission to waiting socket
                io.to(waitingSocketId).emit("admitted", { 
                  roomId, 
                  token: result.token, 
                  serverUrl: result.serverUrl 
                });
                
                log(`Admitted waiting participant ${waitingData.displayName} to room ${roomId}`, "socket.io");
              } catch (error: any) {
                log(`Error admitting participant: ${error.message}`, "socket.io");
              }
            }
            
            // Cleanup
            waitingParticipantData.delete(waitingSocketId);
          }
          waitingRooms.delete(roomId);
        }
      } else {
        // Host left - keep presence record but mark as gone
        hostPresence.delete(roomId);
        log(`Host left room ${roomId}`, "socket.io");
        
        // Notify room that host left (existing participants can stay)
        io.to(roomId).emit("host-left", { roomId });
      }
    });

    // Join waiting room
    socket.on("join-waiting-room", async (data) => {
      const { roomId, visitorId, displayName } = data;
      
      // Add to waiting room
      if (!waitingRooms.has(roomId)) {
        waitingRooms.set(roomId, new Set());
      }
      waitingRooms.get(roomId)!.add(socket.id);
      
      // Store waiting participant data
      waitingParticipantData.set(socket.id, { roomId, visitorId, displayName });
      
      // Join waiting socket room for notifications
      socket.join(`waiting:${roomId}`);
      
      // Record in database
      try {
        await db.insert(meetingParticipants).values({
          roomId,
          visitorId,
          displayName,
          status: 'waiting',
        });
      } catch (error: any) {
        log(`Error recording waiting participant: ${error.message}`, "socket.io");
      }
      
      log(`Participant ${displayName} joined waiting room for ${roomId}`, "socket.io");
    });

    // Join reaction room for receiving emoji reactions
    socket.on("join-reaction-room", (data) => {
      const { roomId } = data;
      socket.join(`reactions:${roomId}`);
      log(`Socket joined reaction room for ${roomId}`, "socket.io");
    });

    // Handle emoji reaction broadcast
    socket.on("send-reaction", (data) => {
      const { roomId, emoji, participantId, participantName } = data;
      
      // Broadcast to all other participants in the room
      socket.to(`reactions:${roomId}`).emit("reaction", {
        emoji,
        participantId,
        participantName,
      });
      
      log(`Reaction ${emoji} from ${participantName} in room ${roomId}`, "socket.io");
    });

    // Handle hand raise broadcast
    socket.on("hand-raise", (data) => {
      const { roomId, participantId, participantName, isRaised } = data;
      
      // Broadcast to all participants in the room
      socket.to(`reactions:${roomId}`).emit("hand-raise-update", {
        participantId,
        participantName,
        isRaised,
      });
      
      log(`Hand ${isRaised ? 'raised' : 'lowered'} by ${participantName} in room ${roomId}`, "socket.io");
    });

    // Handle chat message broadcast
    socket.on("send-chat-message", (data: { roomId: string; senderId: string; senderName: string; content: string }) => {
      const { roomId, senderId, senderName, content } = data;
      
      const messageId = `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const timestamp = Date.now();
      
      // Broadcast to all participants in the room (including sender)
      io.in(`reactions:${roomId}`).emit("chat-message", {
        id: messageId,
        senderId,
        senderName,
        content,
        timestamp,
      });
      
      log(`Chat message from ${senderName} in room ${roomId}`, "socket.io");
    });

    socket.on("disconnect", async () => {
      const { participantId, roomId } = socket.data;
      
      // Clean up waiting room if participant was waiting
      const waitingData = waitingParticipantData.get(socket.id);
      if (waitingData) {
        const waitingSet = waitingRooms.get(waitingData.roomId);
        if (waitingSet) {
          waitingSet.delete(socket.id);
          if (waitingSet.size === 0) {
            waitingRooms.delete(waitingData.roomId);
          }
        }
        waitingParticipantData.delete(socket.id);
      }
      
      if (participantId && roomId) {
        // Remove from mappings
        participantToSocket.delete(participantId);
        socketToParticipant.delete(socket.id);

        // Remove from storage
        await storage.removeParticipant(participantId);

        // Notify others
        socket.to(roomId).emit("participant-left", participantId);

        log(`Participant ${participantId} disconnected from room ${roomId}`, "socket.io");
      }
    });
  });

  // REST API routes
  app.post("/api/rooms", async (req, res) => {
    try {
      const room = await storage.createRoom(req.body);
      res.json(room);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.get("/api/rooms/:id", async (req, res) => {
    const room = await storage.getRoom(req.params.id);
    if (room) {
      res.json(room);
    } else {
      res.status(404).json({ message: "Room not found" });
    }
  });

  // LiveKit token endpoint
  app.post("/api/livekit/token", async (req, res) => {
    try {
      const { roomName, participantName } = req.body;

      if (!roomName || !participantName) {
        return res.status(400).json({ message: "Room name and participant name are required" });
      }

      if (!isLiveKitConfigured()) {
        return res.status(500).json({ 
          message: "LiveKit is not configured. Please set LIVEKIT_API_KEY and LIVEKIT_API_SECRET environment variables." 
        });
      }

      const result = await generateToken(roomName, participantName);
      log(`Generated LiveKit token for ${participantName} in room ${roomName} (isHost: ${result.isHost})`, "livekit");
      
      res.json({ 
        token: result.token,
        serverUrl: result.serverUrl,
        isHost: result.isHost,
        warning: result.warning,
      });
    } catch (error: any) {
      log(`Error generating LiveKit token: ${error.message}`, "livekit");
      res.status(500).json({ message: error.message });
    }
  });

  // LiveKit config check endpoint
  app.get("/api/livekit/status", (req, res) => {
    const stats = getUsageStats();
    res.json({ 
      configured: isLiveKitConfigured(),
      url: process.env.VITE_LIVEKIT_URL ? "configured" : "not configured",
      usage: stats,
    });
  });

  // Join meeting endpoint - checks if host is present
  app.post("/api/meetings/:roomId/join", async (req, res) => {
    try {
      const { roomId } = req.params;
      const { participantName, visitorId, hostToken: providedHostToken } = req.body;

      if (!participantName || !visitorId) {
        return res.status(400).json({ message: "Participant name and visitor ID are required" });
      }

      // Check if meeting exists and get host info
      const [meeting] = await db.select().from(meetings).where(eq(meetings.roomId, roomId));
      
      // Validate host token if provided
      // A valid host token grants host privileges immediately
      let isValidHostToken = false;
      if (providedHostToken && meeting?.hostToken) {
        isValidHostToken = providedHostToken === meeting.hostToken;
        if (isValidHostToken) {
          log(`Host token validated for room ${roomId}`, "api");
        } else {
          log(`Invalid host token provided for room ${roomId}`, "api");
        }
      }
      
      // Check if meeting has ended
      const meetingHasEnded = meeting?.endedAt !== null;
      const waitingRoomEnabled = meeting?.waitingRoom === true;
      
      // Check if there's already a host registered for this room
      const existingHost = await db.select().from(meetingParticipants)
        .where(and(
          eq(meetingParticipants.roomId, roomId),
          eq(meetingParticipants.isHost, true)
        ));
      
      const hasExistingHost = existingHost.length > 0;
      
      // Check if this specific visitor was previously marked as host
      const [existingParticipant] = await db.select().from(meetingParticipants)
        .where(and(
          eq(meetingParticipants.roomId, roomId),
          eq(meetingParticipants.visitorId, visitorId)
        ));
      
      const isReturningHost = existingParticipant?.isHost === true;
      const wasAdmitted = existingParticipant?.status === 'admitted';
      
      // Participant is host ONLY if:
      // 1. Has valid host token (the meeting creator)
      // 2. Is returning as previously marked host (same person with hostToken who joined before)
      // NOTE: We removed the fallback that made first joiner host - only creator can be host
      const isHostParticipant = isValidHostToken || isReturningHost;
      
      // Check if host is present in the room
      const hostIsPresent = hostPresence.has(roomId);
      
      // If meeting has ended and participant is NOT host, they must wait
      if (meetingHasEnded && !isHostParticipant) {
        log(`Meeting ${roomId} has ended - participant ${participantName} must wait for host`, "api");
        
        return res.json({
          status: 'waiting',
          message: 'This meeting has ended. Please wait for the host to restart it.',
        });
      }
      
      // If host is rejoining an ended meeting, reset the endedAt field
      if (meetingHasEnded && isHostParticipant) {
        await db.update(meetings)
          .set({ endedAt: null })
          .where(eq(meetings.roomId, roomId));
        log(`Host rejoined ended meeting ${roomId} - meeting reactivated`, "api");
      }

      // If participant is host, or was previously admitted, or host is present - allow entry
      // But if waiting room is enabled and meeting was ended, non-hosts wait for manual approval
      if (isHostParticipant || (wasAdmitted && !meetingHasEnded) || (hostIsPresent && !waitingRoomEnabled)) {
        if (!isLiveKitConfigured()) {
          return res.status(500).json({ 
            message: "LiveKit is not configured." 
          });
        }

        const result = await generateToken(roomId, participantName);
        
        // Record or update participant
        if (!existingParticipant) {
          await db.insert(meetingParticipants).values({
            roomId,
            visitorId,
            displayName: participantName,
            isHost: isHostParticipant,
            status: 'admitted',
            admittedAt: new Date(),
            lastSeenAt: new Date(),
          });
        } else {
          await db.update(meetingParticipants)
            .set({ lastSeenAt: new Date(), displayName: participantName, status: 'admitted' })
            .where(eq(meetingParticipants.id, existingParticipant.id));
        }
        
        log(`Participant ${participantName} joined room ${roomId} (isHost: ${isHostParticipant})`, "api");
        
        return res.json({
          status: 'admitted',
          token: result.token,
          serverUrl: result.serverUrl,
          isHost: isHostParticipant,
        });
      } else {
        // Host not present and not previously admitted - must wait
        log(`Participant ${participantName} must wait for host in room ${roomId}`, "api");
        
        return res.json({
          status: 'waiting',
          message: 'Please wait for the host to start the meeting',
        });
      }
    } catch (error: any) {
      log(`Error joining meeting: ${error.message}`, "api");
      res.status(500).json({ message: error.message });
    }
  });

  // Get host presence status
  app.get("/api/meetings/:roomId/host-status", (req, res) => {
    const { roomId } = req.params;
    const isPresent = hostPresence.has(roomId);
    const hostData = hostPresence.get(roomId);
    
    res.json({
      isPresent,
      lastSeen: hostData?.lastSeen || null,
    });
  });

  // Host control: Force mute a participant
  app.post("/api/livekit/mute", async (req, res) => {
    try {
      const { roomName, participantIdentity, trackType, muted, hostIdentity } = req.body;

      if (!roomName || !participantIdentity || !trackType || muted === undefined || !hostIdentity) {
        return res.status(400).json({ message: "Missing required parameters" });
      }

      if (!isHost(roomName, hostIdentity)) {
        return res.status(403).json({ message: "Only the host can mute participants" });
      }

      const result = await muteParticipant(roomName, participantIdentity, trackType, muted);
      
      if (result.success) {
        log(`Host ${hostIdentity} ${muted ? 'muted' : 'unmuted'} ${participantIdentity}'s ${trackType} in room ${roomName}`, "livekit");
        res.json({ success: true });
      } else {
        res.status(500).json({ success: false, message: result.error });
      }
    } catch (error: any) {
      log(`Error muting participant: ${error.message}`, "livekit");
      res.status(500).json({ success: false, message: error.message });
    }
  });

  // Get room host info
  app.get("/api/livekit/host/:roomName", (req, res) => {
    const hostIdentity = getRoomHost(req.params.roomName);
    res.json({ 
      hostIdentity: hostIdentity || null,
    });
  });

  // Meetings API routes
  app.get("/api/meetings", async (req, res) => {
    try {
      const now = new Date();
      const allMeetings = await db.select().from(meetings).where(
        gte(meetings.scheduledAt, now)
      );
      res.json(allMeetings);
    } catch (error: any) {
      log(`Error fetching meetings: ${error.message}`, "api");
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/meetings/today", async (req, res) => {
    try {
      const now = new Date();
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
      
      const todayMeetings = await db.select().from(meetings).where(
        and(
          gte(meetings.scheduledAt, startOfDay),
          lte(meetings.scheduledAt, endOfDay)
        )
      );
      res.json(todayMeetings);
    } catch (error: any) {
      log(`Error fetching today's meetings: ${error.message}`, "api");
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/meetings", async (req, res) => {
    try {
      const { title, description, scheduledAt, duration, passcode, waitingRoom } = req.body;
      
      if (!title || !scheduledAt || !duration) {
        return res.status(400).json({ message: "Title, scheduledAt, and duration are required" });
      }

      const roomId = crypto.randomUUID().slice(0, 8);
      const hostToken = crypto.randomUUID();
      
      const [meeting] = await db.insert(meetings).values({
        title,
        description: description || null,
        roomId,
        scheduledAt: new Date(scheduledAt),
        duration: parseInt(duration),
        passcode: passcode || null,
        waitingRoom: waitingRoom || false,
        hostToken,
      }).returning();

      res.json({ ...meeting, hostToken });
    } catch (error: any) {
      log(`Error creating meeting: ${error.message}`, "api");
      res.status(500).json({ message: error.message });
    }
  });

  app.delete("/api/meetings/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await db.delete(meetings).where(eq(meetings.id, id));
      res.json({ success: true });
    } catch (error: any) {
      log(`Error deleting meeting: ${error.message}`, "api");
      res.status(500).json({ message: error.message });
    }
  });

  app.patch("/api/meetings/:roomId/end", async (req, res) => {
    try {
      const { roomId } = req.params;
      
      const liveKitResult = await endMeetingForAll(roomId);
      if (!liveKitResult.success) {
        log(`Warning: Could not disconnect participants: ${liveKitResult.error}`, "api");
      }
      
      const [updated] = await db.update(meetings)
        .set({ endedAt: new Date() })
        .where(eq(meetings.roomId, roomId))
        .returning();
      
      if (!updated) {
        return res.status(404).json({ message: "Meeting not found" });
      }
      
      res.json({ 
        success: true, 
        endedAt: updated.endedAt,
        disconnectedCount: liveKitResult.disconnectedCount || 0
      });
    } catch (error: any) {
      log(`Error ending meeting: ${error.message}`, "api");
      res.status(500).json({ message: error.message });
    }
  });

  // ==================== MEETING NOTES API ====================
  app.get("/api/notes", async (req, res) => {
    try {
      const allNotes = await db.select().from(meetingNotes).orderBy(desc(meetingNotes.createdAt));
      res.json(allNotes);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/meetings/:meetingId/notes", async (req, res) => {
    try {
      const meetingId = parseInt(req.params.meetingId);
      const notes = await db.select().from(meetingNotes)
        .where(eq(meetingNotes.meetingId, meetingId))
        .orderBy(desc(meetingNotes.createdAt));
      res.json(notes);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/meetings/:meetingId/notes", async (req, res) => {
    try {
      const meetingId = parseInt(req.params.meetingId);
      const { content, isPinned } = req.body;
      
      const [note] = await db.insert(meetingNotes).values({
        meetingId,
        content,
        isPinned: isPinned || false,
      }).returning();
      
      res.json(note);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.patch("/api/notes/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { content, isPinned } = req.body;
      
      const [note] = await db.update(meetingNotes)
        .set({ content, isPinned, updatedAt: new Date() })
        .where(eq(meetingNotes.id, id))
        .returning();
      
      res.json(note);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.delete("/api/notes/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await db.delete(meetingNotes).where(eq(meetingNotes.id, id));
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // ==================== MEETING TASKS API ====================
  app.get("/api/tasks", async (req, res) => {
    try {
      const allTasks = await db.select().from(meetingTasks).orderBy(desc(meetingTasks.createdAt));
      res.json(allTasks);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/meetings/:meetingId/tasks", async (req, res) => {
    try {
      const meetingId = parseInt(req.params.meetingId);
      const tasks = await db.select().from(meetingTasks)
        .where(eq(meetingTasks.meetingId, meetingId))
        .orderBy(desc(meetingTasks.createdAt));
      res.json(tasks);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/meetings/:meetingId/tasks", async (req, res) => {
    try {
      const meetingId = parseInt(req.params.meetingId);
      const { title, description, status, priority, dueAt } = req.body;
      
      const [task] = await db.insert(meetingTasks).values({
        meetingId,
        title,
        description,
        status: status || "todo",
        priority: priority || "medium",
        dueAt: dueAt ? new Date(dueAt) : null,
      }).returning();
      
      res.json(task);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.patch("/api/tasks/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { title, description, status, priority, dueAt } = req.body;
      
      const [task] = await db.update(meetingTasks)
        .set({ 
          title, 
          description, 
          status, 
          priority, 
          dueAt: dueAt ? new Date(dueAt) : null,
          updatedAt: new Date() 
        })
        .where(eq(meetingTasks.id, id))
        .returning();
      
      res.json(task);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.delete("/api/tasks/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await db.delete(meetingTasks).where(eq(meetingTasks.id, id));
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // ==================== MEETING DOCS API ====================
  app.get("/api/docs", async (req, res) => {
    try {
      const allDocs = await db.select().from(meetingDocs).orderBy(desc(meetingDocs.createdAt));
      res.json(allDocs);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/meetings/:meetingId/docs", async (req, res) => {
    try {
      const meetingId = parseInt(req.params.meetingId);
      const docs = await db.select().from(meetingDocs)
        .where(eq(meetingDocs.meetingId, meetingId))
        .orderBy(desc(meetingDocs.createdAt));
      res.json(docs);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/meetings/:meetingId/docs", async (req, res) => {
    try {
      const meetingId = parseInt(req.params.meetingId);
      const { title, content, fileUrl, fileType } = req.body;
      
      const [doc] = await db.insert(meetingDocs).values({
        meetingId,
        title,
        content,
        fileUrl,
        fileType,
      }).returning();
      
      res.json(doc);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.patch("/api/docs/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { title, content } = req.body;
      
      const [doc] = await db.update(meetingDocs)
        .set({ title, content, updatedAt: new Date() })
        .where(eq(meetingDocs.id, id))
        .returning();
      
      res.json(doc);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.delete("/api/docs/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await db.delete(meetingDocs).where(eq(meetingDocs.id, id));
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // ==================== CONTACTS API ====================
  app.get("/api/contacts", async (req, res) => {
    try {
      const allContacts = await db.select().from(contacts).orderBy(contacts.name);
      res.json(allContacts);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/contacts", async (req, res) => {
    try {
      const { name, email, notes, avatarUrl } = req.body;
      
      const [contact] = await db.insert(contacts).values({
        name,
        email,
        notes,
        avatarUrl,
      }).returning();
      
      res.json(contact);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.patch("/api/contacts/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { name, email, notes, avatarUrl } = req.body;
      
      const [contact] = await db.update(contacts)
        .set({ name, email, notes, avatarUrl })
        .where(eq(contacts.id, id))
        .returning();
      
      res.json(contact);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.delete("/api/contacts/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await db.delete(contacts).where(eq(contacts.id, id));
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // ==================== SMTP SETTINGS API ====================
  app.get("/api/smtp-settings", async (req, res) => {
    try {
      const [settings] = await db.select().from(smtpSettings).limit(1);
      if (!settings) {
        return res.json(null);
      }
      const { password, ...safeSettings } = settings;
      res.json({ ...safeSettings, hasPassword: true });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/smtp-settings", async (req, res) => {
    try {
      const { host, port, secure, username, password, fromEmail, fromName } = req.body;
      
      const existing = await db.select().from(smtpSettings).limit(1);
      
      if (existing.length > 0) {
        const updateData: any = {
          host,
          port,
          secure,
          username,
          fromEmail,
          fromName,
          updatedAt: new Date(),
        };
        
        if (password && password.trim().length > 0) {
          updateData.password = encryptPassword(password);
        }
        
        const [updated] = await db.update(smtpSettings)
          .set(updateData)
          .where(eq(smtpSettings.id, existing[0].id))
          .returning();
        
        const { password: _, ...safeSettings } = updated;
        res.json({ ...safeSettings, hasPassword: true });
      } else {
        if (!password || password.trim().length === 0) {
          return res.status(400).json({ message: "Password is required for initial setup" });
        }
        
        const [created] = await db.insert(smtpSettings).values({
          host,
          port,
          secure,
          username,
          password: encryptPassword(password),
          fromEmail,
          fromName,
        }).returning();
        
        const { password: _, ...safeSettings } = created;
        res.json({ ...safeSettings, hasPassword: true });
      }
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/smtp-settings/test", async (req, res) => {
    try {
      const { host, port, secure, username, password, fromEmail, fromName } = req.body;
      
      let testPassword = password;
      
      if (!testPassword || testPassword.trim().length === 0) {
        const [existing] = await db.select().from(smtpSettings).limit(1);
        if (existing) {
          testPassword = decryptPassword(existing.password);
        } else {
          return res.json({ success: false, error: "Password is required for connection test" });
        }
      }
      
      const result = await testSmtpConnection({
        host,
        port,
        secure,
        username,
        password: testPassword,
        fromEmail,
        fromName,
      });
      
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // ==================== MEETING INVITES API ====================
  app.get("/api/meetings/:meetingId/invites", async (req, res) => {
    try {
      const meetingId = parseInt(req.params.meetingId);
      const invites = await db.select().from(meetingInvites)
        .where(eq(meetingInvites.meetingId, meetingId))
        .orderBy(desc(meetingInvites.sentAt));
      res.json(invites);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/meetings/:meetingId/send-invite", async (req, res) => {
    try {
      const meetingId = parseInt(req.params.meetingId);
      const { recipientEmail, recipientName } = req.body;
      
      const [settings] = await db.select().from(smtpSettings).limit(1);
      if (!settings) {
        return res.status(400).json({ message: "SMTP settings not configured. Please set up email settings first." });
      }
      
      const [meeting] = await db.select().from(meetings).where(eq(meetings.id, meetingId));
      if (!meeting) {
        return res.status(404).json({ message: "Meeting not found" });
      }
      
      const decryptedPassword = decryptPassword(settings.password);
      const baseUrl = process.env.APP_DOMAIN 
        ? `https://${process.env.APP_DOMAIN}`
        : (process.env.NODE_ENV === 'production' ? '' : 'http://localhost:5000');
      const meetingLink = `${baseUrl}/room/${meeting.roomId}/join`;
      
      const result = await sendMeetingInvite(
        {
          host: settings.host,
          port: settings.port,
          secure: settings.secure ?? true,
          username: settings.username,
          password: decryptedPassword,
          fromEmail: settings.fromEmail,
          fromName: settings.fromName || undefined,
        },
        recipientEmail,
        recipientName,
        meeting.title,
        meeting.scheduledAt,
        meeting.duration,
        meeting.roomId,
        meetingLink
      );
      
      if (result.success) {
        const [invite] = await db.insert(meetingInvites).values({
          meetingId,
          recipientEmail,
          recipientName,
        }).returning();
        
        res.json({ success: true, invite });
      } else {
        res.status(500).json({ success: false, message: result.error });
      }
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // ==================== WHITEBOARD API ====================
  app.get("/api/whiteboard/:roomId", async (req, res) => {
    try {
      const { roomId } = req.params;
      const [whiteboard] = await db.select().from(meetingWhiteboards)
        .where(eq(meetingWhiteboards.roomId, roomId))
        .limit(1);
      
      if (whiteboard) {
        res.json(whiteboard);
      } else {
        res.json({ roomId, snapshot: null });
      }
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/whiteboard/:roomId", async (req, res) => {
    try {
      const { roomId } = req.params;
      const { snapshot } = req.body;
      
      const [existing] = await db.select().from(meetingWhiteboards)
        .where(eq(meetingWhiteboards.roomId, roomId))
        .limit(1);
      
      if (existing) {
        await db.update(meetingWhiteboards)
          .set({ snapshot, updatedAt: new Date() })
          .where(eq(meetingWhiteboards.roomId, roomId));
      } else {
        await db.insert(meetingWhiteboards).values({ roomId, snapshot });
      }
      
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.delete("/api/whiteboard/:roomId", async (req, res) => {
    try {
      const { roomId } = req.params;
      await db.delete(meetingWhiteboards)
        .where(eq(meetingWhiteboards.roomId, roomId));
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // ==================== RECORDINGS API ====================
  const RECORDINGS_DIR = path.join(process.cwd(), "recordings");

  if (!fs.existsSync(RECORDINGS_DIR)) {
    fs.mkdirSync(RECORDINGS_DIR, { recursive: true });
  }

  app.post("/api/recordings/upload", async (req, res) => {
    try {
      const chunks: Buffer[] = [];
      
      req.on("data", (chunk: Buffer) => {
        chunks.push(chunk);
      });

      req.on("end", async () => {
        try {
          const buffer = Buffer.concat(chunks);
          const roomId = req.headers["x-room-id"] as string;
          const hostId = req.headers["x-host-id"] as string;
          const duration = parseInt(req.headers["x-duration"] as string) || 0;
          const originalFilename =
            (req.headers["x-original-filename"] as string) || "recording.webm";
          const uploadedMimeType =
            (req.headers["x-mime-type"] as string) || "video/webm";

          if (!roomId) {
            return res.status(400).json({ message: "Room ID is required" });
          }

          const timestamp = Date.now();
          const ext = path.extname(originalFilename) || ".webm";
          const filename = `recording_${roomId}_${timestamp}${ext}`;
          const filePath = path.join(RECORDINGS_DIR, filename);

          fs.writeFileSync(filePath, buffer);

          const [meeting] = await db
            .select()
            .from(meetings)
            .where(eq(meetings.roomId, roomId))
            .limit(1);

          const [recording] = await db
            .insert(meetingRecordings)
            .values({
              roomId,
              meetingId: meeting?.id || null,
              hostId: hostId ? parseInt(hostId) : null,
              filename,
              originalFilename,
              fileSize: buffer.length,
              duration,
              mimeType: uploadedMimeType || "video/webm",
              status: "completed",
            })
            .returning();

          log(
            `Recording saved: ${filename} (${buffer.length} bytes, mime=${uploadedMimeType})`,
            "recordings",
          );
          res.json({ success: true, recording });
        } catch (error: any) {
          log(`Error saving recording: ${error.message}`, "recordings");
          res.status(500).json({ message: error.message });
        }
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/recordings", async (req, res) => {
    try {
      const recordings = await db.select().from(meetingRecordings)
        .orderBy(desc(meetingRecordings.createdAt));
      
      const recordingsWithMeetingInfo = await Promise.all(
        recordings.map(async (recording) => {
          let meetingTitle = null;
          if (recording.meetingId) {
            const [meeting] = await db.select().from(meetings).where(eq(meetings.id, recording.meetingId)).limit(1);
            meetingTitle = meeting?.title || null;
          }
          return { ...recording, meetingTitle };
        })
      );
      
      res.json(recordingsWithMeetingInfo);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/recordings/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const [recording] = await db.select().from(meetingRecordings)
        .where(eq(meetingRecordings.id, parseInt(id)))
        .limit(1);
      
      if (!recording) {
        return res.status(404).json({ message: "Recording not found" });
      }
      
      res.json(recording);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/recordings/:id/stream", async (req, res) => {
    try {
      const { id } = req.params;
      const [recording] = await db.select().from(meetingRecordings)
        .where(eq(meetingRecordings.id, parseInt(id)))
        .limit(1);
      
      if (!recording) {
        return res.status(404).json({ message: "Recording not found" });
      }

      const filePath = path.join(RECORDINGS_DIR, recording.filename);
      
      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ message: "Recording file not found" });
      }

      const stat = fs.statSync(filePath);
      const fileSize = stat.size;
      const range = req.headers.range;

      if (range) {
        const parts = range.replace(/bytes=/, "").split("-");
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
        const chunksize = (end - start) + 1;
        const file = fs.createReadStream(filePath, { start, end });
        
        res.writeHead(206, {
          "Content-Range": `bytes ${start}-${end}/${fileSize}`,
          "Accept-Ranges": "bytes",
          "Content-Length": chunksize,
          "Content-Type": recording.mimeType || "video/webm",
        });
        file.pipe(res);
      } else {
        res.writeHead(200, {
          "Content-Length": fileSize,
          "Content-Type": recording.mimeType || "video/webm",
        });
        fs.createReadStream(filePath).pipe(res);
      }
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/recordings/:id/download", async (req, res) => {
    try {
      const { id } = req.params;
      const [recording] = await db.select().from(meetingRecordings)
        .where(eq(meetingRecordings.id, parseInt(id)))
        .limit(1);
      
      if (!recording) {
        return res.status(404).json({ message: "Recording not found" });
      }

      const filePath = path.join(RECORDINGS_DIR, recording.filename);
      
      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ message: "Recording file not found" });
      }

      const downloadName = recording.originalFilename || recording.filename;
      res.setHeader("Content-Disposition", `attachment; filename="${downloadName}"`);
      res.setHeader("Content-Type", recording.mimeType || "video/webm");
      
      fs.createReadStream(filePath).pipe(res);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.delete("/api/recordings/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const [recording] = await db.select().from(meetingRecordings)
        .where(eq(meetingRecordings.id, parseInt(id)))
        .limit(1);
      
      if (!recording) {
        return res.status(404).json({ message: "Recording not found" });
      }

      const filePath = path.join(RECORDINGS_DIR, recording.filename);
      
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }

      await db.delete(meetingRecordings).where(eq(meetingRecordings.id, parseInt(id)));
      
      log(`Recording deleted: ${recording.filename}`, "recordings");
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  return httpServer;
}
