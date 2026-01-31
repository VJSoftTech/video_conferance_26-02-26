import { Clock, Activity } from "lucide-react";
import { motion } from "framer-motion";

export function RecentActivity() {
  return (
    <div className="bg-secondary/20 rounded-2xl border border-white/5 overflow-hidden">
      <div className="p-4 border-b border-white/5">
        <h2 className="font-semibold text-lg">Recent Activity</h2>
      </div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="p-8 text-center"
      >
        <Activity className="w-12 h-12 mx-auto mb-3 text-muted-foreground/50" />
        <p className="text-muted-foreground">No recent activity</p>
        <p className="text-xs text-muted-foreground/70 mt-1">
          Your meeting activity will appear here
        </p>
      </motion.div>
    </div>
  );
}
