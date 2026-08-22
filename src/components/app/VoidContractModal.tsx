import { useState } from 'react';
import { X, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { voidDocument, setDocumentPartyHidden, emailVoidNotice } from '../../lib/contracts';
import { toErrorMessage } from '../../lib/ops/errors';

/**
 * VOID CONTRACT — the three-page modal that replaces the old hard-void.
 *
 *  Page 1  confirm: "Are you sure you are no longer interested in this lease
 *          contract?" + a note so the voiding party can tell the other party why.
 *          The confirm button reads "Yes, void this document."
 *  Page 2  keep a copy, or remove it from their documents page.
 *  Page 3  success. Then:
 *            remove → return to the page they were on when the contract opened
 *            keep   → stay on the document, greyed out with a VOID watermark
 *
 *  Closing via the X on page 1 or 2 does NOT void. (On page 1 nothing has
 *  happened yet; on page 2 the void is already recorded — closing there simply
 *  leaves the default, which is KEEP. Nothing is ever destroyed.)
 *
 *  OWNER DECISION: keep-or-remove is PER-PARTY. "Remove" hides the document from
 *  THIS party's view only; the legal record survives for the other party and for
 *  staff/ops. It is a hidden flag, never a delete.
 */
export function VoidContractModal({
  documentId, onClose, onVoided, onRemoved,
}: {
  documentId: string;
  /** Dismissed without completing — page 1 or 2 X. Never voids from page 1. */
  onClose: () => void;
  /** Voided and the party chose KEEP — stay on the watermarked document. */
  onVoided: () => void;
  /** Voided and the party chose REMOVE — leave for wherever they came from. */
  onRemoved: () => void;
}) {
  const [page, setPage] = useState<1 | 2 | 3>(1);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [choice, setChoice] = useState<'keep' | 'remove' | null>(null);

  async function confirmVoid() {
    setBusy(true); setErr(null);
    try {
      await voidDocument(documentId, note.trim() || null);
      // the in-app notification is already recorded by the DB; email is the
      // second half of the same event and must not block the flow.
      try { await emailVoidNotice(documentId); } catch { /* notification landed */ }
      setPage(2);
    } catch (e) {
      setErr(toErrorMessage(e, 'Could not void this document.'));
    } finally { setBusy(false); }
  }

  async function choose(which: 'keep' | 'remove') {
    setBusy(true); setErr(null);
    try {
      // KEEP is the default state, but call it explicitly so the choice is recorded
      // either way and re-choosing later is symmetrical.
      await setDocumentPartyHidden(documentId, which === 'remove');
      setChoice(which);
      setPage(3);
    } catch (e) {
      setErr(toErrorMessage(e, 'Could not save that choice.'));
    } finally { setBusy(false); }
  }

  const dismissable = page === 1 || page === 2;

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
      onClick={() => { if (dismissable) onClose(); }}>
      <div className="bg-white rounded-xl border border-green-800/15 shadow-lg max-w-lg w-full p-6"
        role="dialog" aria-modal="true"
        aria-label={page === 1 ? 'Void this document' : page === 2 ? 'Keep or remove' : 'Document voided'}
        onClick={(e) => e.stopPropagation()}>

        {dismissable && (
          <button type="button" aria-label="Close" onClick={onClose}
            className="float-right -mt-2 -mr-2 p-2 text-muted hover:text-green-900 focus-ring rounded">
            <X size={18} />
          </button>
        )}

        {/* ── PAGE 1 — confirm + note ────────────────────────────────────── */}
        {page === 1 && (
          <>
            <h3 className="font-serif text-green-900 text-lg mb-1 flex items-center gap-2">
              <AlertTriangle size={18} className="text-red-600" aria-hidden="true" />
              Void this document
            </h3>
            <p className="text-sm text-green-950 mb-3">
              Are you sure you are no longer interested in this lease contract?
            </p>
            <label className="form-label block mb-3">
              A note to the other party (optional)
              <textarea rows={3} className="form-input mt-1 resize-y text-sm w-full" autoFocus
                placeholder="Let them know why — they&rsquo;ll see this with the notification."
                value={note} onChange={(e) => setNote(e.target.value)} />
            </label>
            {err && <p role="alert" className="form-error mb-2 text-xs">{err}</p>}
            <div className="flex flex-col sm:flex-row gap-2 sm:justify-end">
              <button type="button" className="btn-secondary text-sm" onClick={onClose}>
                Keep this contract
              </button>
              <button type="button" disabled={busy}
                className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-red-300 bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 focus-ring disabled:opacity-60"
                onClick={() => void confirmVoid()}>
                {busy ? 'Voiding…' : 'Yes, void this document.'}
              </button>
            </div>
          </>
        )}

        {/* ── PAGE 2 — keep or remove (PER PARTY) ────────────────────────── */}
        {page === 2 && (
          <>
            <h3 className="font-serif text-green-900 text-lg mb-1">This contract is void</h3>
            <p className="text-sm text-secondary mb-4">
              The other party has been notified. Would you like to keep a copy, or
              remove it from your documents page? Removing it only affects your view —
              the record is retained.
            </p>
            {err && <p role="alert" className="form-error mb-2 text-xs">{err}</p>}
            <div className="flex flex-col sm:flex-row gap-2 sm:justify-end">
              <button type="button" className="btn-secondary text-sm" disabled={busy}
                onClick={() => void choose('remove')}>
                Remove from my documents
              </button>
              <button type="button" className="btn-primary text-sm" disabled={busy}
                onClick={() => void choose('keep')}>
                Keep a copy
              </button>
            </div>
          </>
        )}

        {/* ── PAGE 3 — success ───────────────────────────────────────────── */}
        {page === 3 && (
          <>
            <h3 className="font-serif text-green-900 text-lg mb-1 flex items-center gap-2">
              <CheckCircle2 size={18} className="text-green-700" aria-hidden="true" />
              Done
            </h3>
            <p className="text-sm text-secondary mb-4">
              {choice === 'remove'
                ? 'The contract was voided and removed from your documents page. The other party still has their copy.'
                : 'The contract was voided. It stays on your documents page, marked void.'}
            </p>
            <div className="flex justify-end">
              <button type="button" className="btn-primary text-sm"
                onClick={() => (choice === 'remove' ? onRemoved() : onVoided())}>
                {choice === 'remove' ? 'Back to my documents' : 'View the document'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/**
 * The counterparty's keep-or-remove prompt. Shown when they open a document the
 * OTHER party voided and they haven't yet chosen. Same choice, same per-party
 * semantics — it just skips the confirm page (they didn't do the voiding).
 */
export function VoidedKeepOrRemove({
  documentId, note, byLabel, onChosen, onRemoved,
}: {
  documentId: string;
  note: string | null;
  byLabel?: string | null;
  onChosen: () => void;
  onRemoved: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function choose(which: 'keep' | 'remove') {
    setBusy(true); setErr(null);
    try {
      await setDocumentPartyHidden(documentId, which === 'remove');
      if (which === 'remove') onRemoved(); else onChosen();
    } catch (e) {
      setErr(toErrorMessage(e, 'Could not save that choice.'));
    } finally { setBusy(false); }
  }

  return (
    <div className="mb-4 rounded-lg border border-red-300 bg-red-50 px-4 py-3">
      <p className="text-sm font-medium text-red-900">
        {byLabel ? `${byLabel} voided this contract.` : 'This contract was voided by the other party.'}
      </p>
      {note && <p className="text-sm text-red-800 mt-1 whitespace-pre-line">&ldquo;{note}&rdquo;</p>}
      <p className="text-[13px] text-red-800 mt-2">
        Keep a copy, or remove it from your documents page? Removing it only affects your view.
      </p>
      {err && <p role="alert" className="form-error mt-2 text-xs">{err}</p>}
      <div className="mt-2.5 flex flex-col sm:flex-row gap-2">
        <button type="button" className="btn-primary text-xs" disabled={busy}
          onClick={() => void choose('keep')}>Keep a copy</button>
        <button type="button" className="btn-secondary text-xs" disabled={busy}
          onClick={() => void choose('remove')}>Remove from my documents</button>
      </div>
    </div>
  );
}

export default VoidContractModal;
