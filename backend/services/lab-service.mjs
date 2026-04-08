import {
  createDocument,
  createProject,
  createSchedule,
  createTask,
  createTimetableBlock,
  deleteDocument,
  deleteProject,
  deleteSchedule,
  deleteTask,
  getBootstrapData,
  getDocument,
  getProject,
  getProjectBundle,
  getProjectDocuments,
  getProjectSchedules,
  getProjects,
  getProjectTasks,
  getSchedule,
  getTask,
  getUser,
  getUsers,
  updateDocument,
  updateProject,
  updateSchedule,
  updateTask,
  updateUserRole,
} from '../data/store.mjs';
import { HttpError } from '../lib/http.mjs';

export function getLabBootstrap() {
  return getBootstrapData();
}

export function listUsers() {
  return getUsers();
}

export function listProjects() {
  return getProjects();
}

export function createProjectRecord(payload) {
  assertUsersExist(payload.memberIds);
  return createProject(payload);
}

export function getProjectBundleRecord(projectId) {
  const bundle = getProjectBundle(projectId);
  if (!bundle) {
    throw new HttpError(404, 'Project not found.');
  }

  return bundle;
}

export function updateProjectRecord(projectId, patch) {
  const project = getProject(projectId);
  if (!project) {
    throw new HttpError(404, 'Project not found.');
  }

  if (patch.memberIds) {
    assertUsersExist(patch.memberIds);
  }

  return updateProject(projectId, patch);
}

export function deleteProjectRecord(projectId) {
  if (!deleteProject(projectId)) {
    throw new HttpError(404, 'Project not found.');
  }
}

export function listProjectTasks(projectId) {
  assertProjectExists(projectId);
  return getProjectTasks(projectId);
}

export function createProjectTaskRecord(projectId, payload) {
  assertProjectExists(projectId);
  assertUserExists(payload.assigneeId);

  if (payload.documentId !== null && payload.documentId !== undefined) {
    assertDocumentBelongsToProject(payload.documentId, projectId);
  }

  return createTask(projectId, payload);
}

export function updateTaskRecord(taskId, patch) {
  const task = getTask(taskId);
  if (!task) {
    throw new HttpError(404, 'Task not found.');
  }

  if (patch.assigneeId) {
    assertUserExists(patch.assigneeId);
  }

  if (patch.documentId !== undefined && patch.documentId !== null) {
    assertDocumentBelongsToProject(patch.documentId, task.projectId);
  }

  return updateTask(taskId, patch);
}

export function deleteTaskRecord(taskId) {
  if (!deleteTask(taskId)) {
    throw new HttpError(404, 'Task not found.');
  }
}

export function listProjectDocuments(projectId) {
  assertProjectExists(projectId);
  return getProjectDocuments(projectId);
}

export function createProjectDocumentRecord(projectId, payload) {
  assertProjectExists(projectId);
  assertUserExists(payload.authorId);
  assertTasksBelongToProject(payload.relatedTaskIds, projectId);

  return createDocument(projectId, payload);
}

export function updateDocumentRecord(documentId, patch) {
  const document = getDocument(documentId);
  if (!document) {
    throw new HttpError(404, 'Document not found.');
  }

  if (patch.authorId) {
    assertUserExists(patch.authorId);
  }

  if (patch.relatedTaskIds) {
    assertTasksBelongToProject(patch.relatedTaskIds, document.projectId);
  }

  return updateDocument(documentId, patch);
}

export function deleteDocumentRecord(documentId) {
  if (!deleteDocument(documentId)) {
    throw new HttpError(404, 'Document not found.');
  }
}

export function createStandaloneScheduleRecord(payload) {
  if (payload.ownerId) {
    assertUserExists(payload.ownerId);
  }

  if (payload.projectId) {
    assertProjectExists(payload.projectId);
  }

  return createSchedule(payload);
}

export function listProjectSchedules(projectId) {
  assertProjectExists(projectId);
  return getProjectSchedules(projectId);
}

export function createProjectScheduleRecord(projectId, payload) {
  assertProjectExists(projectId);

  if (payload.ownerId) {
    assertUserExists(payload.ownerId);
  }

  return createSchedule({ ...payload, projectId });
}

export function updateScheduleRecord(scheduleId, patch) {
  const schedule = getSchedule(scheduleId);
  if (!schedule) {
    throw new HttpError(404, 'Schedule not found.');
  }

  if (patch.ownerId) {
    assertUserExists(patch.ownerId);
  }

  if (patch.projectId) {
    assertProjectExists(patch.projectId);
  }

  return updateSchedule(scheduleId, patch);
}

export function deleteScheduleRecord(scheduleId) {
  if (!deleteSchedule(scheduleId)) {
    throw new HttpError(404, 'Schedule not found.');
  }
}

export function createTimetableBlockRecord(payload) {
  assertUserExists(payload.userId);
  return createTimetableBlock(payload);
}

export function updateUserRoleRecord(userId, role) {
  const user = getUser(userId);
  if (!user) {
    throw new HttpError(404, 'User not found.');
  }

  return updateUserRole(userId, role);
}

function assertProjectExists(projectId) {
  const project = getProject(projectId);
  if (!project) {
    throw new HttpError(404, 'Project not found.');
  }

  return project;
}

function assertUserExists(userId) {
  if (!getUsers().some((entry) => entry.id === userId)) {
    throw new HttpError(400, `Unknown userId: ${userId}.`);
  }
}

function assertUsersExist(userIds) {
  for (const userId of userIds) {
    assertUserExists(userId);
  }
}

function assertDocumentBelongsToProject(documentId, projectId) {
  const document = getDocument(documentId);
  if (!document || document.projectId !== projectId) {
    throw new HttpError(400, `Document ${documentId} does not belong to project ${projectId}.`);
  }
}

function assertTasksBelongToProject(taskIds, projectId) {
  for (const taskId of taskIds) {
    const task = getTask(taskId);
    if (!task || task.projectId !== projectId) {
      throw new HttpError(400, `Task ${taskId} does not belong to project ${projectId}.`);
    }
  }
}
