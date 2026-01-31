import { ChevronLeft, ChevronRight, Plus, Calendar } from "lucide-react";
import { useState } from "react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isToday, addMonths, subMonths } from "date-fns";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";

interface Meeting {
  id: number;
  title: string;
  scheduledAt: string;
  duration: number;
  roomId: string;
}

export function CalendarWidget() {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [, navigate] = useLocation();
  
  const { data: allMeetings = [] } = useQuery<Meeting[]>({
    queryKey: ["/api/meetings"],
    queryFn: async () => {
      const res = await fetch("/api/meetings");
      if (!res.ok) return [];
      return res.json();
    },
  });

  const { data: todayMeetings = [] } = useQuery<Meeting[]>({
    queryKey: ["/api/meetings/today"],
    queryFn: async () => {
      const res = await fetch("/api/meetings/today");
      if (!res.ok) return [];
      return res.json();
    },
  });
  
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });

  const startDayOfWeek = monthStart.getDay();
  const paddingDays = Array(startDayOfWeek).fill(null);

  const previousMonth = () => setCurrentMonth(subMonths(currentMonth, 1));
  const nextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));

  const hasMeetingOnDay = (day: Date) => {
    return allMeetings.some(m => 
      format(new Date(m.scheduledAt), 'yyyy-MM-dd') === format(day, 'yyyy-MM-dd')
    );
  };

  return (
    <div className="bg-secondary/20 rounded-2xl border border-white/5 overflow-hidden">
      <div className="p-4 border-b border-white/5 flex items-center justify-between">
        <h2 className="font-semibold text-lg">Calendar</h2>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={previousMonth}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <span className="text-sm font-medium min-w-[120px] text-center">
            {format(currentMonth, 'MMMM yyyy')}
          </span>
          <Button variant="ghost" size="icon" onClick={nextMonth}>
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <div className="p-4">
        <div className="grid grid-cols-7 gap-1 mb-2">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
            <div key={day} className="text-center text-xs text-muted-foreground font-medium py-1">
              {day}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1">
          {paddingDays.map((_, i) => (
            <div key={`pad-${i}`} className="aspect-square" />
          ))}
          {days.map(day => {
            const dayIsToday = isToday(day);
            const hasMeeting = hasMeetingOnDay(day);
            
            return (
              <button
                key={day.toISOString()}
                className={`aspect-square rounded-lg flex flex-col items-center justify-center text-sm relative transition-colors ${
                  dayIsToday 
                    ? 'bg-primary text-primary-foreground font-bold' 
                    : 'hover:bg-secondary/50 text-foreground'
                } ${!isSameMonth(day, currentMonth) ? 'text-muted-foreground/50' : ''}`}
              >
                {format(day, 'd')}
                {hasMeeting && !dayIsToday && (
                  <div className="absolute bottom-1 w-1 h-1 rounded-full bg-primary" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="p-4 border-t border-white/5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-medium">Today's Meetings</h3>
          <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => navigate("/scheduler")}>
            <Plus className="w-3 h-3 mr-1" />
            Add
          </Button>
        </div>
        
        {todayMeetings.length > 0 ? (
          <div className="space-y-2">
            {todayMeetings.map(meeting => (
              <div key={meeting.id} className="flex items-center gap-3 p-2 rounded-lg bg-secondary/30 hover:bg-secondary/50 transition-colors cursor-pointer">
                <div className="w-1 h-8 rounded-full bg-primary" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{meeting.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {format(new Date(meeting.scheduledAt), 'h:mm a')} • {meeting.duration} min
                  </p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-4">
            <Calendar className="w-8 h-8 mx-auto mb-2 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">No meetings today</p>
          </div>
        )}
      </div>
    </div>
  );
}
