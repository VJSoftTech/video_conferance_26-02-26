import * as mediasoup from "mediasoup";
import type {
  Worker,
  Router,
  WebRtcTransport,
  Producer,
  Consumer,
  RtpCapabilities,
} from "mediasoup/node/lib/types";
import { mediasoupConfig } from "./mediasoup-config";
import { log } from "./index";

interface RoomData {
  router: Router;
  transports: Map<string, WebRtcTransport>;
  producers: Map<string, Producer>;
  consumers: Map<string, Consumer>;
  participantTransports: Map<string, { send?: string; recv?: string }>;
  participantProducers: Map<string, string[]>;
}

class MediasoupManager {
  private workers: Worker[] = [];
  private currentWorkerIndex = 0;
  private rooms: Map<string, RoomData> = new Map();

  async initialize(): Promise<void> {
    const numWorkers = 1; // Single worker for simplicity, can scale

    for (let i = 0; i < numWorkers; i++) {
      const worker = await mediasoup.createWorker({
        logLevel: mediasoupConfig.worker.logLevel,
        logTags: mediasoupConfig.worker.logTags,
        rtcMinPort: mediasoupConfig.worker.rtcMinPort,
        rtcMaxPort: mediasoupConfig.worker.rtcMaxPort,
      });

      worker.on("died", (error) => {
        log(`mediasoup Worker died: ${error}`, "mediasoup");
        setTimeout(() => process.exit(1), 2000);
      });

      this.workers.push(worker);
      log(`mediasoup Worker ${i + 1} created`, "mediasoup");
    }
  }

  private getNextWorker(): Worker {
    const worker = this.workers[this.currentWorkerIndex];
    this.currentWorkerIndex = (this.currentWorkerIndex + 1) % this.workers.length;
    return worker;
  }

  async getOrCreateRoom(roomId: string): Promise<RoomData> {
    let roomData = this.rooms.get(roomId);

    if (!roomData) {
      const worker = this.getNextWorker();
      const router = await worker.createRouter({
        mediaCodecs: mediasoupConfig.router.mediaCodecs,
      });

      roomData = {
        router,
        transports: new Map(),
        producers: new Map(),
        consumers: new Map(),
        participantTransports: new Map(),
        participantProducers: new Map(),
      };

      this.rooms.set(roomId, roomData);
      log(`Router created for room ${roomId}`, "mediasoup");
    }

    return roomData;
  }

  getRouterRtpCapabilities(roomId: string): RtpCapabilities | null {
    const roomData = this.rooms.get(roomId);
    return roomData?.router.rtpCapabilities || null;
  }

  async createWebRtcTransport(
    roomId: string,
    participantId: string,
    type: "send" | "recv"
  ): Promise<{
    id: string;
    iceParameters: any;
    iceCandidates: any;
    dtlsParameters: any;
  } | null> {
    const roomData = this.rooms.get(roomId);
    if (!roomData) return null;

    const transport = await roomData.router.createWebRtcTransport({
      ...mediasoupConfig.webRtcTransport,
      enableUdp: true,
      enableTcp: true,
      preferUdp: true,
    });

    roomData.transports.set(transport.id, transport);

    // Track participant's transports
    const participantTransports = roomData.participantTransports.get(participantId) || {};
    participantTransports[type] = transport.id;
    roomData.participantTransports.set(participantId, participantTransports);

    transport.on("dtlsstatechange", (dtlsState) => {
      if (dtlsState === "closed") {
        transport.close();
        roomData.transports.delete(transport.id);
      }
    });

    transport.on("@close", () => {
      roomData.transports.delete(transport.id);
    });

    log(`Transport ${type} created for participant ${participantId} in room ${roomId}`, "mediasoup");

    return {
      id: transport.id,
      iceParameters: transport.iceParameters,
      iceCandidates: transport.iceCandidates,
      dtlsParameters: transport.dtlsParameters,
    };
  }

  async connectTransport(
    roomId: string,
    transportId: string,
    dtlsParameters: any
  ): Promise<boolean> {
    const roomData = this.rooms.get(roomId);
    if (!roomData) return false;

    const transport = roomData.transports.get(transportId);
    if (!transport) return false;

    await transport.connect({ dtlsParameters });
    log(`Transport ${transportId} connected`, "mediasoup");
    return true;
  }

