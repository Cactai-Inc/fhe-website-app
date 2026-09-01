import { useCallback, useEffect, useState } from 'react';
import { DataTable, useAsync, useToast, type Column, type RowAction } from '../../../lib/ops';
import { Modal } from '../../../components/ops/kit/Modal';
import {
  listOrgFiles, fileDownloadUrl, softDeleteFile, hardDeleteFile, restoreFile,
  type OrgFileRow,
} from '../../../lib/files';

/**
 * RECORDS · FILES tab — every file in the tenant (owner, 2026-08-15: Lessons/
 * Documents/Files/Deals "should be added to the records page"). `listOrgFiles`
 * relies on the `files_staff_rw` RLS policy, which already admits any staff
 * member to every file in their org — no new RPC needed, this is a straight
 * read. A file here is the TASK-UPLOADS spine (`files`/`file_links`) —
 * uploaded attachments, distinct from `documents` (FHE's own generated,
 * signable records), which is its own Records tab.
 *
 * ⚠️ VIEW, AND SELECT-AND-DELETE (owner, 2026-08-26): *"there are two test files
 * from walk4 that i cant delete or even see i can only download them, need a
 * button to view and a method to select and delete."* Download was the only
 * affordance, so identifying a file meant a round trip through the Downloads
 * folder, and nothing could ever be removed — walk test files were permanent.
 *
 * ⚠️ TWO DELETES, DELIBERATELY DIFFERENT (owner, same day): *"remove the url
 * leave the object in the db unless i go in and hard delete it or if you give the
 * option to soft or hard delete from admin ui that is best."*
 *   REMOVE  tombstones the row and its links. Nothing lists it, nothing links it,
 *           no signed URL is minted for it again — and the bytes are still there,
 *           so it can be put back. This is the default.
 *   DELETE PERMANENTLY  takes the object too. Irreversible, and the answer to a
 *           file that should never have been uploaded.
 *
 * ⚠️ THIS TABLE NEVER TOUCHES `documents`. A generated or signed record is
 * evidence and is not sweepable from here — the executed-documents rule. The two
 * spines are separate tables and separate tabs, which is what keeps that true.
 */
