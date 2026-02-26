import { parseNaturalLanguage } from "@/lib/nlpParser";
import { Priority } from "@/types/task";
import {
  SchedulingLLMResult,
  SchedulingTask,
  SchedulingIntent,
} from "@/lib/llmSchedulingTypes";

export interface ResolvedScheduledTask {
  taskTitle: string;
  intent: SchedulingIntent;
  priority: Priority;
  dueDate?: Date;
  time?: string | null;
}

/**
 * Deterministic bridge between LLM JSON output and the existing
 * date computation logic. The LLM never does date math – it only
 * tells us *what* to schedule. We then feed a synthesized natural
 * language string into the existing parser so all date resolution
 * stays deterministic and testable.
 */
export function resolveLLMResultToSchedules(
  llmResult: SchedulingLLMResult,
  originalPrompt: string
): ResolvedScheduledTask[] {
  const results: ResolvedScheduledTask[] = [];

  for (const task of llmResult.tasks) {
    const schedule = resolveSingleTask(llmResult.intent, task, originalPrompt);
    results.push(schedule);
  }

  return results;
}

function resolveSingleTask(
  intent: SchedulingIntent,
  task: SchedulingTask,
  originalPrompt: string
): ResolvedScheduledTask {
  // Build a deterministic mini-phrase that encodes what the model
  // extracted, without trusting it for date math.
  let phraseParts: string[] = [];

  if (task.dateExpression) {
    phraseParts.push(task.dateExpression);
  }

  if (task.weekday && !task.dateExpression) {
    phraseParts.push(task.weekday);
  }

  if (task.month !== null && !task.dateExpression) {
    // Encode numeric month as "5th month", etc.
    phraseParts.push(`${task.month} month`);
  }

  if (task.weekdayOrdinal !== null && task.weekday) {
    phraseParts.unshift(`${task.weekdayOrdinal} ${task.weekday}`);
  }

  if (task.time) {
    phraseParts.push(`at ${task.time}`);
  }

  // If we didn't get anything specific, fall back to the whole prompt.
  const phrase =
    phraseParts.length > 0 ? phraseParts.join(" ") : originalPrompt;

  const parsed = parseNaturalLanguage(phrase);

  const priority = normalizePriorityFromText(
    originalPrompt,
    task.priority as Priority
  );

  // Respect "only schedule" semantics: never modify the title itself.
  const title =
    intent === "schedule_only" ? task.taskTitle : task.taskTitle || originalPrompt;

  return {
    taskTitle: title,
    intent,
    priority,
    dueDate: parsed.date,
    time: parsed.time ?? task.time,
  };
}

const HIGH_PRIORITY_KEYWORDS = [
  "very important",
  "important",
  "critical",
  "urgent",
  "imp",
  "asap",
];

const LOW_PRIORITY_KEYWORDS = ["optional", "later", "no rush"];

function normalizePriorityFromText(
  text: string,
  existing: Priority | undefined
): Priority {
  const normalized = text.toLowerCase();

  for (const keyword of HIGH_PRIORITY_KEYWORDS) {
    if (normalized.includes(keyword)) {
      return "high";
    }
  }

  for (const keyword of LOW_PRIORITY_KEYWORDS) {
    if (normalized.includes(keyword)) {
      return "low";
    }
  }

  return existing || "medium";
}

