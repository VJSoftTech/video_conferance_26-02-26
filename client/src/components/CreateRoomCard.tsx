import { useState } from "react";
import { useLocation } from "wouter";
import { useLiveKitToken, useLiveKitStatus } from "@/hooks/use-rooms";
import { Video, Users, Loader2, ArrowRight, AlertCircle } from "lucide-react";
import { motion } from "framer-motion";
import { useToast } from "@/hooks/use-toast";

export function CreateRoomCard() {
  const [roomName, setRoomName] = useState("");
  const [participantName, setParticipantName] = useState("");
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  
  const { data: status, isLoading: isStatusLoading } = useLiveKitStatus();
  const { mutateAsync: getToken, isPending } = useLiveKitToken();

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!roomName.trim() || !participantName.trim()) {
      toast({
        title: "Missing fields",
        description: "Please enter both a room name and your name.",
        variant: "destructive",
      });
      return;
    }

    try {
      // We don't actually need to get the token here if we are just redirecting
      // The room page will handle token fetching. 
      // But we can validate connectivity here if we want.
      
      // Navigate to the room
      const encodedRoom = encodeURIComponent(roomName);
      const encodedUser = encodeURIComponent(participantName);
      setLocation(`/room/${encodedRoom}?user=${encodedUser}`);
      
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to join room",
        variant: "destructive",
      });
    }
  };

  const isConfigured = status?.configured ?? false;

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="w-full max-w-md"
    >
      <div className="glass-panel rounded-3xl p-8 relative overflow-hidden group">
        {/* Abstract background blobs */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/20 rounded-full blur-[80px] -translate-y-1/2 translate-x-1/2 group-hover:bg-primary/30 transition-colors duration-500 pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-purple-500/20 rounded-full blur-[60px] translate-y-1/3 -translate-x-1/3 group-hover:bg-purple-500/30 transition-colors duration-500 pointer-events-none" />

        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-6">
            <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-primary to-purple-600 flex items-center justify-center shadow-lg shadow-primary/25">
              <Video className="text-white w-6 h-6" />
            </div>
            <div>
              <h2 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-white/70">
                Join Meeting
              </h2>
              <p className="text-sm text-muted-foreground">Start or join a secure call</p>
            </div>
          </div>

          <form onSubmit={handleJoin} className="space-y-5">
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground ml-1">Room Name</label>
              <div className="relative">
                <Video className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground w-5 h-5" />
                <input
                  type="text"
                  value={roomName}
                  onChange={(e) => setRoomName(e.target.value)}
                  placeholder="e.g. Daily Standup"
                  className="w-full bg-secondary/50 border border-white/10 rounded-xl py-3.5 pl-12 pr-4 text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 transition-all"
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
                  className="w-full bg-secondary/50 border border-white/10 rounded-xl py-3.5 pl-12 pr-4 text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 transition-all"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isPending || !roomName || !participantName || !isConfigured}
              className="w-full mt-6 py-4 rounded-xl font-bold text-lg bg-gradient-to-r from-primary to-purple-600 hover:from-primary/90 hover:to-purple-600/90 text-white shadow-xl shadow-primary/20 hover:shadow-2xl hover:shadow-primary/30 hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none transition-all duration-200 flex items-center justify-center gap-2 group/btn"
            >
              {isPending ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Connecting...
                </>
              ) : (
                <>
                  Join Room
                  <ArrowRight className="w-5 h-5 group-hover/btn:translate-x-1 transition-transform" />
                </>
              )}
            </button>
          </form>

          {!isStatusLoading && !isConfigured && (
            <div className="mt-6 p-4 rounded-xl bg-destructive/10 border border-destructive/20 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
              <div className="text-sm text-destructive-foreground">
                <p className="font-semibold">Configuration Missing</p>
                <p className="opacity-90 mt-1">
                  LiveKit API keys are not configured in the server environment. Video calls will not work.
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
