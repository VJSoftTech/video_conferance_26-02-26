import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  Monitor,
  MonitorOff,
  Users,
  MessageSquare,
  MoreVertical,
  PhoneOff,
  Copy,
  Check,
} from "lucide-react";
import { useState } from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

interface ControlBarProps {
  isAudioEnabled: boolean;
  isVideoEnabled: boolean;
  isScreenSharing: boolean;
  participantCount: number;
  meetingLink: string;
  onToggleAudio: () => void;
  onToggleVideo: () => void;
  onToggleScreenShare: () => void;
  onToggleParticipants: () => void;
  onToggleChat?: () => void;
  onLeave: () => void;
}

function ControlButton({
  icon: Icon,
  label,
  isActive = true,
  isDestructive = false,
  onClick,
  badge,
  testId,
  className,
}: {
  icon: typeof Mic;
  label: string;
  isActive?: boolean;
  isDestructive?: boolean;
  onClick: () => void;
  badge?: number;
  testId: string;
  className?: string;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          onClick={onClick}
          className={cn(
            "relative flex flex-col items-center gap-1 p-2 sm:p-3 rounded-xl transition-colors min-w-[3.5rem] sm:min-w-[4rem]",
            isDestructive
              ? "bg-destructive text-destructive-foreground hover-elevate active-elevate-2"
              : isActive
              ? "bg-muted text-foreground hover-elevate active-elevate-2"
              : "bg-red-500/20 text-red-500 hover-elevate active-elevate-2",
            className
          )}
          data-testid={testId}
        >
          <Icon className="w-5 h-5 sm:w-6 sm:h-6" />
          <span className="text-[10px] sm:text-xs font-medium">{label}</span>
          {badge !== undefined && badge > 0 && (
            <span className="absolute -top-1 -right-1 w-4 h-4 sm:w-5 sm:h-5 rounded-full bg-primary text-primary-foreground text-[10px] sm:text-xs flex items-center justify-center">
              {badge > 99 ? "99+" : badge}
            </span>
          )}
        </button>
      </TooltipTrigger>
      <TooltipContent>
        <p>{label}</p>
      </TooltipContent>
    </Tooltip>
  );
}

export function ControlBar({
  isAudioEnabled,
  isVideoEnabled,
  isScreenSharing,
  participantCount,
  meetingLink,
  onToggleAudio,
  onToggleVideo,
  onToggleScreenShare,
  onToggleParticipants,
  onToggleChat,
  onLeave,
}: ControlBarProps) {
  const [copied, setCopied] = useState(false);

  const copyMeetingLink = async () => {
    try {
      await navigator.clipboard.writeText(meetingLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50" data-testid="control-bar">
      <div className="bg-card/95 backdrop-blur-lg border-t border-border">
        <div className="max-w-4xl mx-auto px-2 sm:px-4 py-2 sm:py-3">
          <div className="flex items-center justify-between gap-1 sm:gap-4">
            <div className="flex items-center gap-1 sm:gap-2">
              <ControlButton
                icon={isAudioEnabled ? Mic : MicOff}
                label={isAudioEnabled ? "Mute" : "Unmute"}
                isActive={isAudioEnabled}
                onClick={onToggleAudio}
                testId="button-toggle-audio"
              />
              <ControlButton
                icon={isVideoEnabled ? Video : VideoOff}
                label={isVideoEnabled ? "Stop Video" : "Start Video"}
                isActive={isVideoEnabled}
                onClick={onToggleVideo}
                testId="button-toggle-video"
              />
            </div>

            <div className="flex items-center gap-1 sm:gap-2">
              <ControlButton
                icon={isScreenSharing ? MonitorOff : Monitor}
                label={isScreenSharing ? "Stop Share" : "Share Screen"}
                isActive={!isScreenSharing}
                onClick={onToggleScreenShare}
                testId="button-toggle-screen-share"
                className="hidden sm:flex"
              />
              <ControlButton
                icon={Users}
                label="Participants"
                onClick={onToggleParticipants}
                badge={participantCount}
                testId="button-toggle-participants"
              />
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    className="flex flex-col items-center gap-1 p-2 sm:p-3 rounded-xl bg-muted hover-elevate active-elevate-2 min-w-[3.5rem] sm:min-w-[4rem]"
                    data-testid="button-more-options"
                  >
                    <MoreVertical className="w-5 h-5 sm:w-6 sm:h-6" />
                    <span className="text-[10px] sm:text-xs font-medium">More</span>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="center" className="w-48">
                  <DropdownMenuItem 
                    onClick={onToggleScreenShare} 
                    className="sm:hidden"
                    data-testid="button-screen-share-mobile"
                  >
                    {isScreenSharing ? (
                      <MonitorOff className="w-4 h-4 mr-2" />
                    ) : (
                      <Monitor className="w-4 h-4 mr-2" />
                    )}
                    {isScreenSharing ? "Stop Share" : "Share Screen"}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator className="sm:hidden" />
                  <DropdownMenuItem onClick={copyMeetingLink} data-testid="button-copy-link">
                    {copied ? (
                      <Check className="w-4 h-4 mr-2 text-green-500" />
                    ) : (
                      <Copy className="w-4 h-4 mr-2" />
                    )}
                    {copied ? "Copied!" : "Copy meeting link"}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            <div className="flex items-center">
              <ControlButton
                icon={PhoneOff}
                label="Leave"
                isDestructive
                onClick={onLeave}
                testId="button-leave-meeting"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
