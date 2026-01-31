import { useState, useRef, useCallback } from "react";

export type RecordingState = "idle" | "recording" | "paused" | "stopping";

interface UseRecordingOptions {
  roomId: string;
  hostId?: number;
  onRecordingComplete?: (recording: any) => void;
  onError?: (error: Error) => void;
}

export function useRecording({ roomId, hostId, onRecordingComplete, onError }: UseRecordingOptions) {
  const [state, setState] = useState<RecordingState>("idle");
  const [duration, setDuration] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const displayStreamRef = useRef<MediaStream | null>(null); // ADD THIS
const micStreamRef = useRef<MediaStream | null>(null); // ADD THIS
const audioContextRef = useRef<AudioContext | null>(null); // ADD THIS
  const startTimeRef = useRef<number>(0);
  const pausedTimeRef = useRef<number>(0);
  const durationIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const updateDuration = useCallback(() => {
    if (state === "recording" && startTimeRef.current) {
      const elapsed = Math.floor((Date.now() - startTimeRef.current - pausedTimeRef.current) / 1000);
      setDuration(elapsed);
    }
  }, [state]);

 const startRecording = useCallback(async () => {
  try {
    const displayStream = await navigator.mediaDevices.getDisplayMedia({
      video: { 
        displaySurface: "browser",
        width: { ideal: 1920 },
        height: { ideal: 1080 },
      },
      audio: true, // ✅ This captures tab audio (system audio from the tab)
      // @ts-ignore - These are experimental but widely supported
      preferCurrentTab: true,
      selfBrowserSurface: "include",
      surfaceSwitching: "exclude",
    });
    displayStreamRef.current = displayStream;

    // ✅ Capture microphone audio separately
    let micStream: MediaStream | null = null;
    try {
      micStream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        } 
      });
      micStreamRef.current = micStream;
    } catch (e) {
      console.log("Could not capture microphone audio:", e);
    }

    // ✅ Use Web Audio API to mix all audio sources
    const audioContext = new AudioContext();
    audioContextRef.current = audioContext; 
    const destination = audioContext.createMediaStreamDestination();

    // Mix tab audio (other participants' voices from the meeting)
    const tabAudioTracks = displayStream.getAudioTracks();
    if (tabAudioTracks.length > 0) {
      console.log("Adding tab audio to recording");
      const tabAudioSource = audioContext.createMediaStreamSource(
        new MediaStream(tabAudioTracks)
      );
      tabAudioSource.connect(destination);
    } else {
      console.warn("No tab audio available - make sure to check 'Share tab audio' in the screen share dialog");
    }

    // Mix microphone audio (your voice)
    if (micStream) {
      console.log("Adding microphone audio to recording");
      const micAudioSource = audioContext.createMediaStreamSource(micStream);
      micAudioSource.connect(destination);
    }

    // ✅ Combine video from display and mixed audio
    const tracks = [
      ...displayStream.getVideoTracks(),
      ...destination.stream.getAudioTracks(), // Use the mixed audio
    ];

    const combinedStream = new MediaStream(tracks);
    streamRef.current = combinedStream;

    console.log("Recording stream tracks:", {
      video: combinedStream.getVideoTracks().length,
      audio: combinedStream.getAudioTracks().length,
    });

    const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp9,opus")
      ? "video/webm;codecs=vp9,opus"
      : MediaRecorder.isTypeSupported("video/webm;codecs=vp8,opus")
      ? "video/webm;codecs=vp8,opus"
      : "video/webm";

    const mediaRecorder = new MediaRecorder(combinedStream, {
      mimeType,
      videoBitsPerSecond: 2500000,
      audioBitsPerSecond: 128000, // ✅ Add audio bitrate
    });

    chunksRef.current = [];

    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        chunksRef.current.push(event.data);
      }
    };

    mediaRecorder.onstop = async () => {
      const blob = new Blob(chunksRef.current, { type: mimeType });
      const finalDuration = Math.floor((Date.now() - startTimeRef.current - pausedTimeRef.current) / 1000);
      
      // ✅ Cleanup audio context
      audioContext.close();
      
      // ✅ Stop microphone stream
      if (micStream) {
        micStream.getTracks().forEach(track => track.stop());
      }
      
      try {
        const response = await fetch("/api/recordings/upload", {
          method: "POST",
          headers: {
            "Content-Type": "application/octet-stream",
            "x-room-id": roomId,
            "x-host-id": hostId?.toString() || "",
            "x-duration": finalDuration.toString(),
            "x-original-filename": `meeting_${roomId}_${new Date().toISOString().slice(0, 10)}.webm`,
          },
          body: blob,
        });

        const data = await response.json();
        if (data.success && onRecordingComplete) {
          onRecordingComplete(data.recording);
        }
      } catch (error: any) {
        console.error("Error uploading recording:", error);
        if (onError) {
          onError(error);
        }
      }

      setState("idle");
      setDuration(0);
      chunksRef.current = [];
    };

    displayStream.getVideoTracks()[0].onended = () => {
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
        durationIntervalRef.current = null;
      }
      
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
      
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
      
      // ✅ Cleanup audio context
      audioContext.close();
      
      // ✅ Stop microphone
      if (micStream) {
        micStream.getTracks().forEach(track => track.stop());
      }
      
      setState("stopping");
    };

    mediaRecorderRef.current = mediaRecorder;
    mediaRecorder.start(1000);

    startTimeRef.current = Date.now();
    pausedTimeRef.current = 0;
    setState("recording");

    durationIntervalRef.current = setInterval(() => {
      if (mediaRecorderRef.current?.state === "recording") {
        const elapsed = Math.floor((Date.now() - startTimeRef.current - pausedTimeRef.current) / 1000);
        setDuration(elapsed);
      }
    }, 1000);

  } catch (error: any) {
    console.error("Error starting recording:", error);
    if (onError) {
      onError(error);
    }
    setState("idle");
  }
}, [roomId, hostId, onRecordingComplete, onError, state]);

  const pauseRecording = useCallback(() => {
    if (mediaRecorderRef.current && state === "recording") {
      mediaRecorderRef.current.pause();
      pausedTimeRef.current -= Date.now();
      setState("paused");
    }
  }, [state]);

  const resumeRecording = useCallback(() => {
    if (mediaRecorderRef.current && state === "paused") {
      mediaRecorderRef.current.resume();
      pausedTimeRef.current += Date.now();
      setState("recording");
    }
  }, [state]);

const stopRecording = useCallback(() => {
  if (mediaRecorderRef.current && (state === "recording" || state === "paused")) {
    setState("stopping");
    
    // Stop duration interval
    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
      durationIntervalRef.current = null;
    }

    // Stop the MediaRecorder first
    if (mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }

    // ✅ CRITICAL: Stop the ORIGINAL display stream (removes "Stop sharing" button)
    if (displayStreamRef.current) {
      displayStreamRef.current.getTracks().forEach((track) => {
        console.log("Stopping original display track:", track.kind);
        track.stop();
      });
      displayStreamRef.current = null;
    }

    // Stop the combined stream
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        track.stop();
      });
      streamRef.current = null;
    }

    // Stop microphone stream
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach((track) => {
        track.stop();
      });
      micStreamRef.current = null;
    }

    // Close audio context
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
  }
}, [state]);

  const formatDuration = useCallback((seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hrs > 0) {
      return `${hrs}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
    }
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  }, []);

  return {
    state,
    duration,
    formattedDuration: formatDuration(duration),
    startRecording,
    pauseRecording,
    resumeRecording,
    stopRecording,
    isRecording: state === "recording",
    isPaused: state === "paused",
    isStopping: state === "stopping",
  };
}
