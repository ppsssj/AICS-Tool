import { useMemo, useState } from 'react';
import { useLabStore } from '@/app/store/use-lab-store';
import type { ScheduleType } from '@/entities/models';
import { ScheduleFormModal } from '@/features/calendar/schedule-form-modal';
import { TimetableBlockModal } from '@/features/calendar/timetable-block-modal';
import { compareWeekday, weekdays } from '@/shared/lib/date';
import { Badge } from '@/shared/ui/badge';
import { Button } from '@/shared/ui/button';
import { Card } from '@/shared/ui/card';
import { PageHeader } from '@/shared/ui/page-header';

function typeTone(type: ScheduleType): 'info' | 'success' | 'warning' {
  if (type === 'Project') return 'info';
  if (type === 'Lab') return 'success';
  return 'warning';
}

export function CalendarPage() {
  const { createSchedule, createTimetableBlock, currentUserId, projects, schedules, timetableBlocks } = useLabStore();
  const [filter, setFilter] = useState<ScheduleType | 'All'>('All');
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [showTimetableModal, setShowTimetableModal] = useState(false);

  const myBlocks = timetableBlocks
    .filter((block) => block.userId === currentUserId)
    .sort((a, b) => compareWeekday(a.day, b.day));
  const visibleSchedules = useMemo(
    () =>
      schedules
        .filter((schedule) => filter === 'All' || schedule.type === filter)
        .sort((a, b) => compareWeekday(a.day, b.day)),
    [filter, schedules],
  );

  return (
    <div className="space-y-8">
      <PageHeader
        title="Weekly calendar"
        description="This is the coordination layer of the platform: student timetable constraints, shared lab commitments, and project scheduling all held in one weekly operational view."
        actions={
          <>
            <Button variant="secondary" onClick={() => setShowTimetableModal(true)}>
              Add timetable block
            </Button>
            <Button onClick={() => setShowScheduleModal(true)}>Create schedule</Button>
          </>
        }
      />

      <div className="flex flex-wrap gap-2">
        {(['All', 'Personal', 'Lab', 'Project'] as const).map((item) => (
          <Button key={item} variant={filter === item ? 'primary' : 'secondary'} onClick={() => setFilter(item)}>
            {item}
          </Button>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.92fr_1.08fr]">
        <Card className="border-slate-200/70">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Personal Coordination</p>
              <h2 className="mt-2 text-[24px] font-semibold tracking-[-0.03em] text-slate-950">Personal weekly timetable</h2>
            </div>
            <Badge tone="info">{myBlocks.length} blocks</Badge>
          </div>
          <div className="mt-5 space-y-3">
            {myBlocks.map((block) => (
              <div key={block.id} className="rounded-[22px] border border-slate-200/80 bg-slate-50/70 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[15px] font-semibold tracking-[-0.02em] text-slate-900">{block.title}</p>
                    <p className="mt-2 text-sm text-slate-500">
                      {block.day} · {block.startTime} - {block.endTime}
                    </p>
                  </div>
                  <Badge tone={block.category === 'Lab Availability' ? 'success' : block.category === 'Class' ? 'warning' : 'danger'}>
                    {block.category}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card className="border-slate-200/70">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Shared Coordination</p>
              <h2 className="mt-2 text-[24px] font-semibold tracking-[-0.03em] text-slate-950">Shared schedules</h2>
            </div>
            <Badge tone="neutral">{visibleSchedules.length} items</Badge>
          </div>
          <div className="mt-5 grid gap-3">
            {visibleSchedules.map((schedule) => {
              const project = schedule.projectId ? projects.find((item) => item.id === schedule.projectId) : undefined;
              return (
                <div key={schedule.id} className="rounded-[22px] border border-slate-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.92),rgba(248,249,251,0.92))] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[15px] font-semibold tracking-[-0.02em] text-slate-900">{schedule.title}</p>
                      <p className="mt-2 text-sm text-slate-500">
                        {schedule.day} · {schedule.startTime} - {schedule.endTime}
                      </p>
                    </div>
                    <Badge tone={typeTone(schedule.type)}>{schedule.type}</Badge>
                  </div>
                  <p className="mt-3 text-sm text-slate-500">{schedule.location}</p>
                  {project ? <p className="mt-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">{project.title}</p> : null}
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      <Card className="border-slate-200/70">
        <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Weekly Coordination Grid</p>
            <h2 className="mt-2 text-[24px] font-semibold tracking-[-0.03em] text-slate-950">Weekly view</h2>
          </div>
          <p className="text-sm text-slate-500">Designed for practical lab scheduling rather than a generic monthly calendar.</p>
        </div>
        <div className="mt-6 grid gap-4 xl:grid-cols-7">
          {weekdays.map((day) => {
            const dayBlocks = myBlocks.filter((block) => block.day === day);
            const daySchedules = visibleSchedules.filter((schedule) => schedule.day === day);
            return (
              <div key={day} className="rounded-[22px] border border-slate-200/80 bg-slate-50/75 p-4">
                <p className="text-[13px] font-semibold uppercase tracking-[0.08em] text-slate-700">{day}</p>
                <div className="mt-4 space-y-2.5">
                  {dayBlocks.map((block) => (
                    <div
                      key={block.id}
                      className="rounded-[18px] border border-white/80 bg-white px-3.5 py-3 text-sm shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]"
                    >
                      <p className="font-semibold tracking-[-0.01em] text-slate-900">{block.title}</p>
                      <p className="mt-1 text-slate-500">
                        {block.startTime} - {block.endTime}
                      </p>
                    </div>
                  ))}
                  {daySchedules.map((schedule) => (
                    <div
                      key={schedule.id}
                      className={
                        schedule.type === 'Project'
                          ? 'rounded-[18px] border border-accent-200/80 bg-accent-50/80 px-3.5 py-3 text-sm'
                          : schedule.type === 'Lab'
                            ? 'rounded-[18px] border border-emerald-200/80 bg-emerald-50/70 px-3.5 py-3 text-sm'
                            : 'rounded-[18px] border border-amber-200/80 bg-amber-50/70 px-3.5 py-3 text-sm'
                      }
                    >
                      <p className="font-semibold tracking-[-0.01em] text-slate-900">{schedule.title}</p>
                      <p className="mt-1 text-slate-500">
                        {schedule.startTime} - {schedule.endTime}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {currentUserId ? (
        <>
          <ScheduleFormModal
            open={showScheduleModal}
            projects={projects}
            ownerId={currentUserId}
            onClose={() => setShowScheduleModal(false)}
            onSubmit={createSchedule}
          />
          <TimetableBlockModal
            open={showTimetableModal}
            userId={currentUserId}
            onClose={() => setShowTimetableModal(false)}
            onSubmit={createTimetableBlock}
          />
        </>
      ) : null}
    </div>
  );
}
