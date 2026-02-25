import { Task, Priority } from "@/types/task";
import { parseNaturalLanguage } from "@/lib/nlpParser";
import {
  addDays,
  isAfter,
  isBefore,
  isSameDay,
  isWeekend,
  startOfDay,
} from "date-fns";
import { calculateRescheduleUpdates } from "@/lib/scheduler";

// Public types for AI task parsing

export type AIPriority = Priority;

export type TaskType =
  | "meeting"
  | "report"
  | "exam"
  | "assignment"
  | "call"
  | "event"
  | "other";

export interface ParsedAITask {
  title: string;
  type: TaskType;
  date?: Date;
  priority: AIPriority;
  time?: string;
  /**
   * Original text segment that produced this task.
   */
  rawSegment: string;
}

export interface MultiTaskParseResult {
  originalInput: string;
  tasks: ParsedAITask[];
}

// Priority detection rules (keyword-based, overrides any model output)

const HIGH_PRIORITY_KEYWORDS = [
  "very important",
  "important",
  "critical",
  "urgent",
  "asap",
  "high priority",
  "immediately",
  "top priority",
  "emergency",
];

const LOW_PRIORITY_KEYWORDS = [
  "not important",
  "low priority",
  "whenever possible",
  "whenever",
  "later",
  "no rush",
  "optional",
];

