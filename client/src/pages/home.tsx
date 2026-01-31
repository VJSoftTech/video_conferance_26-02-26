import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { QuickActionCards } from "@/components/dashboard/QuickActionCards";
import { CalendarWidget } from "@/components/dashboard/CalendarWidget";
import { UpcomingMeetings } from "@/components/dashboard/UpcomingMeetings";
import { RecentActivity } from "@/components/dashboard/RecentActivity";
import { useAuth } from "@/hooks/use-auth";
import { motion } from "framer-motion";

export default function Home() {
  const { user } = useAuth();

  const greeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";
    return "Good evening";
  };

  return (
    <DashboardShell>
      <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-1"
        >
          <h1 className="text-xl sm:text-2xl font-bold">
            {greeting()}, {user?.name || 'there'}!
          </h1>
          <p className="text-sm sm:text-base text-muted-foreground">
            Ready to connect? Start or schedule a meeting below.
          </p>
        </motion.div>

        <QuickActionCards />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
          <div className="lg:col-span-2 space-y-4 sm:space-y-6">
            <UpcomingMeetings />
            <RecentActivity />
          </div>
          <div>
            <CalendarWidget />
          </div>
        </div>
      </div>
    </DashboardShell>
  );
}