function fmtBytes(n: number | null): string {
  if (n == null) return '—';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

/** What can be shown in the browser rather than handed to the OS. Anything else
 *  still opens in a tab; the browser decides, and worst case it downloads —
 *  which is exactly where we started, so nothing is lost by trying. */
const VIEWABLE = /^(image\/|application\/pdf|text\/|video\/|audio\/)/;

export function FilesRecordsPage() {
  const toast = useToast();
  const [showDeleted, setShowDeleted] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [preview, setPreview] = useState<{ file: OrgFileRow; url: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const fetcher = useCallback(() => listOrgFiles(showDeleted), [showDeleted]);
  const load = useAsync(fetcher);

  useEffect(() => {
    load.run().catch(() => { /* surfaced via load.isError */ });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showDeleted]);

  const files = load.data ?? [];
  const chosen = files.filter((f) => selected.has(f.id));
  const chosenLive = chosen.filter((f) => !f.deleted_at);
  const chosenDead = chosen.filter((f) => f.deleted_at);

  const reload = async () => {
    setSelected(new Set());
    await load.run().catch(() => { /* surfaced */ });
  };

  const view = async (f: OrgFileRow) => {
    const url = await fileDownloadUrl(f);
    if (!url) { toast.error('That file could not be opened.'); return; }
    if (VIEWABLE.test(f.mime_type ?? '')) setPreview({ file: f, url });
    else window.open(url, '_blank', 'noopener');
  };

  /* One runner for all three bulk acts: they differ only in the call and the
     word, and three near-identical handlers is how they drift apart. */
  const runOn = async (
    rows: OrgFileRow[], verb: string, fn: (f: OrgFileRow) => Promise<void>,
  ) => {
    setBusy(true);
    const results = await Promise.allSettled(rows.map(fn));
    const failed = results.filter((r) => r.status === 'rejected').length;
    setBusy(false);
    if (failed) {
      toast.error(`${verb} ${rows.length - failed} of ${rows.length}; ${failed} failed.`);
    } else {
      toast.success(`${verb} ${rows.length} file${rows.length === 1 ? '' : 's'}.`);
    }
    await reload();
  };

  const columns: Column<OrgFileRow>[] = [
    {
      key: 'select',
      header: '',
      render: (f) => (
        <input type="checkbox" checked={selected.has(f.id)}
          aria-label={`Select ${f.title || f.filename}`}
          onChange={(e) => setSelected((prev) => {
            const next = new Set(prev);
            if (e.target.checked) next.add(f.id); else next.delete(f.id);
            return next;
          })} />
      ),
    },
    {
      key: 'filename',
      header: 'File',
      render: (f) => (
        <span className={f.deleted_at ? 'text-muted line-through' : ''}>
          {f.title || f.filename}
        </span>
      ),
    },
    { key: 'owner', header: 'Owner', render: (f) => f.owner_name ?? '—' },
    { key: 'size', header: 'Size', render: (f) => fmtBytes(f.byte_size) },
    { key: 'uploaded', header: 'Uploaded', render: (f) => new Date(f.created_at).toLocaleDateString() },
    {
      key: 'state',
      header: 'State',
      render: (f) => (f.deleted_at ? 'Removed' : 'Active'),
    },
  ];

  const rowActions: RowAction<OrgFileRow>[] = [
    { label: 'View', onClick: (f) => { void view(f); } },
    {
      label: 'Download',
      onClick: (f) => {
        void fileDownloadUrl(f).then((url) => {
          if (url) window.open(url, '_blank', 'noopener');
        });
      },
    },
  ];

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
      {load.isError && (
        <p role="alert" className="form-error mb-4">
          {load.error?.message ?? 'Could not load files.'}
        </p>
      )}

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <label className="inline-flex items-center gap-2 text-sm text-secondary">
          <input type="checkbox" checked={showDeleted}
            onChange={(e) => { setSelected(new Set()); setShowDeleted(e.target.checked); }} />
          Show removed files
        </label>

        {chosen.length > 0 && (
          <span className="text-sm text-muted">{chosen.length} selected</span>
        )}

        {chosenLive.length > 0 && (
          <button type="button" className="btn-secondary text-sm" disabled={busy}
            onClick={() => void runOn(chosenLive, 'Removed', softDeleteFile)}>
            Remove
          </button>
        )}

        {chosenDead.length > 0 && (
          <button type="button" className="btn-secondary text-sm" disabled={busy}
            onClick={() => void runOn(chosenDead, 'Restored', restoreFile)}>
            Restore
          </button>
        )}

        {chosen.length > 0 && (
          <button type="button" className="btn-ghost text-sm text-red-700" disabled={busy}
            onClick={() => {
              /* The one destructive act on this page asks, and names the count so
                 a mis-click on "select all" cannot slide past. */
              const ok = window.confirm(
                `Permanently delete ${chosen.length} file${chosen.length === 1 ? '' : 's'}? `
                + 'The stored file is removed as well and this cannot be undone.',
              );
              if (ok) void runOn(chosen, 'Permanently deleted', hardDeleteFile);
            }}>
            Delete permanently
          </button>
        )}
      </div>

      <DataTable
        columns={columns}
        rows={files}
        rowKey={(f) => f.id}
        loading={load.isPending && files.length === 0}
        rowActions={rowActions}
        emptyTitle="No files yet"
        emptyMessage="Files uploaded anywhere in the app — by staff or members — appear here."
      />

      {/* ⚠️ TASK-FIX4 §3 — converged. A preview holds nothing typed.
          ⚠️ TASK-MODAL2 D1: click-out no longer closes it. The X does. */}
      {preview && (
        <Modal open onClose={() => setPreview(null)} size="full"
          title={preview.file.title || preview.file.filename}>
            {(preview.file.mime_type ?? '').startsWith('image/') ? (
              <img src={preview.url} alt={preview.file.title || preview.file.filename}
                className="max-w-full h-auto mx-auto" />
            ) : (preview.file.mime_type ?? '').startsWith('video/') ? (
              <video src={preview.url} controls className="max-w-full mx-auto" />
            ) : (preview.file.mime_type ?? '').startsWith('audio/') ? (
              <audio src={preview.url} controls className="w-full" />
            ) : (
              <iframe src={preview.url} title={preview.file.filename}
                className="w-full h-[70vh] border-0" />
            )}
        </Modal>
      )}
    </div>
  );
}

export default FilesRecordsPage;
