import { Video, Clock, Users, MoreVertical, Play, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { format, formatDistanceToNow } from "date-fns";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";

interface Meeting {
  id: number;
  title: string;
  scheduledAt: string;
  duration: number;
  roomId: string;
  description?: string;
  endedAt?: string | null;
}

export function UpcomingMeetings() {
  const [, navigate] = useLocation();
  
  const { data: meetings = [], isLoading } = useQuery<Meeting[]>({
    queryKey: ["/api/meetings"],
    queryFn: async () => {
      const res = await fetch("/api/meetings");
      if (!res.ok) return [];
      return res.json();
    },
  });

  const handleJoinMeeting = (roomId: string) => {
    navigate(`/room/${roomId}/join`);
  };

  if (isLoading) {
    return (
      <div className="bg-secondary/20 rounded-2xl border border-white/5 overflow-hidden">
        <div className="p-4 border-b border-white/5">
          <h2 className="font-semibold text-lg">Upcoming Meetings</h2>
        </div>
        <div className="p-8 text-center">
          <div className="animate-pulse space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-16 bg-secondary/30 rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-secondary/20 rounded-2xl border border-white/5 overflow-hidden">
      <div className="p-4 border-b border-white/5 flex items-center justify-between">
        <h2 className="font-semibold text-lg">Upcoming Meetings</h2>
        <Button variant="ghost" size="sm" className="text-xs" onClick={() => navigate("/meetings")}>
          View All
        </Button>
      </div>

      {meetings.length === 0 ? (
        <div className="p-8 text-center">
          <Calendar className="w-12 h-12 mx-auto mb-3 text-muted-foreground/50" />
          <p className="text-muted-foreground">No upcoming meetings</p>
          <p className="text-xs text-muted-foreground/70 mt-1">
            Schedule a meeting to see it here
          </p>
        </div>
      ) : (
        <div className="divide-y divide-white/5">
          {meetings.slice(0, 4).map((meeting, index) => {
            const scheduledDate = new Date(meeting.scheduledAt);
            const hasEnded = !!meeting.endedAt;
            const isLive = !hasEnded && scheduledDate <= new Date() && 
              new Date() <= new Date(scheduledDate.getTime() + meeting.duration * 60000);
            
            return (
              <motion.div
                key={meeting.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
                className="p-4 hover:bg-secondary/30 transition-colors"
              >
                <div className="flex items-start gap-4">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                    isLive ? 'bg-red-500/20 text-red-500' : 'bg-primary/20 text-primary'
                  }`}>
                    {isLive ? <Play className="w-5 h-5 fill-current" /> : <Video className="w-5 h-5" />}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium truncate">{meeting.title}</h3>
                      {hasEnded ? (
                        <span className="px-2 py-0.5 bg-gray-500 text-white text-[10px] font-bold rounded-full uppercase">
                          Ended
                        </span>
                      ) : isLive && (
                        <span className="px-2 py-0.5 bg-red-500 text-white text-[10px] font-bold rounded-full uppercase">
                          Live
                        </span>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        <span>{format(scheduledDate, 'h:mm a')}</span>
                        <span className="text-muted-foreground/50">•</span>
                        <span>{meeting.duration} min</span>
                      </div>
                    </div>

                    <p className="text-xs text-primary mt-1">
                      {formatDistanceToNow(scheduledDate, { addSuffix: true })}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button size="sm" className="h-8" onClick={() => handleJoinMeeting(meeting.roomId)}>
                      {hasEnded ? 'Rejoin' : 'Join'}
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <MoreVertical className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
