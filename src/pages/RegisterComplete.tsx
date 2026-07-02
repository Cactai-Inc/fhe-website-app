import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { validateInvitation, upsertMyProfile } from '../lib/api';
import { useDocumentTitle } from '../lib/hooks';

type State = 'working' | 'done' | 'mismatch' | 'invalid';

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
  const [state, setState] = useState<State>('working');
  const [invitedEmail, setInvitedEmail] = useState('');
  const [actualEmail, setActualEmail] = useState('');

  useEffect(() => {
    let active = true;
    (async () => {
      const raw = window.localStorage.getItem('fhe-invite');
      if (!raw) {
        if (active) setState('invalid');
        return;
      }
      let stash: { token: string; email: string; request_id: string | null };
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

      try {
        await upsertMyProfile({
          email: invitation.email,
          created_from_request_id: invitation.request_id,
        });
      } catch {
        // best-effort, same as the password path
      }
      window.localStorage.removeItem('fhe-invite');
      if (active) {
        setState('done');
        navigate('/account', { replace: true });
      }
    })();
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (state === 'working' || state === 'done') {
    return (
      <div className="min-h-screen bg-cream flex items-center justify-center">
        <p className="body-text text-muted">Finishing your sign-up…</p>
      </div>
    );
  }

  if (state === 'mismatch') {
    return (
      <div className="min-h-screen bg-cream flex items-center justify-center px-6 pt-24 pb-20">
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
    <div className="min-h-screen bg-cream flex items-center justify-center px-6 pt-24 pb-20">
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
