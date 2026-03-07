export type Role = 'Admin' | 'Member' | 'Viewer';
export type ProjectStatus = 'Planning' | 'Active' | 'Done' | 'Archived';
export type TaskStatus = 'Todo' | 'In Progress' | 'Review' | 'Done';
export type TaskPriority = 'Low' | 'Medium' | 'High' | 'Urgent';
export type ScheduleType = 'Personal' | 'Lab' | 'Project';
export type TimetableBlockType = 'Class' | 'Unavailable' | 'Lab Availability';
export type Weekday =
  | 'Monday'
  | 'Tuesday'
  | 'Wednesday'
  | 'Thursday'
  | 'Friday'
  | 'Saturday'
  | 'Sunday';

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  title: string;
}

export interface Project {
  id: string;
  title: string;
  description: string;
  status: ProjectStatus;
  memberIds: string[];
  updatedAt: string;
}

export interface Document {
  id: string;
  projectId: string;
  title: string;
  body: string;
  tags: string[];
  authorId: string;
  updatedAt: string;
  relatedTaskIds: string[];
  attachments: DocumentAttachment[];
}

export interface DocumentAttachment {
  id: string;
  name: string;
  type: string;
  size: number;
  uploadedAt: string;
  dataUrl: string;
}

export interface Task {
  id: string;
  projectId: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  assigneeId: string;
  dueDate: string;
  updatedAt: string;
  documentId?: string;
}

export interface Schedule {
  id: string;
  title: string;
  type: ScheduleType;
  projectId?: string;
  ownerId?: string;
  day: Weekday;
  startTime: string;
  endTime: string;
  location: string;
  note: string;
}

export interface TimetableBlock {
  id: string;
  userId: string;
  day: Weekday;
  startTime: string;
  endTime: string;
  category: TimetableBlockType;
  title: string;
}
