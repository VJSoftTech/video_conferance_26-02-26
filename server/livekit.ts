import { AccessToken, RoomServiceClient } from "livekit-server-sdk";
import { EgressClient } from "livekit-server-sdk";

interface LiveKitConfig {
  apiKey: string;
  apiSecret: string;
  url: string;
}

const primaryConfig: LiveKitConfig | null = process.env.LIVEKIT_API_KEY && process.env.LIVEKIT_API_SECRET ? {
  apiKey: process.env.LIVEKIT_API_KEY,
  apiSecret: process.env.LIVEKIT_API_SECRET,
  url: process.env.VITE_LIVEKIT_URL || "",
} : null;

const fallbackConfig: LiveKitConfig | null = process.env.LIVEKIT_API_KEY_FALLBACK && process.env.LIVEKIT_API_SECRET_FALLBACK ? {
  apiKey: process.env.LIVEKIT_API_KEY_FALLBACK,
  apiSecret: process.env.LIVEKIT_API_SECRET_FALLBACK,
  url: process.env.VITE_LIVEKIT_URL_FALLBACK || process.env.VITE_LIVEKIT_URL || "",
} : null;

let usePrimaryConfig = true;
let tokenGenerationCount = 0;
let lastResetDate = new Date().toISOString().slice(0, 10);

const USAGE_WARNING_THRESHOLD = 9000;
const USAGE_LIMIT = 10000;

const roomHosts = new Map<string, string>();

let egressClient: EgressClient | null = null;

if (primaryConfig) {
  egressClient = new EgressClient(
    primaryConfig.url,
    primaryConfig.apiKey,
    primaryConfig.apiSecret
  );
} else if (fallbackConfig) {
  egressClient = new EgressClient(
    fallbackConfig.url,
    fallbackConfig.apiKey,
    fallbackConfig.apiSecret
  );
}

export { egressClient };

function resetCounterIfNewMonth() {
  const today = new Date().toISOString().slice(0, 10);
  const currentMonth = today.slice(0, 7);
  const lastResetMonth = lastResetDate.slice(0, 7);
  
  if (currentMonth !== lastResetMonth) {
    tokenGenerationCount = 0;
    lastResetDate = today;
    usePrimaryConfig = true;
  }
}

function getCurrentConfig(): LiveKitConfig | null {
  resetCounterIfNewMonth();
  
  if (usePrimaryConfig && primaryConfig) {
    return primaryConfig;
  }
  
  if (fallbackConfig) {
    return fallbackConfig;
  }
  
  return primaryConfig;
}

function getRoomServiceClient(): RoomServiceClient | null {
  const config = getCurrentConfig();
  if (!config) return null;
  
  const httpUrl = config.url.replace('wss://', 'https://').replace('ws://', 'http://');
  return new RoomServiceClient(httpUrl, config.apiKey, config.apiSecret);
}

export function setRoomHost(roomId: string, participantIdentity: string) {
  if (!roomHosts.has(roomId)) {
    roomHosts.set(roomId, participantIdentity);
    console.log(`[livekit] Set host for room ${roomId}: ${participantIdentity}`);
  }
}

export function getRoomHost(roomId: string): string | undefined {
  return roomHosts.get(roomId);
}

export function isHost(roomId: string, participantIdentity: string): boolean {
  return roomHosts.get(roomId) === participantIdentity;
}

export function clearRoomHost(roomId: string) {
  roomHosts.delete(roomId);
}

export async function generateToken(
  roomName: string, 
  participantName: string,
  options?: { isHost?: boolean }
): Promise<{
  token: string;
  serverUrl: string;
  isHost: boolean;
  warning?: string;
}> {
  const config = getCurrentConfig();
  
  if (!config) {
    throw new Error("LiveKit API key and secret are required. Please configure LIVEKIT_API_KEY and LIVEKIT_API_SECRET.");
  }

  const existingHost = roomHosts.get(roomName);
  const willBeHost = !existingHost || options?.isHost === true;
  
  if (willBeHost) {
    setRoomHost(roomName, participantName);
  }

  const at = new AccessToken(config.apiKey, config.apiSecret, {
    identity: participantName,
    name: participantName,
    ttl: "6h",
    metadata: JSON.stringify({ isHost: willBeHost }),
  });

  at.addGrant({
    roomJoin: true,
    room: roomName,
    canPublish: true,
    canSubscribe: true,
    canPublishData: true,
    roomAdmin: willBeHost,
  });

  tokenGenerationCount++;

  let warning: string | undefined;

  if (tokenGenerationCount >= USAGE_LIMIT) {
    if (fallbackConfig && usePrimaryConfig) {
      usePrimaryConfig = false;
      console.log("[livekit] Switching to fallback API key due to usage limit");
    } else if (!fallbackConfig) {
      warning = "Monthly usage limit approaching. Video calls may become unavailable.";
    }
  } else if (tokenGenerationCount >= USAGE_WARNING_THRESHOLD) {
    warning = `Approaching monthly limit: ${tokenGenerationCount}/${USAGE_LIMIT} tokens used.`;
  }

  const token = await at.toJwt();
  
  console.log(`[livekit] Generated token for ${participantName} in room ${roomName} (isHost: ${willBeHost})`);
  
  return {
    token,
    serverUrl: config.url,
    isHost: willBeHost,
    warning,
  };
}

