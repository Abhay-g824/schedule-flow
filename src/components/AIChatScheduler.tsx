import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import {
  ConversationState,
  handleUserMessage,
} from "@/lib/conversationalScheduler";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";

export function AIChatScheduler() {
  const { token } = useAuth();
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [state, setState] = useState<ConversationState>({ history: [] });
  const [error, setError] = useState<string | null>(null);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !token) return;

    setIsSending(true);
    setError(null);
    try {
      const result = await handleUserMessage(input, state, { token });
      setState(result.state);
      setInput("");
    } catch (err) {
      console.error("AIChatScheduler handleSend error", err);
      setError("Something went wrong while scheduling. Please try again.");
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="flex flex-col h-full border rounded-xl bg-card">
      <div className="p-4 border-b">
        <h2 className="text-lg font-semibold">AI Scheduling Assistant</h2>
        <p className="text-xs text-muted-foreground mt-1">
          Describe what you want to schedule. I&apos;ll ask follow-up questions if needed
          and confirm before assigning tasks.
        </p>
      </div>
      <ScrollArea className="flex-1 p-4 space-y-3">
        {error && (
          <p className="text-xs text-destructive mb-2">
            {error}
          </p>
        )}
        {state.history.map((turn, idx) => (
          <div
            key={idx}
            className={
              turn.role === "user"
                ? "text-sm text-foreground"
                : "text-sm text-primary"
            }
          >
            <span className="font-medium mr-1">
              {turn.role === "user" ? "You" : "Assistant"}:
            </span>
            <span>{turn.content}</span>
          </div>
        ))}
        {state.history.length === 0 && (
          <p className="text-xs text-muted-foreground">
            Try something like: &quot;only schedule gen ai class next monday&quot; or
            &quot;add gen ai class and project meeting this week&quot;.
          </p>
        )}
      </ScrollArea>
      <form onSubmit={handleSend} className="p-3 border-t flex gap-2">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type your scheduling request..."
          disabled={isSending || !token}
        />
        <Button type="submit" disabled={isSending || !token || !input.trim()}>
          {isSending ? "Sending..." : "Send"}
        </Button>
      </form>
    </div>
  );
}

