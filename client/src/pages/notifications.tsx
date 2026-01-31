import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { Bell, Calendar, Mail, Video, Clock, Check, Trash2 } from "lucide-react";
import { motion } from "framer-motion";
import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, isToday, isTomorrow, differenceInMinutes } from "date-fns";
import { Button } from "@/components/ui/button";

interface Meeting {
  id: number;
  title: string;
  scheduledAt: string;
  duration: number;
  roomId: string;
}

interface Notification {
  id: string;
  type: "meeting_reminder" | "meeting_starting" | "invite_sent";
  title: string;
  message: string;
  timestamp: Date;
  read: boolean;
  meetingId?: number;
  roomId?: string;
}

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const { data: meetings = [] } = useQuery<Meeting[]>({
    queryKey: ["/api/meetings"],
    queryFn: async () => {
      const res = await fetch("/api/meetings");
      if (!res.ok) return [];
      return res.json();
    },
  });

  useEffect(() => {
    const generatedNotifications: Notification[] = [];
    const now = new Date();

    meetings.forEach((meeting) => {
      const meetingTime = new Date(meeting.scheduledAt);
      const minutesUntil = differenceInMinutes(meetingTime, now);

      if (minutesUntil > 0 && minutesUntil <= 60) {
        generatedNotifications.push({
          id: `reminder-${meeting.id}`,
          type: "meeting_starting",
          title: "Meeting Starting Soon",
          message: `"${meeting.title}" starts in ${minutesUntil} minutes`,
          timestamp: now,
          read: false,
          meetingId: meeting.id,
          roomId: meeting.roomId,
        });
      } else if (isToday(meetingTime) && minutesUntil > 60) {
        generatedNotifications.push({
          id: `today-${meeting.id}`,
          type: "meeting_reminder",
          title: "Meeting Today",
          message: `"${meeting.title}" at ${format(meetingTime, "h:mm a")}`,
          timestamp: new Date(meetingTime.getTime() - 60 * 60 * 1000),
          read: false,
          meetingId: meeting.id,
          roomId: meeting.roomId,
        });
      } else if (isTomorrow(meetingTime)) {
        generatedNotifications.push({
          id: `tomorrow-${meeting.id}`,
          type: "meeting_reminder",
          title: "Meeting Tomorrow",
          message: `"${meeting.title}" at ${format(meetingTime, "h:mm a")}`,
          timestamp: now,
          read: true,
          meetingId: meeting.id,
          roomId: meeting.roomId,
        });
      }
    });

    generatedNotifications.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    setNotifications(generatedNotifications);
  }, [meetings]);

  const markAsRead = (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
  };

  const markAllAsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const deleteNotification = (id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  const unreadCount = notifications.filter((n) => !n.read).length;

  const getIcon = (type: string) => {
    switch (type) {
      case "meeting_starting":
        return <Video className="w-5 h-5 text-red-500" />;
      case "meeting_reminder":
        return <Calendar className="w-5 h-5 text-blue-500" />;
      case "invite_sent":
        return <Mail className="w-5 h-5 text-green-500" />;
      default:
        return <Bell className="w-5 h-5 text-muted-foreground" />;
    }
  };

  return (
    <DashboardShell>
      <div className="p-6 space-y-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between"
        >
          <div>
            <h1 className="text-2xl font-bold">Notifications</h1>
            <p className="text-muted-foreground">
              {unreadCount > 0
                ? `You have ${unreadCount} unread notification${unreadCount > 1 ? "s" : ""}`
                : "You're all caught up!"}
            </p>
          </div>
          {unreadCount > 0 && (
            <Button variant="outline" onClick={markAllAsRead}>
              <Check className="w-4 h-4 mr-2" />
              Mark all as read
            </Button>
          )}
        </motion.div>

        {notifications.length === 0 ? (
          <div className="text-center py-16">
            <Bell className="w-16 h-16 mx-auto mb-4 text-muted-foreground/50" />
            <p className="text-lg text-muted-foreground">No notifications</p>
            <p className="text-sm text-muted-foreground/70 mt-1">
              You'll see meeting reminders and updates here
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {notifications.map((notification, index) => (
              <motion.div
                key={notification.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
                className={`flex items-start gap-4 p-4 rounded-xl border transition-colors group ${
                  notification.read
                    ? "bg-secondary/10 border-white/5"
                    : "bg-secondary/30 border-primary/20"
                }`}
              >
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                  notification.read ? "bg-secondary/50" : "bg-primary/20"
                }`}>
                  {getIcon(notification.type)}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className={`font-medium ${notification.read ? "text-muted-foreground" : ""}`}>
                      {notification.title}
                    </h3>
                    {!notification.read && (
                      <span className="w-2 h-2 bg-primary rounded-full" />
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground mt-0.5">{notification.message}</p>
                  <div className="flex items-center gap-4 mt-2">
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {format(notification.timestamp, "MMM d, h:mm a")}
                    </span>
                    {notification.roomId && notification.type === "meeting_starting" && (
                      <a
                        href={`/room/${notification.roomId}/join`}
                        className="text-xs text-primary hover:underline"
                      >
                        Join now
                      </a>
                    )}
                  </div>
                </div>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  {!notification.read && (
                    <button
                      onClick={() => markAsRead(notification.id)}
                      className="p-2 hover:bg-secondary/50 rounded-lg"
                      title="Mark as read"
                    >
                      <Check className="w-4 h-4" />
                    </button>
                  )}
                  <button
                    onClick={() => deleteNotification(notification.id)}
                    className="p-2 hover:bg-destructive/20 rounded-lg text-destructive"
                    title="Delete"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </DashboardShell>
  );
}
