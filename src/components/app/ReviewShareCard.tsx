import { useCallback, useEffect, useState } from 'react';
import { Share2, Trash2, Loader2 } from 'lucide-react';
import {
  contractViewTokens, sendContractReviewLink, revokeContractViewToken,
  type ContractViewLink,
} from '../../lib/contracts';
import { toErrorMessage } from '../../lib/ops/errors';

/**
 * SHARE FOR REVIEW — staff-only (fix round 3, item 5). Send a read-only review
 * link for this contract to any email address, and manage the active links.
 *
 * The read-only view is a share-for-review tool, not an invite path: the link
 * opens the contract body with boxed disclosures and nothing else, stays valid
 * until revoked here, and carries no account language. Inviting a party to sign is
 * a separate action (Send for review / the party invite).
 */
function fmtWhen(s: string): string {
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleString(undefined, {
    month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit',
  });
}

export function ReviewShareCard({ documentId }: { documentId: string }) {
  const [links, setLinks] = useState<ContractViewLink[]>([]);
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const load = useCallback(() => {
    contractViewTokens(documentId).then(setLinks).catch(() => setLinks([]));
  }, [documentId]);
  useEffect(load, [load]);

  async function send() {
    const addr = email.trim();
    if (!addr) return;
    setBusy(true); setErr(null); setNote(null);
    try {
      const r = await sendContractReviewLink(documentId, addr);
      setEmail('');
      setNote(r.emailed
        ? `Review link sent to ${addr}.`
        : `Link created for ${addr}, but the email did not send (${r.reason ?? 'provider not configured'}).`);
      load();
    } catch (e) {
      setErr(toErrorMessage(e, 'Could not send the review link.'));
    } finally { setBusy(false); }
  }

  async function revoke(invitationId: string) {
    if (!window.confirm('Revoke this review link? It will stop opening for whoever has it.')) return;
    setBusy(true); setErr(null);
    try { await revokeContractViewToken(invitationId); load(); }
    catch (e) { setErr(toErrorMessage(e, 'Could not revoke the link.')); }
    finally { setBusy(false); }
  }

  return (
    <div className="bg-white border border-green-800/10 rounded-xl p-4 mb-5">
      <div className="flex items-center gap-2 mb-2">
        <Share2 size={16} className="text-gold-ink" aria-hidden="true" />
        <h2 className="font-serif text-green-800">Share for review</h2>
      </div>
      <p className="text-[12px] text-muted mb-3">
        Send a read-only copy of this contract to any email — a party or anyone else.
        It opens the contract to read, with no account or sign-in, and stays open
        until you revoke it here.
      </p>
      {err && <p role="alert" className="form-error mb-2">{err}</p>}
      {note && <p className="mb-2 rounded px-3 py-2 text-[13px] bg-green-50 border border-green-400/40 text-green-900">{note}</p>}

      <div className="flex items-center gap-1.5 mb-3">
        <input type="email" inputMode="email" className="form-input text-[13px] py-1.5"
          placeholder="email to send the review link to" disabled={busy} value={email}
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void send(); } }}
          aria-label="Email to send the review link to" />
        <button type="button" className="btn-outline-gold text-xs px-3 py-1.5 shrink-0 inline-flex items-center gap-1.5"
          disabled={busy || !email.trim()} onClick={() => void send()}>
          {busy && <Loader2 size={13} className="animate-spin" />} Send link
        </button>
      </div>

      {links.length > 0 && (
        <div>
          <p className="text-[11px] uppercase tracking-wide text-muted mb-1.5">Active review links</p>
          <ul className="flex flex-col divide-y divide-green-800/8">
            {links.map((l) => (
              <li key={l.invitation_id} className="flex items-center justify-between gap-3 py-2">
                <span className="min-w-0">
                  <span className="block text-[13px] text-green-900 truncate">{l.email}</span>
                  <span className="block text-[11px] text-muted">Sent {fmtWhen(l.sent_at)}</span>
                </span>
                <button type="button" onClick={() => void revoke(l.invitation_id)} disabled={busy}
                  className="text-[11px] text-red-700 hover:bg-red-50 rounded px-2 py-1 focus-ring inline-flex items-center gap-1 shrink-0">
                  <Trash2 size={12} /> Revoke
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export default ReviewShareCard;
