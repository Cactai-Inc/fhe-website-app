import { useState } from 'react';
import { confirmMyLegalName, type NameConfirmationState } from '../../lib/api';
import { toErrorMessage } from '../../lib/ops/errors';

/**
 * CONFIRM YOUR LEGAL NAME — the soft gate.
 *
 * Shown when we hold two genuinely different surnames for someone and could not
 * safely choose between them. Rather than guess (a guessed surname on an executed
 * contract is not recoverable), we blank it and ask.
 *
 * SOFT by design: it blocks the two actions where a wrong name does damage —
 * filling a form and signing a contract — and nothing else. The member can still
 * browse, read their documents and use the community.
 *
 * There IS an authoritative gate server-side now: record_signature() compares the
 * typed signature against the signer's own contact record and refuses a mismatch
 * (FIX1 §C, 20260831T0900). Until 2026-08-31 this comment claimed that fence
 * existed when it did not (AR7 F3) — the server checked only that the typed name
 * was non-empty. What the fence does NOT do is decide WHICH name is right, which
 * is precisely this modal's job: it enforces agreement with the record, so a
 * wrong record produces a confidently wrong signature. That is the 2026-08-28
 * incident in one sentence, and it is why this soft gate matters.
 *
 * The copy deliberately does not accuse anyone of an error or explain our data
 * model. From the member's side this is simply: confirm how your name should
 * appear on your paperwork.
 */
export function ConfirmNameModal({
  state, onConfirmed, onDismiss,
}: {
  state: NameConfirmationState;
  onConfirmed: () => void;
  /** Present only where dismissal is allowed (browsing). Omitted on the signing
   *  and form paths, where confirming IS the next step. */
  onDismiss?: () => void;
}) {
  const [first, setFirst] = useState(state.first_name ?? '');
  const [last, setLast] = useState(state.last_name ?? '');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const canSave = first.trim() !== '' && last.trim() !== '' && !busy;

  async function save() {
    setBusy(true); setErr(null);
    try {
      await confirmMyLegalName(first.trim(), last.trim());
      onConfirmed();
    } catch (e) {
      setErr(toErrorMessage(e, 'Could not save your name.'));
      setBusy(false);
    }
  }

  const input = 'w-full px-3 py-2 rounded-lg border border-green-800/15 text-sm text-green-900 placeholder:text-muted focus-ring bg-white';

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-green-950/40 px-4"
      role="dialog" aria-modal="true" aria-labelledby="confirm-name-heading">
      <div className="bg-white rounded-2xl border border-green-800/10 p-6 max-w-md w-full">
        <h2 id="confirm-name-heading" className="font-serif text-xl text-green-800 mb-2">
          How should your name appear?
        </h2>
        <p className="body-text text-sm text-secondary mb-4">
          We want to be sure your agreements and records carry your name exactly as
          it should read. Please confirm your full legal name — this is what will
          appear on anything you sign.
        </p>

        {err && <p role="alert" className="form-error mb-3">{err}</p>}

        <div className="flex flex-col gap-2.5 mb-5">
          <div>
            <label htmlFor="cn-first" className="block text-[10px] uppercase tracking-wide text-muted mb-1">
              First name
            </label>
            <input id="cn-first" className={input} value={first} autoFocus
              onChange={(e) => setFirst(e.target.value)} />
          </div>
          <div>
            <label htmlFor="cn-last" className="block text-[10px] uppercase tracking-wide text-muted mb-1">
              Last name
            </label>
            <input id="cn-last" className={input} value={last} placeholder="Your legal surname"
              onChange={(e) => setLast(e.target.value)} />
          </div>
        </div>

        <div className="flex flex-wrap justify-end gap-2">
          {onDismiss && (
            <button type="button" className="btn-secondary text-sm" onClick={onDismiss} disabled={busy}>
              Not now
            </button>
          )}
          <button type="button" className="btn-primary text-sm" disabled={!canSave} onClick={() => void save()}>
            {busy ? 'Saving…' : 'Confirm my name'}
          </button>
        </div>
      </div>
    </div>
  );
}
