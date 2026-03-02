import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useLocation, useParams } from "wouter";
import {
  LiveKitRoom,
  RoomAudioRenderer,
  useRoomContext,
  useParticipants,
  useTracks,
  useLocalParticipant,
} from "@livekit/components-react";
import "@livekit/components-styles";
import { Track, RoomEvent, ConnectionState } from "livekit-client";
import { useToast } from "@/hooks/use-toast";
import { useRecording } from "@/hooks/use-recording";
import { useAuth } from "@/hooks/use-auth";
import { Loader2, ArrowLeft, Link2, Check, Crown, Clock, Users, ChevronUp, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ParticipantTile } from "@/components/meeting/participant-tile";
import { ControlBar } from "@/components/meeting/control-bar";
import { ParticipantsPanel } from "@/components/meeting/participants-panel";
import { HostControlsPanel } from "@/components/meeting/host-controls-panel";
import { WhiteboardPanel } from "@/components/meeting/whiteboard-panel";
import { ChatPanel } from "@/components/meeting/chat-panel";
import { cn } from "@/lib/utils";
import { io, Socket } from "socket.io-client";

const DEFAULT_LIVEKIT_URL = import.meta.env.VITE_LIVEKIT_URL || "";

// ✅ IMPROVED: Track toggle configuration
const TRACK_TOGGLE_CONFIG = {
  TIMEOUT: 8000, // 8 seconds timeout for track operations
  RETRY_ATTEMPTS: 3,
  RETRY_DELAY: 500,
};

