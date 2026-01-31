import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { UpcomingMeetings } from "@/components/dashboard/UpcomingMeetings";
import { Video, Clock, Calendar, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";

interface Meeting {
  id: number;
  title: string;
  scheduledAt: string;
  duration: number;
  roomId: string;
}

export default function MeetingsPage() {
  const [, navigate] = useLocation();
  
  const { data: meetings = [] } = useQuery<Meeting[]>({
    queryKey: ["/api/meetings"],
    queryFn: async () => {
      const res = await fetch("/api/meetings");
      if (!res.ok) return [];
      return res.json();
    },
  });

  const { data: todayMeetings = [] } = useQuery<Meeting[]>({
    queryKey: ["/api/meetings/today"],
    queryFn: async () => {
      const res = await fetch("/api/meetings/today");
      if (!res.ok) return [];
      return res.json();
    },
  });

  const totalMinutes = meetings.reduce((acc, m) => acc + m.duration, 0);
  const hours = (totalMinutes / 60).toFixed(1);

  return (
    <DashboardShell>
      <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col sm:flex-row sm:items-center justify-between gap-3"
        >
          <div>
            <h1 className="text-xl sm:text-2xl font-bold">Meetings</h1>
            <p className="text-sm sm:text-base text-muted-foreground">View and manage your scheduled meetings</p>
          </div>
          <Button className="gap-2 w-full sm:w-auto" onClick={() => navigate("/scheduler")}>
            <Plus className="w-4 h-4" />
            <span className="sm:inline">Schedule Meeting</span>
          </Button>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-secondary/20 rounded-xl border border-white/5 p-4 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center">
              <Video className="w-6 h-6 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold">{meetings.length}</p>
              <p className="text-sm text-muted-foreground">Upcoming meetings</p>
            </div>
          </div>
          <div className="bg-secondary/20 rounded-xl border border-white/5 p-4 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-blue-500/20 flex items-center justify-center">
              <Clock className="w-6 h-6 text-blue-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{hours}h</p>
              <p className="text-sm text-muted-foreground">Total scheduled time</p>
            </div>
          </div>
          <div className="bg-secondary/20 rounded-xl border border-white/5 p-4 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-emerald-500/20 flex items-center justify-center">
              <Calendar className="w-6 h-6 text-emerald-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{todayMeetings.length}</p>
              <p className="text-sm text-muted-foreground">Scheduled today</p>
            </div>
          </div>
        </div>

        <UpcomingMeetings />
      </div>
    </DashboardShell>
  );
}
