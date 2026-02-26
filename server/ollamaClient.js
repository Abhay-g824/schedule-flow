import ollama from "ollama";

// Default to gemma:2b as the local conversational model,
// but allow overriding via env if needed.
const DEFAULT_MODEL = process.env.OLLAMA_SCHEDULER_MODEL || "gemma:2b";

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
    content:
      "You are a lightweight ChatGPT-style assistant helping a user manage their schedule. " +
      "You must ALWAYS reply with VALID JSON ONLY, no markdown, no extra text. " +
      "Behave conversationally but also decide whether to create a task, ask for clarification, or do nothing.\n\n" +
      "RESPONSE FORMAT (MANDATORY):\n" +
      '{\n' +
      '  "assistant_message": "Conversational reply shown to user",\n' +
      '  "action": {\n' +
      '    "type": "create_task" | "clarify" | "none",\n' +
      '    "payload": {\n' +
      '      "title": "STRING",\n' +
      '      "start": "ISO_DATE_STRING",\n' +
      '      "end": "ISO_DATE_STRING",\n' +
      '      "priority": "low" | "medium" | "high"\n' +
      "    }\n" +
      "  }\n" +
      "}\n\n" +
      "RULES:\n" +
      "- assistant_message: always conversational and human-like.\n" +
      '- action.type:\n' +
      '  - "create_task" when scheduling is clear (date & time understood).\n' +
      '  - "clarify" when you need more details (e.g. missing date/time).\n' +
      '  - "none" when the user is just chatting.\n' +
      "- If action.type is \"clarify\", assistant_message MUST ask a follow-up question and action.payload can be an empty object.\n" +
      "- If action.type is \"none\", you are just chatting and action.payload can be an empty object.\n" +
      "- When creating a task, fill payload.title, payload.start, payload.end, payload.priority.\n" +
      "- Use ISO 8601 strings for start/end (e.g. 2026-02-26T17:00:00.000Z).\n" +
      "- Never include explanations or any text outside the JSON.",
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

  const response = await ollama.chat({
    model: DEFAULT_MODEL,
    messages,
    stream: false,
    options: {
      temperature: 0.3,
    },
  });

  const content = response?.message?.content ?? "";
  return content;
}
