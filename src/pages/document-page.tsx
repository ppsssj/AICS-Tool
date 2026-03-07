import { Link, useNavigate, useParams } from 'react-router-dom';
import { useLabStore } from '@/app/store/use-lab-store';
import { formatDateTime } from '@/shared/lib/date';
import { Badge } from '@/shared/ui/badge';
import { Button } from '@/shared/ui/button';
import { Card } from '@/shared/ui/card';
import { EmptyState } from '@/shared/ui/empty-state';
import { Field, Input, Textarea } from '@/shared/ui/field';
import { PageHeader } from '@/shared/ui/page-header';

export function DocumentPage() {
  const navigate = useNavigate();
  const { docId, projectId } = useParams();
  const { currentUserId, deleteDocument, documents, tasks, updateDocument, users } = useLabStore();
  const document = documents.find((item) => item.id === docId && item.projectId === projectId);

  if (!document || !currentUserId) {
    return <EmptyState title="문서를 찾을 수 없습니다" description="이 프로젝트에서 요청한 문서를 찾을 수 없습니다." />;
  }

  const relatedTasks = tasks.filter((task) => task.projectId === projectId);
  const author = users.find((user) => user.id === document.authorId);

  return (
    <div className="space-y-8">
      <PageHeader
        title={document.title}
        description="MVP 단계에서는 단순한 편집기로 유지하되, 작성 영역과 메타데이터를 깔끔하게 분리했습니다."
        actions={
          <>
            <Button variant="secondary" onClick={() => updateDocument(document.id, { ...document, authorId: currentUserId })}>
              변경 저장
            </Button>
            <Button variant="ghost" onClick={() => { deleteDocument(document.id); navigate(`/projects/${projectId}`); }}>
              문서 삭제
            </Button>
          </>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <Card className="border-slate-200/70">
          <div className="grid gap-5">
            <Field label="문서 제목">
              <Input value={document.title} onChange={(event) => updateDocument(document.id, { ...document, title: event.target.value, authorId: currentUserId })} />
            </Field>
            <Field label="문서 본문">
              <Textarea className="min-h-[360px]" value={document.body} onChange={(event) => updateDocument(document.id, { ...document, body: event.target.value, authorId: currentUserId })} />
            </Field>
            <Field label="태그">
              <Input value={document.tags.join(', ')} onChange={(event) => updateDocument(document.id, { ...document, tags: event.target.value.split(',').map((tag) => tag.trim()).filter(Boolean), authorId: currentUserId })} />
            </Field>
          </div>
        </Card>

        <div className="space-y-6">
          <Card className="border-slate-200/70">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">메타데이터</p>
            <div className="mt-5 space-y-4 text-sm text-slate-600">
              <p>작성자: {author?.name ?? '알 수 없음'}</p>
              <p>수정일: {formatDateTime(document.updatedAt)}</p>
              <div className="flex flex-wrap gap-2">
                {document.tags.map((tag) => (
                  <Badge key={tag} tone="info">{tag}</Badge>
                ))}
              </div>
            </div>
          </Card>

          <Card className="border-slate-200/70">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">연결 작업</p>
                <h2 className="mt-2 text-[24px] font-semibold tracking-[-0.03em] text-slate-950">관련 작업</h2>
              </div>
              <Link className="text-sm font-semibold text-accent-700" to={`/projects/${projectId}/tasks`}>
                보드 열기
              </Link>
            </div>
            <div className="mt-5 grid gap-3">
              {relatedTasks.map((task) => (
                <label key={task.id} className="flex items-start gap-3 rounded-[20px] border border-slate-200/80 bg-slate-50/70 p-4">
                  <input
                    checked={document.relatedTaskIds.includes(task.id)}
                    onChange={() => {
                      const nextIds = document.relatedTaskIds.includes(task.id)
                        ? document.relatedTaskIds.filter((id) => id !== task.id)
                        : [...document.relatedTaskIds, task.id];
                      updateDocument(document.id, { ...document, relatedTaskIds: nextIds, authorId: currentUserId });
                    }}
                    type="checkbox"
                  />
                  <div>
                    <p className="font-semibold tracking-[-0.01em] text-slate-900">{task.title}</p>
                    <p className="mt-1 text-sm text-slate-500">{task.status}</p>
                  </div>
                </label>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
