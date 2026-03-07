import { useRef, useState, type ChangeEvent, type DragEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useLabStore } from '@/app/store/use-lab-store';
import type { DocumentAttachment } from '@/entities/models';
import { formatDateTime } from '@/shared/lib/date';
import { Badge } from '@/shared/ui/badge';
import { Button } from '@/shared/ui/button';
import { Card } from '@/shared/ui/card';
import { EmptyState } from '@/shared/ui/empty-state';
import { Field, Input, Textarea } from '@/shared/ui/field';
import { PageHeader } from '@/shared/ui/page-header';

const acceptedFileTypes =
  '.pdf,.hwp,.hwpx,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.csv,.txt,.zip,.png,.jpg,.jpeg';

function formatFileSize(size: number): string {
  if (size < 1024) {
    return `${size}B`;
  }

  if (size < 1024 * 1024) {
    return `${(size / 1024).toFixed(1)}KB`;
  }

  return `${(size / (1024 * 1024)).toFixed(1)}MB`;
}

function createAttachment(file: File, dataUrl: string): DocumentAttachment {
  return {
    id: `file-${Math.random().toString(36).slice(2, 9)}`,
    name: file.name,
    type: file.type || 'application/octet-stream',
    size: file.size,
    uploadedAt: new Date().toISOString(),
    dataUrl,
  };
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
        return;
      }
      reject(new Error('파일을 읽을 수 없습니다.'));
    };
    reader.onerror = () => reject(reader.error ?? new Error('파일을 읽는 중 오류가 발생했습니다.'));
    reader.readAsDataURL(file);
  });
}

