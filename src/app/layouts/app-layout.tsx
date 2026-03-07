import { useEffect, useMemo, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useLabStore } from '@/app/store/use-lab-store';
import { resolveAssistantPrompt } from '@/features/assistant/mock-project-assistant';
import { roleLabels } from '@/shared/lib/labels';
import { cn } from '@/shared/lib/cn';
import { Button } from '@/shared/ui/button';

const navItems = [
  { to: '/dashboard', label: '대시보드' },
  { to: '/projects', label: '프로젝트' },
  { to: '/calendar', label: '캘린더' },
  { to: '/settings', label: '설정' },
];

const quickPrompts = ['졸업작품 프로젝트 열기', '이 프로젝트 작업 보드 보여줘', '반도체 분석 일정 열기'];

interface BreadcrumbItem {
  label: string;
  to?: string;
}

interface AssistantMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  suggestions?: string[];
}

function createMessage(role: AssistantMessage['role'], text: string, suggestions?: string[]): AssistantMessage {
  return {
    id: `${role}-${Math.random().toString(36).slice(2, 9)}`,
    role,
    text,
    suggestions,
  };
}

function buildBreadcrumbs(
  pathname: string,
  projects: Array<{ id: string; title: string }>,
  documents: Array<{ id: string; projectId: string; title: string }>,
): BreadcrumbItem[] {
  const segments = pathname.split('/').filter(Boolean);

  if (segments[0] === 'dashboard') {
    return [{ label: '대시보드' }];
  }

  if (segments[0] === 'calendar') {
    return [{ label: '캘린더' }];
  }

  if (segments[0] === 'settings') {
    return [{ label: '설정' }];
  }

  if (segments[0] === 'projects' && !segments[1]) {
    return [{ label: '프로젝트' }];
  }

  if (segments[0] === 'projects' && segments[1]) {
    const project = projects.find((item) => item.id === segments[1]);
    const items: BreadcrumbItem[] = [
      { label: '프로젝트', to: '/projects' },
      { label: project?.title ?? '프로젝트', to: `/projects/${segments[1]}` },
    ];

    if (segments[2] === 'docs' && !segments[3]) {
      items.push({ label: '문서' });
      return items;
    }

    if (segments[2] === 'docs' && segments[3]) {
      const document = documents.find((item) => item.id === segments[3] && item.projectId === segments[1]);
      items.push({ label: '문서', to: `/projects/${segments[1]}/docs` });
      items.push({ label: document?.title ?? '문서 상세' });
      return items;
    }

    if (segments[2] === 'tasks') {
      items.push({ label: '작업 보드' });
      return items;
    }

    if (segments[2] === 'schedule') {
      items.push({ label: '일정' });
      return items;
    }

    if (segments[2] === 'members') {
      items.push({ label: '멤버' });
      return items;
    }

    items.push({ label: '개요' });
    return items;
  }

  return [];
}

