import { useEffect, useState } from 'react';
import type { Project, ScheduleType, Weekday } from '@/entities/models';
import { weekdays } from '@/shared/lib/date';
import { Button } from '@/shared/ui/button';
import { Field, Input, Select, Textarea } from '@/shared/ui/field';
import { Modal } from '@/shared/ui/modal';

interface ScheduleFormModalProps {
  open: boolean;
  projects: Project[];
  ownerId?: string;
  initialType?: ScheduleType;
  onClose: () => void;
  onSubmit: (payload: { title: string; type: ScheduleType; projectId?: string; ownerId?: string; day: Weekday; startTime: string; endTime: string; location: string; note: string }) => void;
}

export function ScheduleFormModal({ open, projects, ownerId, initialType = 'Lab', onClose, onSubmit }: ScheduleFormModalProps) {
  const [title, setTitle] = useState('');
  const [type, setType] = useState<ScheduleType>(initialType);
  const [projectId, setProjectId] = useState('');
  const [day, setDay] = useState<Weekday>('Monday');
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('10:00');
  const [location, setLocation] = useState('');
  const [note, setNote] = useState('');

  useEffect(() => {
    setTitle('');
    setType(initialType);
    setProjectId('');
    setDay('Monday');
    setStartTime('09:00');
    setEndTime('10:00');
    setLocation('');
    setNote('');
  }, [initialType, open]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Create schedule"
      description="Capture recurring project and lab commitments in a weekly format that works for student-heavy teams."
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button
            onClick={() => {
              onSubmit({ title, type, projectId: type === 'Project' ? projectId : undefined, ownerId: type === 'Personal' ? ownerId : undefined, day, startTime, endTime, location, note });
              onClose();
            }}
          >
            Save schedule
          </Button>
        </div>
      }
    >
      <div className="grid gap-4">
        <Field label="Title">
          <Input value={title} onChange={(event) => setTitle(event.target.value)} />
        </Field>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Type">
            <Select value={type} onChange={(event) => setType(event.target.value as ScheduleType)}>
              <option value="Personal">Personal</option>
              <option value="Lab">Lab</option>
              <option value="Project">Project</option>
            </Select>
          </Field>
          {type === 'Project' ? (
            <Field label="Project">
              <Select value={projectId} onChange={(event) => setProjectId(event.target.value)}>
                <option value="">Select a project</option>
                {projects.map((project) => <option key={project.id} value={project.id}>{project.title}</option>)}
              </Select>
            </Field>
          ) : null}
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <Field label="Day">
            <Select value={day} onChange={(event) => setDay(event.target.value as Weekday)}>
              {weekdays.map((item) => <option key={item} value={item}>{item}</option>)}
            </Select>
          </Field>
          <Field label="Start time">
            <Input value={startTime} onChange={(event) => setStartTime(event.target.value)} type="time" />
          </Field>
          <Field label="End time">
            <Input value={endTime} onChange={(event) => setEndTime(event.target.value)} type="time" />
          </Field>
        </div>
        <Field label="Location">
          <Input value={location} onChange={(event) => setLocation(event.target.value)} />
        </Field>
        <Field label="Notes">
          <Textarea value={note} onChange={(event) => setNote(event.target.value)} />
        </Field>
      </div>
    </Modal>
  );
}
