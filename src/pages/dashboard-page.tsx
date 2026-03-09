import { Link } from 'react-router-dom';
import { useLabStore } from '@/app/store/use-lab-store';
import type { Project, Schedule, Task, TimetableBlock, Weekday } from '@/entities/models';
import {
  projectStatusLabels,
  taskPriorityLabels,
  taskStatusLabels,
  weekdayLabels,
} from '@/shared/lib/labels';
import type { BadgeTone } from '@/shared/ui/badge';
import { compareWeekday, formatDate, formatShortDate, startOfDay } from '@/shared/lib/date';
import { Badge } from '@/shared/ui/badge';
import { Button } from '@/shared/ui/button';
import { Card } from '@/shared/ui/card';
import { PageHeader } from '@/shared/ui/page-header';

const DAY_IN_MS = 24 * 60 * 60 * 1000;

interface ScheduleDiagnostic {
  schedule: Schedule;
  tone: BadgeTone;
  label: string;
  detail: string;
  isConflict: boolean;
}

interface RiskItem {
  id: string;
  title: string;
  label: string;
  tone: BadgeTone;
  reason: string;
  detail: string;
  projectId?: string;
}

interface WorkSignal {
  label: string;
  tone: BadgeTone;
}

function parseDueDate(value: string): Date {
  return new Date(`${value}T09:00:00`);
}

function daysFromToday(value: string, referenceDate: Date): number {
  const diff = startOfDay(parseDueDate(value)).getTime() - referenceDate.getTime();
  return Math.floor(diff / DAY_IN_MS);
}

function timeToMinutes(value: string): number {
  const [hours, minutes] = value.split(':').map(Number);
  return hours * 60 + minutes;
}

function overlaps(block: TimetableBlock, schedule: Schedule): boolean {
  const blockStart = timeToMinutes(block.startTime);
  const blockEnd = timeToMinutes(block.endTime);
  const scheduleStart = timeToMinutes(schedule.startTime);
  const scheduleEnd = timeToMinutes(schedule.endTime);

  return Math.max(blockStart, scheduleStart) < Math.min(blockEnd, scheduleEnd);
}

function fullyContains(block: TimetableBlock, schedule: Schedule): boolean {
  const blockStart = timeToMinutes(block.startTime);
  const blockEnd = timeToMinutes(block.endTime);
  const scheduleStart = timeToMinutes(schedule.startTime);
  const scheduleEnd = timeToMinutes(schedule.endTime);

  return scheduleStart >= blockStart && scheduleEnd <= blockEnd;
}

function buildScheduleDiagnostic(schedule: Schedule, blocks: TimetableBlock[]): ScheduleDiagnostic {
  const dayBlocks = blocks.filter((block) => block.day === schedule.day);
  const blockingBlocks = dayBlocks.filter((block) => block.category !== 'Lab Availability');
  const availabilityBlocks = dayBlocks.filter((block) => block.category === 'Lab Availability');
  const hardConflictBlock = blockingBlocks.find((block) => overlaps(block, schedule));

  if (hardConflictBlock) {
    return {
      schedule,
      tone: 'danger',
      label: 'Coordination issue',
      detail:
        hardConflictBlock.category === 'Class'
          ? 'Class time overlaps this shared session.'
          : 'Session lands inside a blocked availability window.',
      isConflict: true,
    };
  }

  if (availabilityBlocks.length > 0) {
    if (availabilityBlocks.some((block) => fullyContains(block, schedule))) {
      return {
        schedule,
        tone: 'success',
        label: 'Covered',
        detail: 'Shared session fits inside your registered lab availability.',
        isConflict: false,
      };
    }

    return {
      schedule,
      tone: 'warning',
      label: 'Availability mismatch',
      detail: availabilityBlocks.some((block) => overlaps(block, schedule))
        ? 'Session only partially overlaps your available window.'
        : 'No registered availability covers this shared session.',
      isConflict: true,
    };
  }

  return {
    schedule,
    tone: 'neutral',
    label: 'No availability',
    detail: 'No personal availability has been registered for this session yet.',
    isConflict: false,
  };
}

function getWeekdayTimeLabel(day: Weekday, start: string, end: string): string {
  return `${weekdayLabels[day]} ${start} - ${end}`;
}

