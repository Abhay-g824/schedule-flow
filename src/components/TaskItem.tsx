import { useState } from "react";
import { format } from "date-fns";
import { Calendar, Trash2, Flag, Pencil, ChevronDown, ChevronUp, Clock } from "lucide-react";
import { Task, Priority } from "@/types/task";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { ColorPicker } from "@/components/ColorPicker";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";

interface TaskItemProps {
  task: Task;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  onUpdate: (id: string, updates: Partial<Task>) => void;
  bulkMode?: boolean;
  isSelected?: boolean;
  onSelect?: (selected: boolean) => void;
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

export function TaskItem({ task, onToggle, onDelete, onUpdate, bulkMode = false, isSelected = false, onSelect }: TaskItemProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);
  const [editTitle, setEditTitle] = useState(task.title);
  const [editDescription, setEditDescription] = useState(task.description || "");
  const [editPriority, setEditPriority] = useState<Priority>(task.priority);
  const [editDueDate, setEditDueDate] = useState<Date | undefined>(task.dueDate);
  const [editColor, setEditColor] = useState<string | null>(task.color || null);
  const [editTimeSlotStart, setEditTimeSlotStart] = useState<Date | undefined>(task.timeSlotStart);
  const [editTimeSlotEnd, setEditTimeSlotEnd] = useState<Date | undefined>(task.timeSlotEnd);
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [isTimeSlotOpen, setIsTimeSlotOpen] = useState(false);

  const descriptionPreview = task.description ? (task.description.length > 100 ? task.description.substring(0, 100) + "..." : task.description) : null;

  const openEditor = () => {
    setEditTitle(task.title);
    setEditDescription(task.description || "");
    setEditPriority(task.priority);
    setEditDueDate(task.dueDate);
    setEditColor(task.color || null);
    setEditTimeSlotStart(task.timeSlotStart);
    setEditTimeSlotEnd(task.timeSlotEnd);
    setIsEditOpen(true);
  };

  const handleSave = () => {
    if (!editTitle.trim()) return;
    onUpdate(task.id, {
      title: editTitle.trim(),
      description: editDescription.trim() || undefined,
      priority: editPriority,

      dueDate: editDueDate,
      color: editColor || undefined,
      timeSlotStart: editTimeSlotStart,
      timeSlotEnd: editTimeSlotEnd
    });
    setIsEditOpen(false);
  };

  return (
    <>
      <div
        className={cn(
          "group flex items-start gap-4 p-4 rounded-xl bg-card border border-border/50",
          "transition-all duration-200 animate-slide-in",
          "hover:shadow-card hover:border-border",
          task.completed && "opacity-60"
        )}
        style={task.color ? {
          borderLeftColor: task.color,
          borderLeftWidth: '4px',
          borderLeftStyle: 'solid',
          borderTopLeftRadius: '0.75rem',
          borderBottomLeftRadius: '0.75rem'
        } : undefined}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {bulkMode ? (
          <Checkbox
            checked={isSelected}
            onCheckedChange={(checked) => onSelect?.(checked === true)}
            className="mt-0.5"
          />
        ) : (
          <Checkbox
            checked={task.completed}
            onCheckedChange={() => onToggle(task.id)}
            className="mt-0.5"
          />
        )}

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
            <div className="mt-1">
              {isDescriptionExpanded || task.description.length <= 100 ? (
                <p className={cn(
                  "text-sm text-muted-foreground",
                  task.completed && "task-complete"
                )}>
                  {task.description}
                </p>
              ) : (
                <p className={cn(
                  "text-sm text-muted-foreground",
                  task.completed && "task-complete"
                )}>
                  {descriptionPreview}
                </p>
              )}
              {task.description.length > 100 && (
                <button
                  type="button"
                  onClick={() => setIsDescriptionExpanded(!isDescriptionExpanded)}
                  className="text-xs text-primary hover:underline mt-1 flex items-center gap-1"
                >
                  {isDescriptionExpanded ? (
                    <>
                      Show less <ChevronUp className="h-3 w-3" />
                    </>
                  ) : (
                    <>
                      Show more <ChevronDown className="h-3 w-3" />
                    </>
                  )}
                </button>
              )}
            </div>
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

            {(task.timeSlotStart || task.timeSlotEnd) && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground bg-secondary/50 px-2 py-0.5 rounded-full">
                <Clock className="h-3 w-3" />
                <span>
                  {task.timeSlotStart ? format(task.timeSlotStart, "h:mm a") : ""}
                  {task.timeSlotStart && task.timeSlotEnd ? " - " : ""}
                  {task.timeSlotEnd ? format(task.timeSlotEnd, "h:mm a") : ""}
                </span>
              </div>
            )}
          </div>
        </div>

