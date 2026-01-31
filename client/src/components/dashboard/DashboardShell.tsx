import { useState } from "react";
import { DashboardTopNav } from "./DashboardTopNav";
import { DashboardSidebar } from "./DashboardSidebar";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Menu } from "lucide-react";

interface DashboardShellProps {
  children: React.ReactNode;
  isGuest?: boolean;
  showSidebar?: boolean;
}

export function DashboardShell({ children, isGuest = false, showSidebar = true }: DashboardShellProps) {
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  return (
    <div className="h-screen bg-background flex flex-col overflow-hidden">
      <DashboardTopNav isGuest={isGuest}>
        {showSidebar && (
          <Sheet open={isMobileSidebarOpen} onOpenChange={setIsMobileSidebarOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="lg:hidden mr-2">
                <Menu className="w-5 h-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="p-0 w-72">
              <DashboardSidebar onClose={() => setIsMobileSidebarOpen(false)} />
            </SheetContent>
          </Sheet>
        )}
      </DashboardTopNav>
      
      <div className="flex flex-1 min-h-0">
        {showSidebar && (
          <div className="hidden lg:block">
            <DashboardSidebar />
          </div>
        )}
        
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
