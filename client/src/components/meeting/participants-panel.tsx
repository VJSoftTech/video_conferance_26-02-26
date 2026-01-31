import { useState, useMemo } from "react";
import { Participant, ConnectionQuality } from "livekit-client";
import { 
  X, 
  Mic, 
  MicOff, 
  Video, 
  VideoOff, 
  Search,
  Copy,
  WifiOff,
  Signal,
  SignalLow,
  SignalMedium,
  SignalHigh,
  ScreenShare,
  Hand,
  MoreVertical,
  UserPlus,
  Volume2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface Reaction {
  id: string;
  emoji: string;
  participantName: string;
  timestamp: number;
}

interface ParticipantsPanelProps {
  participants: Participant[];
  localParticipantId?: string;
  isOpen: boolean;
  onClose: () => void;
  roomId?: string;
  isHost?: boolean;
  onMuteParticipant?: (participantIdentity: string, trackType: 'audio' | 'video', muted: boolean) => void;
  raisedHands?: Map<string, { participantName: string; timestamp: number }>;
  reactions?: Reaction[];
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

function getAvatarColor(name: string): string {
  const colors = [
    "from-blue-500 to-blue-600",
    "from-green-500 to-green-600", 
    "from-purple-500 to-purple-600",
    "from-orange-500 to-orange-600",
    "from-pink-500 to-pink-600",
    "from-teal-500 to-teal-600",
    "from-indigo-500 to-indigo-600",
    "from-rose-500 to-rose-600",
    "from-cyan-500 to-cyan-600",
    "from-amber-500 to-amber-600",
  ];
  const index = name.charCodeAt(0) % colors.length;
  return colors[index];
}

function ConnectionQualityIndicator({ quality }: { quality: ConnectionQuality }) {
  const getQualityInfo = () => {
    switch (quality) {
      case ConnectionQuality.Excellent:
        return { icon: SignalHigh, color: "text-green-500", label: "Excellent" };
      case ConnectionQuality.Good:
        return { icon: SignalMedium, color: "text-green-400", label: "Good" };
      case ConnectionQuality.Poor:
        return { icon: SignalLow, color: "text-yellow-500", label: "Poor" };
      case ConnectionQuality.Lost:
        return { icon: WifiOff, color: "text-red-500", label: "Disconnected" };
      default:
        return { icon: Signal, color: "text-muted-foreground", label: "Unknown" };
    }
  };

  const { icon: Icon, color, label } = getQualityInfo();

  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center">
            <Icon className={cn("w-3.5 h-3.5", color)} />
          </div>
        </TooltipTrigger>
        <TooltipContent side="top" className="text-xs">
          {label}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function ParticipantRow({
  participant,
  isLocal,
  isHostViewer,
  onMuteParticipant,
  isHandRaised,
  currentReaction,
}: {
  participant: Participant;
  isLocal: boolean;
  isHostViewer?: boolean;
  onMuteParticipant?: (participantIdentity: string, trackType: 'audio' | 'video', muted: boolean) => void;
  isHandRaised?: boolean;
  currentReaction?: string;
}) {
  const displayName = participant.name || participant.identity || "Unknown";
  const initials = getInitials(displayName);
  const avatarColor = getAvatarColor(displayName);
  
  const isMicOn = participant.isMicrophoneEnabled;
  const isCameraOn = participant.isCameraEnabled;
  const isScreenSharing = participant.isScreenShareEnabled;
  const isSpeaking = participant.isSpeaking;
  const connectionQuality = participant.connectionQuality;

  const canControl = isHostViewer && !isLocal && onMuteParticipant;

  return (
    <div
      className={cn(
        "flex items-center gap-3 p-3 rounded-xl transition-all duration-200",
        "hover:bg-accent/50 group",
        isSpeaking && "bg-primary/10 ring-2 ring-primary/30"
      )}
      data-testid={`participant-item-${participant.identity}`}
    >
      <div className="relative">
        <div
          className={cn(
            "w-11 h-11 rounded-full flex items-center justify-center text-white text-sm font-semibold shrink-0 bg-gradient-to-br shadow-md",
            avatarColor,
            isSpeaking && "ring-2 ring-primary ring-offset-2 ring-offset-background"
          )}
        >
          {initials}
        </div>
        {isSpeaking && (
          <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-primary flex items-center justify-center shadow-sm">
            <Volume2 className="w-2.5 h-2.5 text-primary-foreground animate-pulse" />
          </div>
        )}
        {isScreenSharing && !isSpeaking && (
          <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-blue-500 flex items-center justify-center shadow-sm">
            <ScreenShare className="w-2.5 h-2.5 text-white" />
          </div>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="font-medium text-sm truncate">
            {displayName}
          </p>
          {isLocal && (
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 shrink-0">
              You
            </Badge>
          )}
          {isHandRaised && (
            <div className="w-5 h-5 rounded-full bg-amber-500/20 flex items-center justify-center shrink-0">
              <Hand className="w-3 h-3 text-amber-500" />
            </div>
          )}
          {currentReaction && (
            <div className="w-6 h-6 rounded-full bg-black/20 flex items-center justify-center shrink-0 animate-bounce-in">
              <span className="text-sm">{currentReaction}</span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-1.5 mt-0.5">
          <ConnectionQualityIndicator quality={connectionQuality} />
          {isScreenSharing && (
            <span className="text-[10px] text-blue-500 font-medium">Presenting</span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-1.5 shrink-0">
        <div 
          className={cn(
            "w-7 h-7 rounded-full flex items-center justify-center transition-colors",
            isMicOn ? "bg-muted" : "bg-red-500/20"
          )}
        >
          {isMicOn ? (
            <Mic className="w-3.5 h-3.5 text-muted-foreground" />
          ) : (
            <MicOff className="w-3.5 h-3.5 text-red-500" />
          )}
        </div>
        <div 
          className={cn(
            "w-7 h-7 rounded-full flex items-center justify-center transition-colors",
            isCameraOn ? "bg-muted" : "bg-muted"
          )}
        >
          {isCameraOn ? (
            <Video className="w-3.5 h-3.5 text-muted-foreground" />
          ) : (
            <VideoOff className="w-3.5 h-3.5 text-muted-foreground" />
          )}
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button 
              variant="ghost" 
              size="icon" 
              className="w-7 h-7 opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <MoreVertical className="w-3.5 h-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            {canControl && isMicOn && (
              <DropdownMenuItem 
                onClick={() => onMuteParticipant(participant.identity, 'audio', true)}
                className="text-destructive focus:text-destructive"
              >
                <MicOff className="w-4 h-4 mr-2" />
                Force Mute
              </DropdownMenuItem>
            )}
            {canControl && isCameraOn && (
              <DropdownMenuItem 
                onClick={() => onMuteParticipant(participant.identity, 'video', true)}
                className="text-destructive focus:text-destructive"
              >
                <VideoOff className="w-4 h-4 mr-2" />
                Disable Camera
              </DropdownMenuItem>
            )}
            {!canControl && (
              <>
                <DropdownMenuItem disabled>
                  <Mic className="w-4 h-4 mr-2" />
                  Request unmute
                </DropdownMenuItem>
                <DropdownMenuItem disabled>
                  <Hand className="w-4 h-4 mr-2" />
                  Lower hand
                </DropdownMenuItem>
              </>
            )}
            {canControl && !isMicOn && !isCameraOn && (
              <DropdownMenuItem disabled>
                <span className="text-muted-foreground text-sm">No actions available</span>
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

export function ParticipantsPanel({
  participants,
  localParticipantId,
  isOpen,
  onClose,
  roomId,
  isHost,
  onMuteParticipant,
  raisedHands = new Map(),
  reactions = [],
}: ParticipantsPanelProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const { toast } = useToast();

  const filteredParticipants = useMemo(() => {
    if (!searchQuery.trim()) return participants;
    
    const query = searchQuery.toLowerCase();
    return participants.filter((p) => {
      const name = (p.name || p.identity || "").toLowerCase();
      return name.includes(query);
    });
  }, [participants, searchQuery]);

  const sortedParticipants = useMemo(() => {
    return [...filteredParticipants].sort((a, b) => {
      const aIsLocal = a.identity === localParticipantId;
      const bIsLocal = b.identity === localParticipantId;
      if (aIsLocal && !bIsLocal) return -1;
      if (!aIsLocal && bIsLocal) return 1;
      
      const aHasHandRaised = raisedHands.has(a.identity);
      const bHasHandRaised = raisedHands.has(b.identity);
      if (aHasHandRaised && !bHasHandRaised) return -1;
      if (!aHasHandRaised && bHasHandRaised) return 1;
      
      const aName = a.name || a.identity || "";
      const bName = b.name || b.identity || "";
      return aName.localeCompare(bName);
    });
  }, [filteredParticipants, localParticipantId, raisedHands]);

  const handleCopyInvite = async () => {
    const meetingUrl = `${window.location.origin}/room/${roomId || "meeting"}/join`;
    try {
      await navigator.clipboard.writeText(meetingUrl);
      toast({
        title: "Link Copied",
        description: "Meeting invite link copied to clipboard",
        duration: 1300,
      });
    } catch (err) {
      toast({
        title: "Copy Failed",
        description: "Unable to copy link",
        variant: "destructive",
      });
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <div 
        className="fixed inset-0 bg-black/20 backdrop-blur-sm z-30 lg:hidden"
        onClick={onClose}
      />
      
      <div 
        className={cn(
          "fixed right-0 top-0 h-[calc(100%-5rem)] w-80 max-w-[85vw] z-40",
          "bg-background/95 backdrop-blur-xl border-l shadow-2xl",
          "flex flex-col animate-in slide-in-from-right duration-300"
        )}
        data-testid="participants-panel"
      >
        <div className="p-4 border-b bg-gradient-to-r from-background to-muted/30">
          <div className="flex items-center justify-between gap-2 mb-4">
            <div>
              <h2 className="font-semibold text-lg">Participants</h2>
              <p className="text-xs text-muted-foreground">
                {participants.length} {participants.length === 1 ? "person" : "people"} in this meeting
              </p>
            </div>
            <Button 
              size="icon" 
              variant="ghost" 
              onClick={onClose}
              className="rounded-full hover:bg-destructive/10 hover:text-destructive"
              data-testid="button-close-participants"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search participants..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-9 bg-muted/50 border-0 focus-visible:ring-1"
            />
          </div>
        </div>

        <div className="flex items-center gap-2 p-3 border-b bg-muted/20">
          <Button 
            variant="outline" 
            size="sm" 
            className="flex-1 h-8 text-xs"
            onClick={handleCopyInvite}
          >
            <Copy className="w-3.5 h-3.5 mr-1.5" />
            Copy Invite
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            className="flex-1 h-8 text-xs"
            disabled
          >
            <UserPlus className="w-3.5 h-3.5 mr-1.5" />
            Invite
          </Button>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-2">
            {sortedParticipants.length > 0 && (
              <div>
                <div className="flex items-center gap-2 px-3 py-2">
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    In Meeting ({sortedParticipants.length})
                  </span>
                </div>
                <div className="space-y-1">
                  {sortedParticipants.map((participant) => {
                    const participantName = participant.name || participant.identity;
                    const currentReaction = reactions.find(
                      r => r.participantName === participantName
                    )?.emoji;
                    return (
                      <ParticipantRow
                        key={participant.identity}
                        participant={participant}
                        isLocal={participant.identity === localParticipantId}
                        isHostViewer={isHost}
                        onMuteParticipant={onMuteParticipant}
                        isHandRaised={raisedHands.has(participant.identity)}
                        currentReaction={currentReaction}
                      />
                    );
                  })}
                </div>
              </div>
            )}

            {filteredParticipants.length === 0 && searchQuery && (
              <div className="text-center py-8 px-4">
                <Search className="w-10 h-10 text-muted-foreground/50 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">
                  No participants found matching "{searchQuery}"
                </p>
              </div>
            )}

            {participants.length === 0 && !searchQuery && (
              <div className="text-center py-8 px-4">
                <UserPlus className="w-10 h-10 text-muted-foreground/50 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground mb-1">
                  No participants yet
                </p>
                <p className="text-xs text-muted-foreground">
                  Share the meeting link to invite others
                </p>
              </div>
            )}
          </div>
        </ScrollArea>

        <div className="p-3 border-t bg-muted/20">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <span>Meeting in progress</span>
            </div>
            <span>{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
          </div>
        </div>
      </div>
    </>
  );
}
