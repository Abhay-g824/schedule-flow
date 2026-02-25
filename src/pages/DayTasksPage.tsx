import { useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { format, isSameDay, parseISO, isValid } from "date-fns";
import { useTasks } from "@/hooks/useTasks";
import { AddTaskForm } from "@/components/AddTaskForm";
import { AITaskForm } from "@/components/AITaskForm";
import { TaskList } from "@/components/TaskList";
import { cn } from "@/lib/utils";
import { sortTasksByAIPriority } from "@/lib/aiPrioritizer";

const DayTasksPage = () => {
  const { date: dateParam } = useParams();
  const { tasks, addTask, toggleTask, deleteTask, updateTask } = useTasks();

  const parsedDate = dateParam ? parseISO(dateParam) : null;
  const isDateValid = parsedDate && isValid(parsedDate);

  const dayTasks = useMemo(() => {
    if (!isDateValid || !parsedDate) return [];
    const filtered = tasks.filter((task) => task.dueDate && isSameDay(task.dueDate, parsedDate));
    return sortTasksByAIPriority(filtered);
  }, [tasks, parsedDate, isDateValid]);

  const headingDate = isDateValid && parsedDate ? format(parsedDate, "MMMM d, yyyy") : "Invalid date";

  return (
    <div className="app-background min-h-screen">
      <div className="p-8">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-2xl font-display font-semibold text-foreground mb-2">Tasks for {headingDate}</h2>
          <p className="text-muted-foreground mb-8">
            {isDateValid ? `${dayTasks.filter(t => !t.completed).length} active, ${dayTasks.filter(t => t.completed).length} completed` : "Please provide a valid date."}
          </p>

          {isDateValid && (
            <>
              <div className="mb-6 space-y-3">
                <AddTaskForm onAdd={(title, priority, dueDate) => addTask(title, priority, dueDate ?? parsedDate)} />
                <AITaskForm onAdd={(title, priority, dueDate) => addTask(title, priority, dueDate ?? parsedDate)} />
              </div>

              <TaskList
                tasks={dayTasks}
                onToggle={toggleTask}
                onDelete={deleteTask}
                onUpdate={updateTask}
                emptyMessage="No tasks scheduled for this date."
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default DayTasksPage;
