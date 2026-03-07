import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useLabStore } from '@/app/store/use-lab-store';
import type { Task, TaskPriority, TaskStatus } from '@/entities/models';
import { TaskFormModal } from '@/features/tasks/task-form-modal';
import { formatDate, startOfDay } from '@/shared/lib/date';
import { taskPriorityLabels, taskStatusLabels } from '@/shared/lib/labels';
import { Badge, type BadgeTone } from '@/shared/ui/badge';
import { Button } from '@/shared/ui/button';
import { Card } from '@/shared/ui/card';
import { EmptyState } from '@/shared/ui/empty-state';
import { Modal } from '@/shared/ui/modal';
import { PageHeader } from '@/shared/ui/page-header';
import { Select } from '@/shared/ui/field';

const columns: TaskStatus[] = ['Todo', 'In Progress', 'Review', 'Done'];
const boardFilters = ['All', 'Urgent', 'DueSoon', 'Review', 'LinkedDoc'] as const;
type BoardFilter = (typeof boardFilters)[number];
const boardFilterStorageKey = 'task-board-filter';
const priorityOptions: TaskPriority[] = ['Low', 'Medium', 'High', 'Urgent'];

function parseDueDate(value: string): Date {
  return new Date(`${value}T09:00:00`);
}

function daysFromToday(value: string, referenceDate: Date): number {
  const diff = startOfDay(parseDueDate(value)).getTime() - referenceDate.getTime();
  return Math.floor(diff / (24 * 60 * 60 * 1000));
}

function priorityTone(priority: Task['priority']): BadgeTone {
  if (priority === 'Urgent') {
    return 'danger';
  }

  if (priority === 'High') {
    return 'warning';
  }

  return 'neutral';
}

function dueSignal(task: Task, referenceDate: Date): { label: string; tone: BadgeTone } | null {
  const delta = daysFromToday(task.dueDate, referenceDate);

  if (delta < 0) {
    return { label: `${Math.abs(delta)}일 지연`, tone: 'danger' };
  }

  if (delta === 0) {
    return { label: '오늘 마감', tone: 'warning' };
  }

  if (delta <= 6) {
    return { label: '이번 주 마감', tone: 'info' };
  }

  return null;
}

function taskSignals(task: Task, referenceDate: Date): Array<{ label: string; tone: BadgeTone }> {
  const signals: Array<{ label: string; tone: BadgeTone }> = [];
  const due = dueSignal(task, referenceDate);

  if (due) {
    signals.push(due);
  }

  if (task.status === 'Review') {
    signals.push({ label: '리뷰 대기', tone: 'warning' });
  }

  if (!task.assigneeId) {
    signals.push({ label: '전달 대기', tone: 'warning' });
  }

  if (task.title.toLowerCase().includes('review') && task.status !== 'Review') {
    signals.push({ label: '검토 전 확인 필요', tone: 'warning' });
  }

  if (task.title.toLowerCase().includes('schedule') || task.description.toLowerCase().includes('schedule')) {
    signals.push({ label: '일정 확인 필요', tone: 'info' });
  }

  return signals;
}

function taskSortScore(task: Task, referenceDate: Date): number {
  const delta = daysFromToday(task.dueDate, referenceDate);
  let score = 0;

  if (task.status === 'Review') {
    score += 60;
  }

  if (!task.assigneeId) {
    score += 35;
  }

  if (task.priority === 'Urgent') {
    score += 40;
  } else if (task.priority === 'High') {
    score += 25;
  }

  if (delta < 0) {
    score += 50;
  } else if (delta === 0) {
    score += 35;
  } else if (delta <= 6) {
    score += 20;
  }

  if (task.title.toLowerCase().includes('schedule') || task.description.toLowerCase().includes('schedule')) {
    score += 10;
  }

  return score;
}

