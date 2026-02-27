import ollama from "ollama";

// Default to qwen3:4b as the local conversational model,
// but allow overriding via env if needed.
const DEFAULT_MODEL = process.env.OLLAMA_SCHEDULER_MODEL || "qwen3:4b";

/**
 * Legacy structured scheduling parser used by /ai/schedule/parse.
 * Kept for backwards compatibility with the deterministic pipeline.
 */
export async function callSchedulingModel(prompt, context = null) {
  const messages = [];

  messages.push({
    role: "system",
    content:
      "You are a lightweight scheduling assistant. Extract structured task and scheduling information only. " +
      "Never compute concrete calendar dates. You must answer with STRICT JSON ONLY, no prose.",
  });

  if (context && Array.isArray(context) && context.length > 0) {
    for (const turn of context) {
      if (turn.role === "user" || turn.role === "assistant") {
        messages.push({
          role: turn.role,
          content: String(turn.content ?? ""),
        });
      }
    }
  }

  messages.push({
    role: "user",
    content: buildSchedulingPrompt(prompt),
  });

  const response = await ollama.chat({
    model: DEFAULT_MODEL,
    messages,
    stream: false,
    options: {
      temperature: 0,
      top_p: 0.9,
      num_predict: 200
    },
  });

  const content = response?.message?.content ?? "";
  return content;
}

function buildSchedulingPrompt(userInput) {
  return (
    "You are a scheduling parser. Given the user's message, extract tasks and scheduling fields. " +
    "Follow these rules strictly:\n" +
    "- Do NOT compute actual dates. Never convert expressions like 'next monday' into concrete dates.\n" +
    "- Only extract structured fields describing the request.\n" +
    "- Support multiple tasks in one message.\n" +
    "- Support intents: create_task, schedule_only, reschedule, multi_schedule.\n" +
    "- Respect 'only schedule' instructions: do not change the task title, only attach scheduling info.\n" +
    "- If time is missing but scheduling is requested, set requiresTimeConfirmation=true.\n" +
    "- If the request is ambiguous, set requiresClarification=true and avoid guessing.\n" +
    "- Map priority words to: high, medium, low.\n" +
    "- Support weekday and month names and abbreviations, ordinal weekdays, numeric months, and time formats like '10 pm' or '22:00'.\n\n" +
    "Priority rules:\n" +
    "- HIGH: important, very important, urgent, imp, critical\n" +
    "- LOW: optional, later, no rush\n" +
    "- Otherwise: medium\n\n" +
    "You MUST respond with JSON ONLY in this exact schema:\n" +
    '{\n' +
    '  "intent": "create_task" | "schedule_only" | "reschedule" | "multi_schedule",\n' +
    '  "tasks": [\n' +
    "    {\n" +
    '      "taskTitle": string,\n' +
    '      "dateExpression": string | null,\n' +
    '      "month": number | null,\n' +
    '      "weekday": string | null,\n' +
    '      "weekdayOrdinal": number | null,\n' +
    '      "time": string | null,\n' +
    '      "priority": "high" | "medium" | "low"\n' +
    "    }\n" +
    "  ],\n" +
    '  "requiresTimeConfirmation": boolean,\n' +
    '  "requiresClarification": boolean\n' +
    "}\n\n" +
    "Never include explanations or any text outside the JSON.\n\n" +
    "User message:\n" +
    String(userInput ?? "")
  );
}

/**
 * Conversational + structured assistant used by /ai/schedule.
 *
 * It behaves like a lightweight ChatGPT-style assistant while always
 * returning STRICT JSON in the following schema:
 *
 * {
 *   "assistant_message": "Conversational reply shown to user",
 *   "action": {
 *       "type": "create_task" | "clarify" | "none",
 *       "payload": {
 *           "title": "STRING",
 *           "start": "ISO_DATE_STRING",
 *           "end": "ISO_DATE_STRING",
 *           "priority": "low" | "medium" | "high"
 *       }
 *   }
 * }
 */
