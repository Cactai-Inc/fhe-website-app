import { useEffect, useState } from 'react';
import { ShieldCheck, ChevronRight, KeyRound, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import { listLinkedIdentities, linkOAuthIdentity, updatePassword } from '../../../lib/auth';
import type { LinkedIdentity } from '../../../lib/auth';
import {
  markGoogleLinkPending, clearGoogleLinkPending, consumeGoogleLinkReturn, describeLinkFailure,
} from '../../../lib/googleLink';
import { startGoogleChange, startPasswordChange } from '../../../lib/emailChange';
import { EmailChangeModal } from '../EmailChangeModal';
import { SectionCard } from './SectionCard';
import { Modal } from '../../ops/kit/Modal';
import { TwoFactorSettings } from '../../auth/TwoFactorSettings';

/** Standalone change-password (auth-level update on the live session — distinct
 *  from the email-change flow's own password seam). Modal, explicit close (X),
 *  matching the interaction law: no inner pages.
 *
 *  ⚠️ TASK-FIX4 — converged, and this is the ONE dialog with no draft and no
 *  Clear form. A password must never be written to browser storage, so there is
 *  nothing to persist and nothing to clear; the backdrop guard still applies,
 *  because losing a half-typed password to a stray click is the same annoyance
 *  as losing anything else. */
function ChangePasswordModal({ onClose }: { onClose: () => void }) {
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    if (pw.length < 8) { setErr('Use at least 8 characters.'); return; }
    if (pw !== pw2) { setErr('The passwords do not match.'); return; }
    setBusy(true);
    const { error } = await updatePassword(pw);
    setBusy(false);
    if (error) { setErr(error); return; }
    setDone(true);
  }

  return (
    <Modal open onClose={onClose} title="Change password" size="sm">
        {done ? (
          <div>
            <p className="body-text text-sm text-green-800 mt-2">Your password is updated.</p>
            <div className="mt-4 flex justify-end">
              <button type="button" className="btn-primary" onClick={onClose}>Done</button>
            </div>
          </div>
        ) : (
          <form onSubmit={submit} className="flex flex-col gap-3 mt-3">
            <label className="text-xs text-muted" htmlFor="np">New password</label>
            <input id="np" type="password" autoComplete="new-password" className="border border-green-800/20 rounded-lg px-3 py-2 text-sm focus-ring"
              value={pw} onChange={(e) => setPw(e.target.value)} />
            <label className="text-xs text-muted" htmlFor="np2">Repeat new password</label>
            <input id="np2" type="password" autoComplete="new-password" className="border border-green-800/20 rounded-lg px-3 py-2 text-sm focus-ring"
              value={pw2} onChange={(e) => setPw2(e.target.value)} />
            <p className="text-[11px] text-muted -mt-1">Password reset always sends a magic link to your login email.</p>
            {err && <p role="alert" className="text-sm text-red-700">{err}</p>}
            <div className="mt-1 flex justify-end gap-2">
              <button type="submit" className="btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Save password'}</button>
            </div>
          </form>
        )}
    </Modal>
  );
}

function Row({
  title, sub, onClick,
}: { title: string; sub?: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full flex items-center justify-between gap-3 bg-cream-100/60 border border-green-800/10 rounded-xl px-3.5 py-3 text-left hover:border-green-800/25 focus-ring"
    >
      <span className="min-w-0">
        <span className="block text-[13px] font-medium text-green-900">{title}</span>
        {sub && <span className="block text-[11.5px] text-muted mt-0.5">{sub}</span>}
      </span>
      <ChevronRight size={16} className="text-muted shrink-0" />
    </button>
  );
}

/**
 * TASK-GOOGLEAUTH — one self-serve control that gives a member a second way in.
 *
 * `linkIdentity()` attaches a Google identity to the account already signed in.
 * Same `user_id`, same contact, same documents; the email and password keep
 * working. No staff step, no email sent, no account created — and never an
 * account duplicated to solve an auth problem.
 *
 * States are explicit and never optimistic (the `EmailMeACopyButton` discipline).
 * "Linked" is only ever set from `listLinkedIdentities()` — the server's answer —
 * and never from the fact that a redirect happened. `starting` covers the
 * pre-redirect authorize call, which is where a configuration refusal surfaces;
 * `leaving` is terminal on purpose, because the browser is on its way to Google
 * and the control must stay busy until the page is gone.
 */
type LinkState = 'idle' | 'starting' | 'leaving' | 'failed' | 'unfinished';

