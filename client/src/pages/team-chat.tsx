import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { MessageSquare, Users, Hash, Search } from "lucide-react";
import { motion } from "framer-motion";

export default function TeamChatPage() {
  return (
    <DashboardShell>
      <div className="flex-1 flex">
        <div className="flex-1 flex flex-col items-center justify-center p-4 sm:p-6">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center space-y-4 max-w-md"
          >
            <div className="w-16 sm:w-20 h-16 sm:h-20 rounded-2xl bg-primary/20 flex items-center justify-center mx-auto">
              <MessageSquare className="w-8 sm:w-10 h-8 sm:h-10 text-primary" />
            </div>
            <h1 className="text-xl sm:text-2xl font-bold">Team Chat</h1>
            <p className="text-muted-foreground">
              Stay connected with your team. Send messages, share files, and collaborate in real-time.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-4 pt-4">
              <div className="flex items-center gap-2 px-3 sm:px-4 py-2 bg-secondary/30 rounded-lg">
                <Hash className="w-4 h-4 text-muted-foreground" />
                <span className="text-xs sm:text-sm">Channels</span>
              </div>
              <div className="flex items-center gap-2 px-3 sm:px-4 py-2 bg-secondary/30 rounded-lg">
                <Users className="w-4 h-4 text-muted-foreground" />
                <span className="text-xs sm:text-sm">Direct Messages</span>
              </div>
            </div>
            <p className="text-xs text-muted-foreground pt-4">
              Select a channel or conversation from the sidebar to get started.
            </p>
          </motion.div>
        </div>
      </div>
    </DashboardShell>
  );
}
