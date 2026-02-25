import { Task } from "@/types/task";
import {
    differenceInDays,
    eachDayOfInterval,
    endOfDay,
    format,
    isSameDay,
    startOfDay,
    subDays,
    isToday,
    isYesterday
} from "date-fns";

export interface DailyStat {
    date: string; // "Mon", "Tue" etc
    fullDate: Date;
    completed: number;
    total: number;
}

/**
 * Calculates the current streak of consecutive days with at least one completed task.
 * Uses dueDate as a proxy for completion date (as per plan).
 */
export function calculateStreak(tasks: Task[]): number {
    const completedTasks = tasks.filter(t => t.completed && t.dueDate);

    if (completedTasks.length === 0) return 0;

    // Get unique dates that have at least one completed task
    const completedDates = Array.from(new Set(
        completedTasks.map(t => startOfDay(t.dueDate!).toISOString())
    )).map(d => new Date(d))
        .sort((a, b) => b.getTime() - a.getTime()); // Newest first

    if (completedDates.length === 0) return 0;

    // Check if streak is alive (completed Today or Yesterday)
    const lastCompletion = completedDates[0];
    if (!isToday(lastCompletion) && !isYesterday(lastCompletion)) {
        return 0;
    }

    let streak = 1;
    // Iterate backwards checking for consecutive days
    for (let i = 0; i < completedDates.length - 1; i++) {
        const current = completedDates[i];
        const prev = completedDates[i + 1];

        const diff = differenceInDays(current, prev);

        if (diff === 1) {
            streak++;
        } else {
            break;
        }
    }

    return streak;
}

/**
 * Returns stats for the last 7 days (including today).
 */
export function getWeeklyStats(tasks: Task[]): DailyStat[] {
    const today = new Date();
    const start = subDays(today, 6); // Last 7 days including today

    const days = eachDayOfInterval({ start, end: today });

    return days.map(day => {
        // Find tasks for this day (based on Due Date)
        const daysTasks = tasks.filter(t =>
            t.dueDate && isSameDay(t.dueDate, day)
        );

        return {
            date: format(day, "EEE"), // Mon, Tue...
            fullDate: day,
            completed: daysTasks.filter(t => t.completed).length,
            total: daysTasks.length
        };
    });
}
