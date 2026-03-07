import type {
  Document,
  Project,
  Schedule,
  Task,
  TimetableBlock,
  User,
} from '@/entities/models';

export const mockUsers: User[] = [
  { id: 'u1', name: '한지윤 교수', email: 'jiyoon.han@labflow.ai', role: 'Admin', title: '연구책임자' },
  { id: 'u2', name: '김민지', email: 'minji.kim@labflow.ai', role: 'Member', title: '대학원 연구 리드' },
  { id: 'u3', name: '박알렉스', email: 'alex.park@labflow.ai', role: 'Member', title: '학부 연구원' },
  { id: 'u4', name: '이소라', email: 'sora.lee@labflow.ai', role: 'Member', title: '학부 연구원' },
  { id: 'u5', name: '최다니엘', email: 'daniel.choi@labflow.ai', role: 'Viewer', title: '외부 협력 연구원' },
];

export const mockProjects: Project[] = [
  {
    id: 'p1',
    title: '세포 이미징 파이프라인 개편',
    description: '형광 현미경 팀의 이미지 촬영, 전처리, 주석 워크플로를 표준화합니다.',
    status: 'Active',
    memberIds: ['u1', 'u2', 'u3', 'u4'],
    updatedAt: '2026-03-05T15:10:00.000Z',
  },
  {
    id: 'p2',
    title: '로봇 샘플 핸들링 파일럿',
    description: '검체 이송과 분석 플레이트 준비를 위한 반자동 워크플로를 검증합니다.',
    status: 'Planning',
    memberIds: ['u1', 'u2', 'u4'],
    updatedAt: '2026-03-04T11:45:00.000Z',
  },
  {
    id: 'p3',
    title: '수면 연구 모집 운영',
    description: '인체 대상 연구 팀 전반의 스크리닝, 모집 자료, 주간 일정 조율을 관리합니다.',
    status: 'Active',
    memberIds: ['u1', 'u2', 'u3', 'u5'],
    updatedAt: '2026-03-03T18:30:00.000Z',
  },
  {
    id: 'p4',
    title: '보관용 분석 벤치마크',
    description: '프로토콜과 문서 템플릿 참고용으로 보관하는 이전 학기 벤치마크 연구입니다.',
    status: 'Archived',
    memberIds: ['u2', 'u3'],
    updatedAt: '2026-02-18T09:00:00.000Z',
  },
];

export const mockTasks: Task[] = [
  { id: 't1', projectId: 'p1', title: '현미경 파일명 규칙 최종 확정', description: '새 학부 연구원 온보딩 전에 폴더 및 파일명 규칙을 확정합니다.', status: 'Review', priority: 'High', assigneeId: 'u3', dueDate: '2026-03-08', updatedAt: '2026-03-05T12:30:00.000Z', documentId: 'd1' },
  { id: 't2', projectId: 'p1', title: '파일럿 이미지 배치 주석 처리', description: '샘플 이미지 120장을 검토하고 실패한 촬영을 태깅합니다.', status: 'In Progress', priority: 'Urgent', assigneeId: 'u4', dueDate: '2026-03-07', updatedAt: '2026-03-05T20:15:00.000Z', documentId: 'd2' },
  { id: 't3', projectId: 'p2', title: '로봇 벤치 안전 체크리스트 초안 작성', description: '벤치 제약 조건과 필요한 감독자 점검 항목을 수집합니다.', status: 'Todo', priority: 'Medium', assigneeId: 'u2', dueDate: '2026-03-11', updatedAt: '2026-03-04T09:50:00.000Z' },
  { id: 't4', projectId: 'p3', title: '참여자 후속 메일 문구 준비', description: '불참 세션과 리마인드용 메일 템플릿을 작성합니다.', status: 'Done', priority: 'Medium', assigneeId: 'u3', dueDate: '2026-03-02', updatedAt: '2026-03-02T16:20:00.000Z', documentId: 'd3' },
  { id: 't5', projectId: 'p3', title: '10주차 일정 충돌 조정', description: '학생 가능 시간과 참여자 가능 시간을 대조합니다.', status: 'Todo', priority: 'Urgent', assigneeId: 'u3', dueDate: '2026-03-09', updatedAt: '2026-03-05T08:40:00.000Z' },
  { id: 't6', projectId: 'p1', title: '온보딩 프로토콜 수정본 검토', description: '업데이트된 워크플로 문서 게시 전 PI 승인이 필요합니다.', status: 'Todo', priority: 'High', assigneeId: 'u1', dueDate: '2026-03-10', updatedAt: '2026-03-05T14:55:00.000Z' },
  { id: 't7', projectId: 'p2', title: '예비 피펫 어댑터 재고 확인', description: '파일럿에 사용할 수 있는 그리퍼 부착물을 점검합니다.', status: 'In Progress', priority: 'Low', assigneeId: 'u4', dueDate: '2026-03-12', updatedAt: '2026-03-04T13:10:00.000Z' },
];

