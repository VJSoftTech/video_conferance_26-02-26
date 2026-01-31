import { useState, useEffect, useRef } from "react";
import { useLocation, useParams } from "wouter";
import { Video, VideoOff, ArrowLeft, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ThemeToggle } from "@/components/theme-toggle";
import { useMediaDevices } from "@/hooks/use-media-devices";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

export default function PreJoin() {
  const params = useParams<{ roomId: string }>();
  const [, setLocation] = useLocation();
  const [name, setName] = useState("");

  // Get host token from URL if present (for meeting creators)
  const urlParams = new URLSearchParams(window.location.search);
  const hostToken = urlParams.get("host");

  const {
    audioInputs,
    videoInputs,
    selectedAudioInput,
    selectedVideoInput,
    setAudioDevice,
    setVideoDevice,
  } = useMediaDevices();

  const handleJoin = () => {
    if (!name.trim()) return;
    sessionStorage.setItem("participantName", name.trim());
    sessionStorage.setItem("audioEnabled", "false");
    sessionStorage.setItem("videoEnabled", "false");
    sessionStorage.removeItem("isHost");
    // Pass host token through if present
    const hostQuery = hostToken ? `?host=${hostToken}` : "";
    setLocation(`/room/${params.roomId}${hostQuery}`);
  };

  const handleBack = () => {
    setLocation("/");
  };

  const initials = name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2) || "?";

  return (
    <div className="min-h-screen bg-background">
      <header className="fixed top-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-lg border-b border-border">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={handleBack} data-testid="button-back">
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center">
              <Video className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="text-xl font-semibold">பேசு தமிழ்</span>
          </div>
          <ThemeToggle />
        </div>
      </header>

      <main className="pt-24 pb-12 px-6">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold mb-2" data-testid="text-prejoin-title">
              Ready to join?
            </h1>
            <p className="text-muted-foreground">
              Room: <span className="font-mono font-medium">{params.roomId}</span>
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            <div className="space-y-4">
              <div className="aspect-video rounded-xl overflow-hidden bg-muted relative" data-testid="video-preview">
                <div className="w-full h-full flex items-center justify-center">
                  <Avatar className="w-24 h-24 bg-primary">
                    <AvatarFallback className="text-3xl font-medium text-primary-foreground bg-primary">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                </div>
              </div>

              <div className="flex items-center justify-center gap-2 p-4 rounded-lg bg-muted/50 border border-border">
                <Info className="w-5 h-5 text-primary flex-shrink-0" />
                <p className="text-sm text-muted-foreground">
                  You can turn on your camera and microphone after joining the meeting
                </p>
              </div>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Join Settings</CardTitle>
                <CardDescription>Select your devices before joining</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="name">Your Name</Label>
                  <Input
                    id="name"
                    placeholder="Enter your name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    onKeyPress={(e) => e.key === "Enter" && handleJoin()}
                    data-testid="input-participant-name"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="microphone">Microphone</Label>
                  <Select
                    value={selectedAudioInput}
                    onValueChange={setAudioDevice}
                  >
                    <SelectTrigger id="microphone" data-testid="select-microphone">
                      <SelectValue placeholder="Select microphone" />
                    </SelectTrigger>
                    <SelectContent>
                      {audioInputs
                        .filter((device) => device.deviceId && device.deviceId.length > 0)
                        .map((device) => (
                          <SelectItem key={device.deviceId} value={device.deviceId}>
                            {device.label || `Microphone ${device.deviceId.slice(0, 8)}`}
                          </SelectItem>
                        ))}
                      {audioInputs.filter((d) => d.deviceId).length === 0 && (
                        <SelectItem value="default" disabled>
                          No microphones found
                        </SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="camera">Camera</Label>
                  <Select
                    value={selectedVideoInput}
                    onValueChange={setVideoDevice}
                  >
                    <SelectTrigger id="camera" data-testid="select-camera">
                      <SelectValue placeholder="Select camera" />
                    </SelectTrigger>
                    <SelectContent>
                      {videoInputs
                        .filter((device) => device.deviceId && device.deviceId.length > 0)
                        .map((device) => (
                          <SelectItem key={device.deviceId} value={device.deviceId}>
                            {device.label || `Camera ${device.deviceId.slice(0, 8)}`}
                          </SelectItem>
                        ))}
                      {videoInputs.filter((d) => d.deviceId).length === 0 && (
                        <SelectItem value="default" disabled>
                          No cameras found
                        </SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                </div>

                <Button
                  className="w-full"
                  size="lg"
                  onClick={handleJoin}
                  disabled={!name.trim()}
                  data-testid="button-join-now"
                >
                  Join Now
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
