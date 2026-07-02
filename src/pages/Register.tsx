import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { validateInvitation, upsertMyProfile } from '../lib/api';
import { signInWithGoogle } from '../lib/auth';
import { OAUTH_PROVIDERS } from '../lib/authConfig';
import { supabase } from '../lib/supabase';
import { useDocumentTitle } from '../lib/hooks';
import type { Invitation } from '../lib/types';

type State = 'checking' | 'invalid' | 'ready' | 'creating';

export default function Register() {
  useDocumentTitle('Create Your Account');
  const [params] = useSearchParams();
  const token = params.get('token') || '';
  const navigate = useNavigate();
  const { signUp } = useAuth();

  const [state, setState] = useState<State>('checking');
  const [invitation, setInvitation] = useState<Invitation | null>(null);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    if (!token) {
      setState('invalid');
      return;
    }
    validateInvitation(token)
      .then((inv) => {
        if (!active) return;
        if (!inv) {
          setState('invalid');
        } else {
          setInvitation(inv);
          setState('ready');
        }
      })
      .catch(() => active && setState('invalid'));
    return () => {
      active = false;
    };
  }, [token]);

  async function continueWithGoogle() {
    if (!invitation) return;
    setError(null);
    // Stash the invitation so /register/complete can redeem it after the
    // OAuth round-trip (the redirect loses component state).
    window.localStorage.setItem('fhe-invite', JSON.stringify({
      token,
      email: invitation.email,
      request_id: invitation.request_id ?? null,
    }));
    const { error: oauthError } = await signInWithGoogle('/register/complete');
    if (oauthError) {
      window.localStorage.removeItem('fhe-invite');
      setError(oauthError);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!invitation) return;
    setState('creating');
    setError(null);

    // Create the auth user with the invited email.
    const { error: signUpError } = await signUp(invitation.email, password);
    if (signUpError) {
      setError(signUpError);
      setState('ready');
      return;
    }

    // Ensure a session exists, then seed the profile. Depending on the project's
    // email-confirmation setting, signUp may or may not return a session; sign in
    // to be safe (same credentials).
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) {
      await supabase.auth.signInWithPassword({ email: invitation.email, password });
    }

    try {
      await upsertMyProfile({
        first_name: firstName.trim() || null,
        last_name: lastName.trim() || null,
        email: invitation.email,
        created_from_request_id: invitation.request_id,
      });
    } catch {
      // Profile seeding is best-effort; the account exists either way.
    }

    navigate('/account', { replace: true });
  }

  if (state === 'checking') {
    return (
      <div className="min-h-screen bg-cream flex items-center justify-center">
        <p className="body-text text-muted">Checking your invitation…</p>
      </div>
    );
  }

  if (state === 'invalid') {
    return (
      <div className="min-h-screen bg-cream flex items-center justify-center px-6 pt-24 pb-20">
        <div className="max-w-md text-center">
          <p className="eyebrow mb-3">Invitation</p>
          <h1 className="heading-section text-green-800 mb-4">This link isn't valid</h1>
          <p className="body-text mb-8">
            Your invitation may have expired, or the link is incomplete. Reach out and we'll send a
            fresh one — we'd love to have you.
          </p>
          <Link to="/services" className="btn-primary">
            Say Hello
            <ArrowRight size={16} />
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-cream flex items-center justify-center px-6 pt-24 pb-20">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <p className="eyebrow mb-3">Welcome</p>
          <h1 className="heading-section text-green-800">Create your account</h1>
          <p className="body-text text-sm mt-2">
            Setting up for <span className="font-medium text-green-800">{invitation?.email}</span>
          </p>
        </div>

        {OAUTH_PROVIDERS.google && (
          <div className="mb-5">
            <button
              type="button"
              onClick={continueWithGoogle}
              className="btn-outline-gold w-full justify-center"
            >
              Continue with Google
            </button>
            <p className="text-center text-xs font-sans text-muted mt-3">
              or set a password below
            </p>
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate className="bg-white border border-green-800/10 p-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-5">
            <div>
              <label className="form-label" htmlFor="first_name">First Name</label>
              <input
                id="first_name"
                type="text"
                autoComplete="given-name"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className="form-input"
                placeholder="First name"
              />
            </div>
            <div>
              <label className="form-label" htmlFor="last_name">Last Name</label>
              <input
                id="last_name"
                type="text"
                autoComplete="family-name"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className="form-input"
                placeholder="Last name"
              />
            </div>
          </div>
          <div className="mb-6">
            <label className="form-label" htmlFor="password">Choose a Password</label>
            <input
              id="password"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="form-input"
              placeholder="At least 8 characters"
            />
          </div>

          {error && (
            <div role="alert" className="bg-red-50 border border-red-200 text-red-700 text-sm font-sans px-4 py-3 mb-5">
              {error}
            </div>
          )}

          <button type="submit" disabled={state === 'creating'} className="btn-primary w-full justify-center">
            {state === 'creating' ? 'Creating your account…' : 'Create Account'}
            {state !== 'creating' && <ArrowRight size={16} />}
          </button>
        </form>
      </div>
    </div>
  );
}
