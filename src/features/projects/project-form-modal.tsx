import { useEffect, useState } from 'react';
import type { Project, ProjectStatus } from '@/entities/models';
import { projectStatusLabels } from '@/shared/lib/labels';
import { Button } from '@/shared/ui/button';
import { Field, Input, Select, Textarea } from '@/shared/ui/field';
import { Modal } from '@/shared/ui/modal';

interface ProjectFormModalProps {
  open: boolean;
  users: Array<{ id: string; name: string }>;
  initialValue?: Project;
  onClose: () => void;
  onSubmit: (payload: { title: string; description: string; status: ProjectStatus; memberIds: string[] }) => void;
}

const statuses: ProjectStatus[] = ['Planning', 'Active', 'Done', 'Archived'];

export function ProjectFormModal({ open, users, initialValue, onClose, onSubmit }: ProjectFormModalProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<ProjectStatus>('Planning');
  const [memberIds, setMemberIds] = useState<string[]>([]);

  useEffect(() => {
    if (initialValue) {
      setTitle(initialValue.title);
      setDescription(initialValue.description);
      setStatus(initialValue.status);
      setMemberIds(initialValue.memberIds);
      return;
    }

    setTitle('');
    setDescription('');
    setStatus('Planning');
    setMemberIds([]);
  }, [initialValue, open]);

  function toggleMember(memberId: string) {
    setMemberIds((current) => (current.includes(memberId) ? current.filter((id) => id !== memberId) : [...current, memberId]));
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={initialValue ? '프로젝트 수정' : '프로젝트 생성'}
      description="프로젝트 설정은 가볍게 유지하고, 빠르게 연구 워크플로우를 시작할 수 있도록 구성합니다."
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={onClose}>취소</Button>
          <Button onClick={() => { onSubmit({ title, description, status, memberIds }); onClose(); }}>
            {initialValue ? '변경 저장' : '프로젝트 생성'}
          </Button>
        </div>
      }
    >
      <div className="grid gap-4">
        <Field label="프로젝트 제목">
          <Input value={title} onChange={(event) => setTitle(event.target.value)} />
        </Field>
        <Field label="설명">
          <Textarea value={description} onChange={(event) => setDescription(event.target.value)} />
        </Field>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="상태">
            <Select value={status} onChange={(event) => setStatus(event.target.value as ProjectStatus)}>
              {statuses.map((item) => <option key={item} value={item}>{projectStatusLabels[item]}</option>)}
            </Select>
          </Field>
          <Field label="구성원" hint="이 프로젝트를 워크스페이스에서 확인해야 하는 연구원을 선택하세요.">
            <div className="grid gap-2 rounded-2xl border border-slate-200 p-3">
              {users.map((user) => (
                <label className="flex items-center gap-2 text-sm text-slate-700" key={user.id}>
                  <input checked={memberIds.includes(user.id)} onChange={() => toggleMember(user.id)} type="checkbox" />
                  {user.name}
                </label>
              ))}
            </div>
          </Field>
        </div>
      </div>
    </Modal>
  );
}
