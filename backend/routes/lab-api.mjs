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
import { handleApiError, HttpError, readJsonBody, sendEmpty, sendJson } from '../lib/http.mjs';
import {
  validateDocumentInput,
  validateIdentifier,
  validateProjectInput,
  validateScheduleInput,
  validateTaskInput,
  validateTimetableBlockInput,
  validateUserRoleInput,
} from '../lib/validation.mjs';

export async function handleLabApiRequest(req, res, requestUrl) {
  if (!requestUrl.pathname.startsWith('/api/')) {
    return false;
  }

  try {
    if (req.method === 'GET' && requestUrl.pathname === '/api/lab/bootstrap') {
      sendJson(res, 200, getBootstrapData());
      return true;
    }

    if (req.method === 'GET' && requestUrl.pathname === '/api/users') {
      sendJson(res, 200, getUsers());
      return true;
    }

    if (req.method === 'POST' && requestUrl.pathname === '/api/timetable-blocks') {
      await handleTimetableBlocksCollection(req, res);
      return true;
    }

    if (requestUrl.pathname === '/api/schedules') {
      await handleSchedulesCollection(req, res);
      return true;
    }

    if (requestUrl.pathname === '/api/projects') {
      await handleProjectsCollection(req, res);
      return true;
    }

    const projectMatch = requestUrl.pathname.match(/^\/api\/projects\/([^/]+)$/);
    if (projectMatch) {
      await handleProjectItem(req, res, decodeURIComponent(projectMatch[1]));
      return true;
    }

    const projectChildMatch = requestUrl.pathname.match(/^\/api\/projects\/([^/]+)\/(tasks|documents|schedules)$/);
    if (projectChildMatch) {
      const projectId = decodeURIComponent(projectChildMatch[1]);
      const resource = projectChildMatch[2];

      if (resource === 'tasks') {
        await handleProjectTasks(req, res, projectId);
      } else if (resource === 'documents') {
        await handleProjectDocuments(req, res, projectId);
      } else {
        await handleProjectSchedules(req, res, projectId);
      }

      return true;
    }

    const taskMatch = requestUrl.pathname.match(/^\/api\/tasks\/([^/]+)$/);
    if (taskMatch) {
      await handleTaskItem(req, res, decodeURIComponent(taskMatch[1]));
      return true;
    }

    const documentMatch = requestUrl.pathname.match(/^\/api\/documents\/([^/]+)$/);
    if (documentMatch) {
      await handleDocumentItem(req, res, decodeURIComponent(documentMatch[1]));
      return true;
    }

    const scheduleMatch = requestUrl.pathname.match(/^\/api\/schedules\/([^/]+)$/);
    if (scheduleMatch) {
      await handleScheduleItem(req, res, decodeURIComponent(scheduleMatch[1]));
      return true;
    }

    const userRoleMatch = requestUrl.pathname.match(/^\/api\/users\/([^/]+)\/role$/);
    if (userRoleMatch) {
      await handleUserRoleItem(req, res, decodeURIComponent(userRoleMatch[1]));
      return true;
    }
  } catch (error) {
    handleApiError(res, error);
    return true;
  }

  return false;
}

async function handleProjectsCollection(req, res) {
  if (req.method === 'GET') {
    sendJson(res, 200, getProjects());
    return;
  }

  if (req.method === 'POST') {
    const payload = validateProjectInput(await readJsonBody(req));
    assertUsersExist(payload.memberIds);
    const project = createProject(payload);
    sendJson(res, 201, project);
    return;
  }

  throw new HttpError(405, 'Method not allowed.');
}

async function handleTimetableBlocksCollection(req, res) {
  const payload = validateTimetableBlockInput(await readJsonBody(req));
  assertUserExists(payload.userId);
  const timetableBlock = createTimetableBlock(payload);
  sendJson(res, 201, timetableBlock);
}

async function handleSchedulesCollection(req, res) {
  if (req.method !== 'POST') {
    throw new HttpError(405, 'Method not allowed.');
  }

  const payload = validateScheduleInput(await readJsonBody(req));
  if (payload.ownerId) {
    assertUserExists(payload.ownerId);
  }

  if (payload.projectId) {
    const project = getProject(payload.projectId);
    if (!project) {
      throw new HttpError(400, `Unknown projectId: ${payload.projectId}.`);
    }
  }

  const schedule = createSchedule(payload);
  sendJson(res, 201, schedule);
}

async function handleProjectItem(req, res, projectId) {
  validateIdentifier(projectId, 'projectId');

  if (req.method === 'GET') {
    const bundle = getProjectBundle(projectId);
    if (!bundle) {
      throw new HttpError(404, 'Project not found.');
    }

    sendJson(res, 200, bundle);
    return;
  }

  if (req.method === 'PATCH') {
    const existing = getProject(projectId);
    if (!existing) {
      throw new HttpError(404, 'Project not found.');
    }

    const patch = validateProjectInput(await readJsonBody(req), { partial: true });
    const project = updateProject(projectId, patch);
    sendJson(res, 200, project);
    return;
  }

  if (req.method === 'DELETE') {
    if (!deleteProject(projectId)) {
      throw new HttpError(404, 'Project not found.');
    }

    sendEmpty(res);
    return;
  }

  throw new HttpError(405, 'Method not allowed.');
}