function MeetingContent({
  roomId,
  serverUrl,
  onLeave,
  isHost,
}: {
  roomId: string;
  serverUrl: string;
  onLeave: () => void;
  isHost: boolean;
}) {
  const room = useRoomContext();
  const participants = useParticipants();
  const { localParticipant } = useLocalParticipant();
  const { toast } = useToast();

  // ✅ CONNECTION STATE TRACKING
  const [currentPage, setCurrentPage] = useState(0);
  const [connectionState, setConnectionState] = useState<ConnectionState>(ConnectionState.Connected);

  // ✅ IMPROVED: Track toggle state to prevent multiple simultaneous requests
  const [isTogglingAudio, setIsTogglingAudio] = useState(false);
  const [isTogglingVideo, setIsTogglingVideo] = useState(false);
  const [trackUpdateCount, setTrackUpdateCount] = useState(0);
  const toggleTimeoutRef = useRef<{ audio?: NodeJS.Timeout; video?: NodeJS.Timeout }>({});

  const FIRST_PAGE_COUNT = 2;
  const OTHER_PAGE_COUNT = 2;

  const totalPages = useMemo(() => {
    if (participants.length <= FIRST_PAGE_COUNT) return 1;
    return 1 + Math.ceil((participants.length - FIRST_PAGE_COUNT) / OTHER_PAGE_COUNT);
  }, [participants.length]);

  const canScrollUp = currentPage > 0;
  const canScrollDown = currentPage < totalPages - 1;

  useEffect(() => {
    if (participants.length <= FIRST_PAGE_COUNT) setCurrentPage(0);
  }, [participants.length]);

  useEffect(() => {
    if (currentPage >= totalPages) setCurrentPage(Math.max(0, totalPages - 1));
  }, [totalPages, currentPage]);

  const handleScrollUp = useCallback(() => {
    setCurrentPage((p) => Math.max(0, p - 1));
  }, []);

  const handleScrollDown = useCallback(() => {
    setCurrentPage((p) => Math.min(totalPages - 1, p + 1));
  }, [totalPages]);

  const visibleParticipants = useMemo(() => {
    if (currentPage === 0) return participants.slice(0, FIRST_PAGE_COUNT);
    const start = FIRST_PAGE_COUNT + (currentPage - 1) * OTHER_PAGE_COUNT;
    return participants.slice(start, start + OTHER_PAGE_COUNT);
  }, [participants, currentPage]);

  const getRemoteAudioTracks = useCallback((): MediaStreamTrack[] => {
    const tracks: MediaStreamTrack[] = [];
    const localMicPub = room.localParticipant.getTrackPublication(Track.Source.Microphone);
    const localMicTrack = localMicPub?.track?.mediaStreamTrack;
    if (localMicTrack && localMicTrack.readyState === "live") tracks.push(localMicTrack);
    room.remoteParticipants.forEach((participant) => {
      const pub = participant.getTrackPublication(Track.Source.Microphone);
      const track = pub?.track?.mediaStreamTrack;
      if (track && track.readyState === "live") tracks.push(track);
    });
    return tracks;
  }, [room, trackUpdateCount]);

  const getCompositeVideoTracks = useCallback((): MediaStreamTrack[] => {
    const tracks: MediaStreamTrack[] = [];
    room.remoteParticipants.forEach((participant) => {
      const pub = participant.getTrackPublication(Track.Source.ScreenShare);
      const track = pub?.track?.mediaStreamTrack;
      if (track && track.readyState === "live") tracks.push(track);
    });
    const localScreenPub = room.localParticipant.getTrackPublication(Track.Source.ScreenShare);
    const localScreenTrack = localScreenPub?.track?.mediaStreamTrack;
    if (localScreenTrack && localScreenTrack.readyState === "live") tracks.unshift(localScreenTrack);
    const localCameraPub = room.localParticipant.getTrackPublication(Track.Source.Camera);
    const localCameraTrack = localCameraPub?.track?.mediaStreamTrack;
    if (localCameraTrack && localCameraTrack.readyState === "live") tracks.push(localCameraTrack);
    room.remoteParticipants.forEach((participant) => {
      const pub = participant.getTrackPublication(Track.Source.Camera);
      const track = pub?.track?.mediaStreamTrack;
      if (track && track.readyState === "live") tracks.push(track);
    });
    return tracks;
  }, [room, trackUpdateCount]);

  const { user } = useAuth();

  const {
    state: recordingState,
    formattedDuration: recordingDuration,
    startRecording,
    pauseRecording,
    resumeRecording,
    stopRecording,
    // onTracksChanged removed as it is not part of useRecording hook
  } = useRecording({
    roomId,
    hostId: user?.id,
    getRemoteAudioTracks,
    getCompositeVideoTracks,
    onRecordingComplete: () => {
      toast({
        title: "Recording Saved",
        description: "Your meeting recording has been saved. You can access it from the Recordings page.",
      });
    },
    onError: (error) => {
      toast({
        title: "Recording Error",
        description: error.message || "Failed to record the meeting",
        variant: "destructive",
      });
    },
  });

  const storedAudioEnabled = sessionStorage.getItem("audioEnabled");
  const storedVideoEnabled = sessionStorage.getItem("videoEnabled");
  const initialAudioEnabled = storedAudioEnabled !== null ? storedAudioEnabled === "true" : true;
  const initialVideoEnabled = storedVideoEnabled !== null ? storedVideoEnabled === "true" : true;

  const [isAudioEnabled, setIsAudioEnabled] = useState(initialAudioEnabled);
  const [isVideoEnabled, setIsVideoEnabled] = useState(initialVideoEnabled);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isParticipantsPanelOpen, setIsParticipantsPanelOpen] = useState(false);
  const [isHostControlsOpen, setIsHostControlsOpen] = useState(false);
  const [isWhiteboardOpen, setIsWhiteboardOpen] = useState(false);
  const [isRoomLocked, setIsRoomLocked] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isHandRaised, setIsHandRaised] = useState(false);
  const [raisedHands, setRaisedHands] = useState<Map<string, { participantName: string; timestamp: number }>>(new Map());
  const [reactions, setReactions] = useState<Array<{ id: string; emoji: string; participantName: string; timestamp: number }>>([]);
  const [isChatPanelOpen, setIsChatPanelOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<Array<{ id: string; senderId: string; senderName: string; content: string; timestamp: number }>>([]);
  const [unreadMessageCount, setUnreadMessageCount] = useState(0);

  const socketRef = useRef<Socket | null>(null);
  const reactionTimersRef = useRef<Map<string, NodeJS.Timeout>>(new Map());
  const isChatPanelOpenRef = useRef(isChatPanelOpen);
  const localParticipantIdRef = useRef(localParticipant.identity);

  useEffect(() => { isChatPanelOpenRef.current = isChatPanelOpen; }, [isChatPanelOpen]);
  useEffect(() => { localParticipantIdRef.current = localParticipant.identity; }, [localParticipant.identity]);

  const handleMuteParticipant = useCallback(
    async (participantIdentity: string, trackType: "audio" | "video", muted: boolean) => {
      try {
        const response = await fetch("/api/livekit/mute", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ roomName: roomId, participantIdentity, trackType, muted, hostIdentity: localParticipant.identity }),
        });
        const data = await response.json();
        if (data.success) {
          toast({
            title: muted ? `${trackType === "audio" ? "Microphone" : "Camera"} disabled` : `${trackType === "audio" ? "Microphone" : "Camera"} enabled`,
            description: `Successfully ${muted ? "disabled" : "enabled"} ${participantIdentity}'s ${trackType}`,
          });
        } else {
          throw new Error(data.message || "Failed to control participant");
        }
      } catch (err: any) {
        toast({ title: "Action Failed", description: err.message || "Could not control participant", variant: "destructive" });
      }
    },
    [roomId, localParticipant.identity, toast]
  );

  const tracks = useTracks(
    [
      { source: Track.Source.Camera, withPlaceholder: false },
      { source: Track.Source.ScreenShare, withPlaceholder: false },
    ],
    { onlySubscribed: true } // Revert to onlySubscribed: true for stability
  );

  const screenShareTrack = useMemo(
    () => tracks.find((t) => t.source === Track.Source.ScreenShare && t.publication?.isSubscribed),
    [tracks]
  );

  // Media activation moved to LiveKitRoom props for faster performance

  // ✅ Socket initialization with error handling (NO RECONNECTION ALERTS)
  useEffect(() => {
    const initSocket = () => {
      if (socketRef.current?.connected) {
        return;
      }

      try {
        const socket = io({
          path: "/socket.io",
          transports: ["websocket", "polling"],
          reconnection: true,
          reconnectionDelay: 1000,
          reconnectionDelayMax: 5000,
          reconnectionAttempts: 5,
        });

        socket.on("connect", () => {
          console.log("[Socket] Connected successfully, socketId:", socket.id);
          if (isHost) {
            socket.emit("host-presence", { roomId, isPresent: true });
          }
          // Join the reaction room and associate with local participant
          socket.emit("join-reaction-room", {
            roomId,
            participantId: localParticipant.identity
          });
        });

        socket.on("connect_error", (error) => {
          console.error("[Socket] Connection error:", error);
          // NO TOAST - Silent reconnection
        });

        socket.on("disconnect", (reason) => {
          console.log("[Socket] Disconnected:", reason);
          // NO TOAST - Silent reconnection
        });

        socket.on("error", (error) => {
          console.error("[Socket] Socket error:", error);
          // NO TOAST - Silent reconnection
        });

        socket.on("participant-left", (pId: string) => {
          console.log("[Socket] Participant left signal received:", pId);
          setRaisedHands((prev) => {
            if (prev.has(pId)) {
              const newMap = new Map(prev);
              newMap.delete(pId);
              return newMap;
            }
            return prev;
          });
        });

        socket.on("reaction", (data: { emoji: string; participantName: string; participantId: string }) => {
          const reaction = { id: `${data.participantId}-${Date.now()}`, emoji: data.emoji, participantName: data.participantName, timestamp: Date.now() };
          setReactions((prev) => [...prev, reaction]);
          const timerId = setTimeout(() => {
            setReactions((prev) => prev.filter((r) => r.id !== reaction.id));
            reactionTimersRef.current.delete(reaction.id);
          }, 3000);
          reactionTimersRef.current.set(reaction.id, timerId);
        });

        socket.on("hand-raise-update", (data: { participantId: string; participantName: string; isRaised: boolean }) => {
          setRaisedHands((prev) => {
            const newMap = new Map(prev);
            if (data.isRaised) {
              newMap.set(data.participantId, { participantName: data.participantName, timestamp: Date.now() });
              toast({ title: "✋ Hand Raised", description: `${data.participantName} raised their hand`, duration: 3000 });
            } else {
              newMap.delete(data.participantId);
            }
            return newMap;
          });
        });

        socket.on("chat-message", (data: { id: string; senderId: string; senderName: string; content: string; timestamp: number }) => {
          setChatMessages((prev) => [...prev, data]);
          if (!isChatPanelOpenRef.current && data.senderId !== localParticipantIdRef.current) {
            setUnreadMessageCount((c) => c + 1);
          }
        });

        socketRef.current = socket;
      } catch (error) {
        console.error("[Socket] Failed to initialize:", error);
        // NO TOAST - Silent failure
      }
    };

    initSocket();

    return () => {
      if (socketRef.current) {
        if (isHost) socketRef.current.emit("host-presence", { roomId, isPresent: false });
        socketRef.current.disconnect();
      }
      reactionTimersRef.current.forEach((t) => clearTimeout(t));
      reactionTimersRef.current.clear();
    };
  }, [localParticipant.identity, isHost, roomId, toast]);

  useEffect(() => {
    const participantIds = new Set(participants.map((p) => p.identity));
    setRaisedHands((prev) => {
      const newMap = new Map(prev);
      let changed = false;
      Array.from(newMap.keys()).forEach((id) => {
        if (!participantIds.has(id)) { newMap.delete(id); changed = true; }
      });
      return changed ? newMap : prev;
    });
  }, [participants]);

  // ✅ Connection state handling (NO ALERTS)
  useEffect(() => {
    const handleConnectionStateChange = (s: ConnectionState) => {
      console.log("[Meeting] Connection state changed:", s);
      setConnectionState(s);
      // NO ALERTS - Just log the state change
    };

    const handleScreenShareChange = () => {
      setIsScreenSharing(localParticipant.isScreenShareEnabled);
    };

    room.on(RoomEvent.ConnectionStateChanged, handleConnectionStateChange);
    room.on(RoomEvent.LocalTrackPublished, handleScreenShareChange);
    room.on(RoomEvent.LocalTrackUnpublished, handleScreenShareChange);

    return () => {
      room.off(RoomEvent.ConnectionStateChanged, handleConnectionStateChange);
      room.off(RoomEvent.LocalTrackPublished, handleScreenShareChange);
      room.off(RoomEvent.LocalTrackUnpublished, handleScreenShareChange);
    };
  }, [room, localParticipant, toast]);

  // ✅ IMPROVED: Better audio toggle with timeout
  const handleToggleAudio = useCallback(async () => {
    if (isTogglingAudio) {
      console.log("[Meeting] Audio toggle already in progress, ignoring request");
      return;
    }

    setIsTogglingAudio(true);

    if (toggleTimeoutRef.current.audio) {
      clearTimeout(toggleTimeoutRef.current.audio);
    }

    const timeoutId = setTimeout(() => {
      console.error("[Meeting] Audio toggle timeout");
      setIsTogglingAudio(false);
      toast({
        title: "Timeout",
        description: "Microphone toggle took too long. Please try again.",
        variant: "destructive"
      });
    }, TRACK_TOGGLE_CONFIG.TIMEOUT);
    toggleTimeoutRef.current.audio = timeoutId;

    try {
      const newState = !isAudioEnabled;
      console.log(`[Meeting] Attempting to ${newState ? "enable" : "disable"} microphone`);

      const togglePromise = localParticipant.setMicrophoneEnabled(newState);
      await Promise.race([
        togglePromise,
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("Microphone toggle timeout")), TRACK_TOGGLE_CONFIG.TIMEOUT - 500)
        )
      ]);

      console.log(`[Meeting] Microphone ${newState ? "enabled" : "disabled"} successfully`);
      setIsAudioEnabled(newState);
      sessionStorage.setItem("audioEnabled", String(newState));

      toast({
        title: newState ? "Microphone On" : "Microphone Off",
        description: newState ? "Your microphone is now on" : "Your microphone is now off",
        duration: 2000,
      });
    } catch (error: any) {
      console.error("[Meeting] Audio toggle error:", error);
      setIsAudioEnabled(!isAudioEnabled);

      if (error.message?.includes("timeout")) {
        toast({
          title: "Microphone Timeout",
          description: "Taking too long to toggle microphone. Check your connection and try again.",
          variant: "destructive"
        });
      } else if (error.name === "NotAllowedError") {
        toast({
          title: "Permission Denied",
          description: "Microphone access denied. Check your browser permissions.",
          variant: "destructive"
        });
      } else {
        toast({
          title: "Error",
          description: `Failed to toggle microphone: ${error.message || "Unknown error"}`,
          variant: "destructive"
        });
      }
    } finally {
      setIsTogglingAudio(false);
      if (toggleTimeoutRef.current.audio) {
        clearTimeout(toggleTimeoutRef.current.audio);
        delete toggleTimeoutRef.current.audio;
      }
    }
  }, [isAudioEnabled, isTogglingAudio, localParticipant, toast]);

  // ✅ IMPROVED: Better video toggle with timeout
  const handleToggleVideo = useCallback(async () => {
    if (isTogglingVideo) {
      console.log("[Meeting] Video toggle already in progress, ignoring request");
      return;
    }

    setIsTogglingVideo(true);

    if (toggleTimeoutRef.current.video) {
      clearTimeout(toggleTimeoutRef.current.video);
    }

    const timeoutId = setTimeout(() => {
      console.error("[Meeting] Video toggle timeout");
      setIsTogglingVideo(false);
      toast({
        title: "Timeout",
        description: "Camera toggle took too long. Please try again.",
        variant: "destructive"
      });
    }, TRACK_TOGGLE_CONFIG.TIMEOUT);
    toggleTimeoutRef.current.video = timeoutId;

    try {
      const newState = !isVideoEnabled;
      console.log(`[Meeting] Attempting to ${newState ? "enable" : "disable"} camera`);

      const togglePromise = localParticipant.setCameraEnabled(newState);
      await Promise.race([
        togglePromise,
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("Camera toggle timeout")), TRACK_TOGGLE_CONFIG.TIMEOUT - 500)
        )
      ]);

      console.log(`[Meeting] Camera ${newState ? "enabled" : "disabled"} successfully`);
      setIsVideoEnabled(newState);
      sessionStorage.setItem("videoEnabled", String(newState));

      toast({
        title: newState ? "Camera On" : "Camera Off",
        description: newState ? "Your camera is now on" : "Your camera is now off",
        duration: 2000,
      });
    } catch (error: any) {
      console.error("[Meeting] Video toggle error:", error);
      setIsVideoEnabled(!isVideoEnabled);

      if (error.message?.includes("timeout")) {
        toast({
          title: "Camera Timeout",
          description: "Taking too long to toggle camera. Check your connection and try again.",
          variant: "destructive"
        });
      } else if (error.name === "NotAllowedError") {
        toast({
          title: "Permission Denied",
          description: "Camera access denied. Check your browser permissions.",
          variant: "destructive"
        });
      } else {
        toast({
          title: "Error",
          description: `Failed to toggle camera: ${error.message || "Unknown error"}`,
          variant: "destructive"
        });
      }
    } finally {
      setIsTogglingVideo(false);
      if (toggleTimeoutRef.current.video) {
        clearTimeout(toggleTimeoutRef.current.video);
        delete toggleTimeoutRef.current.video;
      }
    }
  }, [isVideoEnabled, isTogglingVideo, localParticipant, toast]);

  const handleToggleScreenShare = useCallback(async () => {
    try {
      const newState = !isScreenSharing;
      if (newState) {
        const canShare =
          typeof navigator !== "undefined" &&
          !!navigator.mediaDevices &&
          typeof navigator.mediaDevices.getDisplayMedia === "function";
        if (!canShare) {
          toast({
            title: "Screen Sharing Not Supported",
            description: "Your browser or device does not support screen sharing. Please try on a desktop browser like Chrome or Edge.",
            variant: "destructive",
          });
          return;
        }
      }
      await localParticipant.setScreenShareEnabled(newState);
      setIsScreenSharing(newState);
      if (newState) toast({ title: "Screen Sharing", description: "You are now sharing your screen" });
    } catch (err: any) {
      if (err.message?.includes("Permission denied")) {
        toast({ title: "Permission Denied", description: "Screen sharing permission was denied", variant: "destructive" });
      }
    }
  }, [isScreenSharing, localParticipant, toast]);

  const handleCopyLink = useCallback(async () => {
    const meetingUrl = `${window.location.origin}/room/${roomId}/join`;
    try {
      await navigator.clipboard.writeText(meetingUrl);
      setCopied(true);
      toast({ title: "Link Copied", description: "Meeting link copied to clipboard", duration: 1300 });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({ title: "Copy Failed", description: meetingUrl, variant: "destructive" });
    }
  }, [roomId, toast]);

  const handleToggleHandRaise = useCallback(() => {
    const newState = !isHandRaised;
    setIsHandRaised(newState);
    socketRef.current?.emit("hand-raise", { roomId, participantId: localParticipant.identity, participantName: localParticipant.name || localParticipant.identity, isRaised: newState });
    toast({ title: newState ? "Hand Raised" : "Hand Lowered", description: newState ? "The host can see your raised hand" : "You lowered your hand", duration: 2000 });
  }, [isHandRaised, roomId, localParticipant, toast]);

  const handleSendReaction = useCallback((emoji: string) => {
    const reaction = { id: `${localParticipant.identity}-${Date.now()}`, emoji, participantName: localParticipant.name || localParticipant.identity, timestamp: Date.now() };
    setReactions((prev) => [...prev, reaction]);
    const timerId = setTimeout(() => {
      setReactions((prev) => prev.filter((r) => r.id !== reaction.id));
      reactionTimersRef.current.delete(reaction.id);
    }, 3000);
    reactionTimersRef.current.set(reaction.id, timerId);
    socketRef.current?.emit("send-reaction", { roomId, emoji, participantId: localParticipant.identity, participantName: localParticipant.name || localParticipant.identity });
  }, [roomId, localParticipant]);

  const handleToggleChat = useCallback(() => {
    setIsChatPanelOpen((prev) => !prev);
    if (!isChatPanelOpen) setUnreadMessageCount(0);
  }, [isChatPanelOpen]);

  const handleSendChatMessage = useCallback((content: string) => {
    socketRef.current?.emit("send-chat-message", { roomId, senderId: localParticipant.identity, senderName: localParticipant.name || localParticipant.identity, content });
  }, [roomId, localParticipant]);

  useEffect(() => {
    if (isChatPanelOpen) setUnreadMessageCount(0);
  }, [isChatPanelOpen, chatMessages]);

  const handleMuteAll = useCallback(async () => {
    const remote = participants.filter((p) => p.identity !== localParticipant.identity);
    let count = 0;
    for (const p of remote) { try { await handleMuteParticipant(p.identity, "audio", true); count++; } catch { } }
    toast({ title: "Muted All", description: `Muted ${count} participant(s)` });
  }, [participants, localParticipant.identity, handleMuteParticipant, toast]);

  const handleDisableAllCameras = useCallback(async () => {
    const remote = participants.filter((p) => p.identity !== localParticipant.identity);
    let count = 0;
    for (const p of remote) { try { await handleMuteParticipant(p.identity, "video", true); count++; } catch { } }
    toast({ title: "Cameras Disabled", description: `Disabled cameras for ${count} participant(s)` });
  }, [participants, localParticipant.identity, handleMuteParticipant, toast]);

  const handleToggleRoomLock = useCallback(() => {
    setIsRoomLocked((prev) => !prev);
    toast({ title: isRoomLocked ? "Room Unlocked" : "Room Locked", description: isRoomLocked ? "New participants can now join" : "No new participants can join" });
  }, [isRoomLocked, toast]);

  const handleEndMeeting = useCallback(async () => {
    try { await fetch(`/api/meetings/${roomId}/end`, { method: "PATCH" }); } catch { }
    toast({ title: "Meeting Ended", description: "All participants have been disconnected" });
    onLeave();
  }, [roomId, onLeave, toast]);

  const gridClass = useMemo(() => {
    if (screenShareTrack) return "grid-cols-1";
    if (visibleParticipants.length === 1) return "grid-cols-1";
    return "grid-cols-1 sm:grid-cols-2";
  }, [visibleParticipants.length, screenShareTrack]);

  const showScrollButtons = participants.length > 2;

  return (
    <div className="flex flex-col h-screen bg-background">
      <style>{`
        .lk-participant-tile {
          height: 100% !important;
          max-height: none !important;
          aspect-ratio: unset !important;
          min-height: 0 !important;
        }
        .lk-participant-tile video {
          height: 100% !important;
          width: 100% !important;
          object-fit: cover !important;
          aspect-ratio: unset !important;
        }
        .lk-focus-layout, .lk-grid-layout {
          height: 100% !important;
        }
      `}</style>

      <header id="meeting-header" className="flex items-center justify-between gap-2 px-4 py-2 border-b bg-card shrink-0 z-30">
        <div className="flex items-center gap-2">
          <h1 className="text-lg font-semibold hidden sm:block">பேசு தமிழ்</h1>
          <Badge variant="secondary" className="text-xs">Room: {roomId}</Badge>
          {isHost && (
            <Badge className="bg-amber-500/20 text-amber-600 border-amber-500/30 text-xs">
              <Crown className="w-3 h-3 mr-1" />Host
            </Badge>
          )}
          {showScrollButtons && (
            <Badge variant="outline" className="text-xs tabular-nums">
              {currentPage + 1} / {totalPages}
            </Badge>
          )}
        </div>
        <Button onClick={handleCopyLink} variant="outline" size="sm" data-testid="button-share-meeting">
          {copied ? <><Check className="w-4 h-4 mr-2" />Copied!</> : <><Link2 className="w-4 h-4 mr-2" />Share</>}
        </Button>
      </header>

      <div className="flex flex-1 overflow-hidden relative">
        <main className="flex-1 overflow-hidden flex flex-col" style={{ padding: "8px 8px 96px 8px" }}>
          {screenShareTrack && (
            <div className="mb-2 flex-shrink-0" style={{ height: "calc(100% - 1rem)" }}>
              <ParticipantTile participant={screenShareTrack.participant} videoTrack={screenShareTrack.publication} isScreenShare={true} />
            </div>
          )}
          <div
            className={cn("grid gap-2 flex-1 min-h-0 w-full", gridClass)}
            style={{ gridAutoRows: "1fr" }}
          >
            {visibleParticipants.map((participant) => {
              const videoTrack = participant.getTrackPublication(Track.Source.Camera);
              const audioTrack = participant.getTrackPublication(Track.Source.Microphone);
              const isLocal = participant.identity === localParticipant.identity;
              return (
                <div
                  key={participant.identity}
                  style={{
                    position: "relative",
                    width: "100%",
                    height: "100%",
                    minHeight: 0,
                  }}
                  className="[&>*]:!absolute [&>*]:!inset-0 [&>*]:!w-full [&>*]:!h-full [&>*]:!max-h-none [&>*]:!aspect-auto"
                >
                  <ParticipantTile participant={participant} videoTrack={videoTrack} audioTrack={audioTrack} isLocal={isLocal} />
                </div>
              );
            })}
          </div>
          {participants.length === 0 && (
            <div className="flex items-center justify-center flex-1">
              <div className="text-center text-muted-foreground">
                <p>Waiting for others to join...</p>
                <p className="text-sm mt-2">Share the meeting link to invite participants</p>
              </div>
            </div>
          )}
        </main>

        {showScrollButtons && (
          <div className="absolute right-2 top-1/2 -translate-y-1/2 flex flex-col gap-2 z-20">
            <button
              onClick={handleScrollUp}
              disabled={!canScrollUp}
              className={cn(
                "w-10 h-10 rounded-full flex items-center justify-center shadow-lg transition-all duration-200",
                "bg-background/90 backdrop-blur-sm border border-border",
                canScrollUp
                  ? "opacity-100 hover:bg-accent hover:scale-105 cursor-pointer"
                  : "opacity-25 cursor-not-allowed"
              )}
              aria-label="Previous participants"
            >
              <ChevronUp className="w-5 h-5 text-foreground" />
            </button>
            <button
              onClick={handleScrollDown}
              disabled={!canScrollDown}
              className={cn(
                "w-10 h-10 rounded-full flex items-center justify-center shadow-lg transition-all duration-200",
                "bg-background/90 backdrop-blur-sm border border-border",
                canScrollDown
                  ? "opacity-100 hover:bg-accent hover:scale-105 cursor-pointer"
                  : "opacity-25 cursor-not-allowed"
              )}
              aria-label="Next participants"
            >
              <ChevronDown className="w-5 h-5 text-foreground" />
            </button>
          </div>
        )}
      </div>

      <ParticipantsPanel participants={participants} localParticipantId={localParticipant.identity} isOpen={isParticipantsPanelOpen} onClose={() => setIsParticipantsPanelOpen(false)} roomId={roomId} isHost={isHost} onMuteParticipant={handleMuteParticipant} raisedHands={raisedHands} reactions={reactions} />
      <ChatPanel isOpen={isChatPanelOpen} onClose={() => setIsChatPanelOpen(false)} messages={chatMessages} onSendMessage={handleSendChatMessage} localParticipantId={localParticipant.identity} localParticipantName={localParticipant.name || localParticipant.identity} />

      {isHost && (
        <HostControlsPanel isOpen={isHostControlsOpen} onClose={() => setIsHostControlsOpen(false)} roomId={roomId} participantCount={participants.length} isRoomLocked={isRoomLocked} onMuteAll={handleMuteAll} onDisableAllCameras={handleDisableAllCameras} onToggleRoomLock={handleToggleRoomLock} onEndMeeting={handleEndMeeting} />
      )}

      {isWhiteboardOpen && (
        <div className="fixed inset-0 z-40 flex pb-16">
          <div className="flex-1 bg-black/50" onClick={() => setIsWhiteboardOpen(false)} />
          <div className="w-full max-w-4xl h-full">
            <WhiteboardPanel roomId={roomId} isHost={isHost} onClose={() => setIsWhiteboardOpen(false)} />
          </div>
        </div>
      )}

      <div id="meeting-controls">
        <ControlBar
          isAudioEnabled={isAudioEnabled}
          isVideoEnabled={isVideoEnabled}
          isScreenSharing={isScreenSharing}
          isParticipantsPanelOpen={isParticipantsPanelOpen}
          isWhiteboardOpen={isWhiteboardOpen}
          isHandRaised={isHandRaised}
          participantCount={participants.length}
          isHost={isHost}
          recordingState={recordingState}
          recordingDuration={recordingDuration}
          onToggleAudio={handleToggleAudio}
          onToggleVideo={handleToggleVideo}
          onToggleScreenShare={handleToggleScreenShare}
          onToggleParticipants={() => setIsParticipantsPanelOpen(!isParticipantsPanelOpen)}
          onToggleChat={handleToggleChat}
          onToggleWhiteboard={() => setIsWhiteboardOpen(!isWhiteboardOpen)}
          onToggleHostControls={() => setIsHostControlsOpen(!isHostControlsOpen)}
          onToggleHandRaise={handleToggleHandRaise}
          onSendReaction={handleSendReaction}
          onStartRecording={startRecording}
          onPauseRecording={pauseRecording}
          onResumeRecording={resumeRecording}
          onStopRecording={stopRecording}
          isChatPanelOpen={isChatPanelOpen}
          unreadMessageCount={unreadMessageCount}
          onLeave={onLeave}
        />
      </div>

      <RoomAudioRenderer />
    </div>
  );
}

