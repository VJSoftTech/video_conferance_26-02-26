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
import { Loader2, ArrowLeft, Link2, Check, Crown, Clock, Users } from "lucide-react";
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

  // ✅ Called at record-start (not hook init) so tracks are definitely subscribed.
  // Returns the raw decoded WebRTC audio MediaStreamTracks for all remote participants.
  const getRemoteAudioTracks = useCallback((): MediaStreamTrack[] => {
    const tracks: MediaStreamTrack[] = [];
    room.remoteParticipants.forEach((participant) => {
      const pub = participant.getTrackPublication(Track.Source.Microphone);
      const track = pub?.track?.mediaStreamTrack;
      if (track && track.readyState === "live") {
        tracks.push(track);
      }
    });
    console.log("[Meeting] getRemoteAudioTracks called, found:", tracks.length);
    return tracks;
  }, [room]);

  // All video tracks that should appear in the recording grid (local + remote cameras/screenshare).
  const getCompositeVideoTracks = useCallback((): MediaStreamTrack[] => {
    const tracks: MediaStreamTrack[] = [];

    // Optionally prefer screen share as primary content if present.
    room.remoteParticipants.forEach((participant) => {
      const pub = participant.getTrackPublication(Track.Source.ScreenShare);
      const track = pub?.track?.mediaStreamTrack;
      if (track && track.readyState === "live") {
        tracks.push(track);
      }
    });

    const localScreenPub = room.localParticipant.getTrackPublication(
      Track.Source.ScreenShare
    );
    const localScreenTrack = localScreenPub?.track?.mediaStreamTrack;
    if (localScreenTrack && localScreenTrack.readyState === "live") {
      tracks.unshift(localScreenTrack);
    }

    const localCameraPub = room.localParticipant.getTrackPublication(
      Track.Source.Camera
    );
    const localCameraTrack = localCameraPub?.track?.mediaStreamTrack;
    if (localCameraTrack && localCameraTrack.readyState === "live") {
      tracks.push(localCameraTrack);
    }

    room.remoteParticipants.forEach((participant) => {
      const pub = participant.getTrackPublication(Track.Source.Camera);
      const track = pub?.track?.mediaStreamTrack;
      if (track && track.readyState === "live") {
        tracks.push(track);
      }
    });

    console.log("[Meeting] getCompositeVideoTracks called, found:", tracks.length);
    return tracks;
  }, [room]);

  const {
    state: recordingState,
    formattedDuration: recordingDuration,
    startRecording,
    pauseRecording,
    resumeRecording,
    stopRecording,
  } = useRecording({
    roomId,
    getRemoteAudioTracks, // ✅ callback — called when recording actually starts
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
  const [isReconnecting, setIsReconnecting] = useState(false);
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
      { source: Track.Source.Camera, withPlaceholder: true },
      { source: Track.Source.ScreenShare, withPlaceholder: false },
    ],
    { onlySubscribed: false }
  );

  const screenShareTrack = useMemo(
    () => tracks.find((t) => t.source === Track.Source.ScreenShare && t.publication?.isSubscribed),
    [tracks]
  );

  useEffect(() => {
    const initMedia = async () => {
      if (initialVideoEnabled) {
        try {
          await localParticipant.setCameraEnabled(true);
          setIsVideoEnabled(true);
        } catch (err: any) {
          setIsVideoEnabled(false);
          if (err.name === "NotAllowedError") {
            toast({ title: "Camera Access Denied", description: "Please allow camera access in your browser settings.", variant: "destructive" });
          }
        }
      } else {
        await localParticipant.setCameraEnabled(false);
        setIsVideoEnabled(false);
      }
      if (initialAudioEnabled) {
        try {
          await localParticipant.setMicrophoneEnabled(true);
          setIsAudioEnabled(true);
        } catch (err: any) {
          setIsAudioEnabled(false);
          if (err.name === "NotAllowedError") {
            toast({ title: "Microphone Access Denied", description: "Please allow microphone access in your browser settings.", variant: "destructive" });
          }
        }
      } else {
        await localParticipant.setMicrophoneEnabled(false);
        setIsAudioEnabled(false);
      }
    };
    initMedia();
  }, [localParticipant, toast, initialAudioEnabled, initialVideoEnabled]);

  useEffect(() => {
    const socket = io({ path: "/socket.io", transports: ["websocket", "polling"] });
    socketRef.current = socket;

    socket.on("connect", () => {
      if (isHost) socket.emit("host-presence", { roomId, isPresent: true });
      socket.emit("join-reaction-room", { roomId });
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

    return () => {
      if (isHost) socket.emit("host-presence", { roomId, isPresent: false });
      socket.disconnect();
      socketRef.current = null;
      reactionTimersRef.current.forEach((t) => clearTimeout(t));
      reactionTimersRef.current.clear();
    };
  }, [isHost, roomId]);

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

  useEffect(() => {
    const handleConnectionStateChange = (s: ConnectionState) => {
      if (s === ConnectionState.Reconnecting) {
        setIsReconnecting(true);
        toast({ title: "Reconnecting", description: "Connection lost. Attempting to reconnect..." });
      } else if (s === ConnectionState.Connected && isReconnecting) {
        setIsReconnecting(false);
        toast({ title: "Reconnected", description: "Connection restored successfully!" });
      } else if (s === ConnectionState.Disconnected) {
        toast({ title: "Disconnected", description: "You have been disconnected from the meeting.", variant: "destructive" });
      }
    };
    const handleScreenShareChange = () => setIsScreenSharing(localParticipant.isScreenShareEnabled);

    room.on(RoomEvent.ConnectionStateChanged, handleConnectionStateChange);
    room.on(RoomEvent.LocalTrackPublished, handleScreenShareChange);
    room.on(RoomEvent.LocalTrackUnpublished, handleScreenShareChange);
    return () => {
      room.off(RoomEvent.ConnectionStateChanged, handleConnectionStateChange);
      room.off(RoomEvent.LocalTrackPublished, handleScreenShareChange);
      room.off(RoomEvent.LocalTrackUnpublished, handleScreenShareChange);
    };
  }, [room, localParticipant, toast, isReconnecting]);

  const handleToggleAudio = useCallback(async () => {
    try {
      const newState = !isAudioEnabled;
      await localParticipant.setMicrophoneEnabled(newState);
      setIsAudioEnabled(newState);
    } catch {
      toast({ title: "Error", description: "Failed to toggle microphone", variant: "destructive" });
    }
  }, [isAudioEnabled, localParticipant, toast]);

  const handleToggleVideo = useCallback(async () => {
    try {
      const newState = !isVideoEnabled;
      await localParticipant.setCameraEnabled(newState);
      setIsVideoEnabled(newState);
    } catch {
      toast({ title: "Error", description: "Failed to toggle camera", variant: "destructive" });
    }
  }, [isVideoEnabled, localParticipant, toast]);

  const handleToggleScreenShare = useCallback(async () => {
    try {
      const newState = !isScreenSharing;
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
    for (const p of remote) { try { await handleMuteParticipant(p.identity, "audio", true); count++; } catch {} }
    toast({ title: "Muted All", description: `Muted ${count} participant(s)` });
  }, [participants, localParticipant.identity, handleMuteParticipant, toast]);

  const handleDisableAllCameras = useCallback(async () => {
    const remote = participants.filter((p) => p.identity !== localParticipant.identity);
    let count = 0;
    for (const p of remote) { try { await handleMuteParticipant(p.identity, "video", true); count++; } catch {} }
    toast({ title: "Cameras Disabled", description: `Disabled cameras for ${count} participant(s)` });
  }, [participants, localParticipant.identity, handleMuteParticipant, toast]);

  const handleToggleRoomLock = useCallback(() => {
    setIsRoomLocked((prev) => !prev);
    toast({ title: isRoomLocked ? "Room Unlocked" : "Room Locked", description: isRoomLocked ? "New participants can now join" : "No new participants can join" });
  }, [isRoomLocked, toast]);

  const handleEndMeeting = useCallback(async () => {
    try { await fetch(`/api/meetings/${roomId}/end`, { method: "PATCH" }); } catch {}
    toast({ title: "Meeting Ended", description: "All participants have been disconnected" });
    onLeave();
  }, [roomId, onLeave, toast]);

  const gridClass = useMemo(() => {
    const count = participants.length;
    if (screenShareTrack) return "grid-cols-1";
    if (count === 1) return "grid-cols-1 max-w-5xl mx-auto min-h-[70vh]";
    if (count === 2) return "grid-cols-1 sm:grid-cols-2 max-w-8xl mx-auto min-h-[70vh] mt-12";
    if (count <= 4) return "grid-cols-2";
    if (count <= 6) return "grid-cols-2 sm:grid-cols-3";
    return "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4";
  }, [participants.length, screenShareTrack]);

  return (
    <div className="flex flex-col h-screen bg-background">
      <header id="meeting-header" className="flex items-center justify-between gap-2 px-4 py-2 border-b bg-card shrink-0 z-30">
        <div className="flex items-center gap-2">
          <h1 className="text-lg font-semibold hidden sm:block">பேசு தமிழ்</h1>
          <Badge variant="secondary" className="text-xs">Room: {roomId}</Badge>
          {isHost && (
            <Badge className="bg-amber-500/20 text-amber-600 border-amber-500/30 text-xs">
              <Crown className="w-3 h-3 mr-1" />Host
            </Badge>
          )}
        </div>
        <Button onClick={handleCopyLink} variant="outline" size="sm" data-testid="button-share-meeting">
          {copied ? <><Check className="w-4 h-4 mr-2" />Copied!</> : <><Link2 className="w-4 h-4 mr-2" />Share</>}
        </Button>
      </header>

      <main className="flex-1 overflow-auto p-2 sm:p-4 pb-24">
        {screenShareTrack && (
          <div className="mb-4">
            <ParticipantTile participant={screenShareTrack.participant} videoTrack={screenShareTrack.publication} isScreenShare={true} />
          </div>
        )}
        <div className={cn("grid gap-2 sm:gap-4", gridClass)}>
          {participants.map((participant) => {
            const videoTrack = participant.getTrackPublication(Track.Source.Camera);
            const audioTrack = participant.getTrackPublication(Track.Source.Microphone);
            const isLocal = participant.identity === localParticipant.identity;
            return (
              <ParticipantTile key={participant.identity} participant={participant} videoTrack={videoTrack} audioTrack={audioTrack} isLocal={isLocal} />
            );
          })}
        </div>
        {participants.length === 0 && (
          <div className="flex items-center justify-center h-full">
            <div className="text-center text-muted-foreground">
              <p>Waiting for others to join...</p>
              <p className="text-sm mt-2">Share the meeting link to invite participants</p>
            </div>
          </div>
        )}
      </main>

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

  const retryCountRef = useRef(0);
  const socketRef = useRef<Socket | null>(null);
  const visitorId = getVisitorId();
  const participantName = sessionStorage.getItem("participantName");
  const urlParams = new URLSearchParams(window.location.search);
  const hostToken = urlParams.get("host") || undefined;

  const fetchToken = useCallback(async () => {
    try {
      const response = await fetch(`/api/meetings/${params.roomId}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ participantName, visitorId, hostToken }),
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
          const socket = io({ path: "/socket.io", transports: ["websocket", "polling"] });
          socketRef.current = socket;
          socket.on("connect", () => {
            socket.emit("join-waiting-room", { roomId: params.roomId, visitorId, displayName: participantName });
          });
          socket.on("admitted", (d: { token: string; serverUrl: string }) => {
            setToken(d.token);
            setServerUrl(d.serverUrl);
            setIsWaiting(false);
            setIsConnecting(false);
            socket.disconnect();
            socketRef.current = null;
          });
          socket.on("host-joined", () => fetchToken());
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
      if (retryCountRef.current < 3) { retryCountRef.current++; setTimeout(fetchToken, 2000); return; }
      setError(err.message);
      setIsConnecting(false);
      toast({ title: "Connection Error", description: err.message, variant: "destructive" });
    }
  }, [params.roomId, participantName, visitorId, hostToken, toast]);

  useEffect(() => {
    if (!participantName) { setLocation(`/room/${params.roomId}/join`); return; }
    retryCountRef.current = 0;
    fetchToken();
    return () => { socketRef.current?.disconnect(); socketRef.current = null; };
  }, [params.roomId, participantName, setLocation, fetchToken]);

  const handleLeave = useCallback(() => {
    sessionStorage.removeItem("participantName");
    sessionStorage.removeItem("audioEnabled");
    sessionStorage.removeItem("videoEnabled");
    setLocation("/");
  }, [setLocation]);

  const handleError = useCallback((err: Error) => {
    toast({ title: "Connection Error", description: err.message, variant: "destructive" });
  }, [toast]);

  if (!participantName) return null;

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
        <Button variant="outline" className="mt-6" onClick={() => { socketRef.current?.disconnect(); socketRef.current = null; setLocation("/"); }}>
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

  return (
    <LiveKitRoom token={token} serverUrl={serverUrl} connect={true} onDisconnected={handleLeave} onError={handleError} video={false} audio={false} data-testid="meeting-room-livekit">
      <MeetingContent roomId={params.roomId!} serverUrl={serverUrl} onLeave={handleLeave} isHost={isHost} />
    </LiveKitRoom>
  );
}