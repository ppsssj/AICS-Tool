import { useMemo, useState } from 'react';
import { Link, NavLink, useLocation, useParams } from 'react-router-dom';
import { useLabStore } from '@/app/store/use-lab-store';
import type { ProjectStatus, Schedule, Task, Weekday } from '@/entities/models';
import { ScheduleFormModal } from '@/features/calendar/schedule-form-modal';
import { DocumentFormModal } from '@/features/documents/document-form-modal';
import { TaskFormModal } from '@/features/tasks/task-form-modal';
import { compareWeekday, formatDate, formatDateTime, formatShortDate, startOfDay } from '@/shared/lib/date';
import {
  projectStatusLabels,
  roleLabels,
  scheduleTypeLabels,
  taskStatusLabels,
  weekdayLabels,
} from '@/shared/lib/labels';
import { Badge } from '@/shared/ui/badge';
import { Button } from '@/shared/ui/button';
import { Card } from '@/shared/ui/card';
import { EmptyState } from '@/shared/ui/empty-state';
import { cn } from '@/shared/lib/cn';
import { DocumentPage } from '@/pages/document-page';
import { TaskBoardPage } from '@/pages/task-board-page';

const DAY_IN_MS = 24 * 60 * 60 * 1000;

type ProjectSection = 'overview' | 'docs' | 'doc-detail' | 'tasks' | 'schedule' | 'members';

const tabs = [
  { key: 'overview', label: 'Overview', to: '' },
  { key: 'docs', label: 'Docs', to: 'docs' },
  { key: 'tasks', label: 'Tasks', to: 'tasks' },
  { key: 'schedule', label: 'Schedule', to: 'schedule' },
  { key: 'members', label: 'Members', to: 'members' },
] as const;

function statusTone(status: ProjectStatus): 'success' | 'warning' | 'neutral' {
  if (status === 'Active') return 'success';
  if (status === 'Planning') return 'warning';
  return 'neutral';
}

function parseDueDate(value: string): Date {
  return new Date(`${value}T09:00:00`);
}

function daysFromToday(value: string, referenceDate: Date): number {
  const diff = startOfDay(parseDueDate(value)).getTime() - referenceDate.getTime();
  return Math.floor(diff / DAY_IN_MS);
}

function getSection(pathname: string, projectId: string): ProjectSection {
  const basePath = `/projects/${projectId}`;
  const tail = pathname.startsWith(basePath)
    ? pathname.slice(basePath.length).replace(/^\/+/, '')
    : '';

  if (tail.startsWith('docs/')) return 'doc-detail';
  if (tail === 'docs') return 'docs';
  if (tail === 'tasks') return 'tasks';
  if (tail === 'schedule') return 'schedule';
  if (tail === 'members') return 'members';
  return 'overview';
}

function formatScheduleLabel(schedule: Schedule): string {
  return `${weekdayLabels[schedule.day]} ${schedule.startTime} - ${schedule.endTime}`;
}

function scheduleSort(left: Schedule, right: Schedule): number {
  return compareWeekday(left.day, right.day) || left.startTime.localeCompare(right.startTime);
}

function taskDueLabel(task: Task, referenceDate: Date): string {
  const days = daysFromToday(task.dueDate, referenceDate);

  if (days < 0) {
    return `${Math.abs(days)}d overdue`;
  }

  if (days === 0) {
    return 'Due today';
  }

  if (days === 1) {
    return 'Due tomorrow';
  }

  if (days <= 6) {
    return `Due in ${days}d`;
  }

  return formatDate(task.dueDate);
}

function scheduleIssueLabel(tasks: Task[], schedules: Schedule[]): string {
  const schedulingPressure = tasks.some((task) => task.title.toLowerCase().includes('schedule'));

  if (!schedulingPressure || schedules.length === 0) {
    return 'No current scheduling issue';
  }

  return `${schedules.length} shared session${schedules.length > 1 ? 's' : ''} may need coordination`;
}

