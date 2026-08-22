import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, Lock, RefreshCw, Trash2 } from 'lucide-react';
import { Modal } from './kit/Modal';
import { StatusBadge } from './kit/StatusBadge';
import { toErrorMessage } from '../../lib/ops/errors';
import {
  cleanupDocument,
  documentIntegrity,
  type DocumentIntegrity,
  type IntegrityItem,
} from '../../lib/support';

/**
 * DOCUMENT INTEGRITY (CONTRACTORPHAN Parts 2 + 3) — the panel that makes broken
 * documents visible on the Oversight page, and lets the owner clear them himself
 * instead of being told about the next one by a thread.
 *
 * Owner ruling 2026-08-10: "delete entirely and provide ui elements for me to be
 * able to see this and the functionality to be able to cleanup the mess next time".
 *
 * Two rules govern everything below.
 *
 *  1. EVERY CHECK RENDERS, INCLUDING AT ZERO. A check that disappears when it
 *     passes is a check the owner cannot trust — he needs to see that it ran.
 *
 *  2. SIGNED DOCUMENTS ARE EVIDENCE AND HAVE NO BUTTON. The contact-orphan set is
 *     rendered in its own group, labelled known and expected, with no action
 *     control of any kind: 5 are EXECUTED and signed, 1 is VOID, and they leave
 *     with the owner-run post-Stage-5 purge via the 5g routine, never from here.
 *     `can_cleanup_document` refuses them independently, so the guard holds even
 *     if this file is later got wrong.
 *
 * Removal is one document at a time, each individually confirmed by name and
 * horse, with a required reason written to `status_events`. There is no
 * "clean all" — a bulk control over a list that includes signed documents is one
 * mis-click from destroying evidence.
 */
