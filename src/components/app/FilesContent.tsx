import { useCallback, useEffect, useRef, useState } from 'react';
import { Paperclip, Download, Trash2, Upload, Link2 } from 'lucide-react';
import {
  listMyFiles, uploadMyFile, removeMyFile, fileDownloadUrl, listFileLinks,
  MAX_FILE_BYTES, type FileRow, type FileLinkRow,
} from '../../lib/files';
import { toErrorMessage } from '../../lib/ops/errors';

/**
 * MY FILES — the ONE account surface this task proves the upload spine on
 * (TASK-UPLOADS). Everything a member uploads lands here and stays theirs.
 *
 * This is deliberately NOT "My Documents". Documents are FHE's records —
 * generated from tenant templates, signable, evidentiary. Files are the
 * member's own property: a scanned Coggins, an insurance certificate, a vet
 * note. The owner's word is that a file belongs to whoever uploaded it, so the
 * two are separate concepts, separate tables, and separate rows on this page.
 *
 * Where a file has been surfaced (a horse record, a deal, a lesson) is shown as
 * what it is — a REFERENCE, not a copy. There is only ever one file.
 */

const fmtBytes = (n: number | null) =>
  n == null ? '' : n < 1024 ? `${n} B`
    : n < 1048576 ? `${(n / 1024).toFixed(0)} KB`
      : `${(n / 1048576).toFixed(1)} MB`;

const fmtDate = (s: string) =>
  new Date(s).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });

/** Reads as a sentence on the row: "Shown on a horse record and a deal". */
const SUBJECT_LABEL: Record<string, string> = {
  contact: 'a contact record', account: 'an account', deal: 'a deal',
  contract: 'a contract', document: 'a document', horse: 'a horse record',
  stable: 'a stable page', lesson: 'a lesson', offering: 'a service',
  purchase: 'an order', booking: 'a booking', lead: 'a lead',
  directory_listing: 'a directory listing', org: 'the company',
};

export function FilesContent() {
  const [files, setFiles] = useState<FileRow[] | null>(null);
  const [links, setLinks] = useState<Record<string, FileLinkRow[]>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const reload = useCallback(async () => {
    try {
      const rows = await listMyFiles();
      setFiles(rows);
      // Surfacings, per file. Failing to read them must not hide the files
      // themselves — the list is the point, the badge is decoration.
      const pairs = await Promise.all(
        rows.map(async (f) => [f.id, await listFileLinks(f.id).catch(() => [])] as const),
      );
      setLinks(Object.fromEntries(pairs));
    } catch (err) {
      setFiles([]);
      setError(toErrorMessage(err, 'Could not load your files.'));
    }
  }, []);

  useEffect(() => { void reload(); }, [reload]);

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = e.target.files?.[0];
    // Clear immediately so re-picking the same file still fires a change event.
    e.target.value = '';
    if (!picked) return;
    setBusy(true); setError(null); setNote(null);
    try {
      await uploadMyFile(picked);
      setNote(`Uploaded ${picked.name}.`);
      await reload();
    } catch (err) {
      setError(toErrorMessage(err, 'Could not upload that file.'));
    } finally {
      setBusy(false);
    }
  }

  /** Private bucket: mint a short-lived signed URL at click time rather than
   *  holding one on the page, where it would go stale or leak in a screenshot. */
  async function download(f: FileRow) {
    setError(null);
    const url = await fileDownloadUrl(f);
    if (!url) { setError(`Could not open ${f.filename}.`); return; }
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  async function remove(f: FileRow) {
    if (!window.confirm(`Remove ${f.filename}? This deletes your copy from the stable's storage.`)) return;
    setBusy(true); setError(null); setNote(null);
    try {
      await removeMyFile(f);
      setNote(`Removed ${f.filename}.`);
      await reload();
    } catch (err) {
      setError(toErrorMessage(err, 'Could not remove that file.'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-2.5 mb-1">
      <div className="bg-white border border-green-800/10 rounded-xl p-4 mb-3 flex flex-wrap items-center gap-3">
        <input
          ref={inputRef} type="file" className="sr-only" onChange={onPick}
          aria-label="Choose a file to upload" data-testid="my-files-input"
        />
        <button
          type="button" disabled={busy} onClick={() => inputRef.current?.click()}
          className="btn-primary inline-flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Upload size={15} aria-hidden="true" />
          {busy ? 'Working…' : 'Upload a file'}
        </button>
        <p className="text-[12px] text-muted">
          Yours to keep — up to {Math.round(MAX_FILE_BYTES / 1048576)}MB. Stored privately;
          staff can see it, and it stays yours wherever it&apos;s shown.
        </p>
      </div>

      {error && <p role="alert" className="form-error mb-3">{error}</p>}
      {note && <p role="status" className="mb-3 rounded px-4 py-2 text-sm bg-green-50 text-green-900">{note}</p>}

      {files === null ? (
        <p className="body-text text-muted">Loading…</p>
      ) : files.length === 0 ? (
        <div className="bg-white border border-green-800/10 rounded-xl p-8 text-center">
          <p className="body-text text-sm text-muted">
            You haven&apos;t uploaded any files yet. Insurance certificates, Coggins,
            vet notes — anything you want the stable to have on hand.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {files.map((f) => {
            const shown = (links[f.id] ?? []).map((l) => SUBJECT_LABEL[l.subject_type] ?? l.subject_type);
            return (
              <div key={f.id}
                className="bg-white border border-green-800/10 rounded-xl p-4 flex items-center gap-3">
                <span className="w-10 h-10 rounded-lg bg-cream-100 text-green-700 grid place-items-center shrink-0">
                  <Paperclip size={18} aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-serif text-green-800 text-[16px] font-semibold leading-tight truncate">
                    {f.title || f.filename}
                  </p>
                  <p className="text-[12px] text-muted mt-0.5">
                    {fmtDate(f.created_at)}
                    {f.byte_size != null && ` · ${fmtBytes(f.byte_size)}`}
                    {f.title && ` · ${f.filename}`}
                  </p>
                  {shown.length > 0 && (
                    <p className="text-[12px] text-green-800/80 mt-1 inline-flex items-center gap-1.5">
                      <Link2 size={12} aria-hidden="true" />
                      Shown on {shown.join(', ')} — one file, not a copy.
                    </p>
                  )}
                </div>
                <button type="button" onClick={() => void download(f)}
                  className="inline-flex items-center gap-1.5 text-xs text-green-800 hover:text-green-700 px-2.5 py-1 rounded-lg border border-green-800/15 hover:border-green-800/30 focus-ring shrink-0">
                  <Download size={13} aria-hidden="true" /> Download
                </button>
                <button type="button" disabled={busy} onClick={() => void remove(f)}
                  aria-label={`Remove ${f.filename}`}
                  className="inline-flex items-center gap-1.5 text-xs text-red-700 hover:text-red-600 px-2.5 py-1 rounded-lg border border-red-700/15 hover:border-red-700/30 focus-ring shrink-0 disabled:opacity-50">
                  <Trash2 size={13} aria-hidden="true" /> Remove
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
