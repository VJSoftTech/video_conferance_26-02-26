import { useState, useEffect, useCallback, useRef } from "react";

interface MediaDevicesState {
  audioInputs: MediaDeviceInfo[];
  videoInputs: MediaDeviceInfo[];
  selectedAudioInput: string;
  selectedVideoInput: string;
  localStream: MediaStream | null;
  isAudioEnabled: boolean;
  isVideoEnabled: boolean;
  isScreenSharing: boolean;
  screenStream: MediaStream | null;
  error: string | null;
}

export function useMediaDevices() {
  const getInitialAudioEnabled = () => {
    const stored = sessionStorage.getItem("audioEnabled");
    return stored !== null ? stored === "true" : true;
  };
  
  const getInitialVideoEnabled = () => {
    const stored = sessionStorage.getItem("videoEnabled");
    return stored !== null ? stored === "true" : true;
  };

  const [state, setState] = useState<MediaDevicesState>({
    audioInputs: [],
    videoInputs: [],
    selectedAudioInput: "",
    selectedVideoInput: "",
    localStream: null,
    isAudioEnabled: getInitialAudioEnabled(),
    isVideoEnabled: getInitialVideoEnabled(),
    isScreenSharing: false,
    screenStream: null,
    error: null,
  });

  const localStreamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);

  const enumerateDevices = useCallback(async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const audioInputs = devices.filter((d) => d.kind === "audioinput");
      const videoInputs = devices.filter((d) => d.kind === "videoinput");

      setState((prev) => ({
        ...prev,
        audioInputs,
        videoInputs,
        selectedAudioInput: prev.selectedAudioInput || audioInputs[0]?.deviceId || "",
        selectedVideoInput: prev.selectedVideoInput || videoInputs[0]?.deviceId || "",
      }));
    } catch (err) {
      console.error("Failed to enumerate devices:", err);
    }
  }, []);

  const getLocalStream = useCallback(async (audioDeviceId?: string, videoDeviceId?: string) => {
    try {
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => track.stop());
      }

      const constraints: MediaStreamConstraints = {
        audio: audioDeviceId ? { deviceId: { exact: audioDeviceId } } : true,
        video: videoDeviceId
          ? { deviceId: { exact: videoDeviceId }, width: { ideal: 1280 }, height: { ideal: 720 } }
          : { width: { ideal: 1280 }, height: { ideal: 720 } },
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      localStreamRef.current = stream;
      
      const initialAudioEnabled = getInitialAudioEnabled();
      const initialVideoEnabled = getInitialVideoEnabled();
      
      const audioTrack = stream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = initialAudioEnabled;
      }
      
      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = initialVideoEnabled;
      }

      setState((prev) => ({
        ...prev,
        localStream: stream,
        isAudioEnabled: initialAudioEnabled,
        isVideoEnabled: initialVideoEnabled,
        error: null,
      }));

      await enumerateDevices();
      return stream;
    } catch (err: any) {
      const errorMessage = err.name === "NotAllowedError"
        ? "Camera and microphone access was denied. Please allow access to join the meeting."
        : err.name === "NotFoundError"
        ? "No camera or microphone found. Please connect a device."
        : "Failed to access camera and microphone.";

      setState((prev) => ({
        ...prev,
        error: errorMessage,
        localStream: null,
      }));
      return null;
    }
  }, [enumerateDevices]);

  const toggleAudio = useCallback(() => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setState((prev) => ({ ...prev, isAudioEnabled: audioTrack.enabled }));
      }
    }
  }, []);

  const toggleVideo = useCallback(() => {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setState((prev) => ({ ...prev, isVideoEnabled: videoTrack.enabled }));
      }
    }
  }, []);

  const startScreenShare = useCallback(async (): Promise<MediaStream | null> => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { cursor: "always" } as any,
        audio: false,
      });

      screenStreamRef.current = stream;

      stream.getVideoTracks()[0].onended = () => {
        setState((prev) => ({
          ...prev,
          isScreenSharing: false,
          screenStream: null,
        }));
        screenStreamRef.current = null;
      };

      setState((prev) => ({
        ...prev,
        isScreenSharing: true,
        screenStream: stream,
      }));

      return stream;
    } catch (err) {
      console.error("Failed to start screen share:", err);
      return null;
    }
  }, []);

  const stopScreenShare = useCallback(() => {
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach((track) => track.stop());
      screenStreamRef.current = null;
      setState((prev) => ({
        ...prev,
        isScreenSharing: false,
        screenStream: null,
      }));
    }
  }, []);

  const stopAllStreams = useCallback(() => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
    }
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach((track) => track.stop());
      screenStreamRef.current = null;
    }
    setState((prev) => ({
      ...prev,
      localStream: null,
      screenStream: null,
      isScreenSharing: false,
    }));
  }, []);

  const setAudioDevice = useCallback(async (deviceId: string) => {
    setState((prev) => ({ ...prev, selectedAudioInput: deviceId }));
    await getLocalStream(deviceId, state.selectedVideoInput);
  }, [getLocalStream, state.selectedVideoInput]);

  const setVideoDevice = useCallback(async (deviceId: string) => {
    setState((prev) => ({ ...prev, selectedVideoInput: deviceId }));
    await getLocalStream(state.selectedAudioInput, deviceId);
  }, [getLocalStream, state.selectedAudioInput]);

  useEffect(() => {
    enumerateDevices();
    navigator.mediaDevices.addEventListener("devicechange", enumerateDevices);
    return () => {
      navigator.mediaDevices.removeEventListener("devicechange", enumerateDevices);
    };
  }, [enumerateDevices]);

  return {
    ...state,
    getLocalStream,
    toggleAudio,
    toggleVideo,
    startScreenShare,
    stopScreenShare,
    stopAllStreams,
    setAudioDevice,
    setVideoDevice,
  };
}