        {!bulkMode && (
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className={cn(
                "h-8 w-8 text-muted-foreground hover:text-foreground",
                "opacity-0 transition-opacity duration-200",
                isHovered && "opacity-100"
              )}
              onClick={openEditor}
            >
              <Pencil className="h-4 w-4" />
            </Button>
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
        )}
      </div>

      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>Edit task</DialogTitle>
            <DialogDescription>Rewrite the task, change priority, or adjust the due date.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Task Title</label>
              <Input
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                placeholder="Task title"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Description</label>
              <Textarea
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                placeholder="Add a description (optional)"
                rows={4}
                className="resize-none"
              />
            </div>

            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Priority:</span>
                <div className="flex items-center gap-2">
                  {(["high", "medium", "low"] as Priority[]).map((p) => (
                    <Button
                      key={p}
                      type="button"
                      variant={editPriority === p ? "default" : "outline"}
                      size="sm"
                      onClick={() => setEditPriority(p)}
                      className="capitalize"
                    >
                      {p}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Color:</span>
                <ColorPicker value={editColor} onChange={setEditColor} />
              </div>

              <div className="flex items-center gap-2">
                <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="gap-2">
                      <Calendar className="h-4 w-4" />
                      {editDueDate ? format(editDueDate, "MMM d") : "Pick a date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <CalendarComponent
                      mode="single"
                      selected={editDueDate}
                      onSelect={(date) => {
                        setEditDueDate(date);
                        setIsCalendarOpen(false);
                      }}
                      initialFocus
                      className="pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
                {editDueDate && (
                  <Button variant="ghost" size="sm" onClick={() => setEditDueDate(undefined)}>
                    Clear date
                  </Button>
                )}
              </div>

              <div className="flex items-center gap-2">
                <Popover open={isTimeSlotOpen} onOpenChange={setIsTimeSlotOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="gap-2">
                      <Clock className="h-4 w-4" />
                      {editTimeSlotStart ? `${format(editTimeSlotStart, "h:mm a")} - ${editTimeSlotEnd ? format(editTimeSlotEnd, "h:mm a") : ""}` : "Time slot"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-3" align="start">
                    <div className="space-y-3">
                      <Label className="text-sm">Time Block</Label>
                      <div className="space-y-2">
                        <div>
                          <Label className="text-xs">Start Time</Label>
                          <Input
                            type="time"
                            value={editTimeSlotStart ? format(editTimeSlotStart, "HH:mm") : ""}
                            onChange={(e) => {
                              const [hours, minutes] = e.target.value.split(":");
                              if (hours && minutes) {
                                const date = editDueDate || new Date();
                                const start = new Date(date);
                                start.setHours(parseInt(hours));
                                start.setMinutes(parseInt(minutes));
                                setEditTimeSlotStart(start);
                              }
                            }}
                          />
                        </div>
                        <div>
                          <Label className="text-xs">End Time</Label>
                          <Input
                            type="time"
                            value={editTimeSlotEnd ? format(editTimeSlotEnd, "HH:mm") : ""}
                            onChange={(e) => {
                              const [hours, minutes] = e.target.value.split(":");
                              if (hours && minutes) {
                                const date = editDueDate || new Date();
                                const end = new Date(date);
                                end.setHours(parseInt(hours));
                                end.setMinutes(parseInt(minutes));
                                setEditTimeSlotEnd(end);
                              }
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  </PopoverContent>
                </Popover>

                {editTimeSlotStart && (
                  <Button variant="ghost" size="sm" onClick={() => {
                    setEditTimeSlotStart(undefined);
                    setEditTimeSlotEnd(undefined);
                  }}>
                    Clear time
                  </Button>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setIsEditOpen(false)}>Cancel</Button>
              <Button onClick={handleSave} disabled={!editTitle.trim()}>Save changes</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
