export type Priority = 'high' | 'medium' | 'low';

export interface Task {
  id: string;
  title: string;
  description?: string;
  completed: boolean;
  priority: Priority;
  dueDate?: Date;
  createdAt: Date;
  color?: string;
  timeSlotStart?: Date;
  timeSlotEnd?: Date;
  reminderTime?: Date;
  templateId?: string;
  category?: string;
}

export interface TaskTemplate {
  id: string;
  title: string;
  description?: string;
  priority: Priority;
  category?: string;
  timeSlotStart?: Date;
  timeSlotEnd?: Date;
  color?: string;
  createdAt: Date;
}

export interface TaskComment {
  id: string;
  taskId: string;
  userId: number;
  comment: string;
  createdAt: Date;
  userEmail?: string;
}

export interface TaskShare {
  id: string;
  taskId: string;
  ownerId: number;
  sharedWithUserId: number;
  permission: 'read' | 'write';
  createdAt: Date;
  sharedWithUserEmail?: string;
}

export interface UserStreak {
  userId: number;
  currentStreak: number;
  longestStreak: number;
  lastCompletionDate?: Date;
}
