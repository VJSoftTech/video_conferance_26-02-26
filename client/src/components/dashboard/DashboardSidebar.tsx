import { 
  AtSign, 
  MessageCircle, 
  Hash, 
  Users, 
  FolderOpen, 
  Puzzle, 
  MoreHorizontal,
  Plus,
  ChevronDown,
  Video,
  Film
} from "lucide-react";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "wouter";

interface DashboardSidebarProps {
  onClose?: () => void;
}

interface SidebarSection {
  id: string;
  label: string;
  icon: React.ElementType;
  items?: { id: string; name: string }[];
  collapsible?: boolean;
  route?: string;
}

const sidebarSections: SidebarSection[] = [
  { id: "mentions", label: "Mentions", icon: AtSign },
  { id: "dms", label: "DMs", icon: MessageCircle, items: [], collapsible: true },
  { 
    id: "channels", 
    label: "Channels", 
    icon: Hash, 
    items: [],
    collapsible: true 
  },
  { 
    id: "meeting-chats", 
    label: "Meeting Chats", 
    icon: Video,
    items: [],
    collapsible: true 
  },
  { 
    id: "shared-spaces", 
    label: "Shared Spaces", 
    icon: FolderOpen,
    items: [],
    collapsible: true 
  },
  { id: "recordings", label: "Recordings", icon: Film, route: "/recordings" },
  { id: "apps", label: "Apps", icon: Puzzle },
  { id: "more", label: "More", icon: MoreHorizontal, route: "/more" },
];

export function DashboardSidebar({ onClose }: DashboardSidebarProps = {}) {
  const [expandedSections, setExpandedSections] = useState<string[]>(["channels", "meeting-chats"]);
  const [activeItem, setActiveItem] = useState<string | null>(null);
  const [, navigate] = useLocation();

  const toggleSection = (id: string) => {
    setExpandedSections(prev => 
      prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]
    );
  };

  const handleSectionClick = (section: SidebarSection) => {
    if (section.route) {
      navigate(section.route);
      onClose?.();
    } else if (section.collapsible) {
      toggleSection(section.id);
    } else {
      setActiveItem(section.id);
    }
  };

  return (
    <aside className="w-60 border-r border-border/50 bg-background/50 flex flex-col h-[calc(100vh-3.5rem)] overflow-hidden">
      <div className="p-3 border-b border-border/30">
        <button className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground font-medium transition-colors">
          <Plus className="w-4 h-4" />
          <span className="text-sm">New Message</span>
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto py-2">
        {sidebarSections.map((section) => {
          const Icon = section.icon;
          const isExpanded = expandedSections.includes(section.id);
          const hasItems = section.items && section.items.length > 0;

          return (
            <div key={section.id} className="mb-1">
              <button
                onClick={() => handleSectionClick(section)}
                className={`w-full flex items-center gap-3 px-4 py-2 text-sm transition-colors ${
                  activeItem === section.id
                    ? "text-primary bg-primary/10"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span className="flex-1 text-left">{section.label}</span>
                {section.collapsible && (
                  <ChevronDown className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                )}
              </button>

              <AnimatePresence>
                {section.collapsible && isExpanded && hasItems && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    {section.items?.map((item) => (
                      <button
                        key={item.id}
                        onClick={() => setActiveItem(item.id)}
                        className={`w-full flex items-center gap-3 pl-11 pr-4 py-1.5 text-sm transition-colors ${
                          activeItem === item.id
                            ? "text-primary bg-primary/10"
                            : "text-muted-foreground hover:text-foreground hover:bg-secondary/30"
                        }`}
                      >
                        <span className="flex-1 text-left truncate">{item.name}</span>
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>

              {section.collapsible && isExpanded && !hasItems && (
                <div className="pl-11 pr-4 py-2 text-xs text-muted-foreground/50">
                  No items yet
                </div>
              )}
            </div>
          );
        })}
      </nav>

      <div className="p-3 border-t border-border/30">
        <div className="flex items-center gap-2 px-2 text-xs text-muted-foreground">
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span>Online</span>
        </div>
      </div>
    </aside>
  );
}
