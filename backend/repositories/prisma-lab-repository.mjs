import { randomUUID } from 'node:crypto';
import { PrismaPg } from '@prisma/adapter-pg';
import prismaPkg from '../../node_modules/.prisma/client/index.js';
import { seedLabData } from '../data/seed.mjs';

const { Prisma, PrismaClient } = prismaPkg;
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL is required when LAB_REPOSITORY_DRIVER=prisma.');
}

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });
let seedPromise = null;

const taskStatusToDb = {
  Todo: 'Todo',
  'In Progress': 'InProgress',
  Review: 'Review',
  Done: 'Done',
};

const taskStatusFromDb = {
  Todo: 'Todo',
  InProgress: 'In Progress',
  Review: 'Review',
  Done: 'Done',
};

const timetableCategoryToDb = {
  Class: 'Class',
  Unavailable: 'Unavailable',
  'Lab Availability': 'LabAvailability',
};

const timetableCategoryFromDb = {
  Class: 'Class',
  Unavailable: 'Unavailable',
  LabAvailability: 'Lab Availability',
};

function createId(prefix) {
  return `${prefix}-${randomUUID().slice(0, 8)}`;
}

function toIsoString(value) {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function toDateOnly(value) {
  return toIsoString(value).slice(0, 10);
}

function parseDateOnly(value) {
  return new Date(`${value}T00:00:00.000Z`);
}

function projectStats(tasks, documents, schedules, projectId) {
  const projectTasks = tasks.filter((entry) => entry.projectId === projectId);
  const projectDocuments = documents.filter((entry) => entry.projectId === projectId);
  const projectSchedules = schedules.filter((entry) => entry.projectId === projectId);

  return {
    taskCount: projectTasks.length,
    openTaskCount: projectTasks.filter((entry) => entry.status !== 'Done').length,
    reviewTaskCount: projectTasks.filter((entry) => entry.status === 'Review').length,
    documentCount: projectDocuments.length,
    scheduleCount: projectSchedules.length,
  };
}

function serializeUser(record) {
  return {
    id: record.id,
    name: record.name,
    email: record.email,
    role: record.role,
    title: record.title,
  };
}

function serializeProject(record) {
  return {
    id: record.id,
    title: record.title,
    description: record.description,
    status: record.status,
    memberIds: record.members.map((member) => member.userId),
    updatedAt: toIsoString(record.updatedAt),
  };
}

function serializeTask(record) {
  return {
    id: record.id,
    projectId: record.projectId,
    title: record.title,
    description: record.description,
    status: taskStatusFromDb[record.status],
    priority: record.priority,
    assigneeId: record.assigneeId,
    dueDate: toDateOnly(record.dueDate),
    updatedAt: toIsoString(record.updatedAt),
    documentId: record.documentId ?? undefined,
  };
}

function serializeDocument(record) {
  return {
    id: record.id,
    projectId: record.projectId,
    title: record.title,
    body: record.body,
    tags: record.tags,
    authorId: record.authorId,
    updatedAt: toIsoString(record.updatedAt),
    relatedTaskIds: record.tasks.map((task) => task.id),
    attachments: record.attachments.map((attachment) => ({
      id: attachment.id,
      name: attachment.name,
      type: attachment.type,
      size: attachment.size,
      uploadedAt: toIsoString(attachment.uploadedAt),
      dataUrl: attachment.dataUrl,
    })),
  };
}

function serializeSchedule(record) {
  return {
    id: record.id,
    title: record.title,
    type: record.type,
    projectId: record.projectId ?? undefined,
    ownerId: record.ownerId ?? undefined,
    day: record.day,
    startTime: record.startTime,
    endTime: record.endTime,
    location: record.location,
    note: record.note,
  };
}

function serializeTimetableBlock(record) {
  return {
    id: record.id,
    userId: record.userId,
    day: record.day,
    startTime: record.startTime,
    endTime: record.endTime,
    category: timetableCategoryFromDb[record.category],
    title: record.title,
  };
}

function isMissingRecordError(error) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025';
}

