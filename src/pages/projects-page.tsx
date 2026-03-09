import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useLabStore } from '@/app/store/use-lab-store';
import type { Project, Schedule } from '@/entities/models';
import { ProjectFormModal } from '@/features/projects/project-form-modal';
import { compareWeekday, formatShortDate, startOfDay } from '@/shared/lib/date';
import { projectStatusLabels, weekdayLabels } from '@/shared/lib/labels';
import type { BadgeTone } from '@/shared/ui/badge';
import { Badge } from '@/shared/ui/badge';
import { Button } from '@/shared/ui/button';
import { Card } from '@/shared/ui/card';
import { Modal } from '@/shared/ui/modal';
import { PageHeader } from '@/shared/ui/page-header';

const DAY_IN_MS = 24 * 60 * 60 * 1000;

function parseDueDate(value: string): Date {
  return new Date(`${value}T09:00:00`);
}

function daysFromToday(value: string, referenceDate: Date): number {
  const diff = startOfDay(parseDueDate(value)).getTime() - referenceDate.getTime();
  return Math.floor(diff / DAY_IN_MS);
}

function getProjectTone(project: Project): BadgeTone {
  if (project.status === 'Active') {
    return 'success';
  }

  if (project.status === 'Planning') {
    return 'warning';
  }

  return 'neutral';
}

function formatScheduleLabel(schedule: Schedule): string {
  return `${weekdayLabels[schedule.day]} ${schedule.startTime}`;
}

