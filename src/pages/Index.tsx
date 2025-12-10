import { useState, useMemo } from "react";
import { NavLink } from "react-router-dom";
import { CalendarDays, CalendarCheck, CalendarRange, Calendar, LayoutDashboard, CheckCircle2 } from "lucide-react";
import { useTasks } from "@/hooks/useTasks";
import { AddTaskForm } from "@/components/AddTaskForm";
import { TaskList } from "@/components/TaskList";
import { FilterTabs, FilterType } from "@/components/FilterTabs";
import { cn } from "@/lib/utils";

const navigationItems = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Today", url: "/today", icon: CalendarCheck },
  { title: "This Week", url: "/week", icon: CalendarDays },
  { title: "This Month", url: "/month", icon: CalendarRange },
  { title: "Calendar", url: "/calendar", icon: Calendar },
];

const Index = () => {
  const { tasks, addTask, toggleTask, deleteTask } = useTasks();
  const [filter, setFilter] = useState<FilterType>("all");

  const counts = useMemo(() => ({
    all: tasks.length,
    active: tasks.filter((t) => !t.completed).length,
    completed: tasks.filter((t) => t.completed).length,
  }), [tasks]);

  const filteredTasks = useMemo(() => {
    switch (filter) {
      case "active":
        return tasks.filter((t) => !t.completed);
      case "completed":
        return tasks.filter((t) => t.completed);
      default:
        return tasks;
    }
  }, [tasks, filter]);

  const emptyMessages: Record<FilterType, string> = {
    all: "No tasks yet. Add one to get started!",
    active: "No active tasks. Great job!",
    completed: "No completed tasks yet.",
  };

  return (
    <div className="min-h-screen flex bg-background">
      {/* Sidebar */}
      <aside className="w-64 border-r border-border/50 bg-card p-4 flex flex-col">
        <div className="flex items-center gap-2 mb-8">
          <div className="h-9 w-9 rounded-lg bg-primary flex items-center justify-center">
            <CheckCircle2 className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="font-display font-semibold text-lg text-foreground">Scheduler</span>
        </div>
        
        <nav className="space-y-1">
          {navigationItems.map((item) => (
            <NavLink
              key={item.title}
              to={item.url}
              className={({ isActive }) => cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200",
                isActive
                  ? "bg-primary/10 text-primary font-medium"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary"
              )}
            >
              <item.icon className="h-5 w-5" />
              <span>{item.title}</span>
            </NavLink>
          ))}
        </nav>
      </aside>

      {/* Main content */}
      <main className="flex-1 p-8">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-2xl font-display font-semibold text-foreground mb-2">Dashboard</h2>
          <p className="text-muted-foreground mb-8">Overview of all your tasks</p>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-4 mb-8">
            <div className="p-4 rounded-xl bg-card border border-border/50">
              <p className="text-2xl font-display font-semibold text-foreground">{counts.all}</p>
              <p className="text-sm text-muted-foreground">Total tasks</p>
            </div>
            <div className="p-4 rounded-xl bg-card border border-border/50">
              <p className="text-2xl font-display font-semibold text-primary">{counts.active}</p>
              <p className="text-sm text-muted-foreground">In progress</p>
            </div>
            <div className="p-4 rounded-xl bg-card border border-border/50">
              <p className="text-2xl font-display font-semibold text-success">{counts.completed}</p>
              <p className="text-sm text-muted-foreground">Completed</p>
            </div>
          </div>

          <div className="mb-6">
            <FilterTabs activeFilter={filter} onFilterChange={setFilter} counts={counts} />
          </div>

          <div className="mb-6">
            <AddTaskForm onAdd={addTask} />
          </div>

          <TaskList
            tasks={filteredTasks}
            onToggle={toggleTask}
            onDelete={deleteTask}
            emptyMessage={emptyMessages[filter]}
          />
        </div>
      </main>
    </div>
  );
};

export default Index;
