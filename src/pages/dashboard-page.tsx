import { Link } from 'react-router-dom';
import { useLabStore } from '@/app/store/use-lab-store';
import type { Schedule, Task, TimetableBlock, Weekday } from '@/entities/models';
import { projectStatusLabels, taskPriorityLabels, taskStatusLabels, weekdayLabels } from '@/shared/lib/labels';
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
      label: '가용 시간 외',
      detail: hardConflictBlock.category === 'Class' ? '수업 일정과 겹침' : '참여 불가로 표시된 시간',
      isConflict: true,
    };
  }

  if (availabilityBlocks.length > 0) {
    const fullyAvailable = availabilityBlocks.some((block) => fullyContains(block, schedule));
    if (fullyAvailable) {
      return {
        schedule,
        tone: 'success',
        label: '가용 시간 내',
        detail: '등록된 실험실 가능 시간 안에 있음',
        isConflict: false,
      };
    }

    const partialAvailability = availabilityBlocks.some((block) => overlaps(block, schedule));
    return {
      schedule,
      tone: 'warning',
      label: partialAvailability ? '부분 겹침' : '가용 시간 외',
      detail: partialAvailability ? '가능 시간 범위를 일부 넘김' : '연결되는 가능 시간 블록 없음',
      isConflict: true,
    };
  }

  return {
    schedule,
    tone: 'neutral',
    label: '가용 시간 미등록',
    detail: '개인 가능 시간이 아직 등록되지 않음',
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
  return `${weekdayLabels[day]} ${start} - ${end}`;
}

