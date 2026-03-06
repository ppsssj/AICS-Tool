import { Link, NavLink, Outlet } from 'react-router-dom';
import { useLabStore } from '@/app/store/use-lab-store';
import { Button } from '@/shared/ui/button';

const navItems = [
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/projects', label: 'Projects' },
  { to: '/calendar', label: 'Calendar' },
  { to: '/settings', label: 'Settings' },
];

export function AppLayout() {
  const currentUser = useLabStore((state) => state.users.find((user) => user.id === state.currentUserId));
  const logout = useLabStore((state) => state.logout);

  return (
    <div className="min-h-screen bg-shell text-slate-950">
      <div className="mx-auto grid min-h-screen max-w-[1640px] grid-cols-1 gap-0 px-3 py-3 lg:grid-cols-[292px_1fr]">
        <aside className="relative flex min-h-[calc(100vh-24px)] flex-col overflow-hidden rounded-[30px] border border-slate-800/40 bg-[linear-gradient(180deg,#111826_0%,#182232_48%,#1a2332_100%)] px-6 py-7 text-slate-200 shadow-float">
          <div className="absolute inset-x-0 top-0 h-32 bg-[radial-gradient(circle_at_top,_rgba(75,116,217,0.22),_transparent_55%)]" />

          {currentUser ? (
            <div className="relative rounded-[24px] border border-white/10 bg-white/[0.06] p-5 backdrop-blur-sm">
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/10 text-sm font-semibold text-white">
                  {currentUser.name.split(' ').map((part) => part[0]).slice(0, 2).join('')}
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">Lab OS</p>
                  <h1 className="mt-1 text-lg font-semibold tracking-[-0.02em] text-white">Research Workflow</h1>
                </div>
              </div>

              <div className="mt-5 border-t border-white/10 pt-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Signed in as</p>
                <h2 className="mt-3 truncate text-[16px] font-semibold tracking-[-0.02em] text-white">
                  {currentUser.name}
                </h2>
                <p className="mt-1 text-sm text-slate-400">{currentUser.title}</p>
                <p className="mt-3 text-xs uppercase tracking-[0.16em] text-slate-500">
                  {currentUser.role} / AICS Lab
                </p>
                <p className="mt-2 truncate text-sm text-slate-400">{currentUser.email}</p>
              </div>

              <div className="mt-5">
                <Link
                  className="inline-flex items-center rounded-[14px] border border-white/10 bg-white/[0.08] px-3 py-2 text-xs font-medium tracking-[-0.01em] text-white transition hover:bg-white/[0.12]"
                  to="/settings"
                >
                  Open settings
                </Link>
              </div>
            </div>
          ) : null}

          <nav className="relative mt-8 grid gap-2">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  [
                    'group flex items-center rounded-[18px] px-4 py-3 text-sm font-medium tracking-[-0.01em] transition-all duration-200',
                    isActive
                      ? 'border border-white/10 bg-white/[0.12] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]'
                      : 'text-slate-300 hover:bg-white/[0.07] hover:text-white',
                  ].join(' ')
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>

          {currentUser ? (
            <div className="relative mt-auto pt-10">
              <div className="rounded-[24px] border border-white/10 bg-white/[0.07] p-5 backdrop-blur-sm">
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">Session</p>
                <p className="mt-3 text-sm leading-6 text-slate-400">Weekly coordination mode</p>
                <Button
                  variant="ghost"
                  className="mt-5 w-full justify-between border border-white/10 bg-white/[0.08] px-4 text-white hover:bg-white/[0.12]"
                  onClick={logout}
                >
                  Log out
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
                Weekly coordination mode
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
