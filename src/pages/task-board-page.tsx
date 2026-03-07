import { useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useLabStore } from '@/app/store/use-lab-store';
import type { Task, TaskStatus } from '@/entities/models';
import { TaskFormModal } from '@/features/tasks/task-form-modal';
import { formatDate } from '@/shared/lib/date';
import { taskPriorityLabels, taskStatusLabels } from '@/shared/lib/labels';
import { Badge } from '@/shared/ui/badge';
import { Button } from '@/shared/ui/button';
import { Card } from '@/shared/ui/card';
import { EmptyState } from '@/shared/ui/empty-state';
import { Select } from '@/shared/ui/field';
import { PageHeader } from '@/shared/ui/page-header';

const columns: TaskStatus[] = ['Todo', 'In Progress', 'Review', 'Done'];

export function TaskBoardPage() {
  const { projectId } = useParams();
  const { createTask, deleteTask, documents, projects, tasks, updateTask, updateTaskStatus, users } = useLabStore();
  const [showModal, setShowModal] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | undefined>();
  const project = projects.find((item) => item.id === projectId);

  const boardTasks = useMemo(() => tasks.filter((task) => task.projectId === projectId), [projectId, tasks]);
  const boardDocuments = documents.filter((document) => document.projectId === projectId);
  const members = users.filter((user) => project?.memberIds.includes(user.id));

  if (!project) {
    return <EmptyState title="작업 보드를 찾을 수 없습니다" description="요청한 프로젝트가 존재하지 않습니다." />;
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title={`${project.title} 작업 보드`}
        description="칸반 보드는 가볍게 유지하되, 상태와 마감일, 연결 문서가 한눈에 들어오도록 정리했습니다."
        actions={<Button onClick={() => { setEditingTask(undefined); setShowModal(true); }}>작업 생성</Button>}
      />
      <div className="grid gap-4 xl:grid-cols-4">
        {columns.map((column) => (
          <Card key={column} className="border-slate-200/70 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">컬럼</p>
                <h2 className="mt-1 text-[18px] font-semibold tracking-[-0.02em] text-slate-950">{taskStatusLabels[column]}</h2>
              </div>
              <Badge tone="neutral">{boardTasks.filter((task) => task.status === column).length}</Badge>
            </div>
            <div className="mt-4 space-y-3">
              {boardTasks.filter((task) => task.status === column).map((task) => {
                const assignee = users.find((user) => user.id === task.assigneeId);
                return (
                  <div key={task.id} className="rounded-[20px] border border-slate-200/80 bg-slate-50/75 p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone={task.priority === 'Urgent' ? 'danger' : task.priority === 'High' ? 'warning' : 'neutral'}>{taskPriorityLabels[task.priority]}</Badge>
                      {task.documentId ? <Badge tone="info">연결 문서</Badge> : null}
                    </div>
                    <h3 className="mt-3 text-[15px] font-semibold tracking-[-0.02em] text-slate-900">{task.title}</h3>
                    <p className="mt-2 text-xs text-slate-500">{assignee?.name ?? '미배정'}</p>
                    <p className="mt-1 text-xs text-slate-500">마감 {formatDate(task.dueDate)}</p>
                    <div className="mt-3">
                      <Select value={task.status} onChange={(event) => updateTaskStatus(task.id, event.target.value as TaskStatus)}>
                        {columns.map((status) => (
                          <option key={status} value={status}>{taskStatusLabels[status]}</option>
                        ))}
                      </Select>
                    </div>
                    <div className="mt-3 flex gap-2">
                      <Button variant="secondary" className="flex-1" onClick={() => { setEditingTask(task); setShowModal(true); }}>수정</Button>
                      <Button variant="ghost" className="flex-1" onClick={() => deleteTask(task.id)}>삭제</Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        ))}
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
    </div>
  );
}
