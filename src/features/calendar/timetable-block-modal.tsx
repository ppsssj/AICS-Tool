import { useEffect, useState } from 'react';
import type { TimetableBlockType, Weekday } from '@/entities/models';
import { weekdays } from '@/shared/lib/date';
import { timetableBlockTypeLabels, weekdayLabels } from '@/shared/lib/labels';
import { Button } from '@/shared/ui/button';
import { Field, Input, Select } from '@/shared/ui/field';
import { Modal } from '@/shared/ui/modal';

interface TimetableBlockModalProps {
  open: boolean;
  userId: string;
  onClose: () => void;
  onSubmit: (payload: { userId: string; day: Weekday; startTime: string; endTime: string; category: TimetableBlockType; title: string }) => void;
}

export function TimetableBlockModal({ open, userId, onClose, onSubmit }: TimetableBlockModalProps) {
  const [title, setTitle] = useState('');
  const [day, setDay] = useState<Weekday>('Monday');
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('10:00');
  const [category, setCategory] = useState<TimetableBlockType>('Lab Availability');

  useEffect(() => {
    setTitle('');
    setDay('Monday');
    setStartTime('09:00');
    setEndTime('10:00');
    setCategory('Lab Availability');
  }, [open]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="시간표 블록 등록"
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={onClose}>취소</Button>
          <Button onClick={() => { onSubmit({ userId, day, startTime, endTime, category, title }); onClose(); }}>
            블록 저장
          </Button>
        </div>
      }
    >
      <div className="grid gap-4">
        <Field label="제목">
          <Input value={title} onChange={(event) => setTitle(event.target.value)} />
        </Field>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="분류">
            <Select value={category} onChange={(event) => setCategory(event.target.value as TimetableBlockType)}>
              <option value="Class">{timetableBlockTypeLabels.Class}</option>
              <option value="Unavailable">{timetableBlockTypeLabels.Unavailable}</option>
              <option value="Lab Availability">{timetableBlockTypeLabels['Lab Availability']}</option>
            </Select>
          </Field>
          <Field label="요일">
            <Select value={day} onChange={(event) => setDay(event.target.value as Weekday)}>
              {weekdays.map((item) => <option key={item} value={item}>{weekdayLabels[item]}</option>)}
            </Select>
          </Field>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="시작 시간">
            <Input value={startTime} onChange={(event) => setStartTime(event.target.value)} type="time" />
          </Field>
          <Field label="종료 시간">
            <Input value={endTime} onChange={(event) => setEndTime(event.target.value)} type="time" />
          </Field>
        </div>
      </div>
    </Modal>
  );
}
