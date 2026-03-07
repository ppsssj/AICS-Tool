import { Link } from 'react-router-dom';
import { Button } from '@/shared/ui/button';
import { Card } from '@/shared/ui/card';

export function NotFoundPage() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <Card className="max-w-lg text-center">
        <p className="text-sm font-semibold uppercase tracking-[0.22em] text-slate-500">404</p>
        <h1 className="mt-3 text-3xl font-semibold text-slate-950">페이지를 찾을 수 없습니다</h1>
        <p className="mt-3 text-sm text-slate-500">요청한 경로가 현재 프런트엔드에 존재하지 않습니다.</p>
        <Link className="mt-6 inline-flex" to="/dashboard">
          <Button>대시보드로 이동</Button>
        </Link>
      </Card>
    </div>
  );
}
