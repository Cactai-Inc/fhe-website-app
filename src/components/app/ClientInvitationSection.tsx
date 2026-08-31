import { useCallback, useEffect, useState } from 'react';
import {
  adminSendInvitation, adminResendInvitation, adminExpireInvitation,
  adminDeleteInvitation, adminInvitationHistory, inviteLinkState,
  type InvitationHistoryRow,
} from '../../lib/admin';
import { toErrorMessage } from '../../lib/ops/errors';
import { entityStatusLog, type StatusLogEntry } from '../../lib/ops/api-status';
import { StatusLog } from '../../lib/ops';
import { ProvisionClientForm } from './ProvisionClientForm';
import { InviteResultPanel } from './InviteResultPanel';
import { InvitationHistoryPanel } from './InvitationHistoryPanel';
import { ClientHorseRecordsCard } from './ClientRecordActions';
import { AgreedLessonSection, type AgreedLesson } from './AgreedLessonPanel';

/**
 * PROVISIONING AND THE INVITATION LIFECYCLE — ONE SECTION, ON THE PERSON.
 *
 * ⚠️ TASK-FIX2 §3. This is `Admin.tsx`'s `InvitePanel`, lifted out of the page it
 * was trapped inside and re-keyed on the CONTACT rather than on a row of
 * `admin_client_accounts()`. Nothing here is new behaviour; the fourteen
 * capabilities AR2's F5 enumerated are carried across one for one, because
 * *"retire the layout; keep the fourteen"* — items 9–14 (resend, regenerate,
 * expire, delete, link history, timeline) exist NOWHERE ELSE in the app.
 *
 * WHY IT MOVED. `InvitePanel` was mounted only from `PendingClientView`, itself
 * mounted only under `selected.kind !== 'account'`, and its own body opened with
 * `if ((neverInvited || isDraft) && row.contact_id)`. So the provisioning form
 * closed the moment an invitation went out AND again the moment the person signed
 * in — two gates, both invisible, and between them 9 of 24 people on the Clients
 * list had no provisioning surface at all. Pamela Godde and Charlotte Caddell sat
 * behind both.
 *
 * ⚠️ AND IT READS ITS OWN STATE (AR2 F8). The dossier previously tracked
 * "invited" in a `useState(false)` that was never seeded from the record, so it
 * offered a bare *"Send invitation"* to someone already holding a live link —
 * and `adminSendInvitation` defaults to `mode: 'new'`, which by its own contract
 * leaves the prior link working. That act minted a SECOND live claim link with no
 * warning. This section derives the state from `adminInvitationHistory`, the same
 * read the history list below it uses, and keeps `Admin.tsx`'s two-press
 * resend-vs-regenerate distinction (owner ruling 2026-08-11, D19).
 */
