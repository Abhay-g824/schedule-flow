import { useMemo, useState } from "react";
import { NavLink } from "react-router-dom";
import { isToday, isThisWeek, isThisMonth } from "date-fns";
import { useTasks } from "@/hooks/useTasks";
import { AddTaskForm } from "@/components/AddTaskForm";
import { AITaskForm } from "@/components/AITaskForm";
import { TaskList } from "@/components/TaskList";

import { cn } from "@/lib/utils";

interface FilteredTasksPageProps {
  filter: "today" | "week" | "month";
}

const filterLabels = {
  today: "Today's Tasks",
  week: "This Week's Tasks",
  month: "This Month's Tasks",
};

const FilteredTasksPage = ({ filter }: FilteredTasksPageProps) => {
  const { tasks, addTask, toggleTask, deleteTask, updateTask } = useTasks();


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
    <div className="app-background min-h-screen">

      <div className="p-8">

        <div className="max-w-2xl mx-auto">
          <h2 className="text-2xl font-display font-semibold text-foreground mb-2">{filterLabels[filter]}</h2>
          <p className="text-muted-foreground mb-8">{filteredTasks.filter(t => !t.completed).length} active, {filteredTasks.filter(t => t.completed).length} completed</p>

          <div className="mb-6 space-y-3">
            <AddTaskForm onAdd={addTask} />
            <AITaskForm onAdd={addTask} />
          </div>
          <TaskList tasks={filteredTasks} onToggle={toggleTask} onDelete={deleteTask} onUpdate={updateTask} emptyMessage={`No tasks for ${filter}.`} />
        </div>
      </div>
    </div>
  );
};

export default FilteredTasksPage;
