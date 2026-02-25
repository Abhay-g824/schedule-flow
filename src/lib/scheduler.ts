import { Task } from "@/types/task";
import { addDays, addMinutes, differenceInMinutes, endOfDay, format, isAfter, isBefore, isSameDay, setHours, setMinutes, startOfDay } from "date-fns";

interface RescheduleUpdate {
    taskId: string;
    updates: Partial<Task>;
}

const WORK_START_HOUR = 9;
const WORK_END_HOUR = 18;
const DEFAULT_TASK_DURATION_MINUTES = 60;

/**
 * Finds tasks that are due before today and are not completed.
 */
export function findOverdueTasks(tasks: Task[]): Task[] {
    const todayStart = startOfDay(new Date());
    return tasks.filter(t => {
        if (t.completed) return false;
        if (!t.dueDate) return false;
        // Check if due date is strictly before today (yesterday or earlier)
        return isBefore(t.dueDate, todayStart);
    });
}

/**
 * Basic slot finder.
 * - Looks at "Today" (or provided date).
 * - Respects WORK_START_HOUR (9am) to WORK_END_HOUR (6pm) if 'date' is today/future.
 * - Or finds gaps between existing tasks.
 */
function findNextAvailableSlot(
    date: Date,
    tasksOnDate: Task[],
    durationMinutes: number
): { start: Date; end: Date } | null {

    // Sort existing tasks by start time
    const sortedTasks = tasksOnDate
        .filter(t => t.timeSlotStart && t.timeSlotEnd)
        .sort((a, b) => (a.timeSlotStart!.getTime() - b.timeSlotStart!.getTime()));

    // Define search window
    const now = new Date();
    let searchStart = setMinutes(setHours(date, WORK_START_HOUR), 0);
    const searchEnd = setMinutes(setHours(date, WORK_END_HOUR), 0);

    // If searching today, ensure we don't schedule in the past
    if (isSameDay(date, now)) {
        if (isAfter(now, searchStart)) {
            // Round up to next 15 min slot
            const remainder = 15 - (now.getMinutes() % 15);
            searchStart = addMinutes(now, remainder);
        }
    }

    // If start is already past end, no slots today
    if (isAfter(searchStart, searchEnd)) return null;

    // Check gaps
    let currentPointer = searchStart;

    for (const task of sortedTasks) {
        if (!task.timeSlotStart || !task.timeSlotEnd) continue;

        // processing task
        if (isBefore(currentPointer, task.timeSlotStart)) {
            // Potential gap
            const gapDuration = differenceInMinutes(task.timeSlotStart, currentPointer);
            if (gapDuration >= durationMinutes) {
                // Found a slot!
                return {
                    start: currentPointer,
                    end: addMinutes(currentPointer, durationMinutes)
                };
            }
        }

        // Move pointer to after this task
        if (isAfter(task.timeSlotEnd, currentPointer)) {
            currentPointer = task.timeSlotEnd;
        }
    }

    // Check final gap after last task
    const finalGap = differenceInMinutes(searchEnd, currentPointer);
    if (finalGap >= durationMinutes) {
        return {
            start: currentPointer,
            end: addMinutes(currentPointer, durationMinutes)
        };
    }

    return null;
}

/**
 * Main function to generate updates.
 * Strategy:
 * 1. Find overdue tasks.
 * 2. Try to schedule them Today.
 * 3. Returns a list of updates to be applied.
 */
export function calculateRescheduleUpdates(allTasks: Task[]): RescheduleUpdate[] {
    const overdue = findOverdueTasks(allTasks);
    if (overdue.length === 0) return [];

    const today = new Date();
    // Tasks already scheduled for today
    const tasksToday = allTasks.filter(t =>
        t.dueDate && isSameDay(t.dueDate, today) && !t.completed
    );

    const updates: RescheduleUpdate[] = [];

    // Virtual timeline: We add rescheduled tasks here so subsequent tasks respect them
    const scheduledSoFar = [...tasksToday];

    for (const task of overdue) {
        // Assume default duration if not set in original task
        let duration = DEFAULT_TASK_DURATION_MINUTES;
        if (task.timeSlotStart && task.timeSlotEnd) {
            duration = differenceInMinutes(task.timeSlotEnd, task.timeSlotStart);
            if (duration <= 15) duration = DEFAULT_TASK_DURATION_MINUTES; // Sanity check
        }

        let slot = findNextAvailableSlot(today, scheduledSoFar, duration);

        // Fallback: If no slot today (e.g. passed working hours), try Tomorrow
        if (!slot) {
            const tomorrow = addDays(today, 1);
            // We need tasks for tomorrow to check conflicts
            const tasksTomorrow = allTasks.filter(t =>
                t.dueDate && isSameDay(t.dueDate, tomorrow) && !t.completed
            );
            // Combine with any we already scheduled for tomorrow in this loop (if we supported multi-day lookahead)
            // For simplicity, just check conflicts against static tomorrow list for now, 
            // but ideally we should track `scheduledSoFar` for tomorrow too.
            // Let's keep `scheduledSoFar` as a flat list of ALL relevant tasks used for checking.

            // To do this right, `findNextAvailableSlot` needs to just filter `scheduledSoFar` for the specific target date.
            // My `findNextAvailableSlot` implementation does: `tasksOnDate.filter...`. 
            // So if I pass `scheduledSoFar` which contains today's tasks, it effectively filters them out when checking tomorrow?
            // Let's look at `findNextAvailableSlot`:
            // `const sortedTasks = tasksOnDate.filter(t => t.timeSlotStart && t.timeSlotEnd).sort...`
            // It DOES NOT check if the task is actually ON `date`. It assumes `tasksOnDate` IS for that date.

            // So I must filter `allTasks` for tomorrow.
            // And any previously rescheduled tasks that moved to tomorrow.

            const tasksOnTomorrow = [
                ...tasksTomorrow,
                // find tasks we just moved to tomorrow in this loop
                ...updates.filter(u => u.updates.dueDate && isSameDay(u.updates.dueDate!, tomorrow)).map(u => ({
                    ...allTasks.find(t => t.id === u.taskId)!,
                    ...u.updates
                } as Task))
            ];

            slot = findNextAvailableSlot(tomorrow, tasksOnTomorrow, duration);
        }

        if (slot) {
            // Determine which day the slot belongs to
            const slotDate = startOfDay(slot.start);

            updates.push({
                taskId: task.id,
                updates: {
                    dueDate: slotDate,
                    timeSlotStart: slot.start,
                    timeSlotEnd: slot.end,
                }
            });
        }
    }

    return updates;
}
