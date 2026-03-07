import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useLabStore } from '@/app/store/use-lab-store';
import type { Schedule, ScheduleType, Task, TimetableBlock } from '@/entities/models';
import { ScheduleFormModal } from '@/features/calendar/schedule-form-modal';
import { TimetableBlockModal } from '@/features/calendar/timetable-block-modal';
import {
  addDays,
  addWeeks,
  formatMonthLabel,
  formatShortDate,
  getMonthGrid,
  getWeekdayFromDate,
  isSameDay,
  isSameMonth,
  startOfDay,
  startOfWeek,
  toDateKey,
  weekdays,
} from '@/shared/lib/date';
import { cn } from '@/shared/lib/cn';
import { Badge, type BadgeTone } from '@/shared/ui/badge';
import { Button } from '@/shared/ui/button';
import { Card } from '@/shared/ui/card';
import { PageHeader } from '@/shared/ui/page-header';

const weekdayFormatter = new Intl.DateTimeFormat('en-US', { weekday: 'short' });
const dayHeaderFormatter = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' });
const longDateFormatter = new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

const calendarViews = ['Month', 'Week', 'Day'] as const;
type CalendarView = (typeof calendarViews)[number];

type CalendarItemKind = 'schedule' | 'block' | 'deadline';

interface ItemState {
  label: string;
  tone: BadgeTone;
  detail: string;
  isConflict: boolean;
}

interface CalendarItem {
  id: string;
  kind: CalendarItemKind;
  date: Date;
  dateKey: string;
  title: string;
  tone: BadgeTone;
  typeLabel: string;
  timeLabel: string;
  previewLabel: string;
  state: ItemState;
  startTime?: string;
  endTime?: string;
  startMinutes?: number;
  endMinutes?: number;
  location?: string;
  note?: string;
  projectId?: string;
  projectTitle?: string;
}

interface DayBucket {
  date: Date;
  dateKey: string;
  schedules: CalendarItem[];
  blocks: CalendarItem[];
  deadlines: CalendarItem[];
  allItems: CalendarItem[];
}

interface PositionedItem extends CalendarItem {
  top: number;
  height: number;
  lane: number;
  laneCount: number;
}

const timeGridStartMinutes = 9 * 60;
const timeGridEndMinutes = 18 * 60;
const timeGridHeight = 864;
const timelineMarkers = Array.from({ length: 10 }, (_, index) => timeGridStartMinutes + index * 60);
const deadlineSortValue = 24 * 60;
const todayKey = toDateKey(startOfDay(new Date()));
const filterLabels: Record<ScheduleType | 'All', string> = {
  All: '전체',
  Personal: '개인',
  Lab: '연구실',
  Project: '프로젝트',
};
const viewLabels: Record<CalendarView, string> = {
  Month: '월간',
  Week: '주간',
  Day: '일간',
};

function timeToMinutes(value: string): number {
  const [hours, minutes] = value.split(':').map(Number);
  return hours * 60 + minutes;
}

function shiftMonth(date: Date, amount: number): Date {
  const lastDayOfTargetMonth = new Date(date.getFullYear(), date.getMonth() + amount + 1, 0);
  const day = Math.min(date.getDate(), lastDayOfTargetMonth.getDate());
  return startOfDay(new Date(lastDayOfTargetMonth.getFullYear(), lastDayOfTargetMonth.getMonth(), day));
}

function formatWeekLabel(dates: Date[]): string {
  return `${dayHeaderFormatter.format(dates[0])} - ${dayHeaderFormatter.format(dates[dates.length - 1])}`;
}

