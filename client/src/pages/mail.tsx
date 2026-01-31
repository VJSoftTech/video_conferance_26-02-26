import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { Mail, Settings, Send, CheckCircle, XCircle, Loader2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

interface SmtpSettings {
  id: number;
  host: string;
  port: number;
  secure: boolean;
  username: string;
  fromEmail: string;
  fromName?: string;
  hasPassword: boolean;
}

interface Meeting {
  id: number;
  title: string;
  roomId: string;
  scheduledAt: string;
}

export default function MailPage() {
  const [activeTab, setActiveTab] = useState<"settings" | "send">("settings");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [host, setHost] = useState("");
  const [port, setPort] = useState("587");
  const [secure, setSecure] = useState(true);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [fromEmail, setFromEmail] = useState("");
  const [fromName, setFromName] = useState("");

  const [selectedMeetingId, setSelectedMeetingId] = useState<number | null>(null);
  const [recipientEmail, setRecipientEmail] = useState("");
  const [recipientName, setRecipientName] = useState("");

  const { data: smtpSettings, isLoading: loadingSettings } = useQuery<SmtpSettings | null>({
    queryKey: ["/api/smtp-settings"],
    queryFn: async () => {
      const res = await fetch("/api/smtp-settings");
      if (!res.ok) return null;
      return res.json();
    },
  });

  useEffect(() => {
    if (smtpSettings) {
      setHost(smtpSettings.host);
      setPort(smtpSettings.port.toString());
      setSecure(smtpSettings.secure);
      setUsername(smtpSettings.username);
      setFromEmail(smtpSettings.fromEmail);
      setFromName(smtpSettings.fromName || "");
    }
  }, [smtpSettings]);

  const { data: meetings = [] } = useQuery<Meeting[]>({
    queryKey: ["/api/meetings"],
    queryFn: async () => {
      const res = await fetch("/api/meetings");
      if (!res.ok) return [];
      return res.json();
    },
  });

  const saveSettingsMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/smtp-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          host,
          port: parseInt(port),
          secure,
          username,
          password,
          fromEmail,
          fromName,
        }),
      });
      if (!res.ok) throw new Error("Failed to save settings");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/smtp-settings"] });
      toast({ title: "Settings saved", description: "SMTP settings saved successfully" });
      setPassword("");
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to save SMTP settings", variant: "destructive" });
    },
  });

  const testConnectionMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/smtp-settings/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          host,
          port: parseInt(port),
          secure,
          username,
          password: password || "placeholder",
          fromEmail,
          fromName,
        }),
      });
      return res.json();
    },
    onSuccess: (data) => {
      if (data.success) {
        toast({ title: "Connection successful", description: "SMTP server is reachable" });
      } else {
        toast({ title: "Connection failed", description: data.error || "Could not connect to SMTP server", variant: "destructive" });
      }
    },
  });

  const sendInviteMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/meetings/${selectedMeetingId}/send-invite`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipientEmail, recipientName }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || "Failed to send invite");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Invite sent", description: `Meeting invite sent to ${recipientEmail}` });
      setRecipientEmail("");
      setRecipientName("");
    },
    onError: (error: any) => {
      toast({ title: "Failed to send", description: error.message, variant: "destructive" });
    },
  });

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    saveSettingsMutation.mutate();
  };

  const handleSendInvite = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMeetingId || !recipientEmail) return;
    sendInviteMutation.mutate();
  };

  return (
    <DashboardShell>
      <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <h1 className="text-xl sm:text-2xl font-bold">Mail</h1>
          <p className="text-sm sm:text-base text-muted-foreground">Configure email settings and send meeting invites</p>
        </motion.div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setActiveTab("settings")}
            className={`flex items-center gap-2 px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors ${
              activeTab === "settings"
                ? "bg-primary text-primary-foreground"
                : "bg-secondary/30 text-muted-foreground hover:text-foreground"
            }`}
          >
            <Settings className="w-4 h-4" />
            <span className="hidden sm:inline">SMTP Settings</span>
            <span className="sm:hidden">Settings</span>
          </button>
          <button
            onClick={() => setActiveTab("send")}
            className={`flex items-center gap-2 px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors ${
              activeTab === "send"
                ? "bg-primary text-primary-foreground"
                : "bg-secondary/30 text-muted-foreground hover:text-foreground"
            }`}
          >
            <Send className="w-4 h-4" />
            <span className="hidden sm:inline">Send Invites</span>
            <span className="sm:hidden">Invites</span>
          </button>
        </div>

        {activeTab === "settings" && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-secondary/20 rounded-2xl border border-white/5 p-6"
          >
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center">
                <Mail className="w-5 h-5 text-purple-500" />
              </div>
              <div>
                <h2 className="text-lg font-semibold">SMTP Configuration</h2>
                <p className="text-sm text-muted-foreground">Configure your email server to send meeting invites</p>
              </div>
              {smtpSettings && (
                <div className="ml-auto flex items-center gap-2 text-sm text-emerald-500">
                  <CheckCircle className="w-4 h-4" />
                  Configured
                </div>
              )}
            </div>

            <form onSubmit={handleSaveSettings} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground">SMTP Host</label>
                  <input
                    type="text"
                    value={host}
                    onChange={(e) => setHost(e.target.value)}
                    placeholder="smtp.gmail.com"
                    className="w-full bg-secondary/50 border border-white/10 rounded-xl py-3 px-4 text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/50"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground">Port</label>
                  <input
                    type="number"
                    value={port}
                    onChange={(e) => setPort(e.target.value)}
                    placeholder="587"
                    className="w-full bg-secondary/50 border border-white/10 rounded-xl py-3 px-4 text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/50"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground">Username</label>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="your@email.com"
                    className="w-full bg-secondary/50 border border-white/10 rounded-xl py-3 px-4 text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/50"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground">
                    Password {smtpSettings?.hasPassword && <span className="text-xs text-muted-foreground">(leave blank to keep current)</span>}
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-secondary/50 border border-white/10 rounded-xl py-3 px-4 text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/50"
                    required={!smtpSettings?.hasPassword}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground">From Email</label>
                  <input
                    type="email"
                    value={fromEmail}
                    onChange={(e) => setFromEmail(e.target.value)}
                    placeholder="noreply@yourcompany.com"
                    className="w-full bg-secondary/50 border border-white/10 rounded-xl py-3 px-4 text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/50"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground">From Name (optional)</label>
                  <input
                    type="text"
                    value={fromName}
                    onChange={(e) => setFromName(e.target.value)}
                    placeholder="பேசு தமிழ்"
                    className="w-full bg-secondary/50 border border-white/10 rounded-xl py-3 px-4 text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/50"
                  />
                </div>
              </div>

              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={secure}
                    onChange={(e) => setSecure(e.target.checked)}
                    className="w-4 h-4 rounded border-white/20 bg-secondary/50 text-primary focus:ring-primary/50"
                  />
                  <span className="text-sm">Use SSL/TLS (recommended)</span>
                </label>
              </div>

              <div className="flex gap-3 pt-4">
                <Button type="submit" disabled={saveSettingsMutation.isPending}>
                  {saveSettingsMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Save Settings
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => testConnectionMutation.mutate()}
                  disabled={testConnectionMutation.isPending || !host || !username}
                >
                  {testConnectionMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Test Connection
                </Button>
              </div>
            </form>

            <div className="mt-6 p-4 bg-secondary/30 rounded-xl">
              <h3 className="font-medium mb-2">Common SMTP Settings</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm text-muted-foreground">
                <div>
                  <p className="font-medium text-foreground">Gmail</p>
                  <p>Host: smtp.gmail.com</p>
                  <p>Port: 587</p>
                </div>
                <div>
                  <p className="font-medium text-foreground">Outlook</p>
                  <p>Host: smtp-mail.outlook.com</p>
                  <p>Port: 587</p>
                </div>
                <div>
                  <p className="font-medium text-foreground">Yahoo</p>
                  <p>Host: smtp.mail.yahoo.com</p>
                  <p>Port: 587</p>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {activeTab === "send" && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            {!smtpSettings ? (
              <div className="bg-secondary/20 rounded-2xl border border-white/5 p-12 text-center">
                <XCircle className="w-16 h-16 mx-auto mb-4 text-muted-foreground/50" />
                <p className="text-lg text-muted-foreground">SMTP not configured</p>
                <p className="text-sm text-muted-foreground/70 mt-1 mb-4">
                  Please configure your email settings first to send invites
                </p>
                <Button onClick={() => setActiveTab("settings")}>
                  Configure Settings
                </Button>
              </div>
            ) : (
              <div className="bg-secondary/20 rounded-2xl border border-white/5 p-6">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center">
                    <Send className="w-5 h-5 text-blue-500" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold">Send Meeting Invite</h2>
                    <p className="text-sm text-muted-foreground">Invite participants to your scheduled meetings</p>
                  </div>
                </div>

                {meetings.length === 0 ? (
                  <div className="text-center py-8">
                    <Users className="w-12 h-12 mx-auto mb-4 text-muted-foreground/50" />
                    <p className="text-muted-foreground">No meetings scheduled</p>
                    <p className="text-sm text-muted-foreground/70">Schedule a meeting first to send invites</p>
                  </div>
                ) : (
                  <form onSubmit={handleSendInvite} className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-muted-foreground">Select Meeting</label>
                      <select
                        value={selectedMeetingId || ""}
                        onChange={(e) => setSelectedMeetingId(parseInt(e.target.value))}
                        className="w-full bg-secondary/50 border border-white/10 rounded-xl py-3 px-4 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                        required
                      >
                        <option value="">Choose a meeting...</option>
                        {meetings.map((meeting) => (
                          <option key={meeting.id} value={meeting.id}>
                            {meeting.title} - {new Date(meeting.scheduledAt).toLocaleDateString()}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-muted-foreground">Recipient Email</label>
                        <input
                          type="email"
                          value={recipientEmail}
                          onChange={(e) => setRecipientEmail(e.target.value)}
                          placeholder="recipient@example.com"
                          className="w-full bg-secondary/50 border border-white/10 rounded-xl py-3 px-4 text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/50"
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-muted-foreground">Recipient Name (optional)</label>
                        <input
                          type="text"
                          value={recipientName}
                          onChange={(e) => setRecipientName(e.target.value)}
                          placeholder="John Doe"
                          className="w-full bg-secondary/50 border border-white/10 rounded-xl py-3 px-4 text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/50"
                        />
                      </div>
                    </div>

                    <Button type="submit" className="gap-2" disabled={sendInviteMutation.isPending}>
                      {sendInviteMutation.isPending ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Send className="w-4 h-4" />
                      )}
                      Send Invite
                    </Button>
                  </form>
                )}
              </div>
            )}
          </motion.div>
        )}
      </div>
    </DashboardShell>
  );
}
