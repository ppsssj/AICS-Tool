import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import type { Document, Project, Schedule, ScheduleType, Task, TaskPriority, Weekday } from '@/entities/models';
import {
  buildWorkspacePayload,
  requestAssistantResponse,
  type AssistantHistoryItem,
} from '@/features/assistant/assistant-api';
import { resolveAssistantPrompt } from '@/features/assistant/mock-project-assistant';
import type { AppTheme } from '@/shared/lib/themes';
import { cn } from '@/shared/lib/cn';
import { Button } from '@/shared/ui/button';

const EDGE_PADDING = 16;
const MIN_PANEL_WIDTH = 320;
const MIN_PANEL_HEIGHT = 360;
const DEFAULT_PANEL_WIDTH = 420;
const DEFAULT_PANEL_HEIGHT = 560;
const PANEL_TRANSITION_MS = 360;

interface AssistantWorkspacePanelProps {
  projects: Project[];
  documents: Document[];
  tasks: Task[];
  schedules: Schedule[];
  currentUserId: string | null;
  activeProjectId: string | null;
  activeDocumentId: string | null;
  recentProjectIds: string[];
  createProject: (input: { title: string; description: string; status: 'Planning' | 'Active' | 'Done' | 'Archived'; memberIds: string[] }) => string;
  createDocument: (input: { projectId: string; title: string; body: string; tags: string[]; authorId: string; relatedTaskIds: string[] }) => string;
  createTask: (input: { projectId: string; title: string; description: string; status: 'Todo' | 'In Progress' | 'Review' | 'Done'; priority: TaskPriority; assigneeId: string; dueDate: string; documentId?: string }) => void;
  createSchedule: (input: { title: string; type: ScheduleType; projectId?: string; ownerId?: string; day: Weekday; startTime: string; endTime: string; location: string; note: string }) => void;
  deleteDocument: (documentId: string) => void;
  deleteTask: (taskId: string) => void;
  updateTaskStatus: (taskId: string, status: 'Todo' | 'In Progress' | 'Review' | 'Done') => void;
  logout?: () => void;
  setAppTheme?: (theme: AppTheme) => void;
  setActiveProjectContext: (projectId: string | null) => void;
  setActiveDocumentContext: (documentId: string | null) => void;
}

interface AssistantMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  suggestions?: string[];
}

interface PanelRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface PendingAssistantAction {
  kind: 'delete_task' | 'delete_document';
  id: string;
  projectId: string | null;
  title: string;
}

type AssistantPanelPhase = 'closed' | 'opening' | 'open' | 'closing';

interface PanelOrigin {
  x: number;
  y: number;
}

