import { X, Mic, MicOff, Video, VideoOff, Monitor } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import type { Participant } from "@shared/schema";

interface ParticipantPanelProps {
  participants: Participant[];
  localParticipant: Participant | null;
  isOpen: boolean;
  onClose: () => void;
}

function ParticipantItem({
  participant,
  isLocal,
}: {
  participant: Participant;
  isLocal: boolean;
}) {
  const initials = participant.name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const bgColors = [
    "bg-blue-600",
    "bg-green-600",
    "bg-purple-600",
    "bg-orange-600",
    "bg-pink-600",
    "bg-teal-600",
  ];
  const bgColor = bgColors[participant.name.charCodeAt(0) % bgColors.length];

  return (
    <div
      className="flex items-center gap-3 p-3 rounded-lg hover-elevate"
      data-testid={`participant-item-${participant.name.replace(/\s+/g, "-").toLowerCase()}`}
    >
      <Avatar className={cn("w-10 h-10", bgColor)}>
        <AvatarFallback className={cn("text-sm font-medium text-white", bgColor)}>
          {initials}
        </AvatarFallback>
      </Avatar>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">
          {participant.name}
          {isLocal && <span className="text-muted-foreground ml-1">(You)</span>}
        </p>
      </div>

      <div className="flex items-center gap-1">
        {participant.isScreenSharing && (
          <div className="p-1.5 rounded-full bg-primary/10 text-primary">
            <Monitor className="w-4 h-4" />
          </div>
        )}
        <div
          className={cn(
            "p-1.5 rounded-full",
            participant.isAudioEnabled
              ? "text-muted-foreground"
              : "bg-red-500/10 text-red-500"
          )}
        >
          {participant.isAudioEnabled ? (
            <Mic className="w-4 h-4" />
          ) : (
            <MicOff className="w-4 h-4" />
          )}
        </div>
        <div
          className={cn(
            "p-1.5 rounded-full",
            participant.isVideoEnabled
              ? "text-muted-foreground"
              : "bg-red-500/10 text-red-500"
          )}
        >
          {participant.isVideoEnabled ? (
            <Video className="w-4 h-4" />
          ) : (
            <VideoOff className="w-4 h-4" />
          )}
        </div>
      </div>
    </div>
  );
}

export function ParticipantPanel({
  participants,
  localParticipant,
  isOpen,
  onClose,
}: ParticipantPanelProps) {
  if (!isOpen) return null;

  const allParticipants = localParticipant
    ? [localParticipant, ...participants.filter((p) => p.id !== localParticipant.id)]
    : participants;

  return (
    <div
      className="fixed top-0 right-0 bottom-20 w-80 bg-card border-l border-border z-40 flex flex-col shadow-xl"
      data-testid="participant-panel"
    >
      <div className="flex items-center justify-between gap-4 p-4 border-b border-border">
        <h2 className="text-lg font-semibold">
          Participants ({allParticipants.length})
        </h2>
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          data-testid="button-close-participants"
        >
          <X className="w-5 h-5" />
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-2">
          {allParticipants.map((participant) => (
            <ParticipantItem
              key={participant.id}
              participant={participant}
              isLocal={participant.id === localParticipant?.id}
            />
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
