import { useState, useCallback, createContext, useContext, ReactNode } from "react";
import { Task, Priority } from "@/types/task";

const generateId = () => Math.random().toString(36).substring(2, 9);

const initialTasks: Task[] = [
  {
    id: generateId(),
    title: "Review project proposal",
    description: "Go through the Q1 project proposal and provide feedback",
    completed: false,
    priority: "high",
    dueDate: new Date(), // Today
    createdAt: new Date(),
  },
  {
    id: generateId(),
    title: "Team standup meeting",
    completed: true,
    priority: "medium",
    dueDate: new Date(),
    createdAt: new Date(Date.now() - 3600000),
  },
  {
    id: generateId(),
    title: "Update documentation",
    description: "Update the API documentation with new endpoints",
    completed: false,
    priority: "low",
    dueDate: new Date(Date.now() + 86400000 * 3), // 3 days
    createdAt: new Date(Date.now() - 7200000),
  },
  {
    id: generateId(),
    title: "Client presentation",
    description: "Prepare slides for the quarterly review",
    completed: false,
    priority: "high",
    dueDate: new Date(Date.now() + 86400000 * 5), // 5 days
    createdAt: new Date(),
  },
  {
    id: generateId(),
    title: "Code review",
    completed: false,
    priority: "medium",
    dueDate: new Date(Date.now() + 86400000), // Tomorrow
    createdAt: new Date(),
  },
];

interface TasksContextType {
  tasks: Task[];
  addTask: (title: string, priority: Priority, dueDate?: Date) => void;
  toggleTask: (id: string) => void;
  deleteTask: (id: string) => void;
}

const TasksContext = createContext<TasksContextType | undefined>(undefined);

export function TasksProvider({ children }: { children: ReactNode }) {
  const [tasks, setTasks] = useState<Task[]>(initialTasks);

  const addTask = useCallback((title: string, priority: Priority, dueDate?: Date) => {
    const newTask: Task = {
      id: generateId(),
      title,
      completed: false,
      priority,
      dueDate,
      createdAt: new Date(),
    };
    setTasks((prev) => [newTask, ...prev]);
  }, []);

  const toggleTask = useCallback((id: string) => {
    setTasks((prev) =>
      prev.map((task) =>
        task.id === id ? { ...task, completed: !task.completed } : task
      )
    );
  }, []);

  const deleteTask = useCallback((id: string) => {
    setTasks((prev) => prev.filter((task) => task.id !== id));
  }, []);

  return (
    <TasksContext.Provider value={{ tasks, addTask, toggleTask, deleteTask }}>
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
