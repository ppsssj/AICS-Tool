import type { Document, Project, ProjectStatus, Schedule, ScheduleType, Task, TaskPriority, TaskStatus, Weekday } from '@/entities/models';

export interface AssistantHistoryItem {
  role: 'user' | 'assistant';
  text: string;
}

export interface AssistantWorkspacePayload {
  currentRoute: string;
  activeProjectId: string | null;
  activeProjectTitle: string | null;
  activeDocumentId: string | null;
  recentProjects: Array<{ id: string; title: string }>;
  projectSummaries: Array<{
    id: string;
    title: string;
    status: string;
    documentCount: number;
    openTaskCount: number;
    reviewTaskCount: number;
    scheduleCount: number;
  }>;
  taskSummaries: Array<{
    id: string;
    projectId: string;
    projectTitle: string;
    title: string;
    status: TaskStatus;
    priority: TaskPriority;
    dueDate: string;
  }>;
  documentSummaries: Array<{
    id: string;
    projectId: string;
    projectTitle: string;
    title: string;
    updatedAt: string;
  }>;
}

export interface AssistantServerResponse {
  message: string;
  action: {
    type:
      | 'none'
      | 'navigate'
      | 'create_project'
      | 'create_task'
      | 'create_document'
      | 'create_schedule'
      | 'update_task_status'
      | 'confirm_delete_task'
      | 'confirm_delete_document';
    projectId: string | null;
    documentId: string | null;
    taskId?: string | null;
    path: string | null;
    title?: string | null;
    description?: string | null;
    body?: string | null;
    status?: ProjectStatus | null;
    priority?: TaskPriority | null;
    dueDate?: string | null;
    tags?: string[] | null;
    scheduleType?: ScheduleType | null;
    taskStatus?: TaskStatus | null;
    day?: Weekday | null;
    startTime?: string | null;
    endTime?: string | null;
    location?: string | null;
    note?: string | null;
  };
  suggestions: string[];
  raw?: string;
}

interface BuildWorkspacePayloadInput {
  currentRoute: string;
  activeProjectId: string | null;
  activeDocumentId: string | null;
  recentProjectIds: string[];
  projects: Project[];
  documents: Document[];
  tasks: Task[];
  schedules: Schedule[];
}

export async function requestAssistantResponse(input: {
  message: string;
  history: AssistantHistoryItem[];
  workspace: AssistantWorkspacePayload;
}): Promise<AssistantServerResponse> {
  const response = await fetch('/api/assistant/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  });

  const payload = (await response.json()) as AssistantServerResponse & { error?: string };

  if (!response.ok) {
    throw new Error(payload.error || 'Assistant request failed.');
  }

  return payload;
}

export function buildWorkspacePayload({
  currentRoute,
  activeProjectId,
  activeDocumentId,
  recentProjectIds,
  projects,
  documents,
  tasks,
  schedules,
}: BuildWorkspacePayloadInput): AssistantWorkspacePayload {
  const activeProject = projects.find((project) => project.id === activeProjectId) ?? null;
  const recentProjects = recentProjectIds
    .map((projectId) => projects.find((project) => project.id === projectId))
    .filter((project): project is Project => Boolean(project))
    .slice(0, 5);
  const prioritizedProjectIds = new Set([
    ...(activeProject ? [activeProject.id] : []),
    ...recentProjects.map((project) => project.id),
  ]);
  const prioritizedProjects = [
    ...projects.filter((project) => prioritizedProjectIds.has(project.id)),
    ...projects.filter((project) => !prioritizedProjectIds.has(project.id)).slice(0, 5),
  ].slice(0, 8);
  const prioritizedProjectIdSet = new Set(prioritizedProjects.map((project) => project.id));
  const prioritizedTasks = tasks
    .filter((task) => prioritizedProjectIdSet.has(task.projectId))
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
    .slice(0, 16);
  const prioritizedDocuments = documents
    .filter((document) => prioritizedProjectIdSet.has(document.projectId))
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
    .slice(0, 12);

  return {
    currentRoute,
    activeProjectId,
    activeProjectTitle: activeProject?.title ?? null,
    activeDocumentId,
    recentProjects: recentProjects.map((project) => ({
        id: project.id,
        title: project.title,
      })),
    projectSummaries: prioritizedProjects.map((project) => ({
      id: project.id,
      title: project.title,
      status: project.status,
      documentCount: documents.filter((document) => document.projectId === project.id).length,
      openTaskCount: tasks.filter((task) => task.projectId === project.id && task.status !== 'Done').length,
      reviewTaskCount: tasks.filter((task) => task.projectId === project.id && task.status === 'Review').length,
      scheduleCount: schedules.filter((schedule) => schedule.projectId === project.id).length,
    })),
    taskSummaries: prioritizedTasks.map((task) => ({
      id: task.id,
      projectId: task.projectId,
      projectTitle: projects.find((project) => project.id === task.projectId)?.title ?? task.projectId,
      title: task.title,
      status: task.status,
      priority: task.priority,
      dueDate: task.dueDate,
    })),
    documentSummaries: prioritizedDocuments.map((document) => ({
      id: document.id,
      projectId: document.projectId,
      projectTitle: projects.find((project) => project.id === document.projectId)?.title ?? document.projectId,
      title: document.title,
      updatedAt: document.updatedAt,
    })),
  };
}
