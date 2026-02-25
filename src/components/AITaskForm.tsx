import { useState } from "react";
import { Sparkles, Loader2 } from "lucide-react";
import { Priority } from "@/types/task";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { parseNaturalLanguage } from "@/lib/nlpParser";
import { analyzePromptToTasks } from "@/lib/aiScheduler";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface AITaskFormProps {
  onAdd: (title: string, priority: Priority, dueDate?: Date, color?: string | null) => void;
}

export function AITaskForm({ onAdd }: AITaskFormProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [preview, setPreview] = useState<{
    title: string;
    date?: Date;
    time?: string;
    priority?: Priority;
  } | null>(null);
  const [previewCount, setPreviewCount] = useState<number>(0);

  const handleInputChange = (value: string) => {
    setInput(value);
    
    // Real-time preview
    if (value.trim().length > 3) {
      try {
        const analysis = analyzePromptToTasks(value);
        const first = analysis.tasks[0];
        if (first) {
          setPreview({
            title: first.title,
            date: first.date,
            priority: first.priority,
          });
          setPreviewCount(analysis.tasks.length);
        } else {
          const parsed = parseNaturalLanguage(value);
          setPreview(parsed);
          setPreviewCount(1);
        }
      } catch {
        const parsed = parseNaturalLanguage(value);
        setPreview(parsed);
        setPreviewCount(1);
      }
    } else {
      setPreview(null);
      setPreviewCount(0);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    setIsProcessing(true);
    
    // Simulate processing delay for better UX
    setTimeout(() => {
      try {
        // Use AI scheduler to support multi-intent prompts,
        // while still falling back to the existing parser if anything fails.
        const analysis = analyzePromptToTasks(input.trim());
        const tasks = analysis.tasks.length
          ? analysis.tasks
          : [
              {
                title: input.trim(),
                priority: "medium" as Priority,
                date: undefined,
              },
            ];

        tasks.forEach((t) => {
          onAdd(t.title, t.priority, t.date);
        });
      } catch {
        const parsed = parseNaturalLanguage(input.trim());
        onAdd(
          parsed.title,
          (parsed.priority as Priority) || "medium",
          parsed.date
        );
      }
      
      setInput("");
      setPreview(null);
      setPreviewCount(0);
      setIsOpen(false);
      setIsProcessing(false);
    }, 500);
  };

  const handleCancel = () => {
    setInput("");
    setPreview(null);
    setIsOpen(false);
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className={cn(
          "w-full flex items-center gap-3 p-4 rounded-xl",
          "border-2 border-dashed border-border/60 hover:border-primary/40",
          "text-muted-foreground hover:text-foreground",
          "transition-all duration-200 bg-card/50"
        )}
      >
        <div className="h-5 w-5 rounded-full bg-primary/10 flex items-center justify-center">
          <Sparkles className="h-3 w-3 text-primary" />
        </div>
        <span className="font-medium">Task through AI</span>
      </button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              Create Task with AI
            </DialogTitle>
            <DialogDescription>
              Describe your task naturally. For example: "today class at 10 am" or "tomorrow meeting at 2pm"
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Input
                autoFocus
                placeholder="e.g., today class at 10 am"
                value={input}
                onChange={(e) => handleInputChange(e.target.value)}
                className="text-base"
                disabled={isProcessing}
              />
              
              {preview && (
                <div className="p-3 rounded-lg bg-secondary/50 border border-border/50 space-y-2 animate-fade-in">
                  <p className="text-sm font-medium text-foreground">
                    Task: <span className="font-semibold">{preview.title}</span>
                  </p>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    {preview.date && (
                      <span>
                        📅 {format(preview.date, "MMM d, yyyy")}
                        {preview.time && ` at ${preview.time}`}
                      </span>
                    )}
                    {preview.priority && (
                      <span className={cn(
                        "px-2 py-0.5 rounded-full",
                        preview.priority === "high" && "bg-priority-high/20 text-priority-high",
                        preview.priority === "medium" && "bg-priority-medium/20 text-priority-medium",
                        preview.priority === "low" && "bg-priority-low/20 text-priority-low"
                      )}>
                        {preview.priority} priority
                      </span>
                    )}
                    {previewCount > 1 && (
                      <span>
                        +{previewCount - 1} more task
                        {previewCount - 1 > 1 ? "s" : ""}
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                onClick={handleCancel}
                disabled={isProcessing}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={!input.trim() || isProcessing}
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Processing...
                  </>
                ) : (
                  "Create Task"
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}