async function ensurePrismaSeeded() {
  if (seedPromise) {
    return seedPromise;
  }

  seedPromise = (async () => {
    try {
      const userCount = await prisma.user.count();
      if (userCount > 0) {
        return;
      }

      await prisma.$transaction(async (tx) => {
        for (const user of seedLabData.users) {
          await tx.user.create({ data: user });
        }

        for (const project of seedLabData.projects) {
          await tx.project.create({
            data: {
              id: project.id,
              title: project.title,
              description: project.description,
              status: project.status,
              updatedAt: new Date(project.updatedAt),
              members: {
                createMany: {
                  data: project.memberIds.map((userId) => ({
                    userId,
                  })),
                },
              },
            },
          });
        }

        for (const document of seedLabData.documents) {
          await tx.document.create({
            data: {
              id: document.id,
              projectId: document.projectId,
              title: document.title,
              body: document.body,
              tags: document.tags,
              authorId: document.authorId,
              updatedAt: new Date(document.updatedAt),
              attachments: {
                create: document.attachments.map((attachment) => ({
                  id: attachment.id,
                  name: attachment.name,
                  type: attachment.type,
                  size: attachment.size,
                  uploadedAt: new Date(attachment.uploadedAt),
                  dataUrl: attachment.dataUrl,
                })),
              },
            },
          });
        }

        for (const task of seedLabData.tasks) {
          await tx.task.create({
            data: {
              id: task.id,
              projectId: task.projectId,
              title: task.title,
              description: task.description,
              status: taskStatusToDb[task.status],
              priority: task.priority,
              assigneeId: task.assigneeId,
              dueDate: parseDateOnly(task.dueDate),
              updatedAt: new Date(task.updatedAt),
              documentId: task.documentId ?? null,
            },
          });
        }

        for (const schedule of seedLabData.schedules) {
          await tx.schedule.create({
            data: {
              id: schedule.id,
              title: schedule.title,
              type: schedule.type,
              projectId: schedule.projectId ?? null,
              ownerId: schedule.ownerId ?? null,
              day: schedule.day,
              startTime: schedule.startTime,
              endTime: schedule.endTime,
              location: schedule.location,
              note: schedule.note,
            },
          });
        }

        for (const block of seedLabData.timetableBlocks) {
          await tx.timetableBlock.create({
            data: {
              id: block.id,
              userId: block.userId,
              day: block.day,
              startTime: block.startTime,
              endTime: block.endTime,
              category: timetableCategoryToDb[block.category],
              title: block.title,
            },
          });
        }
      });
    } catch (error) {
      seedPromise = null;
      throw error;
    }
  })();

  return seedPromise;
}

async function fetchProjectRecord(projectId) {
  return prisma.project.findUnique({
    where: { id: projectId },
    include: {
      members: {
        orderBy: { userId: 'asc' },
      },
    },
  });
}

async function fetchDocumentRecord(documentId) {
  return prisma.document.findUnique({
    where: { id: documentId },
    include: {
      attachments: {
        orderBy: { uploadedAt: 'desc' },
      },
      tasks: {
        select: { id: true },
        orderBy: { updatedAt: 'desc' },
      },
    },
  });
}

