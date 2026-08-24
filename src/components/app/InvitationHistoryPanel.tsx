import { useCallback, useEffect, useState } from 'react';
import { Copy, Check, Send } from 'lucide-react';
import { toErrorMessage } from '../../lib/ops/errors';
import {
  adminInvitationHistory, adminResendInvitation,
  inviteLinkState, inviteRetiredReason,
  type InvitationHistoryRow, type InviteLinkState,
} from '../../lib/admin';

/**
 * INVITATION LINKS — the staff support view on a person's record.
 *
 * The owner's case, verbatim: a client reads a URL down the phone and he has to
 * tell at a glance whether it is the current link, a retired one or an expired
 * one, and send the right one without leaving the page. So this shows EVERY
 * invitation ever issued to that person — retired links are retired, not
 * hidden — with the real activation URL on each row.
 *
 * ⚠ The URL contains a LIVE CREDENTIAL. This component is staff-only by
 * construction: `adminInvitationHistory` reads `invitations`, whose RLS is
 * permissive `is_admin()` AND restrictive `org_id = current_org()`, so a
 * non-admin gets an empty list rather than tokens. Do not mount it on any
 * surface that is not staff-gated, and do not log the URL anywhere.
 */

const STATE_STYLE: Record<InviteLinkState, { label: string; chip: string }> = {
  draft:    { label: 'Not sent', chip: 'bg-gold-50 text-gold-900 border-gold-400' },
  current:  { label: 'Current',  chip: 'bg-green-100 text-green-900 border-green-300' },
  retired:  { label: 'Retired',  chip: 'bg-cream-100 text-secondary border-green-800/20' },
  expired:  { label: 'Expired',  chip: 'bg-amber-50 text-amber-900 border-amber-300' },
  redeemed: { label: 'Redeemed', chip: 'bg-green-50 text-green-800 border-green-200' },
};

function when(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit',
  });
}

/** The activation URL for a token, on whichever host staff are actually using. */
function activationUrl(token: string): string {
  return `${window.location.origin}/activate?token=${token}`;
}

function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        void navigator.clipboard.writeText(value).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1800);
        });
      }}
      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded border border-green-800/20
                 text-[11.5px] text-green-900 hover:bg-green-50 focus-ring whitespace-nowrap"
      aria-label={label}
    >
      {copied ? <Check size={13} /> : <Copy size={13} />}
      {copied ? 'Copied' : 'Copy link'}
    </button>
  );
}

export interface InvitationHistoryPanelProps {
  contactId?: string | null;
  email?: string | null;
  /** Re-fetch when the host page sends a new invitation. */
  refreshKey?: number | string;
  /** Told when a resend lands, so the host can refresh its own invite summary. */
  onResent?: () => void;
}

export function InvitationHistoryPanel({ contactId, email, refreshKey, onResent }: InvitationHistoryPanelProps) {
  const [rows, setRows] = useState<InvitationHistoryRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ id: string; ok: boolean; text: string } | null>(null);

  const load = useCallback(() => {
    if (!contactId && !email) { setRows([]); return; }
    adminInvitationHistory({ contactId, email })
      .then((r) => { setRows(r); setError(null); })
      .catch((e) => { setRows([]); setError(toErrorMessage(e, 'Could not load the invitation history.')); });
  }, [contactId, email]);

  useEffect(load, [load, refreshKey]);

  async function resend(row: InvitationHistoryRow) {
    setBusyId(row.id); setNotice(null);
    try {
      const r = await adminResendInvitation(row.id);
      setNotice(r.emailed
        ? { id: row.id, ok: true, text: `Same link emailed again to ${r.email}.` }
        : { id: row.id, ok: false, text: `NOT emailed — ${r.emailError || 'no reason reported'}. Copy the link and send it yourself.` });
      onResent?.();
      load();
    } catch (e) {
      setNotice({ id: row.id, ok: false, text: toErrorMessage(e, 'Could not resend the invitation.') });
    } finally {
      setBusyId(null);
    }
  }

  if (rows === null) {
    return <p className="text-[12px] text-muted">Loading invitation links…</p>;
  }

  return (
    <div>
      <p className="text-[11px] uppercase tracking-wide text-green-800/50 mb-1">Invitation links</p>
      <p className="text-[12px] text-muted mb-3">
        Every link ever issued to this person. Only the <strong>current</strong> one activates
        an account — retired and expired links are kept so you can recognise one read to you
        over the phone. A <strong>Not sent</strong> link belongs to an account that has been
        created and never emailed; it works, but nobody has been given it.
      </p>

      {error && <p role="alert" className="form-error mb-3">{error}</p>}
      {rows.length === 0 && !error && (
        <p className="text-[12px] text-muted">No invitation has been issued to this person yet.</p>
      )}

      <ol className="space-y-2">
        {rows.map((row) => {
          const state = inviteLinkState(row);
          const style = STATE_STYLE[state];
          const url = activationUrl(row.token);
          const replacedBy = row.superseded_by
            ? rows.find((r) => r.id === row.superseded_by)
            : undefined;
          const reason = inviteRetiredReason(row);
          return (
            <li key={row.id}
              className={`border rounded-lg p-3 ${
                state === 'current' ? 'border-green-300 bg-green-50/40' : 'border-green-800/12 bg-white'}`}>
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <span className={`px-2 py-0.5 rounded-full border text-[11px] font-medium ${style.chip}`}>
                  {style.label}
                </span>
                {/* The first characters of the token: what a person reads out
                    first, so a link dictated over the phone is matched fast. */}
                <span className="font-mono text-[11.5px] text-secondary">
                  …token={row.token.slice(0, 8)}…
                </span>
                <span className="text-[11.5px] text-muted">
                  sent {when(row.created_at)}
                </span>
                {row.resend_of && (
                  <span className="text-[11px] text-muted italic">replaced an earlier link</span>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2 mb-2">
                <code className="flex-1 min-w-[16rem] break-all text-[11.5px] text-green-900
                                 bg-white border border-green-800/15 rounded px-2 py-1.5">
                  {url}
                </code>
                <CopyButton value={url}
                  label={state === 'draft' ? 'Copy this account’s activation link'
                    : `Copy the ${style.label.toLowerCase()} activation link`} />
                {state === 'current' && (
                  <button type="button" disabled={busyId === row.id}
                    onClick={() => void resend(row)}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded border border-green-700
                               bg-green-700 text-white text-[11.5px] hover:bg-green-600 focus-ring
                               disabled:opacity-50 whitespace-nowrap">
                    <Send size={13} />
                    {busyId === row.id ? 'Sending…' : 'Email this link again'}
                  </button>
                )}
              </div>

              <p className="text-[11.5px] text-muted">
                {state === 'redeemed'
                  ? <>Redeemed {when(row.redeemed_at)} — this link created their account.</>
                  : state === 'current'
                    ? <>Works until {when(row.expires_at)}.</>
                    : <>
                        {reason ? <>Retired: {reason}. </> : null}
                        {replacedBy
                          ? <>Replaced by the {inviteLinkState(replacedBy)} link
                              (…token={replacedBy.token.slice(0, 8)}…).</>
                          : row.superseded_by
                            ? <>Replaced by a newer invitation.</>
                            : null}
                        {state === 'expired' && !reason ? <>Expired {when(row.expires_at)}.</> : null}
                      </>}
              </p>

              {notice?.id === row.id && (
                <p role="alert"
                  className={`mt-2 text-[11.5px] ${notice.ok ? 'text-green-800' : 'text-red-700'}`}>
                  {notice.text}
                </p>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
