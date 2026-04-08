import { HttpError } from '../lib/http.mjs';
import { labRepository } from '../repositories/lab-repository.mjs';

export async function getLabBootstrap() {
  return labRepository.getBootstrapData();
}

export async function listUsers() {
  return labRepository.getUsers();
}

export async function listProjects() {
  return labRepository.getProjects();
}

export async function createProjectRecord(payload) {
  await assertUsersExist(payload.memberIds);
  return labRepository.createProject(payload);
}

export async function getProjectBundleRecord(projectId) {
  const bundle = await labRepository.getProjectBundle(projectId);
  if (!bundle) {
    throw new HttpError(404, 'Project not found.');
  }

  return bundle;
}

export async function updateProjectRecord(projectId, patch) {
  const project = await labRepository.getProject(projectId);
  if (!project) {
    throw new HttpError(404, 'Project not found.');
  }

  if (patch.memberIds) {
    await assertUsersExist(patch.memberIds);
  }

  return labRepository.updateProject(projectId, patch);
}

export async function deleteProjectRecord(projectId) {
  if (!(await labRepository.deleteProject(projectId))) {
    throw new HttpError(404, 'Project not found.');
  }
}

export async function listProjectTasks(projectId) {
  await assertProjectExists(projectId);
  return labRepository.getProjectTasks(projectId);
}

export async function createProjectTaskRecord(projectId, payload) {
  await assertProjectExists(projectId);
  await assertUserExists(payload.assigneeId);

  if (payload.documentId !== null && payload.documentId !== undefined) {
    await assertDocumentBelongsToProject(payload.documentId, projectId);
  }

  return labRepository.createTask(projectId, payload);
}

export async function updateTaskRecord(taskId, patch) {
  const task = await labRepository.getTask(taskId);
  if (!task) {
    throw new HttpError(404, 'Task not found.');
  }

  if (patch.assigneeId) {
    await assertUserExists(patch.assigneeId);
  }

  if (patch.documentId !== undefined && patch.documentId !== null) {
    await assertDocumentBelongsToProject(patch.documentId, task.projectId);
  }

  return labRepository.updateTask(taskId, patch);
}

export async function deleteTaskRecord(taskId) {
  if (!(await labRepository.deleteTask(taskId))) {
    throw new HttpError(404, 'Task not found.');
  }
}

export async function listProjectDocuments(projectId) {
  await assertProjectExists(projectId);
  return labRepository.getProjectDocuments(projectId);
}

export async function createProjectDocumentRecord(projectId, payload) {
  await assertProjectExists(projectId);
  await assertUserExists(payload.authorId);
  await assertTasksBelongToProject(payload.relatedTaskIds, projectId);

  return labRepository.createDocument(projectId, payload);
}

export async function updateDocumentRecord(documentId, patch) {
  const document = await labRepository.getDocument(documentId);
  if (!document) {
    throw new HttpError(404, 'Document not found.');
  }

  if (patch.authorId) {
    await assertUserExists(patch.authorId);
  }

  if (patch.relatedTaskIds) {
    await assertTasksBelongToProject(patch.relatedTaskIds, document.projectId);
  }

  return labRepository.updateDocument(documentId, patch);
}

export async function deleteDocumentRecord(documentId) {
  if (!(await labRepository.deleteDocument(documentId))) {
    throw new HttpError(404, 'Document not found.');
  }
}

export async function createStandaloneScheduleRecord(payload) {
  if (payload.ownerId) {
    await assertUserExists(payload.ownerId);
  }

  if (payload.projectId) {
    await assertProjectExists(payload.projectId);
  }

  return labRepository.createSchedule(payload);
}

export async function listProjectSchedules(projectId) {
  await assertProjectExists(projectId);
  return labRepository.getProjectSchedules(projectId);
}

export async function createProjectScheduleRecord(projectId, payload) {
  await assertProjectExists(projectId);

  if (payload.ownerId) {
    await assertUserExists(payload.ownerId);
  }

  return labRepository.createSchedule({ ...payload, projectId });
}

export async function updateScheduleRecord(scheduleId, patch) {
  const schedule = await labRepository.getSchedule(scheduleId);
  if (!schedule) {
    throw new HttpError(404, 'Schedule not found.');
  }

  if (patch.ownerId) {
    await assertUserExists(patch.ownerId);
  }

  if (patch.projectId) {
    await assertProjectExists(patch.projectId);
  }

  return labRepository.updateSchedule(scheduleId, patch);
}

export async function deleteScheduleRecord(scheduleId) {
  if (!(await labRepository.deleteSchedule(scheduleId))) {
    throw new HttpError(404, 'Schedule not found.');
  }
}

export async function createTimetableBlockRecord(payload) {
  await assertUserExists(payload.userId);
  return labRepository.createTimetableBlock(payload);
}

export async function updateUserRoleRecord(userId, role) {
  const user = await labRepository.getUser(userId);
  if (!user) {
    throw new HttpError(404, 'User not found.');
  }

  return labRepository.updateUserRole(userId, role);
}

async function assertProjectExists(projectId) {
  const project = await labRepository.getProject(projectId);
  if (!project) {
    throw new HttpError(404, 'Project not found.');
  }

  return project;
}

async function assertUserExists(userId) {
  if (!(await labRepository.getUsers()).some((entry) => entry.id === userId)) {
    throw new HttpError(400, `Unknown userId: ${userId}.`);
  }
}

async function assertUsersExist(userIds) {
  for (const userId of userIds) {
    await assertUserExists(userId);
  }
}

async function assertDocumentBelongsToProject(documentId, projectId) {
  const document = await labRepository.getDocument(documentId);
  if (!document || document.projectId !== projectId) {
    throw new HttpError(400, `Document ${documentId} does not belong to project ${projectId}.`);
  }
}

async function assertTasksBelongToProject(taskIds, projectId) {
  for (const taskId of taskIds) {
    const task = await labRepository.getTask(taskId);
    if (!task || task.projectId !== projectId) {
      throw new HttpError(400, `Task ${taskId} does not belong to project ${projectId}.`);
    }
  }
}
