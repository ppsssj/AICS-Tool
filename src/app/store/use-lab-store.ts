import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  Document,
  Project,
  Role,
  Schedule,
  Task,
  TimetableBlock,
  User,
} from '@/entities/models';
import {
  createDocumentRequest,
  createProjectRequest,
  createScheduleRequest,
  createTaskRequest,
  createTimetableBlockRequest,
  deleteDocumentRequest,
  deleteProjectRequest,
  deleteTaskRequest,
  fetchLabBootstrap,
  type DocumentInput,
  type ProjectInput,
  type ScheduleInput,
  type TaskInput,
  type TimetableBlockInput,
  updateCurrentUserRoleRequest,
  updateDocumentRequest,
  updateProjectRequest,
  updateTaskRequest,
  updateTaskStatusRequest,
} from '@/app/store/lab-api';
import { mockDocuments, mockProjects, mockSchedules, mockTasks, mockTimetableBlocks, mockUsers } from '@/mock/data';
import type { AppTheme } from '@/shared/lib/themes';

interface LabStore {
  users: User[];
  projects: Project[];
  documents: Document[];
  tasks: Task[];
  schedules: Schedule[];
  timetableBlocks: TimetableBlock[];
  currentUserId: string | null;
  isAuthenticated: boolean;
  appTheme: AppTheme;
  activeProjectId: string | null;
  activeDocumentId: string | null;
  recentProjectIds: string[];
  hasHydratedFromServer: boolean;
  isHydratingFromServer: boolean;
  hydrateFromServer: () => Promise<void>;
  login: (email: string) => void;
  logout: () => void;
  createProject: (input: ProjectInput) => string;
  updateProject: (projectId: string, input: ProjectInput) => void;
  deleteProject: (projectId: string) => void;
  createDocument: (input: DocumentInput) => string;
  updateDocument: (documentId: string, input: DocumentInput) => void;
  deleteDocument: (documentId: string) => void;
  createTask: (input: TaskInput) => void;
  updateTask: (taskId: string, input: TaskInput) => void;
  updateTaskStatus: (taskId: string, status: Task['status']) => void;
  deleteTask: (taskId: string) => void;
  createSchedule: (input: ScheduleInput) => void;
  createTimetableBlock: (input: TimetableBlockInput) => void;
  setCurrentUserRole: (role: Role) => void;
  setAppTheme: (theme: AppTheme) => void;
  setActiveProjectContext: (projectId: string | null) => void;
  setActiveDocumentContext: (documentId: string | null) => void;
}

type PersistedLabStore = Partial<
  Pick<
    LabStore,
    | 'users'
    | 'projects'
    | 'documents'
    | 'tasks'
    | 'schedules'
    | 'timetableBlocks'
    | 'currentUserId'
    | 'isAuthenticated'
    | 'appTheme'
    | 'activeProjectId'
    | 'activeDocumentId'
    | 'recentProjectIds'
  >
>;

const now = () => new Date().toISOString();
const createId = (prefix: string) => `${prefix}-${Math.random().toString(36).slice(2, 9)}`;

function createInitialState() {
  return {
    users: mockUsers,
    projects: mockProjects,
    documents: mockDocuments,
    tasks: mockTasks,
    schedules: mockSchedules,
    timetableBlocks: mockTimetableBlocks,
    currentUserId: 'u3' as string | null,
    isAuthenticated: false,
    appTheme: 'silver' as AppTheme,
    activeProjectId: null as string | null,
    activeDocumentId: null as string | null,
    recentProjectIds: [] as string[],
    hasHydratedFromServer: false,
    isHydratingFromServer: false,
  };
}