export function DocumentPage() {
  const navigate = useNavigate();
  const { docId, projectId } = useParams();
  const { currentUserId, deleteDocument, documents, tasks, updateDocument, users } = useLabStore();
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const document = documents.find((item) => item.id === docId && item.projectId === projectId);

  if (!document || !currentUserId) {
    return <EmptyState title="문서를 찾을 수 없습니다" description="이 프로젝트에서 요청한 문서를 찾을 수 없습니다." />;
  }

  const currentDocument = document;
  const authorId = currentUserId;
  const relatedTasks = tasks.filter((task) => task.projectId === projectId);
  const author = users.find((user) => user.id === currentDocument.authorId);

  async function handleFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) {
      return;
    }

    setIsUploading(true);
    try {
      const nextAttachments = await Promise.all(
        Array.from(fileList).map(async (file) => createAttachment(file, await readFileAsDataUrl(file))),
      );

      updateDocument(currentDocument.id, {
        ...currentDocument,
        attachments: [...currentDocument.attachments, ...nextAttachments],
        authorId,
      });
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  }

  function handleFileInputChange(event: ChangeEvent<HTMLInputElement>) {
    void handleFiles(event.target.files);
  }

  function handleDrop(event: DragEvent<HTMLButtonElement>) {
    event.preventDefault();
    setIsDragging(false);
    void handleFiles(event.dataTransfer.files);
  }

  function removeAttachment(attachmentId: string) {
    updateDocument(currentDocument.id, {
      ...currentDocument,
      attachments: currentDocument.attachments.filter((attachment) => attachment.id !== attachmentId),
      authorId,
    });
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title={currentDocument.title}
        actions={
          <>
            <Button variant="secondary" onClick={() => updateDocument(currentDocument.id, { ...currentDocument, authorId })}>
              변경 저장
            </Button>
            <Button variant="ghost" onClick={() => { deleteDocument(currentDocument.id); navigate(`/projects/${projectId}`); }}>
              문서 삭제
            </Button>
          </>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <Card className="border-slate-200/70">
          <div className="grid gap-5">
            <Field label="문서 제목">
              <Input
                value={currentDocument.title}
                onChange={(event) => updateDocument(currentDocument.id, { ...currentDocument, title: event.target.value, authorId })}
              />
            </Field>
            <Field label="문서 본문">
              <Textarea
                className="min-h-[360px]"
                value={currentDocument.body}
                onChange={(event) => updateDocument(currentDocument.id, { ...currentDocument, body: event.target.value, authorId })}
              />
            </Field>
            <Field label="태그">
              <Input
                value={currentDocument.tags.join(', ')}
                onChange={(event) =>
                  updateDocument(currentDocument.id, {
                    ...currentDocument,
                    tags: event.target.value.split(',').map((tag) => tag.trim()).filter(Boolean),
                    authorId,
                  })}
              />
            </Field>
          </div>
        </Card>

        <div className="space-y-6">
          <Card className="border-slate-200/70">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">메타데이터</p>
            <div className="mt-5 space-y-4 text-sm text-slate-600">
              <p>작성자 {author?.name ?? '알 수 없음'}</p>
              <p>수정일 {formatDateTime(currentDocument.updatedAt)}</p>
              <div className="flex flex-wrap gap-2">
                {currentDocument.tags.map((tag) => (
                  <Badge key={tag} tone="info">{tag}</Badge>
                ))}
              </div>
            </div>
          </Card>

          <Card className="border-slate-200/70">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">작업물</p>
                <h2 className="mt-2 text-[24px] font-semibold tracking-[-0.03em] text-slate-950">파일 첨부</h2>
              </div>
              <Button variant="secondary" onClick={() => fileInputRef.current?.click()}>
                파일 선택
              </Button>
            </div>

            <input
              ref={fileInputRef}
              accept={acceptedFileTypes}
              className="hidden"
              multiple
              onChange={handleFileInputChange}
              type="file"
            />

            <button
              className={[
                'mt-5 flex w-full flex-col items-center justify-center rounded-[22px] border border-dashed px-5 py-10 text-center transition-all',
                isDragging
                  ? 'border-[rgb(var(--theme-accent-200)_/_0.95)] bg-accent-50/70'
                  : 'border-slate-200/85 bg-slate-50/70 hover:border-slate-300 hover:bg-white',
              ].join(' ')}
              onClick={() => fileInputRef.current?.click()}
              onDragEnter={(event) => {
                event.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={(event) => {
                event.preventDefault();
                setIsDragging(false);
              }}
              onDragOver={(event) => {
                event.preventDefault();
                setIsDragging(true);
              }}
              onDrop={handleDrop}
              type="button"
            >
              <p className="text-[15px] font-semibold tracking-[-0.02em] text-slate-900">
                PDF, HWP, DOCX 등 작업물을 여기에 드래그하세요
              </p>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                로컬 파일을 바로 끌어오거나 클릭해서 선택할 수 있습니다.
              </p>
              {isUploading ? (
                <p className="mt-3 text-sm font-medium text-accent-700">업로드 중...</p>
              ) : null}
            </button>

            <div className="mt-5 grid gap-3">
              {currentDocument.attachments.length > 0 ? (
                currentDocument.attachments.map((attachment) => (
                  <div key={attachment.id} className="rounded-[20px] border border-slate-200/80 bg-slate-50/70 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-semibold tracking-[-0.01em] text-slate-900">{attachment.name}</p>
                        <p className="mt-1 text-sm text-slate-500">
                          {formatFileSize(attachment.size)} / {formatDateTime(attachment.uploadedAt)}
                        </p>
                      </div>
                      <Badge tone="neutral">{attachment.type.split('/').pop() ?? '파일'}</Badge>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <a
                        className="inline-flex items-center justify-center rounded-[14px] border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                        download={attachment.name}
                        href={attachment.dataUrl}
                      >
                        다운로드
                      </a>
                      <a
                        className="inline-flex items-center justify-center rounded-[14px] border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                        href={attachment.dataUrl}
                        rel="noreferrer"
                        target="_blank"
                      >
                        열기
                      </a>
                      <Button variant="ghost" onClick={() => removeAttachment(attachment.id)}>
                        제거
                      </Button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-[18px] border border-dashed border-slate-200 bg-slate-50/70 px-4 py-5 text-sm text-slate-500">
                  아직 첨부된 작업물이 없습니다.
                </div>
              )}
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
                    checked={currentDocument.relatedTaskIds.includes(task.id)}
                    onChange={() => {
                      const nextIds = currentDocument.relatedTaskIds.includes(task.id)
                        ? currentDocument.relatedTaskIds.filter((id) => id !== task.id)
                        : [...currentDocument.relatedTaskIds, task.id];
                      updateDocument(currentDocument.id, { ...currentDocument, relatedTaskIds: nextIds, authorId });
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