export const prismaLabRepository = {
  async getBootstrapData() {
    await ensurePrismaSeeded();

    const [users, projectRecords, documentRecords, taskRecords, scheduleRecords, timetableRecords] =
      await Promise.all([
        prisma.user.findMany({ orderBy: { name: 'asc' } }),
        prisma.project.findMany({
          include: {
            members: {
              orderBy: { userId: 'asc' },
            },
          },
          orderBy: { updatedAt: 'desc' },
        }),
        prisma.document.findMany({
          include: {
            attachments: {
              orderBy: { uploadedAt: 'desc' },
            },
            tasks: {
              select: { id: true },
              orderBy: { updatedAt: 'desc' },
            },
          },
          orderBy: { updatedAt: 'desc' },
        }),
        prisma.task.findMany({
          orderBy: { updatedAt: 'desc' },
        }),
        prisma.schedule.findMany({
          orderBy: { createdAt: 'desc' },
        }),
        prisma.timetableBlock.findMany({
          orderBy: { createdAt: 'desc' },
        }),
      ]);

    const serializedTasks = taskRecords.map(serializeTask);
    const serializedDocuments = documentRecords.map(serializeDocument);
    const serializedSchedules = scheduleRecords.map(serializeSchedule);

    return {
      users: users.map(serializeUser),
      projects: projectRecords.map((project) => ({
        ...serializeProject(project),
        stats: projectStats(serializedTasks, serializedDocuments, serializedSchedules, project.id),
      })),
      documents: serializedDocuments,
      tasks: serializedTasks,
      schedules: serializedSchedules,
      timetableBlocks: timetableRecords.map(serializeTimetableBlock),
    };
  },

  async getUsers() {
    await ensurePrismaSeeded();
    const users = await prisma.user.findMany({ orderBy: { name: 'asc' } });
    return users.map(serializeUser);
  },

  async getUser(userId) {
    await ensurePrismaSeeded();
    const user = await prisma.user.findUnique({ where: { id: userId } });
    return user ? serializeUser(user) : null;
  },

  async getUserByEmail(email) {
    await ensurePrismaSeeded();
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });
    return user ? serializeUser(user) : null;
  },

  async createUser(payload) {
    await ensurePrismaSeeded();
    const user = await prisma.user.create({
      data: {
        id: payload.id ?? createId('u'),
        name: payload.name,
        email: payload.email.toLowerCase(),
        role: payload.role,
        title: payload.title,
      },
    });

    return serializeUser(user);
  },

  async getProjects() {
    await ensurePrismaSeeded();

    const [projects, tasks, documents, schedules] = await Promise.all([
      prisma.project.findMany({
        include: {
          members: {
            orderBy: { userId: 'asc' },
          },
        },
        orderBy: { updatedAt: 'desc' },
      }),
      prisma.task.findMany({ orderBy: { updatedAt: 'desc' } }),
      prisma.document.findMany({
        include: {
          attachments: true,
          tasks: {
            select: { id: true },
          },
        },
      }),
      prisma.schedule.findMany(),
    ]);

    const serializedTasks = tasks.map(serializeTask);
    const serializedDocuments = documents.map(serializeDocument);
    const serializedSchedules = schedules.map(serializeSchedule);

    return projects.map((project) => ({
      ...serializeProject(project),
      stats: projectStats(serializedTasks, serializedDocuments, serializedSchedules, project.id),
    }));
  },

  async getProject(projectId) {
    await ensurePrismaSeeded();
    const project = await fetchProjectRecord(projectId);
    return project ? serializeProject(project) : null;
  },

  async getProjectBundle(projectId) {
    await ensurePrismaSeeded();

    const [project, members, tasks, documents, schedules] = await Promise.all([
      fetchProjectRecord(projectId),
      prisma.user.findMany({
        where: {
          memberships: {
            some: {
              projectId,
            },
          },
        },
        orderBy: { name: 'asc' },
      }),
      prisma.task.findMany({
        where: { projectId },
        orderBy: { updatedAt: 'desc' },
      }),
      prisma.document.findMany({
        where: { projectId },
        include: {
          attachments: {
            orderBy: { uploadedAt: 'desc' },
          },
          tasks: {
            select: { id: true },
            orderBy: { updatedAt: 'desc' },
          },
        },
        orderBy: { updatedAt: 'desc' },
      }),
      prisma.schedule.findMany({
        where: { projectId },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    if (!project) {
      return null;
    }

    const serializedTasks = tasks.map(serializeTask);
    const serializedDocuments = documents.map(serializeDocument);
    const serializedSchedules = schedules.map(serializeSchedule);

    return {
      project: {
        ...serializeProject(project),
        stats: projectStats(serializedTasks, serializedDocuments, serializedSchedules, project.id),
      },
      members: members.map(serializeUser),
      tasks: serializedTasks,
      documents: serializedDocuments,
      schedules: serializedSchedules,
    };
  },

  async createProject(payload) {
    await ensurePrismaSeeded();
    const project = await prisma.project.create({
      data: {
        id: payload.id ?? createId('p'),
        title: payload.title,
        description: payload.description,
        status: payload.status,
        members: {
          createMany: {
            data: payload.memberIds.map((userId) => ({
              userId,
            })),
          },
        },
      },
      include: {
        members: {
          orderBy: { userId: 'asc' },
        },
      },
    });

    return serializeProject(project);
  },

  async updateProject(projectId, patch) {
    await ensurePrismaSeeded();

    try {
      const project = await prisma.$transaction(async (tx) => {
        if (patch.memberIds) {
          await tx.projectMember.deleteMany({
            where: { projectId },
          });

          if (patch.memberIds.length > 0) {
            await tx.projectMember.createMany({
              data: patch.memberIds.map((userId) => ({
                projectId,
                userId,
              })),
            });
          }
        }

        await tx.project.update({
          where: { id: projectId },
          data: {
            title: patch.title,
            description: patch.description,
            status: patch.status,
          },
        });

        return tx.project.findUnique({
          where: { id: projectId },
          include: {
            members: {
              orderBy: { userId: 'asc' },
            },
          },
        });
      });

      return project ? serializeProject(project) : null;
    } catch (error) {
      if (isMissingRecordError(error)) {
        return null;
      }

      throw error;
    }
  },

  async deleteProject(projectId) {
    await ensurePrismaSeeded();

    try {
      await prisma.project.delete({
        where: { id: projectId },
      });
      return true;
    } catch (error) {
      if (isMissingRecordError(error)) {
        return false;
      }

      throw error;
    }
  },

  async getProjectTasks(projectId) {
    await ensurePrismaSeeded();
    const tasks = await prisma.task.findMany({
      where: { projectId },
      orderBy: { updatedAt: 'desc' },
    });
    return tasks.map(serializeTask);
  },

  async getTask(taskId) {
    await ensurePrismaSeeded();
    const task = await prisma.task.findUnique({ where: { id: taskId } });
    return task ? serializeTask(task) : null;
  },

  async createTask(projectId, payload) {
    await ensurePrismaSeeded();
    const task = await prisma.task.create({
      data: {
        id: payload.id ?? createId('t'),
        projectId,
        title: payload.title,
        description: payload.description,
        status: taskStatusToDb[payload.status],
        priority: payload.priority,
        assigneeId: payload.assigneeId,
        dueDate: parseDateOnly(payload.dueDate),
        documentId: payload.documentId ?? null,
      },
    });

    return serializeTask(task);
  },

  async updateTask(taskId, patch) {
    await ensurePrismaSeeded();

    try {
      const task = await prisma.task.update({
        where: { id: taskId },
        data: {
          title: patch.title,
          description: patch.description,
          status: patch.status ? taskStatusToDb[patch.status] : undefined,
          priority: patch.priority,
          assigneeId: patch.assigneeId,
          dueDate: patch.dueDate ? parseDateOnly(patch.dueDate) : undefined,
          documentId: Object.prototype.hasOwnProperty.call(patch, 'documentId')
            ? patch.documentId ?? null
            : undefined,
        },
      });

      return serializeTask(task);
    } catch (error) {
      if (isMissingRecordError(error)) {
        return null;
      }

      throw error;
    }
  },

  async deleteTask(taskId) {
    await ensurePrismaSeeded();

    try {
      await prisma.task.delete({
        where: { id: taskId },
      });
      return true;
    } catch (error) {
      if (isMissingRecordError(error)) {
        return false;
      }

      throw error;
    }
  },

  async getProjectDocuments(projectId) {
    await ensurePrismaSeeded();
    const documents = await prisma.document.findMany({
      where: { projectId },
      include: {
        attachments: {
          orderBy: { uploadedAt: 'desc' },
        },
        tasks: {
          select: { id: true },
          orderBy: { updatedAt: 'desc' },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });
    return documents.map(serializeDocument);
  },

  async getDocument(documentId) {
    await ensurePrismaSeeded();
    const document = await fetchDocumentRecord(documentId);
    return document ? serializeDocument(document) : null;
  },

  async createDocument(projectId, payload) {
    await ensurePrismaSeeded();

    const document = await prisma.$transaction(async (tx) => {
      const created = await tx.document.create({
        data: {
          id: payload.id ?? createId('d'),
          projectId,
          title: payload.title,
          body: payload.body,
          tags: payload.tags,
          authorId: payload.authorId,
          attachments: {
            create: (payload.attachments ?? []).map((attachment) => ({
              id: attachment.id ?? createId('att'),
              name: attachment.name,
              type: attachment.type,
              size: attachment.size,
              uploadedAt: attachment.uploadedAt ? new Date(attachment.uploadedAt) : new Date(),
              dataUrl: attachment.dataUrl,
            })),
          },
        },
      });

      if (payload.relatedTaskIds.length > 0) {
        await tx.task.updateMany({
          where: {
            projectId,
            id: { in: payload.relatedTaskIds },
          },
          data: {
            documentId: created.id,
          },
        });
      }

      return tx.document.findUnique({
        where: { id: created.id },
        include: {
          attachments: {
            orderBy: { uploadedAt: 'desc' },
          },
          tasks: {
            select: { id: true },
            orderBy: { updatedAt: 'desc' },
          },
        },
      });
    });

    return serializeDocument(document);
  },

  async updateDocument(documentId, patch) {
    await ensurePrismaSeeded();

    const current = await prisma.document.findUnique({
      where: { id: documentId },
      include: {
        tasks: {
          select: { id: true },
        },
      },
    });

    if (!current) {
      return null;
    }

    const nextRelatedTaskIds = patch.relatedTaskIds ?? current.tasks.map((task) => task.id);

    const document = await prisma.$transaction(async (tx) => {
      await tx.document.update({
        where: { id: documentId },
        data: {
          title: patch.title,
          body: patch.body,
          tags: patch.tags,
          authorId: patch.authorId,
        },
      });

      if (patch.attachments !== undefined) {
        await tx.documentAttachment.deleteMany({
          where: { documentId },
        });

        if (patch.attachments.length > 0) {
          await tx.documentAttachment.createMany({
            data: patch.attachments.map((attachment) => ({
              id: attachment.id ?? createId('att'),
              documentId,
              name: attachment.name,
              type: attachment.type,
              size: attachment.size,
              uploadedAt: attachment.uploadedAt ? new Date(attachment.uploadedAt) : new Date(),
              dataUrl: attachment.dataUrl,
            })),
          });
        }
      }

      if (patch.relatedTaskIds !== undefined) {
        await tx.task.updateMany({
          where: { documentId },
          data: { documentId: null },
        });

        if (nextRelatedTaskIds.length > 0) {
          await tx.task.updateMany({
            where: {
              projectId: current.projectId,
              id: { in: nextRelatedTaskIds },
            },
            data: { documentId },
          });
        }
      }

      return tx.document.findUnique({
        where: { id: documentId },
        include: {
          attachments: {
            orderBy: { uploadedAt: 'desc' },
          },
          tasks: {
            select: { id: true },
            orderBy: { updatedAt: 'desc' },
          },
        },
      });
    });

    return serializeDocument(document);
  },

  async deleteDocument(documentId) {
    await ensurePrismaSeeded();

    try {
      await prisma.document.delete({
        where: { id: documentId },
      });
      return true;
    } catch (error) {
      if (isMissingRecordError(error)) {
        return false;
      }

      throw error;
    }
  },

  async getProjectSchedules(projectId) {
    await ensurePrismaSeeded();
    const schedules = await prisma.schedule.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
    });
    return schedules.map(serializeSchedule);
  },

  async getSchedule(scheduleId) {
    await ensurePrismaSeeded();
    const schedule = await prisma.schedule.findUnique({ where: { id: scheduleId } });
    return schedule ? serializeSchedule(schedule) : null;
  },

  async createSchedule(payload) {
    await ensurePrismaSeeded();
    const schedule = await prisma.schedule.create({
      data: {
        id: payload.id ?? createId('s'),
        title: payload.title,
        type: payload.type,
        projectId: payload.projectId ?? null,
        ownerId: payload.ownerId ?? null,
        day: payload.day,
        startTime: payload.startTime,
        endTime: payload.endTime,
        location: payload.location,
        note: payload.note,
      },
    });

    return serializeSchedule(schedule);
  },

  async updateSchedule(scheduleId, patch) {
    await ensurePrismaSeeded();

    try {
      const schedule = await prisma.schedule.update({
        where: { id: scheduleId },
        data: {
          title: patch.title,
          type: patch.type,
          projectId: Object.prototype.hasOwnProperty.call(patch, 'projectId')
            ? patch.projectId ?? null
            : undefined,
          ownerId: Object.prototype.hasOwnProperty.call(patch, 'ownerId')
            ? patch.ownerId ?? null
            : undefined,
          day: patch.day,
          startTime: patch.startTime,
          endTime: patch.endTime,
          location: patch.location,
          note: patch.note,
        },
      });

      return serializeSchedule(schedule);
    } catch (error) {
      if (isMissingRecordError(error)) {
        return null;
      }

      throw error;
    }
  },

  async deleteSchedule(scheduleId) {
    await ensurePrismaSeeded();

    try {
      await prisma.schedule.delete({
        where: { id: scheduleId },
      });
      return true;
    } catch (error) {
      if (isMissingRecordError(error)) {
        return false;
      }

      throw error;
    }
  },

  async createTimetableBlock(payload) {
    await ensurePrismaSeeded();
    const block = await prisma.timetableBlock.create({
      data: {
        id: payload.id ?? createId('tb'),
        userId: payload.userId,
        day: payload.day,
        startTime: payload.startTime,
        endTime: payload.endTime,
        category: timetableCategoryToDb[payload.category],
        title: payload.title,
      },
    });

    return serializeTimetableBlock(block);
  },

  async updateUserRole(userId, role) {
    await ensurePrismaSeeded();

    try {
      const user = await prisma.user.update({
        where: { id: userId },
        data: { role },
      });

      return serializeUser(user);
    } catch (error) {
      if (isMissingRecordError(error)) {
        return null;
      }

      throw error;
    }
  },
};