export function ProjectDetailPage() {
  const { projectId } = useParams();
  const location = useLocation();
  const { createDocument, createSchedule, createTask, currentUserId, documents, projects, schedules, tasks, users } = useLabStore();
  const [showDocumentModal, setShowDocumentModal] = useState(false);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false);

  const project = projects.find((item) => item.id === projectId);
  const projectDocuments = documents.filter((document) => document.projectId === projectId);
  const projectTasks = tasks.filter((task) => task.projectId === projectId);
  const projectSchedules = useMemo(
    () => schedules.filter((schedule) => schedule.projectId === projectId).sort(scheduleSort),
    [projectId, schedules],
  );
  const members = users.filter((user) => project?.memberIds.includes(user.id));

  if (!project) {
    return <EmptyState title="Project not found" description="The requested project is not available in this workspace." />;
  }

  const referenceDate = startOfDay(new Date());
  const currentProject = project;
  const section = getSection(location.pathname, currentProject.id);
  const activeTab = section === 'doc-detail' ? 'docs' : section;
  const openTasks = projectTasks.filter((task) => task.status !== 'Done');
  const overdueTasks = openTasks.filter((task) => daysFromToday(task.dueDate, referenceDate) < 0);
  const dueSoonTasks = openTasks.filter((task) => {
    const delta = daysFromToday(task.dueDate, referenceDate);
    return delta >= 0 && delta <= 6;
  });
  const reviewTasks = openTasks.filter((task) => task.status === 'Review');
  const blockedTasks = openTasks.filter((task) => !task.assigneeId);
  const advisorCheckTasks = openTasks.filter(
    (task) => task.status !== 'Review' && task.title.toLowerCase().includes('review'),
  );
  const nextMilestone = [...openTasks]
    .sort((left, right) => parseDueDate(left.dueDate).getTime() - parseDueDate(right.dueDate).getTime())[0];
  const nextEvent = projectSchedules[0];
  const recentDocs = [...projectDocuments]
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
    .slice(0, 3);

  function renderSectionActions() {
    if (section === 'overview') {
      return (
        <>
          <Button variant="secondary" onClick={() => setShowDocumentModal(true)}>
            Add doc
          </Button>
          <Button variant="secondary" onClick={() => setShowTaskModal(true)}>
            Add task
          </Button>
          <Button onClick={() => setShowScheduleModal(true)}>Add session</Button>
        </>
      );
    }

    if (section === 'docs') {
      return <Button onClick={() => setShowDocumentModal(true)}>Add doc</Button>;
    }

    if (section === 'schedule') {
      return <Button onClick={() => setShowScheduleModal(true)}>Add session</Button>;
    }

    if (section === 'doc-detail') {
      return (
        <Link
          className="inline-flex items-center justify-center rounded-[14px] border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
          to={`/projects/${currentProject.id}/docs`}
        >
          Back to docs
        </Link>
      );
    }

    return null;
  }

  function renderOverview() {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 xl:grid-cols-[1.3fr_0.7fr]">
          <Card className="border-slate-200/70">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                  Live state
                </p>
                <h2 className="mt-1.5 text-[24px] font-semibold tracking-[-0.03em] text-slate-950">
                  What is happening now
                </h2>
              </div>
              <Badge tone={statusTone(currentProject.status)}>{projectStatusLabels[currentProject.status]}</Badge>
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <div className="rounded-[22px] border border-slate-200/80 bg-slate-50/75 p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                  Next milestone
                </p>
                {nextMilestone ? (
                  <>
                    <p className="mt-2 text-[17px] font-semibold tracking-[-0.02em] text-slate-900">
                      {nextMilestone.title}
                    </p>
                    <p className="mt-1 text-sm text-slate-500">{taskDueLabel(nextMilestone, referenceDate)}</p>
                  </>
                ) : (
                  <p className="mt-2 text-sm text-slate-500">No active milestone is scheduled.</p>
                )}
              </div>

              <div className="rounded-[22px] border border-slate-200/80 bg-slate-50/75 p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                  Next shared session
                </p>
                {nextEvent ? (
                  <>
                    <p className="mt-2 text-[17px] font-semibold tracking-[-0.02em] text-slate-900">
                      {nextEvent.title}
                    </p>
                    <p className="mt-1 text-sm text-slate-500">
                      {formatScheduleLabel(nextEvent)} / {nextEvent.location}
                    </p>
                  </>
                ) : (
                  <p className="mt-2 text-sm text-slate-500">No project session is scheduled yet.</p>
                )}
              </div>
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-4">
              <div className="rounded-[20px] border border-slate-200/80 bg-white px-4 py-3.5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Overdue</p>
                <p className="mt-1.5 text-[28px] font-semibold tracking-[-0.04em] text-slate-950">{overdueTasks.length}</p>
              </div>
              <div className="rounded-[20px] border border-slate-200/80 bg-white px-4 py-3.5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Due soon</p>
                <p className="mt-1.5 text-[28px] font-semibold tracking-[-0.04em] text-slate-950">{dueSoonTasks.length}</p>
              </div>
              <div className="rounded-[20px] border border-slate-200/80 bg-white px-4 py-3.5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Review waiting</p>
                <p className="mt-1.5 text-[28px] font-semibold tracking-[-0.04em] text-slate-950">{reviewTasks.length}</p>
              </div>
              <div className="rounded-[20px] border border-slate-200/80 bg-white px-4 py-3.5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Blocked</p>
                <p className="mt-1.5 text-[28px] font-semibold tracking-[-0.04em] text-slate-950">{blockedTasks.length}</p>
              </div>
            </div>
          </Card>

          <Card className="border-slate-200/70">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
              Coordination
            </p>
            <h2 className="mt-1.5 text-[22px] font-semibold tracking-[-0.03em] text-slate-950">
              Operational summary
            </h2>
            <div className="mt-5 space-y-3">
              <div className="rounded-[20px] border border-slate-200/80 bg-slate-50/70 p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                  Review and handoff
                </p>
                <p className="mt-2 text-sm text-slate-500">
                  {reviewTasks.length} waiting review / {advisorCheckTasks.length} advisor check / {blockedTasks.length} blocked by ownership
                </p>
              </div>
              <div className="rounded-[20px] border border-slate-200/80 bg-slate-50/70 p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                  Shared sessions
                </p>
                <p className="mt-2 text-sm text-slate-500">
                  {scheduleIssueLabel(openTasks, projectSchedules)}
                </p>
              </div>
              <div className="rounded-[20px] border border-slate-200/80 bg-slate-50/70 p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                  Last update
                </p>
                <p className="mt-2 text-sm text-slate-500">
                  Project updated {formatDateTime(currentProject.updatedAt)}
                </p>
              </div>
            </div>
          </Card>
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <Card className="border-slate-200/70">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                  Due soon preview
                </p>
                <h2 className="mt-1.5 text-[22px] font-semibold tracking-[-0.03em] text-slate-950">
                  Active tasks this week
                </h2>
              </div>
              <Link className="text-sm font-semibold text-accent-700" to={`/projects/${currentProject.id}/tasks`}>
                Open tasks
              </Link>
            </div>

            <div className="mt-5 grid gap-3">
              {dueSoonTasks.slice(0, 4).map((task) => (
                <div key={task.id} className="rounded-[20px] border border-slate-200/80 bg-slate-50/70 px-4 py-3.5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[15px] font-semibold tracking-[-0.02em] text-slate-900">{task.title}</p>
                      <p className="mt-1.5 text-sm text-slate-500">
                        {taskDueLabel(task, referenceDate)} / {taskStatusLabels[task.status]}
                      </p>
                    </div>
                    <Badge tone={task.status === 'Review' ? 'warning' : daysFromToday(task.dueDate, referenceDate) < 0 ? 'danger' : 'info'}>
                      {task.status === 'Review' ? 'Review waiting' : daysFromToday(task.dueDate, referenceDate) < 0 ? 'Overdue' : 'Due soon'}
                    </Badge>
                  </div>
                </div>
              ))}
              {dueSoonTasks.length === 0 ? (
                <div className="rounded-[20px] border border-slate-200/80 bg-slate-50/70 px-4 py-4 text-sm text-slate-500">
                  No task is due within the next week.
                </div>
              ) : null}
            </div>
          </Card>

          <Card className="border-slate-200/70">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                  Recent docs
                </p>
                <h2 className="mt-1.5 text-[22px] font-semibold tracking-[-0.03em] text-slate-950">
                  Key references
                </h2>
              </div>
              <Link className="text-sm font-semibold text-accent-700" to={`/projects/${currentProject.id}/docs`}>
                Open docs
              </Link>
            </div>

            <div className="mt-5 grid gap-3">
              {recentDocs.map((document) => (
                <Link
                  key={document.id}
                  className="rounded-[20px] border border-slate-200/80 bg-slate-50/70 px-4 py-3.5 transition hover:border-slate-300 hover:bg-white"
                  to={`/projects/${currentProject.id}/docs/${document.id}`}
                >
                  <p className="text-[15px] font-semibold tracking-[-0.02em] text-slate-900">{document.title}</p>
                  <p className="mt-1.5 text-sm text-slate-500">{document.tags.join(' / ')}</p>
                  <p className="mt-2 text-sm text-slate-500">Updated {formatShortDate(document.updatedAt)}</p>
                </Link>
              ))}
              {recentDocs.length === 0 ? (
                <div className="rounded-[20px] border border-slate-200/80 bg-slate-50/70 px-4 py-4 text-sm text-slate-500">
                  No key document has been added yet.
                </div>
              ) : null}
            </div>
          </Card>
        </div>
      </div>
    );
  }

  function renderDocs() {
    return (
      <Card className="border-slate-200/70">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Document workspace</p>
          <h2 className="mt-2 text-[24px] font-semibold tracking-[-0.03em] text-slate-950">Project docs</h2>
        </div>
        <div className="mt-5 grid gap-4">
          {projectDocuments.map((document) => (
            <Link
              key={document.id}
              className="rounded-[22px] border border-slate-200/80 bg-slate-50/70 p-4 transition hover:border-slate-300 hover:bg-white"
              to={`/projects/${currentProject.id}/docs/${document.id}`}
            >
              <p className="text-[16px] font-semibold tracking-[-0.02em] text-slate-900">{document.title}</p>
              <p className="mt-2 text-sm text-slate-500">{document.tags.join(' / ')}</p>
            </Link>
          ))}
        </div>
      </Card>
    );
  }

  function renderSchedule() {
    return (
      <Card className="border-slate-200/70">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Shared sessions</p>
          <h2 className="mt-2 text-[24px] font-semibold tracking-[-0.03em] text-slate-950">Project schedule</h2>
        </div>
        <div className="mt-5 space-y-3">
          {projectSchedules.map((schedule) => (
            <div key={schedule.id} className="rounded-[22px] border border-slate-200/80 bg-slate-50/70 p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-[15px] font-semibold tracking-[-0.02em] text-slate-900">{schedule.title}</p>
                <Badge tone="info">{scheduleTypeLabels[schedule.type]}</Badge>
              </div>
              <p className="mt-2 text-sm text-slate-500">
                {weekdayLabels[schedule.day as Weekday]} / {schedule.startTime} - {schedule.endTime}
              </p>
              <p className="mt-1 text-sm text-slate-500">{schedule.location}</p>
            </div>
          ))}
        </div>
      </Card>
    );
  }

  function renderMembers() {
    return (
      <Card className="border-slate-200/70">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">People</p>
          <h2 className="mt-2 text-[24px] font-semibold tracking-[-0.03em] text-slate-950">Project members</h2>
        </div>
        <div className="mt-5 grid gap-3 md:grid-cols-2">
          {members.map((member) => (
            <div key={member.id} className="rounded-[22px] border border-slate-200/80 bg-slate-50/70 p-4">
              <p className="text-[16px] font-semibold tracking-[-0.02em] text-slate-900">{member.name}</p>
              <p className="mt-1 text-sm text-slate-500">{member.title}</p>
              <p className="mt-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">{roleLabels[member.role]}</p>
            </div>
          ))}
        </div>
      </Card>
    );
  }

  function renderSection() {
    if (section === 'docs') {
      return renderDocs();
    }

    if (section === 'doc-detail') {
      return <DocumentPage />;
    }

    if (section === 'tasks') {
      return <TaskBoardPage />;
    }

    if (section === 'schedule') {
      return renderSchedule();
    }

    if (section === 'members') {
      return renderMembers();
    }

    return renderOverview();
  }

  return (
    <div className="space-y-6">
      <section className="rounded-[28px] border border-slate-200/80 bg-white/88 px-6 py-6 shadow-soft backdrop-blur-sm">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-3xl">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">
              Project / {activeTab}
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <h1 className="text-[30px] font-semibold tracking-[-0.04em] text-slate-950">{currentProject.title}</h1>
              <Badge tone={statusTone(currentProject.status)}>{projectStatusLabels[currentProject.status]}</Badge>
            </div>
            <p className="mt-3 text-[15px] leading-7 text-slate-500">
              {section === 'overview'
                ? 'Live project state, current risks, and the next actions that matter this week.'
                : currentProject.description}
            </p>
          </div>

          <div className="flex flex-wrap gap-3 lg:justify-end">{renderSectionActions()}</div>
        </div>

        <div className="mt-6 flex flex-wrap gap-2">
          {tabs.map((tab) => (
            <NavLink
              key={tab.key}
              className={({ isActive }) =>
                cn(
                  'inline-flex items-center rounded-[16px] border px-4 py-2.5 text-sm font-medium tracking-[-0.01em] transition-all',
                  isActive
                    ? 'border-[rgb(var(--theme-accent-200)_/_0.95)] bg-accent-50/70 text-slate-950 shadow-[0_10px_18px_rgba(148,163,184,0.12)]'
                    : 'border-slate-200 bg-white/86 text-slate-600 hover:border-slate-300 hover:bg-white hover:text-slate-900',
                )
              }
              end={tab.key === 'overview'}
              to={tab.key === 'overview' ? `/projects/${currentProject.id}` : `/projects/${currentProject.id}/${tab.to}`}
            >
              {tab.label}
            </NavLink>
          ))}
        </div>
      </section>

      {renderSection()}

      {currentUserId ? (
        <>
          <DocumentFormModal
            open={showDocumentModal}
            projectId={currentProject.id}
            tasks={projectTasks}
            authorId={currentUserId}
            onClose={() => setShowDocumentModal(false)}
            onSubmit={createDocument}
          />
          <TaskFormModal
            open={showTaskModal}
            projectId={currentProject.id}
            users={members}
            documents={projectDocuments}
            onClose={() => setShowTaskModal(false)}
            onSubmit={createTask}
          />
          <ScheduleFormModal
            open={showScheduleModal}
            projects={[currentProject]}
            initialType="Project"
            onClose={() => setShowScheduleModal(false)}
            onSubmit={createSchedule}
          />
        </>
      ) : null}
    </div>
  );
}
