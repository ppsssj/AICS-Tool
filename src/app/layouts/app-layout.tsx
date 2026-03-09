import { useEffect, useMemo, useRef, useState, type CSSProperties, type MouseEvent } from 'react';
import { Link, NavLink, useLocation, useNavigate, useOutlet } from 'react-router-dom';
import { useLabStore } from '@/app/store/use-lab-store';
import { AssistantWorkspacePanel } from '@/features/assistant/assistant-workspace-panel';
import { roleLabels } from '@/shared/lib/labels';
import { Button } from '@/shared/ui/button';
import Logo from '../../../public/AI CS LAB Logo.png';
const navItems = [
  { to: '/dashboard', label: '대시보드' },
  { to: '/projects', label: '프로젝트' },
  { to: '/calendar', label: '캘린더' },
  { to: '/settings', label: '설정' },
];

interface BreadcrumbItem {
  label: string;
  to?: string;
}

interface TransitionView {
  key: string;
  pathname: string;
  element: ReturnType<typeof useOutlet>;
}

interface NavOriginFlare {
  key: string;
  x: number;
  y: number;
  size: number;
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
  const outlet = useOutlet();
  const mainPanelRef = useRef<HTMLDivElement | null>(null);
  const mainContentRef = useRef<HTMLElement | null>(null);
  const transitionTimerRef = useRef<number | null>(null);
  const renderedViewRef = useRef<TransitionView>({
    key: location.key || location.pathname,
    pathname: location.pathname,
    element: outlet,
  });
  const [renderedView, setRenderedView] = useState<TransitionView>(renderedViewRef.current);
  const [previousView, setPreviousView] = useState<TransitionView | null>(null);
  const [isPanelTransitioning, setIsPanelTransitioning] = useState(false);
  const [navTransitionSource, setNavTransitionSource] = useState<string | null>(null);
  const [navOriginFlare, setNavOriginFlare] = useState<NavOriginFlare | null>(null);

  const currentUserId = useLabStore((state) => state.currentUserId);
  const createProject = useLabStore((state) => state.createProject);
  const createDocument = useLabStore((state) => state.createDocument);
  const createTask = useLabStore((state) => state.createTask);
  const createSchedule = useLabStore((state) => state.createSchedule);
  const deleteDocument = useLabStore((state) => state.deleteDocument);
  const deleteTask = useLabStore((state) => state.deleteTask);
  const updateTaskStatus = useLabStore((state) => state.updateTaskStatus);
  const documents = useLabStore((state) => state.documents);
  const logout = useLabStore((state) => state.logout);
  const setAppTheme = useLabStore((state) => state.setAppTheme);
  const projects = useLabStore((state) => state.projects);
  const schedules = useLabStore((state) => state.schedules);
  const tasks = useLabStore((state) => state.tasks);
  const users = useLabStore((state) => state.users);
  const activeProjectId = useLabStore((state) => state.activeProjectId);
  const activeDocumentId = useLabStore((state) => state.activeDocumentId);
  const recentProjectIds = useLabStore((state) => state.recentProjectIds);
  const setActiveProjectContext = useLabStore((state) => state.setActiveProjectContext);
  const setActiveDocumentContext = useLabStore((state) => state.setActiveDocumentContext);

  const currentUser = users.find((user) => user.id === currentUserId);
  const breadcrumbs = buildBreadcrumbs(location.pathname, projects, documents);
  const activeProject = projects.find((project) => project.id === activeProjectId) ?? null;
  const activeDocument = documents.find((document) => document.id === activeDocumentId) ?? null;
  const showBreadcrumbs = breadcrumbs.length > 1;

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

  useEffect(() => {
    renderedViewRef.current = renderedView;
  }, [renderedView]);

  useEffect(() => {
    if (renderedViewRef.current.pathname === location.pathname) {
      if (renderedViewRef.current.element !== outlet) {
        const updatedView = {
          ...renderedViewRef.current,
          element: outlet,
        };
        renderedViewRef.current = updatedView;
        setRenderedView(updatedView);
      }
      return;
    }

    setPreviousView(renderedViewRef.current);

    const nextView = {
      key: location.key || `${location.pathname}-${Date.now()}`,
      pathname: location.pathname,
      element: outlet,
    };

    renderedViewRef.current = nextView;
    setRenderedView(nextView);
    setIsPanelTransitioning(true);
    mainContentRef.current?.scrollTo({ top: 0, behavior: 'auto' });

    if (transitionTimerRef.current !== null) {
      window.clearTimeout(transitionTimerRef.current);
    }

    transitionTimerRef.current = window.setTimeout(() => {
      setPreviousView(null);
      setIsPanelTransitioning(false);
      setNavTransitionSource(null);
      setNavOriginFlare(null);
      transitionTimerRef.current = null;
    }, 520);
  }, [location.key, location.pathname, outlet]);

