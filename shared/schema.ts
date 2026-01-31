import { pgTable, text, timestamp, boolean, serial, integer } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  name: true,
  email: true,
  password: true,
});

export const selectUserSchema = createSelectSchema(users);

export type InsertUser = z.infer<typeof insertUserSchema>;
export type SelectUser = typeof users.$inferSelect;

export const rooms = pgTable("rooms", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertRoomSchema = createInsertSchema(rooms).pick({
  name: true,
});

export type Room = typeof rooms.$inferSelect;
export type InsertRoom = z.infer<typeof insertRoomSchema>;

export const meetings = pgTable("meetings", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description"),
  roomId: text("room_id").notNull(),
  hostId: integer("host_id").references(() => users.id),
  scheduledAt: timestamp("scheduled_at").notNull(),
  duration: integer("duration").notNull(),
  passcode: text("passcode"),
  waitingRoom: boolean("waiting_room").default(false),
  maxParticipants: integer("max_participants").default(100),
  hostToken: text("host_token"),
  endedAt: timestamp("ended_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertMeetingSchema = createInsertSchema(meetings).pick({
  title: true,
  description: true,
  roomId: true,
  hostId: true,
  scheduledAt: true,
  duration: true,
  passcode: true,
  waitingRoom: true,
  maxParticipants: true,
});

export type Meeting = typeof meetings.$inferSelect;
export type InsertMeeting = z.infer<typeof insertMeetingSchema>;

// Meeting Notes
export const meetingNotes = pgTable("meeting_notes", {
  id: serial("id").primaryKey(),
  meetingId: integer("meeting_id").references(() => meetings.id).notNull(),
  authorId: integer("author_id").references(() => users.id),
  content: text("content").notNull(),
  isPinned: boolean("is_pinned").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type MeetingNote = typeof meetingNotes.$inferSelect;

// Meeting Tasks
export const meetingTasks = pgTable("meeting_tasks", {
  id: serial("id").primaryKey(),
  meetingId: integer("meeting_id").references(() => meetings.id).notNull(),
  createdBy: integer("created_by").references(() => users.id),
  title: text("title").notNull(),
  description: text("description"),
  status: text("status").default("todo").notNull(),
  priority: text("priority").default("medium"),
  dueAt: timestamp("due_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type MeetingTask = typeof meetingTasks.$inferSelect;

// Meeting Docs
export const meetingDocs = pgTable("meeting_docs", {
  id: serial("id").primaryKey(),
  meetingId: integer("meeting_id").references(() => meetings.id).notNull(),
  title: text("title").notNull(),
  content: text("content"),
  fileUrl: text("file_url"),
  fileType: text("file_type"),
  createdBy: integer("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type MeetingDoc = typeof meetingDocs.$inferSelect;

// Contacts
export const contacts = pgTable("contacts", {
  id: serial("id").primaryKey(),
  ownerUserId: integer("owner_user_id").references(() => users.id),
  name: text("name").notNull(),
  email: text("email").notNull(),
  avatarUrl: text("avatar_url"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type Contact = typeof contacts.$inferSelect;

// SMTP Settings for email
export const smtpSettings = pgTable("smtp_settings", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id),
  host: text("host").notNull(),
  port: integer("port").notNull(),
  secure: boolean("secure").default(true),
  username: text("username").notNull(),
  password: text("password").notNull(),
  fromEmail: text("from_email").notNull(),
  fromName: text("from_name"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type SmtpSettings = typeof smtpSettings.$inferSelect;

// Meeting invites sent
export const meetingInvites = pgTable("meeting_invites", {
  id: serial("id").primaryKey(),
  meetingId: integer("meeting_id").references(() => meetings.id).notNull(),
  recipientEmail: text("recipient_email").notNull(),
  recipientName: text("recipient_name"),
  sentAt: timestamp("sent_at").defaultNow().notNull(),
  status: text("status").default("sent"),
});

export type MeetingInvite = typeof meetingInvites.$inferSelect;

// Meeting Whiteboards for real-time collaboration
export const meetingWhiteboards = pgTable("meeting_whiteboards", {
  id: serial("id").primaryKey(),
  roomId: text("room_id").notNull(),
  snapshot: text("snapshot"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type MeetingWhiteboard = typeof meetingWhiteboards.$inferSelect;

// Meeting Participants - track admitted participants and waiting room
export const meetingParticipants = pgTable("meeting_participants", {
  id: serial("id").primaryKey(),
  roomId: text("room_id").notNull(),
  visitorId: text("visitor_id").notNull(),
  displayName: text("display_name").notNull(),
  isHost: boolean("is_host").default(false),
  admittedAt: timestamp("admitted_at"),
  lastSeenAt: timestamp("last_seen_at"),
  status: text("status").default("waiting").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type MeetingParticipant = typeof meetingParticipants.$inferSelect;

// Meeting Recordings
export const meetingRecordings = pgTable("meeting_recordings", {
  id: serial("id").primaryKey(),
  roomId: text("room_id").notNull(),
  meetingId: integer("meeting_id").references(() => meetings.id),
  hostId: integer("host_id").references(() => users.id),
  filename: text("filename").notNull(),
  originalFilename: text("original_filename"),
  fileSize: integer("file_size"),
  duration: integer("duration"),
  mimeType: text("mime_type").default("video/webm"),
  status: text("status").default("completed").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type MeetingRecording = typeof meetingRecordings.$inferSelect;

// LiveKit Token Types
export const liveKitTokenSchema = z.object({
  roomName: z.string(),
  participantName: z.string(),
});

export type LiveKitTokenRequest = z.infer<typeof liveKitTokenSchema>;

export const liveKitTokenResponseSchema = z.object({
  token: z.string(),
  serverUrl: z.string(),
  warning: z.string().optional(),
});

export type LiveKitTokenResponse = z.infer<typeof liveKitTokenResponseSchema>;

// Shared Participant type used across client and server
export interface Participant {
  id: string;
  name: string;
  roomId: string;
  joinedAt: Date;
}

// WebSocket Message Types
export const WS_EVENTS = {
  JOIN_ROOM: 'join-room',
  LEAVE_ROOM: 'leave-room',
  PARTICIPANT_JOINED: 'participant-joined',
  PARTICIPANT_LEFT: 'participant-left',
  SEND_MESSAGE: 'send-message',
  RECEIVE_MESSAGE: 'receive-message',
} as const;

export interface ChatMessage {
  id: string;
  sender: string;
  content: string;
  timestamp: number;
}

// Define event types for socket.io
export interface ServerToClientEvents {
  [WS_EVENTS.PARTICIPANT_JOINED]: (participant: Participant) => void;
  [WS_EVENTS.PARTICIPANT_LEFT]: (participantId: string) => void;
  "participant-updated": (data: any) => void;
  "existing-participants": (participants: Participant[]) => void;
  "error": (data: { message: string }) => void;
  "webrtc-offer": (data: any) => void;
  "webrtc-answer": (data: any) => void;
  "webrtc-ice-candidate": (data: any) => void;
  "host-joined": (data: { roomId: string }) => void;
  "host-left": (data: { roomId: string }) => void;
  "admitted": (data: { roomId: string; token: string; serverUrl: string }) => void;
  "reaction": (data: { emoji: string; participantId: string; participantName: string }) => void;
  "hand-raise-update": (data: { participantId: string; participantName: string; isRaised: boolean }) => void;
  "chat-message": (data: { id: string; senderId: string; senderName: string; content: string; timestamp: number }) => void;
}

export interface ClientToServerEvents {
  [WS_EVENTS.JOIN_ROOM]: (data: { roomId: string; participantName: string }, callback: (response: { participant: Participant }) => void) => void;
  [WS_EVENTS.LEAVE_ROOM]: () => void;
  "update-participant": (data: any) => void;
  "webrtc-offer": (data: any) => void;
  "webrtc-answer": (data: any) => void;
  "webrtc-ice-candidate": (data: any) => void;
  "host-presence": (data: { roomId: string; isPresent: boolean }) => void;
  "join-waiting-room": (data: { roomId: string; visitorId: string; displayName: string }) => void;
  "join-reaction-room": (data: { roomId: string }) => void;
  "send-reaction": (data: { roomId: string; emoji: string; participantId: string; participantName: string }) => void;
  "hand-raise": (data: { roomId: string; participantId: string; participantName: string; isRaised: boolean }) => void;
  "send-chat-message": (data: { roomId: string; senderId: string; senderName: string; content: string }) => void;
}
