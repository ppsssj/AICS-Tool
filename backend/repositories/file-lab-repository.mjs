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
  getUserByEmail,
  getUsers,
  updateDocument,
  updateProject,
  updateSchedule,
  updateTask,
  updateUserRole,
  createUser,
} from '../data/store.mjs';

// File-backed repository adapter.
// Services depend on this interface so persistence can switch later.
export const fileLabRepository = {
  async getBootstrapData() {
    return getBootstrapData();
  },
  async getUsers() {
    return getUsers();
  },
  async getUser(userId) {
    return getUser(userId);
  },
  async getUserByEmail(email) {
    return getUserByEmail(email);
  },
  async createUser(payload) {
    return createUser(payload);
  },
  async getProjects() {
    return getProjects();
  },
  async getProject(projectId) {
    return getProject(projectId);
  },
  async getProjectBundle(projectId) {
    return getProjectBundle(projectId);
  },
  async createProject(payload) {
    return createProject(payload);
  },
  async updateProject(projectId, patch) {
    return updateProject(projectId, patch);
  },
  async deleteProject(projectId) {
    return deleteProject(projectId);
  },
  async getProjectTasks(projectId) {
    return getProjectTasks(projectId);
  },
  async getTask(taskId) {
    return getTask(taskId);
  },
  async createTask(projectId, payload) {
    return createTask(projectId, payload);
  },
  async updateTask(taskId, patch) {
    return updateTask(taskId, patch);
  },
  async deleteTask(taskId) {
    return deleteTask(taskId);
  },
  async getProjectDocuments(projectId) {
    return getProjectDocuments(projectId);
  },
  async getDocument(documentId) {
    return getDocument(documentId);
  },
  async createDocument(projectId, payload) {
    return createDocument(projectId, payload);
  },
  async updateDocument(documentId, patch) {
    return updateDocument(documentId, patch);
  },
  async deleteDocument(documentId) {
    return deleteDocument(documentId);
  },
  async getProjectSchedules(projectId) {
    return getProjectSchedules(projectId);
  },
  async getSchedule(scheduleId) {
    return getSchedule(scheduleId);
  },
  async createSchedule(payload) {
    return createSchedule(payload);
  },
  async updateSchedule(scheduleId, patch) {
    return updateSchedule(scheduleId, patch);
  },
  async deleteSchedule(scheduleId) {
    return deleteSchedule(scheduleId);
  },
  async createTimetableBlock(payload) {
    return createTimetableBlock(payload);
  },
  async updateUserRole(userId, role) {
    return updateUserRole(userId, role);
  },
};
