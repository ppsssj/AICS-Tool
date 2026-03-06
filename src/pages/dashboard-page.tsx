import { Link } from 'react-router-dom';
import { useLabStore } from '@/app/store/use-lab-store';
import type { Schedule, Task, TimetableBlock, Weekday } from '@/entities/models';
import type { BadgeTone } from '@/shared/ui/badge';
import { compareWeekday, formatDate, formatShortDate } from '@/shared/lib/date';
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
  detail: string;
  projectId?: string;
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function parseDueDate(value: string): Date {
  return new Date(`${value}T09:00:00`);
}

function daysFromReference(value: string, referenceDate: Date): number {
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
      label: 'Outside availability',
      detail: hardConflictBlock.category === 'Class' ? 'Class overlap' : 'Marked unavailable',
      isConflict: true,
    };
  }

  if (availabilityBlocks.length > 0) {
    const fullyAvailable = availabilityBlocks.some((block) => fullyContains(block, schedule));
    if (fullyAvailable) {
      return {
        schedule,
        tone: 'success',
        label: 'Fits lab block',
        detail: 'Within registered availability',
        isConflict: false,
      };
    }

    const partialAvailability = availabilityBlocks.some((block) => overlaps(block, schedule));
    return {
      schedule,
      tone: 'warning',
      label: partialAvailability ? 'Partial fit' : 'Outside availability',
      detail: partialAvailability ? 'Extends beyond open lab window' : 'No matching lab block',
      isConflict: true,
    };
  }

  return {
    schedule,
    tone: 'neutral',
    label: 'No lab block',
    detail: 'Availability not registered',
    isConflict: false,
  };
}

function getReferenceDate(tasks: Task[]): Date {
  const openTaskTimes = tasks
    .filter((task) => task.status !== 'Done')
    .map((task) => parseDueDate(task.dueDate).getTime())
    .sort((left, right) => left - right);

  if (openTaskTimes.length === 0) {
    return startOfDay(new Date());
  }

  return new Date(openTaskTimes[0] - DAY_IN_MS);
}

function getWeekdayLabel(day: Weekday, start: string, end: string): string {
  return `${day} - ${start} to ${end}`;
}

function compactCountText(count: number, singular: string, plural: string): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

function taskPriorityTone(task: Task): BadgeTone {
  if (task.priority === 'Urgent') {
    return 'danger';
  }

  if (task.priority === 'High') {
    return 'warning';
  }

  return 'neutral';
}

