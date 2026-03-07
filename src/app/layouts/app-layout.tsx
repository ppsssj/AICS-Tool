import { Link, NavLink, Outlet } from 'react-router-dom';
import { useLabStore } from '@/app/store/use-lab-store';
import { roleLabels } from '@/shared/lib/labels';
import { Button } from '@/shared/ui/button';

const navItems = [
  { to: '/dashboard', label: '대시보드' },
  { to: '/projects', label: '프로젝트' },
  { to: '/calendar', label: '캘린더' },
  { to: '/settings', label: '설정' },
];

export function AppLayout() {
  const currentUser = useLabStore((state) => state.users.find((user) => user.id === state.currentUserId));
  const logout = useLabStore((state) => state.logout);

  return (
    <div className="min-h-screen bg-shell text-slate-950">
      <div className="mx-auto grid min-h-screen max-w-[1640px] grid-cols-1 gap-0 px-3 py-3 lg:grid-cols-[292px_1fr]">
        <aside className="relative flex min-h-[calc(100vh-24px)] flex-col overflow-hidden rounded-[30px] border border-slate-200/75 bg-[linear-gradient(180deg,rgba(242,245,248,0.98),rgba(236,240,244,0.96))] px-6 py-7 text-slate-900 shadow-[0_18px_36px_rgba(148,163,184,0.12)]">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.9),_transparent_36%),linear-gradient(180deg,rgba(255,255,255,0.45),transparent_18%)]" />
          <div className="absolute inset-y-0 right-0 w-px bg-white/70" />

          {currentUser ? (
            <div className="relative rounded-[25px] border border-white/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.92),rgba(251,252,254,0.86))] p-5 shadow-[0_12px_28px_rgba(148,163,184,0.14),inset_0_1px_0_rgba(255,255,255,0.8)] backdrop-blur-md">
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-[18px] border border-slate-200/80 bg-white/85 text-sm font-semibold text-slate-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.85)]">
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
                  className="inline-flex items-center rounded-[14px] border border-slate-200/80 bg-white/85 px-3 py-2 text-xs font-medium tracking-[-0.01em] text-slate-700 transition hover:border-slate-300/90 hover:bg-white"
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
                      ? 'border-white/85 bg-white/88 text-slate-900 shadow-[0_10px_18px_rgba(148,163,184,0.10),inset_0_1px_0_rgba(255,255,255,0.7)]'
                      : 'border-transparent text-slate-600 hover:border-white/60 hover:bg-white/58 hover:text-slate-800',
                  ].join(' ')
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>

          {currentUser ? (
            <div className="relative mt-auto pt-10">
              <div className="rounded-[24px] border border-white/75 bg-[linear-gradient(180deg,rgba(255,255,255,0.8),rgba(248,250,252,0.72))] p-5 shadow-[0_12px_24px_rgba(148,163,184,0.12),inset_0_1px_0_rgba(255,255,255,0.75)] backdrop-blur-md">
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">세션</p>
                <p className="mt-3 text-sm leading-6 text-slate-600">주간 작업 모드</p>
                <Button
                  variant="ghost"
                  className="mt-5 w-full justify-between border border-slate-200/85 bg-white/85 px-4 text-slate-700 hover:border-slate-300/90 hover:bg-white"
                  onClick={logout}
                >
                  로그아웃
                  <span className="text-slate-400">{'>'}</span>
                </Button>
              </div>
            </div>
          ) : null}
        </aside>

        <div className="flex min-h-screen flex-col overflow-hidden rounded-[30px] border border-white/80 bg-[rgba(251,251,252,0.88)] shadow-soft backdrop-blur-sm">
          <header className="border-b border-slate-200/80 bg-white/70 px-8 py-5 backdrop-blur">
            <div className="flex justify-end">
              <div className="rounded-full border border-slate-200/90 bg-white/90 px-4 py-2 text-sm text-slate-600 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]">
                주간 작업 모드
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
