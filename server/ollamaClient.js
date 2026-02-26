import ollama from "ollama";

const DEFAULT_MODEL = process.env.OLLAMA_SCHEDULER_MODEL || "qwen:1.8b";

/**
 * Call the local Ollama model for conversational scheduling.
 * This function NEVER performs date math – it only asks the model
 * to extract structured information and return strict JSON.
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