export function DashboardPage() {
  const {
    currentUserId,
    documents,
    projects,
    schedules,
    tasks,
    timetableBlocks,
    updateTaskStatus,
    users,
  } = useLabStore();

  const currentUser = users.find((user) => user.id === currentUserId);
  const referenceDate = getReferenceDate(tasks);
  const myProjects = projects.filter((project) => project.memberIds.includes(currentUserId ?? ''));
  const myProjectIds = new Set(myProjects.map((project) => project.id));
  const myTasks = tasks.filter((task) => task.assigneeId === currentUserId && task.status !== 'Done');
  const myProjectTasks = tasks.filter((task) => myProjectIds.has(task.projectId) && task.status !== 'Done');
  const myTimetableBlocks = timetableBlocks
    .filter((block) => block.userId === currentUserId)
    .sort((left, right) => compareWeekday(left.day, right.day));
  const recentDocs = documents
    .filter((document) => myProjectIds.has(document.projectId))
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
    .slice(0, 3);

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

  const personalSchedules = schedules
    .filter((schedule) => schedule.type === 'Personal' && schedule.ownerId === currentUserId)
    .sort(
      (left, right) =>
        compareWeekday(left.day, right.day) || left.startTime.localeCompare(right.startTime),
    );

  const overdueTasks = myTasks.filter((task) => daysFromReference(task.dueDate, referenceDate) < 0);
  const dueSoonTasks = myTasks.filter((task) => {
    const delta = daysFromReference(task.dueDate, referenceDate);
    return delta >= 0 && delta <= 2;
  });
  const dueThisWeekTasks = myTasks.filter((task) => {
    const delta = daysFromReference(task.dueDate, referenceDate);
    return delta >= 0 && delta <= 6;
  });
  const pendingReviewTasks = myTasks.filter((task) => task.status === 'Review');
  const unresolvedItems = myProjectTasks.filter(
    (task) => task.status === 'Review' || task.title.toLowerCase().includes('review'),
  );
  const unassignedTasks = myProjectTasks.filter((task) => !task.assigneeId);

  const scheduleDiagnostics = sharedSchedules.map((schedule) =>
    buildScheduleDiagnostic(schedule, myTimetableBlocks),
  );
  const scheduleConflicts = scheduleDiagnostics.filter((item) => item.isConflict);

  const bestCollaborationWindow = myTimetableBlocks
    .filter((block) => block.category === 'Lab Availability')
    .sort(
      (left, right) =>
        timeToMinutes(right.endTime) -
          timeToMinutes(right.startTime) -
          (timeToMinutes(left.endTime) - timeToMinutes(left.startTime)) ||
        compareWeekday(left.day, right.day),
    )[0];

  const workQueue = [...myTasks].sort((left, right) => {
    const leftDays = daysFromReference(left.dueDate, referenceDate);
    const rightDays = daysFromReference(right.dueDate, referenceDate);
    const leftScore =
      (left.status === 'Review' ? 50 : 0) +
      (left.priority === 'Urgent' ? 40 : left.priority === 'High' ? 25 : 0) +
      (leftDays < 0 ? 35 : leftDays <= 2 ? 30 : leftDays <= 6 ? 20 : 0);
    const rightScore =
      (right.status === 'Review' ? 50 : 0) +
      (right.priority === 'Urgent' ? 40 : right.priority === 'High' ? 25 : 0) +
      (rightDays < 0 ? 35 : rightDays <= 2 ? 30 : rightDays <= 6 ? 20 : 0);

    return rightScore - leftScore || leftDays - rightDays;
  });

  const riskItems: RiskItem[] = [
    ...overdueTasks.map((task) => ({
      id: `overdue-${task.id}`,
      title: task.title,
      label: 'Due soon',
      tone: 'danger' as BadgeTone,
      detail: `Past due since ${formatDate(task.dueDate)}`,
      projectId: task.projectId,
    })),
    ...dueSoonTasks
      .filter((task) => !overdueTasks.some((overdueTask) => overdueTask.id === task.id))
      .map((task) => ({
        id: `soon-${task.id}`,
        title: task.title,
        label: 'Due soon',
        tone: 'warning' as BadgeTone,
        detail: `Needs movement before ${formatDate(task.dueDate)}`,
        projectId: task.projectId,
      })),
    ...unresolvedItems
      .filter((task) => !dueSoonTasks.some((dueSoonTask) => dueSoonTask.id === task.id))
      .map((task) => ({
        id: `handoff-${task.id}`,
        title: task.title,
        label: task.status === 'Review' ? 'Waiting review' : 'Blocked by handoff',
        tone: 'warning' as BadgeTone,
        detail: task.status === 'Review' ? 'Queued for sign-off' : 'Review dependency still unresolved',
        projectId: task.projectId,
      })),
    ...scheduleConflicts.map((item) => ({
      id: `schedule-${item.schedule.id}`,
      title: item.schedule.title,
      label: item.label,
      tone: item.tone,
      detail: item.detail,
      projectId: item.schedule.projectId,
    })),
    ...unassignedTasks.map((task) => ({
      id: `unassigned-${task.id}`,
      title: task.title,
      label: 'No assignee',
      tone: 'warning' as BadgeTone,
      detail: 'Task is still missing ownership',
      projectId: task.projectId,
    })),
  ].slice(0, 5);

  const projectWatchlist = myProjects
    .map((project) => {
      const projectTasksForWatch = myProjectTasks.filter((task) => task.projectId === project.id);
      const projectDueThisWeek = projectTasksForWatch.filter((task) => {
        const delta = daysFromReference(task.dueDate, referenceDate);
        return delta >= 0 && delta <= 6;
      });
      const projectReview = projectTasksForWatch.filter((task) => task.status === 'Review');
      const projectScheduleIssues = scheduleConflicts.filter((item) => item.schedule.projectId === project.id);
      const score =
        projectDueThisWeek.length * 2 + projectReview.length * 2 + projectScheduleIssues.length * 3;

      return {
        project,
        score,
        reasons: [
          projectDueThisWeek.length > 0
            ? compactCountText(projectDueThisWeek.length, 'due task this week', 'due tasks this week')
            : null,
          projectReview.length > 0
            ? compactCountText(projectReview.length, 'pending review', 'pending review')
            : null,
          projectScheduleIssues.length > 0
            ? compactCountText(projectScheduleIssues.length, 'schedule issue unresolved', 'schedule issues unresolved')
            : null,
        ].filter(Boolean),
      };
    })
    .filter((item) => item.score > 0)
    .sort((left, right) => right.score - left.score)
    .slice(0, 3);

  const weeklySummary = `${compactCountText(
    dueSoonTasks.length,
    'item due in the next 72 hours',
    'items due in the next 72 hours',
  )}, ${compactCountText(
    scheduleConflicts.length,
    'schedule mismatch',
    'schedule mismatches',
  )}, and ${compactCountText(
    unresolvedItems.length,
    'waiting handoff',
    'waiting handoffs',
  )} need attention.`;

  const followupSummary = bestCollaborationWindow
    ? `Best shared lab window: ${getWeekdayLabel(
        bestCollaborationWindow.day,
        bestCollaborationWindow.startTime,
        bestCollaborationWindow.endTime,
      )}.`
    : 'No lab-availability block is registered yet.';

  return (
    <div className="space-y-8">
      <PageHeader title={`Welcome back, ${currentUser?.name.split(' ')[0] ?? 'Researcher'}`} />

      <Card className="overflow-hidden border-slate-200/70 bg-[linear-gradient(135deg,rgba(255,255,255,0.97),rgba(245,247,252,0.94))] py-5">
        <div className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
              Weekly Operational Brief
            </p>
            <h2 className="mt-2 text-[26px] font-semibold tracking-[-0.04em] text-slate-950">
              {weeklySummary}
            </h2>
            <p className="mt-3 text-sm leading-6 text-slate-500">{followupSummary}</p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
            <div className="rounded-[20px] border border-white/80 bg-white/92 px-4 py-3.5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                Due soon
              </p>
              <p className="mt-1.5 text-[28px] font-semibold tracking-[-0.04em] text-slate-950">
                {dueSoonTasks.length}
              </p>
            </div>
            <div className="rounded-[20px] border border-white/80 bg-white/92 px-4 py-3.5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                Schedule conflicts
              </p>
              <p className="mt-1.5 text-[28px] font-semibold tracking-[-0.04em] text-slate-950">
                {scheduleConflicts.length}
              </p>
            </div>
            <div className="rounded-[20px] border border-white/80 bg-white/92 px-4 py-3.5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                Waiting items
              </p>
              <p className="mt-1.5 text-[28px] font-semibold tracking-[-0.04em] text-slate-950">
                {unresolvedItems.length}
              </p>
            </div>
          </div>
        </div>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card className="border-slate-200/70 p-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
            Assigned to me
          </p>
          <p className="mt-2 text-[32px] font-semibold tracking-[-0.05em] text-slate-950">
            {myTasks.length}
          </p>
          <p className="mt-1.5 text-sm text-slate-500">
            {compactCountText(myTasks.length, 'open task in your queue', 'open tasks in your queue')}
          </p>
        </Card>

        <Card className="border-slate-200/70 p-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
            Due this week
          </p>
          <p className="mt-2 text-[32px] font-semibold tracking-[-0.05em] text-slate-950">
            {dueThisWeekTasks.length}
          </p>
          <p className="mt-1.5 text-sm text-slate-500">
            {compactCountText(dueThisWeekTasks.length, 'item due this week', 'items due this week')}
          </p>
        </Card>

        <Card className="border-amber-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(255,249,240,0.92))] p-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-500">
            Schedule conflicts
          </p>
          <p className="mt-2 text-[32px] font-semibold tracking-[-0.05em] text-slate-950">
            {scheduleConflicts.length}
          </p>
          <p className="mt-1.5 text-sm text-slate-500">
            {compactCountText(scheduleConflicts.length, 'schedule mismatch detected', 'schedule mismatches detected')}
          </p>
        </Card>

        <Card className="border-slate-200/70 p-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
            Pending review
          </p>
          <p className="mt-2 text-[32px] font-semibold tracking-[-0.05em] text-slate-950">
            {pendingReviewTasks.length}
          </p>
          <p className="mt-1.5 text-sm text-slate-500">
            {compactCountText(pendingReviewTasks.length, 'item waiting for handoff', 'items waiting for handoff')}
          </p>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.25fr_0.75fr]">
        <Card className="border-slate-200/70">
          <div className="flex items-center justify-between">
            <h2 className="text-[24px] font-semibold tracking-[-0.03em] text-slate-950">
              My work queue
            </h2>
            <Link className="text-sm font-semibold text-accent-700" to="/projects">
              View projects
            </Link>
          </div>

          <div className="mt-5 grid gap-3">
            {workQueue.map((task) => {
              const project = projects.find((projectItem) => projectItem.id === task.projectId);
              const linkedDoc = documents.find((document) => document.id === task.documentId);
              const projectScheduleRisk = scheduleConflicts.some(
                (item) => item.schedule.projectId === task.projectId,
              );
              const needsReview = task.status === 'Review';
              const needsAdvisorCheck = !needsReview && task.title.toLowerCase().includes('review');

              return (
                <div
                  key={task.id}
                  className="rounded-[20px] border border-slate-200/80 bg-slate-50/80 px-4 py-3.5 transition hover:border-slate-300 hover:bg-white"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={taskPriorityTone(task)}>{task.priority}</Badge>
                    <Badge tone="info">{task.status}</Badge>
                    {linkedDoc ? <Badge tone="neutral">Linked doc</Badge> : null}
                    {needsReview ? <Badge tone="warning">Waiting review</Badge> : null}
                    {needsAdvisorCheck ? <Badge tone="warning">Blocked by handoff</Badge> : null}
                    {projectScheduleRisk ? <Badge tone="warning">Outside availability</Badge> : null}
                  </div>

                  <div className="mt-3 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <h3 className="text-[15px] font-semibold tracking-[-0.02em] text-slate-900">
                        {task.title}
                      </h3>
                      <p className="mt-1 text-sm text-slate-500">
                        {project?.title ?? 'Unknown project'}
                      </p>
                      <p className="mt-2 text-sm text-slate-500">Due {formatDate(task.dueDate)}</p>
                      {linkedDoc ? (
                        <p className="mt-1 text-sm text-slate-500">{linkedDoc.title}</p>
                      ) : null}
                    </div>

                    <div className="flex flex-wrap gap-2 lg:justify-end">
                      <Button
                        variant="ghost"
                        className="px-3 py-1.5 text-xs text-slate-700"
                        onClick={() => updateTaskStatus(task.id, 'Done')}
                      >
                        Mark done
                      </Button>
                      {task.status === 'Todo' || task.status === 'In Progress' ? (
                        <Button
                          variant="ghost"
                          className="px-3 py-1.5 text-xs text-slate-700"
                          onClick={() => updateTaskStatus(task.id, 'Review')}
                        >
                          Move to review
                        </Button>
                      ) : null}
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
          <div className="flex items-center justify-between">
            <h2 className="text-[24px] font-semibold tracking-[-0.03em] text-slate-950">
              Operational risks
            </h2>
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

      <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <Card className="border-slate-200/70">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                Weekly coordination
              </p>
              <h2 className="mt-1.5 text-[24px] font-semibold tracking-[-0.03em] text-slate-950">
                Shared schedule and availability
              </h2>
            </div>
            {bestCollaborationWindow ? (
              <div className="rounded-[18px] border border-emerald-200/80 bg-emerald-50/70 px-4 py-2.5 text-sm text-slate-700">
                Best lab window: {getWeekdayLabel(bestCollaborationWindow.day, bestCollaborationWindow.startTime, bestCollaborationWindow.endTime)}
              </div>
            ) : null}
          </div>

          <div className="mt-5 grid gap-3">
            {scheduleDiagnostics.map((item) => (
              <div key={item.schedule.id} className="rounded-[20px] border border-slate-200/80 bg-slate-50/70 px-4 py-3.5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[15px] font-semibold tracking-[-0.02em] text-slate-900">
                      {item.schedule.title}
                    </p>
                    <p className="mt-1.5 text-sm text-slate-500">
                      {getWeekdayLabel(item.schedule.day, item.schedule.startTime, item.schedule.endTime)}
                    </p>
                    <p className="mt-1 text-sm text-slate-500">{item.schedule.location}</p>
                  </div>
                  <Badge tone={item.tone}>{item.label}</Badge>
                </div>
                <p className="mt-2 text-sm text-slate-500">{item.detail}</p>
              </div>
            ))}

            {personalSchedules.slice(0, 1).map((schedule) => (
              <div key={schedule.id} className="rounded-[20px] border border-slate-200/80 bg-white/85 px-4 py-3.5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                  Personal hold
                </p>
                <p className="mt-2 text-[15px] font-semibold tracking-[-0.02em] text-slate-900">
                  {schedule.title}
                </p>
                <p className="mt-1.5 text-sm text-slate-500">
                  {getWeekdayLabel(schedule.day, schedule.startTime, schedule.endTime)}
                </p>
              </div>
            ))}
          </div>
        </Card>

        <Card className="border-slate-200/70">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
              Project watchlist
            </p>
            <h2 className="mt-1.5 text-[24px] font-semibold tracking-[-0.03em] text-slate-950">
              Projects needing attention this week
            </h2>
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
                    <p className="mt-1.5 text-sm text-slate-500">{item.reasons.join(' / ')}</p>
                  </div>
                  <Badge
                    tone={
                      item.project.status === 'Active'
                        ? 'success'
                        : item.project.status === 'Planning'
                          ? 'warning'
                          : 'neutral'
                    }
                  >
                    {item.project.status}
                  </Badge>
                </div>
              </Link>
            ))}
          </div>
        </Card>
      </div>

      <Card className="border-slate-200/70 p-5">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
            Recent documents
          </p>
          <h2 className="mt-1.5 text-[18px] font-semibold tracking-[-0.03em] text-slate-950">
            Lightweight knowledge updates
          </h2>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {recentDocs.map((document) => {
            const project = projects.find((projectItem) => projectItem.id === document.projectId);
            return (
              <Link
                key={document.id}
                className="rounded-[18px] border border-slate-200/80 bg-slate-50/70 px-4 py-3.5 transition hover:border-slate-300 hover:bg-white"
                to={`/projects/${document.projectId}/docs/${document.id}`}
              >
                <p className="text-[14px] font-semibold tracking-[-0.02em] text-slate-900">
                  {document.title}
                </p>
                <p className="mt-1.5 text-sm text-slate-500">{project?.title ?? 'Unknown project'}</p>
                <p className="mt-1 text-sm text-slate-500">{document.tags.join(', ')}</p>
                <p className="mt-2.5 text-[13px] text-slate-500">
                  Updated {formatShortDate(document.updatedAt)}
                </p>
              </Link>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
