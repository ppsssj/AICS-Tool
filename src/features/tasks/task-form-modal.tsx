import { useEffect, useState } from 'react';
import type { Document, Task, TaskPriority, TaskStatus, User } from '@/entities/models';
import { taskPriorityLabels, taskStatusLabels } from '@/shared/lib/labels';
import { Button } from '@/shared/ui/button';
import { Field, Input, Select, Textarea } from '@/shared/ui/field';
import { Modal } from '@/shared/ui/modal';

interface TaskFormModalProps {
  open: boolean;
  projectId: string;
  users: User[];
  documents: Document[];
  initialValue?: Task;
  onClose: () => void;
  onSubmit: (payload: { projectId: string; title: string; description: string; status: TaskStatus; priority: TaskPriority; assigneeId: string; dueDate: string; documentId?: string }) => void;
}

const statuses: TaskStatus[] = ['Todo', 'In Progress', 'Review', 'Done'];
const priorities: TaskPriority[] = ['Low', 'Medium', 'High', 'Urgent'];

export function TaskFormModal({ open, projectId, users, documents, initialValue, onClose, onSubmit }: TaskFormModalProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<TaskStatus>('Todo');
  const [priority, setPriority] = useState<TaskPriority>('Medium');
  const [assigneeId, setAssigneeId] = useState(users[0]?.id ?? '');
  const [dueDate, setDueDate] = useState('2026-03-12');
  const [documentId, setDocumentId] = useState('');

  useEffect(() => {
    if (initialValue) {
      setTitle(initialValue.title);
      setDescription(initialValue.description);
      setStatus(initialValue.status);
      setPriority(initialValue.priority);
      setAssigneeId(initialValue.assigneeId);
      setDueDate(initialValue.dueDate);
      setDocumentId(initialValue.documentId ?? '');
      return;
    }

    setTitle('');
    setDescription('');
    setStatus('Todo');
    setPriority('Medium');
    setAssigneeId(users[0]?.id ?? '');
    setDueDate('2026-03-12');
    setDocumentId('');
  }, [initialValue, open, users]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={initialValue ? '작업 수정' : '작업 생성'}
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={onClose}>취소</Button>
          <Button
            onClick={() => {
              onSubmit({ projectId, title, description, status, priority, assigneeId, dueDate, documentId: documentId || undefined });
              onClose();
            }}
          >
            {initialValue ? '작업 저장' : '작업 생성'}
          </Button>
        </div>
      }
    >
      <div className="grid gap-4">
        <Field label="작업 제목">
          <Input value={title} onChange={(event) => setTitle(event.target.value)} />
        </Field>
        <Field label="설명">
          <Textarea value={description} onChange={(event) => setDescription(event.target.value)} />
        </Field>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="상태">
            <Select value={status} onChange={(event) => setStatus(event.target.value as TaskStatus)}>
              {statuses.map((item) => <option key={item} value={item}>{taskStatusLabels[item]}</option>)}
            </Select>
          </Field>
          <Field label="우선순위">
            <Select value={priority} onChange={(event) => setPriority(event.target.value as TaskPriority)}>
              {priorities.map((item) => <option key={item} value={item}>{taskPriorityLabels[item]}</option>)}
            </Select>
          </Field>
          <Field label="담당자">
            <Select value={assigneeId} onChange={(event) => setAssigneeId(event.target.value)}>
              {users.map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}
            </Select>
          </Field>
          <Field label="마감일">
            <Input value={dueDate} onChange={(event) => setDueDate(event.target.value)} type="date" />
          </Field>
        </div>
        <Field label="연결 문서">
          <Select value={documentId} onChange={(event) => setDocumentId(event.target.value)}>
            <option value="">연결 문서 없음</option>
            {documents.map((document) => <option key={document.id} value={document.id}>{document.title}</option>)}
          </Select>
        </Field>
      </div>
    </Modal>
  );
}
