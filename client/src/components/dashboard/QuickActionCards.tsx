import { Video, Plus, Calendar, ArrowUpRight } from "lucide-react";
import { useState } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { NewMeetingDialog } from "./NewMeetingDialog";

interface QuickAction {
  id: string;
  title: string;
  description: string;
  icon: React.ElementType;
  color: string;
  action: () => void;
}

export function QuickActionCards() {
  const [, setLocation] = useLocation();
  const [showNewMeetingDialog, setShowNewMeetingDialog] = useState(false);

  const openNewMeetingDialog = () => {
    setShowNewMeetingDialog(true);
  };

  const joinMeeting = () => {
    setLocation("/join");
  };

  const scheduleMeeting = () => {
    setLocation("/scheduler");
  };

  const quickActions: QuickAction[] = [
    {
      id: "new-meeting",
      title: "New Meeting",
      description: "Configure and start",
      icon: Video,
      color: "from-primary to-purple-600",
      action: openNewMeetingDialog,
    },
    {
      id: "join",
      title: "Join",
      description: "Join with a code",
      icon: Plus,
      color: "from-blue-500 to-cyan-500",
      action: joinMeeting,
    },
    {
      id: "schedule",
      title: "Schedule",
      description: "Plan a meeting",
      icon: Calendar,
      color: "from-orange-500 to-amber-500",
      action: scheduleMeeting,
    },
    {
      id: "share-screen",
      title: "Share Screen",
      description: "Share only",
      icon: ArrowUpRight,
      color: "from-emerald-500 to-green-500",
      action: openNewMeetingDialog,
    },
  ];

  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        {quickActions.map((action, index) => {
          const Icon = action.icon;
          return (
            <motion.button
              key={action.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              onClick={action.action}
              className="group flex flex-col items-center justify-center gap-2 sm:gap-3 p-4 sm:p-6 rounded-xl sm:rounded-2xl bg-secondary/30 border border-white/5 hover:border-primary/30 hover:bg-secondary/50 transition-all hover:-translate-y-1"
            >
              <div className={`w-12 h-12 sm:w-14 sm:h-14 rounded-xl sm:rounded-2xl bg-gradient-to-br ${action.color} flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform`}>
                <Icon className="w-6 h-6 sm:w-7 sm:h-7 text-white" />
              </div>
              <div className="text-center">
                <h3 className="text-sm sm:text-base font-semibold text-foreground">{action.title}</h3>
                <p className="text-[10px] sm:text-xs text-muted-foreground hidden sm:block">{action.description}</p>
              </div>
            </motion.button>
          );
        })}
      </div>
      
      <NewMeetingDialog 
        open={showNewMeetingDialog} 
        onOpenChange={setShowNewMeetingDialog} 
      />
    </>
  );
}
