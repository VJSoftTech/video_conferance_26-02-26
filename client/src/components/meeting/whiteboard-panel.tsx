import { useState, useCallback, useEffect } from "react";
import { Tldraw, Editor, TLStoreSnapshot, getSnapshot, loadSnapshot } from "tldraw";
import "tldraw/tldraw.css";
import { Button } from "@/components/ui/button";
import { X, Trash2, Download, Upload, Maximize2, Minimize2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface WhiteboardPanelProps {
  roomId: string;
  isHost: boolean;
  onClose: () => void;
}

export function WhiteboardPanel({ roomId, isHost, onClose }: WhiteboardPanelProps) {
  const { toast } = useToast();
  const [editor, setEditor] = useState<Editor | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const loadWhiteboard = useCallback(async (ed: Editor) => {
    try {
      const response = await fetch(`/api/whiteboard/${roomId}`);
      if (response.ok) {
        const data = await response.json();
        if (data.snapshot) {
          const snapshot = JSON.parse(data.snapshot);
          loadSnapshot(ed.store, snapshot);
        }
      }
    } catch (error) {
      console.error("Failed to load whiteboard:", error);
    } finally {
      setIsLoading(false);
    }
  }, [roomId]);

  const saveWhiteboard = useCallback(async () => {
    if (!editor) return;
    try {
      const snapshot = getSnapshot(editor.store);
      await fetch(`/api/whiteboard/${roomId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ snapshot: JSON.stringify(snapshot) }),
      });
    } catch (error) {
      console.error("Failed to save whiteboard:", error);
    }
  }, [editor, roomId]);

  useEffect(() => {
    if (!editor) return;
    const interval = setInterval(saveWhiteboard, 5000);
    return () => {
      clearInterval(interval);
      saveWhiteboard();
    };
  }, [editor, saveWhiteboard]);

  const handleMount = useCallback((ed: Editor) => {
    setEditor(ed);
    loadWhiteboard(ed);
  }, [loadWhiteboard]);

  const handleClearCanvas = useCallback(() => {
    if (!editor) return;
    const allShapeIds = editor.getCurrentPageShapeIds();
    if (allShapeIds.size > 0) {
      editor.deleteShapes(Array.from(allShapeIds));
      saveWhiteboard();
      toast({
        title: "Canvas cleared",
        description: "All drawings have been removed.",
      });
    }
  }, [editor, saveWhiteboard, toast]);

  const handleExport = useCallback(() => {
    if (!editor) return;
    const snapshot = getSnapshot(editor.store);
    const dataStr = JSON.stringify(snapshot, null, 2);
    const dataBlob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `whiteboard-${roomId}.json`;
    link.click();
    URL.revokeObjectURL(url);
    toast({
      title: "Whiteboard exported",
      description: "Your whiteboard has been downloaded as JSON.",
    });
  }, [editor, roomId, toast]);

  const handleImport = useCallback(() => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file || !editor) return;
      try {
        const text = await file.text();
        const snapshot = JSON.parse(text) as TLStoreSnapshot;
        loadSnapshot(editor.store, snapshot);
        saveWhiteboard();
        toast({
          title: "Whiteboard imported",
          description: "Your whiteboard has been loaded successfully.",
        });
      } catch (error) {
        toast({
          title: "Import failed",
          description: "Invalid whiteboard file format.",
          variant: "destructive",
        });
      }
    };
    input.click();
  }, [editor, saveWhiteboard, toast]);

  return (
    <div 
      className={`flex flex-col bg-background border-l border-border ${
        isFullscreen 
          ? "fixed inset-0 z-50" 
          : "w-full h-full"
      }`}
    >
      <div className="flex items-center justify-between p-3 border-b border-border bg-card">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-sm">Whiteboard</span>
          {isLoading && (
            <span className="text-xs text-muted-foreground">Loading...</span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8"
            onClick={handleExport}
            title="Export whiteboard"
          >
            <Download className="w-4 h-4" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8"
            onClick={handleImport}
            title="Import whiteboard"
          >
            <Upload className="w-4 h-4" />
          </Button>
          {isHost && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 text-destructive hover:text-destructive"
                  title="Clear canvas"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Clear whiteboard?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will remove all drawings from the whiteboard for all participants. This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleClearCanvas}>
                    Clear All
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8"
            onClick={() => setIsFullscreen(!isFullscreen)}
            title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
          >
            {isFullscreen ? (
              <Minimize2 className="w-4 h-4" />
            ) : (
              <Maximize2 className="w-4 h-4" />
            )}
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8"
            onClick={() => {
              saveWhiteboard();
              onClose();
            }}
            title="Close whiteboard"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>
      <div className="flex-1 relative pb-20">
        <Tldraw
          onMount={handleMount}
          persistenceKey={`whiteboard-${roomId}`}
        />
      </div>
    </div>
  );
}
