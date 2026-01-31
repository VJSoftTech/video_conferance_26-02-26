import { useState, useCallback, useRef, useEffect } from "react";
import type { AppSocket } from "@/lib/socket";

interface PeerConnection {
  pc: RTCPeerConnection;
  stream: MediaStream;
}

interface UseSimpleWebRTCOptions {
  socket: AppSocket | null;
  roomId: string;
  participantId: string;
  localStream: MediaStream | null;
}

// Using multiple free TURN servers for reliability
const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    // Google STUN servers
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    // Twilio STUN (free, no credentials needed)
    { urls: "stun:global.stun.twilio.com:3478" },
    // Free TURN from Metered (more reliable)
    {
      urls: "turn:a.relay.metered.ca:80",
      username: "e8dd65f92c62d5e5e3c6c185",
      credential: "uWdWNmkhvyqTmFur",
    },
    {
      urls: "turn:a.relay.metered.ca:80?transport=tcp",
      username: "e8dd65f92c62d5e5e3c6c185",
      credential: "uWdWNmkhvyqTmFur",
    },
    {
      urls: "turn:a.relay.metered.ca:443",
      username: "e8dd65f92c62d5e5e3c6c185",
      credential: "uWdWNmkhvyqTmFur",
    },
    {
      urls: "turn:a.relay.metered.ca:443?transport=tcp",
      username: "e8dd65f92c62d5e5e3c6c185",
      credential: "uWdWNmkhvyqTmFur",
    },
  ],
  iceCandidatePoolSize: 10,
  iceTransportPolicy: "all",
};