export function ClientInvitationSection({
  contactId, email, firstName, lastName, archived, onChanged,
}: {
  contactId: string;
  email: string | null | undefined;
  firstName?: string | null;
  lastName?: string | null;
  /** An archived contact is read-only: every write below refuses at the DB. */
  archived?: boolean;
  /** Fired after any act that changes the record, so the host can reload. */
  onChanged?: () => void;
}) {
  const [history, setHistory] = useState<InvitationHistoryRow[] | null>(null);
  const [result, setResult] = useState<{ url: string; emailed: boolean; emailError?: string } | null>(null);
  const [agreedLesson, setAgreedLesson] = useState<AgreedLesson | null>(null);
  const [resendNote, setResendNote] = useState<string | null>(null);
  const [confirmRegen, setConfirmRegen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [log, setLog] = useState<StatusLogEntry[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const loadHistory = useCallback(() => {
    adminInvitationHistory({ contactId, email })
      .then(setHistory)
      .catch(() => setHistory([]));
  }, [contactId, email]);
  useEffect(loadHistory, [loadHistory, refreshKey]);

  /* THE CURRENT INVITATION, derived rather than remembered. `adminInvitationHistory`
     returns newest first and matches on the contact link AND the address, because
     the plain/staff path writes an invitation with no contact_id. */
  const rows = history ?? [];
  const current = rows.find((r) => inviteLinkState(r) === 'current') ?? null;
  const draft = rows.find((r) => inviteLinkState(r) === 'draft') ?? null;
  const redeemed = rows.some((r) => inviteLinkState(r) === 'redeemed');
  const latest = rows[0] ?? null;
  const inviteId = current?.id ?? draft?.id ?? latest?.id ?? null;
  const live = !!current;
  const sent = !!current || rows.some((r) => ['current', 'expired', 'retired', 'redeemed'].includes(inviteLinkState(r)));
  const expired = !current && rows.some((r) => inviteLinkState(r) === 'expired');
  /* The provisioning form is the right surface when nothing has ever been
     delivered — never invited, or holding an unsent draft (PAMELA §A). */
  const neverInvited = rows.length === 0;
  const isDraft = !!draft && !current;

  useEffect(() => {
    if (!inviteId) { setLog([]); return; }
    entityStatusLog('account', inviteId).then(setLog).catch(() => setLog([]));
  }, [inviteId]);

  if (history === null) {
    return <p className="text-sm text-muted">Reading their invitation…</p>;
  }

  if (archived) {
    return (
      <p className="text-[11.5px] text-muted">
        Restore this account from Records › Archived before provisioning or inviting it.
      </p>
    );
  }

  // ── nothing delivered yet: provision them ─────────────────────────────────
  if (neverInvited || isDraft) {
    return (
      <section className="bg-white border border-gold-600/40 rounded-xl p-4">
        <h3 className="font-serif text-green-800 text-base mb-1">
          {isDraft ? 'Account & invitation' : 'Create the account'}
        </h3>
        <p className="text-[12px] text-muted mb-4">
          {isDraft
            ? 'Their account exists and nothing has been emailed. Change any of it, or send the invitation now.'
            : 'Assign their category, paperwork, and any offerings. Saving creates the account; sending the invitation is a separate step you can take whenever you like.'}
        </p>
        {!email && (
          <p className="text-[12px] text-gold-800 mb-3">
            There is no email address on this record yet. Add one above and the invitation
            can go out from here.
          </p>
        )}
        <ProvisionClientForm source="contact" contactId={contactId}
          email={email ?? undefined}
          firstName={firstName ?? undefined}
          lastName={lastName ?? undefined}
          agreedLesson={agreedLesson}
          onProvisioned={() => { setRefreshKey((k) => k + 1); onChanged?.(); }}
          /* CLOSEOUT §3.5 / PAMELA §A: a lesson agreed on the phone folds into the
             same act, shown only for a rider or a scheduling-shaped order. This is
             NOT the standing weekly slot — that is StaffStandingSlotSection, and
             routing a weekly plan through here would book one lesson and leave the
             membership with no slot at all (AR2 F4a). */
          scheduling={<AgreedLessonSection onAgreedChange={setAgreedLesson} />} />

        {/* PRIORITY-1, owner 2026-08-25: a saved-but-not-sent account is a real
            account and can own a horse. The card is the same one the record's
            Documents section uses. */}
        <div className="mt-4">
          <ClientHorseRecordsCard contactId={contactId} />
        </div>

        {rows.length > 0 && (
          <div className="mt-4 pt-3 border-t border-gold-600/20">
            <InvitationHistoryPanel contactId={contactId} email={email}
              refreshKey={refreshKey} onResent={() => { setRefreshKey((k) => k + 1); onChanged?.(); }} />
          </div>
        )}
      </section>
    );
  }

  // ── a link exists: its lifecycle ──────────────────────────────────────────
  return (
    <section className="bg-white border border-gold-600/40 rounded-xl p-4">
      <h3 className="font-serif text-green-800 text-base">Invitation</h3>
      <p className="text-[12px] text-muted mb-3">
        {redeemed && !current
          ? 'They have redeemed their invitation and signed in. Issue a new link only if they need to claim the account again.'
          : current
            ? `Their link works until ${new Date(current.expires_at).toLocaleString()}.`
            : expired
              ? 'Their link has EXPIRED. Issue a new one, or resend from the history below.'
              : 'Send the registration invite.'}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        {/* RESEND and REGENERATE are different acts and staff choose between them —
            sending again must never be what kills a working link (owner ruling
            2026-08-11). Resend is the safe default and leads. */}
        {live && inviteId && (
          <button type="button" disabled={busy}
            onClick={() => void (async () => {
              setBusy(true); setErr(null); setResult(null);
              try {
                const r = await adminResendInvitation(inviteId);
                setResendNote(r.emailed
                  ? `Same link emailed again to ${r.email}. It keeps working.`
                  : `NOT emailed — ${r.emailError || 'no reason reported'}. Copy the link below and send it yourself.`);
                setRefreshKey((k) => k + 1);
              } catch (e) { setErr(toErrorMessage(e, 'Could not resend the invitation.')); }
              finally { setBusy(false); }
            })()}
            className="btn-primary text-xs">
            {busy ? 'Sending…' : 'Resend the same link'}
          </button>
        )}
        <button type="button" disabled={busy || !email}
          onClick={() => void (async () => {
            // Regenerating retires a link that may be working right now, and may
            // already be in someone's inbox. Make staff say so twice.
            if (live && !confirmRegen) { setConfirmRegen(true); return; }
            setBusy(true); setErr(null); setResult(null); setConfirmRegen(false);
            try {
              const r = await adminSendInvitation({
                email: email!, mode: live ? 'regenerate' : 'new',
              });
              setResult({ url: r.registerUrl ?? '', emailed: r.emailed, emailError: r.emailError });
              setRefreshKey((k) => k + 1);
              onChanged?.();
            } catch (e) { setErr(toErrorMessage(e, 'Could not send the invitation.')); }
            finally { setBusy(false); }
          })()}
          className={live ? 'px-3.5 py-2 rounded-lg border border-gold-600/50 text-gold-800 text-xs hover:bg-gold-50 focus-ring'
            : 'btn-primary text-xs'}>
          {busy ? 'Sending…'
            : !sent ? 'Send invitation'
            : confirmRegen ? 'Confirm — retire the current link'
            : live ? 'Regenerate link' : 'Issue a new link'}
        </button>
        {confirmRegen && (
          <button type="button" onClick={() => setConfirmRegen(false)}
            className="px-3 py-2 text-xs text-secondary hover:text-green-900 focus-ring">
            Cancel
          </button>
        )}
        {inviteId && live && (
          <button type="button" disabled={busy}
            onClick={() => void (async () => {
              setBusy(true); setErr(null);
              try { await adminExpireInvitation(inviteId); setRefreshKey((k) => k + 1); onChanged?.(); }
              catch { setErr('Could not expire the invitation.'); }
              finally { setBusy(false); }
            })()}
            className="px-3.5 py-2 rounded-lg border border-gold-600/50 text-gold-800 text-xs hover:bg-gold-50 focus-ring">
            Expire now
          </button>
        )}
        {inviteId && (
          <button type="button" disabled={busy}
            onClick={() => void (async () => {
              setBusy(true); setErr(null);
              try { await adminDeleteInvitation(inviteId); setRefreshKey((k) => k + 1); onChanged?.(); }
              catch { setErr('Could not delete the invitation.'); }
              finally { setBusy(false); }
            })()}
            className="px-3.5 py-2 rounded-lg border border-red-300 text-red-700 text-xs hover:bg-red-50 focus-ring">
            Delete invite
          </button>
        )}
      </div>
      {!email && (
        <p className="text-[12px] text-gold-800 mt-3">
          Add an email address on the Record tab before sending anything.
        </p>
      )}
      {err && <p role="alert" className="form-error mt-3">{err}</p>}
      {resendNote && <p role="status" className="text-[12px] text-green-800 mt-3">{resendNote}</p>}
      {result && (
        <InviteResultPanel url={result.url} emailed={result.emailed}
          emailError={result.emailError} email={email ?? undefined} />
      )}
      {/* Every link ever issued to this person, with the real URL on each row —
          the support view for "a client just read me a link over the phone".
          Staff-gated: invitations RLS is is_admin() AND the org boundary. */}
      <div className="mt-4 pt-3 border-t border-gold-600/20">
        <InvitationHistoryPanel contactId={contactId} email={email}
          refreshKey={refreshKey} onResent={() => { setRefreshKey((k) => k + 1); onChanged?.(); }} />
      </div>
      {log.length > 0 && (
        <div className="mt-4 pt-3 border-t border-gold-600/20">
          <p className="text-[11px] uppercase tracking-wide text-green-800/50 mb-2">Invitation timeline</p>
          <StatusLog entries={log} compact />
        </div>
      )}
    </section>
  );
}
