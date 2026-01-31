import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { v4 as uuidv4 } from "uuid";
import { Video, Lock, Users, Copy, Check, Eye, EyeOff, Sparkles, Link2, UserPlus, Clock } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

interface NewMeetingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function NewMeetingDialog({ open, onOpenChange }: NewMeetingDialogProps) {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [title, setTitle] = useState("My Meeting");
  const [passcode, setPasscode] = useState("");
  const [usePasscode, setUsePasscode] = useState(false);
  const [waitingRoom, setWaitingRoom] = useState(false);
  const [maxParticipants, setMaxParticipants] = useState(100);
  const [showPasscode, setShowPasscode] = useState(false);
  const [copied, setCopied] = useState(false);
  const [roomId, setRoomId] = useState(() => uuidv4().slice(0, 8));
  const [duration, setDuration] = useState(60);
  
  useEffect(() => {
    if (open) {
      setRoomId(uuidv4().slice(0, 8));
      setCopied(false);
    }
  }, [open]);
  
  const meetingLink = typeof window !== "undefined" 
    ? `${window.location.origin}/room/${roomId}/join`
    : `/room/${roomId}/join`;

  const createMeetingMutation = useMutation({
    mutationFn: async (data: {
      title: string;
      roomId: string;
      passcode?: string;
      waitingRoom: boolean;
      maxParticipants: number;
      scheduledAt: string;
      duration: number;
    }) => {
      const res = await fetch("/api/meetings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to create meeting");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/meetings"] });
    },
  });