function createMessage(role: AssistantMessage['role'], text: string, suggestions?: string[]): AssistantMessage {
  return {
    id: `${role}-${Math.random().toString(36).slice(2, 9)}`,
    role,
    text,
    suggestions,
  };
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function normalizeProjectTitle(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

function getDefaultTaskDueDate() {
  const target = new Date();
  target.setDate(target.getDate() + 7);
  return target.toISOString().slice(0, 10);
}

function isConfirmationPrompt(value: string) {
  return /^(예|네|응|확인|진행|삭제 진행|맞아|yes|confirm|ok)$/i.test(value.trim());
}

function isCancellationPrompt(value: string) {
  return /^(아니오|아니요|취소|중지|stop|cancel|no)$/i.test(value.trim());
}

function buildQuickPrompts(args: {
  projects: Project[];
  recentProjectIds: string[];
  activeProjectId: string | null;
}): string[] {
  const recentProjects = args.recentProjectIds
    .map((projectId) => args.projects.find((project) => project.id === projectId))
    .filter((project): project is Project => Boolean(project));
  const activeProject = args.projects.find((project) => project.id === args.activeProjectId) ?? null;
  const candidates = [activeProject, ...recentProjects].filter((project): project is Project => Boolean(project));
  const uniqueProjects = candidates.filter(
    (project, index) => candidates.findIndex((candidate) => candidate.id === project.id) === index,
  );

  const prompts = [
    activeProject ? '현재 프로젝트 작업 보드 보여줘' : null,
    uniqueProjects[0] ? `${uniqueProjects[0].title} 열어줘` : null,
    uniqueProjects[0] ? `${uniqueProjects[0].title} 일정 보여줘` : null,
    uniqueProjects[1] ? `${uniqueProjects[1].title} 작업 보드 보여줘` : null,
    !activeProject && uniqueProjects.length === 0 ? '최근 프로젝트 보여줘' : null,
  ];

  return prompts.filter((prompt): prompt is string => Boolean(prompt)).slice(0, 4);
}

function getViewportBounds() {
  return {
    width: window.innerWidth,
    height: window.innerHeight,
  };
}

function getDefaultPanelRect(): PanelRect {
  const viewport = getViewportBounds();
  const maxWidth = Math.max(MIN_PANEL_WIDTH, viewport.width - EDGE_PADDING * 2);
  const maxHeight = Math.max(MIN_PANEL_HEIGHT, viewport.height - EDGE_PADDING * 2);
  const width = Math.min(DEFAULT_PANEL_WIDTH, maxWidth);
  const height = Math.min(DEFAULT_PANEL_HEIGHT, maxHeight);

  return {
    width,
    height,
    x: viewport.width - width - EDGE_PADDING,
    y: viewport.height - height - EDGE_PADDING - 72,
  };
}

function clampPanelRect(nextRect: PanelRect): PanelRect {
  const viewport = getViewportBounds();
  const maxWidth = Math.max(MIN_PANEL_WIDTH, viewport.width - EDGE_PADDING * 2);
  const maxHeight = Math.max(MIN_PANEL_HEIGHT, viewport.height - EDGE_PADDING * 2);
  const width = clamp(nextRect.width, Math.min(MIN_PANEL_WIDTH, maxWidth), maxWidth);
  const height = clamp(nextRect.height, Math.min(MIN_PANEL_HEIGHT, maxHeight), maxHeight);

  return {
    width,
    height,
    x: clamp(nextRect.x, EDGE_PADDING, viewport.width - width - EDGE_PADDING),
    y: clamp(nextRect.y, EDGE_PADDING, viewport.height - height - EDGE_PADDING),
  };
}

function formatAssistantError(error: unknown) {
  const message = error instanceof Error ? error.message : 'Assistant request failed.';

  if (message.includes('504 status code')) {
    return '업스트림 LLM 게이트웨이가 시간 초과를 반환했습니다. 잠시 후 다시 시도해 주세요.';
  }

  if (message.includes('403 status code')) {
    return 'API 키 또는 모델 접근 권한이 없습니다. 게이트웨이 권한 설정을 확인해 주세요.';
  }

  if (message.includes('400 status code')) {
    return 'LLM 요청 형식 또는 모델-엔드포인트 조합이 올바르지 않습니다.';
  }

  return message;
}

export function AssistantWorkspacePanel({
  projects,
  documents,
  tasks,
  schedules,
  currentUserId,
  activeProjectId,
  activeDocumentId,
  recentProjectIds,
  createProject,
  createDocument,
  createTask,
  createSchedule,
  deleteDocument,
  deleteTask,
  updateTaskStatus,
  logout = () => undefined,
  setAppTheme = () => undefined,
  setActiveProjectContext,
  setActiveDocumentContext,
}: AssistantWorkspacePanelProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const toggleButtonRef = useRef<HTMLButtonElement | null>(null);
  const panelTransitionTimerRef = useRef<number | null>(null);
  const interactionRef = useRef<
    | {
        type: 'move';
        pointerId: number;
        offsetX: number;
        offsetY: number;
      }
    | {
        type: 'resize';
        pointerId: number;
        startX: number;
        startY: number;
        startWidth: number;
        startHeight: number;
      }
    | null
  >(null);

  const [panelPhase, setPanelPhase] = useState<AssistantPanelPhase>('closed');
  const [assistantInput, setAssistantInput] = useState('');
  const [panelRect, setPanelRect] = useState<PanelRect>(() => getDefaultPanelRect());
  const [panelOrigin, setPanelOrigin] = useState<PanelOrigin>({
    x: DEFAULT_PANEL_WIDTH - 56,
    y: DEFAULT_PANEL_HEIGHT - 56,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<PendingAssistantAction | null>(null);
  const [assistantMessages, setAssistantMessages] = useState<AssistantMessage[]>([
    createMessage('assistant', '프로젝트 이름이나 작업 의도를 입력하면 해당 워크스페이스로 바로 이동합니다.'),
  ]);

  const activeProject = projects.find((project) => project.id === activeProjectId) ?? null;
  const assistantOpen = panelPhase === 'opening' || panelPhase === 'open';
  const isPanelMounted = panelPhase !== 'closed';
  const quickPrompts = buildQuickPrompts({
    projects,
    recentProjectIds,
    activeProjectId,
  });

  useEffect(() => {
    function handleViewportResize() {
      setPanelRect((current) => clampPanelRect(current));
    }

    window.addEventListener('resize', handleViewportResize);
    return () => window.removeEventListener('resize', handleViewportResize);
  }, []);

  useEffect(
    () => () => {
      if (panelTransitionTimerRef.current !== null) {
        window.clearTimeout(panelTransitionTimerRef.current);
      }
    },
    [],
  );

  useEffect(() => {
    function handlePointerMove(event: PointerEvent) {
      const interaction = interactionRef.current;

      if (!interaction) {
        return;
      }

      if (interaction.type === 'move') {
        setPanelRect((current) =>
          clampPanelRect({
            ...current,
            x: event.clientX - interaction.offsetX,
            y: event.clientY - interaction.offsetY,
          }),
        );
        return;
      }

      setPanelRect((current) =>
        clampPanelRect({
          ...current,
          width: interaction.startWidth + (event.clientX - interaction.startX),
          height: interaction.startHeight + (event.clientY - interaction.startY),
        }),
      );
    }

    function handlePointerUp(event: PointerEvent) {
      if (interactionRef.current?.pointerId === event.pointerId) {
        interactionRef.current = null;
      }
    }

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, []);

  async function applyPrompt(prompt: string) {
    const trimmedPrompt = prompt.trim();

    if (!trimmedPrompt) {
      return;
    }

    const userMessage = createMessage('user', trimmedPrompt);
    setAssistantMessages((current) => [...current, userMessage].slice(-8));

    if (pendingAction) {
      if (isConfirmationPrompt(trimmedPrompt)) {
        if (pendingAction.kind === 'delete_task') {
          deleteTask(pendingAction.id);
          if (pendingAction.projectId) {
            setActiveProjectContext(pendingAction.projectId);
            navigate(`/projects/${pendingAction.projectId}/tasks`);
          }
          setAssistantMessages((current) =>
            [...current, createMessage('assistant', `"${pendingAction.title}" 작업을 삭제했습니다.`)].slice(-8),
          );
        } else {
          deleteDocument(pendingAction.id);
          setActiveDocumentContext(null);
          if (pendingAction.projectId) {
            setActiveProjectContext(pendingAction.projectId);
            navigate(`/projects/${pendingAction.projectId}/docs`);
          }
          setAssistantMessages((current) =>
            [...current, createMessage('assistant', `"${pendingAction.title}" 문서를 삭제했습니다.`)].slice(-8),
          );
        }

        setPendingAction(null);
        setStatusMessage(null);
        return;
      }

      if (isCancellationPrompt(trimmedPrompt)) {
        setPendingAction(null);
        setAssistantMessages((current) =>
          [...current, createMessage('assistant', '삭제 요청을 취소했습니다.')].slice(-8),
        );
        setStatusMessage(null);
        return;
      }

      setAssistantMessages((current) =>
        [
          ...current,
          createMessage('assistant', '삭제 확인이 필요합니다. "삭제 진행" 또는 "취소"로 답해주세요.', [
            '삭제 진행',
            '취소',
          ]),
        ].slice(-8),
      );
      setStatusMessage(null);
      return;
    }

    setIsLoading(true);
    setStatusMessage('LLM 응답을 불러오는 중입니다.');

    const history: AssistantHistoryItem[] = assistantMessages.map((message) => ({
      role: message.role,
      text: message.text,
    }));
    const localResolved = resolveAssistantPrompt(trimmedPrompt, {
      projects,
      documents,
      tasks,
      schedules,
      activeProjectId,
      recentProjectIds,
    });

    try {
      const response = await requestAssistantResponse({
        message: trimmedPrompt,
        history,
        workspace: buildWorkspacePayload({
          currentRoute: location.pathname,
          activeProjectId,
          activeDocumentId,
          recentProjectIds,
          projects,
          documents,
          tasks,
          schedules,
        }),
      });
      const shouldUseLocalNavigationFallback =
        response.action.type === 'none' &&
        !response.action.path &&
        Boolean(localResolved.path);
      const shouldUseLocalExecutionFallback =
        response.action.type === 'none' &&
        !response.action.path &&
        (Boolean(localResolved.path) || Boolean(localResolved.theme) || Boolean(localResolved.shouldLogout));
      const navigationProjectId = shouldUseLocalNavigationFallback
        ? (localResolved.projectId ?? null)
        : response.action.projectId;
      const navigationDocumentId = shouldUseLocalNavigationFallback
        ? (localResolved.documentId ?? null)
        : response.action.documentId;
      const navigationPath = shouldUseLocalNavigationFallback
        ? localResolved.path ?? null
        : response.action.path;
      const assistantMessage = shouldUseLocalExecutionFallback ? localResolved.message : response.message;
      const assistantSuggestions = shouldUseLocalExecutionFallback
        ? (localResolved.suggestions ?? response.suggestions)
        : response.suggestions;

      setAssistantMessages((current) =>
        [...current, createMessage('assistant', assistantMessage, assistantSuggestions)].slice(-8),
      );

      if (navigationProjectId !== null) {
        setActiveProjectContext(navigationProjectId);
      }

      if (navigationDocumentId !== null) {
        setActiveDocumentContext(navigationDocumentId);
      }

      if ((response.action.type === 'navigate' && response.action.path) || shouldUseLocalNavigationFallback) {
        navigate(navigationPath!);
      }

      if (shouldUseLocalExecutionFallback && localResolved.theme) {
        setAppTheme(localResolved.theme);
      }

      if (shouldUseLocalExecutionFallback && localResolved.shouldLogout) {
        logout();
        navigate('/login');
      }

      if (response.action.type === 'create_project' && response.action.title) {
        const duplicateProject =
          projects.find(
            (project) => normalizeProjectTitle(project.title) === normalizeProjectTitle(response.action.title ?? ''),
          ) ?? null;

        if (duplicateProject) {
          setActiveProjectContext(duplicateProject.id);
          navigate(`/projects/${duplicateProject.id}`);
        } else {
          const createdProjectId = createProject({
            title: response.action.title,
            description: response.action.description || `${response.action.title} 프로젝트 작업 공간입니다.`,
            status: response.action.status ?? 'Planning',
            memberIds: currentUserId ? [currentUserId] : [],
          });

          setActiveProjectContext(createdProjectId);
          setActiveDocumentContext(null);
          navigate(`/projects/${createdProjectId}`);
        }
      }

      if (response.action.type === 'create_task' && response.action.title) {
        const targetProjectId = response.action.projectId ?? activeProjectId;

        if (targetProjectId) {
          createTask({
            projectId: targetProjectId,
            title: response.action.title,
            description: response.action.description || `${response.action.title} 작업입니다.`,
            status: 'Todo',
            priority: response.action.priority ?? 'Medium',
            assigneeId: currentUserId ?? '',
            dueDate: response.action.dueDate ?? getDefaultTaskDueDate(),
          });

          setActiveProjectContext(targetProjectId);
          navigate(`/projects/${targetProjectId}/tasks`);
        }
      }

      if (response.action.type === 'create_document' && response.action.title) {
        const targetProjectId = response.action.projectId ?? activeProjectId;

        if (targetProjectId && currentUserId) {
          const createdDocumentId = createDocument({
            projectId: targetProjectId,
            title: response.action.title,
            body: response.action.body || response.action.description || `${response.action.title} 문서 초안입니다.`,
            tags: response.action.tags ?? [],
            authorId: currentUserId,
            relatedTaskIds: [],
          });

          setActiveProjectContext(targetProjectId);
          setActiveDocumentContext(createdDocumentId);
          navigate(`/projects/${targetProjectId}/docs/${createdDocumentId}`);
        }
      }

      if (response.action.type === 'create_schedule' && response.action.title) {
        const targetProjectId = response.action.projectId ?? activeProjectId;

        if (targetProjectId && response.action.day && response.action.startTime && response.action.endTime) {
          createSchedule({
            title: response.action.title,
            type: response.action.scheduleType ?? 'Project',
            projectId: targetProjectId,
            day: response.action.day,
            startTime: response.action.startTime,
            endTime: response.action.endTime,
            location: response.action.location ?? '',
            note: response.action.note ?? '',
          });

          setActiveProjectContext(targetProjectId);
          navigate(`/projects/${targetProjectId}/schedule`);
        }
      }

      if (response.action.type === 'update_task_status' && response.action.taskId && response.action.taskStatus) {
        updateTaskStatus(response.action.taskId, response.action.taskStatus);

        if (response.action.projectId) {
          setActiveProjectContext(response.action.projectId);
          navigate(`/projects/${response.action.projectId}/tasks`);
        }
      }

      if (response.action.type === 'confirm_delete_task' && response.action.taskId && response.action.title) {
        setPendingAction({
          kind: 'delete_task',
          id: response.action.taskId,
          projectId: response.action.projectId,
          title: response.action.title,
        });
      }

      if (response.action.type === 'confirm_delete_document' && response.action.documentId && response.action.title) {
        setPendingAction({
          kind: 'delete_document',
          id: response.action.documentId,
          projectId: response.action.projectId,
          title: response.action.title,
        });
      }

      setStatusMessage(null);
    } catch (error) {
      const fallback = resolveAssistantPrompt(trimmedPrompt, {
        projects,
        documents,
        tasks,
        schedules,
        activeProjectId,
        recentProjectIds,
      });

      setAssistantMessages((current) =>
        [...current, createMessage('assistant', fallback.message, fallback.suggestions)].slice(-8),
      );

      if (fallback.projectId !== undefined) {
        setActiveProjectContext(fallback.projectId);
      }

      if (fallback.documentId !== undefined) {
        setActiveDocumentContext(fallback.documentId);
      }

      if (fallback.theme) {
        setAppTheme(fallback.theme);
      }

      if (fallback.shouldLogout) {
        logout();
        navigate('/login');
        return;
      }

      if (fallback.path) {
        navigate(fallback.path);
      }

      setStatusMessage(`LLM 호출 실패로 로컬 로직으로 처리했습니다. ${formatAssistantError(error)}`);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleAssistantSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const prompt = assistantInput.trim();

    if (!prompt || isLoading) {
      return;
    }

    setAssistantInput('');
    await applyPrompt(prompt);
  }

  function handlePanelMoveStart(event: React.PointerEvent<HTMLDivElement>) {
    if ((event.target as HTMLElement).closest('[data-panel-control="true"]')) {
      return;
    }

    interactionRef.current = {
      type: 'move',
      pointerId: event.pointerId,
      offsetX: event.clientX - panelRect.x,
      offsetY: event.clientY - panelRect.y,
    };
  }

  function handlePanelResizeStart(event: React.PointerEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();

    interactionRef.current = {
      type: 'resize',
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startWidth: panelRect.width,
      startHeight: panelRect.height,
    };
  }

  function handleResetPosition() {
    setPanelRect(getDefaultPanelRect());
  }

  function syncPanelOrigin() {
    const buttonRect = toggleButtonRef.current?.getBoundingClientRect();

    if (!buttonRect) {
      return;
    }

    setPanelOrigin({
      x: buttonRect.left + buttonRect.width / 2 - panelRect.x,
      y: buttonRect.top + buttonRect.height / 2 - panelRect.y,
    });
  }

  function openAssistantPanel() {
    syncPanelOrigin();

    if (panelTransitionTimerRef.current !== null) {
      window.clearTimeout(panelTransitionTimerRef.current);
    }

    setPanelPhase('opening');
    panelTransitionTimerRef.current = window.setTimeout(() => {
      setPanelPhase('open');
      panelTransitionTimerRef.current = null;
    }, PANEL_TRANSITION_MS);
  }

  function closeAssistantPanel() {
    syncPanelOrigin();

    if (panelTransitionTimerRef.current !== null) {
      window.clearTimeout(panelTransitionTimerRef.current);
    }

    setPanelPhase('closing');
    panelTransitionTimerRef.current = window.setTimeout(() => {
      setPanelPhase('closed');
      panelTransitionTimerRef.current = null;
    }, PANEL_TRANSITION_MS);
  }

  function toggleAssistantPanel() {
    if (assistantOpen) {
      closeAssistantPanel();
      return;
    }

    openAssistantPanel();
  }

  return (
    <>
      <div className="fixed bottom-6 right-6 z-40">
        <button
          ref={toggleButtonRef}
          className={cn(
            'group inline-flex items-center gap-3 rounded-full border px-4 py-3 text-sm font-semibold tracking-[-0.01em] shadow-[0_18px_40px_rgba(15,23,42,0.16)] backdrop-blur-md transition-all duration-200',
            assistantOpen
              ? 'border-[rgb(var(--theme-accent-200)_/_0.92)] bg-[rgb(var(--theme-accent-500)_/_0.95)] text-white'
              : 'border-white/80 bg-white/90 text-slate-800 hover:-translate-y-0.5 hover:border-slate-200 hover:bg-white',
          )}
          onClick={toggleAssistantPanel}
          type="button"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/18 text-base shadow-[inset_0_1px_0_rgba(255,255,255,0.25)]">
            AI
          </span>
          <span>{assistantOpen ? '패널 닫기' : 'AI 워크스페이스'}</span>
        </button>
      </div>

      {isPanelMounted ? (
        <section
          aria-label="AI workspace panel"
          className={cn(
            'assistant-panel fixed z-50 overflow-hidden rounded-[28px] border border-white/75 bg-[rgba(255,255,255,0.94)] text-slate-900 shadow-[0_30px_80px_rgba(15,23,42,0.18)] backdrop-blur-xl',
            panelPhase === 'opening' && 'assistant-panel--opening',
            panelPhase === 'open' && 'assistant-panel--open',
            panelPhase === 'closing' && 'assistant-panel--closing',
          )}
          style={{
            width: `${panelRect.width}px`,
            height: `${panelRect.height}px`,
            left: `${panelRect.x}px`,
            top: `${panelRect.y}px`,
            ['--assistant-origin-x' as string]: `${panelOrigin.x}px`,
            ['--assistant-origin-y' as string]: `${panelOrigin.y}px`,
            ['--assistant-enter-x' as string]: `${panelOrigin.x - panelRect.width / 2}px`,
            ['--assistant-enter-y' as string]: `${panelOrigin.y - panelRect.height / 2}px`,
          }}
        >
          <div className="assistant-panel__flare" />
          <div className="flex h-full flex-col" onPointerDown={handlePanelMoveStart} style={{ touchAction: 'none' }}>
            <div className="flex cursor-move items-start justify-between gap-4 border-b border-slate-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(248,250,252,0.9))] px-5 py-4">
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Project-aware assistant</p>
                <h2 className="mt-1 truncate text-[18px] font-semibold tracking-[-0.02em] text-slate-950">AI 워크스페이스</h2>
                <p className="mt-1 text-sm text-slate-500">
                  {activeProject ? `${activeProject.title} 컨텍스트 기준으로 이동합니다.` : '프로젝트를 열거나 이름을 입력해 컨텍스트를 잡으세요.'}
                </p>
              </div>

              <div className="flex items-center gap-2" data-panel-control="true">
                <button
                  className="rounded-full border border-slate-200/80 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:border-slate-300 hover:text-slate-900"
                  onClick={handleResetPosition}
                  type="button"
                >
                  위치 초기화
                </button>
                <button
                  aria-label="Close AI workspace"
                  className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200/80 bg-white text-slate-500 transition hover:border-slate-300 hover:text-slate-900"
                  onClick={closeAssistantPanel}
                  type="button"
                >
                  ×
                </button>
              </div>
            </div>

            <div className="flex min-h-0 flex-1 flex-col px-5 pb-5 pt-4">
              <form className="space-y-3" onSubmit={handleAssistantSubmit}>
                <label className="block">
                  <span className="sr-only">assistant prompt</span>
                  <input
                    className="w-full rounded-[16px] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-[rgb(var(--theme-accent-300)_/_0.95)] focus:ring-2 focus:ring-[rgb(var(--theme-accent-200)_/_0.65)] disabled:cursor-not-allowed disabled:bg-slate-50"
                    disabled={isLoading}
                    onChange={(event) => setAssistantInput(event.target.value)}
                    placeholder="예: 최근 프로젝트 보여줘, 현재 프로젝트 작업 보드 보여줘"
                    value={assistantInput}
                  />
                </label>

                <div className="flex flex-wrap gap-2">
                  <Button disabled={isLoading} type="submit">
                    {isLoading ? '응답 대기 중' : '실행'}
                  </Button>
                  {quickPrompts.map((prompt) => (
                    <button
                      key={prompt}
                      className="rounded-full border border-slate-200/85 bg-slate-50/80 px-3 py-2 text-xs font-medium text-slate-600 transition hover:border-slate-300 hover:bg-white hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-60"
                      disabled={isLoading}
                      onClick={() => setAssistantInput(prompt)}
                      type="button"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </form>

              {statusMessage ? <p className="mt-3 text-xs leading-5 text-slate-500">{statusMessage}</p> : null}

              {activeProject ? (
                <div className="mt-4 rounded-[18px] border border-[rgb(var(--theme-accent-200)_/_0.7)] bg-[rgb(var(--theme-accent-50)_/_0.7)] px-4 py-3">
                  <p className="text-xs font-semibold text-slate-500">현재 컨텍스트</p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">{activeProject.title}</p>
                  {activeDocumentId ? (
                    <p className="mt-1 text-xs text-slate-500">
                      문서 컨텍스트 {documents.find((document) => document.id === activeDocumentId)?.title ?? '선택됨'}
                    </p>
                  ) : null}
                </div>
              ) : null}

              <div className="mt-4 min-h-0 flex-1 overflow-y-auto pr-1">
                <div className="space-y-2">
                  {assistantMessages.map((message) => (
                    <div
                      key={message.id}
                      className={cn(
                        'rounded-[18px] px-4 py-3 text-sm leading-6',
                        message.role === 'assistant'
                          ? 'border border-slate-200/80 bg-slate-50/75 text-slate-700'
                          : 'border border-[rgb(var(--theme-accent-200)_/_0.75)] bg-accent-50/65 text-slate-900',
                      )}
                    >
                      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                        {message.role === 'assistant' ? 'Assistant' : 'You'}
                      </p>
                      <p className="mt-1 whitespace-pre-wrap">{message.text}</p>
                      {message.role === 'assistant' && message.suggestions && message.suggestions.length > 0 ? (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {message.suggestions.map((suggestion) => (
                            <button
                              key={suggestion}
                              className="rounded-full border border-slate-200/85 bg-white/88 px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:border-slate-300 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-60"
                              disabled={isLoading}
                              onClick={() => {
                                void applyPrompt(suggestion);
                              }}
                              type="button"
                            >
                              {suggestion}
                            </button>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <button
              aria-label="Resize AI workspace panel"
              className="absolute bottom-1 right-1 h-8 w-8 cursor-se-resize rounded-full bg-transparent"
              data-panel-control="true"
              onPointerDown={handlePanelResizeStart}
              type="button"
            >
              <span className="pointer-events-none absolute bottom-2 right-2 h-3.5 w-3.5 border-b-2 border-r-2 border-slate-300" />
            </button>
          </div>
        </section>
      ) : null}
    </>
  );
}
