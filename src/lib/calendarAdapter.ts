import { Task, Priority } from "@/types/task";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";

export interface CalendarEventInput {
  taskTitle: string;
  priority: Priority;
  dueDate?: Date;
  timeSlotStart?: Date;
  timeSlotEnd?: Date;
  description?: string;
  color?: string | null;
  category?: string | null;
}

export interface CalendarAdapter {
  createEvent(eventData: CalendarEventInput): Promise<Task>;
  updateEvent(eventId: string, updates: Partial<CalendarEventInput>): Promise<Task>;
  deleteEvent(eventId: string): Promise<void>;
}

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

export class CustomCalendarAdapter implements CalendarAdapter {
  private readonly token: string;

  constructor(token: string) {
    this.token = token;
  }

  async createEvent(eventData: CalendarEventInput): Promise<Task> {
    const body = {
      title: eventData.taskTitle,
      priority: eventData.priority,
      description: eventData.description ?? null,
      color: eventData.color ?? null,
      category: eventData.category ?? null,
      dueDate: eventData.dueDate?.toISOString() ?? null,
      timeSlotStart: eventData.timeSlotStart?.toISOString() ?? null,
      timeSlotEnd: eventData.timeSlotEnd?.toISOString() ?? null,
      reminderTime: null,
    };

    const res = await fetch(`${API_URL}/tasks`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.token}`,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      throw new Error("Failed to create event");
    }

    const data = await res.json();
    return mapApiTask(data);
  }

  async updateEvent(
    eventId: string,
    updates: Partial<CalendarEventInput>
  ): Promise<Task> {
    const body: any = {};

    if (updates.taskTitle !== undefined) body.title = updates.taskTitle;
    if (updates.priority !== undefined) body.priority = updates.priority;
    if (updates.description !== undefined) body.description = updates.description;
    if (updates.color !== undefined) body.color = updates.color;
    if (updates.category !== undefined) body.category = updates.category;
    if (updates.dueDate !== undefined) {
      body.dueDate = updates.dueDate ? updates.dueDate.toISOString() : null;
    }
    if (updates.timeSlotStart !== undefined) {
      body.timeSlotStart = updates.timeSlotStart
        ? updates.timeSlotStart.toISOString()
        : null;
    }
    if (updates.timeSlotEnd !== undefined) {
      body.timeSlotEnd = updates.timeSlotEnd
        ? updates.timeSlotEnd.toISOString()
        : null;
    }

    const res = await fetch(`${API_URL}/tasks/${eventId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.token}`,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      throw new Error("Failed to update event");
    }

    const data = await res.json();
    return mapApiTask(data);
  }

  async deleteEvent(eventId: string): Promise<void> {
    const res = await fetch(`${API_URL}/tasks/${eventId}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${this.token}`,
      },
    });

    if (!res.ok) {
      throw new Error("Failed to delete event");
    }
  }
}

export class GoogleCalendarAdapter implements CalendarAdapter {
  // Placeholder for future Google Calendar integration.
  // The AI scheduler will interact with this the same way
  // as with CustomCalendarAdapter, so swapping calendars
  // requires no AI changes.

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async createEvent(_eventData: CalendarEventInput): Promise<Task> {
    throw new Error("GoogleCalendarAdapter.createEvent is not implemented yet");
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async updateEvent(
    _eventId: string,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _updates: Partial<CalendarEventInput>
  ): Promise<Task> {
    throw new Error("GoogleCalendarAdapter.updateEvent is not implemented yet");
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async deleteEvent(_eventId: string): Promise<void> {
    throw new Error("GoogleCalendarAdapter.deleteEvent is not implemented yet");
  }
}

