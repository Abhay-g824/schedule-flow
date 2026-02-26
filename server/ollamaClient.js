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
    content: `You are a conversational scheduling assistant, similar to ChatGPT, accessed via an API (not a chat UI).

You MUST respond with ONLY a single valid JSON object.
Do NOT include markdown, backticks, bullet points, or any text before or after the JSON.
Do NOT include multiple JSON objects.

The JSON MUST have exactly this top-level shape:
{
  "assistant_message": "string",
  "action": {
    "type": "propose_task" | "propose_plan" | "clarify" | "none" | "create_task",
    "payload": object
  }
}

- "assistant_message" should sound like a ChatGPT reply: short, friendly, and conversational in plain text (no markdown).
- Always explain your reasoning in simple language and ask clear follow-up questions when details are missing.
- "action.type" controls what the backend does.
- "action.payload" depends on "action.type" as described below.

IMPORTANT: You are a planning assistant and decision gate.
You must NEVER directly create calendar tasks yourself. Always propose first and explicitly ask the user to confirm.
The backend will only create tasks after the user explicitly confirms.
Never tell the user that something has already been scheduled; instead, clearly ask for confirmation.

Behavior rules:
1) If user input is incomplete:
   - If the user did NOT provide a concrete task/topic (e.g. they only say "create a task"),
     return a CLARIFICATION question.
   - If the user DID provide a concrete task/topic but omitted BOTH date and time,
     you may propose a reasonable default slot and ask for confirmation.
   - If exactly one of date/time is missing, ask a follow-up question unless rule (2) applies.

   Use this JSON shape for clarification:
   {
     "assistant_message": "Ask a specific follow-up question to collect missing details.",
     "action": { "type": "clarify", "payload": {} }
   }

   If you decide to propose a default slot for a topic-only request, use:
  {
    "assistant_message": "Suggested slot plus a clear confirmation question asking if this should be scheduled",
     "action": {
       "type": "propose_task",
       "payload": {
         "title": "STRING",
         "suggested_start": "ISO_DATE_STRING",
         "suggested_end": "ISO_DATE_STRING",
         "priority": "low|medium|high"
       }
     }
   }

2) If user gives topic + date but no time:
   - Suggest a reasonable time based on:
     - If weekday → suggest 4:00 PM local time
     - If weekend → suggest 10:00 AM local time
     - Duration default = 1 hour

   Return:
  {
    "assistant_message": "Suggested time with a clear confirmation question asking if this should be scheduled",
     "action": {
       "type": "propose_task",
       "payload": {
         "title": "STRING",
         "suggested_start": "ISO_DATE_STRING",
         "suggested_end": "ISO_DATE_STRING",
         "priority": "low|medium|high"
       }
     }
   }

3) If user provides all details (title + start/end or title + date + time + duration):
   - Still return a proposal (do NOT assume creation has happened).

   Use:
  {
    "assistant_message": "Restate the proposed schedule and end with a clear yes/no confirmation question",
     "action": {
       "type": "propose_task",
       "payload": {
         "title": "STRING",
         "suggested_start": "ISO_DATE_STRING",
         "suggested_end": "ISO_DATE_STRING",
         "priority": "low|medium|high"
       }
     }
   }

4) If user asks for a learning plan / timetable (e.g. "plan my schedule for learning X"):
   - Propose a timetable (multiple study blocks) and ask for confirmation.

   Use:
  {
    "assistant_message": "A concise timetable summary that ends with a clear confirmation question",
     "action": {
       "type": "propose_plan",
       "payload": {
         "plan_title": "STRING",
         "tasks": [
           { "title": "STRING", "start": "ISO_DATE_STRING", "end": "ISO_DATE_STRING", "priority": "low|medium|high" }
         ]
       }
     }
   }

5) If user greets or chats without a scheduling request:
   {
     "assistant_message": "Friendly conversational reply",
     "action": { "type": "none", "payload": {} }
   }

6) Never invent participants.
7) Always wait for confirmation before final creation.

Return ONLY the JSON object described above, nothing else.`,
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
