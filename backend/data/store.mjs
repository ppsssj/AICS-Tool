import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { seedLabData } from './seed.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_FILE = path.join(__dirname, 'lab-data.json');

function now() {
  return new Date().toISOString();
}

function createId(prefix) {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function ensureDataFile() {
  fs.mkdirSync(__dirname, { recursive: true });

  if (!fs.existsSync(DATA_FILE)) {
    writeStore({
      meta: {
        version: 1,
        seededAt: now(),
      },
      ...clone(seedLabData),
    });
  }
}

function readStore() {
  ensureDataFile();
  return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
}

function writeStore(store) {
  fs.writeFileSync(DATA_FILE, `${JSON.stringify(store, null, 2)}\n`, 'utf8');
}

function touchProject(store, projectId) {
  const project = store.projects.find((entry) => entry.id === projectId);
  if (project) {
    project.updatedAt = now();
  }
}

function addTaskToDocument(document, taskId) {
  if (!document.relatedTaskIds.includes(taskId)) {
    document.relatedTaskIds.push(taskId);
  }
}

function removeTaskFromDocument(document, taskId) {
  document.relatedTaskIds = document.relatedTaskIds.filter((entry) => entry !== taskId);
}

function syncTaskDocumentLink(store, taskId, nextDocumentId) {
  const task = store.tasks.find((entry) => entry.id === taskId);
  if (!task) {
    return;
  }

  for (const document of store.documents) {
    if (document.id === nextDocumentId) {
      addTaskToDocument(document, taskId);
      continue;
    }

    removeTaskFromDocument(document, taskId);
  }

  task.documentId = nextDocumentId ?? undefined;
  task.updatedAt = now();
}

function projectStats(store, projectId) {
  const taskList = store.tasks.filter((entry) => entry.projectId === projectId);
  const documentList = store.documents.filter((entry) => entry.projectId === projectId);
  const scheduleList = store.schedules.filter((entry) => entry.projectId === projectId);

  return {
    taskCount: taskList.length,
    openTaskCount: taskList.filter((entry) => entry.status !== 'Done').length,
    reviewTaskCount: taskList.filter((entry) => entry.status === 'Review').length,
    documentCount: documentList.length,
    scheduleCount: scheduleList.length,
  };
}

export function getBootstrapData() {
  const store = readStore();

  return {
    users: store.users,
    projects: store.projects.map((project) => ({
      ...project,
      stats: projectStats(store, project.id),
    })),
    documents: store.documents,
    tasks: store.tasks,
    schedules: store.schedules,
    timetableBlocks: store.timetableBlocks,
  };
}

export function getUsers() {
  return readStore().users;
}

export function getUser(userId) {
  return readStore().users.find((entry) => entry.id === userId) ?? null;
}

export function getUserByEmail(email) {
  return readStore().users.find((entry) => entry.email.toLowerCase() === email.toLowerCase()) ?? null;
}

export function createUser(input) {
  const store = readStore();
  const user = {
    id: input.id ?? createId('u'),
    name: input.name,
    email: input.email,
    role: input.role,
    title: input.title,
  };

  store.users.push(user);
  writeStore(store);

  return user;
}

export function getProjects() {
  const store = readStore();

  return store.projects.map((project) => ({
    ...project,
    stats: projectStats(store, project.id),
  }));
}

export function getProjectBundle(projectId) {
  const store = readStore();
  const project = store.projects.find((entry) => entry.id === projectId);

  if (!project) {
    return null;
  }

  return {
    project: {
      ...project,
      stats: projectStats(store, project.id),
    },
    members: store.users.filter((entry) => project.memberIds.includes(entry.id)),
    tasks: store.tasks.filter((entry) => entry.projectId === projectId),
    documents: store.documents.filter((entry) => entry.projectId === projectId),
    schedules: store.schedules.filter((entry) => entry.projectId === projectId),
  };
}

export function getProject(projectId) {
  return readStore().projects.find((entry) => entry.id === projectId) ?? null;
}

export function getTask(taskId) {
  return readStore().tasks.find((entry) => entry.id === taskId) ?? null;
}

export function getDocument(documentId) {
  return readStore().documents.find((entry) => entry.id === documentId) ?? null;
}

export function getSchedule(scheduleId) {
  return readStore().schedules.find((entry) => entry.id === scheduleId) ?? null;
}

export function createProject(input) {
  const store = readStore();
  const project = {
    id: input.id ?? createId('p'),
    ...input,
    updatedAt: now(),
  };

  store.projects.unshift(project);
  writeStore(store);
  return project;
}

export function updateProject(projectId, patch) {
  const store = readStore();
  const index = store.projects.findIndex((entry) => entry.id === projectId);

  if (index < 0) {
    return null;
  }

  store.projects[index] = {
    ...store.projects[index],
    ...patch,
    updatedAt: now(),
  };

  writeStore(store);
  return store.projects[index];
}

export function deleteProject(projectId) {
  const store = readStore();
  const exists = store.projects.some((entry) => entry.id === projectId);

  if (!exists) {
    return false;
  }

  const removedDocumentIds = new Set(
    store.documents.filter((entry) => entry.projectId === projectId).map((entry) => entry.id),
  );

  store.projects = store.projects.filter((entry) => entry.id !== projectId);
  store.tasks = store.tasks
    .filter((entry) => entry.projectId !== projectId)
    .map((entry) =>
      removedDocumentIds.has(entry.documentId)
        ? { ...entry, documentId: undefined, updatedAt: now() }
        : entry,
    );
  store.documents = store.documents.filter((entry) => entry.projectId !== projectId);
  store.schedules = store.schedules.filter((entry) => entry.projectId !== projectId);

  writeStore(store);
  return true;
}

export function getProjectTasks(projectId) {
  return readStore().tasks.filter((entry) => entry.projectId === projectId);
}

export function createTask(projectId, input) {
  const store = readStore();
  const task = {
    id: input.id ?? createId('t'),
    projectId,
    ...input,
    updatedAt: now(),
  };

  store.tasks.unshift(task);
  if (input.documentId) {
    syncTaskDocumentLink(store, task.id, input.documentId);
  }

  touchProject(store, projectId);
  writeStore(store);
  return task;
}

export function updateTask(taskId, patch) {
  const store = readStore();
  const index = store.tasks.findIndex((entry) => entry.id === taskId);

  if (index < 0) {
    return null;
  }

  store.tasks[index] = {
    ...store.tasks[index],
    ...patch,
    updatedAt: now(),
  };

  if ('documentId' in patch) {
    syncTaskDocumentLink(store, taskId, patch.documentId ?? null);
  }

  touchProject(store, store.tasks[index].projectId);
  writeStore(store);
  return store.tasks[index];
}

export function deleteTask(taskId) {
  const store = readStore();
  const task = store.tasks.find((entry) => entry.id === taskId);

  if (!task) {
    return false;
  }

  store.tasks = store.tasks.filter((entry) => entry.id !== taskId);
  for (const document of store.documents) {
    removeTaskFromDocument(document, taskId);
  }

  touchProject(store, task.projectId);
  writeStore(store);
  return true;
}

export function getProjectDocuments(projectId) {
  return readStore().documents.filter((entry) => entry.projectId === projectId);
}

export function createDocument(projectId, input) {
  const store = readStore();
  const document = {
    id: input.id ?? createId('d'),
    projectId,
    ...input,
    attachments: input.attachments ?? [],
    relatedTaskIds: [...new Set(input.relatedTaskIds)],
    updatedAt: now(),
  };

  store.documents.unshift(document);
  for (const taskId of document.relatedTaskIds) {
    syncTaskDocumentLink(store, taskId, document.id);
  }

  touchProject(store, projectId);
  writeStore(store);
  return document;
}

export function updateDocument(documentId, patch) {
  const store = readStore();
  const index = store.documents.findIndex((entry) => entry.id === documentId);

  if (index < 0) {
    return null;
  }

  const previousDocument = store.documents[index];
  const nextRelatedTaskIds =
    patch.relatedTaskIds !== undefined
      ? [...new Set(patch.relatedTaskIds)]
      : previousDocument.relatedTaskIds;

  store.documents[index] = {
    ...previousDocument,
    ...patch,
    relatedTaskIds: nextRelatedTaskIds,
    attachments: patch.attachments ?? previousDocument.attachments,
    updatedAt: now(),
  };

  const affectedTaskIds = new Set([...previousDocument.relatedTaskIds, ...nextRelatedTaskIds]);
  for (const taskId of affectedTaskIds) {
    syncTaskDocumentLink(
      store,
      taskId,
      nextRelatedTaskIds.includes(taskId) ? documentId : null,
    );
  }

  touchProject(store, previousDocument.projectId);
  writeStore(store);
  return store.documents[index];
}

export function deleteDocument(documentId) {
  const store = readStore();
  const document = store.documents.find((entry) => entry.id === documentId);

  if (!document) {
    return false;
  }

  store.documents = store.documents.filter((entry) => entry.id !== documentId);
  for (const task of store.tasks) {
    if (task.documentId === documentId) {
      task.documentId = undefined;
      task.updatedAt = now();
    }
  }

  touchProject(store, document.projectId);
  writeStore(store);
  return true;
}

export function getProjectSchedules(projectId) {
  return readStore().schedules.filter((entry) => entry.projectId === projectId);
}

export function createSchedule(input) {
  const store = readStore();
  const schedule = {
    id: input.id ?? createId('s'),
    ...input,
  };

  store.schedules.unshift(schedule);
  if (schedule.projectId) {
    touchProject(store, schedule.projectId);
  }
  writeStore(store);
  return schedule;
}

export function createTimetableBlock(input) {
  const store = readStore();
  const timetableBlock = {
    id: input.id ?? createId('tb'),
    ...input,
  };

  store.timetableBlocks.unshift(timetableBlock);
  writeStore(store);
  return timetableBlock;
}

export function updateUserRole(userId, role) {
  const store = readStore();
  const index = store.users.findIndex((entry) => entry.id === userId);

  if (index < 0) {
    return null;
  }

  store.users[index] = {
    ...store.users[index],
    role,
  };

  writeStore(store);
  return store.users[index];
}

export function updateSchedule(scheduleId, patch) {
  const store = readStore();
  const index = store.schedules.findIndex((entry) => entry.id === scheduleId);

  if (index < 0) {
    return null;
  }

  store.schedules[index] = {
    ...store.schedules[index],
    ...patch,
  };

  if (store.schedules[index].projectId) {
    touchProject(store, store.schedules[index].projectId);
  }

  writeStore(store);
  return store.schedules[index];
}

export function deleteSchedule(scheduleId) {
  const store = readStore();
  const schedule = store.schedules.find((entry) => entry.id === scheduleId);

  if (!schedule) {
    return false;
  }

  store.schedules = store.schedules.filter((entry) => entry.id !== scheduleId);
  if (schedule.projectId) {
    touchProject(store, schedule.projectId);
  }

  writeStore(store);
  return true;
}