export function AppLayout() {
  const location = useLocation();
  const navigate = useNavigate();

  const currentUserId = useLabStore((state) => state.currentUserId);
  const documents = useLabStore((state) => state.documents);
  const logout = useLabStore((state) => state.logout);
  const projects = useLabStore((state) => state.projects);
  const schedules = useLabStore((state) => state.schedules);
  const tasks = useLabStore((state) => state.tasks);
  const users = useLabStore((state) => state.users);
  const activeProjectId = useLabStore((state) => state.activeProjectId);
  const activeDocumentId = useLabStore((state) => state.activeDocumentId);
  const recentProjectIds = useLabStore((state) => state.recentProjectIds);
  const setActiveProjectContext = useLabStore((state) => state.setActiveProjectContext);
  const setActiveDocumentContext = useLabStore((state) => state.setActiveDocumentContext);

  const [assistantOpen, setAssistantOpen] = useState(false);
  const [assistantInput, setAssistantInput] = useState('');
  const [assistantMessages, setAssistantMessages] = useState<AssistantMessage[]>([
    createMessage('assistant', '프로젝트 이름이나 작업 의도를 입력하면 해당 워크스페이스로 바로 이동합니다.'),
  ]);

  const currentUser = users.find((user) => user.id === currentUserId);
  const breadcrumbs = buildBreadcrumbs(location.pathname, projects, documents);
  const contextLabel = breadcrumbs.length > 1 ? breadcrumbs.slice(-2).map((item) => item.label).join(' / ') : breadcrumbs[0]?.label;
  const activeProject = projects.find((project) => project.id === activeProjectId) ?? null;
  const activeDocument = documents.find((document) => document.id === activeDocumentId) ?? null;

  useEffect(() => {
    const segments = location.pathname.split('/').filter(Boolean);

    if (segments[0] === 'projects' && segments[1] && projects.some((project) => project.id === segments[1])) {
      if (segments[1] !== activeProjectId) {
        setActiveProjectContext(segments[1]);
      }

      if (segments[2] === 'docs' && segments[3]) {
        if (segments[3] !== activeDocumentId) {
          setActiveDocumentContext(segments[3]);
        }
      } else if (activeDocumentId !== null) {
        setActiveDocumentContext(null);
      }

      return;
    }

    if (activeDocumentId !== null) {
      setActiveDocumentContext(null);
    }
  }, [activeDocumentId, activeProjectId, location.pathname, projects, setActiveDocumentContext, setActiveProjectContext]);

  useEffect(() => {
    if (activeProjectId && !projects.some((project) => project.id === activeProjectId)) {
      setActiveProjectContext(null);
    }
  }, [activeProjectId, projects, setActiveProjectContext]);

  const recentProjects = useMemo(
    () =>
      recentProjectIds
        .map((projectId) => projects.find((project) => project.id === projectId))
        .filter((project): project is NonNullable<typeof project> => Boolean(project)),
    [projects, recentProjectIds],
  );

  function applyPrompt(prompt: string) {
    const response = resolveAssistantPrompt(prompt, {
      projects,
      documents,
      tasks,
      schedules,
      activeProjectId,
      recentProjectIds,
    });

    setAssistantMessages((current) =>
      [...current, createMessage('user', prompt), createMessage('assistant', response.message, response.suggestions)].slice(-8),
    );

    if (response.projectId !== undefined) {
      setActiveProjectContext(response.projectId);
    }

    if (response.documentId !== undefined) {
      setActiveDocumentContext(response.documentId);
    }

    if (response.path) {
      navigate(response.path);
    }
  }

  function handleAssistantSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const prompt = assistantInput.trim();

    if (!prompt) {
      return;
    }

    applyPrompt(prompt);
    setAssistantInput('');
  }

  return (
    <div className="min-h-screen bg-shell text-slate-950">
      <div className="mx-auto grid min-h-screen max-w-[1640px] grid-cols-1 gap-0 px-3 py-3 lg:grid-cols-[292px_1fr]">
        <aside className="relative flex min-h-[calc(100vh-24px)] flex-col overflow-hidden rounded-[30px] border border-[rgb(var(--theme-sidebar-border)_/_0.8)] bg-[rgb(var(--theme-sidebar-bg)_/_0.9)] px-6 py-7 text-slate-900 shadow-[0_18px_36px_rgba(148,163,184,0.12)]">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.82),_transparent_38%),linear-gradient(180deg,rgba(255,255,255,0.38),transparent_18%)]" />
          <div className="absolute inset-y-0 right-0 w-px bg-white/70" />

          {currentUser ? (
            <div className="relative rounded-[25px] border border-[rgb(var(--theme-sidebar-card-border)_/_0.96)] bg-[rgb(var(--theme-sidebar-card-bg)_/_0.9)] p-5 shadow-[0_12px_28px_rgba(148,163,184,0.14),inset_0_1px_0_rgba(255,255,255,0.8)] backdrop-blur-md">
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-[18px] border border-slate-200/80 bg-white/88 text-sm font-semibold text-slate-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.85)]">
                  {currentUser.name
                    .split(' ')
                    .map((part) => part[0])
                    .slice(0, 2)
                    .join('')}
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">Lab OS</p>
                  <h1 className="mt-1 text-lg font-semibold tracking-[-0.02em] text-slate-800">연구 워크플로 운영 허브</h1>
                </div>
              </div>

              <div className="mt-5 border-t border-slate-200/70 pt-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">현재 사용자</p>
                <h2 className="mt-3 truncate text-[16px] font-semibold tracking-[-0.02em] text-slate-900">
                  {currentUser.name}
                </h2>
                <p className="mt-1 text-sm text-slate-600">{currentUser.title}</p>
                <p className="mt-3 text-xs uppercase tracking-[0.16em] text-slate-400">
                  {roleLabels[currentUser.role]} / AICS Lab
                </p>
                <p className="mt-2 truncate text-sm text-slate-500">{currentUser.email}</p>
              </div>

              <div className="mt-5">
                <Link
                  className="inline-flex items-center rounded-[14px] border border-slate-200/80 bg-white/86 px-3 py-2 text-xs font-medium tracking-[-0.01em] text-slate-700 transition hover:border-slate-300/90 hover:bg-white"
                  to="/settings"
                >
                  설정 열기
                </Link>
              </div>
            </div>
          ) : null}

          <nav className="relative mt-8 grid gap-2.5">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  [
                    'group flex items-center rounded-[18px] border px-4 py-3 text-sm font-medium tracking-[-0.01em] transition-all duration-200',
                    isActive
                      ? 'border-[rgb(var(--theme-sidebar-nav-active-border)_/_0.92)] bg-[rgb(var(--theme-sidebar-nav-active-bg)_/_0.94)] text-slate-900 shadow-[0_10px_18px_rgba(148,163,184,0.10),inset_0_1px_0_rgba(255,255,255,0.72)]'
                      : 'border-transparent text-slate-600 hover:border-white/60 hover:bg-[rgb(var(--theme-sidebar-nav-hover-bg)_/_0.72)] hover:text-slate-800',
                  ].join(' ')
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="relative mt-8 rounded-[24px] border border-[rgb(var(--theme-sidebar-card-border)_/_0.88)] bg-[rgb(var(--theme-sidebar-card-bg)_/_0.76)] p-5 shadow-[0_12px_24px_rgba(148,163,184,0.12),inset_0_1px_0_rgba(255,255,255,0.75)] backdrop-blur-md">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">AI 컨텍스트</p>
            {activeProject ? (
              <div className="mt-4 space-y-2">
                <div className="rounded-[18px] border border-slate-200/85 bg-white/85 px-3 py-3">
                  <p className="text-xs font-semibold text-slate-500">활성 프로젝트</p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">{activeProject.title}</p>
                  {activeDocument ? <p className="mt-1 text-xs text-slate-500">문서 컨텍스트: {activeDocument.title}</p> : null}
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="secondary"
                    className="flex-1 px-3 py-2 text-xs"
                    onClick={() => navigate(`/projects/${activeProject.id}`)}
                  >
                    워크스페이스
                  </Button>
                  <Button
                    variant="ghost"
                    className="px-3 py-2 text-xs text-slate-500"
                    onClick={() => {
                      setActiveProjectContext(null);
                      setActiveDocumentContext(null);
                    }}
                  >
                    해제
                  </Button>
                </div>
              </div>
            ) : (
              <p className="mt-4 text-sm leading-6 text-slate-500">아직 활성 프로젝트가 없습니다. 헤더의 AI 워크스페이스에서 프로젝트 이름을 입력해 보세요.</p>
            )}

            {recentProjects.length > 0 ? (
              <div className="mt-4 border-t border-slate-200/80 pt-4">
                <p className="text-xs font-semibold text-slate-500">최근 컨텍스트</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {recentProjects.slice(0, 3).map((project) => (
                    <button
                      key={project.id}
                      className="rounded-full border border-slate-200/80 bg-white/86 px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:border-slate-300 hover:bg-white hover:text-slate-900"
                      onClick={() => {
                        setActiveProjectContext(project.id);
                        navigate(`/projects/${project.id}`);
                      }}
                      type="button"
                    >
                      {project.title}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
          </div>

          {currentUser ? (
            <div className="relative mt-auto pt-10">
              <div className="rounded-[24px] border border-[rgb(var(--theme-sidebar-card-border)_/_0.88)] bg-[rgb(var(--theme-sidebar-card-bg)_/_0.76)] p-5 shadow-[0_12px_24px_rgba(148,163,184,0.12),inset_0_1px_0_rgba(255,255,255,0.75)] backdrop-blur-md">
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">세션</p>
                <Button
                  variant="ghost"
                  className="mt-4 w-full justify-between border border-slate-200/85 bg-white/85 px-4 text-slate-700 hover:border-slate-300/90 hover:bg-white"
                  onClick={logout}
                >
                  로그아웃
                  <span className="text-slate-400">{'>'}</span>
                </Button>
              </div>
            </div>
          ) : null}
        </aside>

        <div className="flex min-h-screen flex-col overflow-hidden rounded-[30px] border border-[rgb(var(--theme-app-border)_/_0.82)] bg-[rgb(var(--theme-app-panel)_/_0.9)] shadow-soft backdrop-blur-sm">
          <header className="border-b border-[rgb(var(--theme-app-border)_/_0.8)] bg-[rgb(var(--theme-app-header)_/_0.82)] px-8 py-5 backdrop-blur">
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                <div className="flex flex-col gap-2">
                  <div className="flex flex-wrap items-center gap-2 text-[12px] font-medium text-slate-500">
                    {breadcrumbs.map((item, index) => (
                      <div key={`${item.label}-${index}`} className="flex items-center gap-2">
                        {item.to && index < breadcrumbs.length - 1 ? (
                          <Link className="transition hover:text-slate-800" to={item.to}>
                            {item.label}
                          </Link>
                        ) : (
                          <span className={index === breadcrumbs.length - 1 ? 'text-slate-800' : undefined}>{item.label}</span>
                        )}
                        {index < breadcrumbs.length - 1 ? <span className="text-slate-300">{'/'}</span> : null}
                      </div>
                    ))}
                  </div>
                  {contextLabel ? <p className="text-sm font-semibold tracking-[-0.01em] text-slate-700">{contextLabel}</p> : null}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {activeProject ? (
                    <button
                      className="rounded-full border border-slate-200/80 bg-white/90 px-3 py-2 text-xs font-medium text-slate-600 transition hover:border-slate-300 hover:text-slate-900"
                      onClick={() => navigate(`/projects/${activeProject.id}`)}
                      type="button"
                    >
                      현재 컨텍스트: {activeProject.title}
                    </button>
                  ) : null}
                  <Button
                    variant={assistantOpen ? 'secondary' : 'ghost'}
                    className="px-4"
                    onClick={() => setAssistantOpen((current) => !current)}
                  >
                    AI 워크스페이스
                  </Button>
                </div>
              </div>

              <div
                className={cn(
                  'overflow-hidden transition-all duration-200',
                  assistantOpen ? 'max-h-[480px] opacity-100' : 'max-h-0 opacity-0',
                )}
              >
                <div className="grid gap-4 rounded-[24px] border border-slate-200/85 bg-white/82 p-4 shadow-[0_14px_28px_rgba(148,163,184,0.10)] xl:grid-cols-[1.3fr_0.7fr]">
                  <div>
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Project-aware assistant</p>
                        <h2 className="mt-1 text-[18px] font-semibold tracking-[-0.02em] text-slate-950">프로젝트 맥락 이동 테스트</h2>
                      </div>
                      {activeProject ? (
                        <span className="rounded-full border border-accent-200/80 bg-accent-50/70 px-3 py-1.5 text-xs font-medium text-accent-700">
                          {activeProject.title}
                        </span>
                      ) : null}
                    </div>

                    <form className="mt-4 space-y-3" onSubmit={handleAssistantSubmit}>
                      <label className="block">
                        <span className="sr-only">assistant prompt</span>
                        <input
                          className="w-full rounded-[16px] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-[rgb(var(--theme-accent-300)_/_0.95)] focus:ring-2 focus:ring-[rgb(var(--theme-accent-200)_/_0.65)]"
                          onChange={(event) => setAssistantInput(event.target.value)}
                          placeholder="예: 졸업작품 프로젝트 열기, 이 프로젝트 문서 보여줘"
                          value={assistantInput}
                        />
                      </label>
                      <div className="flex flex-wrap gap-2">
                        <Button type="submit">실행</Button>
                        {quickPrompts.map((prompt) => (
                          <button
                            key={prompt}
                            className="rounded-full border border-slate-200/85 bg-slate-50/80 px-3 py-2 text-xs font-medium text-slate-600 transition hover:border-slate-300 hover:bg-white hover:text-slate-900"
                            onClick={() => {
                              setAssistantInput(prompt);
                            }}
                            type="button"
                          >
                            {prompt}
                          </button>
                        ))}
                      </div>
                    </form>

                    <div className="mt-4 space-y-2">
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
                          <p className="mt-1">{message.text}</p>
                          {message.role === 'assistant' && message.suggestions && message.suggestions.length > 0 ? (
                            <div className="mt-3 flex flex-wrap gap-2">
                              {message.suggestions.map((suggestion) => (
                                <button
                                  key={suggestion}
                                  className="rounded-full border border-slate-200/85 bg-white/88 px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:border-slate-300 hover:text-slate-900"
                                  onClick={() => applyPrompt(suggestion)}
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

                  <div className="rounded-[20px] border border-slate-200/80 bg-slate-50/70 p-4">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">How it works</p>
                    <div className="mt-4 space-y-3 text-sm leading-6 text-slate-600">
                      <p>프로젝트명을 말하면 해당 워크스페이스로 이동하고 AI 컨텍스트도 같이 바뀝니다.</p>
                      <p>현재 프로젝트 안에 있을 때는 "이 프로젝트 작업 보여줘"처럼 현재 맥락 기준 요청도 처리합니다.</p>
                      <p>문서, 작업, 일정 키워드를 함께 말하면 해당 탭으로 바로 이동합니다.</p>
                    </div>

                    {recentProjects.length > 0 ? (
                      <div className="mt-5 border-t border-slate-200/80 pt-4">
                        <p className="text-xs font-semibold text-slate-500">최근 프로젝트 바로가기</p>
                        <div className="mt-3 grid gap-2">
                          {recentProjects.slice(0, 4).map((project) => (
                            <button
                              key={project.id}
                              className="rounded-[16px] border border-slate-200/85 bg-white/90 px-3 py-2.5 text-left text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-white"
                              onClick={() => {
                                setActiveProjectContext(project.id);
                                setActiveDocumentContext(null);
                                navigate(`/projects/${project.id}`);
                              }}
                              type="button"
                            >
                              {project.title}
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>
          </header>

          <main className="flex-1 px-8 py-8">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
}
