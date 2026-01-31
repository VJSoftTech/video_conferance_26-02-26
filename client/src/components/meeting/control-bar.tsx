import { Button } from "@/components/ui/button";
import { 
  Mic, 
  MicOff, 
  Video, 
  VideoOff, 
  MonitorUp, 
  PhoneOff, 
  Users,
  MoreVertical,
  Crown,
  MonitorOff,
  PenTool,
  Hand,
  Smile,
  MessageCircle,
  Circle,
  Square,
  Pause,
  Play,
} from "lucide-react";
import type { RecordingState } from "@/hooks/use-recording";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useToast } from "@/hooks/use-toast";
import { useMemo, useState } from "react";

const EMOJI_REACTIONS = [
  { emoji: "👍", label: "Thumbs Up" },
  { emoji: "👏", label: "Clap" },
  { emoji: "❤️", label: "Heart" },
  { emoji: "😂", label: "Laugh" },
  { emoji: "😮", label: "Wow" },
  { emoji: "🎉", label: "Party" },
];

interface ControlBarProps {
  isAudioEnabled: boolean;
  isVideoEnabled: boolean;
  isScreenSharing: boolean;
  isParticipantsPanelOpen: boolean;
  isChatPanelOpen?: boolean;
  isWhiteboardOpen?: boolean;
  isHandRaised?: boolean;
  participantCount: number;
  unreadMessageCount?: number;
  isHost?: boolean;
  recordingState?: RecordingState;
  recordingDuration?: string;
  onToggleAudio: () => void;
  onToggleVideo: () => void;
  onToggleScreenShare: () => void;
  onToggleParticipants: () => void;
  onToggleChat?: () => void;
  onToggleWhiteboard?: () => void;
  onToggleHostControls?: () => void;
  onToggleHandRaise?: () => void;
  onSendReaction?: (emoji: string) => void;
  onStartRecording?: () => void;
  onPauseRecording?: () => void;
  onResumeRecording?: () => void;
  onStopRecording?: () => void;
  onLeave: () => void;
}

