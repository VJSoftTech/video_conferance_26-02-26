import { useEffect, useRef, useState } from "react";
import { Participant, TrackPublication } from "livekit-client";
import { Mic, MicOff, VideoOff } from "lucide-react";
import { cn } from "@/lib/utils";

interface ParticipantTileProps {
  participant: Participant;
  videoTrack?: TrackPublication;
  audioTrack?: TrackPublication;
  isLocal?: boolean;
  isActiveSpeaker?: boolean;
  isScreenShare?: boolean;
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
    "bg-blue-500",
    "bg-green-500", 
    "bg-purple-500",
    "bg-orange-500",
    "bg-pink-500",
    "bg-teal-500",
    "bg-indigo-500",
    "bg-red-500",
  ];
  const index = name.charCodeAt(0) % colors.length;
  return colors[index];
}

export function ParticipantTile({
  participant,
  videoTrack,
  audioTrack,
  isLocal = false,
  isActiveSpeaker = false,
  isScreenShare = false,
}: ParticipantTileProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [hasVideo, setHasVideo] = useState(false);
  const attachedTrackRef = useRef<any>(null);

  const displayName = participant.name || participant.identity || "Unknown";
  const initials = getInitials(displayName);
  const avatarColor = getAvatarColor(displayName);

  const isAudioMuted = !audioTrack || audioTrack.isMuted;

  // Simple polling-based track attachment that works reliably
  useEffect(() => {
    const videoEl = videoRef.current;
    if (!videoEl) return;

    const attemptAttach = () => {
      const track = videoTrack?.track;
      const isMuted = videoTrack?.isMuted ?? true;
      const isSubscribedOrLocal = isLocal || videoTrack?.isSubscribed;
      
      if (track && !isMuted && isSubscribedOrLocal) {
        // Only attach if not already attached
        if (attachedTrackRef.current !== track) {
          // Detach previous track if any
          if (attachedTrackRef.current) {
            attachedTrackRef.current.detach(videoEl);
          }
          
          track.attach(videoEl);
          attachedTrackRef.current = track;
          
          // Mirror all camera videos (not screen shares)
          if (!isScreenShare) {
            videoEl.style.transform = 'scaleX(-1)';
            videoEl.style.webkitTransform = 'scaleX(-1)';
          } else {
            videoEl.style.transform = 'scaleX(1)';
            videoEl.style.webkitTransform = 'scaleX(1)';
          }
          
          setHasVideo(true);
        }
        return true;
      } else {
        // Track not available or muted - detach if attached
        if (attachedTrackRef.current) {
          attachedTrackRef.current.detach(videoEl);
          attachedTrackRef.current = null;
        }
        setHasVideo(false);
        return false;
      }
    };

    // Try immediately
    const attached = attemptAttach();
    
    // If not attached, poll for track availability
    let interval: NodeJS.Timeout | null = null;
    let timeout: NodeJS.Timeout | null = null;
    
    if (!attached && videoTrack) {
      interval = setInterval(() => {
        if (attemptAttach()) {
          if (interval) clearInterval(interval);
        }
      }, 50); // Check every 50ms
      
      // Stop polling after 5 seconds
      timeout = setTimeout(() => {
        if (interval) clearInterval(interval);
      }, 5000);
    }

    return () => {
      if (interval) clearInterval(interval);
      if (timeout) clearTimeout(timeout);
      
      // Cleanup on unmount
      if (attachedTrackRef.current && videoEl) {
        attachedTrackRef.current.detach(videoEl);
        attachedTrackRef.current = null;
      }
    };
  }, [videoTrack, videoTrack?.track, videoTrack?.isMuted, videoTrack?.isSubscribed, isLocal]);

  return (
    <div
      className={cn(
        "relative rounded-lg overflow-hidden bg-muted aspect-video",
        isActiveSpeaker && "ring-2 ring-primary ring-offset-2 ring-offset-background"
      )}
      data-testid={`participant-tile-${participant.identity}`}
    >
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={isLocal}
        className={cn(
          "absolute inset-0 w-full h-full object-cover",
          !hasVideo && "hidden"
        )}
      />

      {!hasVideo && (
        <div className="absolute inset-0 flex items-center justify-center bg-muted">
          <div
            className={cn(
              "w-16 h-16 sm:w-20 sm:h-20 rounded-full flex items-center justify-center text-white text-xl sm:text-2xl font-semibold",
              avatarColor
            )}
          >
            {initials}
          </div>
        </div>
      )}

      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-2 sm:p-3">
        <div className="flex items-center justify-between gap-2">
          <span className="text-white text-xs sm:text-sm font-medium truncate">
            {displayName}
            {isLocal && " (You)"}
          </span>
          <div className="flex items-center gap-1">
            {isAudioMuted && (
              <div className="p-1 rounded-full bg-destructive/80">
                <MicOff className="w-3 h-3 text-white" />
              </div>
            )}
            {!hasVideo && !isScreenShare && (
              <div className="p-1 rounded-full bg-muted-foreground/50">
                <VideoOff className="w-3 h-3 text-white" />
              </div>
            )}
          </div>
        </div>
      </div>

      {isLocal && (
        <div className="absolute top-2 left-2">
          <span className="px-2 py-0.5 rounded text-xs bg-primary text-primary-foreground">
            You
          </span>
        </div>
      )}
    </div>
  );
}