function getTaskPriorityTone(task: Task): BadgeTone {
  if (task.priority === 'Urgent') {
    return 'danger';
  }

  if (task.priority === 'High') {
    return 'warning';
  }

  return 'neutral';
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

function buildDueLabel(task: Task, referenceDate: Date): string {
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

function buildWorkSignals(
  task: Task,
  referenceDate: Date,
  projectHasScheduleRisk: boolean,
  needsAdvisorCheck: boolean,
): WorkSignal[] {
  const days = daysFromToday(task.dueDate, referenceDate);
  const signals: WorkSignal[] = [];

  if (days < 0) {
    signals.push({ label: 'Overdue', tone: 'danger' });
  } else if (days <= 1) {
    signals.push({ label: 'Due soon', tone: 'warning' });
  } else if (days <= 6) {
    signals.push({ label: 'Due this week', tone: 'info' });
  }

  if (task.status === 'Review') {
    signals.push({ label: 'Waiting review', tone: 'warning' });
  }

  if (needsAdvisorCheck) {
    signals.push({ label: 'Advisor check', tone: 'warning' });
  }

  if (projectHasScheduleRisk) {
    signals.push({ label: 'Schedule-sensitive', tone: 'danger' });
  }

  return signals.slice(0, 3);
}

export function DashboardPage() {
  const { currentUserId, documents, projects, schedules, tasks, timetableBlocks, updateTaskStatus } = useLabStore();

  const referenceDate = startOfDay(new Date());
  const myProjects = projects.filter((project) => project.memberIds.includes(currentUserId ?? ''));
  const myProjectIds = new Set(myProjects.map((project) => project.id));
  const myTasks = tasks.filter((task) => task.assigneeId === currentUserId && task.status !== 'Done');
  const myProjectTasks = tasks.filter((task) => myProjectIds.has(task.projectId) && task.status !== 'Done');
  const myTimetableBlocks = timetableBlocks
    .filter((block) => block.userId === currentUserId)
    .sort((left, right) => compareWeekday(left.day, right.day));

  const sharedSchedules = schedules
    .filter(
      (schedule) =>
        schedule.type === 'Lab' ||
        (schedule.type === 'Project' && schedule.projectId && myProjectIds.has(schedule.projectId)),
    )
    .sort(
      (left, right) =>
        compareWeekday(left.day, right.day) || left.startTime.localeCompare(right.startTime),
    );

  const scheduleDiagnostics = sharedSchedules.map((schedule) =>
    buildScheduleDiagnostic(schedule, myTimetableBlocks),
  );
  const scheduleConflicts = scheduleDiagnostics.filter((item) => item.isConflict);

  const overdueTasks = myTasks.filter((task) => daysFromToday(task.dueDate, referenceDate) < 0);
  const dueThisWeekTasks = myTasks.filter((task) => {
    const delta = daysFromToday(task.dueDate, referenceDate);
    return delta >= 0 && delta <= 6;
  });
  const reviewTasks = myProjectTasks.filter((task) => task.status === 'Review');
  const advisorCheckTasks = myProjectTasks.filter(
    (task) => task.status !== 'Review' && task.title.toLowerCase().includes('review'),
  );
  const blockedTasks = myProjectTasks.filter((task) => !task.assigneeId);

  const workQueue = [...myTasks].sort((left, right) => {
    const leftDays = daysFromToday(left.dueDate, referenceDate);
    const rightDays = daysFromToday(right.dueDate, referenceDate);
    const leftScore =
      (left.status === 'Review' ? 70 : 0) +
      (left.priority === 'Urgent' ? 45 : left.priority === 'High' ? 25 : 0) +
      (leftDays < 0 ? 40 : leftDays <= 1 ? 32 : leftDays <= 6 ? 18 : 0);
    const rightScore =
      (right.status === 'Review' ? 70 : 0) +
      (right.priority === 'Urgent' ? 45 : right.priority === 'High' ? 25 : 0) +
      (rightDays < 0 ? 40 : rightDays <= 1 ? 32 : rightDays <= 6 ? 18 : 0);

    return rightScore - leftScore || leftDays - rightDays;
  });

  const riskItems: RiskItem[] = [
    ...overdueTasks.map((task) => ({
      id: `overdue-${task.id}`,
      title: task.title,
      label: 'Overdue',
      tone: 'danger' as BadgeTone,
      reason: 'Due date passed',
      detail: `${formatDate(task.dueDate)} deadline has already passed.`,
      projectId: task.projectId,
    })),
    ...dueThisWeekTasks
      .filter((task) => daysFromToday(task.dueDate, referenceDate) <= 1)
      .filter((task) => !overdueTasks.some((item) => item.id === task.id))
      .map((task) => ({
        id: `soon-${task.id}`,
        title: task.title,
        label: 'Due soon',
        tone: 'warning' as BadgeTone,
        reason: 'Within 24h',
        detail: `Due ${buildDueLabel(task, referenceDate).toLowerCase()}.`,
        projectId: task.projectId,
      })),
    ...reviewTasks.map((task) => ({
      id: `review-${task.id}`,
      title: task.title,
      label: 'Review waiting',
      tone: 'warning' as BadgeTone,
      reason: 'Pending advisor review',
      detail: 'Work is complete enough to review but still waiting on a decision.',
      projectId: task.projectId,
    })),
    ...advisorCheckTasks.map((task) => ({
      id: `advisor-${task.id}`,
      title: task.title,
      label: 'Advisor check',
      tone: 'warning' as BadgeTone,
      reason: 'Handoff incomplete',
      detail: 'Task wording indicates a review handoff, but it is not yet in review.',
      projectId: task.projectId,
    })),
    ...scheduleConflicts.map((item) => ({
      id: `schedule-${item.schedule.id}`,
      title: item.schedule.title,
      label: item.label,
      tone: item.tone,
      reason:
        item.label === 'Availability mismatch'
          ? 'Outside registered availability'
          : 'Unresolved schedule issue',
      detail: item.detail,
      projectId: item.schedule.projectId,
    })),
    ...blockedTasks.map((task) => ({
      id: `blocked-${task.id}`,
      title: task.title,
      label: 'Blocked',
      tone: 'warning' as BadgeTone,
      reason: 'No assignee',
      detail: 'Task has no owner, so the handoff is still incomplete.',
      projectId: task.projectId,
    })),
  ]
    .slice(0, 6);

  const projectWatchlist = myProjects
    .map((project) => {
      const projectTasks = myProjectTasks.filter((task) => task.projectId === project.id);
      const overdue = projectTasks.filter((task) => daysFromToday(task.dueDate, referenceDate) < 0).length;
      const dueThisWeek = projectTasks.filter((task) => {
        const delta = daysFromToday(task.dueDate, referenceDate);
        return delta >= 0 && delta <= 6;
      }).length;
      const reviewWaiting = projectTasks.filter((task) => task.status === 'Review').length;
      const blocked = projectTasks.filter((task) => !task.assigneeId).length;
      const nextSession = schedules
        .filter((schedule) => schedule.projectId === project.id)
        .sort(
          (left, right) =>
            compareWeekday(left.day, right.day) || left.startTime.localeCompare(right.startTime),
        )[0];
      const coordinationIssues = scheduleConflicts.filter((item) => item.schedule.projectId === project.id).length;
      const score = overdue * 4 + dueThisWeek * 2 + reviewWaiting * 2 + blocked * 3 + coordinationIssues * 3;

      return {
        project,
        overdue,
        dueThisWeek,
        reviewWaiting,
        blocked,
        nextSession,
        coordinationIssues,
        score,
      };
    })
    .filter((item) => item.score > 0 || item.nextSession)
    .sort((left, right) => right.score - left.score)
    .slice(0, 4);

  const bestCollaborationWindow = myTimetableBlocks
    .filter((block) => block.category === 'Lab Availability')
    .sort(
      (left, right) =>
        timeToMinutes(right.endTime) -
          timeToMinutes(right.startTime) -
          (timeToMinutes(left.endTime) - timeToMinutes(left.startTime)) ||
        compareWeekday(left.day, right.day),
    )[0];

  const recentDocs = documents
    .filter((document) => myProjectIds.has(document.projectId))
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
    .slice(0, 3);

  return (
    <div className="space-y-6">
      <PageHeader
        title="대시보드"
      />

      <Card className="overflow-hidden border-slate-200/70 bg-[linear-gradient(135deg,rgba(255,255,255,0.97),rgba(245,247,252,0.94))]">
        <div className="grid gap-4 lg:grid-cols-[1.35fr_0.65fr]">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
              Weekly operations
            </p>
            <h2 className="mt-2 text-[28px] font-semibold tracking-[-0.04em] text-slate-950">
              {overdueTasks.length > 0
                ? `${overdueTasks.length} overdue, ${dueThisWeekTasks.length} due this week`
                : `${dueThisWeekTasks.length} due this week, ${reviewTasks.length} waiting review`}
            </h2>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-500">
              Coordination risk is driven by {scheduleConflicts.length} shared session issues and{' '}
              {blockedTasks.length} unassigned work items.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-2">
            <div className="rounded-[20px] border border-white/80 bg-white/92 px-4 py-3.5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                Urgent work
              </p>
              <p className="mt-1.5 text-[28px] font-semibold tracking-[-0.04em] text-slate-950">
                {overdueTasks.length + myTasks.filter((task) => task.priority === 'Urgent').length}
              </p>
            </div>
            <div className="rounded-[20px] border border-white/80 bg-white/92 px-4 py-3.5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                Due this week
              </p>
              <p className="mt-1.5 text-[28px] font-semibold tracking-[-0.04em] text-slate-950">
                {dueThisWeekTasks.length}
              </p>
            </div>
            <div className="rounded-[20px] border border-white/80 bg-white/92 px-4 py-3.5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                Review waiting
              </p>
              <p className="mt-1.5 text-[28px] font-semibold tracking-[-0.04em] text-slate-950">
                {reviewTasks.length}
              </p>
            </div>
            <div className="rounded-[20px] border border-white/80 bg-white/92 px-4 py-3.5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                Coordination risk
              </p>
              <p className="mt-1.5 text-[28px] font-semibold tracking-[-0.04em] text-slate-950">
                {scheduleConflicts.length}
              </p>
            </div>
          </div>
        </div>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[1.45fr_0.85fr]">
        <Card className="border-slate-200/70">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                Action zone
              </p>
              <h2 className="mt-1.5 text-[24px] font-semibold tracking-[-0.03em] text-slate-950">
                My work queue
              </h2>
            </div>
            <Link className="text-sm font-semibold text-accent-700" to="/projects">
              Open projects
            </Link>
          </div>

          <div className="mt-5 grid gap-3">
            {workQueue.slice(0, 6).map((task) => {
              const project = projects.find((item) => item.id === task.projectId);
              const linkedDoc = documents.find((item) => item.id === task.documentId);
              const needsAdvisorCheck =
                task.status !== 'Review' && task.title.toLowerCase().includes('review');
              const projectHasScheduleRisk = scheduleConflicts.some(
                (item) => item.schedule.projectId === task.projectId,
              );
              const signals = buildWorkSignals(
                task,
                referenceDate,
                projectHasScheduleRisk,
                needsAdvisorCheck,
              );

              return (
                <div
                  key={task.id}
                  className="rounded-[20px] border border-slate-200/80 bg-slate-50/80 px-4 py-4 transition hover:border-slate-300 hover:bg-white"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={getTaskPriorityTone(task)}>{taskPriorityLabels[task.priority]}</Badge>
                    <Badge tone="info">{taskStatusLabels[task.status]}</Badge>
                    {signals.map((signal) => (
                      <Badge key={`${task.id}-${signal.label}`} tone={signal.tone}>
                        {signal.label}
                      </Badge>
                    ))}
                  </div>

                  <div className="mt-3 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0">
                      <h3 className="text-[15px] font-semibold tracking-[-0.02em] text-slate-900">
                        {task.title}
                      </h3>
                      <p className="mt-1 text-sm text-slate-500">
                        {project?.title ?? 'Unknown project'}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-500">
                        <span>{buildDueLabel(task, referenceDate)}</span>
                        {linkedDoc ? <span>Linked doc: {linkedDoc.title}</span> : null}
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2 lg:justify-end">
                      {linkedDoc ? (
                        <Link
                          className="inline-flex items-center justify-center rounded-[14px] border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                          to={`/projects/${task.projectId}/docs/${linkedDoc.id}`}
                        >
                          Open doc
                        </Link>
                      ) : null}
                      {(task.status === 'Todo' || task.status === 'In Progress') ? (
                        <Button
                          variant="ghost"
                          className="px-3 py-1.5 text-xs text-slate-700"
                          onClick={() => updateTaskStatus(task.id, 'Review')}
                        >
                          Move to review
                        </Button>
                      ) : null}
                      <Button
                        variant="ghost"
                        className="px-3 py-1.5 text-xs text-slate-700"
                        onClick={() => updateTaskStatus(task.id, 'Done')}
                      >
                        Mark done
                      </Button>
                      <Link
                        className="inline-flex items-center justify-center rounded-[14px] border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                        to={`/projects/${task.projectId}`}
                      >
                        Open project
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        <Card className="border-rose-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(255,246,247,0.93))]">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                Watch panel
              </p>
              <h2 className="mt-1.5 text-[24px] font-semibold tracking-[-0.03em] text-slate-950">
                Needs attention
              </h2>
            </div>
            <Badge tone="danger">Watch</Badge>
          </div>

          <div className="mt-5 space-y-3">
            {riskItems.map((item) => (
              <div key={item.id} className="rounded-[18px] border border-rose-200/80 bg-white/90 px-4 py-3.5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[15px] font-semibold tracking-[-0.02em] text-slate-900">
                      {item.title}
                    </p>
                    <p className="mt-1.5 text-[12px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                      {item.reason}
                    </p>
                    <p className="mt-1.5 text-sm text-slate-500">{item.detail}</p>
                  </div>
                  <Badge tone={item.tone}>{item.label}</Badge>
                </div>
                {item.projectId ? (
                  <Link
                    className="mt-2 inline-flex text-[11px] font-semibold uppercase tracking-[0.14em] text-accent-700"
                    to={`/projects/${item.projectId}`}
                  >
                    Open project
                  </Link>
                ) : null}
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <Card className="border-slate-200/70">
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                Weekly coordination
              </p>
              <h2 className="mt-1.5 text-[22px] font-semibold tracking-[-0.03em] text-slate-950">
                Shared sessions and availability
              </h2>
            </div>
            {bestCollaborationWindow ? (
              <div className="rounded-[18px] border border-emerald-200/80 bg-emerald-50/70 px-4 py-2 text-sm text-slate-700">
                Best window: {getWeekdayTimeLabel(bestCollaborationWindow.day, bestCollaborationWindow.startTime, bestCollaborationWindow.endTime)}
              </div>
            ) : null}
          </div>

          <div className="mt-5 space-y-3">
            {scheduleDiagnostics.slice(0, 4).map((item) => (
              <div key={item.schedule.id} className="rounded-[20px] border border-slate-200/80 bg-slate-50/70 px-4 py-3.5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[15px] font-semibold tracking-[-0.02em] text-slate-900">
                      {item.schedule.title}
                    </p>
                    <p className="mt-1.5 text-sm text-slate-500">
                      {getWeekdayTimeLabel(item.schedule.day, item.schedule.startTime, item.schedule.endTime)}
                    </p>
                    <p className="mt-1 text-sm text-slate-500">{item.detail}</p>
                  </div>
                  <Badge tone={item.tone}>{item.label}</Badge>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card className="border-slate-200/70">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                Project watchlist
              </p>
              <h2 className="mt-1.5 text-[22px] font-semibold tracking-[-0.03em] text-slate-950">
                Projects requiring action this week
              </h2>
            </div>
            <Link className="text-sm font-semibold text-accent-700" to="/projects">
              All projects
            </Link>
          </div>

          <div className="mt-5 grid gap-3">
            {projectWatchlist.map((item) => (
              <Link
                key={item.project.id}
                className="rounded-[20px] border border-slate-200/80 bg-slate-50/70 px-4 py-3.5 transition hover:border-slate-300 hover:bg-white"
                to={`/projects/${item.project.id}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[15px] font-semibold tracking-[-0.02em] text-slate-900">
                      {item.project.title}
                    </p>
                    <p className="mt-1.5 text-sm text-slate-500">
                      {[
                        item.overdue > 0 ? `${item.overdue} overdue` : null,
                        item.dueThisWeek > 0 ? `${item.dueThisWeek} due this week` : null,
                        item.reviewWaiting > 0 ? `${item.reviewWaiting} review waiting` : null,
                        item.blocked > 0 ? `${item.blocked} blocked` : null,
                        item.coordinationIssues > 0 ? `${item.coordinationIssues} coordination issue` : null,
                      ]
                        .filter(Boolean)
                        .join(' / ')}
                    </p>
                    {item.nextSession ? (
                      <p className="mt-2 text-sm text-slate-500">
                        Next session: {getWeekdayTimeLabel(item.nextSession.day, item.nextSession.startTime, item.nextSession.endTime)}
                      </p>
                    ) : null}
                  </div>
                  <Badge tone={getProjectTone(item.project)}>
                    {projectStatusLabels[item.project.status]}
                  </Badge>
                </div>
              </Link>
            ))}
          </div>
        </Card>
      </div>

      <Card className="border-slate-200/70 p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
              Recent documents
            </p>
            <h2 className="mt-1.5 text-[18px] font-semibold tracking-[-0.03em] text-slate-950">
              Lightweight reference only
            </h2>
          </div>
          <span className="text-sm text-slate-400">Secondary</span>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {recentDocs.map((document) => {
            const project = projects.find((item) => item.id === document.projectId);

            return (
              <Link
                key={document.id}
                className="rounded-[18px] border border-slate-200/80 bg-slate-50/70 px-4 py-3 transition hover:border-slate-300 hover:bg-white"
                to={`/projects/${document.projectId}/docs/${document.id}`}
              >
                <p className="text-[14px] font-semibold tracking-[-0.02em] text-slate-900">
                  {document.title}
                </p>
                <p className="mt-1.5 text-sm text-slate-500">{project?.title ?? 'Unknown project'}</p>
                <p className="mt-2 text-[13px] text-slate-500">Updated {formatShortDate(document.updatedAt)}</p>
              </Link>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
