import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { validateInvitation, upsertMyProfile, redeemInvitation, myOnboardingState } from '../lib/api';
import { redeemContractInvitation } from '../lib/contracts';
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
  // Contract-counterparty invites (Update A, spec G): redemption links the party
  // contact instead of granting community membership, and lands on the contract.
  const isContractInvite = params.get('kind') === 'contract';
  const navigate = useNavigate();

  /** Redeem per invite kind; returns the post-redemption destination. */
  async function redeemByKind(): Promise<string> {
    if (isContractInvite) {
      const documentId = await redeemContractInvitation(token);
      return `/app/contracts/${documentId}`;
    }
    await redeemInvitation(token);
    // paperwork assigned → straight into the document flow
    try {
      const state = await myOnboardingState();
      if (state?.needed) return '/app/onboarding';
    } catch { /* fall through to the dashboard */ }
    return '/app';
  }

  const [state, setState] = useState<State>('checking');
  const [invitation, setInvitation] = useState<Invitation | null>(null);
  // Gmail invites lead with Google only — the password form stays one click
  // away for the rare Gmail user who wants a password anyway.
  const isGmail = /@(gmail|googlemail)\.com$/i.test(invitation?.email ?? '');
  const [showPasswordForm, setShowPasswordForm] = useState(false);
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
      .then(async (inv) => {
        if (!active) return;
        if (!inv) {
          setState('invalid');
          return;
        }
        // Already signed in as the invited person (e.g. registered earlier but
        // membership was never granted)? Redeem straight into the app.
        const { data: sessionData } = await supabase.auth.getSession();
        const sessionEmail = sessionData.session?.user?.email?.toLowerCase();
        if (sessionEmail && sessionEmail === inv.email.trim().toLowerCase()) {
          try {
            const dest = await redeemByKind();
            navigate(dest, { replace: true });
            return;
          } catch {
            /* fall through to the normal form */
          }
        }
        if (!active) return;
        setInvitation(inv);
        setState('ready');
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
      kind: isContractInvite ? 'contract' : 'community',
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

    // Create the auth user SERVER-SIDE, pre-confirmed: the personal invite link
    // already proved the inbox, and the project's email-confirmation setting
    // otherwise blocks the immediate sign-in ("Email not confirmed"), which
    // orphaned password signups entirely (owner-reported).
    const resp = await fetch('/api/register-invited', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token,
        password,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
      }),
    });
    if (!resp.ok) {
      const payload = await resp.json().catch(() => ({ error: '' }));
      setError(payload.error || 'Could not create your account. Please try again.');
      setState('ready');
      return;
    }

    // Confirmed at creation → this sign-in succeeds and establishes the session.
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: invitation.email, password,
    });
    if (signInError) {
      setError(signInError.message);
      setState('ready');
      return;
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

    try {
      const dest = await redeemByKind(); // membership grant, or contract-party link
      navigate(dest, { replace: true });
      return;
    } catch {
      // token consumed by a parallel attempt or expired mid-flow; the account
      // exists, and for provisioned clients membership self-heals at sign-in
      // (ensure_my_membership) — land in the app, not the legacy /account page.
      navigate('/app', { replace: true });
      return;
    }
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
          <h1 className="heading-section text-green-800 mb-4">This link isn't valid anymore</h1>
          <p className="body-text mb-8">
            This invitation may have expired or been replaced by a newer one — check your inbox for
            the most recent email. If you've already created your account, just sign in.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link to="/login" className="btn-primary">
              Sign In
              <ArrowRight size={16} />
            </Link>
            <Link to="/contact" className="btn-outline-gold">
              Ask for a fresh invite
            </Link>
          </div>
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
              className={`w-full justify-center ${isGmail ? 'btn-primary' : 'btn-outline-gold'}`}
            >
              Continue with Google
            </button>
            {isGmail && !showPasswordForm ? (
              <p className="text-center text-xs font-sans text-muted mt-3">
                This is a Gmail address — one click and you're in.{' '}
                <button type="button" className="underline hover:text-green-800"
                  onClick={() => setShowPasswordForm(true)}>
                  Prefer a password instead?
                </button>
              </p>
            ) : (
              <p className="text-center text-xs font-sans text-muted mt-3">
                or set a password below
              </p>
            )}
          </div>
        )}

        {(!OAUTH_PROVIDERS.google || !isGmail || showPasswordForm) && (
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
        )}
      </div>
    </div>
  );
}
