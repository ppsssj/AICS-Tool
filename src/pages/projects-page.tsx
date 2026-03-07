import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useLabStore } from '@/app/store/use-lab-store';
import type { Project } from '@/entities/models';
import { ProjectFormModal } from '@/features/projects/project-form-modal';
import { formatShortDate } from '@/shared/lib/date';
import { projectStatusLabels } from '@/shared/lib/labels';
import { Badge } from '@/shared/ui/badge';
import { Button } from '@/shared/ui/button';
import { Card } from '@/shared/ui/card';
import { PageHeader } from '@/shared/ui/page-header';

export function ProjectsPage() {
  const { createProject, deleteProject, projects, updateProject, users } = useLabStore();
  const [open, setOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | undefined>();

  function handleOpenCreate() {
    setEditingProject(undefined);
    setOpen(true);
  }

  function handleOpenEdit(project: Project) {
    setEditingProject(project);
    setOpen(true);
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="프로젝트"
        description="각 프로젝트는 문서, 실행, 일정, 멤버 맥락을 묶는 운영 허브입니다. 대시보드 반복보다 프로젝트 실행 흐름이 먼저 보이도록 구성했습니다."
        actions={<Button onClick={handleOpenCreate}>프로젝트 생성</Button>}
      />

      <div className="grid gap-5 xl:grid-cols-2">
        {projects.map((project) => (
          <Card key={project.id} className="group flex flex-col gap-6 overflow-hidden border-slate-200/70 p-0">
            <div className="border-b border-slate-200/80 bg-slate-50/70 px-6 py-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={project.status === 'Active' ? 'success' : project.status === 'Planning' ? 'warning' : 'neutral'}>
                    {projectStatusLabels[project.status]}
                  </Badge>
                  <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                    업데이트 {formatShortDate(project.updatedAt)}
                  </span>
                </div>
                <span className="text-xs text-slate-400">구성원 {project.memberIds.length}명</span>
              </div>
            </div>

            <div className="px-6">
              <h2 className="text-[24px] font-semibold tracking-[-0.03em] text-slate-950">{project.title}</h2>
              <p className="mt-3 max-w-2xl text-[15px] leading-7 text-slate-500">{project.description}</p>
            </div>

            <div className="grid gap-4 px-6 md:grid-cols-[0.85fr_1.15fr]">
              <div className="rounded-[22px] border border-slate-200/80 bg-slate-50/70 p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">팀 규모</p>
                <p className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-slate-950">{project.memberIds.length}</p>
                <p className="mt-2 text-sm leading-6 text-slate-500">현재 이 워크스페이스에 포함된 연구 인원입니다.</p>
              </div>
              <div className="rounded-[22px] border border-slate-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.92),rgba(244,247,255,0.92))] p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">워크스페이스 이동</p>
                <Link
                  className="mt-3 inline-flex items-center gap-2 text-[15px] font-semibold tracking-[-0.01em] text-accent-700 transition group-hover:text-accent-600"
                  to={`/projects/${project.id}`}
                >
                  워크스페이스 열기
                  <span aria-hidden="true">{'>'}</span>
                </Link>
                <p className="mt-2 text-sm leading-6 text-slate-500">문서, 작업 흐름, 일정, 멤버 정보를 바로 확인할 수 있습니다.</p>
              </div>
            </div>

            <div className="flex flex-wrap justify-between gap-3 border-t border-slate-200/80 px-6 py-5">
              <div className="text-sm text-slate-500">일상적인 프로젝트 운영에 바로 사용할 수 있습니다.</div>
              <div className="flex flex-wrap gap-3">
                <Button variant="secondary" onClick={() => handleOpenEdit(project)}>
                  수정
                </Button>
                <Button variant="ghost" onClick={() => deleteProject(project.id)}>
                  삭제
                </Button>
              </div>
            </div>
          </Card>
        ))}
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
    </div>
  );
}
