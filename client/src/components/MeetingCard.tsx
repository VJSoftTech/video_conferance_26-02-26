import { useState } from "react";
import { useLocation } from "wouter";
import { useLiveKitStatus } from "@/hooks/use-rooms";
import { 
  Video, 
  VideoOff,
  Users, 
  Loader2, 
  ArrowRight, 
  AlertCircle, 
  Plus, 
  Link2, 
  Mic, 
  MicOff,
  Lock,
  ChevronDown,
  Copy,
  Check,
  MessageSquare
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useToast } from "@/hooks/use-toast";
import { v4 as uuidv4 } from "uuid";
import { Switch } from "@/components/ui/switch";

type MeetingMode = "new" | "join";

interface MeetingSettings {
  topic: string;
  startWithVideo: boolean;
  startWithAudio: boolean;
  enablePasscode: boolean;
  passcode: string;
  enableWaitingRoom: boolean;
  enableChat: boolean;
}

const generatePasscode = () => {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
};

export function MeetingCard() {
  const [mode, setMode] = useState<MeetingMode>("new");
  const [roomName, setRoomName] = useState("");
  const [participantName, setParticipantName] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  
  const [settings, setSettings] = useState<MeetingSettings>({
    topic: "",
    startWithVideo: true,
    startWithAudio: true,
    enablePasscode: false,
    passcode: generatePasscode(),
    enableWaitingRoom: false,
    enableChat: true,
  });

  const { data: status, isLoading: isStatusLoading } = useLiveKitStatus();
  const isConfigured = status?.configured ?? false;

  const updateSetting = <K extends keyof MeetingSettings>(key: K, value: MeetingSettings[K]) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  const handleNewMeeting = () => {
    if (!participantName.trim()) {
      toast({
        title: "Enter your name",
        description: "Please enter your display name to start the meeting.",
        variant: "destructive",
      });
      return;
    }

    if (isCreating) return;

    setIsCreating(true);
    try {
      const meetingId = settings.topic.trim() 
        ? settings.topic.trim().toLowerCase().replace(/\s+/g, '-').substring(0, 30)
        : uuidv4().slice(0, 8);
      const encodedRoom = encodeURIComponent(meetingId);
      const encodedUser = encodeURIComponent(participantName);
      
      const params = new URLSearchParams();
      params.set('user', participantName);
      params.set('video', settings.startWithVideo ? '1' : '0');
      params.set('audio', settings.startWithAudio ? '1' : '0');
      if (settings.enablePasscode) {
        params.set('passcode', settings.passcode);
      }
      if (settings.enableWaitingRoom) {
        params.set('waiting', '1');
      }
      params.set('chat', settings.enableChat ? '1' : '0');
      
      setLocation(`/room/${encodedRoom}?${params.toString()}`);
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to create meeting",
        variant: "destructive",
      });
    } finally {
      setIsCreating(false);
    }
  };

  const handleJoinMeeting = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!roomName.trim() || !participantName.trim()) {
      toast({
        title: "Missing fields",
        description: "Please enter both a room name/ID and your name.",
        variant: "destructive",
      });
      return;
    }

    const encodedRoom = encodeURIComponent(roomName);
    const params = new URLSearchParams();
    params.set('user', participantName);
    params.set('video', settings.startWithVideo ? '1' : '0');
    params.set('audio', settings.startWithAudio ? '1' : '0');
    setLocation(`/room/${encodedRoom}?${params.toString()}`);
  };

  const copyMeetingLink = () => {
    const meetingId = settings.topic.trim() 
      ? settings.topic.trim().toLowerCase().replace(/\s+/g, '-').substring(0, 30)
      : 'new-meeting';
    const link = `${window.location.origin}/room/${meetingId}`;
    navigator.clipboard.writeText(link);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
    toast({
      title: "Link copied!",
      description: "Meeting link has been copied to clipboard.",
    });
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="w-full max-w-md"
    >
      <div className="glass-panel rounded-3xl p-6 sm:p-8 relative overflow-hidden group">
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/20 rounded-full blur-[80px] -translate-y-1/2 translate-x-1/2 group-hover:bg-primary/30 transition-colors duration-500 pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-purple-500/20 rounded-full blur-[60px] translate-y-1/3 -translate-x-1/3 group-hover:bg-purple-500/30 transition-colors duration-500 pointer-events-none" />

        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-6">
            <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-primary to-purple-600 flex items-center justify-center shadow-lg shadow-primary/25">
              <Video className="text-white w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-white/70">
                {mode === "new" ? "New Meeting" : "Join Meeting"}
              </h2>
              <p className="text-xs sm:text-sm text-muted-foreground">
                {mode === "new" ? "Start an instant meeting" : "Enter a meeting ID or link"}
              </p>
            </div>
          </div>

          <div className="flex p-1 bg-secondary/50 rounded-xl mb-6">
            <button
              onClick={() => setMode("new")}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg text-sm font-medium transition-all ${
                mode === "new"
                  ? "bg-primary text-white shadow-lg"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Plus className="w-4 h-4" />
              New Meeting
            </button>
            <button
              onClick={() => setMode("join")}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg text-sm font-medium transition-all ${
                mode === "join"
                  ? "bg-primary text-white shadow-lg"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Link2 className="w-4 h-4" />
              Join Meeting
            </button>
          </div>

          <AnimatePresence mode="wait">
            {mode === "new" ? (
              <motion.div
                key="new"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.2 }}
                className="space-y-4"
              >
                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground ml-1">Meeting Topic (optional)</label>
                  <div className="relative">
                    <MessageSquare className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground w-5 h-5" />
                    <input
                      type="text"
                      value={settings.topic}
                      onChange={(e) => updateSetting('topic', e.target.value)}
                      placeholder="e.g. Weekly Standup"
                      className="w-full bg-secondary/50 border border-white/10 rounded-xl py-3 pl-12 pr-4 text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 transition-all"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground ml-1">Your Name</label>
                  <div className="relative">
                    <Users className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground w-5 h-5" />
                    <input
                      type="text"
                      value={participantName}
                      onChange={(e) => setParticipantName(e.target.value)}
                      placeholder="e.g. Alice Smith"
                      className="w-full bg-secondary/50 border border-white/10 rounded-xl py-3 pl-12 pr-4 text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 transition-all"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => updateSetting('startWithVideo', !settings.startWithVideo)}
                    className={`flex items-center justify-center gap-2 py-3 px-4 rounded-xl border transition-all ${
                      settings.startWithVideo
                        ? "bg-primary/20 border-primary/50 text-primary"
                        : "bg-secondary/30 border-white/10 text-muted-foreground"
                    }`}
                  >
                    {settings.startWithVideo ? <Video className="w-4 h-4" /> : <VideoOff className="w-4 h-4" />}
                    <span className="text-sm font-medium">Video {settings.startWithVideo ? "On" : "Off"}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => updateSetting('startWithAudio', !settings.startWithAudio)}
                    className={`flex items-center justify-center gap-2 py-3 px-4 rounded-xl border transition-all ${
                      settings.startWithAudio
                        ? "bg-primary/20 border-primary/50 text-primary"
                        : "bg-secondary/30 border-white/10 text-muted-foreground"
                    }`}
                  >
                    {settings.startWithAudio ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
                    <span className="text-sm font-medium">Audio {settings.startWithAudio ? "On" : "Off"}</span>
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => setShowAdvanced(!showAdvanced)}
                  className="w-full flex items-center justify-between py-2 px-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  <span>Advanced Options</span>
                  <ChevronDown className={`w-4 h-4 transition-transform ${showAdvanced ? 'rotate-180' : ''}`} />
                </button>

                <AnimatePresence>
                  {showAdvanced && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="space-y-3 pb-2">
                        <div className="flex items-center justify-between p-3 bg-secondary/30 rounded-xl">
                          <div className="flex items-center gap-3">
                            <Lock className="w-4 h-4 text-muted-foreground" />
                            <div>
                              <p className="text-sm font-medium">Passcode</p>
                              <p className="text-xs text-muted-foreground">Require code to join</p>
                            </div>
                          </div>
                          <Switch
                            checked={settings.enablePasscode}
                            onCheckedChange={(checked) => updateSetting('enablePasscode', checked)}
                          />
                        </div>
                        
                        {settings.enablePasscode && (
                          <motion.div
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="flex items-center gap-2 px-3"
                          >
                            <span className="text-sm text-muted-foreground">Code:</span>
                            <code className="px-3 py-1.5 bg-secondary/50 rounded-lg text-sm font-mono tracking-wider">
                              {settings.passcode}
                            </code>
                            <button
                              type="button"
                              onClick={() => updateSetting('passcode', generatePasscode())}
                              className="text-xs text-primary hover:underline"
                            >
                              Regenerate
                            </button>
                          </motion.div>
                        )}

                        <div className="flex items-center justify-between p-3 bg-secondary/30 rounded-xl">
                          <div className="flex items-center gap-3">
                            <Users className="w-4 h-4 text-muted-foreground" />
                            <div>
                              <p className="text-sm font-medium">Waiting Room</p>
                              <p className="text-xs text-muted-foreground">Admit participants manually</p>
                            </div>
                          </div>
                          <Switch
                            checked={settings.enableWaitingRoom}
                            onCheckedChange={(checked) => updateSetting('enableWaitingRoom', checked)}
                          />
                        </div>

                        <div className="flex items-center justify-between p-3 bg-secondary/30 rounded-xl">
                          <div className="flex items-center gap-3">
                            <MessageSquare className="w-4 h-4 text-muted-foreground" />
                            <div>
                              <p className="text-sm font-medium">In-Meeting Chat</p>
                              <p className="text-xs text-muted-foreground">Allow participants to chat</p>
                            </div>
                          </div>
                          <Switch
                            checked={settings.enableChat}
                            onCheckedChange={(checked) => updateSetting('enableChat', checked)}
                          />
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                <div className="flex gap-2 pt-2">
                  <button
                    onClick={handleNewMeeting}
                    disabled={isCreating || !participantName || !isConfigured}
                    className="flex-1 py-3.5 rounded-xl font-bold text-base bg-gradient-to-r from-primary to-purple-600 hover:from-primary/90 hover:to-purple-600/90 text-white shadow-xl shadow-primary/20 hover:shadow-2xl hover:shadow-primary/30 hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none transition-all duration-200 flex items-center justify-center gap-2"
                  >
                    {isCreating ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Starting...
                      </>
                    ) : (
                      <>
                        <Plus className="w-5 h-5" />
                        Start Meeting
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={copyMeetingLink}
                    className="p-3.5 rounded-xl bg-secondary/50 border border-white/10 hover:bg-secondary/70 transition-all"
                    title="Copy meeting link"
                  >
                    {copiedLink ? <Check className="w-5 h-5 text-emerald-500" /> : <Copy className="w-5 h-5 text-muted-foreground" />}
                  </button>
                </div>
              </motion.div>
            ) : (
              <motion.form
                key="join"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
                onSubmit={handleJoinMeeting}
                className="space-y-4"
              >
                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground ml-1">Meeting ID or Name</label>
                  <div className="relative">
                    <Video className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground w-5 h-5" />
                    <input
                      type="text"
                      value={roomName}
                      onChange={(e) => setRoomName(e.target.value)}
                      placeholder="e.g. Daily Standup or abc123"
                      className="w-full bg-secondary/50 border border-white/10 rounded-xl py-3 pl-12 pr-4 text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 transition-all"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground ml-1">Your Name</label>
                  <div className="relative">
                    <Users className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground w-5 h-5" />
                    <input
                      type="text"
                      value={participantName}
                      onChange={(e) => setParticipantName(e.target.value)}
                      placeholder="e.g. Alice Smith"
                      className="w-full bg-secondary/50 border border-white/10 rounded-xl py-3 pl-12 pr-4 text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 transition-all"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-1">
                  <button
                    type="button"
                    onClick={() => updateSetting('startWithVideo', !settings.startWithVideo)}
                    className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl border transition-all ${
                      settings.startWithVideo
                        ? "bg-primary/20 border-primary/50 text-primary"
                        : "bg-secondary/30 border-white/10 text-muted-foreground"
                    }`}
                  >
                    {settings.startWithVideo ? <Video className="w-4 h-4" /> : <VideoOff className="w-4 h-4" />}
                    <span className="text-sm font-medium">Video {settings.startWithVideo ? "On" : "Off"}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => updateSetting('startWithAudio', !settings.startWithAudio)}
                    className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl border transition-all ${
                      settings.startWithAudio
                        ? "bg-primary/20 border-primary/50 text-primary"
                        : "bg-secondary/30 border-white/10 text-muted-foreground"
                    }`}
                  >
                    {settings.startWithAudio ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
                    <span className="text-sm font-medium">Audio {settings.startWithAudio ? "On" : "Off"}</span>
                  </button>
                </div>

                <button
                  type="submit"
                  disabled={!roomName || !participantName || !isConfigured}
                  className="w-full mt-2 py-3.5 rounded-xl font-bold text-base bg-gradient-to-r from-primary to-purple-600 hover:from-primary/90 hover:to-purple-600/90 text-white shadow-xl shadow-primary/20 hover:shadow-2xl hover:shadow-primary/30 hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none transition-all duration-200 flex items-center justify-center gap-2 group/btn"
                >
                  Join Room
                  <ArrowRight className="w-5 h-5 group-hover/btn:translate-x-1 transition-transform" />
                </button>
              </motion.form>
            )}
          </AnimatePresence>

          {!isStatusLoading && !isConfigured && (
            <div className="mt-6 p-4 rounded-xl bg-destructive/10 border border-destructive/20 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
              <div className="text-sm text-destructive-foreground">
                <p className="font-semibold">Configuration Missing</p>
                <p className="opacity-90 mt-1">
                  LiveKit API keys are not configured. Video calls will not work.
                </p>
              </div>
            </div>
          )}
          
          {status?.url === "configured" && (
            <div className="mt-4 flex items-center justify-center gap-2 text-xs text-muted-foreground/50">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              Connected to LiveKit Server
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