function sanitizePersistedState(persisted: unknown): PersistedLabStore {
  if (!persisted || typeof persisted !== 'object') {
    return {};
  }

  const state = persisted as Record<string, unknown>;
  const initialState = createInitialState();

  return {
    users: Array.isArray(state.users) ? (state.users as LabStore['users']) : initialState.users,
    projects: Array.isArray(state.projects) ? (state.projects as LabStore['projects']) : initialState.projects,
    documents: Array.isArray(state.documents) ? (state.documents as LabStore['documents']) : initialState.documents,
    tasks: Array.isArray(state.tasks) ? (state.tasks as LabStore['tasks']) : initialState.tasks,
    schedules: Array.isArray(state.schedules) ? (state.schedules as LabStore['schedules']) : initialState.schedules,
    timetableBlocks: Array.isArray(state.timetableBlocks)
      ? (state.timetableBlocks as LabStore['timetableBlocks'])
      : initialState.timetableBlocks,
    currentUserId:
      typeof state.currentUserId === 'string' || state.currentUserId === null
        ? (state.currentUserId as string | null)
        : initialState.currentUserId,
    isAuthenticated:
      typeof state.isAuthenticated === 'boolean' ? state.isAuthenticated : initialState.isAuthenticated,
    appTheme:
      state.appTheme === 'silver' ||
      state.appTheme === 'mist' ||
      state.appTheme === 'sky' ||
      state.appTheme === 'sand'
        ? (state.appTheme as AppTheme)
        : initialState.appTheme,
    activeProjectId:
      typeof state.activeProjectId === 'string' || state.activeProjectId === null
        ? (state.activeProjectId as string | null)
        : initialState.activeProjectId,
    activeDocumentId:
      typeof state.activeDocumentId === 'string' || state.activeDocumentId === null
        ? (state.activeDocumentId as string | null)
        : initialState.activeDocumentId,
    recentProjectIds: Array.isArray(state.recentProjectIds)
      ? state.recentProjectIds.filter((value): value is string => typeof value === 'string').slice(0, 6)
      : initialState.recentProjectIds,
  };
}

function pushRecentProject(recentProjectIds: string[], projectId: string): string[] {
  return [projectId, ...recentProjectIds.filter((value) => value !== projectId)].slice(0, 6);
}

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

function logSyncError(action: string, error: unknown) {
  console.error(`[lab-store] ${action} sync failed`, error);
}

function mergeProject(projects: Project[], project: Project): Project[] {
  return projects.some((entry) => entry.id === project.id)
    ? projects.map((entry) => (entry.id === project.id ? project : entry))
    : [project, ...projects];
}

function mergeDocument(documents: Document[], document: Document): Document[] {
  return documents.some((entry) => entry.id === document.id)
    ? documents.map((entry) => (entry.id === document.id ? document : entry))
    : [document, ...documents];
}

function mergeTask(tasks: Task[], task: Task): Task[] {
  return tasks.some((entry) => entry.id === task.id)
    ? tasks.map((entry) => (entry.id === task.id ? task : entry))
    : [task, ...tasks];
}

function mergeSchedule(schedules: Schedule[], schedule: Schedule): Schedule[] {
  return schedules.some((entry) => entry.id === schedule.id)
    ? schedules.map((entry) => (entry.id === schedule.id ? schedule : entry))
    : [schedule, ...schedules];
}

function mergeTimetableBlock(timetableBlocks: TimetableBlock[], timetableBlock: TimetableBlock): TimetableBlock[] {
  return timetableBlocks.some((entry) => entry.id === timetableBlock.id)
    ? timetableBlocks.map((entry) => (entry.id === timetableBlock.id ? timetableBlock : entry))
    : [timetableBlock, ...timetableBlocks];
}

function mergeUser(users: User[], user: User): User[] {
  return users.map((entry) => (entry.id === user.id ? user : entry));
}