function getVisitorId(): string {
  let visitorId = sessionStorage.getItem("visitorId");
  if (!visitorId) {
    visitorId = crypto.randomUUID();
    sessionStorage.setItem("visitorId", visitorId);
  }
  return visitorId;
}

export default function MeetingRoomLiveKit() {
  const params = useParams<{ roomId: string }>();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [token, setToken] = useState("");
  const [serverUrl, setServerUrl] = useState(DEFAULT_LIVEKIT_URL);
  const [isConnecting, setIsConnecting] = useState(true);
  const [isWaiting, setIsWaiting] = useState(false);
  const [error, setError] = useState("");
  const [isHost, setIsHost] = useState(false);
  const [participantName, setParticipantName] = useState<string | null>(null);
  const [hasCheckedStorage, setHasCheckedStorage] = useState(false);
  const [intentionalLeave, setIntentionalLeave] = useState(false);

  const retryCountRef = useRef(0);
  const socketRef = useRef<Socket | null>(null);
  const visitorId = getVisitorId();
  const urlParams = new URLSearchParams(window.location.search);
  const hostToken = urlParams.get("host") || undefined;

  useEffect(() => {
    const storedName = sessionStorage.getItem("participantName");
    setParticipantName(storedName);
    setHasCheckedStorage(true);
  }, []);

  const fetchToken = useCallback(async (name: string) => {
    try {
      const response = await fetch(`/api/meetings/${params.roomId}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ participantName: name, visitorId, hostToken }),
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || "Failed to join meeting");
      }
      const data = await response.json();

      if (data.status === "waiting") {
        setIsWaiting(true);
        setIsConnecting(false);
        if (!socketRef.current) {
          const socket = io({
            path: "/socket.io",
            transports: ["websocket", "polling"],
            reconnection: true,
            reconnectionDelay: 1000,
            reconnectionDelayMax: 5000,
          });
          socketRef.current = socket;
          socket.on("connect", () => {
            socket.emit("join-waiting-room", { roomId: params.roomId, visitorId, displayName: name });
          });
          socket.on("admitted", (d: { token: string; serverUrl: string }) => {
            setToken(d.token);
            setServerUrl(d.serverUrl);
            setIsWaiting(false);
            setIsConnecting(false);
            socket.disconnect();
            socketRef.current = null;
          });
          socket.on("host-joined", () => fetchToken(name));
          socket.on("connect_error", (error) => {
            console.error("[Waiting Room Socket] Connection error:", error);
            toast({ title: "Connection Error", description: "Failed to connect to waiting room", variant: "destructive" });
          });
        }
        return;
      }

      setToken(data.token);
      setIsHost(data.isHost || false);
      retryCountRef.current = 0;
      if (data.serverUrl) setServerUrl(data.serverUrl);
      setIsWaiting(false);
      setIsConnecting(false);
      setError("");
    } catch (err: any) {
      if (retryCountRef.current < 3) {
        retryCountRef.current++;
        setTimeout(() => fetchToken(name), 2000);
        return;
      }
      setError(err.message);
      setIsConnecting(false);
      toast({ title: "Connection Error", description: err.message, variant: "destructive" });
    }
  }, [params.roomId, visitorId, hostToken, toast]);

  useEffect(() => {
    if (!hasCheckedStorage) return;

    if (!participantName) {
      setLocation(`/room/${params.roomId}/join`);
      return;
    }

    // ✅ FIX: Prevent "Connection Lost" toast on refresh
    const handleBeforeUnload = () => {
      setIntentionalLeave(true);
    };
    window.addEventListener("beforeunload", handleBeforeUnload);

    retryCountRef.current = 0;
    fetchToken(participantName);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      socketRef.current?.disconnect();
      socketRef.current = null;
    };
  }, [params.roomId, participantName, setLocation, fetchToken, hasCheckedStorage]);

  const handleLeave = useCallback(() => {
    setIntentionalLeave(true);
    sessionStorage.removeItem("participantName");
    sessionStorage.removeItem("audioEnabled");
    sessionStorage.removeItem("videoEnabled");
    setLocation("/");
  }, [setLocation]);

  const handleDisconnect = useCallback(() => {
    if (!intentionalLeave) {
      toast({
        title: "Connection Lost",
        description: "You've been disconnected. Refresh the page to reconnect.",
        variant: "destructive"
      });
    }
  }, [intentionalLeave, toast]);

  const handleError = useCallback((err: Error) => {
    if (!intentionalLeave) {
      toast({ title: "Connection Error", description: err.message, variant: "destructive" });
    }
  }, [intentionalLeave, toast]);

  if (!hasCheckedStorage || !participantName) return null;

  if (isConnecting) return (
    <div className="min-h-screen bg-background flex items-center justify-center" data-testid="connecting-state">
      <div className="text-center">
        <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto mb-4" />
        <h2 className="text-xl font-semibold mb-2">Connecting to meeting...</h2>
        <p className="text-muted-foreground">Please wait while we set up your connection</p>
      </div>
    </div>
  );

  if (isWaiting) return (
    <div className="min-h-screen bg-background flex items-center justify-center" data-testid="waiting-room">
      <div className="text-center max-w-md px-4">
        <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-6">
          <Clock className="w-10 h-10 text-primary animate-pulse" />
        </div>
        <h2 className="text-2xl font-semibold mb-3">Waiting for Host</h2>
        <p className="text-muted-foreground mb-6">Please wait while the meeting host starts the session. You will be admitted automatically once the host joins.</p>
        <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground mb-6">
          <Users className="w-4 h-4" /><span>Room: {params.roomId}</span>
        </div>
        <div className="flex items-center justify-center gap-3">
          <Loader2 className="w-5 h-5 animate-spin text-primary" />
          <span className="text-sm text-muted-foreground">Waiting to be admitted...</span>
        </div>
        <Button variant="outline" className="mt-6" onClick={() => { socketRef.current?.disconnect(); socketRef.current = null; handleLeave(); }}>
          <ArrowLeft className="w-4 h-4 mr-2" />Leave Waiting Room
        </Button>
      </div>
    </div>
  );

  if (error) return (
    <div className="min-h-screen bg-background flex items-center justify-center" data-testid="error-state">
      <div className="text-center max-w-md px-4">
        <h2 className="text-xl font-semibold mb-2 text-destructive">Connection Failed</h2>
        <p className="text-muted-foreground mb-4">{error}</p>
        <Button onClick={() => setLocation("/")} data-testid="button-go-home"><ArrowLeft className="w-4 h-4 mr-2" />Go Back Home</Button>
      </div>
    </div>
  );

  if (!serverUrl) return (
    <div className="min-h-screen bg-background flex items-center justify-center" data-testid="config-error">
      <div className="text-center max-w-md px-4">
        <h2 className="text-xl font-semibold mb-2 text-destructive">Configuration Error</h2>
        <p className="text-muted-foreground mb-4">LiveKit URL is not configured. Please set VITE_LIVEKIT_URL environment variable.</p>
        <Button onClick={() => setLocation("/")} data-testid="button-go-home"><ArrowLeft className="w-4 h-4 mr-2" />Go Back Home</Button>
      </div>
    </div>
  );

  const initialAudioEnabled = sessionStorage.getItem("audioEnabled") !== "false";
  const initialVideoEnabled = sessionStorage.getItem("videoEnabled") !== "false";

  return (
    <LiveKitRoom
      token={token}
      serverUrl={serverUrl}
      connect={true}
      onDisconnected={handleDisconnect}
      onError={handleError}
      video={initialVideoEnabled}
      audio={initialAudioEnabled}
      options={{
        adaptiveStream: true,
        dynacast: true,
        publishDefaults: {
          videoSimulcast: true,
          screenShareSimulcast: true,
          stopMicTrackOnMute: true,
          // Removed fixed VP8 to allow auto-negotiation for stability
        },
        videoCaptureDefaults: {
          resolution: {
            width: 640,
            height: 360,
            frameRate: 30,
          }
        }
      }}
      data-testid="meeting-room-livekit"
    >
      <MeetingContent roomId={params.roomId!} serverUrl={serverUrl} onLeave={handleLeave} isHost={isHost} />
    </LiveKitRoom>
  );
}