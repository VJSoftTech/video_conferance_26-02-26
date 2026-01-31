import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { Settings, User, Bell, Palette, Shield, Mail, Volume2 } from "lucide-react";
import { motion } from "framer-motion";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

export default function SettingsPage() {
  const { toast } = useToast();
  const [activeSection, setActiveSection] = useState("general");

  const [displayName, setDisplayName] = useState("");
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [meetingReminders, setMeetingReminders] = useState(true);
  const [reminderTime, setReminderTime] = useState("15");

  useEffect(() => {
    const savedSettings = localStorage.getItem("meetspace_settings");
    if (savedSettings) {
      const settings = JSON.parse(savedSettings);
      setDisplayName(settings.displayName || "");
      setEmailNotifications(settings.emailNotifications ?? true);
      setSoundEnabled(settings.soundEnabled ?? true);
      setMeetingReminders(settings.meetingReminders ?? true);
      setReminderTime(settings.reminderTime || "15");
    }
  }, []);

  const saveSettings = () => {
    const settings = {
      displayName,
      emailNotifications,
      soundEnabled,
      meetingReminders,
      reminderTime,
    };
    localStorage.setItem("meetspace_settings", JSON.stringify(settings));
    toast({ title: "Settings saved", description: "Your preferences have been updated" });
  };

  const sections = [
    { id: "general", label: "General", icon: Settings },
    { id: "profile", label: "Profile", icon: User },
    { id: "notifications", label: "Notifications", icon: Bell },
    { id: "appearance", label: "Appearance", icon: Palette },
  ];

  return (
    <DashboardShell>
      <div className="p-6 space-y-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <h1 className="text-2xl font-bold">Settings</h1>
          <p className="text-muted-foreground">Manage your preferences and account settings</p>
        </motion.div>

        <div className="flex gap-6">
          <div className="w-64 space-y-1">
            {sections.map((section) => {
              const Icon = section.icon;
              return (
                <button
                  key={section.id}
                  onClick={() => setActiveSection(section.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-colors ${
                    activeSection === section.id
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  <span className="font-medium">{section.label}</span>
                </button>
              );
            })}
          </div>

          <div className="flex-1 bg-secondary/20 rounded-2xl border border-white/5 p-6">
            {activeSection === "general" && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="space-y-6"
              >
                <div>
                  <h2 className="text-lg font-semibold mb-4">General Settings</h2>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 bg-secondary/30 rounded-xl">
                      <div className="flex items-center gap-3">
                        <Volume2 className="w-5 h-5 text-muted-foreground" />
                        <div>
                          <p className="font-medium">Sound Effects</p>
                          <p className="text-sm text-muted-foreground">Play sounds for notifications</p>
                        </div>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={soundEnabled}
                          onChange={(e) => setSoundEnabled(e.target.checked)}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-secondary rounded-full peer peer-checked:bg-primary transition-colors after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-full" />
                      </label>
                    </div>
                  </div>
                </div>

                <Button onClick={saveSettings}>Save Changes</Button>
              </motion.div>
            )}

            {activeSection === "profile" && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="space-y-6"
              >
                <div>
                  <h2 className="text-lg font-semibold mb-4">Profile Settings</h2>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-muted-foreground">Display Name</label>
                      <input
                        type="text"
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        placeholder="Your name in meetings"
                        className="w-full bg-secondary/50 border border-white/10 rounded-xl py-3 px-4 text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/50"
                      />
                      <p className="text-xs text-muted-foreground">This name will be shown to others in meetings</p>
                    </div>
                  </div>
                </div>

                <Button onClick={saveSettings}>Save Changes</Button>
              </motion.div>
            )}

            {activeSection === "notifications" && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="space-y-6"
              >
                <div>
                  <h2 className="text-lg font-semibold mb-4">Notification Preferences</h2>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 bg-secondary/30 rounded-xl">
                      <div className="flex items-center gap-3">
                        <Mail className="w-5 h-5 text-muted-foreground" />
                        <div>
                          <p className="font-medium">Email Notifications</p>
                          <p className="text-sm text-muted-foreground">Receive email updates about meetings</p>
                        </div>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={emailNotifications}
                          onChange={(e) => setEmailNotifications(e.target.checked)}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-secondary rounded-full peer peer-checked:bg-primary transition-colors after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-full" />
                      </label>
                    </div>

                    <div className="flex items-center justify-between p-4 bg-secondary/30 rounded-xl">
                      <div className="flex items-center gap-3">
                        <Bell className="w-5 h-5 text-muted-foreground" />
                        <div>
                          <p className="font-medium">Meeting Reminders</p>
                          <p className="text-sm text-muted-foreground">Get notified before meetings start</p>
                        </div>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={meetingReminders}
                          onChange={(e) => setMeetingReminders(e.target.checked)}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-secondary rounded-full peer peer-checked:bg-primary transition-colors after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-full" />
                      </label>
                    </div>

                    {meetingReminders && (
                      <div className="p-4 bg-secondary/30 rounded-xl">
                        <label className="text-sm font-medium">Remind me before meeting</label>
                        <select
                          value={reminderTime}
                          onChange={(e) => setReminderTime(e.target.value)}
                          className="mt-2 w-full bg-secondary/50 border border-white/10 rounded-xl py-3 px-4 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                        >
                          <option value="5">5 minutes before</option>
                          <option value="10">10 minutes before</option>
                          <option value="15">15 minutes before</option>
                          <option value="30">30 minutes before</option>
                          <option value="60">1 hour before</option>
                        </select>
                      </div>
                    )}
                  </div>
                </div>

                <Button onClick={saveSettings}>Save Changes</Button>
              </motion.div>
            )}

            {activeSection === "appearance" && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="space-y-6"
              >
                <div>
                  <h2 className="text-lg font-semibold mb-4">Appearance</h2>
                  <div className="space-y-4">
                    <div className="p-4 bg-secondary/30 rounded-xl">
                      <p className="font-medium mb-3">Theme</p>
                      <p className="text-sm text-muted-foreground mb-4">
                        Use the theme toggle in the top navigation bar to switch between light and dark mode.
                      </p>
                      <div className="flex gap-4">
                        <button
                          onClick={() => {
                            document.documentElement.classList.remove("dark");
                            localStorage.setItem("theme", "light");
                          }}
                          className="flex-1 p-4 rounded-xl border-2 border-white/10 hover:border-primary/50 bg-white text-black transition-colors"
                        >
                          <Palette className="w-6 h-6 mb-2" />
                          <p className="font-medium">Light</p>
                        </button>
                        <button
                          onClick={() => {
                            document.documentElement.classList.add("dark");
                            localStorage.setItem("theme", "dark");
                          }}
                          className="flex-1 p-4 rounded-xl border-2 border-white/10 hover:border-primary/50 bg-gray-900 text-white transition-colors"
                        >
                          <Palette className="w-6 h-6 mb-2" />
                          <p className="font-medium">Dark</p>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </div>
        </div>
      </div>
    </DashboardShell>
  );
}
