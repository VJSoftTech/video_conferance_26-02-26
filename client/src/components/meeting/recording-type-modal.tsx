import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Mic, Video } from "lucide-react";

export type RecordingTypeChoice = "AUDIO" | "VIDEO";

interface RecordingTypeModalProps {
  open: boolean;
  onClose: () => void;
  onSelect: (type: RecordingTypeChoice) => void;
  isMicEnabled: boolean;
}

export function RecordingTypeModal({
  open,
  onClose,
  onSelect,
  isMicEnabled,
}: RecordingTypeModalProps) {
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Start Recording</DialogTitle>
          <DialogDescription>
            Choose what to record for this meeting.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-4 pt-2">
          {/* Audio Only */}
          <button
            onClick={() => onSelect("AUDIO")}
            disabled={!isMicEnabled}
            className="flex flex-col items-center gap-3 p-5 rounded-xl border-2 border-transparent bg-muted hover:border-primary hover:bg-primary/5 transition-all disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <div className="w-14 h-14 rounded-full bg-blue-500/10 flex items-center justify-center">
              <Mic className="w-7 h-7 text-blue-500" />
            </div>
            <div className="text-center">
              <p className="font-semibold text-sm">Audio Only</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Records all participant voices
              </p>
            </div>
          </button>

          {/* Video + Audio */}
          <button
            onClick={() => onSelect("VIDEO")}
            className="flex flex-col items-center gap-3 p-5 rounded-xl border-2 border-transparent bg-muted hover:border-primary hover:bg-primary/5 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <div className="w-14 h-14 rounded-full bg-red-500/10 flex items-center justify-center">
              <Video className="w-7 h-7 text-red-500" />
            </div>
            <div className="text-center">
              <p className="font-semibold text-sm">Video + Audio</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Records video and all audio
              </p>
            </div>
          </button>
        </div>

        {!isMicEnabled && (
          <p className="text-xs text-amber-600 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg px-3 py-2 mt-1">
            Please enable your microphone before starting audio recording.
          </p>
        )}

        <div className="flex justify-end pt-1">
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