export const mockDocuments: Document[] = [
  { id: 'd1', projectId: 'p1', title: '이미징 파일명 표준 v2', body: '이 문서는 공용 이미징 드라이브를 위한 샘플 이름, 현미경 런 식별자, 업로드 규칙을 정의합니다.\n\n1. 모든 배치는 프로젝트와 작업자 이니셜로 시작합니다.\n2. 촬영 날짜는 YYYYMMDD 형식을 사용합니다.\n3. 실패한 촬영은 _FAILED 접미사를 붙이고 검토 열에 문제를 기록합니다.', tags: ['프로토콜', '온보딩', '이미징'], authorId: 'u2', updatedAt: '2026-03-05T12:00:00.000Z', relatedTaskIds: ['t1', 't6'], attachments: [] },
  { id: 'd2', projectId: 'p1', title: '파일럿 주석 검토 노트', body: '주석 작업자는 흐림, 저대비, 플레이트 정렬 문제를 표시해야 합니다. 교수진 검토가 필요한 예시는 공유 스프레드시트에 기록합니다.', tags: ['주석', '품질관리'], authorId: 'u4', updatedAt: '2026-03-05T19:10:00.000Z', relatedTaskIds: ['t2'], attachments: [] },
  { id: 'd3', projectId: 'p3', title: '모집 커뮤니케이션 초안', body: '참여자 안내에는 평일 가능 시간 확인, 취소 정책 안내, 간단한 방문 체크리스트가 포함되어야 합니다.', tags: ['모집', '커뮤니케이션'], authorId: 'u3', updatedAt: '2026-03-02T16:00:00.000Z', relatedTaskIds: ['t4'], attachments: [] },
  { id: 'd4', projectId: 'p2', title: '로봇 벤치 사전 점검 체크리스트', body: '자동 이송 세션 전마다 비상 정지 장치 접근성, 피펫 정렬, 드라이런 보정을 확인합니다.', tags: ['안전', '자동화'], authorId: 'u2', updatedAt: '2026-03-04T10:20:00.000Z', relatedTaskIds: ['t3'], attachments: [] },
];

export const mockSchedules: Schedule[] = [
  { id: 's1', title: '주간 랩 운영 스탠드업', type: 'Lab', day: 'Monday', startTime: '10:00', endTime: '11:00', location: '세미나실 A', note: '프로젝트별 블로커, 인력 변동, 안전 공지를 공유합니다.' },
  { id: 's2', title: '이미징 보정 시간', type: 'Project', projectId: 'p1', day: 'Tuesday', startTime: '14:00', endTime: '16:00', location: '현미경실', note: '파이프라인 검증과 이미지 품질 점검을 위한 예약 시간입니다.' },
  { id: 's3', title: '모집 스크리닝 콜', type: 'Project', projectId: 'p3', day: 'Wednesday', startTime: '13:00', endTime: '15:00', location: '인터뷰 부스 2', note: '학생 코디네이터가 30분마다 교대합니다.' },
  { id: 's4', title: '오픈 랩 지원 시간', type: 'Lab', day: 'Thursday', startTime: '17:00', endTime: '19:00', location: '메인 Wet Lab', note: '학부 연구원 공용 지원 슬롯입니다.' },
  { id: 's5', title: '개인 집중 작업 블록', type: 'Personal', ownerId: 'u3', day: 'Friday', startTime: '09:00', endTime: '11:00', location: '도서관 개인석', note: '모집 운영 정리와 문서 정비를 위한 분석 시간입니다.' },
];

export const mockTimetableBlocks: TimetableBlock[] = [
  { id: 'tb1', userId: 'u3', day: 'Monday', startTime: '13:00', endTime: '15:00', category: 'Class', title: '계산생물학 강의' },
  { id: 'tb2', userId: 'u3', day: 'Tuesday', startTime: '09:00', endTime: '12:00', category: 'Lab Availability', title: '현미경 실험 가능 시간' },
  { id: 'tb3', userId: 'u3', day: 'Wednesday', startTime: '10:00', endTime: '12:00', category: 'Unavailable', title: '학과 세미나 및 이동' },
  { id: 'tb4', userId: 'u3', day: 'Thursday', startTime: '14:00', endTime: '18:00', category: 'Lab Availability', title: '모집 지원 가능 시간' },
];
