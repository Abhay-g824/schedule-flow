import { useState } from "react";
import { useTasks } from "@/hooks/useTasks";
import { calculateRescheduleUpdates, findOverdueTasks } from "@/lib/scheduler";
import { smartRescheduleOverdueTasks } from "@/lib/aiScheduler";
import { Button } from "@/components/ui/button";
import { RotateCw, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function SmartRescheduleButton() {
    const { tasks, updateTask } = useTasks();
    const [isProcessing, setIsProcessing] = useState(false);
    const [isOpen, setIsOpen] = useState(false);
    const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
    const [selectedTime, setSelectedTime] = useState("09:00");

    const overdueCount = findOverdueTasks(tasks).length;

    const performReschedule = async (startDate: Date) => {
        setIsProcessing(true);
        try {
      // Try AI-powered smart rescheduling first, while falling back
      // to the existing scheduler to preserve current behavior.
      const aiResult = smartRescheduleOverdueTasks(tasks, {
        startFrom: startDate,
        preferences: {
          avoidWeekends: true,
          workdayStartHour: 9,
          workdayEndHour: 18,
        },
      });

      const updates =
        aiResult.updates.length > 0
          ? aiResult.updates
          : calculateRescheduleUpdates(tasks, startDate);

            if (updates.length === 0) {
                alert("Could not find free slots for overdue tasks starting from selected time.");
                return;
            }

            let successCount = 0;
            for (const update of updates) {
                await updateTask(update.taskId, update.updates);
                successCount++;
            }
            console.log(`Rescheduled ${successCount} tasks.`);
            setIsOpen(false);
        } catch (error) {
            console.error(error);
        } finally {
            setIsProcessing(false);
        }
    };

    const handleAutoReschedule = () => {
        performReschedule(new Date());
    };

    const handleManualReschedule = () => {
        if (!selectedDate || !selectedTime) return;

        const [hours, minutes] = selectedTime.split(":").map(Number);
        const startDateTime = new Date(selectedDate);
        startDateTime.setHours(hours, minutes, 0, 0);

        performReschedule(startDateTime);
    };

    if (overdueCount === 0) return null;

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                <Button
                    size="sm"
                    className="gap-2 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white border-0"
                >
                    <Sparkles className="h-4 w-4" />
                    Reschedule {overdueCount} Overdue
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Reschedule {overdueCount} Tasks</DialogTitle>
                    <DialogDescription>
                        Choose how you want to reschedule your overdue tasks.
                    </DialogDescription>
                </DialogHeader>

                <div className="flex flex-col gap-6 py-4">
                    {/* Option 1: Auto */}
                    <div className="p-4 rounded-lg bg-secondary/50 border border-border">
                        <h4 className="font-semibold mb-2 flex items-center gap-2">
                            <RotateCw className="h-4 w-4 text-primary" />
                            Auto-Schedule (Next Available)
                        </h4>
                        <p className="text-sm text-muted-foreground mb-4">
                            Automatically find the earliest free slots starting Now (or Tomorrow if today is full).
                        </p>
                        <Button
                            onClick={handleAutoReschedule}
                            disabled={isProcessing}
                            className="w-full"
                        >
                            {isProcessing ? "Processing..." : "Auto Reschedule"}
                        </Button>
                    </div>

                    <div className="relative">
                        <div className="absolute inset-0 flex items-center">
                            <span className="w-full border-t" />
                        </div>
                        <div className="relative flex justify-center text-xs uppercase">
                            <span className="bg-background px-2 text-muted-foreground">Or pick a time</span>
                        </div>
                    </div>

                    {/* Option 2: Manual */}
                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Date</Label>
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <Button
                                            variant={"outline"}
                                            className={cn(
                                                "w-full justify-start text-left font-normal",
                                                !selectedDate && "text-muted-foreground"
                                            )}
                                        >
                                            <CalendarIcon className="mr-2 h-4 w-4" />
                                            {selectedDate ? format(selectedDate, "PPP") : <span>Pick a date</span>}
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-auto p-0">
                                        <Calendar
                                            mode="single"
                                            selected={selectedDate}
                                            onSelect={setSelectedDate}
                                            initialFocus
                                        />
                                    </PopoverContent>
                                </Popover>
                            </div>
                            <div className="space-y-2">
                                <Label>Start Time</Label>
                                <Input
                                    type="time"
                                    value={selectedTime}
                                    onChange={(e) => setSelectedTime(e.target.value)}
                                />
                            </div>
                        </div>
                        <Button
                            onClick={handleManualReschedule}
                            disabled={isProcessing || !selectedDate}
                            variant="secondary"
                            className="w-full"
                        >
                            Reschedule from this time
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
