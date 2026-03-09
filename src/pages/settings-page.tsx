import { useNavigate } from 'react-router-dom';
import { useLabStore } from '@/app/store/use-lab-store';
import type { Role } from '@/entities/models';
import { roleLabels } from '@/shared/lib/labels';
import { appThemeOptions } from '@/shared/lib/themes';
import { Button } from '@/shared/ui/button';
import { Card } from '@/shared/ui/card';
import { Field, Select } from '@/shared/ui/field';
import { PageHeader } from '@/shared/ui/page-header';

const roles: Role[] = ['Admin', 'Member', 'Viewer'];

export function SettingsPage() {
  const navigate = useNavigate();
  const { appTheme, currentUserId, logout, setAppTheme, setCurrentUserRole, users } = useLabStore();
  const currentUser = users.find((user) => user.id === currentUserId);

  if (!currentUser) {
    return null;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="설정"
      />

      <div className="grid gap-5 xl:grid-cols-[0.82fr_1.18fr]">
        <Card className="border-slate-200/70">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">계정 요약</p>
          <div className="mt-4 flex items-start gap-4">
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
          <div className="border-b border-slate-200/80 pb-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">프로필 관리</p>
            <h2 className="mt-2 text-[22px] font-semibold tracking-[-0.03em] text-slate-950">워크스페이스 환경</h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              기본 프로필 정보와 앱 전반의 테마 스타일을 이곳에서 조정합니다. 현재는 프리셋 기반으로 빠르게 바꿀 수 있도록 정리했습니다.
            </p>
          </div>

          <div className="mt-5 grid gap-5">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-[22px] border border-slate-200/80 bg-slate-50/75 p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">이름</p>
                <p className="mt-3 text-[18px] font-semibold tracking-[-0.02em] text-slate-950">{currentUser.name}</p>
              </div>
              <div className="rounded-[22px] border border-slate-200/80 bg-slate-50/75 p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">이메일</p>
                <p className="mt-3 text-[18px] font-semibold tracking-[-0.02em] text-slate-950">{currentUser.email}</p>
              </div>
            </div>

            <div className="rounded-[24px] border border-slate-200/80 bg-white/90 p-4">
              <Field label="권한" hint="선택한 권한은 목업 프로필 상태에 반영되며, 이후 실제 권한 체계와도 연결할 수 있게 열어 두었습니다.">
                <Select value={currentUser.role} onChange={(event) => setCurrentUserRole(event.target.value as Role)}>
                  {roles.map((role) => (
                    <option key={role} value={role}>
                      {roleLabels[role]}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>

            <div className="rounded-[24px] border border-slate-200/80 bg-white/92 p-4">
              <div className="flex flex-col gap-2 border-b border-slate-200/80 pb-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">테마</p>
                <h3 className="text-[18px] font-semibold tracking-[-0.02em] text-slate-950">앱 색상 테마</h3>
                <p className="text-sm leading-6 text-slate-500">
                  VS Code처럼 작업 성향에 맞는 프리셋을 고를 수 있습니다. 선택 즉시 앱 셸, 사이드바, 액센트 색상에 반영됩니다.
                </p>
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-2">
                {appThemeOptions.map((theme) => {
                  const isActive = theme.id === appTheme;

                  return (
                    <button
                      key={theme.id}
                      type="button"
                      onClick={() => setAppTheme(theme.id)}
                      className={[
                        'rounded-[20px] border p-3.5 text-left transition-all duration-200',
                        isActive
                          ? 'border-[rgb(var(--theme-accent-200)_/_0.95)] bg-accent-50/70 shadow-[0_12px_24px_rgba(148,163,184,0.12)]'
                          : 'border-slate-200/80 bg-slate-50/65 hover:border-slate-300 hover:bg-white',
                      ].join(' ')}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-[15px] font-semibold tracking-[-0.02em] text-slate-900">{theme.label}</p>
                          <p className="mt-1.5 text-sm leading-6 text-slate-500">{theme.description}</p>
                        </div>
                        <span
                          className={[
                            'rounded-full px-2.5 py-1 text-[11px] font-semibold',
                            isActive ? 'bg-white text-accent-700' : 'bg-white/80 text-slate-500',
                          ].join(' ')}
                        >
                          {isActive ? '사용 중' : '선택'}
                        </span>
                      </div>

                      <div className="mt-3 flex gap-2">
                        {theme.swatches.map((color) => (
                          <span
                            key={color}
                            className="h-9 flex-1 rounded-[14px] border border-white/70 shadow-[inset_0_1px_0_rgba(255,255,255,0.6)]"
                            style={{ backgroundColor: color }}
                          />
                        ))}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-4 rounded-[24px] border border-rose-200/70 bg-rose-50/70 p-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-rose-400">세션</p>
                <p className="mt-2 text-[18px] font-semibold tracking-[-0.02em] text-slate-950">현재 워크스페이스 세션 종료</p>
                <p className="mt-2 text-sm leading-6 text-slate-500">
                  보호된 목업 워크스페이스에서 로그아웃하고 로그인 화면으로 돌아갑니다.
                </p>
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
