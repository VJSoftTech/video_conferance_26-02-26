import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { FileText, Presentation, Film, CheckSquare, StickyNote, Mail, Puzzle, Users } from "lucide-react";
import { motion } from "framer-motion";
import { useLocation } from "wouter";

const moreFeatures = [
  { id: "docs", label: "Docs", icon: FileText, description: "Documents shared in meetings", badge: "NEW", color: "from-blue-500 to-cyan-500", route: "/docs" },
  { id: "whiteboards", label: "Whiteboards", icon: Presentation, description: "Visual collaboration boards", color: "from-emerald-500 to-green-500", route: null },
  { id: "clips", label: "Clips", icon: Film, description: "Short video messages", color: "from-pink-500 to-rose-500", route: null },
  { id: "tasks", label: "Tasks", icon: CheckSquare, description: "Action items from meetings", badge: "NEW", color: "from-orange-500 to-amber-500", route: "/tasks" },
  { id: "notes", label: "Notes", icon: StickyNote, description: "Quick notes and ideas", color: "from-yellow-500 to-lime-500", route: "/notes" },
  { id: "mail", label: "Mail", icon: Mail, description: "Meeting invites", badge: "NEW", color: "from-purple-500 to-violet-500", route: "/mail" },
  { id: "apps", label: "Apps", icon: Puzzle, description: "Connect your tools", color: "from-indigo-500 to-blue-500", route: null },
  { id: "contacts", label: "Contacts", icon: Users, description: "Your meeting network", color: "from-teal-500 to-cyan-500", route: "/contacts" },
];

export default function MorePage() {
  const [, navigate] = useLocation();

  const handleClick = (route: string | null) => {
    if (route) {
      navigate(route);
    }
  };

  return (
    <DashboardShell>
      <div className="p-6 space-y-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <h1 className="text-2xl font-bold">More Features</h1>
          <p className="text-muted-foreground">Explore additional tools to enhance your workflow</p>
        </motion.div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {moreFeatures.map((feature, index) => {
            const Icon = feature.icon;
            const isClickable = feature.route !== null;
            
            return (
              <motion.button
                key={feature.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                onClick={() => handleClick(feature.route)}
                disabled={!isClickable}
                className={`group relative flex flex-col items-center gap-4 p-6 rounded-2xl bg-secondary/20 border border-white/5 transition-all text-left ${
                  isClickable 
                    ? "hover:border-primary/30 hover:bg-secondary/40 cursor-pointer" 
                    : "opacity-60 cursor-not-allowed"
                }`}
              >
                {feature.badge && (
                  <span className="absolute top-3 right-3 bg-primary text-[10px] text-white px-2 py-0.5 rounded-full font-bold">
                    {feature.badge}
                  </span>
                )}
                {!isClickable && (
                  <span className="absolute top-3 left-3 bg-secondary text-[10px] text-muted-foreground px-2 py-0.5 rounded-full font-medium">
                    Coming Soon
                  </span>
                )}
                <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${feature.color} flex items-center justify-center shadow-lg ${isClickable ? "group-hover:scale-110" : ""} transition-transform`}>
                  <Icon className="w-7 h-7 text-white" />
                </div>
                <div className="text-center">
                  <h3 className="font-semibold">{feature.label}</h3>
                  <p className="text-xs text-muted-foreground mt-1">{feature.description}</p>
                </div>
              </motion.button>
            );
          })}
        </div>

        <div className="bg-secondary/20 rounded-2xl border border-white/5 p-6 text-center">
          <p className="text-muted-foreground">
            Whiteboards, Clips, and Apps are coming soon!
          </p>
        </div>
      </div>
    </DashboardShell>
  );
}
