import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { useLabStore } from '@/app/store/use-lab-store';
import { roleLabels } from '@/shared/lib/labels';
import { Button } from '@/shared/ui/button';

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
      items.push({ label: document?.title ?? '문서' });
      return items;
    }

    if (segments[2] === 'tasks') {
      items.push({ label: '작업' });
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
  const currentUserId = useLabStore((state) => state.currentUserId);
  const documents = useLabStore((state) => state.documents);
  const logout = useLabStore((state) => state.logout);
  const projects = useLabStore((state) => state.projects);
  const users = useLabStore((state) => state.users);
  const currentUser = users.find((user) => user.id === currentUserId);
  const breadcrumbs = buildBreadcrumbs(location.pathname, projects, documents);
  const contextLabel = breadcrumbs.length > 1 ? breadcrumbs.slice(-2).map((item) => item.label).join(' / ') : breadcrumbs[0]?.label;

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
                  {currentUser.name.split(' ').map((part) => part[0]).slice(0, 2).join('')}
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">Lab OS</p>
                  <h1 className="mt-1 text-lg font-semibold tracking-[-0.02em] text-slate-800">연구 워크플로 허브</h1>
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
              {contextLabel ? (
                <p className="text-sm font-semibold tracking-[-0.01em] text-slate-700">{contextLabel}</p>
              ) : null}
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
