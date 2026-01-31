import { useState, useEffect, useCallback, useRef } from "react";
import { useLocation, useParams, useSearch } from "wouter";
import { VideoGrid } from "@/components/video-grid";
import { ControlBar } from "@/components/control-bar";
import { MeetingHeader } from "@/components/meeting-header";
import { ParticipantPanel } from "@/components/participant-panel";
import { useMediaDevices } from "@/hooks/use-media-devices";
import { useSimpleWebRTC } from "@/hooks/use-simple-webrtc";
import { getSocket, disconnectSocket, type AppSocket } from "@/lib/socket";
import { useToast } from "@/hooks/use-toast";
import type { Participant } from "@shared/schema";
import { Loader2 } from "lucide-react";

export default function MeetingRoom() {
  const params = useParams<{ roomId: string }>();
  const searchString = useSearch();
  const urlParams = new URLSearchParams(searchString);
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  
  const urlUserName = urlParams.get('user');
  const urlVideoEnabled = urlParams.get('video');
  const urlAudioEnabled = urlParams.get('audio');
  
  const [socket, setSocket] = useState<AppSocket | null>(null);
  const [localParticipant, setLocalParticipant] = useState<Participant | null>(null);
  const localParticipantIdRef = useRef<string>("");

  const [isConnecting, setIsConnecting] = useState(true);
  const [isParticipantPanelOpen, setIsParticipantPanelOpen] = useState(false);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [joinedAt, setJoinedAt] = useState<number | undefined>();
  
  // Queue for participants to connect to after we have our local stream
  const pendingConnectionsRef = useRef<string[]>([]);
  const isReadyRef = useRef(false);

  const {
    localStream,
    isAudioEnabled,
    isVideoEnabled,
    isScreenSharing,
    screenStream,
    getLocalStream,
    toggleAudio,
    toggleVideo,
    startScreenShare,
    stopScreenShare,
    stopAllStreams,
  } = useMediaDevices();

  const {
    remoteStreams,
    connectToParticipant,
    disconnectFromParticipant,
    disconnect: disconnectWebRTC,
  } = useSimpleWebRTC({
    socket,
    roomId: params.roomId || "",
    participantId: localParticipantIdRef.current,
    localStream,
  });

  const participantName = urlUserName || sessionStorage.getItem("participantName");
  
  if (urlUserName) {
    sessionStorage.setItem("participantName", urlUserName);
  }
  if (urlVideoEnabled !== null) {
    sessionStorage.setItem("videoEnabled", urlVideoEnabled === '1' ? 'true' : 'false');
  }
  if (urlAudioEnabled !== null) {
    sessionStorage.setItem("audioEnabled", urlAudioEnabled === '1' ? 'true' : 'false');
  }

  // Process pending connections when ready
  const processPendingConnections = useCallback(() => {
    if (isReadyRef.current && pendingConnectionsRef.current.length > 0) {
      const pending = [...pendingConnectionsRef.current];
      pendingConnectionsRef.current = [];
      console.log("[MeetingRoom] Processing pending connections:", pending);
      pending.forEach((participantId, index) => {
        setTimeout(() => {
          console.log("[MeetingRoom] Connecting to:", participantId);
          connectToParticipant(participantId);
        }, index * 300);
      });
    }
  }, [connectToParticipant]);

  // Mark ready when we have localParticipant and localStream
  useEffect(() => {
    if (localParticipant && localStream && !isReadyRef.current) {
      console.log("[MeetingRoom] Ready - processing pending connections");
      isReadyRef.current = true;
      processPendingConnections();
    }
  }, [localParticipant, localStream, processPendingConnections]);

  const joinRoom = useCallback(async (name: string) => {
    if (!params.roomId) return;

    try {
      const sock = getSocket();

      await new Promise<void>((resolve) => {
        if (sock.connected) {
          resolve();
        } else {
          sock.on("connect", () => resolve());
          sock.connect();
        }
      });

      setSocket(sock);

      // Set up socket listeners BEFORE emitting join-room
      sock.on("participant-joined", (participant) => {
        console.log("[MeetingRoom] Participant joined:", participant.name);
        setParticipants((prev) => {
          if (prev.find((p) => p.id === participant.id)) return prev;
          return [...prev, participant];
        });
        toast({
          title: "Participant joined",
          description: `${participant.name} has joined the meeting`,
        });
        
        // Queue or connect immediately
        if (isReadyRef.current) {
          setTimeout(() => connectToParticipant(participant.id), 300);
        } else {
          pendingConnectionsRef.current.push(participant.id);
        }
      });

      sock.on("participant-left", (participantId) => {
        setParticipants((prev) => {
          const participant = prev.find((p) => p.id === participantId);
          if (participant) {
            toast({
              title: "Participant left",
              description: `${participant.name} has left the meeting`,
            });
          }
          return prev.filter((p) => p.id !== participantId);
        });
        disconnectFromParticipant(participantId);
      });

      sock.on("participant-updated", (update) => {
        setLocalParticipant((prev) => {
          if (prev && prev.id === update.id) {
            return { ...prev, ...update };
          }
          return prev;
        });
        setParticipants((prev) =>
          prev.map((p) => (p.id === update.id ? { ...p, ...update } : p))
        );
      });

      sock.on("existing-participants", (existingParticipants) => {
        console.log("[MeetingRoom] Existing participants:", existingParticipants.length);
        setParticipants(existingParticipants);
        
        // Queue connections to all existing participants
        existingParticipants.forEach((p) => {
          if (isReadyRef.current) {
            setTimeout(() => connectToParticipant(p.id), 300);
          } else {
            pendingConnectionsRef.current.push(p.id);
          }
        });
      });

      sock.on("error", (error) => {
        toast({
          title: "Error",
          description: error.message,
          variant: "destructive",
        });
      });

      // Now emit join-room
      sock.emit("join-room", 
        { roomId: params.roomId, participantName: name },
        async (response) => {
          console.log("[MeetingRoom] Joined room, participant ID:", response.participant.id);
          localParticipantIdRef.current = response.participant.id;
          setLocalParticipant(response.participant);
          setJoinedAt(Date.now());
          setIsConnecting(false);
        }
      );

    } catch (error) {
      console.error("Failed to join room:", error);
      toast({
        title: "Connection failed",
        description: "Failed to join the meeting. Please try again.",
        variant: "destructive",
      });
      setLocation("/");
    }
  }, [params.roomId, toast, setLocation, connectToParticipant, disconnectFromParticipant]);

  useEffect(() => {
    if (!participantName) {
      setLocation(`/room/${params.roomId}/join`);
      return;
    }

    const init = async () => {
      await getLocalStream();
      await joinRoom(participantName);
    };

    init();

    return () => {
      if (socket) {
        socket.emit("leave-room");
      }
      disconnectWebRTC();
      disconnectSocket();
      stopAllStreams();
    };
  }, [params.roomId]);

  useEffect(() => {
    if (socket && localParticipant) {
      socket.emit("update-participant", {
        isAudioEnabled,
        isVideoEnabled,
        isScreenSharing,
      });
    }
  }, [socket, isAudioEnabled, isVideoEnabled, isScreenSharing, localParticipant]);

  const handleToggleAudio = useCallback(() => {
    toggleAudio();
  }, [toggleAudio]);

  const handleToggleVideo = useCallback(() => {
    toggleVideo();
  }, [toggleVideo]);

  const handleToggleScreenShare = useCallback(async () => {
    if (isScreenSharing) {
      stopScreenShare();
    } else {
      await startScreenShare();
    }
  }, [isScreenSharing, startScreenShare, stopScreenShare]);

  const handleLeave = useCallback(() => {
    if (socket) {
      socket.emit("leave-room");
    }
    disconnectWebRTC();
    disconnectSocket();
    stopAllStreams();
    sessionStorage.removeItem("participantName");
    sessionStorage.removeItem("audioEnabled");
    sessionStorage.removeItem("videoEnabled");
    setLocation("/");
  }, [socket, stopAllStreams, setLocation, disconnectWebRTC]);

  const meetingLink = `${window.location.origin}/room/${params.roomId}`;

  const participantsWithStreams = participants.map((p) => ({
    ...p,
    stream: remoteStreams.get(p.id) || null,
  }));

  if (!participantName) {
    return null;
  }

  if (isConnecting) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center" data-testid="connecting-state">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">Connecting to meeting...</h2>
          <p className="text-muted-foreground">Please wait while we set up your connection</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col" data-testid="meeting-room">
      <MeetingHeader
        roomName={`Meeting ${params.roomId}`}
        roomId={params.roomId || ""}
        participantCount={participants.length + (localParticipant ? 1 : 0)}
        joinedAt={joinedAt}
      />

      <div className="flex-1 pt-16 pb-24">
        <VideoGrid
          participants={participantsWithStreams}
          localStream={localStream}
          localParticipant={localParticipant ? { ...localParticipant, isAudioEnabled, isVideoEnabled } : null}
          screenShareStream={screenStream}
          screenShareParticipant={isScreenSharing && localParticipant ? localParticipant : undefined}
        />
      </div>

      <ParticipantPanel
        participants={participants}
        localParticipant={localParticipant ? { ...localParticipant, isAudioEnabled, isVideoEnabled } : null}
        isOpen={isParticipantPanelOpen}
        onClose={() => setIsParticipantPanelOpen(false)}
      />

      <ControlBar
        isAudioEnabled={isAudioEnabled}
        isVideoEnabled={isVideoEnabled}
        isScreenSharing={isScreenSharing}
        participantCount={participants.length + (localParticipant ? 1 : 0)}
        meetingLink={meetingLink}
        onToggleAudio={handleToggleAudio}
        onToggleVideo={handleToggleVideo}
        onToggleScreenShare={handleToggleScreenShare}
        onToggleParticipants={() => setIsParticipantPanelOpen(!isParticipantPanelOpen)}
        onLeave={handleLeave}
      />
    </div>
  );
}