  async produce(
    roomId: string,
    participantId: string,
    transportId: string,
    kind: "audio" | "video",
    rtpParameters: any
  ): Promise<string | null> {
    const roomData = this.rooms.get(roomId);
    if (!roomData) return null;

    const transport = roomData.transports.get(transportId);
    if (!transport) return null;

    const producer = await transport.produce({ kind, rtpParameters });
    roomData.producers.set(producer.id, producer);

    // Track participant's producers
    const participantProducers = roomData.participantProducers.get(participantId) || [];
    participantProducers.push(producer.id);
    roomData.participantProducers.set(participantId, participantProducers);

    producer.on("transportclose", () => {
      roomData.producers.delete(producer.id);
    });

    log(`Producer ${producer.id} (${kind}) created for participant ${participantId}`, "mediasoup");

    return producer.id;
  }

  async consume(
    roomId: string,
    participantId: string,
    producerId: string,
    rtpCapabilities: RtpCapabilities
  ): Promise<{
    id: string;
    producerId: string;
    kind: "audio" | "video";
    rtpParameters: any;
  } | null> {
    const roomData = this.rooms.get(roomId);
    if (!roomData) return null;

    const producer = roomData.producers.get(producerId);
    if (!producer) return null;

    if (!roomData.router.canConsume({ producerId, rtpCapabilities })) {
      log(`Cannot consume producer ${producerId}`, "mediasoup");
      return null;
    }

    const participantTransports = roomData.participantTransports.get(participantId);
    if (!participantTransports?.recv) {
      log(`No recv transport for participant ${participantId}`, "mediasoup");
      return null;
    }

    const transport = roomData.transports.get(participantTransports.recv);
    if (!transport) return null;

    const consumer = await transport.consume({
      producerId,
      rtpCapabilities,
      paused: true, // Start paused, resume after client is ready
    });

    roomData.consumers.set(consumer.id, consumer);

    consumer.on("transportclose", () => {
      roomData.consumers.delete(consumer.id);
    });

    consumer.on("producerclose", () => {
      roomData.consumers.delete(consumer.id);
    });

    log(`Consumer ${consumer.id} created for producer ${producerId}`, "mediasoup");

    return {
      id: consumer.id,
      producerId,
      kind: consumer.kind,
      rtpParameters: consumer.rtpParameters,
    };
  }

  async resumeConsumer(roomId: string, consumerId: string): Promise<boolean> {
    const roomData = this.rooms.get(roomId);
    if (!roomData) return false;

    const consumer = roomData.consumers.get(consumerId);
    if (!consumer) return false;

    await consumer.resume();
    return true;
  }

  closeProducer(roomId: string, producerId: string): void {
    const roomData = this.rooms.get(roomId);
    if (!roomData) return;

    const producer = roomData.producers.get(producerId);
    if (producer) {
      producer.close();
      roomData.producers.delete(producerId);
      log(`Producer ${producerId} closed`, "mediasoup");
    }
  }

  getProducersForRoom(roomId: string, excludeParticipantId?: string): { producerId: string; participantId: string; kind: string }[] {
    const roomData = this.rooms.get(roomId);
    if (!roomData) return [];

    const producers: { producerId: string; participantId: string; kind: string }[] = [];

    roomData.participantProducers.forEach((producerIds, participantId) => {
      if (participantId === excludeParticipantId) return;

      producerIds.forEach((producerId) => {
        const producer = roomData.producers.get(producerId);
        if (producer) {
          producers.push({
            producerId,
            participantId,
            kind: producer.kind,
          });
        }
      });
    });

    return producers;
  }

  cleanupParticipant(roomId: string, participantId: string): void {
    const roomData = this.rooms.get(roomId);
    if (!roomData) return;

    // Close producers
    const producerIds = roomData.participantProducers.get(participantId) || [];
    producerIds.forEach((producerId) => {
      const producer = roomData.producers.get(producerId);
      if (producer) {
        producer.close();
        roomData.producers.delete(producerId);
      }
    });
    roomData.participantProducers.delete(participantId);

    // Close transports
    const transports = roomData.participantTransports.get(participantId);
    if (transports) {
      if (transports.send) {
        const transport = roomData.transports.get(transports.send);
        if (transport) {
          transport.close();
          roomData.transports.delete(transports.send);
        }
      }
      if (transports.recv) {
        const transport = roomData.transports.get(transports.recv);
        if (transport) {
          transport.close();
          roomData.transports.delete(transports.recv);
        }
      }
    }
    roomData.participantTransports.delete(participantId);

    log(`Cleaned up mediasoup resources for participant ${participantId}`, "mediasoup");

    // If no more participants, clean up the room
    if (roomData.participantTransports.size === 0) {
      roomData.router.close();
      this.rooms.delete(roomId);
      log(`Room ${roomId} cleaned up`, "mediasoup");
    }
  }
}

export const mediasoupManager = new MediasoupManager();
