import { useNavigate } from 'react-router-dom';
import { useLabStore } from '@/app/store/use-lab-store';
import type { Role } from '@/entities/models';
import { Button } from '@/shared/ui/button';
import { Card } from '@/shared/ui/card';
import { Field, Select } from '@/shared/ui/field';
import { PageHeader } from '@/shared/ui/page-header';

const roles: Role[] = ['Admin', 'Member', 'Viewer'];

export function SettingsPage() {
  const navigate = useNavigate();
  const { currentUserId, logout, setCurrentUserRole, users } = useLabStore();
  const currentUser = users.find((user) => user.id === currentUserId);

  if (!currentUser) {
    return null;
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Settings"
        description="Account settings remain lightweight in the MVP, but the page is structured like a serious product settings screen with clear grouping and measured spacing."
      />

      <div className="grid gap-6 xl:grid-cols-[0.82fr_1.18fr]">
        <Card className="border-slate-200/70">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Account summary</p>
          <div className="mt-5 flex items-start gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-[20px] bg-accent-50 text-base font-semibold text-accent-700">
              {currentUser.name.split(' ').map((part) => part[0]).slice(0, 2).join('')}
            </div>
            <div>
              <h2 className="text-[24px] font-semibold tracking-[-0.03em] text-slate-950">{currentUser.name}</h2>
              <p className="mt-1 text-sm text-slate-500">{currentUser.email}</p>
              <p className="mt-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">{currentUser.title}</p>
            </div>
          </div>
        </Card>

        <Card className="border-slate-200/70">
          <div className="border-b border-slate-200/80 pb-5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Profile controls</p>
            <h2 className="mt-2 text-[24px] font-semibold tracking-[-0.03em] text-slate-950">Workspace access</h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              Keep the essential account data visible, with a clean extension point for future backend-backed settings.
            </p>
          </div>

          <div className="mt-6 grid gap-6">
            <div className="grid gap-5 md:grid-cols-2">
              <div className="rounded-[22px] border border-slate-200/80 bg-slate-50/75 p-5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Name</p>
                <p className="mt-3 text-[18px] font-semibold tracking-[-0.02em] text-slate-950">{currentUser.name}</p>
              </div>
              <div className="rounded-[22px] border border-slate-200/80 bg-slate-50/75 p-5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Email</p>
                <p className="mt-3 text-[18px] font-semibold tracking-[-0.02em] text-slate-950">{currentUser.email}</p>
              </div>
            </div>

            <div className="rounded-[24px] border border-slate-200/80 bg-white/90 p-5">
              <Field label="Role" hint="The selected role updates the mock profile state and is ready to map to real permissions later.">
                <Select value={currentUser.role} onChange={(event) => setCurrentUserRole(event.target.value as Role)}>
                  {roles.map((role) => (
                    <option key={role} value={role}>
                      {role}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-4 rounded-[24px] border border-rose-200/70 bg-rose-50/70 p-5">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-rose-400">Session</p>
                <p className="mt-2 text-[18px] font-semibold tracking-[-0.02em] text-slate-950">End current workspace session</p>
                <p className="mt-2 text-sm leading-6 text-slate-500">Log out of the protected mock workspace and return to the login screen.</p>
              </div>
              <Button variant="danger" onClick={() => { logout(); navigate('/login'); }}>
                Log out
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
