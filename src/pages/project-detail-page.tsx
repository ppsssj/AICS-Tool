import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useLabStore } from '@/app/store/use-lab-store';
import type { ProjectStatus } from '@/entities/models';
import { ScheduleFormModal } from '@/features/calendar/schedule-form-modal';
import { DocumentFormModal } from '@/features/documents/document-form-modal';
import { TaskFormModal } from '@/features/tasks/task-form-modal';
import { compareWeekday, formatDateTime } from '@/shared/lib/date';
import {
  projectStatusLabels,
  roleLabels,
  scheduleTypeLabels,
  taskPriorityLabels,
  taskStatusLabels,
  weekdayLabels,
} from '@/shared/lib/labels';
import { Badge } from '@/shared/ui/badge';
import { Button } from '@/shared/ui/button';
import { Card } from '@/shared/ui/card';
import { EmptyState } from '@/shared/ui/empty-state';
import { PageHeader } from '@/shared/ui/page-header';

type ProjectTab = 'Overview' | 'Docs' | 'Tasks' | 'Schedule' | 'Members';
const tabs: Array<{ key: ProjectTab; label: string }> = [
  { key: 'Overview', label: '개요' },
  { key: 'Docs', label: '문서' },
  { key: 'Tasks', label: '작업' },
  { key: 'Schedule', label: '일정' },
  { key: 'Members', label: '멤버' },
];

function statusTone(status: ProjectStatus): 'success' | 'warning' | 'neutral' {
  if (status === 'Active') return 'success';
  if (status === 'Planning') return 'warning';
  return 'neutral';
}

