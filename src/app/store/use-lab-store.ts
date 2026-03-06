import { create } from 'zustand';
import { persist } from 'zustand/middleware';
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
import { mockDocuments, mockProjects, mockSchedules, mockTasks, mockTimetableBlocks, mockUsers } from '@/mock/data';

interface ProjectInput {
  title: string;
  description: string;
  status: ProjectStatus;
  memberIds: string[];
}

interface DocumentInput {
  projectId: string;
  title: string;
  body: string;
  tags: string[];
  authorId: string;
  relatedTaskIds: string[];
}

interface TaskInput {
  projectId: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  assigneeId: string;
  dueDate: string;
  documentId?: string;
}

interface ScheduleInput {
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

interface TimetableBlockInput {
  userId: string;
  day: Weekday;
  startTime: string;
  endTime: string;
  category: TimetableBlockType;
  title: string;
}

interface LabStore {
  users: User[];
  projects: Project[];
  documents: Document[];
  tasks: Task[];
  schedules: Schedule[];
  timetableBlocks: TimetableBlock[];
  currentUserId: string | null;
  isAuthenticated: boolean;
  login: (email: string) => void;
  logout: () => void;
  createProject: (input: ProjectInput) => void;
  updateProject: (projectId: string, input: ProjectInput) => void;
  deleteProject: (projectId: string) => void;
  createDocument: (input: DocumentInput) => string;
  updateDocument: (documentId: string, input: DocumentInput) => void;
  deleteDocument: (documentId: string) => void;
  createTask: (input: TaskInput) => void;
  updateTask: (taskId: string, input: TaskInput) => void;
  updateTaskStatus: (taskId: string, status: TaskStatus) => void;
  deleteTask: (taskId: string) => void;
  createSchedule: (input: ScheduleInput) => void;
  createTimetableBlock: (input: TimetableBlockInput) => void;
  setCurrentUserRole: (role: Role) => void;
}

const now = () => new Date().toISOString();
const createId = (prefix: string) => `${prefix}-${Math.random().toString(36).slice(2, 9)}`;

function syncDocumentLinks(tasks: Task[], documentId: string, relatedTaskIds: string[]): Task[] {
  return tasks.map((task) => {
    if (relatedTaskIds.includes(task.id)) {
      return { ...task, documentId, updatedAt: now() };
    }

    if (task.documentId === documentId) {
      return { ...task, documentId: undefined, updatedAt: now() };
    }

    return task;
  });
}

export const useLabStore = create<LabStore>()(
  persist(
    (set, get) => ({
      users: mockUsers,
      projects: mockProjects,
      documents: mockDocuments,
      tasks: mockTasks,
      schedules: mockSchedules,
      timetableBlocks: mockTimetableBlocks,
      currentUserId: 'u3',
      isAuthenticated: false,
      login: (email) => {
        const match = get().users.find((user) => user.email.toLowerCase() === email.toLowerCase()) ?? get().users[2];
        set({ currentUserId: match.id, isAuthenticated: true });
      },
      logout: () => set({ isAuthenticated: false }),
      createProject: (input) =>
        set((state) => ({
          projects: [{ id: createId('p'), ...input, updatedAt: now() }, ...state.projects],
        })),
      updateProject: (projectId, input) =>
        set((state) => ({
          projects: state.projects.map((project) => (project.id === projectId ? { ...project, ...input, updatedAt: now() } : project)),
        })),
      deleteProject: (projectId) =>
        set((state) => ({
          projects: state.projects.filter((project) => project.id !== projectId),
          documents: state.documents.filter((document) => document.projectId !== projectId),
          tasks: state.tasks.filter((task) => task.projectId !== projectId),
          schedules: state.schedules.filter((schedule) => schedule.projectId !== projectId),
        })),
      createDocument: (input) => {
        const id = createId('d');
        set((state) => ({
          documents: [{ id, ...input, updatedAt: now() }, ...state.documents],
          tasks: syncDocumentLinks(state.tasks, id, input.relatedTaskIds),
          projects: state.projects.map((project) => (project.id === input.projectId ? { ...project, updatedAt: now() } : project)),
        }));
        return id;
      },
      updateDocument: (documentId, input) =>
        set((state) => ({
          documents: state.documents.map((document) => (document.id === documentId ? { ...document, ...input, updatedAt: now() } : document)),
          tasks: syncDocumentLinks(state.tasks, documentId, input.relatedTaskIds),
          projects: state.projects.map((project) => (project.id === input.projectId ? { ...project, updatedAt: now() } : project)),
        })),
      deleteDocument: (documentId) =>
        set((state) => ({
          documents: state.documents.filter((document) => document.id !== documentId),
          tasks: state.tasks.map((task) => (task.documentId === documentId ? { ...task, documentId: undefined, updatedAt: now() } : task)),
        })),
      createTask: (input) =>
        set((state) => {
          const taskId = createId('t');
          return {
            tasks: [{ id: taskId, ...input, updatedAt: now() }, ...state.tasks],
            documents: input.documentId
              ? state.documents.map((document) =>
                  document.id === input.documentId
                    ? { ...document, relatedTaskIds: [...document.relatedTaskIds, taskId], updatedAt: now() }
                    : document,
                )
              : state.documents,
            projects: state.projects.map((project) => (project.id === input.projectId ? { ...project, updatedAt: now() } : project)),
          };
        }),
      updateTask: (taskId, input) =>
        set((state) => ({
          tasks: state.tasks.map((task) => (task.id === taskId ? { ...task, ...input, updatedAt: now() } : task)),
          documents: state.documents.map((document) => {
            const shouldInclude = document.id === input.documentId;
            const taskAlreadyLinked = document.relatedTaskIds.includes(taskId);

            if (shouldInclude && !taskAlreadyLinked) {
              return { ...document, relatedTaskIds: [...document.relatedTaskIds, taskId], updatedAt: now() };
            }

            if (!shouldInclude && taskAlreadyLinked) {
              return { ...document, relatedTaskIds: document.relatedTaskIds.filter((id) => id !== taskId), updatedAt: now() };
            }

            return document;
          }),
        })),
      updateTaskStatus: (taskId, status) =>
        set((state) => ({
          tasks: state.tasks.map((task) => (task.id === taskId ? { ...task, status, updatedAt: now() } : task)),
        })),
      deleteTask: (taskId) =>
        set((state) => ({
          tasks: state.tasks.filter((task) => task.id !== taskId),
          documents: state.documents.map((document) => ({ ...document, relatedTaskIds: document.relatedTaskIds.filter((id) => id !== taskId) })),
        })),
      createSchedule: (input) => set((state) => ({ schedules: [{ id: createId('s'), ...input }, ...state.schedules] })),
      createTimetableBlock: (input) =>
        set((state) => ({ timetableBlocks: [{ id: createId('tb'), ...input }, ...state.timetableBlocks] })),
      setCurrentUserRole: (role) =>
        set((state) => ({
          users: state.users.map((user) => (user.id === state.currentUserId ? { ...user, role } : user)),
        })),
    }),
    {
      name: 'lab-workflow-os',
      partialize: (state) => ({
        users: state.users,
        projects: state.projects,
        documents: state.documents,
        tasks: state.tasks,
        schedules: state.schedules,
        timetableBlocks: state.timetableBlocks,
        currentUserId: state.currentUserId,
        isAuthenticated: state.isAuthenticated,
      }),
    },
  ),
);
