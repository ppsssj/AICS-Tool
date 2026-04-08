import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useLabStore } from '@/app/store/use-lab-store';
import { Button } from '@/shared/ui/button';
import { Card } from '@/shared/ui/card';
import { Field, Input } from '@/shared/ui/field';

type AuthMode = 'login' | 'register';

export function LoginForm() {
  const authStatus = useLabStore((state) => state.authStatus);
  const hydrateFromServer = useLabStore((state) => state.hydrateFromServer);
  const isAuthenticated = useLabStore((state) => state.isAuthenticated);
  const login = useLabStore((state) => state.login);
  const register = useLabStore((state) => state.register);
  const navigate = useNavigate();
  const location = useLocation();
  const [mode, setMode] = useState<AuthMode>('login');
  const [name, setName] = useState('');
  const [title, setTitle] = useState('Research Member');
  const [email, setEmail] = useState('alex.park@labflow.ai');
  const [password, setPassword] = useState('password');
  const [confirmPassword, setConfirmPassword] = useState('password');
  const [error, setError] = useState<string | null>(null);

  const targetPath = (location.state as { from?: string } | null)?.from ?? '/dashboard';
  const isSubmitting = authStatus === 'loading';

  useEffect(() => {
    if (!isAuthenticated || authStatus !== 'ready') {
      return;
    }

    void hydrateFromServer().finally(() => {
      navigate(targetPath, { replace: true });
    });
  }, [authStatus, hydrateFromServer, isAuthenticated, navigate, targetPath]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (mode === 'register' && password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    try {
      if (mode === 'login') {
        await login(email, password);
        return;
      }

      await register({
        name,
        title,
        email,
        password,
      });
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : 'Authentication failed.');
    }
  }

  return (
    <Card className="w-full max-w-md border-slate-200 bg-white/95 p-8 backdrop-blur">
      <div className="mb-8">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-accent-700">AICS Lab</p>
        <h1 className="mt-3 text-3xl font-semibold text-slate-950">Sign in to LabFlow</h1>
        <p className="mt-2 text-sm text-slate-500">
          Use an existing lab account or create a new member account to enter the workspace.
        </p>
      </div>

      <div className="mb-6 grid grid-cols-2 rounded-2xl bg-slate-100 p-1">
        <button
          type="button"
          onClick={() => {
            setMode('login');
            setError(null);
          }}
          className={[
            'rounded-[14px] px-4 py-2.5 text-sm font-semibold transition',
            mode === 'login' ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-500',
          ].join(' ')}
        >
          Login
        </button>
        <button
          type="button"
          onClick={() => {
            setMode('register');
            setError(null);
          }}
          className={[
            'rounded-[14px] px-4 py-2.5 text-sm font-semibold transition',
            mode === 'register' ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-500',
          ].join(' ')}
        >
          Sign up
        </button>
      </div>

      <form className="space-y-5" onSubmit={handleSubmit}>
        {mode === 'register' ? (
          <>
            <Field label="Name">
              <Input value={name} onChange={(event) => setName(event.target.value)} required />
            </Field>
            <Field label="Title">
              <Input value={title} onChange={(event) => setTitle(event.target.value)} required />
            </Field>
          </>
        ) : null}

        <Field label="Email">
          <Input value={email} onChange={(event) => setEmail(event.target.value)} type="email" required />
        </Field>

        <Field label="Password">
          <Input
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            type="password"
            minLength={8}
            required
          />
        </Field>

        {mode === 'register' ? (
          <Field label="Confirm password">
            <Input
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              type="password"
              minLength={8}
              required
            />
          </Field>
        ) : null}

        {error ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </div>
        ) : null}

        <Button type="submit" fullWidth disabled={isSubmitting}>
          {isSubmitting ? 'Please wait...' : mode === 'login' ? 'Login' : 'Create account'}
        </Button>
      </form>

      <div className="mt-5 rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">
        Demo account:
        <span className="ml-1 font-semibold text-slate-900">alex.park@labflow.ai / password</span>
      </div>
    </Card>
  );
}
