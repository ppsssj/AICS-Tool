import { LoginForm } from '@/features/auth/login-form';

export function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 bg-grid bg-[length:36px_36px] px-4 py-10">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(47,111,237,0.22),_transparent_28%),radial-gradient(circle_at_bottom_right,_rgba(255,255,255,0.12),_transparent_24%)]" />
      <div className="relative z-10 w-full max-w-md">
        <LoginForm />
      </div>
    </div>
  );
}
