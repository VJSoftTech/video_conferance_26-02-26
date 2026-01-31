import { useEffect, useRef, useState } from "react";
import { Mic, MicOff, Pin } from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

interface VideoTileProps {
  stream: MediaStream | null;
  name: string;
  isAudioEnabled: boolean;
  isVideoEnabled: boolean;
  isSpeaking?: boolean;
  isLocal?: boolean;
  isScreenShare?: boolean;
  isPinned?: boolean;
  className?: string;
}

export function VideoTile({
  stream,
  name,
  isAudioEnabled,
  isVideoEnabled,
  isSpeaking = false,
  isLocal = false,
  isScreenShare = false,
  isPinned = false,
  className,
}: VideoTileProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [hasVideo, setHasVideo] = useState(false);

  useEffect(() => {
    const videoEl = videoRef.current;
    
    if (videoEl && stream) {
      const videoTracks = stream.getVideoTracks();
      const hasActiveVideo = videoTracks.length > 0;
      
      console.log(`[${name}] Stream updated - video tracks: ${videoTracks.length}, isLocal: ${isLocal}`);
      
      videoEl.srcObject = stream;
      setHasVideo(hasActiveVideo);
      
      if (hasActiveVideo) {
        videoEl.play().catch(err => {
          console.log(`[${name}] Video play failed:`, err.message);
        });
      }
    } else {
      setHasVideo(false);
    }
  }, [stream, name, isLocal]);

  useEffect(() => {
    if (!isLocal && stream && audioRef.current) {
      const audioTracks = stream.getAudioTracks();
      if (audioTracks.length > 0) {
        console.log(`[${name}] Setting up audio - tracks: ${audioTracks.length}`);
        audioRef.current.srcObject = stream;
        audioRef.current.play().catch(err => {
          console.log(`[${name}] Audio play failed:`, err.message);
        });
      }
    }
  }, [stream, isLocal, name]);

  const showVideo = isLocal ? (isVideoEnabled && stream) : (hasVideo && stream);

  const initials = name
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
  const bgColor = bgColors[name.charCodeAt(0) % bgColors.length];

  return (
    <div
      className={cn(
        "relative aspect-video rounded-lg overflow-hidden bg-muted transition-all duration-200",
        isSpeaking && "ring-4 ring-primary",
        className
      )}
      data-testid={`video-tile-${isLocal ? "local" : name.replace(/\s+/g, "-").toLowerCase()}`}
    >
      {!isLocal && <audio ref={audioRef} autoPlay playsInline />}
      
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={isLocal}
        className={cn(
          "w-full h-full object-cover",
          !showVideo && "hidden"
        )}
      />
      
      {!showVideo && (
        <div className="w-full h-full flex items-center justify-center">
          <Avatar className={cn("w-20 h-20", bgColor)}>
            <AvatarFallback className={cn("text-2xl font-medium text-white", bgColor)}>
              {initials}
            </AvatarFallback>
          </Avatar>
        </div>
      )}

      <div className="absolute top-3 right-3 flex items-center gap-2">
        {isPinned && (
          <div className="p-1.5 rounded-full bg-black/50 backdrop-blur-sm">
            <Pin className="w-4 h-4 text-white" />
          </div>
        )}
        {!isAudioEnabled && (
          <div className="p-1.5 rounded-full bg-red-500/90 backdrop-blur-sm" data-testid={`mute-indicator-${name.replace(/\s+/g, "-").toLowerCase()}`}>
            <MicOff className="w-4 h-4 text-white" />
          </div>
        )}
      </div>

      <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/70 to-transparent">
        <div className="flex items-center gap-2">
          {isAudioEnabled ? (
            <Mic className="w-4 h-4 text-white/80" />
          ) : (
            <MicOff className="w-4 h-4 text-red-400" />
          )}
          <span className="text-sm font-medium text-white truncate" data-testid={`participant-name-${name.replace(/\s+/g, "-").toLowerCase()}`}>
            {name}
            {isLocal && " (You)"}
            {isScreenShare && " - Screen"}
          </span>
        </div>
      </div>
    </div>
  );
}
