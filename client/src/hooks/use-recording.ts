import { useState, useRef, useCallback } from "react";

export type RecordingState = "idle" | "recording" | "paused" | "stopping";
export type RecordingMode = "screen" | "audio-only";

interface UseRecordingOptions {
  roomId: string;
  hostId?: number;
  onRecordingComplete?: (recording: any) => void;
  onError?: (error: Error) => void;
  onRecordingStarted?: () => void;
  onRecordingStopped?: () => void;
  // Passed from the meeting room so we can pull remote audio tracks at record-time
  // (not at hook-init time, which is too early — tracks may not be subscribed yet)
  getRemoteAudioTracks?: () => MediaStreamTrack[];
  // All video tracks (local + remote) that should appear in the recording grid.
  // We only ever draw these tracks to an offscreen canvas — no header/footer/controls.
  getCompositeVideoTracks?: () => MediaStreamTrack[];
}

function isMobileDevice(): boolean {
  return /Android|iPhone|iPad|iPod|Opera Mini|IEMobile|WPDesktop/i.test(
    navigator.userAgent
  );
}

function getBestVideoMimeType(): string {
  const types = [
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm",
    "video/mp4",
  ];
  return types.find((t) => MediaRecorder.isTypeSupported(t)) || "";
}

// Returns mimeType + correct extension for pure audio recording
function getBestMobileAudioFormat(): { mimeType: string; ext: string } {
  const candidates = [
    { mimeType: "audio/mp4", ext: "m4a" }, // iOS Safari 14.3+
    { mimeType: "audio/webm;codecs=opus", ext: "webm" }, // Android Chrome
    { mimeType: "audio/webm", ext: "webm" }, // Android fallback
    { mimeType: "audio/ogg;codecs=opus", ext: "ogg" }, // Firefox Android
    { mimeType: "audio/ogg", ext: "ogg" },
  ];
  for (const c of candidates) {
    try {
      if (MediaRecorder.isTypeSupported(c.mimeType)) return c;
    } catch {
      // ignore
    }
  }
  // Last resort — let browser pick, save as webm
  return { mimeType: "", ext: "webm" };
}

