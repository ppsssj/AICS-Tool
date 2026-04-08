import { HttpError } from './http.mjs';

const PROJECT_STATUSES = ['Planning', 'Active', 'Done', 'Archived'];
const ROLES = ['Admin', 'Member', 'Viewer'];
const TASK_STATUSES = ['Todo', 'In Progress', 'Review', 'Done'];
const TASK_PRIORITIES = ['Low', 'Medium', 'High', 'Urgent'];
const SCHEDULE_TYPES = ['Personal', 'Lab', 'Project'];
const TIMETABLE_BLOCK_TYPES = ['Class', 'Unavailable', 'Lab Availability'];
const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export function validateProjectInput(payload, { partial = false } = {}) {
  const value = ensureObject(payload);

  return compactDefined({
    id: readOptionalClientId(value, { partial }),
    title: readString(value, 'title', { partial }),
    description: readString(value, 'description', { partial }),
    status: readEnum(value, 'status', PROJECT_STATUSES, { partial }),
    memberIds: readStringArray(value, 'memberIds', { partial }),
  });
}

export function validateTaskInput(payload, { partial = false } = {}) {
  const value = ensureObject(payload);

  return compactDefined({
    id: readOptionalClientId(value, { partial }),
    title: readString(value, 'title', { partial }),
    description: readString(value, 'description', { partial }),
    status: readEnum(value, 'status', TASK_STATUSES, { partial }),
    priority: readEnum(value, 'priority', TASK_PRIORITIES, { partial }),
    assigneeId: readString(value, 'assigneeId', { partial }),
    dueDate: readIsoDate(value, 'dueDate', { partial }),
    documentId: readNullableString(value, 'documentId', { partial }),
  });
}

export function validateDocumentInput(payload, { partial = false } = {}) {
  const value = ensureObject(payload);

  return compactDefined({
    id: readOptionalClientId(value, { partial }),
    title: readString(value, 'title', { partial }),
    body: readString(value, 'body', { partial }),
    tags: readStringArray(value, 'tags', { partial }),
    authorId: readString(value, 'authorId', { partial }),
    relatedTaskIds: readStringArray(value, 'relatedTaskIds', { partial }),
    attachments: readAttachmentArray(value, 'attachments', { partial }),
  });
}

export function validateScheduleInput(payload, { partial = false } = {}) {
  const value = ensureObject(payload);

  return compactDefined({
    id: readOptionalClientId(value, { partial }),
    title: readString(value, 'title', { partial }),
    type: readEnum(value, 'type', SCHEDULE_TYPES, { partial }),
    day: readEnum(value, 'day', WEEKDAYS, { partial }),
    startTime: readTime(value, 'startTime', { partial }),
    endTime: readTime(value, 'endTime', { partial }),
    location: readString(value, 'location', { partial }),
    note: readString(value, 'note', { partial }),
    ownerId: readNullableString(value, 'ownerId', { partial }),
  });
}

export function validateTimetableBlockInput(payload, { partial = false } = {}) {
  const value = ensureObject(payload);

  return compactDefined({
    id: readOptionalClientId(value, { partial }),
    userId: readString(value, 'userId', { partial }),
    day: readEnum(value, 'day', WEEKDAYS, { partial }),
    startTime: readTime(value, 'startTime', { partial }),
    endTime: readTime(value, 'endTime', { partial }),
    category: readEnum(value, 'category', TIMETABLE_BLOCK_TYPES, { partial }),
    title: readString(value, 'title', { partial }),
  });
}

export function validateUserRoleInput(payload) {
  const value = ensureObject(payload);

  return {
    role: readEnum(value, 'role', ROLES),
  };
}

export function validateIdentifier(value, label) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new HttpError(400, `${label} is required.`);
  }

  return value.trim();
}

function ensureObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new HttpError(400, 'Request body must be an object.');
  }

  return value;
}

function readString(value, key, { partial = false } = {}) {
  if (!(key in value)) {
    if (partial) {
      return undefined;
    }

    throw new HttpError(400, `${key} is required.`);
  }

  if (typeof value[key] !== 'string' || !value[key].trim()) {
    throw new HttpError(400, `${key} must be a non-empty string.`);
  }

  return value[key].trim();
}

function readOptionalClientId(value, { partial = false } = {}) {
  if (partial || !('id' in value)) {
    return undefined;
  }

  if (typeof value.id !== 'string' || !/^[A-Za-z0-9_-]+$/.test(value.id)) {
    throw new HttpError(400, 'id must contain only letters, numbers, underscores, or hyphens.');
  }

  return value.id.trim();
}

function readNullableString(value, key, { partial = false } = {}) {
  if (!(key in value)) {
    return partial ? undefined : null;
  }

  if (value[key] === null) {
    return null;
  }

  if (typeof value[key] !== 'string' || !value[key].trim()) {
    throw new HttpError(400, `${key} must be a string or null.`);
  }

  return value[key].trim();
}

function readStringArray(value, key, { partial = false } = {}) {
  if (!(key in value)) {
    if (partial) {
      return undefined;
    }

    throw new HttpError(400, `${key} is required.`);
  }

  if (!Array.isArray(value[key])) {
    throw new HttpError(400, `${key} must be an array of strings.`);
  }

  const items = value[key].map((entry) => {
    if (typeof entry !== 'string' || !entry.trim()) {
      throw new HttpError(400, `${key} must contain non-empty strings.`);
    }

    return entry.trim();
  });

  return [...new Set(items)];
}

function readEnum(value, key, allowed, { partial = false } = {}) {
  if (!(key in value)) {
    if (partial) {
      return undefined;
    }

    throw new HttpError(400, `${key} is required.`);
  }

  if (typeof value[key] !== 'string' || !allowed.includes(value[key])) {
    throw new HttpError(400, `${key} must be one of: ${allowed.join(', ')}.`);
  }

  return value[key];
}

function readIsoDate(value, key, { partial = false } = {}) {
  if (!(key in value)) {
    if (partial) {
      return undefined;
    }

    throw new HttpError(400, `${key} is required.`);
  }

  if (typeof value[key] !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value[key])) {
    throw new HttpError(400, `${key} must use YYYY-MM-DD format.`);
  }

  return value[key];
}

function readTime(value, key, { partial = false } = {}) {
  if (!(key in value)) {
    if (partial) {
      return undefined;
    }

    throw new HttpError(400, `${key} is required.`);
  }

  if (typeof value[key] !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(value[key])) {
    throw new HttpError(400, `${key} must use HH:MM 24-hour format.`);
  }

  return value[key];
}

function readAttachmentArray(value, key, { partial = false } = {}) {
  if (!(key in value)) {
    return partial ? undefined : [];
  }

  if (!Array.isArray(value[key])) {
    throw new HttpError(400, `${key} must be an array.`);
  }

  return value[key].map((entry, index) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      throw new HttpError(400, `${key}[${index}] must be an object.`);
    }

    return {
      id: readString(entry, 'id'),
      name: readString(entry, 'name'),
      type: readString(entry, 'type'),
      size: readNumber(entry, 'size'),
      uploadedAt: readString(entry, 'uploadedAt'),
      dataUrl: readString(entry, 'dataUrl'),
    };
  });
}

function readNumber(value, key) {
  if (typeof value[key] !== 'number' || Number.isNaN(value[key])) {
    throw new HttpError(400, `${key} must be a number.`);
  }

  return value[key];
}

function compactDefined(value) {
  return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined));
}
