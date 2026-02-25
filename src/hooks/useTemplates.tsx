import { useState, useCallback, createContext, useContext, ReactNode, useEffect } from "react";
import { TaskTemplate, Priority } from "@/types/task";
import { useAuth } from "./useAuth";

interface TemplatesContextType {
  templates: TaskTemplate[];
  loading: boolean;
  createTemplate: (title: string, priority: Priority, color?: string | null, timeSlotStart?: Date, timeSlotEnd?: Date, description?: string, category?: string) => Promise<void>;
  deleteTemplate: (id: string) => Promise<void>;
  createTaskFromTemplate: (templateId: string, dueDate?: Date) => Promise<void>;
}

const TemplatesContext = createContext<TemplatesContextType | undefined>(undefined);

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";

function mapApiTemplate(row: any): TaskTemplate {
  return {
    id: row.id,
    title: row.title,
    description: row.description ?? undefined,
    priority: row.priority as Priority,
    category: row.category ?? undefined,
    timeSlotStart: row.time_slot_start ? new Date(row.time_slot_start) : undefined,
    timeSlotEnd: row.time_slot_end ? new Date(row.time_slot_end) : undefined,
    color: row.color ?? undefined,
    createdAt: row.created_at ? new Date(row.created_at) : new Date(),
  };
}

export function TemplatesProvider({ children }: { children: ReactNode }) {
  const { token } = useAuth();
  const [templates, setTemplates] = useState<TaskTemplate[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchTemplates = useCallback(async () => {
    if (!token) {
      setTemplates([]);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/templates`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to load templates");
      const data = await res.json();
      setTemplates(data.map(mapApiTemplate));
    } catch (err) {
      console.error("Failed to fetch templates", err);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  const createTemplate = useCallback(
    async (title: string, priority: Priority, color?: string | null, timeSlotStart?: Date, timeSlotEnd?: Date, description?: string, category?: string) => {
      if (!token) return;
      const res = await fetch(`${API_URL}/templates`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          title,
          priority,
          color: color || null,
          timeSlotStart: timeSlotStart?.toISOString() || null,
          timeSlotEnd: timeSlotEnd?.toISOString() || null,
          description: description || null,
          category: category || null,
        }),
      });
      if (!res.ok) throw new Error("Failed to create template");
      await fetchTemplates();
    },
    [token, fetchTemplates]
  );

  const deleteTemplate = useCallback(
    async (id: string) => {
      if (!token) return;
      const res = await fetch(`${API_URL}/templates/${id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (!res.ok) throw new Error("Failed to delete template");
      setTemplates((prev) => prev.filter((t) => t.id !== id));
    },
    [token]
  );

  const createTaskFromTemplate = useCallback(
    async (templateId: string, dueDate?: Date) => {
      if (!token) return;
      const res = await fetch(`${API_URL}/templates/${templateId}/create-task`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          dueDate: dueDate?.toISOString() || null,
        }),
      });
      if (!res.ok) throw new Error("Failed to create task from template");
      // Task will be added via useTasks hook refresh
    },
    [token]
  );

  const value = {
    templates,
    loading,
    createTemplate,
    deleteTemplate,
    createTaskFromTemplate,
  };

  return <TemplatesContext.Provider value={value}>{children}</TemplatesContext.Provider>;
}

export function useTemplates() {
  const ctx = useContext(TemplatesContext);
  if (!ctx) throw new Error("useTemplates must be used within TemplatesProvider");
  return ctx;
}



