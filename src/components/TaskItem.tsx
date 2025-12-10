import { useState } from "react";
import { format } from "date-fns";
import { Calendar, Trash2, Flag } from "lucide-react";
import { Task, Priority } from "@/types/task";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface TaskItemProps {
  task: Task;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
}

const priorityColors: Record<Priority, string> = {
  high: "text-priority-high",
  medium: "text-priority-medium",
  low: "text-priority-low",
};

const priorityLabels: Record<Priority, string> = {
  high: "High",
  medium: "Medium",
  low: "Low",
};

export function TaskItem({ task, onToggle, onDelete }: TaskItemProps) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div
      className={cn(
        "group flex items-start gap-4 p-4 rounded-xl bg-card border border-border/50",
        "transition-all duration-200 animate-slide-in",
        "hover:shadow-card hover:border-border",
        task.completed && "opacity-60"
      )}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <Checkbox
        checked={task.completed}
        onCheckedChange={() => onToggle(task.id)}
        className="mt-0.5"
      />
      
      <div className="flex-1 min-w-0">
        <h3
          className={cn(
            "font-medium text-foreground transition-all duration-200",
            task.completed && "task-complete"
          )}
        >
          {task.title}
        </h3>
        
        {task.description && (
          <p className={cn(
            "text-sm text-muted-foreground mt-1",
            task.completed && "task-complete"
          )}>
            {task.description}
          </p>
        )}
        
        <div className="flex items-center gap-3 mt-2">
          <div className={cn("flex items-center gap-1 text-xs", priorityColors[task.priority])}>
            <Flag className="h-3 w-3" />
            <span>{priorityLabels[task.priority]}</span>
          </div>
          
          {task.dueDate && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Calendar className="h-3 w-3" />
              <span>{format(task.dueDate, "MMM d")}</span>
            </div>
          )}
        </div>
      </div>
      
      <Button
        variant="ghost"
        size="icon"
        className={cn(
          "h-8 w-8 text-muted-foreground hover:text-destructive",
          "opacity-0 transition-opacity duration-200",
          isHovered && "opacity-100"
        )}
        onClick={() => onDelete(task.id)}
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
}
