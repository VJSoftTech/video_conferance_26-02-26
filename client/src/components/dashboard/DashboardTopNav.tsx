import { Video, Home, Users, MessageSquare, Calendar, MoreHorizontal, Settings, Bell, Search } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Link, useLocation } from "wouter";

interface NavTab {
  id: string;
  label: string;
  icon: React.ElementType;
  href: string;
  badge?: string;
}

const navTabs: NavTab[] = [
  { id: "home", label: "Home", icon: Home, href: "/" },
  { id: "meetings", label: "Meetings", icon: Video, href: "/meetings" },
  { id: "chat", label: "Team Chat", icon: MessageSquare, href: "/chat" },
  { id: "scheduler", label: "Scheduler", icon: Calendar, href: "/scheduler" },
  { id: "more", label: "More", icon: MoreHorizontal, href: "/more", badge: "NEW" },
];

interface DashboardTopNavProps {
  isGuest?: boolean;
  children?: React.ReactNode;
}

export function DashboardTopNav({ isGuest = false, children }: DashboardTopNavProps) {
  const [location] = useLocation();
  const auth = useAuth();
  const user = isGuest ? null : auth?.user;
  const logoutMutation = isGuest ? null : auth?.logoutMutation;

  const getActiveTab = () => {
    if (location === "/" || location === "/guest") return "home";
    if (location.startsWith("/meetings")) return "meetings";
    if (location.startsWith("/chat")) return "chat";
    if (location.startsWith("/scheduler")) return "scheduler";
    if (location.startsWith("/more")) return "more";
    return "home";
  };

  const activeTab = getActiveTab();

  return (
    <header className="h-14 border-b border-border/50 bg-background/95 backdrop-blur-xl flex items-center px-4 gap-2 sm:gap-4 sticky top-0 z-50">
      {children}
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
          <Video className="w-5 h-5 text-primary-foreground" />
        </div>
        <span className="text-lg font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary to-primary/60">
          பேசு தமிழ்
        </span>
      </div>

      <div className="relative flex-1 max-w-md hidden md:block">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search meetings, chats, contacts..."
          className="w-full bg-secondary/50 border border-white/10 rounded-lg py-2 pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/50"
        />
      </div>

      <nav className="flex items-center gap-0.5 sm:gap-1">
        {navTabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <Link key={tab.id} href={tab.href}>
              <button
                className={`flex flex-col items-center gap-0.5 px-2 sm:px-3 py-1.5 rounded-lg transition-all relative ${
                  isActive
                    ? "text-primary bg-primary/10"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                }`}
              >
                <Icon className="w-5 h-5" />
                <span className="text-[10px] font-medium hidden sm:block">{tab.label}</span>
                {tab.badge && (
                  <span className="absolute -top-1 -right-1 bg-primary text-[9px] text-white px-1 sm:px-1.5 py-0.5 rounded-full font-bold">
                    {tab.badge}
                  </span>
                )}
              </button>
            </Link>
          );
        })}
      </nav>

      <div className="flex items-center gap-2 ml-auto">
        <Link href="/notifications">
          <Button variant="ghost" size="icon" className="relative">
            <Bell className="w-5 h-5" />
            <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
          </Button>
        </Link>
        <Link href="/settings">
          <Button variant="ghost" size="icon">
            <Settings className="w-5 h-5" />
          </Button>
        </Link>
        <ThemeToggle />
        
        {user ? (
          <div className="flex items-center gap-2 pl-2 border-l border-border/50">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-purple-600 flex items-center justify-center text-white text-sm font-bold">
              {user.name?.charAt(0).toUpperCase() || 'U'}
            </div>
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => logoutMutation?.mutate()}
              disabled={logoutMutation?.isPending}
            >
              Logout
            </Button>
          </div>
        ) : isGuest ? (
          <Link href="/auth">
            <Button variant="outline" size="sm">Sign In</Button>
          </Link>
        ) : null}
      </div>
    </header>
  );
}