function formatTimelineLabel(minutes: number): string {
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:00`;
}

function overlaps(startA: number, endA: number, startB: number, endB: number): boolean {
  return Math.max(startA, startB) < Math.min(endA, endB);
}

function fullyContains(containerStart: number, containerEnd: number, targetStart: number, targetEnd: number): boolean {
  return targetStart >= containerStart && targetEnd <= containerEnd;
}

function typeTone(type: ScheduleType): BadgeTone {
  if (type === 'Project') return 'info';
  if (type === 'Lab') return 'success';
  return 'warning';
}

function typeLabel(type: ScheduleType): string {
  return filterLabels[type];
}

function blockCategoryLabel(category: TimetableBlock['category']): string {
  if (category === 'Lab Availability') return '연구실 가능 시간';
  if (category === 'Class') return '수업';
  return '불가';
}

function deadlineTone(task: Task): BadgeTone {
  if (task.priority === 'Urgent') return 'danger';
  if (task.priority === 'High') return 'warning';
  return 'neutral';
}

function blockTone(block: TimetableBlock): BadgeTone {
  if (block.category === 'Lab Availability') return 'success';
  if (block.category === 'Class') return 'warning';
  return 'danger';
}

function blockState(block: TimetableBlock): ItemState {
  if (block.category === 'Lab Availability') {
    return { label: '가능 시간', tone: 'success', detail: '연구실 협업 가능 시간으로 등록되어 있습니다.', isConflict: false };
  }

  if (block.category === 'Class') {
    return { label: '고정 일정', tone: 'warning', detail: '수업 시간이라 공동 일정 배치가 어렵습니다.', isConflict: true };
  }

  return { label: '불가 시간', tone: 'danger', detail: '프로젝트 또는 연구실 일정 배치가 어려운 시간입니다.', isConflict: true };
}

function scheduleState(schedule: Schedule, dayBlocks: TimetableBlock[], daySchedules: Schedule[]): ItemState {
  const scheduleStart = timeToMinutes(schedule.startTime);
  const scheduleEnd = timeToMinutes(schedule.endTime);
  const blockingBlocks = dayBlocks.filter((block) => block.category !== 'Lab Availability');
  const availabilityBlocks = dayBlocks.filter((block) => block.category === 'Lab Availability');
  const hardConflict = blockingBlocks.find((block) => overlaps(scheduleStart, scheduleEnd, timeToMinutes(block.startTime), timeToMinutes(block.endTime)));

  if (hardConflict) {
    return {
      label: '충돌',
      tone: 'danger',
      detail: hardConflict.category === 'Class' ? '개인 시간표의 수업 시간과 겹칩니다.' : '불가 시간 블록과 겹칩니다.',
      isConflict: true,
    };
  }

  const overlappingSchedule = daySchedules.find(
    (candidate) => candidate.id !== schedule.id && overlaps(scheduleStart, scheduleEnd, timeToMinutes(candidate.startTime), timeToMinutes(candidate.endTime)),
  );

  if (overlappingSchedule) {
    return { label: '중복', tone: 'warning', detail: '같은 시간대의 다른 일정과 겹칩니다.', isConflict: true };
  }

  if (availabilityBlocks.length > 0) {
    const fullyAvailable = availabilityBlocks.some((block) => fullyContains(timeToMinutes(block.startTime), timeToMinutes(block.endTime), scheduleStart, scheduleEnd));

    if (fullyAvailable) {
      return { label: '가능 시간 내', tone: 'success', detail: '등록된 연구실 가능 시간 안에 들어옵니다.', isConflict: false };
    }

    const partialAvailability = availabilityBlocks.some((block) => overlaps(scheduleStart, scheduleEnd, timeToMinutes(block.startTime), timeToMinutes(block.endTime)));
    return {
      label: partialAvailability ? '부분 일치' : '가능 시간 외',
      tone: 'warning',
      detail: partialAvailability ? '가능 시간과 일부 겹치지만 범위를 벗어납니다.' : '해당 일정을 덮는 가능 시간 블록이 없습니다.',
      isConflict: true,
    };
  }

  return { label: '가능 시간 미등록', tone: 'neutral', detail: '이 요일에는 개인 가능 시간 블록이 등록되어 있지 않습니다.', isConflict: false };
}

function deadlineState(task: Task): ItemState {
  if (task.dueDate < todayKey) {
    return { label: '기한 지남', tone: 'danger', detail: '현재 날짜 기준으로 이미 마감이 지났습니다.', isConflict: true };
  }

  if (task.dueDate === todayKey) {
    return { label: '오늘 마감', tone: 'warning', detail: '이 작업은 오늘 마감입니다.', isConflict: true };
  }

  return { label: '예정된 마감', tone: 'neutral', detail: '선택한 날짜에 마감이 예정되어 있습니다.', isConflict: false };
}

function compareItems(left: CalendarItem, right: CalendarItem): number {
  const leftOrder = left.startMinutes ?? deadlineSortValue;
  const rightOrder = right.startMinutes ?? deadlineSortValue;
  return leftOrder - rightOrder || left.title.localeCompare(right.title);
}

function surfaceToneClasses(tone: BadgeTone): string {
  if (tone === 'danger') return 'border-rose-200/85 bg-rose-50/85';
  if (tone === 'warning') return 'border-amber-200/85 bg-amber-50/88';
  if (tone === 'success') return 'border-emerald-200/85 bg-emerald-50/82';
  if (tone === 'info') return 'border-accent-200/85 bg-accent-50/85';
  return 'border-slate-200/85 bg-slate-100/90';
}

function timelineEventClasses(item: CalendarItem, selected: boolean): string {
  return cn('absolute rounded-[18px] border px-3 py-2.5 text-left shadow-[0_12px_22px_rgba(15,23,42,0.08)] transition-all', surfaceToneClasses(item.tone), selected && 'ring-2 ring-accent-200 shadow-[0_18px_30px_rgba(75,116,217,0.16)]', item.state.isConflict && 'ring-1 ring-rose-300/80');
}

function timelineBlockClasses(item: CalendarItem, selected: boolean): string {
  return cn('absolute inset-x-2 rounded-[18px] border px-3 py-2 text-left backdrop-blur-sm transition-all', surfaceToneClasses(item.tone), 'opacity-80', selected && 'ring-2 ring-accent-200');
}

function previewPillClasses(item: CalendarItem): string {
  return cn('rounded-full border px-2.5 py-1 text-[11px] font-medium leading-none', surfaceToneClasses(item.tone));
}

function layoutTimedItems(items: CalendarItem[]): PositionedItem[] {
  const visibleItems = items
    .filter((item) => item.startMinutes !== undefined && item.endMinutes !== undefined)
    .filter((item) => (item.endMinutes as number) > timeGridStartMinutes && (item.startMinutes as number) < timeGridEndMinutes)
    .sort(compareItems);

  const activeLanes: Array<{ lane: number; end: number }> = [];
  const clusterLaneCounts = new Map<number, number>();
  const itemMeta = new Map<string, { lane: number; clusterId: number }>();
  let clusterId = -1;

  visibleItems.forEach((item) => {
    const start = item.startMinutes as number;
    for (let index = activeLanes.length - 1; index >= 0; index -= 1) {
      if (activeLanes[index].end <= start) {
        activeLanes.splice(index, 1);
      }
    }

    if (activeLanes.length === 0) {
      clusterId += 1;
      clusterLaneCounts.set(clusterId, 0);
    }

    let lane = 0;
    while (activeLanes.some((entry) => entry.lane === lane)) {
      lane += 1;
    }

    activeLanes.push({ lane, end: item.endMinutes as number });
    activeLanes.sort((left, right) => left.end - right.end);
    itemMeta.set(item.id, { lane, clusterId });
    clusterLaneCounts.set(clusterId, Math.max(clusterLaneCounts.get(clusterId) ?? 0, lane + 1));
  });

  return visibleItems.map((item) => {
    const meta = itemMeta.get(item.id);
    if (!meta) {
      return { ...item, top: 0, height: 36, lane: 0, laneCount: 1 };
    }

    const start = Math.max(item.startMinutes as number, timeGridStartMinutes);
    const end = Math.min(item.endMinutes as number, timeGridEndMinutes);
    const top = ((start - timeGridStartMinutes) / (timeGridEndMinutes - timeGridStartMinutes)) * timeGridHeight;
    const rawHeight = ((end - start) / (timeGridEndMinutes - timeGridStartMinutes)) * timeGridHeight;

    return { ...item, top, height: Math.max(rawHeight, 42), lane: meta.lane, laneCount: clusterLaneCounts.get(meta.clusterId) ?? 1 };
  });
}

export function CalendarPage() {
  const { createSchedule, createTimetableBlock, currentUserId, projects, schedules, tasks, timetableBlocks } = useLabStore();
  const [filter, setFilter] = useState<ScheduleType | 'All'>('All');
  const [view, setView] = useState<CalendarView>('Week');
  const [focusDate, setFocusDate] = useState(() => startOfDay(new Date()));
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [showTimetableModal, setShowTimetableModal] = useState(false);

  const myProjectIds = useMemo(() => new Set(projects.filter((project) => project.memberIds.includes(currentUserId ?? '')).map((project) => project.id)), [currentUserId, projects]);
  const projectMap = useMemo(() => new Map(projects.map((project) => [project.id, project])), [projects]);
  const weekDates = useMemo(() => Array.from({ length: 7 }, (_, index) => addDays(startOfWeek(focusDate), index)), [focusDate]);
  const monthGrid = useMemo(() => getMonthGrid(focusDate), [focusDate]);

  const myBlocks = useMemo(() => timetableBlocks.filter((block) => block.userId === currentUserId), [currentUserId, timetableBlocks]);
  const visibleSchedules = useMemo(
    () =>
      schedules.filter((schedule) => {
        if (filter !== 'All' && schedule.type !== filter) {
          return false;
        }

        return schedule.type !== 'Personal' || schedule.ownerId === currentUserId;
      }),
    [currentUserId, filter, schedules],
  );
  const visibleTasks = useMemo(() => {
    if (filter !== 'All' && filter !== 'Project') {
      return [];
    }

    return tasks.filter((task) => task.status !== 'Done' && (task.assigneeId === currentUserId || myProjectIds.has(task.projectId)));
  }, [currentUserId, filter, myProjectIds, tasks]);

  const dayBuckets = useMemo(() => {
    const relevantDates = Array.from(new Map([...monthGrid, ...weekDates, focusDate].map((date) => [toDateKey(date), startOfDay(date)])).values());

    return new Map<string, DayBucket>(
      relevantDates.map((date) => {
        const dateKey = toDateKey(date);
        const weekday = getWeekdayFromDate(date);
        const dayBlocks = myBlocks.filter((block) => block.day === weekday);
        const daySchedules = visibleSchedules.filter((schedule) => schedule.day === weekday);

        const scheduleItems: CalendarItem[] = daySchedules
          .map((schedule) => {
            const project = schedule.projectId ? projectMap.get(schedule.projectId) : undefined;
            return {
              id: `${schedule.id}-${dateKey}`,
              kind: 'schedule' as const,
              date,
              dateKey,
              title: schedule.title,
              tone: typeTone(schedule.type),
              typeLabel: typeLabel(schedule.type),
              timeLabel: `${schedule.startTime} - ${schedule.endTime}`,
              previewLabel: schedule.startTime,
              state: scheduleState(schedule, dayBlocks, daySchedules),
              startTime: schedule.startTime,
              endTime: schedule.endTime,
              startMinutes: timeToMinutes(schedule.startTime),
              endMinutes: timeToMinutes(schedule.endTime),
              location: schedule.location,
              note: schedule.note,
              projectId: schedule.projectId,
              projectTitle: project?.title,
            };
          })
          .sort(compareItems);

        const blockItems: CalendarItem[] = dayBlocks
          .map((block) => ({
            id: `${block.id}-${dateKey}`,
            kind: 'block' as const,
            date,
            dateKey,
            title: block.title,
            tone: blockTone(block),
            typeLabel: blockCategoryLabel(block.category),
            timeLabel: `${block.startTime} - ${block.endTime}`,
            previewLabel: block.startTime,
            state: blockState(block),
            startTime: block.startTime,
            endTime: block.endTime,
            startMinutes: timeToMinutes(block.startTime),
            endMinutes: timeToMinutes(block.endTime),
            note: block.category,
          }))
          .sort(compareItems);

        const deadlineItems: CalendarItem[] = visibleTasks
          .filter((task) => task.dueDate === dateKey)
          .map((task) => {
            const project = projectMap.get(task.projectId);
            return {
              id: task.id,
              kind: 'deadline' as const,
              date,
              dateKey,
              title: task.title,
              tone: deadlineTone(task),
              typeLabel: '프로젝트 마감',
              timeLabel: `마감 ${formatShortDate(task.dueDate)}`,
              previewLabel: '마감',
              state: deadlineState(task),
              note: task.description,
              projectId: task.projectId,
              projectTitle: project?.title,
            };
          })
          .sort(compareItems);

        const allItems = [...scheduleItems, ...blockItems, ...deadlineItems].sort(compareItems);

        return [dateKey, { date, dateKey, schedules: scheduleItems, blocks: blockItems, deadlines: deadlineItems, allItems }];
      }),
    );
  }, [focusDate, monthGrid, myBlocks, projectMap, visibleSchedules, visibleTasks, weekDates]);

  useEffect(() => {
    const bucket = dayBuckets.get(toDateKey(focusDate));
    if (!bucket) {
      setSelectedItemId(null);
      return;
    }

    const stillExists = selectedItemId ? bucket.allItems.some((item) => item.id === selectedItemId) : false;
    if (!stillExists) {
      setSelectedItemId(bucket.allItems[0]?.id ?? null);
    }
  }, [dayBuckets, focusDate, selectedItemId]);

  const focusBucket = dayBuckets.get(toDateKey(focusDate)) ?? { date: focusDate, dateKey: toDateKey(focusDate), schedules: [], blocks: [], deadlines: [], allItems: [] };
  const selectedItem = focusBucket.allItems.find((item) => item.id === selectedItemId) ?? null;

  const periodLabel = view === 'Month' ? formatMonthLabel(focusDate) : view === 'Week' ? formatWeekLabel(weekDates) : longDateFormatter.format(focusDate);

  function selectDate(date: Date) {
    const bucket = dayBuckets.get(toDateKey(date));
    setFocusDate(startOfDay(date));
    setSelectedItemId(bucket?.allItems[0]?.id ?? null);
  }

  function selectItem(item: CalendarItem) {
    setFocusDate(item.date);
    setSelectedItemId(item.id);
  }

  function movePeriod(direction: -1 | 1) {
    if (view === 'Month') {
      selectDate(shiftMonth(focusDate, direction));
      return;
    }

    if (view === 'Week') {
      selectDate(addWeeks(focusDate, direction));
      return;
    }

    selectDate(addDays(focusDate, direction));
  }

  function renderMonthCell(date: Date) {
    const bucket = dayBuckets.get(toDateKey(date));
    const previews = [...(bucket?.schedules ?? []), ...(bucket?.deadlines ?? [])].slice(0, 2);
    const hiddenCount = Math.max((bucket?.schedules.length ?? 0) + (bucket?.deadlines.length ?? 0) - previews.length, 0);
    const blockCount = bucket?.blocks.length ?? 0;

    return (
      <div
        key={toDateKey(date)}
        className={cn(
          'min-h-[148px] rounded-[24px] border p-3 transition-all duration-200',
          isSameDay(date, focusDate)
            ? 'border-accent-300 bg-white shadow-[0_18px_34px_rgba(75,116,217,0.14)]'
            : 'border-slate-200/80 bg-slate-50/70 hover:border-slate-300 hover:bg-white',
          !isSameMonth(date, focusDate) && 'bg-slate-100/60 text-slate-400',
        )}
        onClick={() => selectDate(date)}
        role="button"
        tabIndex={0}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            selectDate(date);
          }
        }}
      >
        <div className="flex items-start justify-between gap-2">
          <span
            className={cn(
              'flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold',
              isSameDay(date, startOfDay(new Date())) ? 'bg-accent-500 text-white' : 'bg-white/90 text-slate-900',
            )}
          >
            {date.getDate()}
          </span>
          {hiddenCount > 0 ? <span className="text-[11px] font-semibold text-slate-400">+{hiddenCount}</span> : null}
        </div>

        <div className="mt-3 space-y-1.5">
          {previews.map((item) => (
            <button
              key={item.id}
              className={cn('block w-full rounded-[14px] border px-2.5 py-2 text-left text-[11px]', surfaceToneClasses(item.tone))}
              onClick={(event) => {
                event.stopPropagation();
                selectItem(item);
              }}
              type="button"
            >
              <p className="font-semibold leading-4">{item.previewLabel}</p>
              <p className="mt-1 truncate leading-4">{item.title}</p>
            </button>
          ))}
          {previews.length === 0 ? (
            <p className="pt-1 text-[12px] text-slate-400">{blockCount > 0 ? `개인 블록 ${blockCount}개` : '일정 없음'}</p>
          ) : null}
          {previews.length > 0 && blockCount > 0 ? (
            <p className="text-[11px] text-slate-400">개인 블록 {blockCount}개</p>
          ) : null}
        </div>
      </div>
    );
  }

  function renderTimelineCanvas(date: Date, mode: 'week' | 'day') {
    const bucket = dayBuckets.get(toDateKey(date)) ?? {
      date,
      dateKey: toDateKey(date),
      schedules: [],
      blocks: [],
      deadlines: [],
      allItems: [],
    };
    const positionedSchedules = layoutTimedItems(bucket.schedules);

    return (
      <div
        className={cn(
          'relative bg-[linear-gradient(180deg,rgba(255,255,255,0.72),rgba(249,250,252,0.82))]',
          mode === 'week' ? 'border-r border-slate-200/80 last:border-r-0' : '',
        )}
        onClick={() => selectDate(date)}
      >
        <div className="absolute inset-0">
          {timelineMarkers.map((marker) => {
            const top = ((marker - timeGridStartMinutes) / (timeGridEndMinutes - timeGridStartMinutes)) * timeGridHeight;
            return (
              <div
                key={`${toDateKey(date)}-${marker}`}
                className="absolute inset-x-0 border-t border-slate-200/70"
                style={{ top }}
              />
            );
          })}
        </div>

        {bucket.blocks.map((item) => {
          const top = (((item.startMinutes as number) - timeGridStartMinutes) / (timeGridEndMinutes - timeGridStartMinutes)) * timeGridHeight;
          const height =
            (((item.endMinutes as number) - (item.startMinutes as number)) / (timeGridEndMinutes - timeGridStartMinutes)) *
            timeGridHeight;

          return (
            <button
              key={item.id}
              className={timelineBlockClasses(item, selectedItem?.id === item.id)}
              onClick={(event) => {
                event.stopPropagation();
                selectItem(item);
              }}
              style={{ top, height: Math.max(height, 40) }}
              type="button"
            >
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">{item.typeLabel}</p>
              <p className="mt-1 text-sm font-semibold tracking-[-0.01em] text-slate-900">{item.title}</p>
              <p className="mt-1 text-[12px] text-slate-500">{item.timeLabel}</p>
            </button>
          );
        })}

        {positionedSchedules.map((item) => {
          const laneWidth = 100 / item.laneCount;
          const left = item.lane * laneWidth;
          return (
            <button
              key={item.id}
              className={timelineEventClasses(item, selectedItem?.id === item.id)}
              onClick={(event) => {
                event.stopPropagation();
                selectItem(item);
              }}
              style={{
                top: item.top,
                height: item.height,
                left: `calc(${left}% + 8px)`,
                width: `calc(${laneWidth}% - 16px)`,
                zIndex: item.state.isConflict ? 25 : 20,
              }}
              type="button"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">{item.typeLabel}</p>
                  <p className="mt-1 text-sm font-semibold tracking-[-0.01em] text-slate-900">{item.title}</p>
                </div>
                {item.state.isConflict ? <Badge tone={item.state.tone}>충돌</Badge> : null}
              </div>
              <p className="mt-1.5 text-[12px] text-slate-500">{item.timeLabel}</p>
              <p className="mt-1 line-clamp-2 text-[12px] text-slate-500">{item.projectTitle ?? item.location}</p>
            </button>
          );
        })}
      </div>
    );
  }

  function renderInspectorList(items: CalendarItem[], emptyLabel: string) {
    if (items.length === 0) {
      return (
        <div className="rounded-[18px] border border-dashed border-slate-200 bg-slate-50/70 px-4 py-5 text-sm text-slate-500">
          {emptyLabel}
        </div>
      );
    }

    return (
      <div className="space-y-2.5">
        {items.map((item) => (
          <button
            key={item.id}
            className={cn(
              'w-full rounded-[18px] border px-4 py-3 text-left transition-all',
              surfaceToneClasses(item.tone),
              selectedItem?.id === item.id
                ? 'ring-2 ring-accent-200 shadow-[0_12px_22px_rgba(75,116,217,0.14)]'
                : 'hover:border-slate-300 hover:bg-white',
            )}
            onClick={() => selectItem(item)}
            type="button"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[14px] font-semibold tracking-[-0.02em] text-slate-900">{item.title}</p>
                <p className="mt-1 text-sm text-slate-500">{item.timeLabel}</p>
                <p className="mt-1 text-sm text-slate-500">{item.projectTitle ?? item.location ?? item.state.detail}</p>
              </div>
              <Badge tone={item.tone}>{item.typeLabel}</Badge>
            </div>
          </button>
        ))}
      </div>
    );
  }

  function renderInspectorPanel() {
    return (
      <div className="xl:sticky xl:top-8">
        <Card className="border-slate-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(248,249,252,0.94))]">
          <div className="border-b border-slate-200/80 pb-5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">상세 보기</p>
            <h2 className="mt-3 text-[24px] font-semibold tracking-[-0.03em] text-slate-950">
              {longDateFormatter.format(focusDate)}
            </h2>
            <p className="mt-2 text-sm text-slate-500">
              일정 {focusBucket.schedules.length}개, 개인 블록 {focusBucket.blocks.length}개, 마감 {focusBucket.deadlines.length}개
            </p>
          </div>

          <div className="mt-5 space-y-5">
            <div className="rounded-[22px] border border-slate-200/80 bg-white/88 p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">선택한 항목</p>
              {selectedItem ? (
                <>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <Badge tone={selectedItem.tone}>{selectedItem.typeLabel}</Badge>
                    <Badge tone={selectedItem.state.tone}>{selectedItem.state.label}</Badge>
                  </div>
                  <h3 className="mt-3 text-[20px] font-semibold tracking-[-0.03em] text-slate-950">{selectedItem.title}</h3>
                  <div className="mt-4 grid gap-3 text-sm text-slate-600">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">시간</p>
                      <p className="mt-1">{selectedItem.timeLabel}</p>
                    </div>
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">가능 여부</p>
                      <p className="mt-1">{selectedItem.state.detail}</p>
                    </div>
                    {selectedItem.location ? (
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">장소</p>
                        <p className="mt-1">{selectedItem.location}</p>
                      </div>
                    ) : null}
                    {selectedItem.projectTitle ? (
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">프로젝트</p>
                        <p className="mt-1">{selectedItem.projectTitle}</p>
                      </div>
                    ) : null}
                    {selectedItem.note ? (
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">메모</p>
                        <p className="mt-1 leading-6">{selectedItem.note}</p>
                      </div>
                    ) : null}
                  </div>
                  {selectedItem.projectId ? (
                    <Link
                      className="mt-4 inline-flex items-center rounded-[14px] border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-white"
                      to={`/projects/${selectedItem.projectId}`}
                    >
                      관련 프로젝트 열기
                    </Link>
                  ) : null}
                </>
              ) : (
                <p className="mt-3 text-sm text-slate-500">일정, 블록, 마감 항목을 선택하면 여기에서 자세히 볼 수 있습니다.</p>
              )}
            </div>

            <div>
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-[13px] font-semibold uppercase tracking-[0.16em] text-slate-400">일정</h3>
                <Badge tone="neutral">{focusBucket.schedules.length}</Badge>
              </div>
              {renderInspectorList(focusBucket.schedules, '선택한 날짜에 일정이 없습니다.')}
            </div>

            <div>
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-[13px] font-semibold uppercase tracking-[0.16em] text-slate-400">시간표 블록</h3>
                <Badge tone="neutral">{focusBucket.blocks.length}</Badge>
              </div>
              {renderInspectorList(focusBucket.blocks, '선택한 날짜에 개인 시간표 블록이 없습니다.')}
            </div>

            <div>
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-[13px] font-semibold uppercase tracking-[0.16em] text-slate-400">마감</h3>
                <Badge tone="neutral">{focusBucket.deadlines.length}</Badge>
              </div>
              {renderInspectorList(focusBucket.deadlines, '선택한 날짜에 프로젝트 마감이 없습니다.')}
            </div>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="캘린더"
        actions={
          <>
            <Button variant="secondary" onClick={() => setShowTimetableModal(true)}>
              시간표 블록 추가
            </Button>
            <Button onClick={() => setShowScheduleModal(true)}>일정 만들기</Button>
          </>
        }
      />

      <div className="rounded-[28px] border border-slate-200/80 bg-white/82 px-5 py-4 shadow-soft backdrop-blur-sm">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex flex-col gap-3 md:flex-row md:items-center">
            <div className="inline-flex rounded-[18px] border border-slate-200 bg-slate-50/80 p-1">
              {(['All', 'Personal', 'Lab', 'Project'] as const).map((item) => (
                <button
                  key={item}
                  className={cn(
                    'rounded-[14px] px-3.5 py-2 text-sm font-medium tracking-[-0.01em] transition-all',
                    filter === item ? 'bg-white text-slate-950 shadow-[0_8px_18px_rgba(15,23,42,0.08)]' : 'text-slate-500 hover:text-slate-900',
                  )}
                  onClick={() => setFilter(item)}
                  type="button"
                >
                  {filterLabels[item]}
                </button>
              ))}
            </div>

            <div className="inline-flex rounded-[18px] border border-slate-200 bg-slate-50/80 p-1">
              {calendarViews.map((item) => (
                <button
                  key={item}
                  className={cn(
                    'rounded-[14px] px-3.5 py-2 text-sm font-medium tracking-[-0.01em] transition-all',
                    view === item ? 'bg-white text-slate-950 shadow-[0_8px_18px_rgba(15,23,42,0.08)]' : 'text-slate-500 hover:text-slate-900',
                  )}
                  onClick={() => setView(item)}
                  type="button"
                >
                  {viewLabels[item]}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-3 md:flex-row md:items-center">
            <div className="rounded-[18px] border border-slate-200/80 bg-slate-50/75 px-4 py-2.5 text-sm font-medium text-slate-700">
              {periodLabel}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" onClick={() => movePeriod(-1)}>
                이전
              </Button>
              <Button variant="secondary" onClick={() => selectDate(startOfDay(new Date()))}>
                오늘
              </Button>
              <Button variant="secondary" onClick={() => movePeriod(1)}>
                다음
              </Button>
            </div>
          </div>
        </div>
      </div>

      {view === 'Month' ? (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.55fr)_minmax(360px,0.72fr)]">
          <Card className="overflow-hidden border-slate-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(247,249,252,0.94))] p-0 xl:order-1">
            <div className="border-b border-slate-200/80 px-6 py-5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">월간 보기</p>
              <h2 className="mt-2 text-[24px] font-semibold tracking-[-0.03em] text-slate-950">{formatMonthLabel(focusDate)}</h2>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-7 gap-3">
                {weekdays.map((day) => (
                  <div
                    key={day}
                    className="rounded-[16px] border border-slate-200/80 bg-slate-50/80 px-3 py-2 text-center text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500"
                  >
                    {day.slice(0, 3)}
                  </div>
                ))}
                {monthGrid.map((date) => renderMonthCell(date))}
              </div>
            </div>
          </Card>

          <div className="xl:order-2">{renderInspectorPanel()}</div>
        </div>
      ) : null}

      {view === 'Week' ? (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
          <Card className="overflow-hidden border-slate-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(247,249,252,0.94))] p-0">
            <div className="border-b border-slate-200/80 px-6 py-5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">주간 보기</p>
              <h2 className="mt-2 text-[24px] font-semibold tracking-[-0.03em] text-slate-950">운영 중심 주간 캘린더</h2>
            </div>
            <div className="overflow-x-auto">
              <div className="min-w-[1180px]">
                <div className="grid grid-cols-[72px_repeat(7,minmax(0,1fr))] border-b border-slate-200/80 bg-slate-50/75">
                  <div className="border-r border-slate-200/80 px-3 py-4" />
                  {weekDates.map((date) => {
                    const bucket = dayBuckets.get(toDateKey(date)) ?? {
                      date,
                      dateKey: toDateKey(date),
                      schedules: [],
                      blocks: [],
                      deadlines: [],
                      allItems: [],
                    };

                    return (
                      <button
                        key={`week-header-${toDateKey(date)}`}
                        className={cn(
                          'border-r border-slate-200/80 px-4 py-4 text-left last:border-r-0',
                          isSameDay(date, focusDate) && 'bg-white/80',
                        )}
                        onClick={() => selectDate(date)}
                        type="button"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                              {weekdayFormatter.format(date)}
                            </p>
                            <p className="mt-2 text-[16px] font-semibold tracking-[-0.02em] text-slate-950">
                              {dayHeaderFormatter.format(date)}
                            </p>
                          </div>
                          {isSameDay(date, startOfDay(new Date())) ? <Badge tone="info">오늘</Badge> : null}
                        </div>

                        {bucket.deadlines.length > 0 ? (
                          <div className="mt-3 flex flex-wrap gap-1.5">
                            {bucket.deadlines.map((deadline) => (
                              <button
                                key={deadline.id}
                                className={previewPillClasses(deadline)}
                                onClick={(event) => {
                                  event.stopPropagation();
                                  selectItem(deadline);
                                }}
                                type="button"
                              >
                                {deadline.previewLabel}
                              </button>
                            ))}
                          </div>
                        ) : null}
                      </button>
                    );
                  })}
                </div>

                <div className="grid grid-cols-[72px_repeat(7,minmax(0,1fr))]">
                  <div className="relative h-[864px] border-r border-slate-200/80 bg-slate-50/40">
                    {timelineMarkers.map((marker) => {
                      const top = ((marker - timeGridStartMinutes) / (timeGridEndMinutes - timeGridStartMinutes)) * timeGridHeight;
                      return (
                        <div key={`marker-${marker}`} className="absolute inset-x-0" style={{ top }}>
                          <span className="-translate-y-1/2 rounded-full bg-white px-2 text-[11px] font-medium text-slate-400">
                            {formatTimelineLabel(marker)}
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  {weekDates.map((date) => (
                    <div key={`week-canvas-${toDateKey(date)}`} className="relative h-[864px]">
                      {renderTimelineCanvas(date, 'week')}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </Card>

          {renderInspectorPanel()}
        </div>
      ) : null}

      {view === 'Day' ? (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
          <Card className="overflow-hidden border-slate-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(247,249,252,0.94))] p-0">
            <div className="border-b border-slate-200/80 px-6 py-5">
              <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">일간 보기</p>
                  <h2 className="mt-2 text-[24px] font-semibold tracking-[-0.03em] text-slate-950">{longDateFormatter.format(focusDate)}</h2>
                </div>
                {focusBucket.deadlines.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {focusBucket.deadlines.map((deadline) => (
                      <button
                        key={deadline.id}
                        className={previewPillClasses(deadline)}
                        onClick={() => selectItem(deadline)}
                        type="button"
                      >
                        {deadline.title}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>

            <div className="grid grid-cols-[72px_1fr]">
              <div className="relative h-[864px] border-r border-slate-200/80 bg-slate-50/40">
                {timelineMarkers.map((marker) => {
                  const top = ((marker - timeGridStartMinutes) / (timeGridEndMinutes - timeGridStartMinutes)) * timeGridHeight;
                  return (
                    <div key={`day-marker-${marker}`} className="absolute inset-x-0" style={{ top }}>
                      <span className="-translate-y-1/2 rounded-full bg-white px-2 text-[11px] font-medium text-slate-400">
                        {formatTimelineLabel(marker)}
                      </span>
                    </div>
                  );
                })}
              </div>

              <div className="relative h-[864px]">
                {renderTimelineCanvas(focusDate, 'day')}
              </div>
            </div>
          </Card>

          {renderInspectorPanel()}
        </div>
      ) : null}

      {currentUserId ? (
        <>
          <ScheduleFormModal
            open={showScheduleModal}
            projects={projects}
            ownerId={currentUserId}
            onClose={() => setShowScheduleModal(false)}
            onSubmit={createSchedule}
          />
          <TimetableBlockModal
            open={showTimetableModal}
            userId={currentUserId}
            onClose={() => setShowTimetableModal(false)}
            onSubmit={createTimetableBlock}
          />
        </>
      ) : null}
    </div>
  );
}
