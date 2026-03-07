import type {
  ProjectStatus,
  Role,
  ScheduleType,
  TaskPriority,
  TaskStatus,
  TimetableBlockType,
  Weekday,
} from '@/entities/models';

export const roleLabels: Record<Role, string> = {
  Admin: '관리자',
  Member: '구성원',
  Viewer: '조회 전용',
};

export const projectStatusLabels: Record<ProjectStatus, string> = {
  Planning: '기획',
  Active: '진행 중',
  Done: '완료',
  Archived: '보관됨',
};

export const taskStatusLabels: Record<TaskStatus, string> = {
  Todo: '할 일',
  'In Progress': '진행 중',
  Review: '검토',
  Done: '완료',
};

export const taskPriorityLabels: Record<TaskPriority, string> = {
  Low: '낮음',
  Medium: '보통',
  High: '높음',
  Urgent: '긴급',
};

export const scheduleTypeLabels: Record<ScheduleType, string> = {
  Personal: '개인',
  Lab: '연구실',
  Project: '프로젝트',
};

export const timetableBlockTypeLabels: Record<TimetableBlockType, string> = {
  Class: '수업',
  Unavailable: '불가',
  'Lab Availability': '연구실 가능 시간',
};

export const weekdayLabels: Record<Weekday, string> = {
  Monday: '월요일',
  Tuesday: '화요일',
  Wednesday: '수요일',
  Thursday: '목요일',
  Friday: '금요일',
  Saturday: '토요일',
  Sunday: '일요일',
};
