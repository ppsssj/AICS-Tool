import type {
  Document,
  Project,
  Schedule,
  Task,
  TimetableBlock,
  User,
} from '@/entities/models';

export const mockUsers: User[] = [
  { id: 'u1', name: 'Prof. Jiyoon Han', email: 'jiyoon.han@labflow.ai', role: 'Admin', title: 'Principal Investigator' },
  { id: 'u2', name: 'Minji Kim', email: 'minji.kim@labflow.ai', role: 'Member', title: 'Graduate Research Lead' },
  { id: 'u3', name: 'Alex Park', email: 'alex.park@labflow.ai', role: 'Member', title: 'Undergraduate Researcher' },
  { id: 'u4', name: 'Sora Lee', email: 'sora.lee@labflow.ai', role: 'Member', title: 'Undergraduate Researcher' },
  { id: 'u5', name: 'Daniel Choi', email: 'daniel.choi@labflow.ai', role: 'Viewer', title: 'Visiting Collaborator' },
];

export const mockProjects: Project[] = [
  {
    id: 'p1',
    title: 'Cell Imaging Pipeline Refresh',
    description: 'Standardize image capture, preprocessing, and annotation workflows for the fluorescence microscopy team.',
    status: 'Active',
    memberIds: ['u1', 'u2', 'u3', 'u4'],
    updatedAt: '2026-03-05T15:10:00.000Z',
  },
  {
    id: 'p2',
    title: 'Robotic Sample Handling Pilot',
    description: 'Validate a semi-automated workflow for specimen transfers and assay plate preparation.',
    status: 'Planning',
    memberIds: ['u1', 'u2', 'u4'],
    updatedAt: '2026-03-04T11:45:00.000Z',
  },
  {
    id: 'p3',
    title: 'Sleep Study Recruitment Operations',
    description: 'Coordinate participant screening, recruitment materials, and weekly scheduling across the human-subjects team.',
    status: 'Active',
    memberIds: ['u1', 'u2', 'u3', 'u5'],
    updatedAt: '2026-03-03T18:30:00.000Z',
  },
  {
    id: 'p4',
    title: 'Archived Assay Benchmark',
    description: 'Previous semester benchmark study kept as a reference for protocol and documentation templates.',
    status: 'Archived',
    memberIds: ['u2', 'u3'],
    updatedAt: '2026-02-18T09:00:00.000Z',
  },
];

export const mockTasks: Task[] = [
  { id: 't1', projectId: 'p1', title: 'Finalize microscopy naming convention', description: 'Lock the folder and file naming rules before onboarding new undergraduates.', status: 'Review', priority: 'High', assigneeId: 'u3', dueDate: '2026-03-08', updatedAt: '2026-03-05T12:30:00.000Z', documentId: 'd1' },
  { id: 't2', projectId: 'p1', title: 'Annotate pilot image batch', description: 'Review 120 sample images and tag failed captures.', status: 'In Progress', priority: 'Urgent', assigneeId: 'u4', dueDate: '2026-03-07', updatedAt: '2026-03-05T20:15:00.000Z', documentId: 'd2' },
  { id: 't3', projectId: 'p2', title: 'Draft safety checklist for robot bench', description: 'Collect bench constraints and required supervisor checks.', status: 'Todo', priority: 'Medium', assigneeId: 'u2', dueDate: '2026-03-11', updatedAt: '2026-03-04T09:50:00.000Z' },
  { id: 't4', projectId: 'p3', title: 'Prepare participant follow-up email copy', description: 'Write templates for missed sessions and reminder sequences.', status: 'Done', priority: 'Medium', assigneeId: 'u3', dueDate: '2026-03-02', updatedAt: '2026-03-02T16:20:00.000Z', documentId: 'd3' },
  { id: 't5', projectId: 'p3', title: 'Reconcile scheduling conflicts for week 10', description: 'Check student availability against participant windows.', status: 'Todo', priority: 'Urgent', assigneeId: 'u3', dueDate: '2026-03-09', updatedAt: '2026-03-05T08:40:00.000Z' },
  { id: 't6', projectId: 'p1', title: 'Review onboarding protocol edits', description: 'PI sign-off before publishing the updated workflow document.', status: 'Todo', priority: 'High', assigneeId: 'u1', dueDate: '2026-03-10', updatedAt: '2026-03-05T14:55:00.000Z' },
  { id: 't7', projectId: 'p2', title: 'Inventory spare pipette adapters', description: 'Confirm which gripper attachments are still usable for the pilot.', status: 'In Progress', priority: 'Low', assigneeId: 'u4', dueDate: '2026-03-12', updatedAt: '2026-03-04T13:10:00.000Z' },
];