export function ControlBar({
  isAudioEnabled,
  isVideoEnabled,
  isScreenSharing,
  isParticipantsPanelOpen,
  isChatPanelOpen = false,
  isWhiteboardOpen = false,
  isHandRaised = false,
  participantCount,
  unreadMessageCount = 0,
  isHost = false,
  recordingState = "idle",
  recordingDuration = "0:00",
  onToggleAudio,
  onToggleVideo,
  onToggleScreenShare,
  onToggleParticipants,
  onToggleChat,
  onToggleWhiteboard,
  onToggleHostControls,
  onToggleHandRaise,
  onSendReaction,
  onStartRecording,
  onPauseRecording,
  onResumeRecording,
  onStopRecording,
  onLeave,
}: ControlBarProps) {
  const { toast } = useToast();
  const [isReactionPopoverOpen, setIsReactionPopoverOpen] = useState(false);
  
  const isScreenShareSupported = useMemo(() => {
    return typeof navigator !== 'undefined' && 
           navigator.mediaDevices && 
           typeof navigator.mediaDevices.getDisplayMedia === 'function';
  }, []);

  const handleScreenShareClick = () => {
    if (!isScreenShareSupported) {
      toast({
        title: "Screen sharing not available",
        description: "Screen sharing is not supported on mobile devices. Please use a desktop browser.",
        variant: "destructive",
      });
      return;
    }
    onToggleScreenShare();
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-card border-t">
      <div className="flex items-center justify-center gap-2 sm:gap-3 p-3 sm:p-4">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="icon"
                variant={isAudioEnabled ? "secondary" : "destructive"}
                onClick={onToggleAudio}
                className="rounded-full w-11 h-11 sm:w-12 sm:h-12"
                data-testid="button-toggle-audio"
              >
                {isAudioEnabled ? (
                  <Mic className="w-5 h-5" />
                ) : (
                  <MicOff className="w-5 h-5" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top" className="bg-zinc-900 text-white border-zinc-700 px-3 py-1.5 text-sm font-medium shadow-lg">
              {isAudioEnabled ? "Mute" : "Unmute"}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="icon"
                variant={isVideoEnabled ? "secondary" : "destructive"}
                onClick={onToggleVideo}
                className="rounded-full w-11 h-11 sm:w-12 sm:h-12"
                data-testid="button-toggle-video"
              >
                {isVideoEnabled ? (
                  <Video className="w-5 h-5" />
                ) : (
                  <VideoOff className="w-5 h-5" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top" className="bg-zinc-900 text-white border-zinc-700 px-3 py-1.5 text-sm font-medium shadow-lg">
              {isVideoEnabled ? "Stop Video" : "Start Video"}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="icon"
                variant={isScreenSharing ? "default" : "secondary"}
                onClick={handleScreenShareClick}
                className="rounded-full w-11 h-11 sm:w-12 sm:h-12 hidden sm:flex"
                data-testid="button-toggle-screenshare"
              >
                <MonitorUp className="w-5 h-5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top" className="bg-zinc-900 text-white border-zinc-700 px-3 py-1.5 text-sm font-medium shadow-lg">
              {isScreenSharing ? "Stop Sharing" : "Share Screen"}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="icon"
                variant={isParticipantsPanelOpen ? "default" : "secondary"}
                onClick={onToggleParticipants}
                className="rounded-full w-11 h-11 sm:w-12 sm:h-12 relative"
                data-testid="button-toggle-participants"
              >
                <Users className="w-5 h-5" />
                {participantCount > 1 && (
                  <span className="absolute -top-1 -right-1 bg-primary text-primary-foreground text-xs w-5 h-5 rounded-full flex items-center justify-center">
                    {participantCount}
                  </span>
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top" className="bg-zinc-900 text-white border-zinc-700 px-3 py-1.5 text-sm font-medium shadow-lg">Participants</TooltipContent>
          </Tooltip>
        </TooltipProvider>

        {onToggleChat && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="icon"
                  variant={isChatPanelOpen ? "default" : "secondary"}
                  onClick={onToggleChat}
                  className="rounded-full w-11 h-11 sm:w-12 sm:h-12 relative"
                  data-testid="button-toggle-chat"
                >
                  <MessageCircle className="w-5 h-5" />
                  {unreadMessageCount > 0 && !isChatPanelOpen && (
                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center">
                      {unreadMessageCount > 9 ? "9+" : unreadMessageCount}
                    </span>
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top" className="bg-zinc-900 text-white border-zinc-700 px-3 py-1.5 text-sm font-medium shadow-lg">Chat</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}

        {onToggleHandRaise && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="icon"
                  variant={isHandRaised ? "default" : "secondary"}
                  onClick={onToggleHandRaise}
                  className={cn(
                    "rounded-full w-11 h-11 sm:w-12 sm:h-12",
                    isHandRaised && "bg-yellow-500 hover:bg-yellow-600 text-white"
                  )}
                  data-testid="button-toggle-hand-raise"
                >
                  <Hand className="w-5 h-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top" className="bg-zinc-900 text-white border-zinc-700 px-3 py-1.5 text-sm font-medium shadow-lg">
                {isHandRaised ? "Lower Hand" : "Raise Hand"}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}

        {onSendReaction && (
          <Popover open={isReactionPopoverOpen} onOpenChange={setIsReactionPopoverOpen}>
            <TooltipProvider>
              <Tooltip>
                <PopoverTrigger asChild>
                  <TooltipTrigger asChild>
                    <Button
                      size="icon"
                      variant="secondary"
                      className="rounded-full w-11 h-11 sm:w-12 sm:h-12 hidden sm:flex"
                      data-testid="button-reactions"
                    >
                      <Smile className="w-5 h-5" />
                    </Button>
                  </TooltipTrigger>
                </PopoverTrigger>
                <TooltipContent side="top" className="bg-zinc-900 text-white border-zinc-700 px-3 py-1.5 text-sm font-medium shadow-lg">
                  Reactions
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <PopoverContent side="top" className="w-auto p-2" sideOffset={16}>
              <div className="flex gap-1">
                {EMOJI_REACTIONS.map(({ emoji, label }) => (
                  <button
                    key={emoji}
                    onClick={() => {
                      onSendReaction(emoji);
                      setIsReactionPopoverOpen(false);
                    }}
                    className="text-2xl p-2 hover:bg-muted rounded-lg transition-colors"
                    title={label}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </PopoverContent>
          </Popover>
        )}

        {onToggleWhiteboard && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="icon"
                  variant={isWhiteboardOpen ? "default" : "secondary"}
                  onClick={onToggleWhiteboard}
                  className="rounded-full w-11 h-11 sm:w-12 sm:h-12 hidden sm:flex"
                  data-testid="button-toggle-whiteboard"
                >
                  <PenTool className="w-5 h-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top" className="bg-zinc-900 text-white border-zinc-700 px-3 py-1.5 text-sm font-medium shadow-lg">Whiteboard</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}

        {isHost && onStartRecording && (
          <div className="hidden sm:flex items-center gap-1">
            {recordingState === "idle" ? (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      size="icon"
                      variant="secondary"
                      onClick={onStartRecording}
                      className="rounded-full w-11 h-11 sm:w-12 sm:h-12"
                      data-testid="button-start-recording"
                    >
                      <Circle className="w-5 h-5 text-red-500 fill-red-500" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="bg-zinc-900 text-white border-zinc-700 px-3 py-1.5 text-sm font-medium shadow-lg">Start Recording</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            ) : (
              <div className="flex items-center gap-1 bg-red-500/10 border border-red-500/30 rounded-full px-2 py-1">
                <span className={cn(
                  "w-2 h-2 rounded-full",
                  recordingState === "recording" ? "bg-red-500 animate-pulse" : "bg-yellow-500"
                )} />
                <span className="text-xs font-mono text-red-500 min-w-[40px]">{recordingDuration}</span>
                
                {recordingState === "recording" && onPauseRecording && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={onPauseRecording}
                          className="w-8 h-8 rounded-full hover:bg-red-500/20"
                          data-testid="button-pause-recording"
                        >
                          <Pause className="w-4 h-4 text-red-500" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="bg-zinc-900 text-white border-zinc-700 px-3 py-1.5 text-sm font-medium shadow-lg">Pause Recording</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
                
                {recordingState === "paused" && onResumeRecording && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={onResumeRecording}
                          className="w-8 h-8 rounded-full hover:bg-red-500/20"
                          data-testid="button-resume-recording"
                        >
                          <Play className="w-4 h-4 text-red-500" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="bg-zinc-900 text-white border-zinc-700 px-3 py-1.5 text-sm font-medium shadow-lg">Resume Recording</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
                
                {onStopRecording && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={onStopRecording}
                          className="w-8 h-8 rounded-full hover:bg-red-500/20"
                          data-testid="button-stop-recording"
                        >
                          <Square className="w-4 h-4 text-red-500 fill-red-500" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="bg-zinc-900 text-white border-zinc-700 px-3 py-1.5 text-sm font-medium shadow-lg">Stop Recording</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
              </div>
            )}
          </div>
        )}

        {isHost && onToggleHostControls && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="icon"
                  variant="secondary"
                  onClick={onToggleHostControls}
                  className="rounded-full w-11 h-11 sm:w-12 sm:h-12 relative bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30"
                  data-testid="button-host-controls"
                >
                  <Crown className="w-5 h-5 text-amber-500" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top" className="bg-zinc-900 text-white border-zinc-700 px-3 py-1.5 text-sm font-medium shadow-lg">Host Controls</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}

        <div className="sm:hidden">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                size="icon"
                variant="secondary"
                className="rounded-full w-11 h-11"
                data-testid="button-more-options"
              >
                <MoreVertical className="w-5 h-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="center" side="top" sideOffset={16} className="mb-2">
              {onSendReaction && (
                <>
                  <div className="flex justify-center gap-1 px-2 py-1">
                    {EMOJI_REACTIONS.map(({ emoji, label }) => (
                      <button
                        key={emoji}
                        onClick={() => onSendReaction(emoji)}
                        className="text-xl p-1.5 hover:bg-muted rounded-lg transition-colors"
                        title={label}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                  <DropdownMenuSeparator />
                </>
              )}
              <DropdownMenuItem 
                onClick={handleScreenShareClick}
                className={!isScreenShareSupported ? "opacity-50" : ""}
              >
                {isScreenShareSupported ? (
                  <MonitorUp className="w-4 h-4 mr-2" />
                ) : (
                  <MonitorOff className="w-4 h-4 mr-2" />
                )}
                {!isScreenShareSupported 
                  ? "Screen Share (Desktop Only)" 
                  : isScreenSharing 
                    ? "Stop Sharing" 
                    : "Share Screen"}
              </DropdownMenuItem>
              {onToggleChat && (
                <DropdownMenuItem onClick={onToggleChat}>
                  <MessageCircle className="w-4 h-4 mr-2" />
                  {isChatPanelOpen ? "Close Chat" : "Open Chat"}
                  {unreadMessageCount > 0 && !isChatPanelOpen && (
                    <span className="ml-auto bg-red-500 text-white text-xs px-1.5 py-0.5 rounded-full">
                      {unreadMessageCount > 9 ? "9+" : unreadMessageCount}
                    </span>
                  )}
                </DropdownMenuItem>
              )}
              {onToggleWhiteboard && (
                <DropdownMenuItem onClick={onToggleWhiteboard}>
                  <PenTool className="w-4 h-4 mr-2" />
                  {isWhiteboardOpen ? "Close Whiteboard" : "Open Whiteboard"}
                </DropdownMenuItem>
              )}
              {isHost && onStartRecording && (
                <>
                  <DropdownMenuSeparator />
                  {recordingState === "idle" ? (
                    <DropdownMenuItem onClick={onStartRecording}>
                      <Circle className="w-4 h-4 mr-2 text-red-500 fill-red-500" />
                      Start Recording
                    </DropdownMenuItem>
                  ) : (
                    <>
                      <div className="flex items-center gap-2 px-2 py-1.5 text-sm">
                        <span className={cn(
                          "w-2 h-2 rounded-full",
                          recordingState === "recording" ? "bg-red-500 animate-pulse" : "bg-yellow-500"
                        )} />
                        <span className="font-mono text-red-500">{recordingDuration}</span>
                        <span className="text-muted-foreground">
                          {recordingState === "paused" ? "(Paused)" : "Recording"}
                        </span>
                      </div>
                      {recordingState === "recording" && onPauseRecording && (
                        <DropdownMenuItem onClick={onPauseRecording}>
                          <Pause className="w-4 h-4 mr-2 text-yellow-500" />
                          Pause Recording
                        </DropdownMenuItem>
                      )}
                      {recordingState === "paused" && onResumeRecording && (
                        <DropdownMenuItem onClick={onResumeRecording}>
                          <Play className="w-4 h-4 mr-2 text-green-500" />
                          Resume Recording
                        </DropdownMenuItem>
                      )}
                      {onStopRecording && (
                        <DropdownMenuItem onClick={onStopRecording}>
                          <Square className="w-4 h-4 mr-2 text-red-500 fill-red-500" />
                          Stop Recording
                        </DropdownMenuItem>
                      )}
                    </>
                  )}
                </>
              )}
              {isHost && onToggleHostControls && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={onToggleHostControls}>
                    <Crown className="w-4 h-4 mr-2 text-amber-500" />
                    Host Controls
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="icon"
                variant="destructive"
                onClick={onLeave}
                className="rounded-full w-11 h-11 sm:w-12 sm:h-12"
                data-testid="button-leave-meeting"
              >
                <PhoneOff className="w-5 h-5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top" className="bg-zinc-900 text-white border-zinc-700 px-3 py-1.5 text-sm font-medium shadow-lg">Leave Meeting</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    </div>
  );
}