export function DocumentIntegrityPanel() {
  const [data, setData] = useState<DocumentIntegrity | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [target, setTarget] = useState<IntegrityItem | null>(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [removed, setRemoved] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setData(await documentIntegrity());
    } catch {
      setError('Could not run the document integrity checks.');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function confirmRemove() {
    if (!target) return;
    setBusy(true);
    setModalError(null);
    try {
      const result = await cleanupDocument(target.id, reason.trim());
      setRemoved(`${result.display_code ?? 'Document'} was removed.`);
      setTarget(null);
      setReason('');
      await load();
    } catch (e) {
      setModalError(toErrorMessage(e, 'Could not remove that document.'));
    } finally {
      setBusy(false);
    }
  }

  function openConfirm(item: IntegrityItem) {
    setTarget(item);
    setReason('');
    setModalError(null);
    setRemoved(null);
  }

  const totalActionable = data?.checks.reduce((n, c) => n + c.count, 0) ?? 0;

  return (
    <section className="mb-8">
      <div className="flex items-center justify-between gap-3 mb-1">
        <h2 className="font-serif font-medium text-green-800 text-xl">Document integrity</h2>
        <button
          type="button"
          onClick={() => void load()}
          className="inline-flex items-center gap-1.5 text-xs text-green-800/70 hover:text-green-900 focus-ring rounded px-1.5 py-1"
        >
          <RefreshCw size={13} aria-hidden="true" />
          Re-run
        </button>
      </div>
      <p className="text-sm text-green-800/70 mb-3">
        {data
          ? `Five checks over every live document. Last run ${new Date(data.checked_at).toLocaleString()}.`
          : 'Five checks over every live document.'}
      </p>

      {error && (
        <p role="alert" className="form-error mb-4">
          {error}
        </p>
      )}
      {removed && (
        <p role="status" className="mb-4 rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-2.5 text-sm text-emerald-900">
          {removed} The reason has been recorded against it.
        </p>
      )}
      {!data && !error && <p className="text-sm text-green-800/70">Running checks…</p>}

      {data && (
        <>
          {totalActionable === 0 && (
            <p className="mb-3 flex items-center gap-2 text-sm text-emerald-900">
              <CheckCircle2 size={16} className="text-emerald-700" aria-hidden="true" />
              All checks passed.
            </p>
          )}

          <div className="bg-white border border-green-800/10 rounded-lg divide-y divide-green-800/10">
            {data.checks.map((check) => (
              <div key={check.key} className="px-4 py-3">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="font-sans text-sm font-medium text-green-900">{check.label}</p>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                      check.count === 0 ? 'bg-green-800/10 text-green-800' : 'bg-red-100 text-red-800'
                    }`}
                  >
                    {check.count}
                  </span>
                </div>

                {check.count === 0 ? (
                  <p className="mt-0.5 text-xs text-muted">Nothing found.</p>
                ) : (
                  <>
                    <p className="mt-0.5 text-xs text-muted">{check.why}</p>
                    <ul className="mt-2 space-y-2">
                      {check.items.map((item) => (
                        <li
                          key={`${check.key}:${item.id}`}
                          className="rounded-lg border border-green-800/10 bg-green-50/40 px-3 py-2"
                        >
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-mono text-xs text-green-900">
                              {item.display_code ?? item.id}
                            </span>
                            {item.status && <StatusBadge status={item.status} />}
                            {item.horse && (
                              <span className="text-xs text-muted">horse: {item.horse}</span>
                            )}
                          </div>
                          <p className="mt-0.5 text-sm text-green-950">{item.title ?? 'Untitled'}</p>
                          <p className="mt-0.5 text-xs text-muted">{item.detail}</p>
                          <div className="mt-1.5">
                            {item.can_cleanup ? (
                              <button
                                type="button"
                                onClick={() => openConfirm(item)}
                                className="inline-flex items-center gap-1.5 rounded-lg border border-red-300 bg-white px-2.5 py-1 text-xs font-medium text-red-700 hover:bg-red-50 focus-ring"
                              >
                                <Trash2 size={12} aria-hidden="true" />
                                Remove this document
                              </button>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 text-xs text-muted">
                                <Lock size={12} aria-hidden="true" />
                                Signed or closed — kept as evidence, not removable here.
                              </span>
                            )}
                          </div>
                        </li>
                      ))}
                    </ul>
                    {check.count > check.items.length && (
                      <p className="mt-2 text-xs text-muted">
                        Showing the first {check.items.length} of {check.count}.
                      </p>
                    )}
                  </>
                )}
              </div>
            ))}
          </div>

          {/* ── Known and expected. Reported, explained, never actionable. ──── */}
          <div className="mt-4 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3">
            <div className="flex items-baseline justify-between gap-3">
              <p className="font-sans text-sm font-medium text-amber-900">
                Known and expected — no action needed
              </p>
              <span className="shrink-0 rounded-full bg-amber-200 px-2 py-0.5 text-xs font-medium text-amber-900">
                {data.known.count}
              </span>
            </div>
            <p className="mt-0.5 text-xs text-amber-900/80">{data.known.label}</p>
            <p className="mt-1.5 text-xs text-amber-900/90">{data.known.note}</p>
            {data.known.items.length > 0 && (
              <ul className="mt-2 space-y-1.5">
                {data.known.items.map((item) => (
                  <li key={item.id} className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="font-mono text-amber-900">{item.display_code ?? item.id}</span>
                    <span className="text-amber-900/80">{item.title ?? 'Untitled'}</span>
                    {item.status && <StatusBadge status={item.status} />}
                    <span className="text-amber-900/70">
                      {item.signatures} signature{item.signatures === 1 ? '' : 's'}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}

      {/* ── Confirm, by name and horse. Never "this item". ─────────────────── */}
      <Modal
        open={target !== null}
        onClose={() => {
          if (!busy) setTarget(null);
        }}
        disableBackdropClose={busy}
        title="Remove this document?"
        footer={
          <>
            <button
              type="button"
              className="btn-secondary text-sm"
              disabled={busy}
              onClick={() => setTarget(null)}
            >
              Keep it
            </button>
            <button
              type="button"
              disabled={busy || reason.trim().length === 0}
              onClick={() => void confirmRemove()}
              className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-red-300 bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 focus-ring disabled:opacity-60"
            >
              {busy ? 'Removing…' : 'Yes, remove it'}
            </button>
          </>
        }
      >
        {target && (
          <>
            <p className="mb-3 flex items-start gap-2 text-sm text-green-950">
              <AlertTriangle size={18} className="mt-0.5 shrink-0 text-red-600" aria-hidden="true" />
              <span>
                You are about to remove{' '}
                <strong className="font-medium">{target.display_code ?? target.id}</strong>,{' '}
                <strong className="font-medium">{target.title ?? 'Untitled'}</strong>
                {target.horse ? (
                  <>
                    , for horse <strong className="font-medium">{target.horse}</strong>
                  </>
                ) : null}
                . It is {target.status ?? 'unknown'} and carries no signature.
              </span>
            </p>
            <p className="mb-3 text-sm text-secondary">{target.detail}</p>
            <label className="form-label block">
              Why are you removing it? Required — this is recorded against the document.
              <textarea
                rows={3}
                className="form-input mt-1 w-full resize-y text-sm"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. the contract it belongs to no longer exists, so it can never be signed"
              />
            </label>
            {modalError && (
              <p role="alert" className="form-error mt-2 text-xs">
                {modalError}
              </p>
            )}
          </>
        )}
      </Modal>
    </section>
  );
}

export default DocumentIntegrityPanel;
