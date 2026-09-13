import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Modal } from '../ops/kit/Modal';
import { BackControl } from './BackControl';
import { toErrorMessage } from '../../lib/ops/errors';
import {
  changesSinceSignature, postContractComment, type ChangeSinceSignature,
} from '../../lib/contracts';

/**
 * REVIEW CHANGES — what changed since this party's signature came off, one change
 * at a time.
 *
 * ⚠️ D14 §2 / D29 — SEEN-IS-APPROVED. A CHANGE is something the other party was
 * already entitled to make; it is already true. Being shown it IS the approval —
 * there is no Accept button and no Reject button, because there is nothing to
 * decide. (That is the distinction from a PROPOSAL, which is not yet true and
 * does carry accept/reject/revise — a different surface entirely.)
 *
 * The reviewer steps Next through the changes. If they DISAGREE, the honest next
 * step is not a "reject" verb — it is to say so: "I disagree — add a note" opens
 * a pre-authored comment they can add to, which lands in the document's comments
 * for the other party (owner: "if they disagree they need to contact me to
 * discuss it or they can change the document again and add a note"). Seeing the
 * changes without commenting leaves them free to sign again straight away.
 */

function when(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    month: 'long', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit',
  });
}

/** The sentence a disagreement comment opens with — and its title. */
function disagreeIntro(c: ChangeSinceSignature, reviewer: string): string {
  const where = c.field_label ?? c.field_key ?? 'this document';
  const who = c.actor ?? 'the other party';
  return `${reviewer} has a question about the change to ${where} made on ${when(c.at)} by ${who}.`;
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
  const [commenting, setCommenting] = useState(false);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  /** How many changes carried a disagreement note (for the closing summary). */
  const [flagged, setFlagged] = useState(0);

  useEffect(() => {
    changesSinceSignature(documentId).then(setChanges)
      .catch((e) => { setErr(toErrorMessage(e, 'Could not load the changes.')); setChanges([]); });
  }, [documentId]);

  const current = changes?.[i];
  const done = !!changes && i >= changes.length;

  function next() {
    setCommenting(false);
    setNote('');
    setI((n) => n + 1);
  }

  async function saveComment() {
    if (!current) return;
    setBusy(true); setErr(null);
    try {
      const intro = disagreeIntro(current, reviewerName);
      await postContractComment(documentId, {
        body: note.trim() ? `${intro}\n\n${note.trim()}` : intro,
        anchorKind: current.field_key ? 'field' : 'document',
        anchorRef: current.field_key ?? null,
      });
      setFlagged((n) => n + 1);
      next();
    } catch (e) {
      setErr(toErrorMessage(e, 'Could not save that comment.'));
    } finally { setBusy(false); }
  }

  return (
    <Modal open onClose={onClose} size="md" title={done ? 'Review complete' : 'Review the changes'}
      error={err}>
        <div>
          {commenting && (
            <div className="mb-3">
              <BackControl label="Back to the change"
                onClick={() => { setCommenting(false); setNote(''); }} />
            </div>
          )}

          {changes === null && <p className="text-sm text-muted">Loading the changes…</p>}

          {changes && changes.length === 0 && (
            <p className="text-sm text-green-900">
              Nothing has changed since your signature was removed.
            </p>
          )}

          {done && changes.length > 0 && (
            <div>
              <p className="text-sm text-green-900 mb-1">
                You've seen all {changes.length} change{changes.length === 1 ? '' : 's'}.
              </p>
              <p className="text-[12px] text-muted">
                {flagged > 0
                  ? `You left ${flagged} note${flagged === 1 ? '' : 's'} for the other party in the document's comments. You can sign when you're ready, or wait to hear back.`
                  : 'You can sign the document whenever you’re ready.'}
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

              {!commenting ? (
                <div className="flex gap-2">
                  {/* Seen-is-approved: Next advances and that is the approval.
                      No Accept/Reject verbs (D14 §2 / D29). */}
                  <button type="button" className="btn-primary text-sm" disabled={busy}
                    onClick={next}>
                    {i + 1 < changes!.length ? 'Next' : 'Finish'}
                  </button>
                  <button type="button" className="btn-outline-gold text-sm" disabled={busy}
                    onClick={() => setCommenting(true)}>
                    I disagree — add a note
                  </button>
                </div>
              ) : (
                <div>
                  <p className="text-[12px] text-muted mb-1.5">
                    This note goes to the other party:
                  </p>
                  <p className="text-[12.5px] text-green-950 bg-cream-100/60 border border-green-800/10 rounded p-2.5 mb-2">
                    {disagreeIntro(current, reviewerName)}
                  </p>
                  <textarea className="form-input min-h-[5rem]" value={note}
                    aria-label="Add to your comment"
                    placeholder="Tell them what you'd like to discuss (optional)"
                    onChange={(e) => setNote(e.target.value)} />
                  <div className="flex gap-2 mt-2">
                    <button type="button" className="btn-primary text-sm" disabled={busy}
                      onClick={() => void saveComment()}>
                      {busy && <Loader2 size={14} className="animate-spin" />} Save note & continue
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
    </Modal>
  );
}
