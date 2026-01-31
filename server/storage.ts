import type { Room, Participant, CreateRoom } from "@shared/schema";
import { randomUUID } from "crypto";

export interface IStorage {
  createRoom(data: CreateRoom): Promise<Room>;
  getRoom(id: string): Promise<Room | undefined>;
  deleteRoom(id: string): Promise<void>;
  addParticipant(roomId: string, name: string): Promise<Participant>;
  getParticipant(id: string): Promise<Participant | undefined>;
  getParticipantsByRoom(roomId: string): Promise<Participant[]>;
  updateParticipant(id: string, data: Partial<Participant>): Promise<Participant | undefined>;
  removeParticipant(id: string): Promise<void>;
}

export class MemStorage implements IStorage {
  private rooms: Map<string, Room>;
  private participants: Map<string, Participant>;

  constructor() {
    this.rooms = new Map();
    this.participants = new Map();
  }

  async createRoom(data: CreateRoom): Promise<Room> {
    const id = randomUUID().slice(0, 8);
    const room: Room = {
      id,
      name: data.name,
      createdAt: Date.now(),
    };
    this.rooms.set(id, room);
    return room;
  }

  async getRoom(id: string): Promise<Room | undefined> {
    return this.rooms.get(id);
  }

  async deleteRoom(id: string): Promise<void> {
    this.rooms.delete(id);
    for (const [participantId, participant] of this.participants) {
      if (participant.roomId === id) {
        this.participants.delete(participantId);
      }
    }
  }

  async addParticipant(roomId: string, name: string): Promise<Participant> {
    const id = randomUUID();
    const participant: Participant = {
      id,
      name,
      roomId,
      isAudioEnabled: true,
      isVideoEnabled: true,
      isScreenSharing: false,
      isSpeaking: false,
      joinedAt: Date.now(),
    };
    this.participants.set(id, participant);
    return participant;
  }

  async getParticipant(id: string): Promise<Participant | undefined> {
    return this.participants.get(id);
  }

  async getParticipantsByRoom(roomId: string): Promise<Participant[]> {
    return Array.from(this.participants.values()).filter(
      (p) => p.roomId === roomId
    );
  }

  async updateParticipant(id: string, data: Partial<Participant>): Promise<Participant | undefined> {
    const participant = this.participants.get(id);
    if (!participant) return undefined;
    
    const updated = { ...participant, ...data, id: participant.id };
    this.participants.set(id, updated);
    return updated;
  }

  async removeParticipant(id: string): Promise<void> {
    this.participants.delete(id);
  }
}

export const storage = new MemStorage();
