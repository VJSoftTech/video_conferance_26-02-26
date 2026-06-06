import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { Play, Download, Trash2, Video, Loader2, Mic, ChevronLeft, ChevronRight } from "lucide-react";

type FilterType = "ALL" | "VIDEO" | "AUDIO";

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
  recordingType: string;
  status: string;
  createdAt: string;
  meetingTitle: string | null;
}

interface RecordingsResponse {
  recordings: Recording[];
  total: number;
  page: number;
  limit: number;
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

function isAudioOnly(recording: Recording): boolean {
  return (
    recording.recordingType === "AUDIO" ||
    (recording.mimeType?.startsWith("audio/") ?? false)
  );
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

function AudioThumbnail({ duration }: { duration: number | null }) {
  return (
    <div className="relative w-full h-full bg-gradient-to-br from-blue-900 to-blue-700 flex flex-col items-center justify-center gap-2">
      <div className="w-16 h-16 rounded-full bg-blue-500/30 flex items-center justify-center">
        <Mic className="w-8 h-8 text-blue-200" />
      </div>
      <span className="text-blue-200 text-xs font-mono">{formatDurationYT(duration)}</span>
    </div>
  );
}

const ROWS_OPTIONS = [10, 25, 50, 100] as const;

export default function RecordingsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [playingRecording, setPlayingRecording] = useState<Recording | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<Recording | null>(null);
  const [filterType, setFilterType] = useState<FilterType>("ALL");
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  const queryKey = ["/api/recordings", filterType, page, rowsPerPage];

  const { data, isLoading } = useQuery<RecordingsResponse>({
    queryKey,
    queryFn: async () => {
      const params = new URLSearchParams({
        type: filterType,
        page: String(page),
        limit: String(rowsPerPage),
      });
      const response = await fetch(`/api/recordings?${params}`);
      if (!response.ok) throw new Error("Failed to fetch recordings");
      return response.json();
    },
  });

  const recordings = data?.recordings ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / rowsPerPage));

  const handleFilterChange = (value: FilterType) => {
    setFilterType(value);
    setPage(1);
  };

  const handleRowsPerPageChange = (value: string) => {
    setRowsPerPage(Number(value));
    setPage(1);
  };

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

  const startItem = total === 0 ? 0 : (page - 1) * rowsPerPage + 1;
  const endItem = Math.min(page * rowsPerPage, total);

  return (
    <DashboardShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Recordings</h1>
          <p className="text-muted-foreground mt-1">
            All meeting recordings you have made
          </p>
        </div>

        {/* Filter tabs + rows per page */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
            {(["ALL", "VIDEO", "AUDIO"] as FilterType[]).map((type) => (
              <button
                key={type}
                onClick={() => handleFilterChange(type)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  filterType === type
                    ? "bg-background shadow-sm text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {type === "VIDEO" && <Video className="w-3.5 h-3.5" />}
                {type === "AUDIO" && <Mic className="w-3.5 h-3.5" />}
                {type === "ALL" && <span className="w-3.5 h-3.5 text-center text-xs leading-none">≡</span>}
                {type === "ALL" ? "All" : type === "VIDEO" ? "Video" : "Audio"}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>Rows per page:</span>
            <Select value={String(rowsPerPage)} onValueChange={handleRowsPerPageChange}>
              <SelectTrigger className="h-8 w-20">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ROWS_OPTIONS.map((n) => (
                  <SelectItem key={n} value={String(n)}>{n}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
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
              {filterType === "ALL"
                ? "Start a meeting and click the record button to create your first recording"
                : `No ${filterType.toLowerCase()} recordings found`}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Showing {startItem}–{endItem} of {total} recording{total !== 1 ? "s" : ""}
            </p>

            {recordings.map((recording) => {
              const audio = isAudioOnly(recording);
              return (
                <div
                  key={recording.id}
                  className="flex flex-col sm:flex-row gap-4 bg-white dark:bg-card rounded-2xl border shadow-sm overflow-hidden"
                >
                  {/* Thumbnail */}
                  <div className="relative flex-shrink-0 w-full sm:w-[380px] h-[200px] sm:h-[240px] bg-black rounded-t-2xl sm:rounded-t-none sm:rounded-l-2xl overflow-hidden">
                    {audio ? (
                      <AudioThumbnail duration={recording.duration} />
                    ) : (
                      <VideoThumbnail src={`/api/recordings/${recording.id}/stream`} />
                    )}
                    {!audio && (
                      <span className="absolute bottom-2 right-2 bg-black/80 text-white text-xs font-mono px-1.5 py-0.5 rounded">
                        {formatDurationYT(recording.duration)}
                      </span>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0 py-4 px-4 sm:px-0 sm:pr-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-bold text-base leading-tight">
                        {recording.meetingTitle || "Instant Meeting - Recording"}
                      </h3>
                      <Badge
                        variant="secondary"
                        className={`text-xs shrink-0 ${
                          audio
                            ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                            : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300"
                        }`}
                      >
                        {audio ? (
                          <><Mic className="w-3 h-3 mr-1" />Audio</>
                        ) : (
                          <><Video className="w-3 h-3 mr-1" />Video</>
                        )}
                      </Badge>
                    </div>
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
                  <div className="flex flex-row sm:flex-col justify-center gap-2 px-4 pb-4 sm:px-0 sm:pr-5 sm:py-4 flex-shrink-0">
                    <Button
                      size="sm"
                      className="flex-1 sm:flex-none sm:w-32 bg-purple-100 hover:bg-purple-200 text-purple-700 border-0 shadow-none font-medium"
                      onClick={() => setPlayingRecording(recording)}
                    >
                      <Play className="w-4 h-4 mr-1.5" />
                      View
                    </Button>
                    <Button
                      size="sm"
                      className="flex-1 sm:flex-none sm:w-32 bg-green-100 hover:bg-green-200 text-green-700 border-0 shadow-none font-medium"
                      onClick={() => handleDownload(recording)}
                    >
                      <Download className="w-4 h-4 mr-1.5" />
                      Download
                    </Button>
                    <Button
                      size="sm"
                      className="flex-1 sm:flex-none sm:w-32 bg-red-100 hover:bg-red-200 text-red-600 border-0 shadow-none font-medium"
                      onClick={() => setDeleteConfirm(recording)}
                    >
                      <Trash2 className="w-4 h-4 mr-1.5" />
                      Delete
                    </Button>
                  </div>
                </div>
              );
            })}

            {/* Pagination controls */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                >
                  <ChevronLeft className="w-4 h-4" />
                  Previous
                </Button>
                <span className="text-sm text-muted-foreground px-2">
                  Page {page} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                >
                  Next
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Playback dialog */}
      <Dialog open={!!playingRecording} onOpenChange={() => setPlayingRecording(null)}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>
              {playingRecording?.meetingTitle || "Recording Playback"}
            </DialogTitle>
          </DialogHeader>
          {playingRecording && (
            isAudioOnly(playingRecording) ? (
              <div className="bg-gradient-to-br from-blue-900 to-blue-700 rounded-lg p-8 flex flex-col items-center gap-4">
                <div className="w-24 h-24 rounded-full bg-blue-500/30 flex items-center justify-center">
                  <Mic className="w-12 h-12 text-blue-200" />
                </div>
                <p className="text-blue-100 font-medium">Audio Recording</p>
                <audio
                  src={`/api/recordings/${playingRecording.id}/stream`}
                  controls
                  autoPlay
                  className="w-full mt-2"
                />
              </div>
            ) : (
              <div className="aspect-video bg-black rounded-lg overflow-hidden">
                <video
                  src={`/api/recordings/${playingRecording.id}/stream`}
                  controls
                  autoPlay
                  className="w-full h-full"
                />
              </div>
            )
          )}
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
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
