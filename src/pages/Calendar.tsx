import { NavLink } from "react-router-dom";
import { CalendarDays, CalendarCheck, CalendarRange, Calendar as CalendarIcon, LayoutDashboard, CheckCircle2 } from "lucide-react";
import { CalendarView } from "@/components/CalendarView";
import { useTasks } from "@/hooks/useTasks";
import { cn } from "@/lib/utils";

const navigationItems = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Today", url: "/today", icon: CalendarCheck },
  { title: "This Week", url: "/week", icon: CalendarDays },
  { title: "This Month", url: "/month", icon: CalendarRange },
  { title: "Calendar", url: "/calendar", icon: CalendarIcon },
];

const Calendar = () => {
  const { tasks, toggleTask } = useTasks();

  return (
    <div className="min-h-screen flex bg-background">
      <aside className="w-64 border-r border-border/50 bg-card p-4 flex flex-col">
        <div className="flex items-center gap-2 mb-8">
          <div className="h-9 w-9 rounded-lg bg-primary flex items-center justify-center">
            <CheckCircle2 className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="font-display font-semibold text-lg text-foreground">Scheduler</span>
        </div>
        <nav className="space-y-1">
          {navigationItems.map((item) => (
            <NavLink key={item.title} to={item.url} className={({ isActive }) => cn(
              "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all",
              isActive ? "bg-primary/10 text-primary font-medium" : "text-muted-foreground hover:text-foreground hover:bg-secondary"
            )}>
              <item.icon className="h-5 w-5" />
              <span>{item.title}</span>
            </NavLink>
          ))}
        </nav>
      </aside>
      <main className="flex-1">
        <CalendarView tasks={tasks} onToggle={toggleTask} />
      </main>
    </div>
  );
};

export default Calendar;
