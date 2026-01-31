import { useState, useCallback, useRef, useEffect } from "react";
import { Device, types } from "mediasoup-client";
import type { AppSocket } from "@/lib/socket";

type Transport = types.Transport;
type Producer = types.Producer;
type Consumer = types.Consumer;
type RtpCapabilities = types.RtpCapabilities;

interface ProducerInfo {
  producerId: string;
  participantId: string;
  kind: string;
}

interface UseWebRTCOptions {
  socket: AppSocket | null;
  roomId: string;
  localStream: MediaStream | null;
  screenStream: MediaStream | null;
  isAudioEnabled: boolean;
  isVideoEnabled: boolean;
}

export function useWebRTC({
  socket,
  roomId,
  localStream,
  screenStream,
  isAudioEnabled,
  isVideoEnabled,
}: UseWebRTCOptions) {
  const [isConnected, setIsConnected] = useState(false);
  const [remoteStreams, setRemoteStreams] = useState<Map<string, MediaStream>>(new Map());

  const deviceRef = useRef<Device | null>(null);
  const sendTransportRef = useRef<Transport | null>(null);
  const recvTransportRef = useRef<Transport | null>(null);
  const producersRef = useRef<Map<string, Producer>>(new Map());
  const consumersRef = useRef<Map<string, Consumer>>(new Map());
  const rtpCapabilitiesRef = useRef<RtpCapabilities | null>(null);
  const audioProducerRef = useRef<Producer | null>(null);
  const videoProducerRef = useRef<Producer | null>(null);
  const screenProducerRef = useRef<Producer | null>(null);
  const pendingProducersRef = useRef<ProducerInfo[]>([]);
  const hasStartedProducingRef = useRef(false);

  const loadDevice = useCallback(async (routerRtpCapabilities: RtpCapabilities) => {
    try {
      const device = new Device();
      await device.load({ routerRtpCapabilities });
      deviceRef.current = device;
      rtpCapabilitiesRef.current = device.rtpCapabilities;
      console.log("Device loaded with RTP capabilities");
      return device;
    } catch (error) {
      console.error("Failed to load device:", error);
      throw error;
    }
  }, []);

  const createSendTransport = useCallback(async (): Promise<Transport | null> => {
    if (!socket || !deviceRef.current) {
      console.error("Cannot create send transport: socket or device missing");
      return null;
    }

    return new Promise((resolve) => {
      socket.emit("create-transport", { type: "send" }, async (transportOptions) => {
        if (!transportOptions || !deviceRef.current) {
          console.error("No transport options received");
          resolve(null);
          return;
        }

        const transport = deviceRef.current.createSendTransport(transportOptions);
        console.log("Send transport created:", transport.id);

        transport.on("connect", ({ dtlsParameters }, callback, errback) => {
          console.log("Send transport connecting...");
          socket.emit("connect-transport", { transportId: transport.id, dtlsParameters }, () => {
            console.log("Send transport connected");
            callback();
          });
        });

        transport.on("produce", ({ kind, rtpParameters }, callback, errback) => {
          console.log("Producing:", kind);
          socket.emit("produce", { transportId: transport.id, kind, rtpParameters }, (producerId) => {
            console.log("Producer created:", producerId, kind);
            callback({ id: producerId });
          });
        });

        transport.on("connectionstatechange", (state) => {
          console.log("Send transport state:", state);
          if (state === "failed" || state === "closed") {
            transport.close();
          }
        });

        sendTransportRef.current = transport;
        resolve(transport);
      });
    });
  }, [socket]);

  const createRecvTransport = useCallback(async (): Promise<Transport | null> => {
    if (!socket || !deviceRef.current) {
      console.error("Cannot create recv transport: socket or device missing");
      return null;
    }

    return new Promise((resolve) => {
      socket.emit("create-transport", { type: "recv" }, async (transportOptions) => {
        if (!transportOptions || !deviceRef.current) {
          console.error("No transport options received");
          resolve(null);
          return;
        }

        const transport = deviceRef.current.createRecvTransport(transportOptions);
        console.log("Recv transport created:", transport.id);

        transport.on("connect", ({ dtlsParameters }, callback, errback) => {
          console.log("Recv transport connecting...");
          socket.emit("connect-transport", { transportId: transport.id, dtlsParameters }, () => {
            console.log("Recv transport connected");
            callback();
          });
        });

        transport.on("connectionstatechange", (state) => {
          console.log("Recv transport state:", state);
          if (state === "failed" || state === "closed") {
            transport.close();
          }
        });

        recvTransportRef.current = transport;
        resolve(transport);
      });
    });
  }, [socket]);

  const produceTrack = useCallback(async (track: MediaStreamTrack, isScreen = false): Promise<Producer | null> => {
    if (!sendTransportRef.current) {
      console.error("Cannot produce: no send transport");
      return null;
    }

    try {
      console.log("Producing track:", track.kind, track.id);
      const producer = await sendTransportRef.current.produce({ track });
      producersRef.current.set(producer.id, producer);

      producer.on("transportclose", () => {
        console.log("Producer transport closed:", producer.id);
        producersRef.current.delete(producer.id);
      });

      producer.on("trackended", () => {
        console.log("Producer track ended:", producer.id);
        producer.close();
        producersRef.current.delete(producer.id);
        socket?.emit("close-producer", { producerId: producer.id });
        
        if (producer === audioProducerRef.current) audioProducerRef.current = null;
        if (producer === videoProducerRef.current) videoProducerRef.current = null;
        if (producer === screenProducerRef.current) screenProducerRef.current = null;
      });

      return producer;
    } catch (error) {
      console.error("Failed to produce:", error);
      return null;
    }
  }, [socket]);

  const consumeProducer = useCallback(async (
    producerId: string,
    participantId: string
  ): Promise<void> => {
    if (!socket || !recvTransportRef.current || !rtpCapabilitiesRef.current) {
      console.log("Cannot consume yet, storing for later:", producerId, participantId);
      pendingProducersRef.current.push({ producerId, participantId, kind: "" });
      return;
    }

    console.log("Consuming producer:", producerId, "from participant:", participantId);

    socket.emit("consume", { producerId, rtpCapabilities: rtpCapabilitiesRef.current }, async (consumerOptions) => {
      if (!consumerOptions || !recvTransportRef.current) {
        console.error("No consumer options received");
        return;
      }

      try {
        console.log("Creating consumer:", consumerOptions.id, consumerOptions.kind);
        const consumer = await recvTransportRef.current.consume({
          id: consumerOptions.id,
          producerId: consumerOptions.producerId,
          kind: consumerOptions.kind,
          rtpParameters: consumerOptions.rtpParameters,
        });

        consumersRef.current.set(consumer.id, consumer);
        console.log("Consumer created, track:", consumer.track.kind, consumer.track.id);

        // Resume the consumer immediately
        socket.emit("resume-consumer", { consumerId: consumer.id }, () => {
          console.log("Consumer resumed on server:", consumer.id);
        });
        
        // Resume locally as well
        await consumer.resume();
        console.log("Consumer resumed locally:", consumer.id);

        // Create or update remote stream for this participant
        // Always create a NEW MediaStream to ensure React detects the change
        setRemoteStreams((prev) => {
          const next = new Map(prev);
          const existingStream = next.get(participantId);
          
          // Collect existing tracks (excluding same kind) and add new track
          const existingTracks = existingStream 
            ? existingStream.getTracks().filter(t => t.kind !== consumer.track.kind)
            : [];
          
          // Create a new MediaStream with all tracks
          const newStream = new MediaStream([...existingTracks, consumer.track]);
          console.log("Created new MediaStream for participant:", participantId, "tracks:", newStream.getTracks().map(t => t.kind));
          
          next.set(participantId, newStream);
          return next;
        });

        consumer.on("transportclose", () => {
          console.log("Consumer transport closed:", consumer.id);
          consumersRef.current.delete(consumer.id);
        });

        // @ts-ignore - producerclose is a valid event but not in types
        consumer.observer.on("close", () => {
          console.log("Consumer closed:", consumer.id);
          consumersRef.current.delete(consumer.id);
          setRemoteStreams((prev) => {
            const next = new Map(prev);
            const stream = next.get(participantId);
            if (stream) {
              const tracks = stream.getTracks().filter(t => t.id !== consumer.track.id);
              if (tracks.length === 0) {
                next.delete(participantId);
              } else {
                const newStream = new MediaStream(tracks);
                next.set(participantId, newStream);
              }
            }
            return next;
          });
        });
      } catch (error) {
        console.error("Failed to consume:", error);
      }
    });
  }, [socket]);

  const startProducing = useCallback(async () => {
    if (!localStream || !sendTransportRef.current) {
      console.log("Cannot start producing: localStream or sendTransport missing");
      return;
    }

    if (hasStartedProducingRef.current) {
      console.log("Already started producing");
      return;
    }

    hasStartedProducingRef.current = true;
    console.log("Starting to produce...");

    const audioTrack = localStream.getAudioTracks()[0];
    const videoTrack = localStream.getVideoTracks()[0];

    if (audioTrack && !audioProducerRef.current) {
      console.log("Producing audio track");
      audioProducerRef.current = await produceTrack(audioTrack);
      if (audioProducerRef.current && !isAudioEnabled) {
        audioProducerRef.current.pause();
      }
    }
    if (videoTrack && !videoProducerRef.current) {
      console.log("Producing video track");
      videoProducerRef.current = await produceTrack(videoTrack);
      if (videoProducerRef.current && !isVideoEnabled) {
        videoProducerRef.current.pause();
      }
    }
  }, [localStream, produceTrack, isAudioEnabled, isVideoEnabled]);

  // Process any pending producers once connected
  const processPendingProducers = useCallback(async () => {
    if (!recvTransportRef.current || !rtpCapabilitiesRef.current) return;
    
    const pending = pendingProducersRef.current;
    pendingProducersRef.current = [];
    
    for (const producer of pending) {
      await consumeProducer(producer.producerId, producer.participantId);
    }
  }, [consumeProducer]);

  // Handle audio/video toggle by pausing/resuming producers
  useEffect(() => {
    if (audioProducerRef.current) {
      if (isAudioEnabled) {
        audioProducerRef.current.resume();
        console.log("Audio producer resumed");
      } else {
        audioProducerRef.current.pause();
        console.log("Audio producer paused");
      }
    }
  }, [isAudioEnabled]);

  useEffect(() => {
    if (videoProducerRef.current) {
      if (isVideoEnabled) {
        videoProducerRef.current.resume();
        console.log("Video producer resumed");
      } else {
        videoProducerRef.current.pause();
        console.log("Video producer paused");
      }
    }
  }, [isVideoEnabled]);

  // Handle screen share
  useEffect(() => {
    const handleScreenShare = async () => {
      if (screenStream && sendTransportRef.current && !screenProducerRef.current) {
        const videoTrack = screenStream.getVideoTracks()[0];
        if (videoTrack) {
          screenProducerRef.current = await produceTrack(videoTrack, true);
        }
      } else if (!screenStream && screenProducerRef.current) {
        screenProducerRef.current.close();
        socket?.emit("close-producer", { producerId: screenProducerRef.current.id });
        producersRef.current.delete(screenProducerRef.current.id);
        screenProducerRef.current = null;
      }
    };
    handleScreenShare();
  }, [screenStream, produceTrack, socket]);

  const connect = useCallback(async (rtpCapabilities: RtpCapabilities) => {
    try {
      console.log("Connecting WebRTC...");
      await loadDevice(rtpCapabilities);
      await createSendTransport();
      await createRecvTransport();
      setIsConnected(true);
      console.log("WebRTC connected!");
      
      // Process any pending producers
      setTimeout(() => {
        processPendingProducers();
      }, 100);
    } catch (error) {
      console.error("Failed to connect WebRTC:", error);
    }
  }, [loadDevice, createSendTransport, createRecvTransport, processPendingProducers]);

  const disconnect = useCallback(() => {
    console.log("Disconnecting WebRTC...");
    hasStartedProducingRef.current = false;
    
    producersRef.current.forEach((producer) => {
      producer.close();
    });
    producersRef.current.clear();
    audioProducerRef.current = null;
    videoProducerRef.current = null;
    screenProducerRef.current = null;

    consumersRef.current.forEach((consumer) => {
      consumer.close();
    });
    consumersRef.current.clear();

    sendTransportRef.current?.close();
    recvTransportRef.current?.close();
    sendTransportRef.current = null;
    recvTransportRef.current = null;

    deviceRef.current = null;
    setIsConnected(false);
    setRemoteStreams(new Map());
    pendingProducersRef.current = [];
  }, []);

  const removeParticipantStream = useCallback((participantId: string) => {
    setRemoteStreams((prev) => {
      const next = new Map(prev);
      next.delete(participantId);
      return next;
    });
  }, []);

  // Handle new producers from socket events
  useEffect(() => {
    if (!socket) return;

    const handleNewProducer = (data: ProducerInfo) => {
      console.log("New producer event:", data);
      consumeProducer(data.producerId, data.participantId);
    };

    const handleExistingProducers = (producers: ProducerInfo[]) => {
      console.log("Existing producers event:", producers);
      producers.forEach((producer) => {
        consumeProducer(producer.producerId, producer.participantId);
      });
    };

    socket.on("new-producer", handleNewProducer);
    socket.on("existing-producers", handleExistingProducers);

    return () => {
      socket.off("new-producer", handleNewProducer);
      socket.off("existing-producers", handleExistingProducers);
    };
  }, [socket, consumeProducer]);

  // Start producing when connected and have local stream
  useEffect(() => {
    if (isConnected && localStream && sendTransportRef.current && !hasStartedProducingRef.current) {
      startProducing();
    }
  }, [isConnected, localStream, startProducing]);

  return {
    isConnected,
    remoteStreams,
    connect,
    disconnect,
    removeParticipantStream,
    produceTrack,
    consumeProducer,
  };
}
