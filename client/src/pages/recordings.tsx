import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { Play, Download, Trash2, Video, Loader2 } from "lucide-react";

interface Recording {
  id: number;
  roomId: string;
  meetingId: number | null;
  hostId: number | null;
  filename: string;
  originalFilename: string | null;
  fileSize: number | null;
  duration: number | null;
  mimeType: string | null;
  status: string;
  createdAt: string;
  meetingTitle: string | null;
}

function formatFileSize(bytes: number | null): string {
  if (!bytes) return "Unknown";
  const units = ["B", "KB", "MB", "GB"];
  let size = bytes;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }
  return `${size.toFixed(1)} ${units[unitIndex]}`;
}

function formatDurationYT(seconds: number | null): string {
  if (seconds === null || seconds === undefined) return "0:00";
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  if (hrs > 0) {
    return `${hrs}:${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  }
  return `${mins}:${String(secs).padStart(2, "0")}`;
}

function VideoThumbnail({ src }: { src: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [loaded, setLoaded] = useState(false);

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      videoRef.current.currentTime = 0.5;
    }
  };

  const handleSeeked = () => {
    setLoaded(true);
  };

  return (
    <div className="relative w-full h-full bg-black">
      {!loaded && (
        <div className="absolute inset-0 flex items-center justify-center">
          <Video className="w-8 h-8 text-gray-500" />
        </div>
      )}
      <video
        ref={videoRef}
        src={src}
        preload="metadata"
        onLoadedMetadata={handleLoadedMetadata}
        onSeeked={handleSeeked}
        className={`w-full h-full object-cover transition-opacity duration-300 ${loaded ? "opacity-100" : "opacity-0"}`}
        muted
      />
    </div>
  );
}

export default function RecordingsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [playingRecording, setPlayingRecording] = useState<Recording | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<Recording | null>(null);

  const { data: recordings = [], isLoading } = useQuery<Recording[]>({
    queryKey: ["/api/recordings"],
    queryFn: async () => {
      const response = await fetch("/api/recordings");
      if (!response.ok) throw new Error("Failed to fetch recordings");
      return response.json();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await fetch(`/api/recordings/${id}`, { method: "DELETE" });
      if (!response.ok) throw new Error("Failed to delete recording");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/recordings"] });
      toast({
        title: "Recording Deleted",
        description: "The recording has been permanently removed.",
      });
      setDeleteConfirm(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Delete Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleDownload = (recording: Recording) => {
    window.open(`/api/recordings/${recording.id}/download`, "_blank");
  };

  return (
    <DashboardShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Recordings</h1>
          <p className="text-muted-foreground mt-1">
            All meeting recordings you have made
          </p>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        ) : recordings.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground">
            <Video className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p className="text-lg font-medium">No recordings yet</p>
            <p className="text-sm mt-1">
              Start a meeting and click the record button to create your first recording
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Showing 1–{recordings.length} of {recordings.length} recording{recordings.length !== 1 ? "s" : ""}
            </p>

            {recordings.map((recording) => (
              <div
                key={recording.id}
                className="flex gap-4 bg-white dark:bg-card rounded-2xl border shadow-sm overflow-hidden"
              >
                {/* Thumbnail */}
                <div className="relative flex-shrink-0 w-[380px] h-[240px] bg-black rounded-l-2xl overflow-hidden">
                  <VideoThumbnail
                    src={`/api/recordings/${recording.id}/stream`}
                  />
                  <span className="absolute bottom-2 right-2 bg-black/80 text-white text-xs font-mono px-1.5 py-0.5 rounded">
                    {formatDurationYT(recording.duration)}
                  </span>
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0 py-4 pr-2">
                  <h3 className="font-bold text-base leading-tight">
                    {recording.meetingTitle || "Instant Meeting - Recording"}
                  </h3>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    {recording.roomId}
                  </p>
                  <div className="mt-3 space-y-1 text-sm text-muted-foreground">
                    <div className="flex items-center gap-1.5">
                      <span>Meeting ID:</span>
                      <Badge variant="secondary" className="text-xs font-mono px-2 py-0">
                        {recording.meetingId ?? recording.roomId}
                      </Badge>
                    </div>
                    <div>
                      Date:{" "}
                      <span className="text-blue-500">
                        {format(new Date(recording.createdAt), "M/d/yyyy, h:mm:ss aa")}
                      </span>
                    </div>
                    <div>
                      Duration:{" "}
                      <span className="font-medium text-foreground">
                        {formatDurationYT(recording.duration)}
                      </span>
                      <span className="mx-1.5">·</span>
                      Size:{" "}
                      <span className="font-medium text-foreground">
                        {formatFileSize(recording.fileSize)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex flex-col justify-center gap-2 pr-5 py-4 flex-shrink-0">
                  <Button
                    size="sm"
                    className="w-32 bg-purple-100 hover:bg-purple-200 text-purple-700 border-0 shadow-none font-medium"
                    onClick={() => setPlayingRecording(recording)}
                  >
                    <Play className="w-4 h-4 mr-1.5" />
                    View
                  </Button>
                  <Button
                    size="sm"
                    className="w-32 bg-green-100 hover:bg-green-200 text-green-700 border-0 shadow-none font-medium"
                    onClick={() => handleDownload(recording)}
                  >
                    <Download className="w-4 h-4 mr-1.5" />
                    Download
                  </Button>
                  <Button
                    size="sm"
                    className="w-32 bg-red-100 hover:bg-red-200 text-red-600 border-0 shadow-none font-medium"
                    onClick={() => setDeleteConfirm(recording)}
                  >
                    <Trash2 className="w-4 h-4 mr-1.5" />
                    Delete
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Dialog open={!!playingRecording} onOpenChange={() => setPlayingRecording(null)}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>
              {playingRecording?.meetingTitle || "Recording Playback"}
            </DialogTitle>
          </DialogHeader>
          {playingRecording && (
            <div className="aspect-video bg-black rounded-lg overflow-hidden">
              <video
                src={`/api/recordings/${playingRecording.id}/stream`}
                controls
                autoPlay
                className="w-full h-full"
              />
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Recording?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the recording "{deleteConfirm?.meetingTitle || deleteConfirm?.roomId}".
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteConfirm && deleteMutation.mutate(deleteConfirm.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <Trash2 className="w-4 h-4 mr-2" />
              )}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardShell>
  );
}