function nextStatusOptions(status: TaskStatus): TaskStatus[] {
  if (status === 'Todo') {
    return ['In Progress', 'Review'];
  }

  if (status === 'In Progress') {
    return ['Review', 'Done'];
  }

  if (status === 'Review') {
    return ['In Progress', 'Done'];
  }

  return ['Review'];
}

export function TaskBoardPage() {
  const { projectId } = useParams();
  const { createTask, deleteTask, documents, projects, tasks, updateTask, updateTaskStatus, users } = useLabStore();
  const [showModal, setShowModal] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | undefined>();
  const [taskToDelete, setTaskToDelete] = useState<Task | undefined>();
  const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>([]);
  const [boardFilter, setBoardFilter] = useState<BoardFilter>(() => {
    const savedFilter = window.localStorage.getItem(boardFilterStorageKey);
    if (savedFilter === 'All' || savedFilter === 'Urgent' || savedFilter === 'DueSoon' || savedFilter === 'Review' || savedFilter === 'LinkedDoc') {
      return savedFilter;
    }
    return 'All';
  });
  const [bulkAssigneeId, setBulkAssigneeId] = useState('');
  const [bulkDueDate, setBulkDueDate] = useState('2026-03-12');
  const [bulkDocumentId, setBulkDocumentId] = useState('');
  const [bulkPriority, setBulkPriority] = useState<TaskPriority>('Medium');
  const project = projects.find((item) => item.id === projectId);
  const referenceDate = startOfDay(new Date());

  const boardTasks = useMemo(() => tasks.filter((task) => task.projectId === projectId), [projectId, tasks]);
  const boardDocuments = documents.filter((document) => document.projectId === projectId);
  const members = users.filter((user) => project?.memberIds.includes(user.id));
  const visibleBoardTasks = useMemo(() => {
    if (boardFilter === 'Urgent') {
      return boardTasks.filter(
        (task) => task.priority === 'Urgent' || daysFromToday(task.dueDate, referenceDate) < 0,
      );
    }

    if (boardFilter === 'DueSoon') {
      return boardTasks.filter((task) => {
        const delta = daysFromToday(task.dueDate, referenceDate);
        return delta >= 0 && delta <= 6;
      });
    }

    if (boardFilter === 'Review') {
      return boardTasks.filter(
        (task) =>
          task.status === 'Review' ||
          task.title.toLowerCase().includes('review') ||
          task.description.toLowerCase().includes('review'),
      );
    }

    if (boardFilter === 'LinkedDoc') {
      return boardTasks.filter((task) => Boolean(task.documentId));
    }

    return boardTasks;
  }, [boardFilter, boardTasks, referenceDate]);

  useEffect(() => {
    setSelectedTaskIds((current) => current.filter((taskId) => boardTasks.some((task) => task.id === taskId)));
  }, [boardTasks]);

  useEffect(() => {
    setBulkAssigneeId(members[0]?.id ?? '');
  }, [members]);

  useEffect(() => {
    setBulkDueDate('2026-03-12');
  }, [projectId]);

  useEffect(() => {
    setBulkDocumentId(boardDocuments[0]?.id ?? '');
  }, [boardDocuments]);

  useEffect(() => {
    setBulkPriority('Medium');
  }, [projectId]);

  useEffect(() => {
    window.localStorage.setItem(boardFilterStorageKey, boardFilter);
  }, [boardFilter]);

  if (!project) {
    return <EmptyState title="작업 보드를 찾을 수 없습니다" description="요청한 프로젝트가 존재하지 않습니다." />;
  }

  function toggleTaskSelection(taskId: string) {
    setSelectedTaskIds((current) =>
      current.includes(taskId) ? current.filter((id) => id !== taskId) : [...current, taskId],
    );
  }

  function clearSelection() {
    setSelectedTaskIds([]);
  }

  function applyBulkStatus(status: TaskStatus) {
    selectedTaskIds.forEach((taskId) => updateTaskStatus(taskId, status));
    setSelectedTaskIds([]);
  }

  function applyBulkAssignee() {
    if (!bulkAssigneeId) {
      return;
    }

    selectedTaskIds.forEach((taskId) => {
      const task = boardTasks.find((item) => item.id === taskId);
      if (!task) {
        return;
      }

      updateTask(taskId, {
        projectId: task.projectId,
        title: task.title,
        description: task.description,
        status: task.status,
        priority: task.priority,
        assigneeId: bulkAssigneeId,
        dueDate: task.dueDate,
        documentId: task.documentId,
      });
    });
    setSelectedTaskIds([]);
  }

  function applyBulkDueDate() {
    if (!bulkDueDate) {
      return;
    }

    selectedTaskIds.forEach((taskId) => {
      const task = boardTasks.find((item) => item.id === taskId);
      if (!task) {
        return;
      }

      updateTask(taskId, {
        projectId: task.projectId,
        title: task.title,
        description: task.description,
        status: task.status,
        priority: task.priority,
        assigneeId: task.assigneeId,
        dueDate: bulkDueDate,
        documentId: task.documentId,
      });
    });
    setSelectedTaskIds([]);
  }

  function applyBulkDocument() {
    selectedTaskIds.forEach((taskId) => {
      const task = boardTasks.find((item) => item.id === taskId);
      if (!task) {
        return;
      }

      updateTask(taskId, {
        projectId: task.projectId,
        title: task.title,
        description: task.description,
        status: task.status,
        priority: task.priority,
        assigneeId: task.assigneeId,
        dueDate: task.dueDate,
        documentId: bulkDocumentId || undefined,
      });
    });
    setSelectedTaskIds([]);
  }

  function applyBulkPriority() {
    selectedTaskIds.forEach((taskId) => {
      const task = boardTasks.find((item) => item.id === taskId);
      if (!task) {
        return;
      }

      updateTask(taskId, {
        projectId: task.projectId,
        title: task.title,
        description: task.description,
        status: task.status,
        priority: bulkPriority,
        assigneeId: task.assigneeId,
        dueDate: task.dueDate,
        documentId: task.documentId,
      });
    });
    setSelectedTaskIds([]);
  }

  const spotlightTasks = [...boardTasks]
    .filter((task) => task.status !== 'Done')
    .sort((left, right) => {
      const scoreDiff = taskSortScore(right, referenceDate) - taskSortScore(left, referenceDate);
      if (scoreDiff !== 0) {
        return scoreDiff;
      }

      return parseDueDate(left.dueDate).getTime() - parseDueDate(right.dueDate).getTime();
    })
    .slice(0, 4);

  return (
    <div className="space-y-8">
      <PageHeader
        title="작업 보드"
        description="상태 이동, 리뷰 대기 확인, 문서 연결 확인을 한 번에 처리할 수 있도록 정리했습니다."
        actions={
          <Button
            onClick={() => {
              setEditingTask(undefined);
              setShowModal(true);
            }}
          >
            작업 생성
          </Button>
        }
      />

      {spotlightTasks.length > 0 ? (
        <Card className="border-slate-200/70 px-5 py-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">우선 작업</p>
              <p className="mt-1 text-sm text-slate-700">지연, 긴급, 리뷰 대기 작업을 먼저 보여줍니다.</p>
            </div>
            <span className="text-sm text-slate-400">상위 {spotlightTasks.length}개</span>
          </div>
          <div className="mt-4 grid gap-3 lg:grid-cols-4">
            {spotlightTasks.map((task) => {
              const due = dueSignal(task, referenceDate);
              return (
                <button
                  key={`spotlight-${task.id}`}
                  className="rounded-[18px] border border-slate-200/80 bg-slate-50/70 px-4 py-3 text-left transition hover:border-slate-300 hover:bg-white"
                  onClick={() => toggleTaskSelection(task.id)}
                  type="button"
                >
                  <div className="flex flex-wrap gap-2">
                    <Badge tone={priorityTone(task.priority)}>{taskPriorityLabels[task.priority]}</Badge>
                    {due ? <Badge tone={due.tone}>{due.label}</Badge> : null}
                  </div>
                  <p className="mt-3 text-sm font-semibold text-slate-900">{task.title}</p>
                  <p className="mt-1 text-xs text-slate-500">{taskStatusLabels[task.status]} / {formatDate(task.dueDate)}</p>
                </button>
              );
            })}
          </div>
        </Card>
      ) : null}

      {selectedTaskIds.length > 0 ? (
        <Card className="border-slate-200/70 px-5 py-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">일괄 작업</p>
              <p className="mt-1 text-sm text-slate-700">{selectedTaskIds.length}개 작업 선택됨</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {columns.map((status) => (
                <button
                  key={`bulk-${status}`}
                  className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                  onClick={() => applyBulkStatus(status)}
                  type="button"
                >
                  {taskStatusLabels[status]}로 일괄 이동
                </button>
              ))}
              <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-2 py-1.5">
                <Select
                  className="min-w-[120px] border-0 bg-transparent px-2 py-1 text-[11px] font-semibold focus:ring-0"
                  value={bulkAssigneeId}
                  onChange={(event) => setBulkAssigneeId(event.target.value)}
                >
                  {members.map((member) => (
                    <option key={member.id} value={member.id}>
                      {member.name}
                    </option>
                  ))}
                </Select>
                <button
                  className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-white"
                  onClick={applyBulkAssignee}
                  type="button"
                >
                  담당자 일괄 변경
                </button>
              </div>
              <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-2 py-1.5">
                <input
                  className="rounded-full border border-slate-200 bg-transparent px-3 py-1 text-[11px] font-semibold text-slate-700"
                  onChange={(event) => setBulkDueDate(event.target.value)}
                  type="date"
                  value={bulkDueDate}
                />
                <button
                  className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-white"
                  onClick={applyBulkDueDate}
                  type="button"
                >
                  마감일 일괄 변경
                </button>
              </div>
              <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-2 py-1.5">
                <Select
                  className="min-w-[140px] border-0 bg-transparent px-2 py-1 text-[11px] font-semibold focus:ring-0"
                  value={bulkDocumentId}
                  onChange={(event) => setBulkDocumentId(event.target.value)}
                >
                  <option value="">문서 연결 해제</option>
                  {boardDocuments.map((document) => (
                    <option key={document.id} value={document.id}>
                      {document.title}
                    </option>
                  ))}
                </Select>
                <button
                  className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-white"
                  onClick={applyBulkDocument}
                  type="button"
                >
                  문서 일괄 연결
                </button>
              </div>
              <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-2 py-1.5">
                <Select
                  className="min-w-[120px] border-0 bg-transparent px-2 py-1 text-[11px] font-semibold focus:ring-0"
                  value={bulkPriority}
                  onChange={(event) => setBulkPriority(event.target.value as TaskPriority)}
                >
                  {priorityOptions.map((priority) => (
                    <option key={priority} value={priority}>
                      {taskPriorityLabels[priority]}
                    </option>
                  ))}
                </Select>
                <button
                  className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-white"
                  onClick={applyBulkPriority}
                  type="button"
                >
                  우선순위 일괄 변경
                </button>
              </div>
              <Button variant="ghost" className="px-3 py-1.5 text-xs" onClick={clearSelection}>
                선택 해제
              </Button>
            </div>
          </div>
        </Card>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {boardFilters.map((filterKey) => (
          <button
            key={filterKey}
            className={
              boardFilter === filterKey
                ? 'rounded-full border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-900 shadow-[0_8px_18px_rgba(15,23,42,0.08)]'
                : 'rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-600 transition hover:border-slate-300 hover:bg-white hover:text-slate-900'
            }
            onClick={() => setBoardFilter(filterKey)}
            type="button"
          >
            {filterKey === 'All'
              ? '전체'
              : filterKey === 'Urgent'
                ? '긴급 / 지연'
                : filterKey === 'DueSoon'
                  ? '이번 주 마감'
                  : filterKey === 'Review'
                    ? '리뷰 관련'
                    : '문서 연결'}
          </button>
        ))}
        <span className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-2 text-sm text-slate-500">
          현재 {visibleBoardTasks.length}개 표시
        </span>
        <span className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-2 text-sm text-slate-500">
          보기 기준 {boardFilter === 'All'
            ? '전체 작업'
            : boardFilter === 'Urgent'
              ? '긴급 / 지연 작업'
              : boardFilter === 'DueSoon'
                ? '이번 주 마감 작업'
                : boardFilter === 'Review'
                  ? '리뷰 관련 작업'
                  : '문서 연결 작업'}
        </span>
      </div>

      <div className="flex flex-wrap gap-2">
        <Link
          className="inline-flex items-center justify-center rounded-[14px] border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
          to={`/projects/${project.id}`}
        >
          프로젝트 개요
        </Link>
        <Link
          className="inline-flex items-center justify-center rounded-[14px] border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
          to={`/projects/${project.id}/schedule`}
        >
          프로젝트 일정
        </Link>
        <Link
          className="inline-flex items-center justify-center rounded-[14px] border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
          to={`/projects/${project.id}/docs`}
        >
          프로젝트 문서
        </Link>
      </div>

      <div className="grid gap-4 xl:grid-cols-4">
        {columns.map((column) => {
          const columnTasks = [...visibleBoardTasks]
            .filter((task) => task.status === column)
            .sort((left, right) => {
              const scoreDiff = taskSortScore(right, referenceDate) - taskSortScore(left, referenceDate);
              if (scoreDiff !== 0) {
                return scoreDiff;
              }

              return parseDueDate(left.dueDate).getTime() - parseDueDate(right.dueDate).getTime();
            });
          const urgentCount = columnTasks.filter((task) => task.priority === 'Urgent' || daysFromToday(task.dueDate, referenceDate) < 0).length;
          const reviewCount = columnTasks.filter((task) => task.status === 'Review').length;

          return (
            <Card key={column} className="border-slate-200/70 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">컬럼</p>
                  <h2 className="mt-1 text-[18px] font-semibold tracking-[-0.02em] text-slate-950">
                    {taskStatusLabels[column]}
                  </h2>
                </div>
                <Badge tone="neutral">{columnTasks.length}</Badge>
              </div>

              {(urgentCount > 0 || reviewCount > 0) ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {urgentCount > 0 ? <Badge tone="warning">우선 확인 {urgentCount}</Badge> : null}
                  {reviewCount > 0 ? <Badge tone="info">리뷰 관련 {reviewCount}</Badge> : null}
                </div>
              ) : null}

              <div className="mt-4 space-y-3">
                {columnTasks.map((task) => {
                  const assignee = users.find((user) => user.id === task.assigneeId);
                  const linkedDoc = boardDocuments.find((document) => document.id === task.documentId);
                  const signals = taskSignals(task, referenceDate);
                  const needsScheduleAttention =
                    task.title.toLowerCase().includes('schedule') ||
                    task.description.toLowerCase().includes('schedule');

                  return (
                    <div key={task.id} className="rounded-[20px] border border-slate-200/80 bg-slate-50/75 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge tone={priorityTone(task.priority)}>{taskPriorityLabels[task.priority]}</Badge>
                          <Badge tone="info">{taskStatusLabels[task.status]}</Badge>
                          {signals.map((signal) => (
                            <Badge key={`${task.id}-${signal.label}`} tone={signal.tone}>
                              {signal.label}
                            </Badge>
                          ))}
                          {linkedDoc ? <Badge tone="neutral">문서 연결됨</Badge> : null}
                        </div>
                        <label className="flex items-center gap-2 text-xs text-slate-500">
                          <input
                            checked={selectedTaskIds.includes(task.id)}
                            className="h-4 w-4 rounded border-slate-300 text-accent-600"
                            onChange={() => toggleTaskSelection(task.id)}
                            type="checkbox"
                          />
                          선택
                        </label>
                      </div>

                      <h3 className="mt-3 text-[15px] font-semibold tracking-[-0.02em] text-slate-900">
                        {task.title}
                      </h3>
                      <div className="mt-2 space-y-1 text-xs text-slate-500">
                        <p>{assignee?.name ?? '담당자 미지정'}</p>
                        <p>마감 {formatDate(task.dueDate)}</p>
                      </div>

                      <div className="mt-4 flex flex-wrap gap-2">
                        {nextStatusOptions(task.status).map((status) => (
                          <button
                            key={`${task.id}-${status}`}
                            className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                            onClick={() => updateTaskStatus(task.id, status)}
                            type="button"
                          >
                            {taskStatusLabels[status]}로 이동
                          </button>
                        ))}
                      </div>

                      <div className="mt-4 flex flex-wrap gap-2">
                        {linkedDoc ? (
                          <Link
                            className="inline-flex items-center justify-center rounded-[14px] border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                            to={`/projects/${project.id}/docs/${linkedDoc.id}`}
                          >
                            문서 열기
                          </Link>
                        ) : null}
                        <Link
                          className="inline-flex items-center justify-center rounded-[14px] border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                          to={`/projects/${project.id}`}
                        >
                          프로젝트 열기
                        </Link>
                        {needsScheduleAttention ? (
                          <Link
                            className="inline-flex items-center justify-center rounded-[14px] border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                            to={`/projects/${project.id}/schedule`}
                          >
                            일정 확인
                          </Link>
                        ) : null}
                        <Button
                          variant="secondary"
                          className="px-3 py-1.5 text-xs"
                          onClick={() => {
                            setEditingTask(task);
                            setShowModal(true);
                          }}
                        >
                          수정
                        </Button>
                        <Button
                          variant="ghost"
                          className="px-3 py-1.5 text-xs text-rose-700 hover:bg-rose-50"
                          onClick={() => setTaskToDelete(task)}
                        >
                          삭제
                        </Button>
                      </div>
                    </div>
                  );
                })}

                {columnTasks.length === 0 ? (
                  <div className="rounded-[18px] border border-dashed border-slate-200 bg-slate-50/70 px-4 py-5 text-sm text-slate-500">
                    이 상태의 작업이 없습니다.
                  </div>
                ) : null}
              </div>
            </Card>
          );
        })}
      </div>

      <TaskFormModal
        open={showModal}
        projectId={project.id}
        users={members}
        documents={boardDocuments}
        initialValue={editingTask}
        onClose={() => setShowModal(false)}
        onSubmit={(payload) => {
          if (editingTask) {
            updateTask(editingTask.id, payload);
            return;
          }

          createTask(payload);
        }}
      />

      <Modal
        open={Boolean(taskToDelete)}
        onClose={() => setTaskToDelete(undefined)}
        title="작업 삭제"
        description="보드에서 빠르게 움직이는 중 실수 삭제를 막기 위해 한 번 더 확인합니다."
        footer={
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setTaskToDelete(undefined)}>
              취소
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                if (!taskToDelete) {
                  return;
                }

                deleteTask(taskToDelete.id);
                setTaskToDelete(undefined);
              }}
            >
              삭제
            </Button>
          </div>
        }
      >
        <div className="space-y-3 text-sm text-slate-600">
          <p>
            <span className="font-semibold text-slate-900">{taskToDelete?.title}</span> 작업을 삭제합니다.
          </p>
          <p>연결된 문서 참조도 함께 해제될 수 있으니, 계속 진행할지 확인하세요.</p>
        </div>
      </Modal>
    </div>
  );
}
