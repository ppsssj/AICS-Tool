import { useNavigate } from 'react-router-dom';
import { useLabStore } from '@/app/store/use-lab-store';
import type { Role } from '@/entities/models';
import { roleLabels } from '@/shared/lib/labels';
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
        title="설정"
        description="MVP 단계에서는 계정 설정을 가볍게 유지하되, 실제 서비스 설정 화면처럼 명확한 구획과 여백을 갖추도록 구성했습니다."
      />

      <div className="grid gap-6 xl:grid-cols-[0.82fr_1.18fr]">
        <Card className="border-slate-200/70">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">계정 요약</p>
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
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">프로필 관리</p>
            <h2 className="mt-2 text-[24px] font-semibold tracking-[-0.03em] text-slate-950">워크스페이스 접근</h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              필수 계정 정보만 우선 노출하고, 이후 백엔드 기반 설정으로 확장하기 쉽게 구성했습니다.
            </p>
          </div>

          <div className="mt-6 grid gap-6">
            <div className="grid gap-5 md:grid-cols-2">
              <div className="rounded-[22px] border border-slate-200/80 bg-slate-50/75 p-5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">이름</p>
                <p className="mt-3 text-[18px] font-semibold tracking-[-0.02em] text-slate-950">{currentUser.name}</p>
              </div>
              <div className="rounded-[22px] border border-slate-200/80 bg-slate-50/75 p-5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">이메일</p>
                <p className="mt-3 text-[18px] font-semibold tracking-[-0.02em] text-slate-950">{currentUser.email}</p>
              </div>
            </div>

            <div className="rounded-[24px] border border-slate-200/80 bg-white/90 p-5">
              <Field label="권한" hint="선택한 권한은 목업 프로필 상태에 반영되며, 이후 실제 권한 체계에 연결할 수 있습니다.">
                <Select value={currentUser.role} onChange={(event) => setCurrentUserRole(event.target.value as Role)}>
                  {roles.map((role) => (
                    <option key={role} value={role}>
                      {roleLabels[role]}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-4 rounded-[24px] border border-rose-200/70 bg-rose-50/70 p-5">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-rose-400">세션</p>
                <p className="mt-2 text-[18px] font-semibold tracking-[-0.02em] text-slate-950">현재 워크스페이스 세션 종료</p>
                <p className="mt-2 text-sm leading-6 text-slate-500">보호된 목업 워크스페이스에서 로그아웃하고 로그인 화면으로 돌아갑니다.</p>
              </div>
              <Button variant="danger" onClick={() => { logout(); navigate('/login'); }}>
                로그아웃
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