export const mockDocuments: Document[] = [
  { id: 'd1', projectId: 'p1', title: 'Imaging File Naming Standard v2', body: 'This document defines sample naming, microscope run identifiers, and upload rules for the shared imaging drive.\n\n1. Prefix every batch with project and operator initials.\n2. Use YYYYMMDD for acquisition date.\n3. Mark failed captures with the _FAILED suffix and note the issue in the review column.', tags: ['protocol', 'onboarding', 'imaging'], authorId: 'u2', updatedAt: '2026-03-05T12:00:00.000Z', relatedTaskIds: ['t1', 't6'] },
  { id: 'd2', projectId: 'p1', title: 'Pilot Annotation Review Notes', body: 'Annotators should flag blur, low contrast, and plate alignment issues. Use the shared spreadsheet to log examples that need faculty review.', tags: ['annotation', 'qa'], authorId: 'u4', updatedAt: '2026-03-05T19:10:00.000Z', relatedTaskIds: ['t2'] },
  { id: 'd3', projectId: 'p3', title: 'Recruitment Communication Drafts', body: 'Participant outreach must include weekday availability checks, cancellation policy language, and a short arrival checklist.', tags: ['recruitment', 'communications'], authorId: 'u3', updatedAt: '2026-03-02T16:00:00.000Z', relatedTaskIds: ['t4'] },
  { id: 'd4', projectId: 'p2', title: 'Robot Bench Preflight Checklist', body: 'Confirm emergency stop access, pipette alignment, and dry-run calibration before every automated transfer session.', tags: ['safety', 'automation'], authorId: 'u2', updatedAt: '2026-03-04T10:20:00.000Z', relatedTaskIds: ['t3'] },
];

export const mockSchedules: Schedule[] = [
  { id: 's1', title: 'Weekly Lab Operations Standup', type: 'Lab', day: 'Monday', startTime: '10:00', endTime: '11:00', location: 'Seminar Room A', note: 'Cross-project blockers, staffing changes, and safety reminders.' },
  { id: 's2', title: 'Imaging Calibration Window', type: 'Project', projectId: 'p1', day: 'Tuesday', startTime: '14:00', endTime: '16:00', location: 'Microscopy Suite', note: 'Reserved for pipeline verification and image quality checks.' },
  { id: 's3', title: 'Recruitment Screening Calls', type: 'Project', projectId: 'p3', day: 'Wednesday', startTime: '13:00', endTime: '15:00', location: 'Interview Booth 2', note: 'Student coordinators rotate every 30 minutes.' },
  { id: 's4', title: 'Open Lab Coverage', type: 'Lab', day: 'Thursday', startTime: '17:00', endTime: '19:00', location: 'Main Wet Lab', note: 'Shared undergraduate support slot.' },
  { id: 's5', title: 'Personal Deep Work Block', type: 'Personal', ownerId: 'u3', day: 'Friday', startTime: '09:00', endTime: '11:00', location: 'Library Carrel', note: 'Reserved analysis time for recruitment and documentation cleanup.' },
];

export const mockTimetableBlocks: TimetableBlock[] = [
  { id: 'tb1', userId: 'u3', day: 'Monday', startTime: '13:00', endTime: '15:00', category: 'Class', title: 'Computational Biology Lecture' },
  { id: 'tb2', userId: 'u3', day: 'Tuesday', startTime: '09:00', endTime: '12:00', category: 'Lab Availability', title: 'Available for microscopy runs' },
  { id: 'tb3', userId: 'u3', day: 'Wednesday', startTime: '10:00', endTime: '12:00', category: 'Unavailable', title: 'Department seminar + transit' },
  { id: 'tb4', userId: 'u3', day: 'Thursday', startTime: '14:00', endTime: '18:00', category: 'Lab Availability', title: 'Recruitment support window' },
];
