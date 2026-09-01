import { useEffect, useState } from 'react';
import { Send } from 'lucide-react';
import { pendingNotifySummary, type PendingNotifySummary } from '../../lib/contracts';
import { toErrorMessage } from '../../lib/ops/errors';
import { Modal } from '../ops/kit/Modal';

/**
 * NOTIFY — the confirmation modal (owner-final copy).
 *
 * The button is simply "Notify". There is no "submit", no "send for review".
 *
 * THE COPY IS GENERATED FROM THE ENFORCEMENT RULE, NOT WRITTEN ALONGSIDE IT.
 * `pendingNotifySummary` is one DB function (`pending_notify_summary`) that
 * returns both the counts this modal renders AND the very predicates the write
 * paths test (`changes_frozen` = document_changes_frozen, `requests_frozen` =
 * change_request_is_frozen). So the sentence below cannot promise editability
 * the database will not honour — they are the same source.
 *
 * THE TWO RULES THE COPY PROMISES, VERBATIM AS ENFORCED:
 *   • CHANGES  (edits to the document itself) stay editable until the other
 *     party OPENS THE DOCUMENT.       → enforced in set_contract_field /
 *                                       set_field_structured via
 *                                       document_changes_frozen
 *   • REQUESTS (change requests) stay editable until they are SEEN by the other
 *     party.                          → enforced in upsert_change_request /
 *                                       edit_change_request_entry via
 *                                       change_request_is_frozen
 */

/** "1 change" / "2 changes". The one pluralizer both clauses of the copy use. */
export function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}

/**
 * The noun phrase for what is being notified about, reflecting WHAT ACTUALLY
 * HAPPENED since the last notify. Each side pluralizes independently:
 *    changes only   → "2 changes"
 *    requests only  → "1 request"
 *    both           → "1 change and 2 requests"
 */
export function notifyNounPhrase(s: Pick<PendingNotifySummary, 'changes' | 'requests'>): string {
  const parts: string[] = [];
  if (s.changes > 0) parts.push(plural(s.changes, 'change'));
  if (s.requests > 0) parts.push(plural(s.requests, 'request'));
  return parts.join(' and ');
}

/**
 * The editability sentence. Only the clauses that apply appear, and each states
 * ITS OWN rule — changes freeze on document-open, requests freeze on being seen.
 * Returns null when there is nothing pending (no promise to make).
 */
export function notifyEditabilitySentence(
  s: Pick<PendingNotifySummary, 'changes' | 'requests' | 'other_party_name'>,
): string | null {
  const who = s.other_party_name;
  const clauses: string[] = [];
  if (s.changes > 0) clauses.push('changes until the document is opened');
  if (s.requests > 0) clauses.push(`requests until they are seen by ${who}`);
  if (clauses.length === 0) return null;
  return `You may edit ${clauses.join(', and ')}.`;
}

/** The full modal body sentence pair, built from the one summary. */
export function notifyCopy(s: PendingNotifySummary): { headline: string; editability: string | null } {
  return {
    headline: `This will notify ${s.other_party_name} to review your ${notifyNounPhrase(s)}.`,
    editability: notifyEditabilitySentence(s),
  };
}

export function NotifyConfirmModal({
  documentId, onCancel, onConfirm, busy,
}: {
  documentId: string;
  onCancel: () => void;
  /** Runs the actual notify. The modal stays up (disabled) until it settles. */
  onConfirm: () => Promise<void>;
  busy?: boolean;
}) {
  const [summary, setSummary] = useState<PendingNotifySummary | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    pendingNotifySummary(documentId)
      .then((s) => { if (live) setSummary(s); })
      .catch((e) => { if (live) setErr(toErrorMessage(e, 'Could not read this document.')); });
    return () => { live = false; };
  }, [documentId]);

  const copy = summary ? notifyCopy(summary) : null;

  return (
    /* ⚠️ TASK-FIX4 §3 — converged. A confirmation with nothing typed into it.
       ⚠️ TASK-MODAL2 D1: it used to close on click-out because it holds no field;
       it no longer does, because *"you cant determine which ones the user can
       reopen."* The X closes it and `Notify` stays the only affirmative act. */
    <Modal open onClose={onCancel} size="md" error={err}
      title={<span className="inline-flex items-center gap-2"><Send size={17} className="text-gold-ink" aria-hidden="true" /> Notify</span>}
      footer={
        <>
          <button type="button" className="btn-secondary text-sm" onClick={onCancel} disabled={busy}>
            Not yet
          </button>
          <button type="button" className="btn-primary text-sm" disabled={busy || !summary?.anything}
            onClick={() => void onConfirm()}>
            <Send size={14} /> {busy ? 'Notifying…' : 'Notify'}
          </button>
        </>
      }>
        {!summary && !err && <p className="text-sm text-muted">Checking what has changed…</p>}

        {summary && !summary.anything && (
          <p className="text-sm text-secondary mb-4">
            There is nothing new to notify {summary.other_party_name} about yet.
          </p>
        )}

        {summary && summary.anything && copy && (
          <>
            <p className="text-sm text-green-950 mb-2">{copy.headline}</p>
            {copy.editability && (
              <p className="text-[13px] text-secondary mb-4">{copy.editability}</p>
            )}
          </>
        )}
    </Modal>
  );
}

export default NotifyConfirmModal;
