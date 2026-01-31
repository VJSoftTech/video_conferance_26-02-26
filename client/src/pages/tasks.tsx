import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { CheckSquare, Plus, Trash2, Calendar, Clock, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";

interface Task {
  id: number;
  meetingId: number;
  title: string;
  description?: string;
  status: string;
  priority: string;
  dueAt?: string;
  createdAt: string;
}

interface Meeting {
  id: number;
  title: string;
}

const statusColors = {
  todo: "bg-gray-500/20 text-gray-400",
  in_progress: "bg-blue-500/20 text-blue-400",
  done: "bg-emerald-500/20 text-emerald-400",
};

const priorityColors = {
  low: "text-gray-400",
  medium: "text-yellow-400",
  high: "text-red-400",
};

export default function TasksPage() {
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [selectedMeetingId, setSelectedMeetingId] = useState<number | null>(null);
  const [priority, setPriority] = useState("medium");
  const [dueAt, setDueAt] = useState("");
  const [filter, setFilter] = useState<string>("all");
  const queryClient = useQueryClient();

  const { data: tasks = [], isLoading } = useQuery<Task[]>({
    queryKey: ["/api/tasks"],
    queryFn: async () => {
      const res = await fetch("/api/tasks");
      if (!res.ok) return [];
      return res.json();
    },
  });

  const { data: meetings = [] } = useQuery<Meeting[]>({
    queryKey: ["/api/meetings"],
    queryFn: async () => {
      const res = await fetch("/api/meetings");
      if (!res.ok) return [];
      return res.json();
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: { meetingId: number; title: string; description?: string; priority: string; dueAt?: string }) => {
      const res = await fetch(`/api/meetings/${data.meetingId}/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to create task");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      setShowForm(false);
      setTitle("");
      setDescription("");
      setSelectedMeetingId(null);
      setPriority("medium");
      setDueAt("");
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) => {
      const res = await fetch(`/api/tasks/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error("Failed to update task");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/tasks/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete task");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !selectedMeetingId) return;
    createMutation.mutate({ 
      meetingId: selectedMeetingId, 
      title, 
      description: description || undefined,
      priority,
      dueAt: dueAt || undefined,
    });
  };

  const filteredTasks = tasks.filter(task => 
    filter === "all" || task.status === filter
  );

  const getMeetingTitle = (meetingId: number) => {
    const meeting = meetings.find(m => m.id === meetingId);
    return meeting?.title || `Meeting #${meetingId}`;
  };

  const cycleStatus = (task: Task) => {
    const statuses = ["todo", "in_progress", "done"];
    const currentIndex = statuses.indexOf(task.status);
    const nextStatus = statuses[(currentIndex + 1) % statuses.length];
    updateMutation.mutate({ id: task.id, status: nextStatus });
  };

  return (
    <DashboardShell>
      <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col sm:flex-row sm:items-center justify-between gap-3"
        >
          <div>
            <h1 className="text-xl sm:text-2xl font-bold">Tasks</h1>
            <p className="text-sm sm:text-base text-muted-foreground">Manage your to-dos from meetings</p>
          </div>
          <Button className="gap-2 w-full sm:w-auto" onClick={() => setShowForm(!showForm)}>
            <Plus className="w-4 h-4" />
            New Task
          </Button>
        </motion.div>

        <div className="flex flex-wrap gap-2">
          {["all", "todo", "in_progress", "done"].map((status) => (
            <button
              key={status}
              onClick={() => setFilter(status)}
              className={`px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors ${
                filter === status
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary/30 text-muted-foreground hover:text-foreground"
              }`}
            >
              {status === "all" ? "All" : status === "in_progress" ? "In Progress" : status.charAt(0).toUpperCase() + status.slice(1)}
            </button>
          ))}
        </div>

        {showForm && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-secondary/20 rounded-2xl border border-white/5 p-6"
          >
            <h2 className="text-lg font-semibold mb-4">Create Task</h2>
            <form className="space-y-4" onSubmit={handleSubmit}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground">Meeting</label>
                  <select
                    value={selectedMeetingId || ""}
                    onChange={(e) => setSelectedMeetingId(parseInt(e.target.value))}
                    className="w-full bg-secondary/50 border border-white/10 rounded-xl py-3 px-4 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                    required
                  >
                    <option value="">Select a meeting...</option>
                    {meetings.map(m => (
                      <option key={m.id} value={m.id}>{m.title}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground">Priority</label>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value)}
                    className="w-full bg-secondary/50 border border-white/10 rounded-xl py-3 px-4 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">Task Title</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="What needs to be done?"
                  className="w-full bg-secondary/50 border border-white/10 rounded-xl py-3 px-4 text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/50"
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">Description (optional)</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Add more details..."
                  rows={2}
                  className="w-full bg-secondary/50 border border-white/10 rounded-xl py-3 px-4 text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">Due Date (optional)</label>
                <input
                  type="datetime-local"
                  value={dueAt}
                  onChange={(e) => setDueAt(e.target.value)}
                  className="w-full bg-secondary/50 border border-white/10 rounded-xl py-3 px-4 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>
              <div className="flex gap-3">
                <Button type="submit" disabled={createMutation.isPending}>
                  {createMutation.isPending ? "Creating..." : "Create Task"}
                </Button>
                <Button type="button" variant="outline" onClick={() => setShowForm(false)}>
                  Cancel
                </Button>
              </div>
            </form>
          </motion.div>
        )}

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-20 bg-secondary/30 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : filteredTasks.length === 0 ? (
          <div className="text-center py-12">
            <CheckSquare className="w-16 h-16 mx-auto mb-4 text-muted-foreground/50" />
            <p className="text-lg text-muted-foreground">No tasks yet</p>
            <p className="text-sm text-muted-foreground/70 mt-1">
              Create action items from your meetings
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredTasks.map((task) => (
              <motion.div
                key={task.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className="bg-secondary/20 rounded-xl border border-white/5 p-4 hover:border-primary/30 transition-colors group"
              >
                <div className="flex items-start gap-4">
                  <button
                    onClick={() => cycleStatus(task)}
                    className={`w-6 h-6 rounded-md flex items-center justify-center transition-colors ${statusColors[task.status as keyof typeof statusColors]}`}
                  >
                    {task.status === "done" && <CheckSquare className="w-4 h-4" />}
                  </button>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className={`font-medium ${task.status === "done" ? "line-through text-muted-foreground" : ""}`}>
                        {task.title}
                      </h3>
                      <AlertCircle className={`w-4 h-4 ${priorityColors[task.priority as keyof typeof priorityColors]}`} />
                    </div>
                    {task.description && (
                      <p className="text-sm text-muted-foreground mt-1">{task.description}</p>
                    )}
                    <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        <span>{getMeetingTitle(task.meetingId)}</span>
                      </div>
                      {task.dueAt && (
                        <div className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          <span>Due {format(new Date(task.dueAt), "MMM d")}</span>
                        </div>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => deleteMutation.mutate(task.id)}
                    className="p-2 hover:bg-destructive/20 rounded text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
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