  const handleStartMeeting = async () => {
    try {
      const meeting = await createMeetingMutation.mutateAsync({
        title,
        roomId,
        passcode: usePasscode ? passcode : undefined,
        waitingRoom,
        maxParticipants,
        scheduledAt: new Date().toISOString(),
        duration,
      });
      
      const name = sessionStorage.getItem("participantName") || "Host";
      sessionStorage.setItem("participantName", name);
      sessionStorage.setItem("videoEnabled", "false");
      sessionStorage.setItem("audioEnabled", "false");
      
      if (usePasscode && passcode) {
        sessionStorage.setItem(`meeting_passcode_${roomId}`, passcode);
      }
      
      onOpenChange(false);
      setLocation(`/room/${meeting.roomId}/join?host=${meeting.hostToken}`);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to create meeting. Please try again.",
        variant: "destructive",
      });
    }
  };

  const generatePasscode = () => {
    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
    setPasscode(code);
  };

  const copyLink = () => {
    navigator.clipboard.writeText(meetingLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast({
      title: "Link copied",
      description: "Meeting link copied to clipboard",
      duration: 1300,
    });
  };

  const handleClose = () => {
    setTitle("My Meeting");
    setPasscode("");
    setUsePasscode(false);
    setWaitingRoom(false);
    setDuration(60);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="w-[calc(100%-2rem)] max-w-sm mx-auto !bg-[#1a1f2e] border-white/10 shadow-2xl rounded-xl">
        <DialogHeader className="pb-2">
          <DialogTitle className="flex items-center gap-3 text-white">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center shadow-lg shadow-primary/25 shrink-0">
              <Video className="w-4 h-4 text-white" />
            </div>
            New Meeting
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="meeting-title" className="text-xs font-medium text-gray-400">
              Meeting Title
            </Label>
            <Input
              id="meeting-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter meeting title"
              className="h-9 bg-[#0d1117] border-white/10 text-white placeholder:text-gray-500 focus:border-primary/50 focus:ring-primary/20"
            />
          </div>

          <div className="flex items-center justify-between gap-2 p-2.5 bg-[#0d1117] border border-white/10 rounded-lg">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded bg-cyan-500/20 flex items-center justify-center shrink-0">
                <Clock className="w-3.5 h-3.5 text-cyan-400" />
              </div>
              <span className="text-sm text-white">Duration</span>
            </div>
            <select
              value={duration}
              onChange={(e) => setDuration(Number(e.target.value))}
              className="h-7 px-2 text-xs bg-[#0d1117] border border-white/10 rounded text-white focus:outline-none focus:ring-1 focus:ring-primary/50"
            >
              <option value={15}>15 min</option>
              <option value={30}>30 min</option>
              <option value={45}>45 min</option>
              <option value={60}>60 min</option>
              <option value={90}>90 min</option>
              <option value={120}>2 hours</option>
            </select>
          </div>

          <div className="flex items-center justify-between gap-2 p-2.5 bg-[#0d1117] border border-white/10 rounded-lg">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <div className="w-7 h-7 rounded bg-primary/20 flex items-center justify-center shrink-0">
                <Link2 className="w-3.5 h-3.5 text-primary" />
              </div>
              <span className="text-xs text-gray-400 truncate font-mono">
                .../{roomId}/join
              </span>
            </div>
            <Button 
              variant="ghost" 
              size="sm"
              onClick={copyLink}
              className="h-7 px-2 text-xs text-gray-300 hover:text-white hover:bg-white/10"
            >
              {copied ? <><Check className="w-3 h-3 mr-1 text-green-400" />Copied</> : <><Copy className="w-3 h-3 mr-1" />Copy</>}
            </Button>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2 p-2.5 bg-[#0d1117] border border-white/10 rounded-lg">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded bg-amber-500/20 flex items-center justify-center shrink-0">
                  <Lock className="w-3.5 h-3.5 text-amber-400" />
                </div>
                <span className="text-sm text-white">Passcode</span>
              </div>
              <Switch
                className="shrink-0"
                checked={usePasscode}
                onCheckedChange={(checked) => {
                  setUsePasscode(checked);
                  if (checked && !passcode) {
                    generatePasscode();
                  }
                }}
              />
            </div>

            {usePasscode && (
              <div className="flex gap-2 pl-9">
                <div className="relative flex-1">
                  <Input
                    type={showPasscode ? "text" : "password"}
                    value={passcode}
                    onChange={(e) => setPasscode(e.target.value.toUpperCase())}
                    placeholder="Passcode"
                    className="h-8 bg-[#0d1117] border-white/10 text-white placeholder:text-gray-500 pr-8 font-mono text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPasscode(!showPasscode)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
                  >
                    {showPasscode ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={generatePasscode}
                  className="h-8 px-2 text-xs border-white/10 hover:bg-white/10"
                  title="Generate random passcode"
                >
                  <Sparkles className="w-3 h-3 mr-1" />
                  New
                </Button>
              </div>
            )}

            <div className="flex items-center justify-between gap-2 p-2.5 bg-[#0d1117] border border-white/10 rounded-lg">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded bg-blue-500/20 flex items-center justify-center shrink-0">
                  <Users className="w-3.5 h-3.5 text-blue-400" />
                </div>
                <span className="text-sm text-white">Waiting Room</span>
              </div>
              <Switch
                className="shrink-0"
                checked={waitingRoom}
                onCheckedChange={setWaitingRoom}
              />
            </div>

            <div className="flex items-center justify-between gap-2 p-2.5 bg-[#0d1117] border border-white/10 rounded-lg">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded bg-green-500/20 flex items-center justify-center shrink-0">
                  <UserPlus className="w-3.5 h-3.5 text-green-400" />
                </div>
                <span className="text-sm text-white">Max Participants</span>
              </div>
              <select
                value={maxParticipants}
                onChange={(e) => setMaxParticipants(Number(e.target.value))}
                className="h-7 px-2 text-xs bg-[#0d1117] border border-white/10 rounded text-white focus:outline-none focus:ring-1 focus:ring-primary/50"
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
                <option value={250}>250</option>
                <option value={500}>500</option>
              </select>
            </div>
          </div>
        </div>

        <div className="flex gap-2 pt-2">
          <Button 
            variant="outline" 
            size="sm"
            className="flex-1 h-9 border-white/10 bg-transparent hover:bg-white/5 text-gray-300" 
            onClick={handleClose}
          >
            Cancel
          </Button>
          <Button 
            size="sm"
            className="flex-1 h-9 gap-1.5 bg-primary hover:bg-primary/90" 
            onClick={handleStartMeeting}
            disabled={createMeetingMutation.isPending || !title.trim()}
          >
            <Video className="w-3.5 h-3.5" />
            {createMeetingMutation.isPending ? "Starting..." : "Start"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
