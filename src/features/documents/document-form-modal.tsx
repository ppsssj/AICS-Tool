import { useEffect, useState } from 'react';
import type { Document, Task } from '@/entities/models';
import { Button } from '@/shared/ui/button';
import { Field, Input, Textarea } from '@/shared/ui/field';
import { Modal } from '@/shared/ui/modal';

interface DocumentFormModalProps {
  open: boolean;
  projectId: string;
  tasks: Task[];
  authorId: string;
  initialValue?: Document;
  onClose: () => void;
  onSubmit: (payload: { projectId: string; title: string; body: string; tags: string[]; authorId: string; relatedTaskIds: string[] }) => void;
}

export function DocumentFormModal({ open, projectId, tasks, authorId, initialValue, onClose, onSubmit }: DocumentFormModalProps) {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  const [relatedTaskIds, setRelatedTaskIds] = useState<string[]>([]);

  useEffect(() => {
    if (initialValue) {
      setTitle(initialValue.title);
      setBody(initialValue.body);
      setTagsInput(initialValue.tags.join(', '));
      setRelatedTaskIds(initialValue.relatedTaskIds);
      return;
    }

    setTitle('');
    setBody('');
    setTagsInput('');
    setRelatedTaskIds([]);
  }, [initialValue, open]);

  function toggleTask(taskId: string) {
    setRelatedTaskIds((current) => (current.includes(taskId) ? current.filter((id) => id !== taskId) : [...current, taskId]));
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={initialValue ? 'Edit document' : 'Create document'}
      description="Use simple structured text for now. This shape is ready to swap to a richer editor later."
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button
            onClick={() => {
              onSubmit({
                projectId,
                title,
                body,
                tags: tagsInput.split(',').map((tag) => tag.trim()).filter(Boolean),
                authorId,
                relatedTaskIds,
              });
              onClose();
            }}
          >
            {initialValue ? 'Save document' : 'Create document'}
          </Button>
        </div>
      }
    >
      <div className="grid gap-4">
        <Field label="Title">
          <Input value={title} onChange={(event) => setTitle(event.target.value)} />
        </Field>
        <Field label="Tags" hint="Comma-separated tags help documents surface in project review.">
          <Input value={tagsInput} onChange={(event) => setTagsInput(event.target.value)} />
        </Field>
        <Field label="Body">
          <Textarea value={body} onChange={(event) => setBody(event.target.value)} className="min-h-[220px]" />
        </Field>
        <Field label="Related tasks">
          <div className="grid gap-2 rounded-2xl border border-slate-200 p-3">
            {tasks.map((task) => (
              <label className="flex items-center gap-2 text-sm text-slate-700" key={task.id}>
                <input checked={relatedTaskIds.includes(task.id)} onChange={() => toggleTask(task.id)} type="checkbox" />
                {task.title}
              </label>
            ))}
          </div>
        </Field>
      </div>
    </Modal>
  );
}
