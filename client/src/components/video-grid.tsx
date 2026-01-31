import { useMemo } from "react";
import { VideoTile } from "./video-tile";
import { cn } from "@/lib/utils";
import type { Participant } from "@shared/schema";

interface ParticipantWithStream extends Participant {
  stream: MediaStream | null;
  isLocal?: boolean;
}

interface VideoGridProps {
  participants: ParticipantWithStream[];
  localStream: MediaStream | null;
  localParticipant: Participant | null;
  screenShareStream?: MediaStream | null;
  screenShareParticipant?: Participant | null;
}

export function VideoGrid({
  participants,
  localStream,
  localParticipant,
  screenShareStream,
  screenShareParticipant,
}: VideoGridProps) {
  const allParticipants = useMemo(() => {
    const result: ParticipantWithStream[] = [];

    if (localParticipant) {
      result.push({
        ...localParticipant,
        stream: localStream,
        isLocal: true,
      });
    }

    result.push(...participants.filter((p) => p.id !== localParticipant?.id));

    return result;
  }, [participants, localStream, localParticipant]);

  const gridClassName = useMemo(() => {
    const count = allParticipants.length + (screenShareStream ? 1 : 0);

    if (count === 1) return "grid-cols-1";
    if (count === 2) return "grid-cols-1 md:grid-cols-2";
    if (count <= 4) return "grid-cols-2";
    if (count <= 6) return "grid-cols-2 md:grid-cols-3";
    if (count <= 9) return "grid-cols-3";
    return "grid-cols-3 md:grid-cols-4";
  }, [allParticipants.length, screenShareStream]);

  if (allParticipants.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center" data-testid="empty-meeting-state">
        <div className="text-center text-muted-foreground">
          <p className="text-lg font-medium">Waiting for others to join...</p>
          <p className="text-sm mt-2">Share the meeting link to invite participants</p>
        </div>
      </div>
    );
  }

  if (screenShareStream && screenShareParticipant) {
    return (
      <div className="flex-1 flex gap-4 p-4 overflow-hidden" data-testid="screen-share-layout">
        <div className="flex-1 flex items-center justify-center">
          <VideoTile
            stream={screenShareStream}
            name={screenShareParticipant.name}
            isAudioEnabled={screenShareParticipant.isAudioEnabled}
            isVideoEnabled={true}
            isScreenShare={true}
            className="w-full h-full max-h-[calc(100vh-12rem)]"
          />
        </div>

        <div className="w-64 flex flex-col gap-2 overflow-y-auto">
          {allParticipants.map((participant) => (
            <VideoTile
              key={participant.id}
              stream={participant.stream}
              name={participant.name}
              isAudioEnabled={participant.isAudioEnabled}
              isVideoEnabled={participant.isVideoEnabled}
              isSpeaking={participant.isSpeaking}
              isLocal={participant.isLocal}
              className="w-full"
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 p-4 overflow-auto" data-testid="video-grid">
      <div
        className={cn(
          "grid gap-4 h-full auto-rows-fr",
          gridClassName
        )}
      >
        {allParticipants.map((participant) => (
          <VideoTile
            key={participant.id}
            stream={participant.stream}
            name={participant.name}
            isAudioEnabled={participant.isAudioEnabled}
            isVideoEnabled={participant.isVideoEnabled}
            isSpeaking={participant.isSpeaking}
            isLocal={participant.isLocal}
          />
        ))}
      </div>
    </div>
  );
}
