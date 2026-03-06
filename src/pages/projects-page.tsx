import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useLabStore } from '@/app/store/use-lab-store';
import type { Project } from '@/entities/models';
import { ProjectFormModal } from '@/features/projects/project-form-modal';
import { formatShortDate } from '@/shared/lib/date';
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
        title="Projects"
        description="Each project is a quiet operational hub for documents, execution, schedules, and member context. The visual hierarchy here prioritizes clarity over dashboard repetition."
        actions={<Button onClick={handleOpenCreate}>Create project</Button>}
      />

      <div className="grid gap-5 xl:grid-cols-2">
        {projects.map((project) => (
          <Card key={project.id} className="group flex flex-col gap-6 border-slate-200/70 p-0 overflow-hidden">
            <div className="border-b border-slate-200/80 bg-slate-50/70 px-6 py-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={project.status === 'Active' ? 'success' : project.status === 'Planning' ? 'warning' : 'neutral'}>
                    {project.status}
                  </Badge>
                  <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                    Updated {formatShortDate(project.updatedAt)}
                  </span>
                </div>
                <span className="text-xs text-slate-400">{project.memberIds.length} members</span>
              </div>
            </div>

            <div className="px-6">
              <h2 className="text-[24px] font-semibold tracking-[-0.03em] text-slate-950">{project.title}</h2>
              <p className="mt-3 max-w-2xl text-[15px] leading-7 text-slate-500">{project.description}</p>
            </div>

            <div className="grid gap-4 px-6 md:grid-cols-[0.85fr_1.15fr]">
              <div className="rounded-[22px] border border-slate-200/80 bg-slate-50/70 p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Team footprint</p>
                <p className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-slate-950">{project.memberIds.length}</p>
                <p className="mt-2 text-sm leading-6 text-slate-500">Researchers currently included in this workspace.</p>
              </div>
              <div className="rounded-[22px] border border-slate-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.92),rgba(244,247,255,0.92))] p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Workspace access</p>
                <Link
                  className="mt-3 inline-flex items-center gap-2 text-[15px] font-semibold tracking-[-0.01em] text-accent-700 transition group-hover:text-accent-600"
                  to={`/projects/${project.id}`}
                >
                  Open workspace
                  <span aria-hidden="true">→</span>
                </Link>
                <p className="mt-2 text-sm leading-6 text-slate-500">Jump directly into docs, task flow, schedules, and membership context.</p>
              </div>
            </div>

            <div className="flex flex-wrap justify-between gap-3 border-t border-slate-200/80 px-6 py-5">
              <div className="text-sm text-slate-500">Project hub ready for day-to-day coordination.</div>
              <div className="flex flex-wrap gap-3">
                <Button variant="secondary" onClick={() => handleOpenEdit(project)}>
                  Edit
                </Button>
                <Button variant="ghost" onClick={() => deleteProject(project.id)}>
                  Delete
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
