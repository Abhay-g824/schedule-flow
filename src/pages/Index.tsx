import { useState, useMemo } from "react";
import { ListChecks } from "lucide-react";
import { useTasks } from "@/hooks/useTasks";
import { useTemplates } from "@/hooks/useTemplates";
import { AddTaskForm } from "@/components/AddTaskForm";
import { AITaskForm } from "@/components/AITaskForm";
import { AIChatScheduler } from "@/components/AIChatScheduler";
import { TemplatesList } from "@/components/TemplatesList";
import { SmartRescheduleButton } from "@/components/SmartRescheduleButton";
import { ProductivityStats } from "@/components/ProductivityStats";
import { TaskList } from "@/components/TaskList";
import { TaskFilters, FilterOptions } from "@/components/TaskFilters";
import { FilterTabs, FilterType } from "@/components/FilterTabs";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Task, Priority } from "@/types/task";
import { isWithinInterval, startOfDay, endOfDay } from "date-fns";

const Index = () => {
  const { tasks, addTask, toggleTask, deleteTask, updateTask } = useTasks();
  const { createTemplate } = useTemplates();
  const [filter, setFilter] = useState<FilterType>("all");
  const [bulkMode, setBulkMode] = useState(false);
  const [selectedTasks, setSelectedTasks] = useState<Set<string>>(new Set());
  const [advancedFilters, setAdvancedFilters] = useState<FilterOptions>({
    search: "",
    priority: "all",
    color: "all",
    completed: "all",
    dateRange: { start: null, end: null },
  });

  const counts = useMemo(() => ({
    all: tasks.length,
    active: tasks.filter((t) => !t.completed).length,
    completed: tasks.filter((t) => t.completed).length,
  }), [tasks]);

  const filteredTasks = useMemo(() => {
    let result = tasks;

    // Apply basic filter (all/active/completed)
    switch (filter) {
      case "active":
        result = result.filter((t) => !t.completed);
        break;
      case "completed":
        result = result.filter((t) => t.completed);
        break;
    }

    // Apply advanced filters
    if (advancedFilters.search) {
      const searchLower = advancedFilters.search.toLowerCase();
      result = result.filter((t) =>
        t.title.toLowerCase().includes(searchLower) ||
        t.description?.toLowerCase().includes(searchLower)
      );
    }

    if (advancedFilters.priority !== "all") {
      result = result.filter((t) => t.priority === advancedFilters.priority);
    }

    if (advancedFilters.color !== "all") {
      result = result.filter((t) => t.color === advancedFilters.color);
    }

    if (advancedFilters.completed !== "all") {
      if (advancedFilters.completed === "active") {
        result = result.filter((t) => !t.completed);
      } else if (advancedFilters.completed === "completed") {
        result = result.filter((t) => t.completed);
      }
    }

    if (advancedFilters.dateRange.start || advancedFilters.dateRange.end) {
      result = result.filter((t) => {
        if (!t.dueDate) return false;
        const taskDate = t.dueDate;
        const start = advancedFilters.dateRange.start
          ? startOfDay(advancedFilters.dateRange.start)
          : null;
        const end = advancedFilters.dateRange.end
          ? endOfDay(advancedFilters.dateRange.end)
          : null;

        if (start && end) {
          return isWithinInterval(taskDate, { start, end });
        } else if (start) {
          return taskDate >= start;
        } else if (end) {
          return taskDate <= end;
        }
        return true;
      });
    }

    return result;
  }, [tasks, filter, advancedFilters]);

  const handleTaskSelect = (id: string, selected: boolean) => {
    setSelectedTasks((prev) => {
      const next = new Set(prev);
      if (selected) {
        next.add(id);
      } else {
        next.delete(id);
      }
      return next;
    });
  };

  const handleBulkComplete = async (ids: string[]) => {
    for (const id of ids) {
      const task = tasks.find((t) => t.id === id);
      if (task && !task.completed) {
        await toggleTask(id);
      }
    }
    setSelectedTasks(new Set());
    setBulkMode(false);
  };

  const handleBulkDelete = async (ids: string[]) => {
    for (const id of ids) {
      await deleteTask(id);
    }
    setSelectedTasks(new Set());
    setBulkMode(false);
  };

  const clearAdvancedFilters = () => {
    setAdvancedFilters({
      search: "",
      priority: "all",
      color: "all",
      completed: "all",
      dateRange: { start: null, end: null },
    });
  };

  const emptyMessages: Record<FilterType, string> = {
    all: "No tasks yet. Add one to get started!",
    active: "No active tasks. Great job!",
    completed: "No completed tasks yet.",
  };

  return (
    <div className="app-background min-h-screen">

      {/* Main content */}
      <div className="p-8">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-2xl font-display font-semibold text-foreground mb-2">Dashboard</h2>
          <p className="text-muted-foreground mb-8">Overview of all your tasks</p>

          {/* Stats */}
          {/* Stats */}
          <ProductivityStats tasks={tasks} />

          <div className="mb-6 flex items-center justify-between gap-4">
            <FilterTabs activeFilter={filter} onFilterChange={setFilter} counts={counts} />
            <div className="flex items-center gap-2">
              <SmartRescheduleButton />
              <Button
                variant={bulkMode ? "default" : "outline"}
                size="sm"
                onClick={() => {
                  setBulkMode(!bulkMode);
                  setSelectedTasks(new Set());
                }}
                className="gap-2"
              >
                <ListChecks className="h-4 w-4" />
                {bulkMode ? "Exit Bulk" : "Bulk Select"}
              </Button>
            </div>
          </div>

          <div className="mb-6">
            <TaskFilters
              tasks={tasks}
              filters={advancedFilters}
              onFiltersChange={setAdvancedFilters}
              onClearFilters={clearAdvancedFilters}
            />
          </div>

          <div className="mb-6 space-y-3">
            <AddTaskForm onAdd={addTask} onSaveAsTemplate={createTemplate} />
            <AITaskForm onAdd={addTask} />
            <AIChatScheduler />
          </div>

          {/* Templates Section */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Task Templates</h3>
            </div>
            <TemplatesList />
          </div>

          <TaskList
            tasks={filteredTasks}
            onToggle={toggleTask}
            onDelete={deleteTask}
            onUpdate={updateTask}
            emptyMessage={emptyMessages[filter]}
            bulkMode={bulkMode}
            selectedTasks={selectedTasks}
            onTaskSelect={handleTaskSelect}
            onBulkComplete={handleBulkComplete}
            onBulkDelete={handleBulkDelete}
          />
        </div>
      </div>
    </div>
  );
};

export default Index;
