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
    options: {
      temperature: 0,
      top_p: 0.1,
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
    content: `You are a scheduling assistant API.

You MUST respond with ONLY valid JSON.
Do NOT include explanations.
Do NOT include greetings.
Do NOT include markdown.
Do NOT include any text outside JSON.

Your response MUST strictly follow this structure:

{
  \"assistant_message\": \"string\",
  \"action\": {
    \"type\": \"create_task\" | \"clarify\" | \"none\",
    \"payload\": {
      \"title\": \"string\",
      \"start\": \"ISO_DATE_STRING\",
      \"end\": \"ISO_DATE_STRING\",
      \"priority\": \"low|medium|high\"
    }
  }
}

If no scheduling action:
{
  \"assistant_message\": \"string\",
  \"action\": { \"type\": \"none\", \"payload\": {} }
}

If clarification needed:
{
  \"assistant_message\": \"string\",
  \"action\": { \"type\": \"clarify\", \"payload\": {} }
}

Return JSON only.`,
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
      temperature: 0,
      top_p: 0.1,
    },
  });

  const content = response?.message?.content ?? "";
  return content;
}
