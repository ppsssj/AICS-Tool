import { HttpError } from '../lib/http.mjs';
import { labRepository } from '../repositories/lab-repository.mjs';

export function getLabBootstrap() {
  return labRepository.getBootstrapData();
}

export function listUsers() {
  return labRepository.getUsers();
}

export function listProjects() {
  return labRepository.getProjects();
}

export function createProjectRecord(payload) {
  assertUsersExist(payload.memberIds);
  return labRepository.createProject(payload);
}

export function getProjectBundleRecord(projectId) {
  const bundle = labRepository.getProjectBundle(projectId);
  if (!bundle) {
    throw new HttpError(404, 'Project not found.');
  }

  return bundle;
}

export function updateProjectRecord(projectId, patch) {
  const project = labRepository.getProject(projectId);
  if (!project) {
    throw new HttpError(404, 'Project not found.');
  }

  if (patch.memberIds) {
    assertUsersExist(patch.memberIds);
  }

  return labRepository.updateProject(projectId, patch);
}

export function deleteProjectRecord(projectId) {
  if (!labRepository.deleteProject(projectId)) {
    throw new HttpError(404, 'Project not found.');
  }
}

export function listProjectTasks(projectId) {
  assertProjectExists(projectId);
  return labRepository.getProjectTasks(projectId);
}

export function createProjectTaskRecord(projectId, payload) {
  assertProjectExists(projectId);
  assertUserExists(payload.assigneeId);

  if (payload.documentId !== null && payload.documentId !== undefined) {
    assertDocumentBelongsToProject(payload.documentId, projectId);
  }

  return labRepository.createTask(projectId, payload);
}

export function updateTaskRecord(taskId, patch) {
  const task = labRepository.getTask(taskId);
  if (!task) {
    throw new HttpError(404, 'Task not found.');
  }

  if (patch.assigneeId) {
    assertUserExists(patch.assigneeId);
  }

  if (patch.documentId !== undefined && patch.documentId !== null) {
    assertDocumentBelongsToProject(patch.documentId, task.projectId);
  }

  return labRepository.updateTask(taskId, patch);
}

export function deleteTaskRecord(taskId) {
  if (!labRepository.deleteTask(taskId)) {
    throw new HttpError(404, 'Task not found.');
  }
}

export function listProjectDocuments(projectId) {
  assertProjectExists(projectId);
  return labRepository.getProjectDocuments(projectId);
}

export function createProjectDocumentRecord(projectId, payload) {
  assertProjectExists(projectId);
  assertUserExists(payload.authorId);
  assertTasksBelongToProject(payload.relatedTaskIds, projectId);

  return labRepository.createDocument(projectId, payload);
}

export function updateDocumentRecord(documentId, patch) {
  const document = labRepository.getDocument(documentId);
  if (!document) {
    throw new HttpError(404, 'Document not found.');
  }

  if (patch.authorId) {
    assertUserExists(patch.authorId);
  }

  if (patch.relatedTaskIds) {
    assertTasksBelongToProject(patch.relatedTaskIds, document.projectId);
  }

  return labRepository.updateDocument(documentId, patch);
}

export function deleteDocumentRecord(documentId) {
  if (!labRepository.deleteDocument(documentId)) {
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

  return labRepository.createSchedule(payload);
}

export function listProjectSchedules(projectId) {
  assertProjectExists(projectId);
  return labRepository.getProjectSchedules(projectId);
}

export function createProjectScheduleRecord(projectId, payload) {
  assertProjectExists(projectId);

  if (payload.ownerId) {
    assertUserExists(payload.ownerId);
  }

  return labRepository.createSchedule({ ...payload, projectId });
}

export function updateScheduleRecord(scheduleId, patch) {
  const schedule = labRepository.getSchedule(scheduleId);
  if (!schedule) {
    throw new HttpError(404, 'Schedule not found.');
  }

  if (patch.ownerId) {
    assertUserExists(patch.ownerId);
  }

  if (patch.projectId) {
    assertProjectExists(patch.projectId);
  }

  return labRepository.updateSchedule(scheduleId, patch);
}

export function deleteScheduleRecord(scheduleId) {
  if (!labRepository.deleteSchedule(scheduleId)) {
    throw new HttpError(404, 'Schedule not found.');
  }
}

export function createTimetableBlockRecord(payload) {
  assertUserExists(payload.userId);
  return labRepository.createTimetableBlock(payload);
}

export function updateUserRoleRecord(userId, role) {
  const user = labRepository.getUser(userId);
  if (!user) {
    throw new HttpError(404, 'User not found.');
  }

  return labRepository.updateUserRole(userId, role);
}

function assertProjectExists(projectId) {
  const project = labRepository.getProject(projectId);
  if (!project) {
    throw new HttpError(404, 'Project not found.');
  }

  return project;
}

function assertUserExists(userId) {
  if (!labRepository.getUsers().some((entry) => entry.id === userId)) {
    throw new HttpError(400, `Unknown userId: ${userId}.`);
  }
}

function assertUsersExist(userIds) {
  for (const userId of userIds) {
    assertUserExists(userId);
  }
}

function assertDocumentBelongsToProject(documentId, projectId) {
  const document = labRepository.getDocument(documentId);
  if (!document || document.projectId !== projectId) {
    throw new HttpError(400, `Document ${documentId} does not belong to project ${projectId}.`);
  }
}

function assertTasksBelongToProject(taskIds, projectId) {
  for (const taskId of taskIds) {
    const task = labRepository.getTask(taskId);
    if (!task || task.projectId !== projectId) {
      throw new HttpError(400, `Task ${taskId} does not belong to project ${projectId}.`);
    }
  }
}
