import type {
  Document,
  Project,
  ProjectStatus,
  Role,
  Schedule,
  ScheduleType,
  Task,
  TaskPriority,
  TaskStatus,
  TimetableBlock,
  TimetableBlockType,
  User,
  Weekday,
} from '@/entities/models';

export interface ProjectInput {
  title: string;
  description: string;
  status: ProjectStatus;
  memberIds: string[];
}

export interface DocumentInput {
  projectId: string;
  title: string;
  body: string;
  tags: string[];
  authorId: string;
  relatedTaskIds: string[];
  attachments?: Document['attachments'];
}

export interface TaskInput {
  projectId: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  assigneeId: string;
  dueDate: string;
  documentId?: string;
}

export interface ScheduleInput {
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

export interface TimetableBlockInput {
  userId: string;
  day: Weekday;
  startTime: string;
  endTime: string;
  category: TimetableBlockType;
  title: string;
}

export interface LabBootstrapResponse {
  users: User[];
  projects: Project[];
  documents: Document[];
  tasks: Task[];
  schedules: Schedule[];
  timetableBlocks: TimetableBlock[];
}

async function request<T>(input: string, init?: RequestInit): Promise<T> {
  const response = await fetch(input, {
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
    ...init,
  });

  if (!response.ok) {
    let message = 'Request failed.';

    try {
      const payload = (await response.json()) as { error?: string };
      message = payload.error || message;
    } catch {
      // Keep the generic message when the response body is not JSON.
    }

    throw new Error(message);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export function fetchLabBootstrap() {
  return request<LabBootstrapResponse>('/api/lab/bootstrap');
}

export function createProjectRequest(id: string, input: ProjectInput) {
  return request<Project>('/api/projects', {
    method: 'POST',
    body: JSON.stringify({ id, ...input }),
  });
}

export function updateProjectRequest(projectId: string, input: ProjectInput) {
  return request<Project>(`/api/projects/${projectId}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export function deleteProjectRequest(projectId: string) {
  return request<void>(`/api/projects/${projectId}`, {
    method: 'DELETE',
  });
}

export function createDocumentRequest(id: string, input: DocumentInput) {
  return request<Document>(`/api/projects/${input.projectId}/documents`, {
    method: 'POST',
    body: JSON.stringify({ id, ...input }),
  });
}

export function updateDocumentRequest(documentId: string, input: DocumentInput) {
  return request<Document>(`/api/documents/${documentId}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export function deleteDocumentRequest(documentId: string) {
  return request<void>(`/api/documents/${documentId}`, {
    method: 'DELETE',
  });
}

export function createTaskRequest(id: string, input: TaskInput) {
  return request<Task>(`/api/projects/${input.projectId}/tasks`, {
    method: 'POST',
    body: JSON.stringify({ id, ...input, documentId: input.documentId ?? null }),
  });
}

export function updateTaskRequest(taskId: string, input: TaskInput) {
  return request<Task>(`/api/tasks/${taskId}`, {
    method: 'PATCH',
    body: JSON.stringify({ ...input, documentId: input.documentId ?? null }),
  });
}

export function updateTaskStatusRequest(taskId: string, status: TaskStatus) {
  return request<Task>(`/api/tasks/${taskId}`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });
}

export function deleteTaskRequest(taskId: string) {
  return request<void>(`/api/tasks/${taskId}`, {
    method: 'DELETE',
  });
}

export function createScheduleRequest(id: string, input: ScheduleInput) {
  return request<Schedule>('/api/schedules', {
    method: 'POST',
    body: JSON.stringify({ id, ...input }),
  });
}

export function createTimetableBlockRequest(id: string, input: TimetableBlockInput) {
  return request<TimetableBlock>('/api/timetable-blocks', {
    method: 'POST',
    body: JSON.stringify({ id, ...input }),
  });
}

export function updateCurrentUserRoleRequest(userId: string, role: Role) {
  return request<User>(`/api/users/${userId}/role`, {
    method: 'PATCH',
    body: JSON.stringify({ role }),
  });
}
