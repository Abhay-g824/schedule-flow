import { useState, useCallback, createContext, useContext, ReactNode, useEffect } from "react";
import { Task, Priority } from "@/types/task";
import { useAuth } from "./useAuth";

interface TasksContextType {
  tasks: Task[];
  loading: boolean;
  addTask: (title: string, priority: Priority, dueDate?: Date, color?: string | null, reminderTime?: Date, timeSlotStart?: Date, timeSlotEnd?: Date) => Promise<void>;
  toggleTask: (id: string) => Promise<void>;
  deleteTask: (id: string) => Promise<void>;
  updateTask: (id: string, updates: Partial<Task>) => Promise<void>;
  fetchTasks: () => Promise<void>;
}

const TasksContext = createContext<TasksContextType | undefined>(undefined);

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";

function mapApiTask(row: any): Task {
  return {
    id: row.id,
    title: row.title,
    description: row.description ?? undefined,
    completed: !!row.completed,
    priority: row.priority as Priority,
    dueDate: row.due_date ? new Date(row.due_date) : undefined,
    createdAt: row.created_at ? new Date(row.created_at) : new Date(),
    color: row.color ?? undefined,
    timeSlotStart: row.time_slot_start ? new Date(row.time_slot_start) : undefined,
    timeSlotEnd: row.time_slot_end ? new Date(row.time_slot_end) : undefined,
    reminderTime: row.reminder_time ? new Date(row.reminder_time) : undefined,
    category: row.category ?? undefined,
  };
}

export function TasksProvider({ children }: { children: ReactNode }) {
  const { token } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchTasks = useCallback(async () => {
    if (!token) {
      setTasks([]);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/tasks`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to load tasks");
      const data = await res.json();
      setTasks(data.map(mapApiTask));
    } catch (err: any) {
      // Error handling - tasks will remain in previous state
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  const addTask = useCallback(
    async (title: string, priority: Priority, dueDate?: Date, color?: string | null, reminderTime?: Date, timeSlotStart?: Date, timeSlotEnd?: Date) => {
      if (!token) return;
      const requestBody = { 
        title, 
        priority, 
        dueDate: dueDate?.toISOString(),
        color: color || null,
        reminderTime: reminderTime?.toISOString() || null,
        timeSlotStart: timeSlotStart?.toISOString() || null,
        timeSlotEnd: timeSlotEnd?.toISOString() || null,
      };
      const res = await fetch(`${API_URL}/tasks`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(requestBody),
      });
      if (!res.ok) throw new Error("Failed to add task");
      const data = await res.json();
      const newTask = mapApiTask(data);
      setTasks((prev) => [newTask, ...prev]);
      
      // Schedule notification if reminder time is set
      if (reminderTime && 'Notification' in window && Notification.permission === 'granted') {
        scheduleNotification(newTask, reminderTime);
      } else if (reminderTime && 'Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission().then((permission) => {
          if (permission === 'granted') {
            scheduleNotification(newTask, reminderTime);
          }
        });
      }
    },
    [token]
  );

  const scheduleNotification = (task: Task, reminderTime: Date) => {
    const now = new Date();
    const timeUntilReminder = reminderTime.getTime() - now.getTime();
    
    if (timeUntilReminder > 0) {
      setTimeout(() => {
        new Notification(`Task Reminder: ${task.title}`, {
          body: task.description || `Don't forget: ${task.title}`,
          icon: '/favicon.ico',
          tag: task.id,
        });
      }, timeUntilReminder);
    }
  };

  const toggleTask = useCallback(
    async (id: string) => {
      if (!token) return;
      const task = tasks.find((t) => t.id === id);
      if (!task) return;
      const res = await fetch(`${API_URL}/tasks/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ completed: task.completed ? 0 : 1 }),
      });
      if (!res.ok) throw new Error("Failed to update task");
      const data = await res.json();
      setTasks((prev) => prev.map((t) => (t.id === id ? mapApiTask(data) : t)));
    },
    [tasks, token]
  );

  const deleteTask = useCallback(
    async (id: string) => {
      if (!token) return;
      const res = await fetch(`${API_URL}/tasks/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to delete task");
      setTasks((prev) => prev.filter((t) => t.id !== id));
    },
    [token]
  );

  const updateTask = useCallback(
    async (id: string, updates: Partial<Task>) => {
      if (!token) return;
      const res = await fetch(`${API_URL}/tasks/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          title: updates.title,
          priority: updates.priority,
          description: updates.description,
          dueDate: updates.dueDate ? updates.dueDate.toISOString() : undefined,
          color: updates.color,
          timeSlotStart: updates.timeSlotStart ? updates.timeSlotStart.toISOString() : undefined,
          timeSlotEnd: updates.timeSlotEnd ? updates.timeSlotEnd.toISOString() : undefined,
          reminderTime: updates.reminderTime ? updates.reminderTime.toISOString() : undefined,
          category: updates.category,
        }),
      });
      if (!res.ok) throw new Error("Failed to update task");
      const data = await res.json();
      setTasks((prev) => prev.map((t) => (t.id === id ? mapApiTask(data) : t)));
    },
    [token]
  );

  return (
    <TasksContext.Provider value={{ tasks, loading, addTask, toggleTask, deleteTask, updateTask, fetchTasks }}>
      {children}
    </TasksContext.Provider>
  );
}

export function useTasks() {
  const context = useContext(TasksContext);
  if (!context) {
    throw new Error("useTasks must be used within a TasksProvider");
  }
  return context;
}
