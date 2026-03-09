import type { Document, Project, Schedule, Task } from '@/entities/models';
import type { AppTheme } from '@/shared/lib/themes';

type AssistantSection = 'overview' | 'docs' | 'tasks' | 'schedule' | 'members';

interface AssistantState {
  projects: Project[];
  documents: Document[];
  tasks: Task[];
  schedules: Schedule[];
  activeProjectId: string | null;
  recentProjectIds: string[];
}

interface AssistantProjectMatch {
  project: Project;
  score: number;
}

interface AssistantDocumentMatch {
  document: Document;
  score: number;
}

export interface AssistantResponse {
  message: string;
  path?: string;
  projectId?: string | null;
  documentId?: string | null;
  theme?: AppTheme;
  shouldLogout?: boolean;
  suggestions?: string[];
}

interface GlobalRouteMatch {
  path: string;
  message: string;
  suggestions?: string[];
}

const PROJECT_STOP_WORDS = [
  '프로젝트',
  '워크스페이스',
  'workspace',
  'manage',
  'management',
  '관리',
  '열어',
  '열기',
  '들어가',
  '보여',
  '확인',
  '봐줘',
  '보고싶어',
  '가고싶어',
  '싶다',
  '해줘',
  '해주세요',
  '해',
  '하고',
  '싶어',
  '관련',
  'context',
  '맥락',
  '안에서',
  'within',
  'open',
];

function normalizeText(value: string): string {
  return value.toLowerCase().replace(/\s+/g, '').replace(/[^\p{L}\p{N}]/gu, '');
}

function tokenizeText(value: string): string[] {
  return value
    .toLowerCase()
    .split(/[\s/(),.-]+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 0);
}

function deriveProjectQuery(input: string): string {
  const normalizedTokens = tokenizeText(input).filter((token) => !PROJECT_STOP_WORDS.includes(token));
  return normalizedTokens.join(' ').trim();
}

function detectSection(input: string): AssistantSection {
  const normalized = input.toLowerCase();

  if (normalized.includes('문서') || normalized.includes('doc')) {
    return 'docs';
  }

  if (normalized.includes('작업') || normalized.includes('태스크') || normalized.includes('task')) {
    return 'tasks';
  }

  if (normalized.includes('일정') || normalized.includes('캘린더') || normalized.includes('session') || normalized.includes('schedule')) {
    return 'schedule';
  }

  if (normalized.includes('멤버') || normalized.includes('구성원') || normalized.includes('member') || normalized.includes('team')) {
    return 'members';
  }

  return 'overview';
}

function scoreProject(project: Project, query: string, recentProjectIds: string[]): number {
  const projectTitle = normalizeText(project.title);
  const normalizedQuery = normalizeText(query);

  if (!normalizedQuery) {
    const recentBonus = recentProjectIds.indexOf(project.id);
    return recentBonus === -1 ? 0 : 24 - recentBonus;
  }

  let score = 0;

  if (projectTitle === normalizedQuery) {
    score += 120;
  }

  if (projectTitle.includes(normalizedQuery)) {
    score += 80;
  }

  const queryTokens = tokenizeText(query);
  score += queryTokens.filter((token) => normalizeText(project.title).includes(normalizeText(token))).length * 18;

  const recentBonus = recentProjectIds.indexOf(project.id);
  if (recentBonus !== -1) {
    score += 16 - recentBonus;
  }

  return score;
}

function rankProjects(projects: Project[], query: string, recentProjectIds: string[]): AssistantProjectMatch[] {
  return projects
    .map((project) => ({ project, score: scoreProject(project, query, recentProjectIds) }))
    .filter((item) => item.score > 0)
    .sort((left, right) => right.score - left.score);
}

function buildProjectPath(projectId: string, section: AssistantSection): string {
  if (section === 'docs') {
    return `/projects/${projectId}/docs`;
  }

  if (section === 'tasks') {
    return `/projects/${projectId}/tasks`;
  }

  if (section === 'schedule') {
    return `/projects/${projectId}/schedule`;
  }

  if (section === 'members') {
    return `/projects/${projectId}/members`;
  }

  return `/projects/${projectId}`;
}

function buildDocumentPath(projectId: string, documentId: string): string {
  return `/projects/${projectId}/docs/${documentId}`;
}

