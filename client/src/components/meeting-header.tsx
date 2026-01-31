import { Copy, Check, Settings, Users, Clock } from "lucide-react";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";

interface MeetingHeaderProps {
  roomName: string;
  roomId: string;
  participantCount: number;
  joinedAt?: number;
}

function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  }
  return `${minutes}:${secs.toString().padStart(2, "0")}`;
}

export function MeetingHeader({
  roomName,
  roomId,
  participantCount,
  joinedAt,
}: MeetingHeaderProps) {
  const [copied, setCopied] = useState(false);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    if (!joinedAt) return;

    const interval = setInterval(() => {
      const seconds = Math.floor((Date.now() - joinedAt) / 1000);
      setDuration(seconds);
    }, 1000);

    return () => clearInterval(interval);
  }, [joinedAt]);

  const meetingLink = `${window.location.origin}/room/${roomId}`;

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
    <header className="fixed top-0 left-0 right-0 z-40 bg-card/95 backdrop-blur-lg border-b border-border" data-testid="meeting-header">
      <div className="flex items-center justify-between gap-4 h-16 px-6">
        <div className="flex items-center gap-4">
          <h1 className="text-lg font-semibold truncate max-w-xs" data-testid="text-room-name">
            {roomName}
          </h1>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={copyMeetingLink}
                data-testid="button-copy-meeting-link"
              >
                {copied ? (
                  <Check className="w-4 h-4 text-green-500" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>{copied ? "Copied!" : "Copy meeting link"}</p>
            </TooltipContent>
          </Tooltip>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="gap-1.5">
            <Clock className="w-3 h-3" />
            <span data-testid="text-duration">{formatDuration(duration)}</span>
          </Badge>
        </div>

        <div className="flex items-center gap-4">
          <Badge variant="secondary" className="gap-1.5">
            <Users className="w-3 h-3" />
            <span data-testid="text-participant-count">{participantCount}</span>
          </Badge>
          <Button variant="ghost" size="icon" data-testid="button-settings">
            <Settings className="w-5 h-5" />
          </Button>
        </div>
      </div>
    </header>
  );
}
