import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useLabStore } from '@/app/store/use-lab-store';
import { Button } from '@/shared/ui/button';
import { Card } from '@/shared/ui/card';
import { Field, Input } from '@/shared/ui/field';

export function LoginForm() {
  const login = useLabStore((state) => state.login);
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('alex.park@labflow.ai');
  const [password, setPassword] = useState('password');

  const targetPath = (location.state as { from?: string } | null)?.from ?? '/dashboard';

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    login(email);
    navigate(targetPath, { replace: true });
  }

  return (
    <Card className="w-full max-w-md border-slate-200 bg-white/95 p-8 backdrop-blur">
      <div className="mb-8">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-accent-700">내부 접근</p>
        <h1 className="mt-3 text-3xl font-semibold text-slate-950">연구실 운영 로그인</h1>
        <p className="mt-2 text-sm text-slate-500">
          목업 계정으로 연구실 워크스페이스에 들어갈 수 있습니다. 이후 실제 백엔드 인증으로 연결하기 쉽도록 구성되어 있습니다.
        </p>
      </div>
      <form className="space-y-5" onSubmit={handleSubmit}>
        <Field label="이메일">
          <Input value={email} onChange={(event) => setEmail(event.target.value)} type="email" required />
        </Field>
        <Field label="비밀번호">
          <Input value={password} onChange={(event) => setPassword(event.target.value)} type="password" required />
        </Field>
        <Button type="submit" fullWidth>대시보드로 로그인</Button>
      </form>
      <div className="mt-5 rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">
        추천 데모 계정: <span className="font-semibold text-slate-900">alex.park@labflow.ai</span>
      </div>
    </Card>
  );
}
