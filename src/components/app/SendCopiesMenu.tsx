import { useEffect, useRef, useState } from 'react';
import { ChevronDown, Send } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { myContactId } from '../../lib/ops/api-client';
import type { PartySummary } from '../../lib/contracts';

/**
 * A8B — staff "Send copies" menu on an EXECUTED document.
 *
 * Four targeted options, each hitting a different delivery path:
 *  1. Send to me       -> /api/deliver-documents { recipientContactIds: [myContactId] }
 *  2. Send to <Lessor>  -> same endpoint, targeted at the horse-owning side's party ids
 *  3. Send to <Lessee>  -> same endpoint, targeted at the other side's party ids
 *  4. Send to all parties -> resend_executed_document_email(doc_id) RPC — the
 *     OFFICIAL all-parties resend, which re-stamps executed_email_sent_at.
 *     Options 1-3 are targeted sends and deliberately do NOT touch that stamp
 *     (see api/deliver-documents.ts).
 *
 * Role labels come from the document's own parties, never person names.
 * Options 2/3 hide when that side has no party with an email on file.
 */

const LESSOR_SIDE = ['LESSOR', 'SELLER'];
const LESSEE_SIDE = ['LESSEE', 'BUYER'];

function roleLabel(role: string): string {
  if (role === 'LESSOR') return 'Lessor';
  if (role === 'SELLER') return 'Seller';
  if (role === 'LESSEE') return 'Lessee';
  if (role === 'BUYER') return 'Buyer';
  return role.charAt(0) + role.slice(1).toLowerCase();
}

async function deliverTargeted(
  documentId: string,
  recipientContactIds: string[],
): Promise<{ email: string; count: number }[]> {
  const res = await fetch('/api/deliver-documents', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ documentIds: [documentId], recipientContactIds }),
  });
  const json = (await res.json().catch(() => ({}))) as
    { error?: string; delivered?: { email: string; count: number }[] };
  if (!res.ok) throw new Error(json.error || `Could not send (HTTP ${res.status}).`);
  return json.delivered ?? [];
}

export function SendCopiesMenu({
  documentId, parties, sentAt, onSent,
}: {
  documentId: string;
  parties: PartySummary[];
  /** documents.executed_email_sent_at — drives the Send/Resend label. */
  sentAt?: string | null;
  /** Called after a successful send so the caller can reload doc state
   *  (only "Send to all parties" changes anything worth reloading). */
  onSent?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  const lessorParties = parties.filter((p) => LESSOR_SIDE.includes(p.party_role) && p.email && p.contact_id);
  const lesseeParties = parties.filter((p) => LESSEE_SIDE.includes(p.party_role) && p.email && p.contact_id);
  const lessorLabel = lessorParties[0] ? roleLabel(lessorParties[0].party_role) : null;
  const lesseeLabel = lesseeParties[0] ? roleLabel(lesseeParties[0].party_role) : null;

  const run = async (action: () => Promise<string>) => {
    setPending(true);
    setResult(null);
    setOpen(false);
    try {
      const text = await action();
      setResult({ tone: 'success', text });
      onSent?.();
    } catch (err) {
      setResult({ tone: 'error', text: err instanceof Error ? err.message : String(err) });
    } finally {
      setPending(false);
    }
  };

  const sendToMe = () => run(async () => {
    const myId = await myContactId();
    if (!myId) throw new Error('Your account has no linked contact record.');
    const delivered = await deliverTargeted(documentId, [myId]);
    return delivered.length > 0 ? `Sent to ${delivered[0].email}.` : 'Already sent to you.';
  });

  const sendToSide = (sideParties: PartySummary[], label: string) => run(async () => {
    const ids = sideParties.map((p) => p.contact_id).filter((cid): cid is string => !!cid);
    if (ids.length === 0) throw new Error(`No ${label.toLowerCase()} party has an email on file.`);
    const delivered = await deliverTargeted(documentId, ids);
    return delivered.length > 0
      ? `Sent to ${label} (${delivered.length} recipient${delivered.length === 1 ? '' : 's'}).`
      : `Already sent to ${label}.`;
  });

  const sendToAll = () => run(async () => {
    const { data, error } = await supabase.rpc('resend_executed_document_email', {
      p_document_id: documentId,
    });
    if (error) throw error;
    const outcome = data as { sent?: boolean; reason?: string } | null;
    if (outcome && outcome.sent === false) throw new Error(outcome.reason ?? 'Could not send.');
    return 'Sent to all parties.';
  });

  const buttonLabel = sentAt ? 'Resend copies' : 'Send copies';

  return (
    <div className="relative inline-block" ref={containerRef}>
      <button
        type="button"
        className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-green-800/20 px-4 py-3 text-sm font-medium text-secondary hover:bg-green-800/5 focus-ring disabled:opacity-50 disabled:cursor-not-allowed"
        onClick={() => setOpen((v) => !v)}
        disabled={pending}
        aria-expanded={open}
        aria-haspopup="menu"
        data-testid="send-copies-menu-btn"
      >
        <Send size={14} aria-hidden="true" />
        {pending ? 'Sending…' : buttonLabel}
        <ChevronDown size={14} aria-hidden="true" />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute left-0 z-40 mt-1 min-w-[14rem] rounded-lg border border-green-800/15 bg-white shadow-lg py-1"
        >
          <button type="button" role="menuitem"
            className="w-full text-left px-3 py-2 text-sm text-green-900 hover:bg-green-800/5"
            onClick={sendToMe}>
            Send to me
          </button>
          {lessorParties.length > 0 && lessorLabel && (
            <button type="button" role="menuitem"
              className="w-full text-left px-3 py-2 text-sm text-green-900 hover:bg-green-800/5"
              onClick={() => sendToSide(lessorParties, lessorLabel)}>
              Send to {lessorLabel}
            </button>
          )}
          {lesseeParties.length > 0 && lesseeLabel && (
            <button type="button" role="menuitem"
              className="w-full text-left px-3 py-2 text-sm text-green-900 hover:bg-green-800/5"
              onClick={() => sendToSide(lesseeParties, lesseeLabel)}>
              Send to {lesseeLabel}
            </button>
          )}
          <button type="button" role="menuitem"
            className="w-full text-left px-3 py-2 text-sm text-green-900 hover:bg-green-800/5"
            onClick={sendToAll}>
            Send to all parties
          </button>
        </div>
      )}

      {result && (
        <p role={result.tone === 'error' ? 'alert' : 'status'}
          className={`mt-1 text-xs ${result.tone === 'error' ? 'text-red-700' : 'text-green-700'}`}>
          {result.tone === 'error' ? `Could not send: ${result.text}` : result.text}
        </p>
      )}
    </div>
  );
}
