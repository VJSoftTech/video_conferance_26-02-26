import { useState } from "react";
import { useLocation } from "wouter";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { Video, Users, ArrowRight, ArrowLeft, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { motion } from "framer-motion";

export default function JoinMeeting() {
  const [roomName, setRoomName] = useState("");
  const [participantName, setParticipantName] = useState(() => 
    sessionStorage.getItem("participantName") || ""
  );
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!roomName.trim() || !participantName.trim()) {
      toast({
        title: "Missing fields",
        description: "Please enter both a meeting ID and your name.",
        variant: "destructive",
      });
      return;
    }

    sessionStorage.setItem("participantName", participantName);
    sessionStorage.setItem("videoEnabled", "false");
    sessionStorage.setItem("audioEnabled", "false");

    const params = new URLSearchParams();
    params.set('user', participantName);
    params.set('video', '0');
    params.set('audio', '0');
    
    setLocation(`/room/${encodeURIComponent(roomName)}?${params.toString()}`);
  };

  return (
    <DashboardShell showSidebar={false}>
      <div className="min-h-[calc(100vh-3.5rem)] flex items-center justify-center p-6">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-md"
        >
          <Button 
            variant="ghost" 
            className="mb-6"
            onClick={() => setLocation("/")}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Button>

          <div className="bg-secondary/20 rounded-2xl border border-white/5 p-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center">
                <Video className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold">Join Meeting</h1>
                <p className="text-sm text-muted-foreground">Enter a meeting ID to join</p>
              </div>
            </div>

            <form onSubmit={handleJoin} className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">Meeting ID or Link</label>
                <div className="relative">
                  <Video className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground w-5 h-5" />
                  <input
                    type="text"
                    value={roomName}
                    onChange={(e) => setRoomName(e.target.value)}
                    placeholder="e.g. team-standup or abc123"
                    className="w-full bg-secondary/50 border border-white/10 rounded-xl py-3 pl-12 pr-4 text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/50"
                    autoFocus
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">Your Name</label>
                <div className="relative">
                  <Users className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground w-5 h-5" />
                  <input
                    type="text"
                    value={participantName}
                    onChange={(e) => setParticipantName(e.target.value)}
                    placeholder="e.g. Alice Smith"
                    className="w-full bg-secondary/50 border border-white/10 rounded-xl py-3 pl-12 pr-4 text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/50"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50 border border-border">
                <Info className="w-4 h-4 text-primary flex-shrink-0" />
                <p className="text-xs text-muted-foreground">
                  You can turn on your camera and microphone after joining
                </p>
              </div>

              <Button
                type="submit"
                className="w-full mt-4 py-6 text-lg"
                disabled={!roomName || !participantName}
              >
                Join Meeting
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            </form>
          </div>
        </motion.div>
      </div>
    </DashboardShell>
  );
}
