import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useTasks } from "@/hooks/useTasks";
import { useIsMobile } from "@/hooks/use-mobile";
import { Sidebar } from "@/components/Sidebar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isSameMonth, addMonths, subMonths, addWeeks, subWeeks, startOfDay, endOfDay, addDays, subDays } from "date-fns";
import { Task } from "@/types/task";
import { TaskItem } from "@/components/TaskItem";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type CalendarViewType = "day" | "week" | "month";

const CalendarViewPage = () => {
  const { tasks, toggleTask, deleteTask, updateTask } = useTasks();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState<CalendarViewType>("month");
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const filteredTasks = useMemo(() => {
    switch (view) {
      case "day":
        return tasks.filter((task) => {
          if (!task.dueDate) return false;
          return isSameDay(task.dueDate, currentDate);
        });
      case "week":
        const weekStart = startOfWeek(currentDate);
        const weekEnd = endOfWeek(currentDate);
        return tasks.filter((task) => {
          if (!task.dueDate) return false;
          return task.dueDate >= weekStart && task.dueDate <= weekEnd;
        });
      case "month":
        const monthStart = startOfMonth(currentDate);
        const monthEnd = endOfMonth(currentDate);
        return tasks.filter((task) => {
          if (!task.dueDate) return false;
          return task.dueDate >= monthStart && task.dueDate <= monthEnd;
        });
      default:
        return [];
    }
  }, [tasks, currentDate, view]);

  const tasksByDate = useMemo(() => {
    const grouped: Record<string, Task[]> = {};
    filteredTasks.forEach((task) => {
      if (task.dueDate) {
        const dateKey = format(task.dueDate, "yyyy-MM-dd");
        if (!grouped[dateKey]) {
          grouped[dateKey] = [];
        }
        grouped[dateKey].push(task);
      }
    });
    return grouped;
  }, [filteredTasks]);

  const navigateDate = (direction: "prev" | "next") => {
    switch (view) {
      case "day":
        setCurrentDate(direction === "next" ? addDays(currentDate, 1) : subDays(currentDate, 1));
        break;
      case "week":
        setCurrentDate(direction === "next" ? addWeeks(currentDate, 1) : subWeeks(currentDate, 1));
        break;
      case "month":
        setCurrentDate(direction === "next" ? addMonths(currentDate, 1) : subMonths(currentDate, 1));
        break;
    }
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  const renderDayView = () => {
    const dayTasks = tasksByDate[format(currentDate, "yyyy-MM-dd")] || [];
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold">{format(currentDate, "EEEE, MMMM d, yyyy")}</h2>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={goToToday}>
              Today
            </Button>
            <Button variant="outline" size="icon" onClick={() => navigateDate("prev")}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon" onClick={() => navigateDate("next")}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
        {dayTasks.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">No tasks for this day</div>
        ) : (
          <div className="space-y-2">
            {dayTasks.map((task) => (
              <TaskItem key={task.id} task={task} onToggle={toggleTask} onDelete={deleteTask} onUpdate={updateTask} />
            ))}
          </div>
        )}
      </div>
    );
  };

  const renderWeekView = () => {
    const weekStart = startOfWeek(currentDate);
    const weekDays = eachDayOfInterval({ start: weekStart, end: endOfWeek(currentDate) });
    
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold">{format(weekStart, "MMM d")} - {format(endOfWeek(currentDate), "MMM d, yyyy")}</h2>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={goToToday}>
              Today
            </Button>
            <Button variant="outline" size="icon" onClick={() => navigateDate("prev")}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon" onClick={() => navigateDate("next")}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <div className="grid grid-cols-7 gap-2">
          {weekDays.map((day) => {
            const dayTasks = tasksByDate[format(day, "yyyy-MM-dd")] || [];
            const isToday = isSameDay(day, new Date());
            return (
              <div key={day.toISOString()} className={cn("border border-border rounded-lg p-2", isToday && "bg-primary/5 border-primary")}>
                <div className={cn("text-sm font-medium mb-2", isToday && "text-primary")}>
                  {format(day, "EEE")}
                </div>
                <div className={cn("text-lg font-bold mb-2", isToday && "text-primary")}>
                  {format(day, "d")}
                </div>
                <div className="space-y-1">
                  {dayTasks.slice(0, 3).map((task) => (
                    <div
                      key={task.id}
                      className={cn("text-xs p-1 rounded truncate", task.completed && "opacity-50")}
                      style={task.color ? { backgroundColor: `${task.color}20`, borderLeft: `2px solid ${task.color}` } : undefined}
                    >
                      {task.title}
                    </div>
                  ))}
                  {dayTasks.length > 3 && (
                    <div className="text-xs text-muted-foreground">+{dayTasks.length - 3} more</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderMonthView = () => {
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(currentDate);
    const calendarStart = startOfWeek(monthStart);
    const calendarEnd = endOfWeek(monthEnd);
    const calendarDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold">{format(currentDate, "MMMM yyyy")}</h2>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={goToToday}>
              Today
            </Button>
            <Button variant="outline" size="icon" onClick={() => navigateDate("prev")}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon" onClick={() => navigateDate("next")}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <div className="grid grid-cols-7 gap-1">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
            <div key={day} className="text-center text-sm font-medium text-muted-foreground p-2">
              {day}
            </div>
          ))}
          {calendarDays.map((day) => {
            const dayTasks = tasksByDate[format(day, "yyyy-MM-dd")] || [];
            const isToday = isSameDay(day, new Date());
            const isCurrentMonth = isSameMonth(day, currentDate);
            return (
              <div
                key={day.toISOString()}
                className={cn(
                  "min-h-[80px] border border-border rounded-lg p-1 cursor-pointer hover:bg-secondary/50 transition-colors",
                  isToday && "bg-primary/10 border-primary",
                  !isCurrentMonth && "opacity-40"
                )}
                onClick={() => {
                  setCurrentDate(day);
                  setView("day");
                }}
              >
                <div className={cn("text-sm font-medium mb-1", isToday && "text-primary font-bold")}>
                  {format(day, "d")}
                </div>
                <div className="space-y-0.5">
                  {dayTasks.slice(0, 2).map((task) => (
                    <div
                      key={task.id}
                      className={cn("text-xs p-0.5 rounded truncate", task.completed && "opacity-50")}
                      style={task.color ? { backgroundColor: `${task.color}20`, borderLeft: `2px solid ${task.color}` } : undefined}
                    >
                      {task.title}
                    </div>
                  ))}
                  {dayTasks.length > 2 && (
                    <div className="text-xs text-muted-foreground">+{dayTasks.length - 2}</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="app-background min-h-screen">
      <Sidebar isOpen={sidebarOpen} onToggle={() => setSidebarOpen(!sidebarOpen)} isMobile={isMobile} />
      
      {/* Main Content */}
      <main className={cn("transition-all duration-300 min-h-screen", sidebarOpen ? "md:ml-64" : "md:ml-0")}>
        <div className="p-8">
        <div className="max-w-7xl mx-auto">
          <div className="mb-6 flex items-center justify-between">
            <Select value={view} onValueChange={(v) => setView(v as CalendarViewType)}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="day">Day</SelectItem>
                <SelectItem value="week">Week</SelectItem>
                <SelectItem value="month">Month</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {view === "day" && renderDayView()}
          {view === "week" && renderWeekView()}
          {view === "month" && renderMonthView()}
        </div>
        </div>
      </main>
    </div>
  );
};

export default CalendarViewPage;