function resolveGlobalRoute(input: string): GlobalRouteMatch | null {
  const normalized = normalizeText(input);

  if (!normalized) {
    return null;
  }

  if (normalized.includes('대시보드') || normalized === 'dashboard' || normalized.includes('홈')) {
    return {
      path: '/dashboard',
      message: '대시보드로 이동합니다.',
      suggestions: ['프로젝트 목록 열기', '캘린더 열기'],
    };
  }

  if (
    normalized.includes('프로젝트목록') ||
    normalized.includes('전체프로젝트') ||
    normalized === '프로젝트' ||
    normalized === 'projects'
  ) {
    return {
      path: '/projects',
      message: '프로젝트 목록으로 이동합니다.',
      suggestions: ['대시보드 열기', '캘린더 열기'],
    };
  }

  if (normalized.includes('캘린더') || normalized.includes('일정페이지') || normalized === 'calendar') {
    return {
      path: '/calendar',
      message: '캘린더로 이동합니다.',
      suggestions: ['오늘 일정 보기', '프로젝트 일정 열기'],
    };
  }

  if (normalized.includes('설정') || normalized.includes('환경설정') || normalized === 'settings') {
    return {
      path: '/settings',
      message: '설정 페이지로 이동합니다.',
      suggestions: ['테마 바꾸기', '프로필 확인'],
    };
  }

  return null;
}

function resolveThemeChange(input: string): AssistantResponse | null {
  const normalized = normalizeText(input);
  const wantsThemeChange =
    normalized.includes('테마') ||
    normalized.includes('theme') ||
    normalized.includes('바꿔') ||
    normalized.includes('변경') ||
    normalized.includes('적용');

  if (!wantsThemeChange) {
    return null;
  }

  const targetTheme: AppTheme | null =
    normalized.includes('미스트') || normalized.includes('mist')
      ? 'mist'
      : normalized.includes('스카이') || normalized.includes('sky')
        ? 'sky'
        : normalized.includes('샌드') || normalized.includes('sand')
          ? 'sand'
          : normalized.includes('실버') || normalized.includes('silver') || normalized.includes('기본')
            ? 'silver'
            : null;

  if (!targetTheme) {
    return {
      message: '변경할 테마를 알려주세요. 실버, 미스트, 스카이, 샌드 중에서 선택할 수 있습니다.',
      suggestions: ['미스트 테마로 바꿔줘', '스카이 테마 적용', '기본 테마로 변경'],
    };
  }

  const themeLabel =
    targetTheme === 'mist' ? '미스트' : targetTheme === 'sky' ? '스카이' : targetTheme === 'sand' ? '샌드' : '실버 시스템';

  return {
    message: `${themeLabel} 테마로 변경합니다.`,
    theme: targetTheme,
    suggestions: ['대시보드 열기', '설정 페이지 열기'],
  };
}

function resolveLogoutIntent(input: string): AssistantResponse | null {
  const normalized = normalizeText(input);

  if (!/(로그아웃|logout|signout|signoff|세션종료)/i.test(normalized)) {
    return null;
  }

  return {
    message: '현재 세션을 종료하고 로그인 화면으로 이동합니다.',
    shouldLogout: true,
    suggestions: ['다시 로그인', '설정 페이지 열기'],
  };
}

function scoreDocument(document: Document, query: string, projects: Project[], recentProjectIds: string[]): number {
  const documentTitle = normalizeText(document.title);
  const normalizedQuery = normalizeText(query);

  if (!normalizedQuery) {
    return 0;
  }

  let score = 0;

  if (documentTitle === normalizedQuery) {
    score += 140;
  }

  if (documentTitle.includes(normalizedQuery)) {
    score += 90;
  }

  const queryTokens = tokenizeText(query);
  score += queryTokens.filter((token) => normalizeText(document.title).includes(normalizeText(token))).length * 18;

  const projectRecentBonus = recentProjectIds.indexOf(document.projectId);
  if (projectRecentBonus !== -1) {
    score += 12 - projectRecentBonus;
  }

  const project = projects.find((item) => item.id === document.projectId);
  if (project && normalizedQuery.includes(normalizeText(project.title))) {
    score += 20;
  }

  return score;
}

function rankDocuments(
  documents: Document[],
  query: string,
  projects: Project[],
  recentProjectIds: string[],
): AssistantDocumentMatch[] {
  return documents
    .map((document) => ({
      document,
      score: scoreDocument(document, query, projects, recentProjectIds),
    }))
    .filter((item) => item.score > 0)
    .sort((left, right) => right.score - left.score);
}

function buildDocumentSummary(document: Document, state: AssistantState): string {
  const project = state.projects.find((item) => item.id === document.projectId);
  return `"${document.title}" 문서를 엽니다.${project ? ` ${project.title} 프로젝트 문서입니다.` : ''}`;
}

function buildProjectSummary(project: Project, state: AssistantState): string {
  const openTasks = state.tasks.filter((task) => task.projectId === project.id && task.status !== 'Done');
  const reviewCount = openTasks.filter((task) => task.status === 'Review').length;
  const linkedDocs = state.documents.filter((document) => document.projectId === project.id).length;
  const sessions = state.schedules.filter((schedule) => schedule.projectId === project.id).length;

  return `${project.title} 컨텍스트로 전환했습니다. 진행 중 작업 ${openTasks.length}개, 리뷰 대기 ${reviewCount}개, 문서 ${linkedDocs}개, 공유 일정 ${sessions}개를 기준으로 이어서 작업할 수 있습니다.`;
}

