import { useState, useMemo } from "react";
import { CheckCircle2 } from "lucide-react";
import { useTasks } from "@/hooks/useTasks";
import { AddTaskForm } from "@/components/AddTaskForm";
import { TaskList } from "@/components/TaskList";
import { FilterTabs, FilterType } from "@/components/FilterTabs";

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
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border/50 bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary flex items-center justify-center">
              <CheckCircle2 className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-xl font-display font-semibold text-foreground">
                Scheduler
              </h1>
              <p className="text-sm text-muted-foreground">
                Stay organized, get things done
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-2xl mx-auto px-4 py-8">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="p-4 rounded-xl bg-card border border-border/50">
            <p className="text-2xl font-display font-semibold text-foreground">
              {counts.all}
            </p>
            <p className="text-sm text-muted-foreground">Total tasks</p>
          </div>
          <div className="p-4 rounded-xl bg-card border border-border/50">
            <p className="text-2xl font-display font-semibold text-primary">
              {counts.active}
            </p>
            <p className="text-sm text-muted-foreground">In progress</p>
          </div>
          <div className="p-4 rounded-xl bg-card border border-border/50">
            <p className="text-2xl font-display font-semibold text-success">
              {counts.completed}
            </p>
            <p className="text-sm text-muted-foreground">Completed</p>
          </div>
        </div>

        {/* Filters */}
        <div className="mb-6">
          <FilterTabs
            activeFilter={filter}
            onFilterChange={setFilter}
            counts={counts}
          />
        </div>

        {/* Add task form */}
        <div className="mb-6">
          <AddTaskForm onAdd={addTask} />
        </div>

        {/* Task list */}
        <TaskList
          tasks={filteredTasks}
          onToggle={toggleTask}
          onDelete={deleteTask}
          emptyMessage={emptyMessages[filter]}
        />
      </main>

      {/* Footer */}
      <footer className="border-t border-border/50 py-6 mt-auto">
        <div className="max-w-2xl mx-auto px-4 text-center text-sm text-muted-foreground">
          Built with care. Stay productive.
        </div>
      </footer>
    </div>
  );
};

export default Index;
