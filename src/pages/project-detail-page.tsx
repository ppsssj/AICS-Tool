import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useLabStore } from '@/app/store/use-lab-store';
import type { ProjectStatus } from '@/entities/models';
import { ScheduleFormModal } from '@/features/calendar/schedule-form-modal';
import { DocumentFormModal } from '@/features/documents/document-form-modal';
import { TaskFormModal } from '@/features/tasks/task-form-modal';
import { compareWeekday, formatDateTime } from '@/shared/lib/date';
import { Badge } from '@/shared/ui/badge';
import { Button } from '@/shared/ui/button';
import { Card } from '@/shared/ui/card';
import { EmptyState } from '@/shared/ui/empty-state';
import { PageHeader } from '@/shared/ui/page-header';

type ProjectTab = 'Overview' | 'Docs' | 'Tasks' | 'Schedule' | 'Members';
const tabs: ProjectTab[] = ['Overview', 'Docs', 'Tasks', 'Schedule', 'Members'];

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
    return <EmptyState title="Project not found" description="The requested project does not exist in the mock workspace." />;
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title={project.title}
        description={project.description}
        actions={
          <>
            <Button variant="secondary" onClick={() => setShowDocumentModal(true)}>Create document</Button>
            <Button variant="secondary" onClick={() => setShowTaskModal(true)}>Create task</Button>
            <Button onClick={() => setShowScheduleModal(true)}>Create schedule</Button>
          </>
        }
      />

      <div className="flex flex-wrap gap-2">
        {tabs.map((tab) => (
          <Button key={tab} variant={activeTab === tab ? 'primary' : 'secondary'} onClick={() => setActiveTab(tab)}>
            {tab}
          </Button>
        ))}
      </div>

      {activeTab === 'Overview' ? (
        <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
          <div className="grid gap-4 md:grid-cols-3">
            <Card className="border-slate-200/70"><p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Documents</p><p className="mt-3 text-[34px] font-semibold tracking-[-0.05em] text-slate-950">{projectDocuments.length}</p></Card>
            <Card className="border-slate-200/70"><p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Tasks</p><p className="mt-3 text-[34px] font-semibold tracking-[-0.05em] text-slate-950">{projectTasks.length}</p></Card>
            <Card className="border-slate-200/70"><p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Members</p><p className="mt-3 text-[34px] font-semibold tracking-[-0.05em] text-slate-950">{members.length}</p></Card>
          </div>
          <Card className="border-slate-200/70">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Project hub</p>
                <h2 className="mt-2 text-[24px] font-semibold tracking-[-0.03em] text-slate-950">Operational summary</h2>
              </div>
              <Badge tone={statusTone(project.status)}>{project.status}</Badge>
            </div>
            <p className="mt-4 text-[15px] leading-7 text-slate-500">
              This page is the main working surface for the project. Documents, task execution, schedules, and team context stay close enough to act on without feeling crowded.
            </p>
            <div className="mt-5 rounded-[22px] border border-slate-200/80 bg-slate-50/75 p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Latest activity</p>
              <p className="mt-2 text-sm text-slate-500">Project metadata updated {formatDateTime(project.updatedAt)}</p>
            </div>
          </Card>
        </div>
      ) : null}

      {activeTab === 'Docs' ? (
        <Card className="border-slate-200/70">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Knowledge</p>
              <h2 className="mt-2 text-[24px] font-semibold tracking-[-0.03em] text-slate-950">Project documents</h2>
            </div>
            <Button onClick={() => setShowDocumentModal(true)}>Create document</Button>
          </div>
          <div className="mt-5 grid gap-4">
            {projectDocuments.map((document) => (
              <Link
                key={document.id}
                className="rounded-[22px] border border-slate-200/80 bg-slate-50/70 p-4 transition hover:border-slate-300 hover:bg-white"
                to={`/projects/${project.id}/docs/${document.id}`}
              >
                <p className="text-[16px] font-semibold tracking-[-0.02em] text-slate-900">{document.title}</p>
                <p className="mt-2 text-sm text-slate-500">{document.tags.join(' · ')}</p>
              </Link>
            ))}
          </div>
        </Card>
      ) : null}

      {activeTab === 'Tasks' ? (
        <Card className="border-slate-200/70">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Execution</p>
              <h2 className="mt-2 text-[24px] font-semibold tracking-[-0.03em] text-slate-950">Task summary</h2>
            </div>
            <Link className="text-sm font-semibold text-accent-700" to={`/projects/${project.id}/tasks`}>Open board</Link>
          </div>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            {projectTasks.map((task) => {
              const assignee = users.find((user) => user.id === task.assigneeId);
              return (
                <div key={task.id} className="rounded-[22px] border border-slate-200/80 bg-slate-50/70 p-4">
                  <div className="flex items-center gap-2">
                    <Badge tone="info">{task.status}</Badge>
                    <Badge tone={task.priority === 'Urgent' ? 'danger' : task.priority === 'High' ? 'warning' : 'neutral'}>{task.priority}</Badge>
                  </div>
                  <p className="mt-3 text-[16px] font-semibold tracking-[-0.02em] text-slate-900">{task.title}</p>
                  <p className="mt-1 text-sm text-slate-500">{assignee?.name ?? 'Unassigned'}</p>
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
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Coordination</p>
              <h2 className="mt-2 text-[24px] font-semibold tracking-[-0.03em] text-slate-950">Project schedule</h2>
            </div>
            <Button onClick={() => setShowScheduleModal(true)}>Create schedule</Button>
          </div>
          <div className="mt-5 space-y-3">
            {projectSchedules.map((schedule) => (
              <div key={schedule.id} className="rounded-[22px] border border-slate-200/80 bg-slate-50/70 p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-[15px] font-semibold tracking-[-0.02em] text-slate-900">{schedule.title}</p>
                  <Badge tone="info">{schedule.type}</Badge>
                </div>
                <p className="mt-2 text-sm text-slate-500">
                  {schedule.day} · {schedule.startTime} - {schedule.endTime}
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
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Team</p>
            <h2 className="mt-2 text-[24px] font-semibold tracking-[-0.03em] text-slate-950">Members</h2>
          </div>
          <div className="mt-5 grid gap-3 md:grid-cols-2">
            {members.map((member) => (
              <div key={member.id} className="rounded-[22px] border border-slate-200/80 bg-slate-50/70 p-4">
                <p className="text-[16px] font-semibold tracking-[-0.02em] text-slate-900">{member.name}</p>
                <p className="mt-1 text-sm text-slate-500">{member.title}</p>
                <p className="mt-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">{member.role}</p>
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
