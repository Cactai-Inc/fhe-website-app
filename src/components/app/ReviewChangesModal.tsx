import { useEffect, useState } from 'react';
import { ArrowLeft, X, Check, Loader2 } from 'lucide-react';
import {
  changesSinceSignature, postContractComment, type ChangeSinceSignature,
} from '../../lib/contracts';

/**
 * REVIEW CHANGES (deal plan L9) — what changed since this party's signature came
 * off, one change at a time, with Accept or Reject.
 *
 * Reject reveals a comment field. Because the location is already known, the
 * comment is PRE-AUTHORED with a sentence naming the change, who made it, and
 * when; the reviewer adds anything further below it. Saving writes through the
 * ordinary contracts comment function, so the note lands in the comments drawer
 * exactly as if it had been written there directly — this modal is only a
 * convenience that puts it in the flow.
 *
 * Skip closes without a comment but still records the rejection.
 * Back (top-left) returns to the change if they reconsider before saving.
 */

function when(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    month: 'long', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit',
  });
}

/** The sentence the rejection comment opens with — and its title. */
function rejectionIntro(c: ChangeSinceSignature, reviewer: string): string {
  const where = c.field_label ?? c.field_key ?? 'this document';
  const who = c.actor ?? 'the other party';
  return `Change made to ${where} on ${when(c.at)} by ${who} is not accepted by ${reviewer}.`;
}

export function ReviewChangesModal({
  documentId, reviewerName, onClose, onDone,
}: {
  documentId: string;
  /** How the reviewer is named in the pre-authored sentence. */
  reviewerName: string;
  onClose: () => void;
  onDone?: () => void;
}) {
  const [changes, setChanges] = useState<ChangeSinceSignature[] | null>(null);
  const [i, setI] = useState(0);
  const [rejecting, setRejecting] = useState(false);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [outcomes, setOutcomes] = useState<Record<string, 'accepted' | 'rejected'>>({});

  useEffect(() => {
    changesSinceSignature(documentId).then(setChanges)
      .catch((e) => { setErr(e instanceof Error ? e.message : 'Could not load the changes.'); setChanges([]); });
  }, [documentId]);

  const current = changes?.[i];
  const done = !!changes && i >= changes.length;

  function advance(id: string, outcome: 'accepted' | 'rejected') {
    setOutcomes((o) => ({ ...o, [id]: outcome }));
    setRejecting(false);
    setNote('');
    setI((n) => n + 1);
  }

  async function saveRejection(withComment: boolean) {
    if (!current) return;
    setBusy(true); setErr(null);
    try {
      if (withComment) {
        const intro = rejectionIntro(current, reviewerName);
        await postContractComment(documentId, {
          body: note.trim() ? `${intro}\n\n${note.trim()}` : intro,
          anchorKind: current.field_key ? 'field' : 'document',
          anchorRef: current.field_key ?? null,
        });
      }
      advance(current.id, 'rejected');
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not save that comment.');
    } finally { setBusy(false); }
  }

  const rejected = Object.values(outcomes).filter((o) => o === 'rejected').length;
  const accepted = Object.values(outcomes).filter((o) => o === 'accepted').length;

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-start justify-center overflow-y-auto p-4"
      role="dialog" aria-modal="true" aria-label="Review the changes"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white rounded-xl shadow-xl max-w-xl w-full my-8">
        <div className="flex items-center justify-between gap-3 px-5 py-3 border-b border-green-800/10">
          {rejecting ? (
            <button type="button" aria-label="Back to the change"
              className="text-muted hover:text-green-800 focus-ring"
              onClick={() => { setRejecting(false); setNote(''); }}>
              <ArrowLeft size={16} />
            </button>
          ) : <span className="w-4" />}
          <h3 className="font-serif text-green-900 text-base flex-1 text-center">
            {done ? 'Review complete' : 'Review the changes'}
          </h3>
          <button type="button" aria-label="Close" className="text-muted hover:text-green-800 focus-ring"
            onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        <div className="p-5">
          {err && <p role="alert" className="form-error mb-3">{err}</p>}

          {changes === null && <p className="text-sm text-muted">Loading the changes…</p>}

          {changes && changes.length === 0 && (
            <p className="text-sm text-green-900">
              Nothing has changed since your signature was removed.
            </p>
          )}

          {done && changes.length > 0 && (
            <div>
              <p className="text-sm text-green-900 mb-1">
                You reviewed {changes.length} change{changes.length === 1 ? '' : 's'}
                {accepted > 0 ? ` — ${accepted} accepted` : ''}
                {rejected > 0 ? `${accepted > 0 ? ',' : ' —'} ${rejected} not accepted` : ''}.
              </p>
              <p className="text-[12px] text-muted">
                {rejected > 0
                  ? 'Your comments are in the document’s comments for the other party.'
                  : 'You can sign the document when you are ready.'}
              </p>
              <button type="button" className="btn-primary text-sm mt-4"
                onClick={() => { onDone?.(); onClose(); }}>
                Done
              </button>
            </div>
          )}

          {current && !done && (
            <>
              <p className="text-[11px] tracking-wide uppercase text-muted font-semibold mb-1">
                Change {i + 1} of {changes!.length}
              </p>
              <p className="text-sm font-medium text-green-900 mb-2">
                {current.field_label ?? current.field_key ?? 'This document'}
              </p>
              <div className="text-sm text-green-950 bg-cream-100/60 border border-green-800/10 rounded-lg p-3 mb-2">
                <p className="line-through text-muted">{current.old_value || '(empty)'}</p>
                <p className="font-medium">{current.new_value || '(empty)'}</p>
              </div>
              <p className="text-[11.5px] text-muted mb-4">
                Changed by {current.actor ?? 'the other party'} on {when(current.at)}.
              </p>

              {!rejecting ? (
                <div className="flex gap-2">
                  <button type="button" className="btn-primary text-sm" disabled={busy}
                    onClick={() => advance(current.id, 'accepted')}>
                    <Check size={14} /> Accept
                  </button>
                  <button type="button" className="btn-outline-gold text-sm" disabled={busy}
                    onClick={() => setRejecting(true)}>
                    Reject
                  </button>
                </div>
              ) : (
                <div>
                  <p className="text-[12px] text-muted mb-1.5">
                    This note goes to the other party:
                  </p>
                  <p className="text-[12.5px] text-green-950 bg-cream-100/60 border border-green-800/10 rounded p-2.5 mb-2">
                    {rejectionIntro(current, reviewerName)}
                  </p>
                  <textarea className="form-input min-h-[5rem]" value={note}
                    aria-label="Add to your comment"
                    placeholder="Add anything you want them to know (optional)"
                    onChange={(e) => setNote(e.target.value)} />
                  <div className="flex gap-2 mt-2">
                    <button type="button" className="btn-primary text-sm" disabled={busy}
                      onClick={() => void saveRejection(true)}>
                      {busy && <Loader2 size={14} className="animate-spin" />} Save comment
                    </button>
                    <button type="button" className="btn-outline-gold text-sm" disabled={busy}
                      onClick={() => void saveRejection(false)}>
                      Skip
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