export const useLabStore = create<LabStore>()(
  persist(
    (set, get) => ({
      ...createInitialState(),
      hydrateFromServer: async () => {
        if (get().isHydratingFromServer || get().hasHydratedFromServer) {
          return;
        }

        set({ isHydratingFromServer: true });

        try {
          const payload = await fetchLabBootstrap();

          set((state) => {
            const currentUserId = payload.users.some((user) => user.id === state.currentUserId)
              ? state.currentUserId
              : payload.users[0]?.id ?? null;
            const activeProjectId = payload.projects.some((project) => project.id === state.activeProjectId)
              ? state.activeProjectId
              : null;
            const activeDocumentId = payload.documents.some((document) => document.id === state.activeDocumentId)
              ? state.activeDocumentId
              : null;
            const recentProjectIds = state.recentProjectIds.filter((projectId) =>
              payload.projects.some((project) => project.id === projectId),
            );

            return {
              users: payload.users,
              projects: payload.projects,
              documents: payload.documents,
              tasks: payload.tasks,
              schedules: payload.schedules,
              timetableBlocks: payload.timetableBlocks,
              currentUserId,
              activeProjectId,
              activeDocumentId,
              recentProjectIds,
              hasHydratedFromServer: true,
              isHydratingFromServer: false,
            };
          });
        } catch (error) {
          // In dev, the frontend can start before the backend proxy target is ready.
          // Keep the local mock state and let the app retry quietly.
          set({ isHydratingFromServer: false });
        }
      },
      login: (email) => {
        const match = get().users.find((user) => user.email.toLowerCase() === email.toLowerCase()) ?? get().users[2];
        set({ currentUserId: match?.id ?? null, isAuthenticated: true });
      },
      logout: () => set({ isAuthenticated: false }),
      createProject: (input) => {
        const id = createId('p');
        const project: Project = { id, ...input, updatedAt: now() };

        set((state) => ({
          projects: [project, ...state.projects],
        }));

        void createProjectRequest(id, input)
          .then((serverProject) => {
            set((state) => ({
              projects: mergeProject(state.projects, serverProject),
            }));
          })
          .catch((error) => logSyncError('createProject', error));

        return id;
      },
      updateProject: (projectId, input) => {
        set((state) => ({
          projects: state.projects.map((project) =>
            project.id === projectId ? { ...project, ...input, updatedAt: now() } : project,
          ),
        }));

        void updateProjectRequest(projectId, input)
          .then((serverProject) => {
            set((state) => ({
              projects: mergeProject(state.projects, serverProject),
            }));
          })
          .catch((error) => logSyncError('updateProject', error));
      },
      deleteProject: (projectId) => {
        set((state) => ({
          projects: state.projects.filter((project) => project.id !== projectId),
          documents: state.documents.filter((document) => document.projectId !== projectId),
          tasks: state.tasks.filter((task) => task.projectId !== projectId),
          schedules: state.schedules.filter((schedule) => schedule.projectId !== projectId),
          activeProjectId: state.activeProjectId === projectId ? null : state.activeProjectId,
          activeDocumentId:
            state.documents.some((document) => document.projectId === projectId && document.id === state.activeDocumentId)
              ? null
              : state.activeDocumentId,
          recentProjectIds: state.recentProjectIds.filter((value) => value !== projectId),
        }));

        void deleteProjectRequest(projectId).catch((error) => logSyncError('deleteProject', error));
      },
      createDocument: (input) => {
        const id = createId('d');
        const document: Document = {
          id,
          ...input,
          attachments: input.attachments ?? [],
          updatedAt: now(),
        };

        set((state) => ({
          documents: [document, ...state.documents],
          tasks: syncDocumentLinks(state.tasks, id, input.relatedTaskIds),
          projects: state.projects.map((project) =>
            project.id === input.projectId ? { ...project, updatedAt: now() } : project,
          ),
        }));

        void createDocumentRequest(id, input)
          .then((serverDocument) => {
            set((state) => ({
              documents: mergeDocument(state.documents, serverDocument),
            }));
          })
          .catch((error) => logSyncError('createDocument', error));

        return id;
      },
      updateDocument: (documentId, input) => {
        set((state) => ({
          documents: state.documents.map((document) =>
            document.id === documentId ? { ...document, ...input, updatedAt: now() } : document,
          ),
          tasks: syncDocumentLinks(state.tasks, documentId, input.relatedTaskIds),
          projects: state.projects.map((project) =>
            project.id === input.projectId ? { ...project, updatedAt: now() } : project,
          ),
        }));

        void updateDocumentRequest(documentId, input)
          .then((serverDocument) => {
            set((state) => ({
              documents: mergeDocument(state.documents, serverDocument),
            }));
          })
          .catch((error) => logSyncError('updateDocument', error));
      },
      deleteDocument: (documentId) => {
        set((state) => ({
          documents: state.documents.filter((document) => document.id !== documentId),
          tasks: state.tasks.map((task) =>
            task.documentId === documentId ? { ...task, documentId: undefined, updatedAt: now() } : task,
          ),
          activeDocumentId: state.activeDocumentId === documentId ? null : state.activeDocumentId,
        }));

        void deleteDocumentRequest(documentId).catch((error) => logSyncError('deleteDocument', error));
      },
      createTask: (input) => {
        const taskId = createId('t');
        const task: Task = { id: taskId, ...input, updatedAt: now() };

        set((state) => ({
          tasks: [task, ...state.tasks],
          documents: input.documentId
            ? state.documents.map((document) =>
                document.id === input.documentId
                  ? { ...document, relatedTaskIds: [...document.relatedTaskIds, taskId], updatedAt: now() }
                  : document,
              )
            : state.documents,
          projects: state.projects.map((project) =>
            project.id === input.projectId ? { ...project, updatedAt: now() } : project,
          ),
        }));

        void createTaskRequest(taskId, input)
          .then((serverTask) => {
            set((state) => ({
              tasks: mergeTask(state.tasks, serverTask),
            }));
          })
          .catch((error) => logSyncError('createTask', error));
      },
      updateTask: (taskId, input) => {
        set((state) => ({
          tasks: state.tasks.map((task) =>
            task.id === taskId ? { ...task, ...input, updatedAt: now() } : task,
          ),
          documents: state.documents.map((document) => {
            const shouldInclude = document.id === input.documentId;
            const taskAlreadyLinked = document.relatedTaskIds.includes(taskId);

            if (shouldInclude && !taskAlreadyLinked) {
              return { ...document, relatedTaskIds: [...document.relatedTaskIds, taskId], updatedAt: now() };
            }

            if (!shouldInclude && taskAlreadyLinked) {
              return {
                ...document,
                relatedTaskIds: document.relatedTaskIds.filter((id) => id !== taskId),
                updatedAt: now(),
              };
            }

            return document;
          }),
        }));

        void updateTaskRequest(taskId, input)
          .then((serverTask) => {
            set((state) => ({
              tasks: mergeTask(state.tasks, serverTask),
            }));
          })
          .catch((error) => logSyncError('updateTask', error));
      },
      updateTaskStatus: (taskId, status) => {
        set((state) => ({
          tasks: state.tasks.map((task) =>
            task.id === taskId ? { ...task, status, updatedAt: now() } : task,
          ),
        }));

        void updateTaskStatusRequest(taskId, status)
          .then((serverTask) => {
            set((state) => ({
              tasks: mergeTask(state.tasks, serverTask),
            }));
          })
          .catch((error) => logSyncError('updateTaskStatus', error));
      },
      deleteTask: (taskId) => {
        set((state) => ({
          tasks: state.tasks.filter((task) => task.id !== taskId),
          documents: state.documents.map((document) => ({
            ...document,
            relatedTaskIds: document.relatedTaskIds.filter((id) => id !== taskId),
          })),
        }));

        void deleteTaskRequest(taskId).catch((error) => logSyncError('deleteTask', error));
      },
      createSchedule: (input) => {
        const id = createId('s');
        const schedule: Schedule = { id, ...input };

        set((state) => ({
          schedules: [schedule, ...state.schedules],
        }));

        void createScheduleRequest(id, input)
          .then((serverSchedule) => {
            set((state) => ({
              schedules: mergeSchedule(state.schedules, serverSchedule),
            }));
          })
          .catch((error) => logSyncError('createSchedule', error));
      },
      createTimetableBlock: (input) => {
        const id = createId('tb');
        const timetableBlock: TimetableBlock = { id, ...input };

        set((state) => ({
          timetableBlocks: [timetableBlock, ...state.timetableBlocks],
        }));

        void createTimetableBlockRequest(id, input)
          .then((serverTimetableBlock) => {
            set((state) => ({
              timetableBlocks: mergeTimetableBlock(state.timetableBlocks, serverTimetableBlock),
            }));
          })
          .catch((error) => logSyncError('createTimetableBlock', error));
      },
      setCurrentUserRole: (role) => {
        const userId = get().currentUserId;
        if (!userId) {
          return;
        }

        set((state) => ({
          users: state.users.map((user) => (user.id === userId ? { ...user, role } : user)),
        }));

        void updateCurrentUserRoleRequest(userId, role)
          .then((serverUser) => {
            set((state) => ({
              users: mergeUser(state.users, serverUser),
            }));
          })
          .catch((error) => logSyncError('setCurrentUserRole', error));
      },
      setAppTheme: (theme) => set({ appTheme: theme }),
      setActiveProjectContext: (projectId) =>
        set((state) => ({
          activeProjectId: projectId,
          recentProjectIds: projectId ? pushRecentProject(state.recentProjectIds, projectId) : state.recentProjectIds,
        })),
      setActiveDocumentContext: (documentId) => set({ activeDocumentId: documentId }),
    }),
    {
      name: 'lab-workflow-os',
      version: 4,
      migrate: (persistedState) => sanitizePersistedState(persistedState),
      merge: (persistedState, currentState) => ({
        ...currentState,
        ...sanitizePersistedState((persistedState as { state?: unknown } | undefined)?.state ?? persistedState),
      }),
      partialize: (state) => ({
        users: state.users,
        projects: state.projects,
        documents: state.documents,
        tasks: state.tasks,
        schedules: state.schedules,
        timetableBlocks: state.timetableBlocks,
        currentUserId: state.currentUserId,
        isAuthenticated: state.isAuthenticated,
        appTheme: state.appTheme,
        activeProjectId: state.activeProjectId,
        activeDocumentId: state.activeDocumentId,
        recentProjectIds: state.recentProjectIds,
      }),
    },
  ),
);
