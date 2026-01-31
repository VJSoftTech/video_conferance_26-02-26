import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useEffect } from "react";
import { AuthProvider } from "@/hooks/use-auth";
import { ProtectedRoute } from "@/lib/protected-route";
import Home from "@/pages/home";
import GuestHome from "@/pages/guest-home";
import AuthPage from "@/pages/auth-page";
import PreJoin from "@/pages/pre-join";
import MeetingRoomLiveKit from "@/pages/meeting-room-livekit";
import JoinMeeting from "@/pages/join-meeting";
import MeetingsPage from "@/pages/meetings";
import TeamChatPage from "@/pages/team-chat";
import SchedulerPage from "@/pages/scheduler";
import MorePage from "@/pages/more";
import NotesPage from "@/pages/notes";
import TasksPage from "@/pages/tasks";
import DocsPage from "@/pages/docs";
import ContactsPage from "@/pages/contacts";
import MailPage from "@/pages/mail";
import SettingsPage from "@/pages/settings";
import NotificationsPage from "@/pages/notifications";
import RecordingsPage from "@/pages/recordings";
import NotFound from "@/pages/not-found";

function Router() {
  return (
    <Switch>
      <ProtectedRoute path="/" component={Home} />
      <Route path="/guest" component={GuestHome} />
      <Route path="/join" component={JoinMeeting} />
      <Route path="/meetings" component={MeetingsPage} />
      <Route path="/chat" component={TeamChatPage} />
      <Route path="/scheduler" component={SchedulerPage} />
      <Route path="/more" component={MorePage} />
      <Route path="/notes" component={NotesPage} />
      <Route path="/tasks" component={TasksPage} />
      <Route path="/docs" component={DocsPage} />
      <Route path="/contacts" component={ContactsPage} />
      <Route path="/mail" component={MailPage} />
      <Route path="/settings" component={SettingsPage} />
      <Route path="/notifications" component={NotificationsPage} />
      <Route path="/recordings" component={RecordingsPage} />
      <Route path="/room/:roomId/join" component={PreJoin} />
      <Route path="/room/:roomId" component={MeetingRoomLiveKit} />
      <Route path="/auth" component={AuthPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  useEffect(() => {
    const stored = localStorage.getItem("theme");
    if (stored === "dark" || (!stored && window.matchMedia("(prefers-color-scheme: dark)").matches)) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