export async function callConversationalSchedulingModel(
  message,
  contextTurns = []
) {
  const messages = [];

  messages.push({
    role: "system",
    content: `You are a confident, friendly, and highly interactive conversational scheduling assistant.

You MUST return exactly one valid JSON object:
{
  "assistant_message": string,
  "action": {
    "type": "propose_task" | "propose_plan" | "clarify" | "none" | "create_task",
    "payload": object
  }
}

Top-level rules:
- "assistant_message" is a short, friendly plain-text reply (no markdown).
- Always restate what you understood (task, date, time) in "assistant_message" and then ask a clear follow-up question or confirmation.
- End most replies with a question that helps the user refine or confirm the schedule.
- "action.type" chooses what the backend will do.
- "action.payload" MUST strictly follow the shape for that type below.
- Never include any text before or after the JSON.

Payload shapes (these MUST be followed exactly):

If action.type === "propose_task":
{
  "assistant_message": string,
  "action": {
    "type": "propose_task",
    "payload": {
      "title": string,
      "suggested_start": string,  // ISO 8601 date-time
      "suggested_end": string,    // ISO 8601 date-time
      "priority": "low" | "medium" | "high"
    }
  }
}

If action.type === "create_task":
{
  "assistant_message": string,
  "action": {
    "type": "create_task",
    "payload": {
      "title": string,
      "start": string,  // ISO 8601 date-time
      "end": string,    // ISO 8601 date-time
      "priority": "low" | "medium" | "high"
    }
  }
}

If action.type === "propose_plan":
{
  "assistant_message": string,
  "action": {
    "type": "propose_plan",
    "payload": {
      "plan_title": string,
      "tasks": [
        {
          "title": string,
          "start": string,  // ISO 8601 date-time
          "end": string,    // ISO 8601 date-time
          "priority": "low" | "medium" | "high"
        }
      ]
    }
  }
}

If action.type === "clarify":
{
  "assistant_message": string,
  "action": {
    "type": "clarify",
    "payload": {}
  }
}

If action.type === "none":
{
  "assistant_message": string,
  "action": {
    "type": "none",
    "payload": {}
  }
}

Scheduling behavior rules:

1) If the user provides:
   - A task/topic AND
   - A recognizable date expression (today, tomorrow, weekday, numeric date) AND
   - A recognizable time expression (10am, 4 pm, 14:00)
   → You MUST return action.type = "propose_task". Do NOT ask for clarification.

2) If only date is missing but task + time exists:
   Assume "today" unless that time has already passed, then assume "tomorrow".

3) If only time is missing but task + date exists:
   Suggest 4:00 PM for weekdays, 10:00 AM for weekends. Duration default = 1 hour.

4) If both date and time are missing but a task/topic is given:
   Suggest a reasonable default slot tomorrow at 4:00 PM using "propose_task".

5) Only use "clarify" when the task itself is missing or completely ambiguous.

6) Always ask the user to confirm before final creation. Never claim something is already scheduled.

7) For weekly plans (e.g. "plan a chest week for this week", "plan my study schedule for this week", "create a weekly workout plan"):
   - Use action.type = "propose_plan".
   - "plan_title" should summarize the plan (e.g. "Chest workout week plan", "Weekly study plan for X").
   - "tasks" should contain multiple blocks across the week with realistic durations (e.g. 45–90 minutes) and appropriate times based on the context (mornings, evenings, or user hints).
   - Distribute tasks across different days to avoid overloading a single day.
   - In "assistant_message", briefly summarize the plan (days + times + focus) and end with a clear confirmation question like "Should I schedule this plan for you as proposed, or would you like to adjust any day or time?".

8) Avoid generic fallback phrases like:
   "I need more clarity. Please provide task title, date, and time."
   unless absolutely no scheduling information exists.

Return only the JSON object described above.`,
  });

  // Short conversational history (previous 3–5 turns).
  if (Array.isArray(contextTurns) && contextTurns.length > 0) {
    for (const turn of contextTurns) {
      if (turn.role === "user" || turn.role === "assistant") {
        messages.push({
          role: turn.role,
          content: String(turn.content ?? ""),
        });
      }
    }
  }

  messages.push({
    role: "user",
    content: String(message ?? ""),
  });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await ollama.chat({
      model: DEFAULT_MODEL,
      messages,
      stream: false,
      format: "json",
      options: {
        temperature: 0.2,
        top_p: 0.8,
        top_k: 20,
        num_predict: 120,
      },
      signal: controller.signal,
    });

    const content = response?.message?.content ?? "";
    clearTimeout(timeout);
    return content;
  } catch (err) {
    clearTimeout(timeout);
    return JSON.stringify({
      assistant_message:
        "I'm having trouble responding right now. Please try again.",
      action: { type: "none", payload: {} },
    });
  }
}
