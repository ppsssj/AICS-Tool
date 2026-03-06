import { Link } from 'react-router-dom';
import { Button } from '@/shared/ui/button';
import { Card } from '@/shared/ui/card';

export function NotFoundPage() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <Card className="max-w-lg text-center">
        <p className="text-sm font-semibold uppercase tracking-[0.22em] text-slate-500">404</p>
        <h1 className="mt-3 text-3xl font-semibold text-slate-950">Workspace page not found</h1>
        <p className="mt-3 text-sm text-slate-500">The requested route does not exist in this MVP frontend.</p>
        <Link className="mt-6 inline-flex" to="/dashboard">
          <Button>Go to dashboard</Button>
        </Link>
      </Card>
    </div>
  );
}