function compactCountText(count: number, singular: string, plural: string): string {
  return `${count}${count === 1 ? singular : plural}`;
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
  } = useLabStore();

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
      label: '기한 초과',
      tone: 'danger' as BadgeTone,
      detail: `${formatDate(task.dueDate)}부터 지연`,
      projectId: task.projectId,
    })),
    ...dueSoonTasks
      .filter((task) => !overdueTasks.some((overdueTask) => overdueTask.id === task.id))
      .map((task) => ({
        id: `soon-${task.id}`,
        title: task.title,
        label: '마감 임박',
        tone: 'warning' as BadgeTone,
        detail: `${formatDate(task.dueDate)} 전까지 진행 필요`,
        projectId: task.projectId,
      })),
    ...unresolvedItems
      .filter((task) => !dueSoonTasks.some((dueSoonTask) => dueSoonTask.id === task.id))
      .map((task) => ({
        id: `handoff-${task.id}`,
        title: task.title,
        label: task.status === 'Review' ? '검토 대기' : '인수인계 지연',
        tone: 'warning' as BadgeTone,
        detail: task.status === 'Review' ? '승인 대기 중' : '검토 의존성이 아직 해결되지 않음',
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
      label: '담당자 없음',
      tone: 'warning' as BadgeTone,
      detail: '작업 소유자가 아직 지정되지 않음',
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
            ? compactCountText(projectDueThisWeek.length, '건 이번 주 마감', '건 이번 주 마감')
            : null,
          projectReview.length > 0
            ? compactCountText(projectReview.length, '건 검토 대기', '건 검토 대기')
            : null,
          projectScheduleIssues.length > 0
            ? compactCountText(projectScheduleIssues.length, '건 일정 이슈 미해결', '건 일정 이슈 미해결')
            : null,
        ].filter(Boolean),
      };
    })
    .filter((item) => item.score > 0)
    .sort((left, right) => right.score - left.score)
    .slice(0, 3);

  const weeklySummary = `${compactCountText(
    dueSoonTasks.length,
    '건의 작업이 72시간 내 마감',
    '건의 작업이 72시간 내 마감',
  )}, ${compactCountText(
    scheduleConflicts.length,
    '건의 일정 불일치',
    '건의 일정 불일치',
  )}, ${compactCountText(
    unresolvedItems.length,
    '건의 인수인계 대기',
    '건의 인수인계 대기',
  )}가 확인이 필요합니다.`;

  const followupSummary = bestCollaborationWindow
    ? `가장 넓은 공용 연구실 시간은 ${getWeekdayLabel(
        bestCollaborationWindow.day,
        bestCollaborationWindow.startTime,
        bestCollaborationWindow.endTime,
      )}입니다.`
    : '등록된 연구실 가능 시간 블록이 아직 없습니다.';

  return (
    <div className="space-y-8">
      <PageHeader title="대시보드" />

      <Card className="overflow-hidden border-slate-200/70 bg-[linear-gradient(135deg,rgba(255,255,255,0.97),rgba(245,247,252,0.94))] py-5">
        <div className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
              주간 운영 브리프
            </p>
            <h2 className="mt-2 text-[26px] font-semibold tracking-[-0.04em] text-slate-950">
              {weeklySummary}
            </h2>
            <p className="mt-3 text-sm leading-6 text-slate-500">{followupSummary}</p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
            <div className="rounded-[20px] border border-white/80 bg-white/92 px-4 py-3.5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                마감 임박
              </p>
              <p className="mt-1.5 text-[28px] font-semibold tracking-[-0.04em] text-slate-950">
                {dueSoonTasks.length}
              </p>
            </div>
            <div className="rounded-[20px] border border-white/80 bg-white/92 px-4 py-3.5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                일정 충돌
              </p>
              <p className="mt-1.5 text-[28px] font-semibold tracking-[-0.04em] text-slate-950">
                {scheduleConflicts.length}
              </p>
            </div>
            <div className="rounded-[20px] border border-white/80 bg-white/92 px-4 py-3.5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                대기 항목
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
            내 담당 작업
          </p>
          <p className="mt-2 text-[32px] font-semibold tracking-[-0.05em] text-slate-950">
            {myTasks.length}
          </p>
          <p className="mt-1.5 text-sm text-slate-500">
            {compactCountText(myTasks.length, '건의 열린 작업이 내 큐에 있습니다', '건의 열린 작업이 내 큐에 있습니다')}
          </p>
        </Card>

        <Card className="border-slate-200/70 p-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
            이번 주 마감
          </p>
          <p className="mt-2 text-[32px] font-semibold tracking-[-0.05em] text-slate-950">
            {dueThisWeekTasks.length}
          </p>
          <p className="mt-1.5 text-sm text-slate-500">
            {compactCountText(dueThisWeekTasks.length, '건이 이번 주 마감입니다', '건이 이번 주 마감입니다')}
          </p>
        </Card>

        <Card className="border-amber-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(255,249,240,0.92))] p-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-500">
            일정 충돌
          </p>
          <p className="mt-2 text-[32px] font-semibold tracking-[-0.05em] text-slate-950">
            {scheduleConflicts.length}
          </p>
          <p className="mt-1.5 text-sm text-slate-500">
            {compactCountText(scheduleConflicts.length, '건의 일정 불일치가 감지되었습니다', '건의 일정 불일치가 감지되었습니다')}
          </p>
        </Card>

        <Card className="border-slate-200/70 p-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
            검토 대기
          </p>
          <p className="mt-2 text-[32px] font-semibold tracking-[-0.05em] text-slate-950">
            {pendingReviewTasks.length}
          </p>
          <p className="mt-1.5 text-sm text-slate-500">
            {compactCountText(pendingReviewTasks.length, '건이 인수인계 대기 중입니다', '건이 인수인계 대기 중입니다')}
          </p>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.25fr_0.75fr]">
        <Card className="border-slate-200/70">
          <div className="flex items-center justify-between">
            <h2 className="text-[24px] font-semibold tracking-[-0.03em] text-slate-950">
              내 작업 큐
            </h2>
            <Link className="text-sm font-semibold text-accent-700" to="/projects">
              프로젝트 보기
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
                    <Badge tone={taskPriorityTone(task)}>{taskPriorityLabels[task.priority]}</Badge>
                    <Badge tone="info">{taskStatusLabels[task.status]}</Badge>
                    {linkedDoc ? <Badge tone="neutral">연결 문서</Badge> : null}
                    {needsReview ? <Badge tone="warning">검토 대기</Badge> : null}
                    {needsAdvisorCheck ? <Badge tone="warning">인수인계 지연</Badge> : null}
                    {projectScheduleRisk ? <Badge tone="warning">가용 시간 외</Badge> : null}
                  </div>

                  <div className="mt-3 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <h3 className="text-[15px] font-semibold tracking-[-0.02em] text-slate-900">
                        {task.title}
                      </h3>
                      <p className="mt-1 text-sm text-slate-500">
                        {project?.title ?? '알 수 없는 프로젝트'}
                      </p>
                      <p className="mt-2 text-sm text-slate-500">마감 {formatDate(task.dueDate)}</p>
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
                        완료 처리
                      </Button>
                      {task.status === 'Todo' || task.status === 'In Progress' ? (
                        <Button
                          variant="ghost"
                          className="px-3 py-1.5 text-xs text-slate-700"
                          onClick={() => updateTaskStatus(task.id, 'Review')}
                        >
                          검토로 이동
                        </Button>
                      ) : null}
                      <Link
                        className="inline-flex items-center justify-center rounded-[14px] border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                        to={`/projects/${task.projectId}`}
                      >
                        프로젝트 열기
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
              운영 리스크
            </h2>
            <Badge tone="danger">주의</Badge>
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
                    프로젝트 열기
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
                주간 코디네이션
              </p>
              <h2 className="mt-1.5 text-[24px] font-semibold tracking-[-0.03em] text-slate-950">
                공유 일정과 개인 가능 시간
              </h2>
            </div>
            {bestCollaborationWindow ? (
              <div className="rounded-[18px] border border-emerald-200/80 bg-emerald-50/70 px-4 py-2.5 text-sm text-slate-700">
                최적 연구실 시간: {getWeekdayLabel(bestCollaborationWindow.day, bestCollaborationWindow.startTime, bestCollaborationWindow.endTime)}
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
                  개인 확보 시간
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
              프로젝트 워치리스트
            </p>
            <h2 className="mt-1.5 text-[24px] font-semibold tracking-[-0.03em] text-slate-950">
              이번 주 확인이 필요한 프로젝트
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
                    {projectStatusLabels[item.project.status]}
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
            최근 문서
          </p>
          <h2 className="mt-1.5 text-[18px] font-semibold tracking-[-0.03em] text-slate-950">
            가볍게 확인하는 지식 업데이트
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
                <p className="mt-1.5 text-sm text-slate-500">{project?.title ?? '알 수 없는 프로젝트'}</p>
                <p className="mt-1 text-sm text-slate-500">{document.tags.join(', ')}</p>
                <p className="mt-2.5 text-[13px] text-slate-500">
                  업데이트 {formatShortDate(document.updatedAt)}
                </p>
              </Link>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