export function ProjectDetailPage() {
  const { projectId } = useParams();
  const { createDocument, createSchedule, createTask, currentUserId, documents, projects, schedules, tasks, users } = useLabStore();
  const [activeTab, setActiveTab] = useState<ProjectTab>('Overview');
  const [showDocumentModal, setShowDocumentModal] = useState(false);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false);

  const project = projects.find((item) => item.id === projectId);
  const projectDocuments = documents.filter((document) => document.projectId === projectId);
  const projectTasks = tasks.filter((task) => task.projectId === projectId);
  const projectSchedules = useMemo(
    () => schedules.filter((schedule) => schedule.projectId === projectId).sort((a, b) => compareWeekday(a.day, b.day)),
    [projectId, schedules],
  );
  const members = users.filter((user) => project?.memberIds.includes(user.id));

  if (!project) {
    return <EmptyState title="프로젝트를 찾을 수 없습니다" description="요청한 프로젝트가 현재 워크스페이스에 존재하지 않습니다." />;
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title={project.title}
        description={project.description}
        actions={
          <>
            <Button variant="secondary" onClick={() => setShowDocumentModal(true)}>문서 생성</Button>
            <Button variant="secondary" onClick={() => setShowTaskModal(true)}>작업 생성</Button>
            <Button onClick={() => setShowScheduleModal(true)}>일정 생성</Button>
          </>
        }
      />

      <div className="flex flex-wrap gap-2">
        {tabs.map((tab) => (
          <Button key={tab.key} variant={activeTab === tab.key ? 'primary' : 'secondary'} onClick={() => setActiveTab(tab.key)}>
            {tab.label}
          </Button>
        ))}
      </div>

      {activeTab === 'Overview' ? (
        <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
          <div className="grid gap-4 md:grid-cols-3">
            <Card className="border-slate-200/70"><p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">문서</p><p className="mt-3 text-[34px] font-semibold tracking-[-0.05em] text-slate-950">{projectDocuments.length}</p></Card>
            <Card className="border-slate-200/70"><p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">작업</p><p className="mt-3 text-[34px] font-semibold tracking-[-0.05em] text-slate-950">{projectTasks.length}</p></Card>
            <Card className="border-slate-200/70"><p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">멤버</p><p className="mt-3 text-[34px] font-semibold tracking-[-0.05em] text-slate-950">{members.length}</p></Card>
          </div>
          <Card className="border-slate-200/70">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">프로젝트 허브</p>
                <h2 className="mt-2 text-[24px] font-semibold tracking-[-0.03em] text-slate-950">운영 요약</h2>
              </div>
              <Badge tone={statusTone(project.status)}>{projectStatusLabels[project.status]}</Badge>
            </div>
            <p className="mt-4 text-[15px] leading-7 text-slate-500">
              이 페이지는 프로젝트의 주요 작업 화면입니다. 문서, 작업 실행, 일정, 팀 정보를 한곳에서 바로 다룰 수 있습니다.
            </p>
            <div className="mt-5 rounded-[22px] border border-slate-200/80 bg-slate-50/75 p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">최근 활동</p>
              <p className="mt-2 text-sm text-slate-500">프로젝트 메타데이터 수정 {formatDateTime(project.updatedAt)}</p>
            </div>
          </Card>
        </div>
      ) : null}

      {activeTab === 'Docs' ? (
        <Card className="border-slate-200/70">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">문서 자산</p>
              <h2 className="mt-2 text-[24px] font-semibold tracking-[-0.03em] text-slate-950">프로젝트 문서</h2>
            </div>
            <Button onClick={() => setShowDocumentModal(true)}>문서 생성</Button>
          </div>
          <div className="mt-5 grid gap-4">
            {projectDocuments.map((document) => (
              <Link
                key={document.id}
                className="rounded-[22px] border border-slate-200/80 bg-slate-50/70 p-4 transition hover:border-slate-300 hover:bg-white"
                to={`/projects/${project.id}/docs/${document.id}`}
              >
                <p className="text-[16px] font-semibold tracking-[-0.02em] text-slate-900">{document.title}</p>
                <p className="mt-2 text-sm text-slate-500">{document.tags.join(' / ')}</p>
              </Link>
            ))}
          </div>
        </Card>
      ) : null}

      {activeTab === 'Tasks' ? (
        <Card className="border-slate-200/70">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">실행</p>
              <h2 className="mt-2 text-[24px] font-semibold tracking-[-0.03em] text-slate-950">작업 요약</h2>
            </div>
            <Link className="text-sm font-semibold text-accent-700" to={`/projects/${project.id}/tasks`}>보드 열기</Link>
          </div>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            {projectTasks.map((task) => {
              const assignee = users.find((user) => user.id === task.assigneeId);
              return (
                <div key={task.id} className="rounded-[22px] border border-slate-200/80 bg-slate-50/70 p-4">
                  <div className="flex items-center gap-2">
                    <Badge tone="info">{taskStatusLabels[task.status]}</Badge>
                    <Badge tone={task.priority === 'Urgent' ? 'danger' : task.priority === 'High' ? 'warning' : 'neutral'}>{taskPriorityLabels[task.priority]}</Badge>
                  </div>
                  <p className="mt-3 text-[16px] font-semibold tracking-[-0.02em] text-slate-900">{task.title}</p>
                  <p className="mt-1 text-sm text-slate-500">{assignee?.name ?? '미배정'}</p>
                </div>
              );
            })}
          </div>
        </Card>
      ) : null}

      {activeTab === 'Schedule' ? (
        <Card className="border-slate-200/70">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">조정</p>
              <h2 className="mt-2 text-[24px] font-semibold tracking-[-0.03em] text-slate-950">프로젝트 일정</h2>
            </div>
            <Button onClick={() => setShowScheduleModal(true)}>일정 생성</Button>
          </div>
          <div className="mt-5 space-y-3">
            {projectSchedules.map((schedule) => (
              <div key={schedule.id} className="rounded-[22px] border border-slate-200/80 bg-slate-50/70 p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-[15px] font-semibold tracking-[-0.02em] text-slate-900">{schedule.title}</p>
                  <Badge tone="info">{scheduleTypeLabels[schedule.type]}</Badge>
                </div>
                <p className="mt-2 text-sm text-slate-500">
                  {weekdayLabels[schedule.day]} / {schedule.startTime} - {schedule.endTime}
                </p>
                <p className="mt-1 text-sm text-slate-500">{schedule.location}</p>
              </div>
            ))}
          </div>
        </Card>
      ) : null}

      {activeTab === 'Members' ? (
        <Card className="border-slate-200/70">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">팀</p>
            <h2 className="mt-2 text-[24px] font-semibold tracking-[-0.03em] text-slate-950">멤버</h2>
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
      ) : null}

      {currentUserId ? (
        <>
          <DocumentFormModal open={showDocumentModal} projectId={project.id} tasks={projectTasks} authorId={currentUserId} onClose={() => setShowDocumentModal(false)} onSubmit={createDocument} />
          <TaskFormModal open={showTaskModal} projectId={project.id} users={members} documents={projectDocuments} onClose={() => setShowTaskModal(false)} onSubmit={createTask} />
          <ScheduleFormModal open={showScheduleModal} projects={[project]} initialType="Project" onClose={() => setShowScheduleModal(false)} onSubmit={createSchedule} />
        </>
      ) : null}
    </div>
  );
}