function buildClarification(matches: AssistantProjectMatch[], section: AssistantSection): AssistantResponse {
  const sectionLabel =
    section === 'docs' ? '문서' : section === 'tasks' ? '작업 보드' : section === 'schedule' ? '일정' : '프로젝트 워크스페이스';

  return {
    message: `${sectionLabel}로 열 수 있는 후보가 여러 개입니다. 아래 프로젝트 중 하나를 선택해 주세요.`,
    suggestions: matches.slice(0, 3).map((item) => `${item.project.title} 열기`),
  };
}

function resolveCurrentProject(state: AssistantState): Project | undefined {
  return state.projects.find((project) => project.id === state.activeProjectId);
}

export function resolveAssistantPrompt(input: string, state: AssistantState): AssistantResponse {
  const trimmedInput = input.trim();

  if (!trimmedInput) {
    return {
      message: '프로젝트 이름이나 작업 의도를 입력해 주세요. 예: 졸업작품 프로젝트 열기, 반도체 분석 일정 보여줘',
    };
  }

  const section = detectSection(trimmedInput);
  const logoutIntent = resolveLogoutIntent(trimmedInput);
  if (logoutIntent) {
    return logoutIntent;
  }

  const themeChange = resolveThemeChange(trimmedInput);
  if (themeChange) {
    return themeChange;
  }

  const usesCurrentContext =
    /이프로젝트|현재프로젝트|여기|현재컨텍스트|이작업공간|현재작업공간/.test(normalizeText(trimmedInput));

  if (usesCurrentContext) {
    const currentProject = resolveCurrentProject(state);

    if (!currentProject) {
      return {
        message: '현재 활성 프로젝트가 없습니다. 프로젝트 이름을 함께 말하면 바로 해당 워크스페이스로 이동할 수 있습니다.',
      };
    }

    return {
      message: buildProjectSummary(currentProject, state),
      path: buildProjectPath(currentProject.id, section),
      projectId: currentProject.id,
    };
  }

  const query = deriveProjectQuery(trimmedInput);
  const documentIntent = /(문서|doc|docs|파일|프로토콜|회의록|초안|보고서)/i.test(trimmedInput);
  const documentMatches = rankDocuments(state.documents, query || trimmedInput, state.projects, state.recentProjectIds);

  if (documentMatches.length >= 2 && documentMatches[0].score - documentMatches[1].score < 20 && documentIntent) {
    return {
      message: '열 수 있는 문서 후보가 여러 개입니다. 아래 문서 중 하나를 선택해 주세요.',
      suggestions: documentMatches.slice(0, 3).map((item) => `${item.document.title} 열기`),
    };
  }

  if (documentMatches.length >= 1 && (documentIntent || documentMatches[0].score >= 90)) {
    const match = documentMatches[0].document;
    return {
      message: buildDocumentSummary(match, state),
      path: buildDocumentPath(match.projectId, match.id),
      projectId: match.projectId,
      documentId: match.id,
      suggestions: [`${match.title} 관련 작업 보기`, `${state.projects.find((project) => project.id === match.projectId)?.title ?? '프로젝트'} 열기`],
    };
  }

  const matches = rankProjects(state.projects, query, state.recentProjectIds);

  if (matches.length >= 2 && matches[0].score - matches[1].score < 20) {
    return buildClarification(matches, section);
  }

  if (matches.length >= 1) {
    const match = matches[0].project;
    return {
      message: buildProjectSummary(match, state),
      path: buildProjectPath(match.id, section),
      projectId: match.id,
    };
  }

  const globalRoute = resolveGlobalRoute(trimmedInput);
  if (globalRoute) {
    return {
      message: globalRoute.message,
      path: globalRoute.path,
      suggestions: globalRoute.suggestions,
    };
  }

  const currentProject = resolveCurrentProject(state);
  const genericWorkflowIntent = /(문서|작업|태스크|일정|스케줄|calendar|docs|task|review|board|workspace|멤버|구성원|member|team)/i.test(trimmedInput);

  if (genericWorkflowIntent && currentProject) {
    return {
      message: `${currentProject.title} 컨텍스트를 유지한 채 요청한 화면으로 이동합니다.`,
      path: buildProjectPath(currentProject.id, section),
      projectId: currentProject.id,
    };
  }

  return {
    message: '일치하는 프로젝트를 찾지 못했습니다. 프로젝트 이름을 조금 더 구체적으로 입력해 주세요.',
    suggestions: state.projects.slice(0, 3).map((project) => `${project.title} 열기`),
  };
}