function GoogleSignInRow({ userId, accountEmail }: { userId: string | undefined; accountEmail: string | null }) {
  const [identities, setIdentities] = useState<LinkedIdentity[] | null>(null);
  const [state, setState] = useState<LinkState>('idle');
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    // Idempotent for the page load, so React's development double-invoke and the
    // Account hub's own read cannot consume the outcome out from under this.
    const ret = consumeGoogleLinkReturn();
    let alive = true;
    (async () => {
      const list = await listLinkedIdentities().catch(() => [] as LinkedIdentity[]);
      if (!alive) return;
      setIdentities(list);
      if (!ret.returned) return;
      if (list.some((i) => i.provider === 'google')) return; // the server says it landed
      if (ret.errorCode || ret.errorDescription) {
        setState('failed');
        setMessage(describeLinkFailure(ret.errorCode, ret.errorDescription));
      } else {
        // Consent abandoned: back exactly as they were, so say so and stop.
        setState('unfinished');
        setMessage('That did not finish, so nothing changed. Your email and password still work.');
      }
    })();
    return () => { alive = false; };
  }, [userId]);

  // Who sees the control: anyone whose linked providers do not already include
  // google, read from the server's identity list. NEVER inferred from the email
  // domain — that is what this replaced, and it hid the control from every
  // password member on a non-Gmail address. Linking does not require the Google
  // address to match the account email, so there is no domain to test and no
  // second path to offer.
  const google = identities?.find((i) => i.provider === 'google') ?? null;
  const connected = Boolean(google);

  async function activate() {
    setState('starting');
    setMessage(null);
    markGoogleLinkPending();
    const { error, code } = await linkOAuthIdentity('google', '/app/account');
    if (error) {
      // The browser never left — the authorize call itself was refused.
      clearGoogleLinkPending();
      setState('failed');
      setMessage(describeLinkFailure(code, error));
      return;
    }
    // The redirect is already in flight; hold the busy state until the page goes.
    setState('leaving');
  }

  const busy = state === 'starting' || state === 'leaving';

  return (
    <div className="bg-cream-100/60 border border-green-800/10 rounded-xl px-3.5 py-3">
      <div className="flex items-center justify-between gap-3">
        <span className="min-w-0">
          <span className="block text-[13px] font-medium text-green-900">Sign in with Google</span>
          <span className="block text-[11.5px] text-muted mt-0.5">
            {identities === null ? 'Checking…'
              : connected
                ? (google?.email
                  ? `Connected as ${google.email}`
                  : 'Connected')
                : 'Add the Google button as a second way in. Your email and password keep working.'}
          </span>
        </span>
        {identities !== null && (connected ? (
          <span className="inline-flex items-center gap-1.5 text-[12px] font-medium text-green-700 shrink-0">
            <CheckCircle2 size={14} aria-hidden="true" /> Active
          </span>
        ) : (
          <button
            type="button"
            onClick={() => { void activate(); }}
            disabled={busy}
            data-testid="activate-google-signin"
            className="text-[12px] font-medium text-green-800 border border-green-800/25 rounded-lg px-3 py-1.5 hover:border-green-800/40 focus-ring shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {busy ? 'Taking you to Google…' : 'Activate Sign in with Google'}
          </button>
        ))}
      </div>
      {/* The two addresses are allowed to differ, so a member who used a second
          Google account is told plainly which one they connected and that their
          sign-in email did not move. */}
      {connected && google?.email && accountEmail
        && google.email.trim().toLowerCase() !== accountEmail.trim().toLowerCase() && (
        <p className="text-[11.5px] text-muted mt-2">
          You sign in here as <span className="text-green-900">{accountEmail}</span>, and that has not changed —
          the Google account above is an additional way in.
        </p>
      )}
      {message && (
        <p
          role={state === 'failed' ? 'alert' : 'status'}
          className={`text-[11.5px] mt-2 flex items-start gap-1.5 ${state === 'failed' ? 'text-red-700' : 'text-muted'}`}
        >
          <KeyRound size={13} className="shrink-0 mt-px" aria-hidden="true" /> <span>{message}</span>
        </p>
      )}
    </div>
  );
}

/** SECTION 4 — LOGIN & SECURITY. Owner spec 2026-08-05 (TASK-PROFILE): no inner
 *  pages — email change and password change are modals (already were), Google
 *  is a direct connect action. This dissolves the last surviving inner page
 *  (/app/profile's duplicate "Sign-in methods" card) into this one section. */
export function LoginSecurityCard() {
  const { user } = useAuth();
  const [emailOpen, setEmailOpen] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);

  return (
    <SectionCard icon={ShieldCheck} title="Login & security">
      <div className="flex flex-col gap-2.5">
        <Row title="Login" sub={user?.email ?? undefined} onClick={() => setEmailOpen(true)} />
        <Row title="Password" sub="Set or change your password" onClick={() => setPasswordOpen(true)} />
        <GoogleSignInRow userId={user?.id} accountEmail={user?.email ?? null} />
        {/* TASK-PAGEMERGE (DUPECENSUS 1.4/3.1): the only mount of this component
            was the retired /account page — every real member was redirected away
            from it before it rendered, so two-step verification was reachable by
            nobody. This is the port; /account itself retires below it. */}
        <TwoFactorSettings />
      </div>

      {passwordOpen && <ChangePasswordModal onClose={() => setPasswordOpen(false)} />}
      {emailOpen && (
        <EmailChangeModal
          currentEmail={user?.email ?? ''}
          onClose={() => setEmailOpen(false)}
          seams={{ startGoogleChange, startPasswordChange }}
        />
      )}
    </SectionCard>
  );
}
