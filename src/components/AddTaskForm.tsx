import { useState } from "react";
import { Plus, Calendar, Flag, X, Clock, Save } from "lucide-react";
import { format } from "date-fns";
import { Priority } from "@/types/task";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { ColorPicker } from "@/components/ColorPicker";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

interface AddTaskFormProps {
  onAdd: (title: string, priority: Priority, dueDate?: Date, color?: string | null, reminderTime?: Date, timeSlotStart?: Date, timeSlotEnd?: Date) => void;
  onSaveAsTemplate?: (title: string, priority: Priority, color?: string | null, timeSlotStart?: Date, timeSlotEnd?: Date, description?: string, category?: string) => Promise<void>;
}

const priorities: { value: Priority; label: string; color: string }[] = [
  { value: "high", label: "High", color: "bg-priority-high" },
  { value: "medium", label: "Medium", color: "bg-priority-medium" },
  { value: "low", label: "Low", color: "bg-priority-low" },
];

export function AddTaskForm({ onAdd, onSaveAsTemplate }: AddTaskFormProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<Priority>("medium");
  const [dueDate, setDueDate] = useState<Date | undefined>();
  const [color, setColor] = useState<string | null>(null);
  const [reminderTime, setReminderTime] = useState<Date | undefined>();
  const [timeSlotStart, setTimeSlotStart] = useState<Date | undefined>();
  const [timeSlotEnd, setTimeSlotEnd] = useState<Date | undefined>();
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [isReminderOpen, setIsReminderOpen] = useState(false);
  const [isTimeSlotOpen, setIsTimeSlotOpen] = useState(false);
  const [isSavingTemplate, setIsSavingTemplate] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (title.trim()) {
      onAdd(title.trim(), priority, dueDate, color, reminderTime, timeSlotStart, timeSlotEnd);
      setTitle("");
      setPriority("medium");
      setDueDate(undefined);
      setColor(null);
      setReminderTime(undefined);
      setTimeSlotStart(undefined);
      setTimeSlotEnd(undefined);
      setIsOpen(false);
    }
  };

  const handleCancel = () => {
    setTitle("");
    setDescription("");
    setPriority("medium");
    setDueDate(undefined);
    setColor(null);
    setReminderTime(undefined);
    setTimeSlotStart(undefined);
    setTimeSlotEnd(undefined);
    setIsOpen(false);
  };

  const handleSaveAsTemplate = async () => {
    if (!title.trim() || !onSaveAsTemplate) return;
    setIsSavingTemplate(true);
    try {
      await onSaveAsTemplate(
        title.trim(), 
        priority, 
        color, 
        timeSlotStart, 
        timeSlotEnd,
        description.trim() || undefined
      );
      setTitle("");
      setDescription("");
      setPriority("medium");
      setColor(null);
      setTimeSlotStart(undefined);
      setTimeSlotEnd(undefined);
      setIsOpen(false);
    } catch (err) {
      console.error("Failed to save template", err);
    } finally {
      setIsSavingTemplate(false);
    }
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className={cn(
          "w-full flex items-center gap-3 p-4 rounded-xl",
          "border-2 border-dashed border-border/60 hover:border-primary/40",
          "text-muted-foreground hover:text-foreground",
          "transition-all duration-200"
        )}
      >
        <div className="h-5 w-5 rounded-full bg-primary/10 flex items-center justify-center">
          <Plus className="h-3 w-3 text-primary" />
        </div>
        <span className="font-medium">Add a task</span>
      </button>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="p-4 rounded-xl bg-card border border-border shadow-card animate-scale-in"
    >
      <Input
        autoFocus
        placeholder="What needs to be done?"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        className="border-0 px-0 text-base font-medium placeholder:text-muted-foreground/60 focus-visible:ring-0"
      />
      
      <Textarea
        placeholder="Add a description (optional)"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        rows={2}
        className="mt-2 border-0 px-0 resize-none text-sm placeholder:text-muted-foreground/60 focus-visible:ring-0"
      />
      
      <div className="space-y-3 mt-4 pt-4 border-t border-border/50">
        <div className="flex items-center gap-2 flex-wrap">
          {/* Priority selector */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 gap-2">
                <div className={cn("h-2 w-2 rounded-full", priorities.find(p => p.value === priority)?.color)} />
                <Flag className="h-3.5 w-3.5" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-40 p-1" align="start">
              {priorities.map((p) => (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => setPriority(p.value)}
                  className={cn(
                    "w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm",
                    "hover:bg-secondary transition-colors",
                    priority === p.value && "bg-secondary"
                  )}
                >
                  <div className={cn("h-2 w-2 rounded-full", p.color)} />
                  {p.label}
                </button>
              ))}
            </PopoverContent>
          </Popover>

          {/* Color picker */}
          <ColorPicker value={color} onChange={setColor} />

          {/* Date picker */}
          <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 gap-2">
                <Calendar className="h-3.5 w-3.5" />
                {dueDate ? format(dueDate, "MMM d") : "Due date"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <CalendarComponent
                mode="single"
                selected={dueDate}
                onSelect={(date) => {
                  setDueDate(date);
                  setIsCalendarOpen(false);
                }}
                initialFocus
                className="pointer-events-auto"
              />
            </PopoverContent>
          </Popover>

          {dueDate && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0 text-muted-foreground"
              onClick={() => setDueDate(undefined)}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          )}

          {/* Reminder time */}
          <Popover open={isReminderOpen} onOpenChange={setIsReminderOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 gap-2">
                <Clock className="h-3.5 w-3.5" />
                {reminderTime ? format(reminderTime, "MMM d, h:mm a") : "Reminder"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-3" align="start">
              <div className="space-y-3">
                <Label className="text-sm">Reminder Date & Time</Label>
                <CalendarComponent
                  mode="single"
                  selected={reminderTime}
                  onSelect={(date) => {
                    if (date) {
                      const now = new Date();
                      const reminder = new Date(date);
                      reminder.setHours(now.getHours());
                      reminder.setMinutes(now.getMinutes());
                      setReminderTime(reminder);
                    }
                  }}
                />
                {reminderTime && (
                  <div className="space-y-2">
                    <Label className="text-xs">Time</Label>
                    <Input
                      type="time"
                      value={format(reminderTime, "HH:mm")}
                      onChange={(e) => {
                        const [hours, minutes] = e.target.value.split(":");
                        if (hours && minutes) {
                          const newReminder = new Date(reminderTime);
                          newReminder.setHours(parseInt(hours));
                          newReminder.setMinutes(parseInt(minutes));
                          setReminderTime(newReminder);
                        }
                      }}
                    />
                  </div>
                )}
              </div>
            </PopoverContent>
          </Popover>

          {reminderTime && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0 text-muted-foreground"
              onClick={() => setReminderTime(undefined)}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          )}

          {/* Time slot */}
          <Popover open={isTimeSlotOpen} onOpenChange={setIsTimeSlotOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 gap-2">
                <Clock className="h-3.5 w-3.5" />
                {timeSlotStart ? `${format(timeSlotStart, "h:mm a")} - ${timeSlotEnd ? format(timeSlotEnd, "h:mm a") : ""}` : "Time slot"}
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
                      value={timeSlotStart ? format(timeSlotStart, "HH:mm") : ""}
                      onChange={(e) => {
                        const [hours, minutes] = e.target.value.split(":");
                        if (hours && minutes) {
                          const date = dueDate || new Date();
                          const start = new Date(date);
                          start.setHours(parseInt(hours));
                          start.setMinutes(parseInt(minutes));
                          setTimeSlotStart(start);
                        }
                      }}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">End Time</Label>
                    <Input
                      type="time"
                      value={timeSlotEnd ? format(timeSlotEnd, "HH:mm") : ""}
                      onChange={(e) => {
                        const [hours, minutes] = e.target.value.split(":");
                        if (hours && minutes) {
                          const date = dueDate || new Date();
                          const end = new Date(date);
                          end.setHours(parseInt(hours));
                          end.setMinutes(parseInt(minutes));
                          setTimeSlotEnd(end);
                        }
                      }}
                    />
                  </div>
                </div>
              </div>
            </PopoverContent>
          </Popover>

          {timeSlotStart && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0 text-muted-foreground"
              onClick={() => {
                setTimeSlotStart(undefined);
                setTimeSlotEnd(undefined);
              }}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>

        <div className="flex items-center justify-between">
          {onSaveAsTemplate && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleSaveAsTemplate}
              disabled={!title.trim() || isSavingTemplate}
              className="gap-2"
            >
              <Save className="h-3.5 w-3.5" />
              {isSavingTemplate ? "Saving..." : "Save as Template"}
            </Button>
          )}
          <div className="flex items-center gap-2 ml-auto">
            <Button type="button" variant="ghost" size="sm" onClick={handleCancel}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={!title.trim()}>
              Add task
            </Button>
          </div>
        </div>
      </div>
    </form>
  );
}