export async function muteParticipant(
  roomName: string, 
  participantIdentity: string, 
  trackType: 'audio' | 'video',
  muted: boolean
): Promise<{ success: boolean; error?: string }> {
  try {
    const client = getRoomServiceClient();
    if (!client) {
      return { success: false, error: "LiveKit not configured" };
    }

    const participants = await client.listParticipants(roomName);
    const participant = participants.find(p => p.identity === participantIdentity);
    
    if (!participant) {
      return { success: false, error: "Participant not found in room" };
    }

    const sourceType = trackType === 'audio' ? 'MICROPHONE' : 'CAMERA';
    const track = participant.tracks?.find(t => 
      t.source?.toString().includes(sourceType) && t.sid
    );
    
    if (!track?.sid) {
      // If trying to mute and track doesn't exist, it's already effectively muted - return success
      if (muted) {
        console.log(`[livekit] No ${trackType} track for ${participantIdentity} - already off`);
        return { success: true };
      }
      // If trying to unmute and track doesn't exist, we can't do anything
      const friendlyType = trackType === 'audio' ? 'microphone' : 'camera';
      return { success: false, error: `Participant's ${friendlyType} is not available` };
    }

    await client.mutePublishedTrack(roomName, participantIdentity, track.sid, muted);
    
    console.log(`[livekit] ${muted ? 'Muted' : 'Unmuted'} ${trackType} for ${participantIdentity} in room ${roomName}`);
    
    return { success: true };
  } catch (error: any) {
    console.error(`[livekit] Error muting participant:`, error);
    return { success: false, error: error.message || "Failed to mute participant" };
  }
}

export async function getParticipants(roomName: string): Promise<any[]> {
  try {
    const client = getRoomServiceClient();
    if (!client) {
      return [];
    }

    const participants = await client.listParticipants(roomName);
    return participants;
  } catch (error: any) {
    console.error(`[livekit] Error getting participants:`, error);
    return [];
  }
}

export function isLiveKitConfigured(): boolean {
  return !!(primaryConfig || fallbackConfig);
}

export async function endMeetingForAll(roomName: string): Promise<{ success: boolean; error?: string; disconnectedCount?: number }> {
  try {
    const client = getRoomServiceClient();
    if (!client) {
      return { success: false, error: "LiveKit not configured" };
    }

    const participants = await client.listParticipants(roomName);
    let disconnectedCount = 0;

    for (const participant of participants) {
      try {
        await client.removeParticipant(roomName, participant.identity);
        disconnectedCount++;
        console.log(`[livekit] Removed participant ${participant.identity} from room ${roomName}`);
      } catch (err) {
        console.error(`[livekit] Failed to remove ${participant.identity}:`, err);
      }
    }

    clearRoomHost(roomName);
    console.log(`[livekit] Ended meeting ${roomName}, removed ${disconnectedCount} participants`);

    return { success: true, disconnectedCount };
  } catch (error: any) {
    console.error(`[livekit] Error ending meeting:`, error);
    return { success: false, error: error.message || "Failed to end meeting" };
  }
}

export function getUsageStats() {
  resetCounterIfNewMonth();
  return {
    tokensGenerated: tokenGenerationCount,
    limit: USAGE_LIMIT,
    warningThreshold: USAGE_WARNING_THRESHOLD,
    usingFallback: !usePrimaryConfig,
    hasFallback: !!fallbackConfig,
    percentUsed: Math.round((tokenGenerationCount / USAGE_LIMIT) * 100),
  };
}
