import { handleApiError, HttpError, readJsonBody, sendEmpty, sendJson } from '../lib/http.mjs';
import {
  createProjectDocumentRecord,
  createProjectRecord,
  createProjectScheduleRecord,
  createProjectTaskRecord,
  createStandaloneScheduleRecord,
  createTimetableBlockRecord,
  deleteDocumentRecord,
  deleteProjectRecord,
  deleteScheduleRecord,
  deleteTaskRecord,
  getLabBootstrap,
  getProjectBundleRecord,
  listProjectDocuments,
  listProjectSchedules,
  listProjects,
  listProjectTasks,
  listUsers,
  updateDocumentRecord,
  updateProjectRecord,
  updateScheduleRecord,
  updateTaskRecord,
  updateUserRoleRecord,
} from '../services/lab-service.mjs';
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
      sendJson(res, 200, await getLabBootstrap());
      return true;
    }

    if (req.method === 'GET' && requestUrl.pathname === '/api/users') {
      sendJson(res, 200, await listUsers());
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
    sendJson(res, 200, await listProjects());
    return;
  }

  if (req.method === 'POST') {
    const payload = validateProjectInput(await readJsonBody(req));
    const project = await createProjectRecord(payload);
    sendJson(res, 201, project);
    return;
  }

  throw new HttpError(405, 'Method not allowed.');
}

async function handleTimetableBlocksCollection(req, res) {
  const payload = validateTimetableBlockInput(await readJsonBody(req));
  const timetableBlock = await createTimetableBlockRecord(payload);
  sendJson(res, 201, timetableBlock);
}

async function handleSchedulesCollection(req, res) {
  if (req.method !== 'POST') {
    throw new HttpError(405, 'Method not allowed.');
  }

  const payload = validateScheduleInput(await readJsonBody(req));
  const schedule = await createStandaloneScheduleRecord(payload);
  sendJson(res, 201, schedule);
}

async function handleProjectItem(req, res, projectId) {
  validateIdentifier(projectId, 'projectId');

  if (req.method === 'GET') {
    const bundle = await getProjectBundleRecord(projectId);
    sendJson(res, 200, bundle);
    return;
  }

  if (req.method === 'PATCH') {
    const patch = validateProjectInput(await readJsonBody(req), { partial: true });
    const project = await updateProjectRecord(projectId, patch);
    sendJson(res, 200, project);
    return;
  }

  if (req.method === 'DELETE') {
    await deleteProjectRecord(projectId);
    sendEmpty(res);
    return;
  }

  throw new HttpError(405, 'Method not allowed.');
}

async function handleProjectTasks(req, res, projectId) {
  if (req.method === 'GET') {
    sendJson(res, 200, await listProjectTasks(projectId));
    return;
  }

  if (req.method === 'POST') {
    const payload = validateTaskInput(await readJsonBody(req));
    const task = await createProjectTaskRecord(projectId, payload);
    sendJson(res, 201, task);
    return;
  }

  throw new HttpError(405, 'Method not allowed.');
}

async function handleTaskItem(req, res, taskId) {
  if (req.method === 'PATCH') {
    const patch = validateTaskInput(await readJsonBody(req), { partial: true });
    const updatedTask = await updateTaskRecord(taskId, patch);
    sendJson(res, 200, updatedTask);
    return;
  }

  if (req.method === 'DELETE') {
    await deleteTaskRecord(taskId);
    sendEmpty(res);
    return;
  }

  throw new HttpError(405, 'Method not allowed.');
}

async function handleProjectDocuments(req, res, projectId) {
  if (req.method === 'GET') {
    sendJson(res, 200, await listProjectDocuments(projectId));
    return;
  }

  if (req.method === 'POST') {
    const payload = validateDocumentInput(await readJsonBody(req));
    const document = await createProjectDocumentRecord(projectId, payload);
    sendJson(res, 201, document);
    return;
  }

  throw new HttpError(405, 'Method not allowed.');
}

async function handleDocumentItem(req, res, documentId) {
  if (req.method === 'PATCH') {
    const patch = validateDocumentInput(await readJsonBody(req), { partial: true });
    const updatedDocument = await updateDocumentRecord(documentId, patch);
    sendJson(res, 200, updatedDocument);
    return;
  }

  if (req.method === 'DELETE') {
    await deleteDocumentRecord(documentId);
    sendEmpty(res);
    return;
  }

  throw new HttpError(405, 'Method not allowed.');
}

async function handleProjectSchedules(req, res, projectId) {
  if (req.method === 'GET') {
    sendJson(res, 200, await listProjectSchedules(projectId));
    return;
  }

  if (req.method === 'POST') {
    const payload = validateScheduleInput(await readJsonBody(req));
    const schedule = await createProjectScheduleRecord(projectId, payload);
    sendJson(res, 201, schedule);
    return;
  }

  throw new HttpError(405, 'Method not allowed.');
}

async function handleScheduleItem(req, res, scheduleId) {
  if (req.method === 'PATCH') {
    const patch = validateScheduleInput(await readJsonBody(req), { partial: true });
    const updatedSchedule = await updateScheduleRecord(scheduleId, patch);
    sendJson(res, 200, updatedSchedule);
    return;
  }

  if (req.method === 'DELETE') {
    await deleteScheduleRecord(scheduleId);
    sendEmpty(res);
    return;
  }

  throw new HttpError(405, 'Method not allowed.');
}

async function handleUserRoleItem(req, res, userId) {
  if (req.method === 'PATCH') {
    const payload = validateUserRoleInput(await readJsonBody(req));
    const updatedUser = await updateUserRoleRecord(userId, payload.role);
    sendJson(res, 200, updatedUser);
    return;
  }

  throw new HttpError(405, 'Method not allowed.');
}