async function handleProjectTasks(req, res, projectId) {
  const project = getProject(projectId);
  if (!project) {
    throw new HttpError(404, 'Project not found.');
  }

  if (req.method === 'GET') {
    sendJson(res, 200, getProjectTasks(projectId));
    return;
  }

  if (req.method === 'POST') {
    const payload = validateTaskInput(await readJsonBody(req));
    assertUserExists(payload.assigneeId);
    if (payload.documentId !== null && payload.documentId !== undefined) {
      assertDocumentBelongsToProject(payload.documentId, projectId);
    }

    const task = createTask(projectId, payload);
    sendJson(res, 201, task);
    return;
  }

  throw new HttpError(405, 'Method not allowed.');
}

async function handleTaskItem(req, res, taskId) {
  const task = getTask(taskId);
  if (!task) {
    throw new HttpError(404, 'Task not found.');
  }

  if (req.method === 'PATCH') {
    const patch = validateTaskInput(await readJsonBody(req), { partial: true });
    if (patch.assigneeId) {
      assertUserExists(patch.assigneeId);
    }

    if (patch.documentId !== undefined && patch.documentId !== null) {
      assertDocumentBelongsToProject(patch.documentId, task.projectId);
    }

    const updatedTask = updateTask(taskId, patch);
    sendJson(res, 200, updatedTask);
    return;
  }

  if (req.method === 'DELETE') {
    deleteTask(taskId);
    sendEmpty(res);
    return;
  }

  throw new HttpError(405, 'Method not allowed.');
}

async function handleProjectDocuments(req, res, projectId) {
  const project = getProject(projectId);
  if (!project) {
    throw new HttpError(404, 'Project not found.');
  }

  if (req.method === 'GET') {
    sendJson(res, 200, getProjectDocuments(projectId));
    return;
  }

  if (req.method === 'POST') {
    const payload = validateDocumentInput(await readJsonBody(req));
    assertUserExists(payload.authorId);
    assertTasksBelongToProject(payload.relatedTaskIds, projectId);

    const document = createDocument(projectId, payload);
    sendJson(res, 201, document);
    return;
  }

  throw new HttpError(405, 'Method not allowed.');
}

async function handleDocumentItem(req, res, documentId) {
  const document = getDocument(documentId);
  if (!document) {
    throw new HttpError(404, 'Document not found.');
  }

  if (req.method === 'PATCH') {
    const patch = validateDocumentInput(await readJsonBody(req), { partial: true });
    if (patch.authorId) {
      assertUserExists(patch.authorId);
    }

    if (patch.relatedTaskIds) {
      assertTasksBelongToProject(patch.relatedTaskIds, document.projectId);
    }

    const updatedDocument = updateDocument(documentId, patch);
    sendJson(res, 200, updatedDocument);
    return;
  }

  if (req.method === 'DELETE') {
    deleteDocument(documentId);
    sendEmpty(res);
    return;
  }

  throw new HttpError(405, 'Method not allowed.');
}

async function handleProjectSchedules(req, res, projectId) {
  const project = getProject(projectId);
  if (!project) {
    throw new HttpError(404, 'Project not found.');
  }

  if (req.method === 'GET') {
    sendJson(res, 200, getProjectSchedules(projectId));
    return;
  }

  if (req.method === 'POST') {
    const payload = validateScheduleInput(await readJsonBody(req));
    if (payload.ownerId) {
      assertUserExists(payload.ownerId);
    }

    const schedule = createSchedule({ ...payload, projectId });
    sendJson(res, 201, schedule);
    return;
  }

  throw new HttpError(405, 'Method not allowed.');
}

async function handleScheduleItem(req, res, scheduleId) {
  const schedule = getSchedule(scheduleId);
  if (!schedule) {
    throw new HttpError(404, 'Schedule not found.');
  }

  if (req.method === 'PATCH') {
    const patch = validateScheduleInput(await readJsonBody(req), { partial: true });
    if (patch.ownerId) {
      assertUserExists(patch.ownerId);
    }

    const updatedSchedule = updateSchedule(scheduleId, patch);
    sendJson(res, 200, updatedSchedule);
    return;
  }

  if (req.method === 'DELETE') {
    deleteSchedule(scheduleId);
    sendEmpty(res);
    return;
  }

  throw new HttpError(405, 'Method not allowed.');
}

async function handleUserRoleItem(req, res, userId) {
  const user = getUser(userId);
  if (!user) {
    throw new HttpError(404, 'User not found.');
  }

  if (req.method === 'PATCH') {
    const payload = validateUserRoleInput(await readJsonBody(req));
    const updatedUser = updateUserRole(userId, payload.role);
    sendJson(res, 200, updatedUser);
    return;
  }

  throw new HttpError(405, 'Method not allowed.');
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
