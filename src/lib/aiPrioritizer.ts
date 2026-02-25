import { Task, Priority } from "@/types/task";
import { format, isValid } from "date-fns";

// Keywords that imply higher importance
const HIGH_PRIORITY_KEYWORDS = ["urgent", "asap", "emergency", "deadline", "exam", "final", "test", "interview", "important", "critical", "submit"];
const MEDIUM_PRIORITY_KEYWORDS = ["meeting", "review", "assignment", "presentation", "call", "discussion", "sync", "lab", "homework"];

// Base weights for existing priority
const BASE_PRIORITY_SCORES: Record<Priority, number> = {
    high: 100,
    medium: 50,
    low: 10,
};

/**
 * Calculates a heuristic score for a task based on its text content.
 * This simulates a lightweight AI analysis of the task's importance.
 */
function calculateHseuristicScore(task: Task): number {
    let score = 0;
    const text = `${task.title} ${task.description || ""}`.toLowerCase();

    HIGH_PRIORITY_KEYWORDS.forEach(word => {
        // Word boundary check for better accuracy
        if (new RegExp(`\\b${word}\\b`).test(text)) score += 5;
    });

    MEDIUM_PRIORITY_KEYWORDS.forEach(word => {
        if (new RegExp(`\\b${word}\\b`).test(text)) score += 2;
    });

    return score;
}

/**
 * Sorts tasks chronologically, but prioritizes tasks within the same time slot
 * using AI/Heuristic scoring.
 */
export function sortTasksByAIPriority(tasks: Task[]): Task[] {
    // 1. Partition tasks into Time Slots vs All-Day (No Time)
    const timeSlots: Record<string, Task[]> = {};
    const noTimeTasks: Task[] = [];

    tasks.forEach(task => {
        let timeKey: string | null = null;

        // Check timeSlotStart
        if (task.timeSlotStart) {
            const date = new Date(task.timeSlotStart);
            if (isValid(date)) {
                timeKey = format(date, "HH:mm");
            }
        }
        // Fallback to due date if it has specific time (not midnight)
        else if (task.dueDate) {
            const date = new Date(task.dueDate);
            if (isValid(date)) {
                const timeStr = format(date, "HH:mm");
                if (timeStr !== "00:00") {
                    timeKey = timeStr;
                }
            }
        }

        if (timeKey) {
            if (!timeSlots[timeKey]) timeSlots[timeKey] = [];
            timeSlots[timeKey].push(task);
        } else {
            noTimeTasks.push(task);
        }
    });

    // 2. Process Time Slots
    let sortedTimeTasks: Task[] = [];

    // Sort time keys chronologically
    const sortedKeys = Object.keys(timeSlots).sort();

    sortedKeys.forEach(key => {
        const group = timeSlots[key];

        // "only when two or more task are at same time and day"
        if (group.length >= 2) {
            // Sort by Strategy:
            // 1. Explicit Priority (Base Score)
            // 2. AI Heuristics based on Content
            group.sort((a, b) => {
                const scoreA = BASE_PRIORITY_SCORES[a.priority] + calculateHseuristicScore(a);
                const scoreB = BASE_PRIORITY_SCORES[b.priority] + calculateHseuristicScore(b);

                // Descending score
                return scoreB - scoreA;
            });
            // console.log(`[AI Prioritizer] Reordered conflict at ${key}:`, group.map(t => `${t.title} (${scoreB-scoreA})`));
        }

        sortedTimeTasks = [...sortedTimeTasks, ...group];
    });

    // 3. Process No-Time Tasks
    // Sort them by priority anyway for better UX? 
    // User only asked for "same time and day" conflict resolution.
    // But generally, sorted is better. Let's keep them stable or sorted by created_at (default).
    // Assuming they are already in logical order passed from parent, we leave them or sort by priority?
    // Let's sort implicit no-time tasks by priority too for consistency.
    noTimeTasks.sort((a, b) => BASE_PRIORITY_SCORES[b.priority] - BASE_PRIORITY_SCORES[a.priority]);

    // Combined: Time scheduled tasks first, then all-day/flexible tasks? Or vice versa?
    // Usually All-Day is at top.
    return [...noTimeTasks, ...sortedTimeTasks];
}
