export type SchedulingIntent =
  | "create_task"
  | "schedule_only"
  | "reschedule"
  | "multi_schedule";

export type SchedulingPriority = "high" | "medium" | "low";

export interface SchedulingTask {
  taskTitle: string;
  dateExpression: string | null;
  month: number | null;
  weekday: string | null;
  weekdayOrdinal: number | null;
  time: string | null;
  priority: SchedulingPriority;
}

export interface SchedulingLLMResult {
  intent: SchedulingIntent;
  tasks: SchedulingTask[];
  requiresTimeConfirmation: boolean;
  requiresClarification: boolean;
}

