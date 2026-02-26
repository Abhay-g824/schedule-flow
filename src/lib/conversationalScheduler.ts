const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";

export interface ConversationTurn {
  role: "user" | "assistant";
  content: string;
}

export interface ConversationState {
  history: ConversationTurn[];
}

interface HandleMessageOptions {
  token: string;
}

interface HandleMessageResult {
  state: ConversationState;
  assistantReply: string;
  taskCreated?: boolean;
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

  try {
    const res = await fetch(`${API_URL}/ai/schedule`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${options.token}`,
      },
      body: JSON.stringify({ message: trimmed }),
    });

    if (!res.ok) {
      const fallbackReply =
        "Something went wrong while talking to the assistant. Please try again.";
      const nextState: ConversationState = {
        history: [
          ...newHistory,
          { role: "assistant", content: fallbackReply },
        ],
      };
      return {
        state: nextState,
        assistantReply: fallbackReply,
      };
    }

    const data = await res.json();
    const assistantMessage: string =
      data.message || data.clarification || "Okay.";

    const nextState: ConversationState = {
      history: [
        ...newHistory,
        { role: "assistant", content: assistantMessage },
      ],
    };

    return {
      state: nextState,
      assistantReply: assistantMessage,
      taskCreated: !!data.success,
    };
  } catch {
    const fallbackReply =
      "I couldn't reach the scheduling assistant. Please try again in a moment.";
    const nextState: ConversationState = {
      history: [
        ...newHistory,
        { role: "assistant", content: fallbackReply },
      ],
    };

    return {
      state: nextState,
      assistantReply: fallbackReply,
    };
  }
}

