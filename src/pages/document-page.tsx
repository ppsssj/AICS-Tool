import { useEffect, useRef, useState, type ChangeEvent, type DragEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useLabStore } from '@/app/store/use-lab-store';
import type { DocumentAttachment } from '@/entities/models';
import { formatDateTime } from '@/shared/lib/date';
import { Badge } from '@/shared/ui/badge';
import { Button } from '@/shared/ui/button';
import { Card } from '@/shared/ui/card';
import { EmptyState } from '@/shared/ui/empty-state';
import { Field, Input, Textarea } from '@/shared/ui/field';
import { Modal } from '@/shared/ui/modal';
import { PageHeader } from '@/shared/ui/page-header';

const acceptedFileTypes =
  '.pdf,.hwp,.hwpx,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.csv,.txt,.zip,.png,.jpg,.jpeg';

type SaveState = 'saving' | 'saved' | 'error';

interface DocumentDraft {
  title: string;
  body: string;
  tagsText: string;
  attachments: DocumentAttachment[];
  relatedTaskIds: string[];
}

const emptyDraft: DocumentDraft = {
  title: '',
  body: '',
  tagsText: '',
  attachments: [],
  relatedTaskIds: [],
};

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
    reader.onerror = () => reject(reader.error ?? new Error('파일을 불러오는 중 오류가 발생했습니다.'));
    reader.readAsDataURL(file);
  });
}

function parseTags(value: string): string[] {
  return value
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean);
}

export function DocumentPage() {
  const navigate = useNavigate();
  const { docId, projectId } = useParams();
  const { currentUserId, deleteDocument, documents, tasks, updateDocument, users } = useLabStore();
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>('saved');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [draft, setDraft] = useState<DocumentDraft>(emptyDraft);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const didHydrateDraftRef = useRef(false);

  const document = documents.find((item) => item.id === docId && item.projectId === projectId);
  const authorId = currentUserId ?? '';
  const relatedTasks = tasks.filter((task) => task.projectId === projectId);
  const author = users.find((user) => user.id === document?.authorId);

  useEffect(() => {
    if (!document) {
      setDraft(emptyDraft);
      setSaveState('saved');
      didHydrateDraftRef.current = false;
      return;
    }

    setDraft({
      title: document.title,
      body: document.body,
      tagsText: document.tags.join(', '),
      attachments: document.attachments ?? [],
      relatedTaskIds: document.relatedTaskIds,
    });
    setSaveState('saved');
    didHydrateDraftRef.current = false;
  }, [document]);

  useEffect(() => {
    if (!document || !currentUserId) {
      return;
    }

    if (!didHydrateDraftRef.current) {
      didHydrateDraftRef.current = true;
      return;
    }

    setSaveState('saving');
    const timeoutId = window.setTimeout(() => {
      try {
        updateDocument(document.id, {
          projectId: document.projectId,
          title: draft.title,
          body: draft.body,
          tags: parseTags(draft.tagsText),
          authorId,
          relatedTaskIds: draft.relatedTaskIds,
          attachments: draft.attachments,
        });
        setSaveState('saved');
      } catch {
        setSaveState('error');
      }
    }, 450);

    return () => window.clearTimeout(timeoutId);
  }, [authorId, currentUserId, document, draft, updateDocument]);

  async function handleFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) {
      return;
    }

    setIsUploading(true);
    try {
      const nextAttachments = await Promise.all(
        Array.from(fileList).map(async (file) => createAttachment(file, await readFileAsDataUrl(file))),
      );

      setDraft((current) => ({
        ...current,
        attachments: [...current.attachments, ...nextAttachments],
      }));
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
    setDraft((current) => ({
      ...current,
      attachments: current.attachments.filter((attachment) => attachment.id !== attachmentId),
    }));
  }

  function toggleRelatedTask(taskId: string) {
    setDraft((current) => ({
      ...current,
      relatedTaskIds: current.relatedTaskIds.includes(taskId)
        ? current.relatedTaskIds.filter((id) => id !== taskId)
        : [...current.relatedTaskIds, taskId],
    }));
  }

  if (!document || !currentUserId) {
    return <EmptyState title="문서를 찾을 수 없습니다" description="현재 프로젝트에서 요청한 문서를 찾을 수 없습니다." />;
  }

  const saveStateLabel = saveState === 'saving' ? '저장 중...' : saveState === 'error' ? '저장 실패' : '저장됨';

  return (
    <div className="space-y-8">
      <PageHeader
        title={draft.title || '문서'}
        actions={
          <div className="rounded-full border border-slate-200 bg-white/90 px-3 py-2 text-sm font-medium text-slate-600 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]">
            자동 저장 {saveStateLabel}
          </div>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <Card className="border-slate-200/70">
          <div className="grid gap-5">
            <Field label="문서 제목">
              <Input
                value={draft.title}
                onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))}
              />
            </Field>
            <Field label="문서 본문">
              <Textarea
                className="min-h-[360px]"
                value={draft.body}
                onChange={(event) => setDraft((current) => ({ ...current, body: event.target.value }))}
              />
            </Field>
            <Field label="태그">
              <Input
                value={draft.tagsText}
                onChange={(event) => setDraft((current) => ({ ...current, tagsText: event.target.value }))}
              />
            </Field>
          </div>
        </Card>

        <div className="space-y-6">
          <Card className="border-slate-200/70">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">메타데이터</p>
            <div className="mt-5 space-y-4 text-sm text-slate-600">
              <p>작성자 {author?.name ?? '정보 없음'}</p>
              <p>최근 저장 {formatDateTime(document.updatedAt)}</p>
              <div className="flex flex-wrap gap-2">
                {parseTags(draft.tagsText).map((tag) => (
                  <Badge key={tag} tone="info">
                    {tag}
                  </Badge>
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
              {isUploading ? <p className="mt-3 text-sm font-medium text-accent-700">파일 업로드 중...</p> : null}
            </button>

            <div className="mt-5 grid gap-3">
              {draft.attachments.length > 0 ? (
                draft.attachments.map((attachment) => (
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
                <label
                  key={task.id}
                  className="flex items-start gap-3 rounded-[20px] border border-slate-200/80 bg-slate-50/70 p-4"
                >
                  <input
                    checked={draft.relatedTaskIds.includes(task.id)}
                    onChange={() => toggleRelatedTask(task.id)}
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

          <Card className="border-rose-200/70 bg-rose-50/65">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-rose-400">위험 작업</p>
            <h2 className="mt-2 text-[20px] font-semibold tracking-[-0.02em] text-slate-950">문서 삭제</h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              문서를 삭제하면 연결된 작업 참조도 함께 해제됩니다.
            </p>
            <Button className="mt-4" variant="danger" onClick={() => setShowDeleteModal(true)}>
              문서 삭제
            </Button>
          </Card>
        </div>
      </div>

      <Modal
        open={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        title="문서 삭제"
        footer={
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setShowDeleteModal(false)}>
              취소
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                deleteDocument(document.id);
                navigate(`/projects/${projectId}/docs`);
              }}
            >
              삭제
            </Button>
          </div>
        }
      >
        <p className="text-sm leading-6 text-slate-600">
          <span className="font-semibold text-slate-900">{document.title}</span> 문서를 정말 삭제하시겠습니까?
        </p>
      </Modal>
    </div>
  );
}