export function ProjectsPage() {
  const { createProject, deleteProject, documents, projects, schedules, tasks, updateProject, users } = useLabStore();
  const [open, setOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | undefined>();
  const [projectToDelete, setProjectToDelete] = useState<Project | undefined>();

  const referenceDate = startOfDay(new Date());

  const projectHealth = useMemo(
    () =>
      projects
        .map((project) => {
          const projectTasks = tasks.filter((task) => task.projectId === project.id && task.status !== 'Done');
          const projectDocuments = documents.filter((document) => document.projectId === project.id);
          const projectSchedules = schedules
            .filter((schedule) => schedule.projectId === project.id)
            .sort(
              (left, right) =>
                compareWeekday(left.day, right.day) || left.startTime.localeCompare(right.startTime),
            );
          const overdue = projectTasks.filter((task) => daysFromToday(task.dueDate, referenceDate) < 0);
          const dueThisWeek = projectTasks.filter((task) => {
            const delta = daysFromToday(task.dueDate, referenceDate);
            return delta >= 0 && delta <= 6;
          });
          const reviewWaiting = projectTasks.filter((task) => task.status === 'Review');
          const advisorCheck = projectTasks.filter(
            (task) => task.status !== 'Review' && task.title.toLowerCase().includes('review'),
          );
          const blocked = projectTasks.filter((task) => !task.assigneeId);
          const nextSession = projectSchedules[0];
          const coordinationIssueCount = projectSchedules.filter((schedule) => {
            const sameDayTasks = projectTasks.filter((task) => task.title.toLowerCase().includes('schedule'));
            return sameDayTasks.length > 0 && schedule.type === 'Project';
          }).length;
          const score =
            overdue.length * 4 +
            dueThisWeek.length * 2 +
            reviewWaiting.length * 2 +
            blocked.length * 3 +
            advisorCheck.length +
            coordinationIssueCount * 2;

          return {
            project,
            projectDocuments,
            projectTasks,
            overdue,
            dueThisWeek,
            reviewWaiting,
            advisorCheck,
            blocked,
            nextSession,
            coordinationIssueCount,
            score,
          };
        })
        .sort((left, right) => right.score - left.score || right.project.updatedAt.localeCompare(left.project.updatedAt)),
    [documents, projects, referenceDate, schedules, tasks],
  );

  function handleOpenCreate() {
    setEditingProject(undefined);
    setOpen(true);
  }

  function handleOpenEdit(project: Project) {
    setEditingProject(project);
    setOpen(true);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="프로젝트"
        actions={<Button onClick={handleOpenCreate}>Create project</Button>}
      />

      <div className="grid gap-4 xl:grid-cols-2">
        {projectHealth.map((item) => {
          const headline =
            item.overdue.length > 0
              ? `${item.overdue.length} overdue`
              : item.dueThisWeek.length > 0
                ? `${item.dueThisWeek.length} due this week`
                : item.reviewWaiting.length > 0
                  ? `${item.reviewWaiting.length} review waiting`
                  : item.nextSession
                    ? `Next session ${formatScheduleLabel(item.nextSession)}`
                    : 'Stable this week';

          const secondarySignals = [
            item.reviewWaiting.length > 0 ? `${item.reviewWaiting.length} review waiting` : null,
            item.blocked.length > 0 ? `${item.blocked.length} blocked` : null,
            item.advisorCheck.length > 0 ? `${item.advisorCheck.length} advisor check` : null,
            item.coordinationIssueCount > 0 ? `${item.coordinationIssueCount} coordination issue` : null,
          ].filter(Boolean);

          return (
            <Card key={item.project.id} className="group flex flex-col gap-4 overflow-hidden border-slate-200/70 p-0">
              <div className="border-b border-slate-200/80 bg-slate-50/70 px-5 py-3.5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={getProjectTone(item.project)}>{projectStatusLabels[item.project.status]}</Badge>
                    <Badge tone={item.score >= 6 ? 'danger' : item.score >= 3 ? 'warning' : 'success'}>
                      {item.score >= 6 ? 'Needs attention' : item.score >= 3 ? 'Watch this week' : 'Healthy'}
                    </Badge>
                  </div>
                  <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                    Updated {formatShortDate(item.project.updatedAt)}
                  </span>
                </div>
              </div>

              <div className="px-5">
                <h2 className="text-[22px] font-semibold tracking-[-0.03em] text-slate-950">
                  {item.project.title}
                </h2>
                <p className="mt-2 text-[17px] font-semibold tracking-[-0.02em] text-slate-900">
                  {headline}
                </p>
                <p className="mt-1.5 text-sm leading-6 text-slate-500">{item.project.description}</p>
              </div>

              <div className="grid gap-3 px-5 md:grid-cols-[1.1fr_0.9fr]">
                <div className="rounded-[22px] border border-slate-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(246,248,252,0.92))] p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                    Operational signals
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {secondarySignals.length > 0 ? (
                      secondarySignals.map((signal) => (
                        <Badge key={`${item.project.id}-${signal}`} tone="info">
                          {signal}
                        </Badge>
                      ))
                    ) : (
                      <Badge tone="success">No immediate risk signal</Badge>
                    )}
                  </div>
                  {item.nextSession ? (
                    <p className="mt-4 text-sm text-slate-500">
                      Next shared session: {formatScheduleLabel(item.nextSession)} at {item.nextSession.location}
                    </p>
                  ) : (
                    <p className="mt-4 text-sm text-slate-500">No project session scheduled yet.</p>
                  )}
                </div>

                <div className="rounded-[22px] border border-slate-200/80 bg-slate-50/70 p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                    Secondary metadata
                  </p>
                  <div className="mt-3 grid grid-cols-3 gap-3 text-sm text-slate-500">
                    <div>
                      <p className="text-[22px] font-semibold tracking-[-0.03em] text-slate-950">
                        {item.project.memberIds.length}
                      </p>
                      <p>Members</p>
                    </div>
                    <div>
                      <p className="text-[22px] font-semibold tracking-[-0.03em] text-slate-950">
                        {item.projectDocuments.length}
                      </p>
                      <p>Docs</p>
                    </div>
                    <div>
                      <p className="text-[22px] font-semibold tracking-[-0.03em] text-slate-950">
                        {item.projectTasks.length}
                      </p>
                      <p>Open tasks</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200/80 px-5 py-4">
                <div className="flex flex-wrap gap-2">
                  <Link
                    className="inline-flex items-center justify-center rounded-[14px] border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                    to={`/projects/${item.project.id}`}
                  >
                    Open workspace
                  </Link>
                  <Link
                    className="inline-flex items-center justify-center rounded-[14px] border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                    to={`/projects/${item.project.id}/tasks`}
                  >
                    Open tasks
                  </Link>
                </div>
                <div className="flex flex-wrap gap-3">
                  <Button variant="secondary" onClick={() => handleOpenEdit(item.project)}>
                    Edit
                  </Button>
                  <Button variant="ghost" onClick={() => setProjectToDelete(item.project)}>
                    Delete
                  </Button>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      <ProjectFormModal
        open={open}
        users={users.map((user) => ({ id: user.id, name: user.name }))}
        initialValue={editingProject}
        onClose={() => setOpen(false)}
        onSubmit={(payload) => {
          if (editingProject) {
            updateProject(editingProject.id, payload);
            return;
          }
          createProject(payload);
        }}
      />

      <Modal
        open={Boolean(projectToDelete)}
        onClose={() => setProjectToDelete(undefined)}
        title="Delete project"
        footer={
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setProjectToDelete(undefined)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                if (!projectToDelete) {
                  return;
                }

                deleteProject(projectToDelete.id);
                setProjectToDelete(undefined);
              }}
            >
              Delete
            </Button>
          </div>
        }
      >
        <div className="space-y-4 text-sm text-slate-600">
          <p className="leading-6">
            <span className="font-semibold text-slate-900">{projectToDelete?.title}</span> will be permanently removed.
          </p>
          <p className="leading-6">
            Documents, tasks, and project schedules connected to this workspace are deleted together.
          </p>
        </div>
      </Modal>
    </div>
  );
}
