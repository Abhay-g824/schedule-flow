import { useState, useMemo } from "react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, startOfWeek, endOfWeek, isToday } from "date-fns";
import { ChevronLeft, ChevronRight, Flag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Task, Priority } from "@/types/task";
import { cn } from "@/lib/utils";

interface CalendarViewProps {
  tasks: Task[];
  onToggle: (id: string) => void;
}

const priorityColors: Record<Priority, string> = {
  high: "bg-priority-high",
  medium: "bg-priority-medium",
  low: "bg-priority-low",
};

export function CalendarView({ tasks, onToggle }: CalendarViewProps) {
  const [currentDate, setCurrentDate] = useState(new Date());

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const calendarStart = startOfWeek(monthStart);
  const calendarEnd = endOfWeek(monthEnd);

  const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  const tasksByDate = useMemo(() => {
    const map = new Map<string, Task[]>();
    tasks.forEach((task) => {
      if (task.dueDate) {
        const key = format(task.dueDate, "yyyy-MM-dd");
        if (!map.has(key)) map.set(key, []);
        map.get(key)!.push(task);
      }
    });
    return map;
  }, [tasks]);

  const goToPreviousMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const goToNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-display font-semibold text-foreground">
          {format(currentDate, "MMMM yyyy")}
        </h2>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={goToToday}>
            Today
          </Button>
          <Button variant="outline" size="icon" onClick={goToPreviousMonth}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" onClick={goToNextMonth}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="bg-card rounded-xl border border-border/50 overflow-hidden">
        {/* Weekday headers */}
        <div className="grid grid-cols-7 border-b border-border/50">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
            <div
              key={day}
              className="px-2 py-3 text-center text-sm font-medium text-muted-foreground"
            >
              {day}
            </div>
          ))}
        </div>

        {/* Days grid */}
        <div className="grid grid-cols-7">
          {days.map((day, idx) => {
            const dateKey = format(day, "yyyy-MM-dd");
            const dayTasks = tasksByDate.get(dateKey) || [];
            const isCurrentMonth = isSameMonth(day, currentDate);
            const isCurrentDay = isToday(day);

            return (
              <div
                key={idx}
                className={cn(
                  "min-h-[100px] p-2 border-b border-r border-border/30",
                  !isCurrentMonth && "bg-muted/30",
                  idx % 7 === 6 && "border-r-0"
                )}
              >
                <div
                  className={cn(
                    "flex items-center justify-center h-7 w-7 rounded-full text-sm mb-1",
                    isCurrentDay && "bg-primary text-primary-foreground font-semibold",
                    !isCurrentMonth && "text-muted-foreground/50"
                  )}
                >
                  {format(day, "d")}
                </div>
                
                <div className="space-y-1">
                  {dayTasks.slice(0, 3).map((task) => (
                    <button
                      key={task.id}
                      onClick={() => onToggle(task.id)}
                      className={cn(
                        "w-full text-left px-2 py-1 rounded text-xs truncate transition-all",
                        task.completed
                          ? "bg-muted text-muted-foreground line-through"
                          : "bg-primary/10 text-foreground hover:bg-primary/20"
                      )}
                    >
                      <span className={cn("inline-block h-1.5 w-1.5 rounded-full mr-1", priorityColors[task.priority])} />
                      {task.title}
                    </button>
                  ))}
                  {dayTasks.length > 3 && (
                    <p className="text-xs text-muted-foreground px-2">
                      +{dayTasks.length - 3} more
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
