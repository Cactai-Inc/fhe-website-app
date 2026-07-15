import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { validateInvitation, redeemInvitation, myOnboardingState } from '../lib/api';
import { redeemContractInvitation } from '../lib/contracts';
import { useDocumentTitle } from '../lib/hooks';
import { useAuth } from '../contexts/AuthContext';

type State = 'working' | 'done' | 'mismatch' | 'invalid' | 'failed';

/**
 * OAuth leg of invite-only registration. /register stashes the invitation in
 * localStorage ('fhe-invite') before the Google redirect; this page redeems it
 * when the provider sends the newly signed-in user back:
 *  - re-validates the invitation token,
 *  - requires the Google account's email to MATCH the invited email (invite-only
 *    means the invitation, not the Google account, is the credential),
 *  - seeds the profile with the invitation's request linkage, then → /account.
 * A mismatch signs the user back out so the wrong Google account can't squat
 * on the session.
 */
export default function RegisterComplete() {
  useDocumentTitle('Finishing Sign-Up');
  const navigate = useNavigate();
  const { refreshProfile } = useAuth();
  const [state, setState] = useState<State>('working');
  const [invitedEmail, setInvitedEmail] = useState('');
  const [actualEmail, setActualEmail] = useState('');
  const [redeemError, setRedeemError] = useState('');

  useEffect(() => {
    let active = true;
    (async () => {
      const raw = window.localStorage.getItem('fhe-invite');
      if (!raw) {
        if (active) setState('invalid');
        return;
      }
      let stash: { token: string; email: string; request_id: string | null; kind?: string };
      try {
        stash = JSON.parse(raw);
      } catch {
        window.localStorage.removeItem('fhe-invite');
        if (active) setState('invalid');
        return;
      }

      const { data: sessionData } = await supabase.auth.getSession();
      const user = sessionData.session?.user;
      if (!user) {
        if (active) setState('invalid');
        return;
      }

      const invitation = await validateInvitation(stash.token).catch(() => null);
      if (!invitation) {
        window.localStorage.removeItem('fhe-invite');
        if (active) setState('invalid');
        return;
      }

      const invited = invitation.email.trim().toLowerCase();
      const actual = (user.email ?? '').trim().toLowerCase();
      if (invited !== actual) {
        if (active) {
          setInvitedEmail(invitation.email);
          setActualEmail(user.email ?? '');
          setState('mismatch');
        }
        await supabase.auth.signOut();
        return;
      }

      // NOTE: do NOT upsert the profile here. redeem_invitation creates the
      // profile row WITH its org_id (which contacts.org_id defaults to via
      // current_org()). A bare profiles insert with a null org_id makes the
      // profiles_link_contact trigger insert a contact with a null org_id →
      // NOT NULL violation → the insert aborts, the redeem never seeds the
      // profile, and the invitee lands on the "finishing setup" dead-end.
      let dest = '/app?welcome=1';
      try {
        if (stash.kind === 'contract') {
          // contract-counterparty invite: link the party contact, no membership,
          // and land ON the contract (Update A, spec G)
          const documentId = await redeemContractInvitation(stash.token);
          dest = `/app/contracts/${documentId}`;
        } else {
          await redeemInvitation(stash.token);
          // paperwork assigned → straight into the document flow
          try {
            const state = await myOnboardingState();
            if (state?.needed) dest = '/app/onboarding';
          } catch { /* dashboard fallback */ }
        }
      } catch (err) {
        // Redemption genuinely failed — do NOT pretend it worked. Surface the
        // real reason so the invitee (and you) aren't misled into thinking the
        // account is set up when it isn't.
        window.localStorage.removeItem('fhe-invite');
        if (active) {
          setRedeemError(err instanceof Error ? err.message : 'We could not finish setting up your account.');
          setState('failed');
        }
        return;
      }
      window.localStorage.removeItem('fhe-invite');
      // Pull the freshly-stamped role/membership into context BEFORE navigating,
      // or /app renders from the pre-redeem snapshot (role=USER) and the member
      // gate loops a staff invitee into a blank /app/account.
      await refreshProfile().catch(() => {});
      if (active) {
        setState('done');
        navigate(dest, { replace: true });
      }
    })();
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (state === 'working' || state === 'done') {
    return (
      <div className="min-h-[calc(100dvh-3.5rem)] flex items-center justify-center">
        <p className="body-text text-muted">Finishing your sign-up…</p>
      </div>
    );
  }

  if (state === 'failed') {
    return (
      <div className="min-h-[calc(100dvh-3.5rem)] flex items-center justify-center px-6 pt-12 pb-20">
        <div className="max-w-md text-center">
          <p className="eyebrow mb-3">Invitation</p>
          <h1 className="heading-section text-green-800 mb-4">We couldn't finish setting up your account</h1>
          <p className="body-text mb-4">
            You're signed in, but the last step didn't complete, so your account isn't active yet.
            Please try again — if it keeps failing, send this detail to whoever invited you:
          </p>
          <p className="body-text text-sm font-mono bg-cream-100 border border-green-800/10 rounded px-3 py-2 mb-8 break-words">
            {redeemError}
          </p>
          <div className="flex items-center justify-center gap-3">
            <button type="button" onClick={() => window.location.reload()} className="btn-primary">
              Try again
            </button>
            <Link to="/" className="btn-secondary">Return home</Link>
          </div>
        </div>
      </div>
    );
  }

  if (state === 'mismatch') {
    return (
      <div className="min-h-[calc(100dvh-3.5rem)] flex items-center justify-center px-6 pt-12 pb-20">
        <div className="max-w-md text-center">
          <p className="eyebrow mb-3">Invitation</p>
          <h1 className="heading-section text-green-800 mb-4">That's a different Google account</h1>
          <p className="body-text mb-8">
            Your invitation was sent to <span className="font-medium">{invitedEmail}</span>, but you
            signed in with <span className="font-medium">{actualEmail}</span>. Please try again with
            the invited account, or ask us to re-send the invitation to this address.
          </p>
          <Link to="/" className="btn-primary">
            Return Home
            <ArrowRight size={16} />
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100dvh-3.5rem)] flex items-center justify-center px-6 pt-12 pb-20">
      <div className="max-w-md text-center">
        <p className="eyebrow mb-3">Invitation</p>
        <h1 className="heading-section text-green-800 mb-4">We couldn't finish sign-up</h1>
        <p className="body-text mb-8">
          The invitation may have expired mid-flight, or the sign-in didn't complete. Open your
          invitation link again and we'll pick up where you left off.
        </p>
        <Link to="/" className="btn-primary">
          Return Home
          <ArrowRight size={16} />
        </Link>
      </div>
    </div>
  );
}
