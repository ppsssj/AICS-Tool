import { useEffect, useState } from 'react';
import type { Project, ScheduleType, Weekday } from '@/entities/models';
import { weekdays } from '@/shared/lib/date';
import { scheduleTypeLabels, weekdayLabels } from '@/shared/lib/labels';
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
      title="일정 생성"
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={onClose}>취소</Button>
          <Button
            onClick={() => {
              onSubmit({ title, type, projectId: type === 'Project' ? projectId : undefined, ownerId: type === 'Personal' ? ownerId : undefined, day, startTime, endTime, location, note });
              onClose();
            }}
          >
            일정 저장
          </Button>
        </div>
      }
    >
      <div className="grid gap-4">
        <Field label="제목">
          <Input value={title} onChange={(event) => setTitle(event.target.value)} />
        </Field>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="유형">
            <Select value={type} onChange={(event) => setType(event.target.value as ScheduleType)}>
              <option value="Personal">{scheduleTypeLabels.Personal}</option>
              <option value="Lab">{scheduleTypeLabels.Lab}</option>
              <option value="Project">{scheduleTypeLabels.Project}</option>
            </Select>
          </Field>
          {type === 'Project' ? (
            <Field label="프로젝트">
              <Select value={projectId} onChange={(event) => setProjectId(event.target.value)}>
                <option value="">프로젝트 선택</option>
                {projects.map((project) => <option key={project.id} value={project.id}>{project.title}</option>)}
              </Select>
            </Field>
          ) : null}
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <Field label="요일">
            <Select value={day} onChange={(event) => setDay(event.target.value as Weekday)}>
              {weekdays.map((item) => <option key={item} value={item}>{weekdayLabels[item]}</option>)}
            </Select>
          </Field>
          <Field label="시작 시간">
            <Input value={startTime} onChange={(event) => setStartTime(event.target.value)} type="time" />
          </Field>
          <Field label="종료 시간">
            <Input value={endTime} onChange={(event) => setEndTime(event.target.value)} type="time" />
          </Field>
        </div>
        <Field label="장소">
          <Input value={location} onChange={(event) => setLocation(event.target.value)} />
        </Field>
        <Field label="메모">
          <Textarea value={note} onChange={(event) => setNote(event.target.value)} />
        </Field>
      </div>
    </Modal>
  );
}