export function useSimpleWebRTC({
  socket,
  roomId,
  participantId,
  localStream,
}: UseSimpleWebRTCOptions) {
  const [remoteStreams, setRemoteStreams] = useState<Map<string, MediaStream>>(new Map());
  const peerConnectionsRef = useRef<Map<string, PeerConnection>>(new Map());
  const localStreamRef = useRef<MediaStream | null>(null);
  const participantIdRef = useRef<string>(participantId);
  const pendingCandidatesRef = useRef<Map<string, RTCIceCandidateInit[]>>(new Map());

  useEffect(() => {
    localStreamRef.current = localStream;
    
    // Update existing peer connections with new tracks
    if (localStream) {
      peerConnectionsRef.current.forEach((peerData, peerId) => {
        const senders = peerData.pc.getSenders();
        localStream.getTracks().forEach(track => {
          const existingSender = senders.find(s => s.track?.kind === track.kind);
          if (existingSender) {
            existingSender.replaceTrack(track);
          } else {
            peerData.pc.addTrack(track, localStream);
          }
        });
      });
    }
  }, [localStream]);

  useEffect(() => {
    participantIdRef.current = participantId;
  }, [participantId]);

  const createPeerConnection = useCallback((remoteParticipantId: string): RTCPeerConnection => {
    console.log(`[WebRTC] Creating peer connection for ${remoteParticipantId}`);
    
    // Close existing connection if any
    const existing = peerConnectionsRef.current.get(remoteParticipantId);
    if (existing) {
      console.log(`[WebRTC] Closing existing connection for ${remoteParticipantId}`);
      existing.pc.close();
    }
    
    const pc = new RTCPeerConnection(ICE_SERVERS);
    const remoteStream = new MediaStream();

    pc.onicecandidate = (event) => {
      if (event.candidate && socket) {
        console.log(`[WebRTC] Sending ICE candidate to ${remoteParticipantId}:`, event.candidate.type);
        socket.emit("webrtc-ice-candidate", {
          targetId: remoteParticipantId,
          candidate: event.candidate.toJSON(),
        });
      } else if (!event.candidate) {
        console.log(`[WebRTC] ICE gathering complete for ${remoteParticipantId}`);
      }
    };

    pc.ontrack = (event) => {
      console.log(`[WebRTC] *** RECEIVED TRACK from ${remoteParticipantId}:`, event.track.kind, event.track.readyState);
      
      // Add track to the remote stream
      remoteStream.addTrack(event.track);
      
      // Update state to trigger re-render
      setRemoteStreams(prev => {
        const next = new Map(prev);
        next.set(remoteParticipantId, remoteStream);
        return next;
      });
      
      // Log when track becomes live
      event.track.onunmute = () => {
        console.log(`[WebRTC] Track unmuted from ${remoteParticipantId}:`, event.track.kind);
        // Force re-render
        setRemoteStreams(prev => {
          const next = new Map(prev);
          next.set(remoteParticipantId, remoteStream);
          return next;
        });
      };
    };

    pc.onconnectionstatechange = () => {
      console.log(`[WebRTC] Connection state with ${remoteParticipantId}:`, pc.connectionState);
      if (pc.connectionState === "connected") {
        console.log(`[WebRTC] *** CONNECTED to ${remoteParticipantId}! ***`);
      }
    };

    pc.oniceconnectionstatechange = () => {
      console.log(`[WebRTC] ICE state with ${remoteParticipantId}:`, pc.iceConnectionState);
      if (pc.iceConnectionState === "connected" || pc.iceConnectionState === "completed") {
        console.log(`[WebRTC] *** ICE CONNECTED to ${remoteParticipantId}! ***`);
      }
      if (pc.iceConnectionState === "failed") {
        console.log(`[WebRTC] ICE FAILED for ${remoteParticipantId} - attempting restart`);
        pc.restartIce();
      }
    };

    pc.onicegatheringstatechange = () => {
      console.log(`[WebRTC] ICE gathering state with ${remoteParticipantId}:`, pc.iceGatheringState);
    };

    // Add local tracks to the peer connection
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => {
        console.log(`[WebRTC] Adding local track ${track.kind} to connection for ${remoteParticipantId}`);
        pc.addTrack(track, localStreamRef.current!);
      });
    } else {
      console.log(`[WebRTC] WARNING: No local stream available when creating connection for ${remoteParticipantId}`);
    }

    peerConnectionsRef.current.set(remoteParticipantId, { pc, stream: remoteStream });
    
    // Process any pending ICE candidates
    const pending = pendingCandidatesRef.current.get(remoteParticipantId);
    if (pending && pending.length > 0) {
      console.log(`[WebRTC] Processing ${pending.length} pending ICE candidates for ${remoteParticipantId}`);
      pending.forEach(candidate => {
        pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(err => {
          console.error("[WebRTC] Error adding pending ICE candidate:", err);
        });
      });
      pendingCandidatesRef.current.delete(remoteParticipantId);
    }
    
    return pc;
  }, [socket]);

  const createOffer = useCallback(async (remoteParticipantId: string) => {
    if (!socket) {
      console.log("[WebRTC] No socket, cannot create offer");
      return;
    }
    
    if (!localStreamRef.current) {
      console.log("[WebRTC] No local stream, delaying offer creation");
      setTimeout(() => createOffer(remoteParticipantId), 500);
      return;
    }
    
    const pc = createPeerConnection(remoteParticipantId);
    
    try {
      console.log(`[WebRTC] Creating offer for ${remoteParticipantId}`);
      const offer = await pc.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true,
      });
      await pc.setLocalDescription(offer);
      
      console.log(`[WebRTC] Sending offer to ${remoteParticipantId}`);
      socket.emit("webrtc-offer", {
        targetId: remoteParticipantId,
        sdp: offer,
      });
    } catch (error) {
      console.error("[WebRTC] Error creating offer:", error);
    }
  }, [createPeerConnection, socket]);

  const handleOffer = useCallback(async (fromId: string, sdp: RTCSessionDescriptionInit) => {
    if (!socket) return;
    
    console.log(`[WebRTC] Received offer from ${fromId}`);
    
    if (!localStreamRef.current) {
      console.log("[WebRTC] No local stream when receiving offer, waiting...");
      setTimeout(() => handleOffer(fromId, sdp), 500);
      return;
    }
    
    let peerData = peerConnectionsRef.current.get(fromId);
    if (!peerData) {
      createPeerConnection(fromId);
      peerData = peerConnectionsRef.current.get(fromId)!;
    }
    
    try {
      await peerData.pc.setRemoteDescription(new RTCSessionDescription(sdp));
      console.log(`[WebRTC] Set remote description from ${fromId}`);
      
      const answer = await peerData.pc.createAnswer();
      await peerData.pc.setLocalDescription(answer);
      
      console.log(`[WebRTC] Sending answer to ${fromId}`);
      socket.emit("webrtc-answer", {
        targetId: fromId,
        sdp: answer,
      });
    } catch (error) {
      console.error("[WebRTC] Error handling offer:", error);
    }
  }, [createPeerConnection, socket]);

  const handleAnswer = useCallback(async (fromId: string, sdp: RTCSessionDescriptionInit) => {
    console.log(`[WebRTC] Received answer from ${fromId}`);
    
    const peerData = peerConnectionsRef.current.get(fromId);
    if (peerData) {
      try {
        await peerData.pc.setRemoteDescription(new RTCSessionDescription(sdp));
        console.log(`[WebRTC] Set remote description (answer) from ${fromId}`);
      } catch (error) {
        console.error("[WebRTC] Error handling answer:", error);
      }
    } else {
      console.log(`[WebRTC] No peer connection for ${fromId} when handling answer`);
    }
  }, []);

  const handleIceCandidate = useCallback(async (fromId: string, candidate: RTCIceCandidateInit) => {
    console.log(`[WebRTC] Received ICE candidate from ${fromId}`);
    
    const peerData = peerConnectionsRef.current.get(fromId);
    if (peerData && peerData.pc.remoteDescription) {
      try {
        await peerData.pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (error) {
        console.error("[WebRTC] Error adding ICE candidate:", error);
      }
    } else {
      // Queue the candidate for later
      console.log(`[WebRTC] Queuing ICE candidate for ${fromId} (no remote description yet)`);
      const pending = pendingCandidatesRef.current.get(fromId) || [];
      pending.push(candidate);
      pendingCandidatesRef.current.set(fromId, pending);
    }
  }, []);

  const connectToParticipant = useCallback((remoteParticipantId: string) => {
    const myId = participantIdRef.current;
    if (!myId) {
      console.log("[WebRTC] No participant ID yet, cannot connect");
      return;
    }
    
    // Use string comparison to decide who initiates
    if (myId < remoteParticipantId) {
      console.log(`[WebRTC] I (${myId.slice(0,8)}) will initiate connection to ${remoteParticipantId.slice(0,8)}`);
      createOffer(remoteParticipantId);
    } else {
      console.log(`[WebRTC] Waiting for ${remoteParticipantId.slice(0,8)} to initiate connection to me (${myId.slice(0,8)})`);
    }
  }, [createOffer]);

  const disconnectFromParticipant = useCallback((remoteParticipantId: string) => {
    const peerData = peerConnectionsRef.current.get(remoteParticipantId);
    if (peerData) {
      peerData.pc.close();
      peerConnectionsRef.current.delete(remoteParticipantId);
      setRemoteStreams(prev => {
        const next = new Map(prev);
        next.delete(remoteParticipantId);
        return next;
      });
    }
  }, []);

  const disconnect = useCallback(() => {
    peerConnectionsRef.current.forEach((peerData) => {
      peerData.pc.close();
    });
    peerConnectionsRef.current.clear();
    pendingCandidatesRef.current.clear();
    setRemoteStreams(new Map());
  }, []);

  // Set up socket listeners
  useEffect(() => {
    if (!socket) return;

    const handleWebRTCOffer = ({ fromId, sdp }: { fromId: string; sdp: RTCSessionDescriptionInit }) => {
      handleOffer(fromId, sdp);
    };

    const handleWebRTCAnswer = ({ fromId, sdp }: { fromId: string; sdp: RTCSessionDescriptionInit }) => {
      handleAnswer(fromId, sdp);
    };

    const handleWebRTCIceCandidate = ({ fromId, candidate }: { fromId: string; candidate: RTCIceCandidateInit }) => {
      handleIceCandidate(fromId, candidate);
    };

    socket.on("webrtc-offer", handleWebRTCOffer);
    socket.on("webrtc-answer", handleWebRTCAnswer);
    socket.on("webrtc-ice-candidate", handleWebRTCIceCandidate);

    return () => {
      socket.off("webrtc-offer", handleWebRTCOffer);
      socket.off("webrtc-answer", handleWebRTCAnswer);
      socket.off("webrtc-ice-candidate", handleWebRTCIceCandidate);
    };
  }, [socket, handleOffer, handleAnswer, handleIceCandidate]);

  return {
    remoteStreams,
    connectToParticipant,
    disconnectFromParticipant,
    disconnect,
  };
}
