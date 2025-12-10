import { useMemo } from "react";
import { NavLink } from "react-router-dom";
import { isToday, isThisWeek, isThisMonth } from "date-fns";
import { CalendarDays, CalendarCheck, CalendarRange, Calendar, LayoutDashboard, CheckCircle2 } from "lucide-react";
import { useTasks } from "@/hooks/useTasks";
import { AddTaskForm } from "@/components/AddTaskForm";
import { TaskList } from "@/components/TaskList";
import { cn } from "@/lib/utils";

interface FilteredTasksPageProps {
  filter: "today" | "week" | "month";
}

const navigationItems = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Today", url: "/today", icon: CalendarCheck },
  { title: "This Week", url: "/week", icon: CalendarDays },
  { title: "This Month", url: "/month", icon: CalendarRange },
  { title: "Calendar", url: "/calendar", icon: Calendar },
];

const filterLabels = {
  today: "Today's Tasks",
  week: "This Week's Tasks",
  month: "This Month's Tasks",
};

const FilteredTasksPage = ({ filter }: FilteredTasksPageProps) => {
  const { tasks, addTask, toggleTask, deleteTask } = useTasks();

  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      if (!task.dueDate) return false;
      switch (filter) {
        case "today": return isToday(task.dueDate);
        case "week": return isThisWeek(task.dueDate, { weekStartsOn: 0 });
        case "month": return isThisMonth(task.dueDate);
        default: return false;
      }
    });
  }, [tasks, filter]);

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
      <main className="flex-1 p-8">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-2xl font-display font-semibold text-foreground mb-2">{filterLabels[filter]}</h2>
          <p className="text-muted-foreground mb-8">{filteredTasks.filter(t => !t.completed).length} active, {filteredTasks.filter(t => t.completed).length} completed</p>
          <div className="mb-6"><AddTaskForm onAdd={addTask} /></div>
          <TaskList tasks={filteredTasks} onToggle={toggleTask} onDelete={deleteTask} emptyMessage={`No tasks for ${filter}.`} />
        </div>
      </main>
    </div>
  );
};

export default FilteredTasksPage;