export function useRecording({
  roomId,
  hostId,
  onRecordingComplete,
  onError,
  onRecordingStarted,
  onRecordingStopped,
  getRemoteAudioTracks,
  getCompositeVideoTracks,
}: UseRecordingOptions) {
  const [state, setState] = useState<RecordingState>("idle");
  const [duration, setDuration] = useState(0);
  const [recordingMode, setRecordingMode] =
    useState<RecordingMode>("screen");

  const stateRef = useRef<RecordingState>("idle");
  const setStateSynced = useCallback((next: RecordingState) => {
    stateRef.current = next;
    setState(next);
  }, []);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const micStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const canvasStreamRef = useRef<MediaStream | null>(null);
  const canvasAnimationFrameRef = useRef<number | null>(null);
  const videoElementsRef = useRef<HTMLVideoElement[]>([]);
  const startTimeRef = useRef<number>(0);
  const pausedTimeRef = useRef<number>(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startTimer = useCallback(() => {
    startTimeRef.current = Date.now();
    pausedTimeRef.current = 0;
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      if (mediaRecorderRef.current?.state === "recording") {
        setDuration(
          Math.floor(
            (Date.now() - startTimeRef.current - pausedTimeRef.current) /
              1000
          )
        );
      }
    }, 1000);
  }, []);

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const getFinalDuration = useCallback(
    () =>
      Math.floor(
        (Date.now() - startTimeRef.current - pausedTimeRef.current) / 1000
      ),
    []
  );

  const cleanupAudio = useCallback(() => {
    micStreamRef.current?.getTracks().forEach((t) => t.stop());
    micStreamRef.current = null;
    if (audioContextRef.current?.state !== "closed") {
      audioContextRef.current
        ?.close()
        .catch(() => {
          // ignore
        });
    }
    audioContextRef.current = null;
  }, []);

  const cleanupCanvas = useCallback(() => {
    if (canvasAnimationFrameRef.current !== null) {
      cancelAnimationFrame(canvasAnimationFrameRef.current);
      canvasAnimationFrameRef.current = null;
    }

    canvasStreamRef.current?.getTracks().forEach((t) => t.stop());
    canvasStreamRef.current = null;
    canvasRef.current = null;

    videoElementsRef.current.forEach((videoEl) => {
      try {
        videoEl.pause();
      } catch {
        // ignore
      }
      if (videoEl.srcObject instanceof MediaStream) {
        // We DO NOT stop the underlying tracks — they belong to LiveKit.
        videoEl.srcObject = null;
      }
      if (videoEl.isConnected) {
        videoEl.remove();
      }
    });
    videoElementsRef.current = [];
  }, []);

  const upload = useCallback(
    async (blob: Blob, finalDuration: number, filename: string) => {
      onRecordingStopped?.();
      try {
        const response = await fetch("/api/recordings/upload", {
          method: "POST",
          headers: {
            "Content-Type": "application/octet-stream",
            "x-room-id": roomId,
            "x-host-id": hostId?.toString() || "",
            "x-duration": finalDuration.toString(),
            "x-original-filename": filename,
          },
          body: blob,
        });
        const data = await response.json();
        if (data.success && onRecordingComplete) {
          onRecordingComplete(data.recording);
        }
      } catch (error: any) {
        onError?.(error);
      }
      setStateSynced("idle");
      setDuration(0);
      chunksRef.current = [];
    },
    [roomId, hostId, onRecordingComplete, onError, onRecordingStopped, setStateSynced]
  );

  // ══════════════════════════════════════════════════════════════════════════
  // SHARED HELPERS
  // - We never use getDisplayMedia.
  // - Video is rendered to an offscreen <canvas> from LiveKit video tracks.
  // - Audio is mixed from remote participant audio tracks only (no local mic).
  // ══════════════════════════════════════════════════════════════════════════

  const createMixedRemoteAudioStream = useCallback(
    async (): Promise<MediaStream | null> => {
      const remoteTracks = getRemoteAudioTracks?.() ?? [];
      console.log(
        "[Recording] Remote audio tracks at record-start:",
        remoteTracks.length
      );

      if (!remoteTracks.length) {
        return null;
      }

      const audioContext = new AudioContext();
      audioContextRef.current = audioContext;

      if (audioContext.state === "suspended") {
        try {
          await audioContext.resume();
        } catch (e) {
          console.warn("[Recording] Failed to resume AudioContext:", e);
        }
      }

      const destination = audioContext.createMediaStreamDestination();
      let remoteConnected = 0;

      for (const track of remoteTracks) {
        if (track.readyState === "live") {
          try {
            audioContext
              .createMediaStreamSource(new MediaStream([track]))
              .connect(destination);
            remoteConnected++;
          } catch (e) {
            console.warn(
              "[Recording] Could not connect remote audio track:",
              e
            );
          }
        }
      }

      if (
        !remoteConnected ||
        destination.stream.getAudioTracks().length === 0
      ) {
        console.warn(
          "[Recording] No remote audio tracks connected for recording."
        );
        return null;
      }

      console.log(
        "[Recording] Remote audio tracks connected:",
        remoteConnected
      );
      return destination.stream;
    },
    [getRemoteAudioTracks]
  );

  // ══════════════════════════════════════════════════════════════════════════
  // CANVAS-BASED VIDEO + REMOTE AUDIO RECORDING (desktop + mobile)
  // - Draws only meeting video tiles (no header/footer/controls).
  // - Does not capture the mouse cursor.
  // ══════════════════════════════════════════════════════════════════════════

  const startCanvasRecording = useCallback(async () => {
    const mimeType = getBestVideoMimeType();
    if (!mimeType) {
      throw new Error(
        "No supported video recording format. Please use a modern browser like Chrome or Firefox."
      );
    }

    const videoTracks = getCompositeVideoTracks?.() ?? [];
    const liveVideoTracks = videoTracks.filter(
      (t) => t.readyState === "live"
    );

    if (!liveVideoTracks.length) {
      throw new Error("No participant video tracks available to record.");
    }

    // Create hidden <video> elements for each track so we can draw them to a canvas.
    const videoEls: HTMLVideoElement[] = [];
    for (const track of liveVideoTracks) {
      const el = document.createElement("video");
      el.muted = true;
      el.playsInline = true;
      el.srcObject = new MediaStream([track]);
      el.style.position = "fixed";
      el.style.left = "-99999px";
      el.style.top = "0";
      el.style.width = "1px";
      el.style.height = "1px";
      document.body.appendChild(el);
      try {
        // User gesture (record button) should allow autoplay even off-DOM, but
        // some mobile browsers are picky, so we attach to DOM and call play().
        await el.play();
      } catch (e) {
        console.warn(
          "[Recording] Could not autoplay video track for canvas:",
          e
        );
      }
      videoEls.push(el);
    }

    if (!videoEls.length) {
      cleanupCanvas();
      throw new Error(
        "No playable participant video tracks available for recording."
      );
    }

    videoElementsRef.current = videoEls;

    const canvas = document.createElement("canvas");
    // 16:9 HD canvas — independent from actual DOM layout.
    canvas.width = 1280;
    canvas.height = 720;
    canvasRef.current = canvas;

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      cleanupCanvas();
      throw new Error(
        "Canvas is not supported for recording in this browser."
      );
    }

    const count = videoEls.length;
    const cols = Math.ceil(Math.sqrt(count));
    const rows = Math.ceil(count / cols);
    const tileWidth = canvas.width / cols;
    const tileHeight = canvas.height / rows;

    const drawFrame = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      videoEls.forEach((videoEl, index) => {
        if (videoEl.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
          const row = Math.floor(index / cols);
          const col = index % cols;
          const x = col * tileWidth;
          const y = row * tileHeight;
          ctx.drawImage(videoEl, x, y, tileWidth, tileHeight);
        }
      });
      canvasAnimationFrameRef.current = requestAnimationFrame(drawFrame);
    };

    drawFrame();

    // Some older mobile browsers may not implement captureStream; guard it.
    const capture = (canvas as any).captureStream?.bind(canvas);
    if (!capture) {
      cleanupCanvas();
      throw new Error("This browser does not support canvas-based recording.");
    }

    const canvasStream: MediaStream = capture(25); // 25 FPS
    canvasStreamRef.current = canvasStream;

    const audioStream = await createMixedRemoteAudioStream();

    const tracks: MediaStreamTrack[] = [...canvasStream.getVideoTracks()];
    if (audioStream) {
      tracks.push(...audioStream.getAudioTracks());
    }

    const combined = new MediaStream(tracks);
    const ext = mimeType.includes("mp4") ? "mp4" : "webm";

    const mr = new MediaRecorder(combined, {
      mimeType,
      videoBitsPerSecond: 2_500_000,
      audioBitsPerSecond: 128_000,
    });

    chunksRef.current = [];
    mediaRecorderRef.current = mr;

    mr.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };

    mr.onstop = async () => {
      const blob = new Blob(chunksRef.current, { type: mimeType });
      const dur = getFinalDuration();
      cleanupAudio();
      cleanupCanvas();
      await upload(
        blob,
        dur,
        `meeting_${roomId}_${new Date().toISOString().slice(0, 10)}.${ext}`
      );
    };

    mr.start(1000);
    setRecordingMode("screen");
    setStateSynced("recording");
    startTimer();
  }, [
    upload,
    getFinalDuration,
    startTimer,
    cleanupAudio,
    cleanupCanvas,
    roomId,
    setStateSynced,
    getCompositeVideoTracks,
    createMixedRemoteAudioStream,
  ]);

  // ══════════════════════════════════════════════════════════════════════════
  // AUDIO-ONLY RECORDING (remote participants only; no local mic)
  // - Used as fallback when canvas recording is not possible.
  // ══════════════════════════════════════════════════════════════════════════

  const startAudioOnlyRecording = useCallback(async () => {
    const { mimeType, ext } = getBestMobileAudioFormat();

    const recordStream = await createMixedRemoteAudioStream();
    if (!recordStream || recordStream.getAudioTracks().length === 0) {
      cleanupAudio();
      throw new Error("No remote participant audio tracks available to record.");
    }

    const mr = mimeType
      ? new MediaRecorder(recordStream, {
          mimeType,
          audioBitsPerSecond: 128_000,
        })
      : new MediaRecorder(recordStream);

    chunksRef.current = [];
    mediaRecorderRef.current = mr;

    mr.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };

    mr.onstop = async () => {
      const finalMime = mimeType || mr.mimeType || "audio/webm";
      const blob = new Blob(chunksRef.current, { type: finalMime });
      const dur = getFinalDuration();
      const filename = `meeting_${roomId}_${new Date()
        .toISOString()
        .slice(0, 10)}.${ext}`;
      cleanupAudio();
      await upload(blob, dur, filename);
    };

    mr.start(1000);
    setRecordingMode("audio-only");
    setStateSynced("recording");
    startTimer();
  }, [
    upload,
    getFinalDuration,
    startTimer,
    cleanupAudio,
    roomId,
    setStateSynced,
    createMixedRemoteAudioStream,
  ]);

  // ── Public API ────────────────────────────────────────────────────────────

  const startRecording = useCallback(async () => {
    if (typeof MediaRecorder === "undefined") {
      onError?.(new Error("Recording is not supported in this browser."));
      return;
    }
    try {
      onRecordingStarted?.();

      // Prefer full video + audio recording via canvas.
      try {
        await startCanvasRecording();
        return;
      } catch (canvasError: any) {
        console.warn(
          "[Recording] Canvas-based recording failed, falling back to audio-only:",
          canvasError
        );
      }

      // Fallback: audio-only from remote participants.
      await startAudioOnlyRecording();
    } catch (error: any) {
      console.error("[Recording] Start failed:", error);
      onRecordingStopped?.();
      onError?.(error);
      setStateSynced("idle");
    }
  }, [
    startCanvasRecording,
    startAudioOnlyRecording,
    onRecordingStarted,
    onRecordingStopped,
    onError,
    setStateSynced,
  ]);

  const pauseRecording = useCallback(() => {
    if (mediaRecorderRef.current && stateRef.current === "recording") {
      mediaRecorderRef.current.pause();
      pausedTimeRef.current -= Date.now();
      setStateSynced("paused");
    }
  }, [setStateSynced]);

  const resumeRecording = useCallback(() => {
    if (mediaRecorderRef.current && stateRef.current === "paused") {
      mediaRecorderRef.current.resume();
      pausedTimeRef.current += Date.now();
      setStateSynced("recording");
    }
  }, [setStateSynced]);

  const stopRecording = useCallback(() => {
    const current = stateRef.current;
    if (
      !mediaRecorderRef.current ||
      (current !== "recording" && current !== "paused")
    )
      return;

    setStateSynced("stopping");
    stopTimer();

    if (mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }

    // Stop canvas stream (if any)
    canvasStreamRef.current?.getTracks().forEach((t) => t.stop());
    canvasStreamRef.current = null;

    // ✅ Do NOT stop micStreamRef here — onstop handler cleans it up via cleanupAudio()
    // ✅ Do NOT stop remote audio tracks — they belong to LiveKit
    // ✅ Canvas + hidden video elements are cleaned up in the recorder's onstop handler.
  }, [stopTimer, setStateSynced]);

  const formatDuration = useCallback((seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hrs > 0) {
      return `${hrs}:${mins.toString().padStart(2, "0")}:${secs
        .toString()
        .padStart(2, "0")}`;
    }
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  }, []);

  return {
    state,
    duration,
    formattedDuration: formatDuration(duration),
    recordingMode,
    startRecording,
    pauseRecording,
    resumeRecording,
    stopRecording,
    isRecording: state === "recording",
    isPaused: state === "paused",
    isStopping: state === "stopping",
    isRecordingSupported: typeof MediaRecorder !== "undefined",
    isMobile: isMobileDevice(),
    isScreenRecording: recordingMode === "screen",
  };
}