  useEffect(
    () => () => {
      if (transitionTimerRef.current !== null) {
        window.clearTimeout(transitionTimerRef.current);
      }
    },
    [],
  );

  function handleNavOrigin(event: MouseEvent<HTMLAnchorElement>, to: string) {
    if (to === location.pathname || !mainPanelRef.current) {
      return;
    }

    const triggerRect = event.currentTarget.getBoundingClientRect();
    const panelRect = mainPanelRef.current.getBoundingClientRect();

    setNavTransitionSource(to);
    setNavOriginFlare({
      key: `${to}-${Date.now()}`,
      x: triggerRect.right - panelRect.left + 18,
      y: triggerRect.top + triggerRect.height / 2 - panelRect.top,
      size: Math.max(panelRect.width, panelRect.height) * 1.08,
    });
  }

  const navFlareStyle = navOriginFlare
    ? ({
        '--nav-origin-x': `${navOriginFlare.x}px`,
        '--nav-origin-y': `${navOriginFlare.y}px`,
        '--nav-origin-size': `${navOriginFlare.size}px`,
      } as CSSProperties)
    : undefined;

  return (
    <div className="min-h-screen bg-shell text-slate-950 lg:h-screen lg:overflow-hidden">
      <div className="mx-auto grid min-h-screen max-w-[1640px] grid-cols-1 gap-0 px-3 py-3 lg:h-screen lg:grid-cols-[272px_1fr]">
        <aside className="relative flex min-h-[calc(100vh-24px)] flex-col overflow-hidden rounded-[28px] border border-[rgb(var(--theme-sidebar-border)_/_0.8)] bg-[rgb(var(--theme-sidebar-bg)_/_0.9)] px-5 py-6 text-slate-900 shadow-[0_18px_36px_rgba(148,163,184,0.12)] lg:h-[calc(100vh-24px)] lg:overflow-y-auto">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.82),_transparent_38%),linear-gradient(180deg,rgba(255,255,255,0.38),transparent_18%)]" />
          <div className="absolute inset-y-0 right-0 w-px bg-white/70" />

          {currentUser ? (
            <div className="group relative rounded-[22px] border border-[rgb(var(--theme-sidebar-card-border)_/_0.96)] bg-[rgb(var(--theme-sidebar-card-bg)_/_0.9)] p-2 shadow-[0_12px_28px_rgba(148,163,184,0.14),inset_0_1px_0_rgba(255,255,255,0.8)] backdrop-blur-md">
              <div className="max-h-0 overflow-hidden rounded-[14px] border border-transparent bg-white/72 opacity-0 transition-all duration-200 group-hover:mb-2 group-hover:max-h-28 group-hover:border-slate-200/70 group-hover:opacity-100 group-focus-within:mb-2 group-focus-within:max-h-28 group-focus-within:border-slate-200/70 group-focus-within:opacity-100">
                <div className="flex justify-center px-0 py-0">
                  <img alt="AICS Lab" className="h-24 w-full object-contain" src={Logo} />
                </div>
              </div>

              <div className="border-t border-slate-200/70 pt-2">

                <h2 className="mt-1.5 truncate text-[15px] font-semibold tracking-[-0.02em] text-slate-900">{currentUser.name}</h2>
                <p className="mt-1 text-sm text-slate-600">{currentUser.title}</p>
                <p className="mt-2 text-[11px] uppercase tracking-[0.16em] text-slate-400">{roleLabels[currentUser.role]} / AICS Lab</p>
                <p className="mt-1.5 truncate text-sm text-slate-500">{currentUser.email}</p>
              </div>

              <div className="mt-3">
                <Link
                  className="inline-flex items-center rounded-[14px] border border-slate-200/80 bg-white/86 px-3 py-1.5 text-xs font-medium tracking-[-0.01em] text-slate-700 transition hover:border-slate-300/90 hover:bg-white"
                  to="/settings"
                >
                  설정 열기
                </Link>
              </div>
            </div>
          ) : null}

          <nav className="relative mt-6 grid gap-2">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={(event) => handleNavOrigin(event, item.to)}
                className={({ isActive }) =>
                  [
                    'group flex items-center rounded-[16px] border px-4 py-2.5 text-sm font-medium tracking-[-0.01em] transition-all duration-200',
                    isActive
                      ? 'border-[rgb(var(--theme-sidebar-nav-active-border)_/_0.92)] bg-[rgb(var(--theme-sidebar-nav-active-bg)_/_0.94)] text-slate-900 shadow-[0_10px_18px_rgba(148,163,184,0.10),inset_0_1px_0_rgba(255,255,255,0.72)]'
                      : 'border-transparent text-slate-600 hover:border-white/60 hover:bg-[rgb(var(--theme-sidebar-nav-hover-bg)_/_0.72)] hover:text-slate-800',
                    isPanelTransitioning && navTransitionSource === item.to
                      ? 'border-[rgb(var(--theme-accent-200)_/_0.92)] bg-[rgb(var(--theme-accent-50)_/_0.9)] text-slate-900 shadow-[0_14px_26px_rgba(75,116,217,0.12)]'
                      : null,
                  ].join(' ')
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="relative mt-6 rounded-[22px] border border-[rgb(var(--theme-sidebar-card-border)_/_0.88)] bg-[rgb(var(--theme-sidebar-card-bg)_/_0.76)] p-4 shadow-[0_12px_24px_rgba(148,163,184,0.12),inset_0_1px_0_rgba(255,255,255,0.75)] backdrop-blur-md">
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
              <p className="mt-4 text-sm leading-6 text-slate-500">
                아직 활성 프로젝트가 없습니다. 오른쪽 아래 AI 워크스페이스에서 프로젝트 이름을 입력하면 바로 연결됩니다.
              </p>
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
            <div className="relative mt-auto pt-6">
              <div className="rounded-[22px] border border-[rgb(var(--theme-sidebar-card-border)_/_0.88)] bg-[rgb(var(--theme-sidebar-card-bg)_/_0.76)] p-4 shadow-[0_12px_24px_rgba(148,163,184,0.12),inset_0_1px_0_rgba(255,255,255,0.75)] backdrop-blur-md">
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">액션</p>
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

        <div
          ref={mainPanelRef}
          className={[
            'app-panel-shell flex min-h-screen flex-col overflow-hidden rounded-[28px] border border-[rgb(var(--theme-app-border)_/_0.82)] bg-[rgb(var(--theme-app-panel)_/_0.9)] shadow-soft backdrop-blur-sm lg:h-[calc(100vh-24px)]',
            isPanelTransitioning ? 'app-panel-shell--transitioning' : '',
          ].join(' ')}
        >
          <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden rounded-[28px]">
            {navOriginFlare ? (
              <div key={navOriginFlare.key} className="app-panel-nav-origin" style={navFlareStyle} />
            ) : null}
            <div
              className={[
                'app-panel-depth-light absolute inset-0 opacity-0 transition-opacity duration-300',
                isPanelTransitioning ? 'opacity-100' : '',
              ].join(' ')}
            />
          </div>
          <header className="border-b border-[rgb(var(--theme-app-border)_/_0.8)] bg-[rgb(var(--theme-app-header)_/_0.82)] px-6 py-2 backdrop-blur">
            <div className="flex flex-col gap-1.5 xl:flex-row xl:items-center xl:justify-between">
              <div className="min-h-[16px]">
                {showBreadcrumbs ? (
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
                ) : null}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {activeProject ? (
                  <button
                    className="rounded-full border border-slate-200/80 bg-white/90 px-3 py-1 text-xs font-medium text-slate-600 transition hover:border-slate-300 hover:text-slate-900"
                    onClick={() => navigate(`/projects/${activeProject.id}`)}
                    type="button"
                  >
                    현재 컨텍스트: {activeProject.title}
                  </button>
                ) : null}
              </div>
            </div>
          </header>

          <main ref={mainContentRef} className="relative min-h-0 flex-1 overflow-y-auto px-6 py-5">
            <div className="app-panel-stage min-h-full">
              {previousView ? (
                <div key={previousView.key} className="app-panel-view app-panel-view--previous">
                  {previousView.element}
                </div>
              ) : null}
              <div
                key={renderedView.key}
                className={[
                  'app-panel-view relative z-[2]',
                  isPanelTransitioning ? 'app-panel-view--current' : '',
                ].join(' ')}
              >
                {renderedView.element}
              </div>
            </div>
          </main>
        </div>
      </div>

      <AssistantWorkspacePanel
        createProject={createProject}
        createDocument={createDocument}
        createTask={createTask}
        createSchedule={createSchedule}
        deleteDocument={deleteDocument}
        deleteTask={deleteTask}
        updateTaskStatus={updateTaskStatus}
        logout={logout}
        setAppTheme={setAppTheme}
        currentUserId={currentUserId}
        activeDocumentId={activeDocumentId}
        activeProjectId={activeProjectId}
        documents={documents}
        projects={projects}
        recentProjectIds={recentProjectIds}
        schedules={schedules}
        setActiveDocumentContext={setActiveDocumentContext}
        setActiveProjectContext={setActiveProjectContext}
        tasks={tasks}
      />
    </div>
  );
}