function applyPriorityRules(
  text: string,
  existing?: Priority
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

// Lightweight local "model" abstraction

interface SchedulingModel {
  analyzePrompt(prompt: string): MultiTaskParseResult;
}

let schedulingModelSingleton: SchedulingModel | null = null;

function getSchedulingModel(): SchedulingModel {
  if (schedulingModelSingleton) {
    return schedulingModelSingleton;
  }

  // For now we always use the heuristic model.
  // A future ONNX-backed implementation can replace this without
  // changing callers, as long as it implements SchedulingModel.
  schedulingModelSingleton = createHeuristicModel();
  return schedulingModelSingleton;
}

function createHeuristicModel(): SchedulingModel {
  return {
    analyzePrompt(prompt: string): MultiTaskParseResult {
      const segments = splitIntoSegments(prompt);
      const tasks: ParsedAITask[] = [];

      for (const segment of segments) {
        const trimmed = segment.trim();
        if (!trimmed) continue;

        // Use existing NLP parser for date/time extraction
        const parsed = parseNaturalLanguage(trimmed);
        const priority = applyPriorityRules(trimmed, parsed.priority);

        const time = (parsed as any).time as string | undefined;

        tasks.push({
          title: parsed.title || trimmed,
          date: parsed.date,
          priority,
          type: inferTaskType(trimmed),
          time,
          rawSegment: trimmed,
        });
      }

      // Fallback: if nothing parsed, create a single generic task
      if (tasks.length === 0 && prompt.trim()) {
        tasks.push({
          title: prompt.trim(),
          date: undefined,
          priority: "medium",
          type: "other",
          rawSegment: prompt.trim(),
        });
      }

      return {
        originalInput: prompt,
        tasks,
      };
    },
  };
}

function splitIntoSegments(input: string): string[] {
  const normalized = input
    .replace(/\s+/g, " ")
    .trim();

  if (!normalized) return [];

  // Split on connectors that usually separate actions.
  const rawSegments = normalized
    .split(/(?:\band\b|\balso\b|,|;|\n)/gi)
    .map((s) => s.trim())
    .filter(Boolean);

  // If splitting produced nothing reasonable, keep the whole input.
  if (rawSegments.length === 0) {
    return [normalized];
  }

  return rawSegments;
}

function inferTaskType(text: string): TaskType {
  const t = text.toLowerCase();

  if (/\b(meeting|meet|sync|standup|stand-up)\b/.test(t)) {
    return "meeting";
  }
  if (/\b(report|doc|documentation|write-up)\b/.test(t)) {
    return "report";
  }
  if (/\b(exam|test|quiz|final)\b/.test(t)) {
    return "exam";
  }
  if (/\b(assignment|homework|submission|submit)\b/.test(t)) {
    return "assignment";
  }
  if (/\b(call|phone|zoom|hangout)\b/.test(t)) {
    return "call";
  }
  if (/\b(event|conference|workshop|webinar)\b/.test(t)) {
    return "event";
  }

  return "other";
}

// Public API for consumers

export function analyzePromptToTasks(prompt: string): MultiTaskParseResult {
  try {
    const model = getSchedulingModel();
    return model.analyzePrompt(prompt);
  } catch {
    // Fail gracefully: fallback to a single parse using existing logic
    const parsed = parseNaturalLanguage(prompt);
    const priority = applyPriorityRules(prompt, parsed.priority);

    return {
      originalInput: prompt,
      tasks: [
        {
          title: parsed.title || prompt.trim(),
          date: parsed.date,
          priority,
          type: inferTaskType(prompt),
          rawSegment: prompt,
        },
      ],
    };
  }
}

// High-level intent normalization API

export interface TaskIntentResult {
  intent: "create_task";
  taskTitle: string;
  date?: string;
  priority: Priority;
  confidence: number;
}

const FILLER_PATTERNS: RegExp[] = [
  /\bvery\b/gi,
  /\bcoming\b/gi,
  /\bplease\b/gi,
  /\bschedule\b/gi,
  /\bset\b/gi,
  /\bcreate\b/gi,
  /\badd\b/gi,
  /\bremind\b/gi,
  /\btask\b/gi,
  /\bdo\b/gi,
  /\bmake\b/gi,
  /\bplan\b/gi,
  /\bneed to\b/gi,
  /\bwe need to\b/gi,
  /\bkindly\b/gi,
];

function normalizeTitle(raw: string): string {
  let text = raw.toLowerCase();

  // Remove filler phrases
  for (const pattern of FILLER_PATTERNS) {
    text = text.replace(pattern, " ");
  }

  // Remove common temporal filler words that might linger in the title
  text = text.replace(
    /\b(today|tomorrow|next|this|month|week|later|end of month|beginning of next month)\b/gi,
    " "
  );

  text = text.replace(/\s+/g, " ").trim();

  // Domain phrase canonicalization
  const phraseReplacements: { pattern: RegExp; replacement: string }[] = [
    { pattern: /\bgen ai class\b/gi, replacement: "GEN AI CLASS" },
    { pattern: /\b(team|project)\s+meeting\b/gi, replacement: "PROJECT MEETING" },
    { pattern: /\bmeeting with team\b/gi, replacement: "TEAM MEETING" },
    { pattern: /\bproject review\b/gi, replacement: "PROJECT REVIEW" },
    { pattern: /\bdoctor (appointment|visit)\b/gi, replacement: "DOCTOR APPOINTMENT" },
    { pattern: /\bsubmit assignment\b/gi, replacement: "ASSIGNMENT SUBMISSION" },
    { pattern: /\bassignment submission\b/gi, replacement: "ASSIGNMENT SUBMISSION" },
    { pattern: /\bprepare for exam\b/gi, replacement: "EXAM PREPARATION" },
    { pattern: /\bexam preparation\b/gi, replacement: "EXAM PREPARATION" },
  ];

  for (const { pattern, replacement } of phraseReplacements) {
    if (pattern.test(text)) {
      return replacement;
    }
  }

  // Generic fallback: keep multi-word entities intact but uppercase and trim
  if (!text) {
    return raw.trim().toUpperCase();
  }

  return text.toUpperCase();
}

export function parsePromptToIntent(prompt: string): TaskIntentResult {
  const trimmed = prompt.trim();
  if (!trimmed) {
    return {
      intent: "create_task",
      taskTitle: "",
      date: undefined,
      priority: "medium",
      confidence: 0,
    };
  }

  const parsed = parseNaturalLanguage(trimmed);
  const priority = applyPriorityRules(trimmed, parsed.priority as Priority | undefined);
  const taskTitle = normalizeTitle(parsed.title || trimmed);

  let confidence = 0.8;
  if (!parsed.date) {
    confidence = 0.6;
  }

  return {
    intent: "create_task",
    taskTitle,
    date: parsed.date ? parsed.date.toISOString() : undefined,
    priority,
    confidence,
  };
}

// Smart rescheduling with user preferences

export interface UserSchedulingPreferences {
  /**
   * If true, missed tasks will be moved to the nearest weekday.
   */
  avoidWeekends?: boolean;
  /**
   * Preferred workday start hour (24h, local time).
   */
  workdayStartHour?: number;
  /**
   * Preferred workday end hour (24h, local time).
   */
  workdayEndHour?: number;
}

export interface SmartRescheduleOptions {
  preferences?: UserSchedulingPreferences;
  /**
   * Date/time from which to start searching for new slots.
   * Defaults to "now".
   */
  startFrom?: Date;
}

export interface SmartRescheduleResult {
  updates: {
    taskId: string;
    updates: Partial<Task>;
  }[];
  /**
   * Heuristic confidence score in \[0, 1].
   */
  confidence: number;
}

export function smartRescheduleOverdueTasks(
  allTasks: Task[],
  options: SmartRescheduleOptions = {}
): SmartRescheduleResult {
  const preferences = options.preferences || {};
  const startFrom = options.startFrom ? new Date(options.startFrom) : new Date();

  const avoidWeekends = !!preferences.avoidWeekends;
  const workdayStartHour = preferences.workdayStartHour ?? 9;
  const workdayEndHour = preferences.workdayEndHour ?? 18;

  try {
    // Overdue is always computed relative to "today", to stay in sync
    // with the existing `findOverdueTasks` implementation that powers
    // the overdue counter in the UI. The `startFrom` date only affects
    // where we *reschedule* tasks, not which ones are considered overdue.
    const todayStart = startOfDay(new Date());

    const overdue = allTasks.filter((task) => {
      if (task.completed) return false;
      if (!task.dueDate) return false;
      const dueStart = startOfDay(task.dueDate);
      return isBefore(dueStart, todayStart);
    });

    if (overdue.length === 0) {
      return { updates: [], confidence: 1 };
    }

    // Delegate base scheduling to existing logic for backward compatibility,
    // but anchor the search to `startFrom` so that downstream adjustments
    // never move tasks earlier than the user-selected date.
    const baseUpdates = calculateRescheduleUpdates(allTasks, startFrom);

    const adjustedUpdates = baseUpdates.map((update) => {
      const next = { ...update, updates: { ...update.updates } };

      if (!next.updates.dueDate) {
        return next;
      }

      let targetDate = startOfDay(next.updates.dueDate);

      // Never move tasks earlier than the chosen `startFrom` date.
      const minDate = startOfDay(startFrom);
      if (isBefore(targetDate, minDate)) {
        targetDate = minDate;
      }

      if (avoidWeekends) {
        while (isWeekend(targetDate)) {
          targetDate = startOfDay(addDays(targetDate, 1));
        }
      }

      // Align time slots to preferred working hours if present.
      if (next.updates.timeSlotStart && next.updates.timeSlotEnd) {
        const durationMs =
          next.updates.timeSlotEnd.getTime() -
          next.updates.timeSlotStart.getTime();

        const alignedStart = new Date(targetDate);
        alignedStart.setHours(workdayStartHour, 0, 0, 0);

        const alignedEnd = new Date(
          alignedStart.getTime() + Math.max(durationMs, 15 * 60 * 1000)
        );

        next.updates.dueDate = startOfDay(alignedStart);
        next.updates.timeSlotStart = alignedStart;
        next.updates.timeSlotEnd = alignedEnd;
      } else {
        const alignedStart = new Date(targetDate);
        alignedStart.setHours(workdayStartHour, 0, 0, 0);
        const alignedEnd = new Date(alignedStart.getTime() + 60 * 60 * 1000);

        next.updates.dueDate = startOfDay(alignedStart);
        next.updates.timeSlotStart = alignedStart;
        next.updates.timeSlotEnd = alignedEnd;
      }

      return next;
    });

    const successful = adjustedUpdates.filter((u) => !!u.updates.timeSlotStart);
    const confidence =
      overdue.length === 0
        ? 1
        : Math.min(
            1,
            Math.max(
              0,
              successful.length / overdue.length
            )
          );

    return {
      updates: adjustedUpdates,
      confidence,
    };
  } catch {
    // Any unexpected failure falls back to "no-op" with low confidence.
    return {
      updates: [],
      confidence: 0,
    };
  }
}

