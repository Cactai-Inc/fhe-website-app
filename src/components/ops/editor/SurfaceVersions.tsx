import { useCallback, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { History, Pencil, RotateCcw } from 'lucide-react';
import { Modal } from '../kit/Modal';
import { formatDate } from '../../../lib/formatDateTime';
import { toErrorMessage } from '../../../lib/ops/errors';

/**
 * THE VERSION LIST, REACHED FROM THE SURFACE — one implementation for every kind
 * of surface the editor renders.
 *
 * Owner, 2026-08-26: *"a version list that i can click to see from the page im
 * editing the thing on, when i open the list, shown as a modal, it opens that
 * prior version in the editor and i can restore it, or create a superseding
 * version from it by editing it and saving it."*
 *
 * ⚠️ THIS WAS FOUR COMPONENTS INSIDE `AdminFormsPage.tsx`. Thread 1 built them
 * there deliberately — forms were the proving ground — and its own report says
 * they "should move to a shared component when the three editors collapse into
 * one". This is that move. Forms, documents and emails now read their history
 * through the same modal, so a fourth kind cannot arrive with a fifth idea of
 * what a version list looks like.
 *
 * ⚠️ RESTORE MINTS A NEW VERSION. Restoring v1 when v3 exists produces v4 stamped
 * "from v1"; v2 and v3 stay in the list and stay readable. Restore and supersede
 * are the same call with a different amount of editing — there is no second path
 * and nothing here can lower a number or remove a row. The database refuses
 * UPDATE and DELETE on every version history outright.
 */

export interface VersionRow {
  version: number;
  parent_version: number | null;
  is_current: boolean;
  edited_by_name: string | null;
  created_at: string;
}

/** What a surface has to provide for its history to open here. `editFrom` is
 *  optional because not every kind can apply an edit to an OLDER version — a
 *  form can (every mutator carries p_from_version); a document's wording cannot
 *  yet, and saying so is better than offering a button that lies. */
export interface VersionSource<D> {
  list: () => Promise<VersionRow[]>;
  at: (version: number) => Promise<D | null>;
  restore: (version: number) => Promise<number>;
  preview: (detail: D) => ReactNode;
  editFrom?: (version: number) => void;
  /** Shown above the list — the one place a kind's own caveat belongs. */
  note?: ReactNode;
}

/** "v3 · from v1" — the number says WHEN, the parent says WHAT IT CAME FROM.
 *  A null parent is the ordinary case (edited from the one before), so it says
 *  nothing rather than adding noise to every row. Deliberately NOT exported: a
 *  non-component export here costs the file its fast refresh, and every caller
 *  that wants this string wants the modal around it too. */
function versionLabel(v: { version: number; parent_version: number | null }): string {
  return v.parent_version === null ? `v${v.version}` : `v${v.version} · from v${v.parent_version}`;
}

/** The version the surface is on, stated on the surface itself (THE TELL). */
export function VersionChip({ version, onOpen, label }: {
  version: number;
  onOpen: () => void;
  label: string;
}) {
  return (
    <span className="flex items-center gap-2 shrink-0">
      <span className="text-[11px] font-medium text-green-800 bg-green-50 border border-green-700/30 rounded px-1.5 py-0.5">
        v{version}
      </span>
      <button type="button" onClick={onOpen}
        className="text-muted hover:text-green-800 focus-ring rounded p-1"
        aria-label={`Version history for ${label}`} title="Version history">
        <History size={15} />
      </button>
    </span>
  );
}

/** One row in the version list. Module scope — a component defined inside a
 *  render is a new type every keystroke (2026-08-25). */
function VersionListRow({ v, onOpen }: { v: VersionRow; onOpen: (version: number) => void }) {
  return (
    <button type="button" onClick={() => onOpen(v.version)}
      className={`w-full text-left flex items-baseline gap-3 px-4 py-3 rounded-lg border focus-ring ${
        v.is_current ? 'border-green-700 bg-green-50' : 'border-green-800/15 hover:bg-cream-100/60'
      }`}>
      <span className="text-[13.5px] font-medium text-green-900 shrink-0">{versionLabel(v)}</span>
      {v.is_current && <span className="text-[10px] uppercase tracking-wide text-green-800 shrink-0">Live</span>}
      <span className="text-[12px] text-muted flex-1 min-w-0 truncate">
        {v.edited_by_name ?? 'author not recorded'} · {formatDate(v.created_at)}
      </span>
    </button>
  );
}

export function VersionsModal<D extends { version: number; parent_version: number | null; is_current: boolean }>({
  title, open, onClose, source, onChanged, onError,
}: {
  title: string;
  open: boolean;
  onClose: () => void;
  source: VersionSource<D>;
  onChanged: () => void;
  onError: (m: string) => void;
}) {
  const [versions, setVersions] = useState<VersionRow[] | null>(null);
  const [detail, setDetail] = useState<D | null>(null);
  const [busy, setBusy] = useState(false);

  const { list, at, restore } = source;

  const load = useCallback(async () => {
    try { setVersions(await list()); }
    catch (e) { onError(toErrorMessage(e, 'Could not load the version list.')); }
  }, [list, onError]);

  useEffect(() => {
    if (!open) { setDetail(null); setVersions(null); return; }
    void load();
  }, [open, load]);

  async function openVersion(version: number) {
    try { setDetail(await at(version)); }
    catch (e) { onError(toErrorMessage(e, 'Could not open that version.')); }
  }

  async function doRestore(version: number) {
    setBusy(true);
    try {
      const minted = await restore(version);
      onChanged();
      setDetail(null);
      await load();
      onError(`Restored v${version} as v${minted} · from v${version}. v${version} and everything after it are still in the list.`);
    } catch (e) {
      onError(toErrorMessage(e, 'Could not restore that version.'));
    } finally { setBusy(false); }
  }

  return (
    <Modal open={open} onClose={onClose}
      title={detail ? `${title} — ${versionLabel(detail)}` : `${title} — versions`}
      footer={detail ? (
        <>
          <button type="button" className="text-sm text-muted underline" onClick={() => setDetail(null)}>
            Back to the list
          </button>
          {!detail.is_current && (
            <>
              {source.editFrom && (
                <button type="button" className="btn-outline-gold text-sm" disabled={busy}
                  onClick={() => { source.editFrom?.(detail.version); onClose(); }}>
                  <Pencil size={14} /> Edit from this version
                </button>
              )}
              <button type="button" className="btn-primary text-sm" disabled={busy}
                onClick={() => void doRestore(detail.version)}>
                <RotateCcw size={14} /> Restore this version
              </button>
            </>
          )}
        </>
      ) : (
        <button type="button" className="text-sm text-muted underline" onClick={onClose}>Close</button>
      )}>
      {detail ? (
        <>
          <p className="text-[12.5px] text-muted mb-4">
            {detail.is_current
              ? 'This is the live version — it is what people see where this is used.'
              : 'A fully retained copy, used nowhere. Restoring it mints a NEW version carrying this content; '
                + 'nothing above it is removed.'
                + (source.editFrom ? ` Editing from it mints a new version stamped “from v${detail.version}”.` : '')}
          </p>
          {source.preview(detail)}
        </>
      ) : versions === null ? (
        <p className="text-sm text-muted">Loading versions…</p>
      ) : (
        <>
          <p className="text-[12.5px] text-muted mb-3">
            Every save mints the next number. Nothing is ever overwritten or removed —
            open a version to read it, restore it, or edit it into a new one.
          </p>
          {source.note && <div className="text-[12.5px] text-gold-800 mb-3">{source.note}</div>}
          <div className="flex flex-col gap-1.5">
            {versions.map((v) => <VersionListRow key={v.version} v={v} onOpen={(n) => void openVersion(n)} />)}
            {versions.length === 0 && (
              <p className="text-sm text-muted">No versions have been retained for this yet.</p>
            )}
          </div>
        </>
      )}
    </Modal>
  );
}
