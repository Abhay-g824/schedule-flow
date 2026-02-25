import { Task } from "@/types/task";
import { TaskItem } from "@/components/TaskItem";
import { cn } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Trash2, CheckCircle2 } from "lucide-react";
import { useState } from "react";

interface TaskListProps {
  tasks: Task[];
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  onUpdate: (id: string, updates: Partial<Task>) => void;
  emptyMessage?: string;
  bulkMode?: boolean;
  selectedTasks?: Set<string>;
  onTaskSelect?: (id: string, selected: boolean) => void;
  onBulkComplete?: (ids: string[]) => void;
  onBulkDelete?: (ids: string[]) => void;
}

export function TaskList({ 
  tasks, 
  onToggle, 
  onDelete, 
  onUpdate, 
  emptyMessage = "No tasks yet",
  bulkMode = false,
  selectedTasks = new Set(),
  onTaskSelect,
  onBulkComplete,
  onBulkDelete
}: TaskListProps) {
  const allSelected = tasks.length > 0 && tasks.every(task => selectedTasks.has(task.id));
  const someSelected = tasks.some(task => selectedTasks.has(task.id));

  const handleSelectAll = () => {
    if (allSelected) {
      tasks.forEach(task => onTaskSelect?.(task.id, false));
    } else {
      tasks.forEach(task => onTaskSelect?.(task.id, true));
    }
  };

  const handleBulkComplete = () => {
    if (onBulkComplete && selectedTasks.size > 0) {
      onBulkComplete(Array.from(selectedTasks));
    }
  };

  const handleBulkDelete = () => {
    if (onBulkDelete && selectedTasks.size > 0) {
      onBulkDelete(Array.from(selectedTasks));
    }
  };

  if (tasks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <div className="h-16 w-16 rounded-full bg-secondary flex items-center justify-center mb-4">
          <svg
            className="h-8 w-8 text-muted-foreground"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
            />
          </svg>
        </div>
        <p className="text-muted-foreground">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {bulkMode && (
        <div className="flex items-center justify-between p-3 bg-secondary/50 rounded-lg border border-border">
          <div className="flex items-center gap-3">
            <Checkbox
              checked={allSelected}
              onCheckedChange={handleSelectAll}
              ref={(el) => {
                if (el) {
                  el.indeterminate = someSelected && !allSelected;
                }
              }}
            />
            <span className="text-sm font-medium">
              {selectedTasks.size > 0 ? `${selectedTasks.size} selected` : "Select tasks"}
            </span>
          </div>
          {selectedTasks.size > 0 && (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleBulkComplete}
                className="gap-2"
              >
                <CheckCircle2 className="h-4 w-4" />
                Complete
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleBulkDelete}
                className="gap-2 text-destructive hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
                Delete
              </Button>
            </div>
          )}
        </div>
      )}
      {tasks.map((task) => (
        <TaskItem
          key={task.id}
          task={task}
          onToggle={onToggle}
          onDelete={onDelete}
          onUpdate={onUpdate}
          bulkMode={bulkMode}
          isSelected={selectedTasks.has(task.id)}
          onSelect={onTaskSelect ? (selected) => onTaskSelect(task.id, selected) : undefined}
        />
      ))}
    </div>
  );
}
