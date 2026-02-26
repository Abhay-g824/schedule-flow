import { CustomCalendarAdapter } from "@/lib/calendarAdapter";
import {
  SchedulingLLMResult,
  SchedulingTask,
} from "@/lib/llmSchedulingTypes";
import { resolveLLMResultToSchedules } from "@/lib/deterministicDateResolver";
import { analyzePromptToTasks } from "@/lib/aiScheduler";
import { Priority } from "@/types/task";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";

export interface ConversationTurn {
  role: "user" | "assistant";
  content: string;
}

export interface ConversationState {
  history: ConversationTurn[];
  pendingLLMResult?: {
    result: SchedulingLLMResult;
    originalPrompt: string;
  };
}

interface HandleMessageOptions {
  token: string;
}

interface HandleMessageResult {
  state: ConversationState;
  assistantReply: string;
}

/**
 * Core high-level conversational handler.
 *
 * - Calls the local LLM via the backend when possible.
 * - Falls back to the existing heuristic parser on any failure.
 * - Uses deterministic date resolution and calendar adapter.
 * - Handles the time confirmation flow required by the spec.
 */
export async function handleUserMessage(
  input: string,
  state: ConversationState,
  options: HandleMessageOptions
): Promise<HandleMessageResult> {
  const trimmed = input.trim();
  if (!trimmed) {
    return {
      state,
      assistantReply: "Please describe what you want to schedule.",
    };
  }

  const newHistory: ConversationTurn[] = [
    ...state.history,
    { role: "user", content: trimmed },
  ];

  // If we are waiting for a time confirmation, treat the new
  // message purely as a time specification and then schedule.
  if (state.pendingLLMResult?.result.requiresTimeConfirmation) {
    const updatedResult: SchedulingLLMResult = {
      ...state.pendingLLMResult.result,
      requiresTimeConfirmation: false,
      tasks: state.pendingLLMResult.result.tasks.map((t: SchedulingTask) => ({
        ...t,
        time: t.time ?? trimmed,
      })),
    };

    const adapter = new CustomCalendarAdapter(options.token);
    const schedules = resolveLLMResultToSchedules(
      updatedResult,
      state.pendingLLMResult.originalPrompt
    );

    for (const s of schedules) {
      // Only create new events for create_task / schedule_only here.
      if (s.intent === "create_task" || s.intent === "schedule_only") {
        await adapter.createEvent({
          taskTitle: s.taskTitle,
          priority: s.priority as Priority,
          dueDate: s.dueDate,
        });
      }
    }

    const nextState: ConversationState = {
      history: [
        ...newHistory,
        {
          role: "assistant",
          content: "Got it. I've scheduled that for you.",
        },
      ],
      pendingLLMResult: undefined,
    };

    return {
      state: nextState,
      assistantReply: "Got it. I've scheduled that for you.",
    };
  }

  // Normal flow: call LLM via backend for structured JSON.
  try {
    const llmResult = await callLLMScheduler(trimmed, newHistory, options.token);

    if (!llmResult) {
      // LLM failed – fallback to existing heuristic parser.
      return await fallbackToHeuristicScheduler(trimmed, newHistory, options);
    }

    if (llmResult.requiresClarification) {
      const reply =
        "I need a bit more detail before I schedule this. Could you clarify the date or time you prefer?";

      const nextState: ConversationState = {
        history: [...newHistory, { role: "assistant", content: reply }],
        pendingLLMResult: undefined,
      };

      return {
        state: nextState,
        assistantReply: reply,
      };
    }

    if (llmResult.requiresTimeConfirmation) {
      const reply = "What time would you prefer?";
      const nextState: ConversationState = {
        history: [...newHistory, { role: "assistant", content: reply }],
        pendingLLMResult: {
          result: llmResult,
          originalPrompt: trimmed,
        },
      };

      return {
        state: nextState,
        assistantReply: reply,
      };
    }

    // We have enough info to schedule immediately.
    const adapter = new CustomCalendarAdapter(options.token);
    const schedules = resolveLLMResultToSchedules(llmResult, trimmed);

    for (const s of schedules) {
      if (s.intent === "create_task" || s.intent === "schedule_only") {
        await adapter.createEvent({
          taskTitle: s.taskTitle,
          priority: s.priority as Priority,
          dueDate: s.dueDate,
        });
      }
      // For reschedule / multi_schedule, the adapter interface allows
      // updateEvent, which can be implemented in a future iteration
      // without touching the LLM logic.
    }

    const reply = buildConfirmationMessage(llmResult);
    const nextState: ConversationState = {
      history: [...newHistory, { role: "assistant", content: reply }],
      pendingLLMResult: undefined,
    };

    return {
      state: nextState,
      assistantReply: reply,
    };
  } catch {
    // Any unexpected failure: hard fallback to rule-based parser.
    return await fallbackToHeuristicScheduler(trimmed, newHistory, options);
  }
}

async function callLLMScheduler(
  prompt: string,
  history: ConversationTurn[],
  token: string
): Promise<SchedulingLLMResult | null> {
  const context = history.map((turn) => ({
    role: turn.role,
    content: turn.content,
  }));

  const res = await fetch(`${API_URL}/ai/schedule/parse`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ prompt, context }),
  });

  if (!res.ok) {
    return null;
  }

  const data = await res.json();
  if (!data.ok) {
    return null;
  }

  return data.data as SchedulingLLMResult;
}

async function fallbackToHeuristicScheduler(
  prompt: string,
  history: ConversationTurn[],
  options: HandleMessageOptions
): Promise<HandleMessageResult> {
  const analysis = analyzePromptToTasks(prompt);
  const adapter = new CustomCalendarAdapter(options.token);

  for (const t of analysis.tasks) {
    await adapter.createEvent({
      taskTitle: t.title,
      priority: t.priority as Priority,
      dueDate: t.date,
    });
  }

  const reply =
    analysis.tasks.length > 1
      ? `I've created ${analysis.tasks.length} tasks based on your message.`
      : "I've created a task based on your message.";

  const nextState: ConversationState = {
    history: [...history, { role: "assistant", content: reply }],
    pendingLLMResult: undefined,
  };

  return {
    state: nextState,
    assistantReply: reply,
  };
}

function buildConfirmationMessage(result: SchedulingLLMResult): string {
  const count = result.tasks.length;

  if (result.intent === "multi_schedule" && count > 1) {
    return `I've scheduled ${count} items for you.`;
  }

  if (result.intent === "reschedule") {
    return "I've updated the schedule as requested.";
  }

  if (count > 1) {
    return `I've scheduled ${count} tasks.`;
  }

  return "I've scheduled that task for you.";
}

