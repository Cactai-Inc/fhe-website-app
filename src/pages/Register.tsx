import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { validateInvitation, redeemInvitation, myOnboardingState } from '../lib/api';
import { redeemContractInvitation } from '../lib/contracts';
import { signInWithGoogle } from '../lib/auth';
import { OAUTH_PROVIDERS } from '../lib/authConfig';
import { supabase } from '../lib/supabase';
import { useDocumentTitle } from '../lib/hooks';
import { useAuth } from '../contexts/AuthContext';
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
  const { refreshProfile } = useAuth();

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
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [error, setError] = useState<string | null>(null);

  const pwLongEnough = password.length >= 8;
  const pwMatch = password.length > 0 && password === password2;
  const pwReady = pwLongEnough && pwMatch;

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
    const { error: oauthError } = await signInWithGoogle('/activate/complete');
    if (oauthError) {
      window.localStorage.removeItem('fhe-invite');
      setError(oauthError);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!invitation || !pwReady) return;
    setState('creating');
    setError(null);

    // Set the account's password server-side (creates the account if new, or
    // claims an existing one via the invite), pre-confirmed — the personal invite
    // link already proves the inbox. The name rides on the invitation and is
    // stamped onto the profile at redemption; no name entry needed here.
    const resp = await fetch('/api/register-invited', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, password }),
    });
    if (!resp.ok) {
      const payload = await resp.json().catch(() => ({ error: '' }));
      setError(payload.error || 'Could not activate your account. Please try again.');
      setState('ready');
      return;
    }

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: invitation.email, password,
    });
    if (signInError) {
      setError(signInError.message);
      setState('ready');
      return;
    }

    // NOTE: no profile upsert here. redeem_invitation creates the profile with
    // its org_id; a bare insert with a null org_id trips the contact-link trigger
    // (contacts.org_id NOT NULL) and aborts, leaving the account half-built.
    try {
      const dest = await redeemByKind();
      await refreshProfile().catch(() => {});
      navigate(dest === '/app' ? '/app?welcome=1' : dest, { replace: true });
      return;
    } catch (err) {
      // Don't mask a real failure as success. Surface it so nobody is misled
      // into thinking the account is ready when it isn't.
      setError(err instanceof Error ? err.message : 'We could not finish activating your account.');
      setState('ready');
      return;
    }
  }

  if (state === 'checking') {
    return (
      <div className="min-h-[calc(100dvh-3.5rem)] flex items-center justify-center">
        <p className="body-text text-muted">Checking your invitation…</p>
      </div>
    );
  }

  if (state === 'invalid') {
    return (
      <div className="min-h-[calc(100dvh-3.5rem)] flex items-center justify-center px-6 pt-12 pb-20">
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
    <div className="min-h-[calc(100dvh-3.5rem)] flex items-center justify-center px-6 pt-12 pb-20">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <p className="eyebrow mb-3">Welcome</p>
          <h1 className="heading-section text-green-800">Sign in to activate your account</h1>
          <p className="body-text text-sm mt-2">
            for <span className="font-medium text-green-800">{invitation?.email}</span>
          </p>
        </div>

        {OAUTH_PROVIDERS.google && (
          <div className="mb-5">
            <button type="button" onClick={continueWithGoogle} className="btn-outline-gold w-full justify-center">
              Continue with Google
            </button>
            <div className="flex items-center gap-3 my-5 text-muted">
              <span className="h-px flex-1 bg-green-800/10" />
              <span className="text-xs font-sans uppercase tracking-wide">or set a password</span>
              <span className="h-px flex-1 bg-green-800/10" />
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate className="bg-white border border-green-800/10 p-8">
          <div className="mb-4">
            <label className="form-label" htmlFor="password">Create a password</label>
            <input
              id="password" type="text" autoComplete="off" required minLength={8}
              value={password} onChange={(e) => setPassword(e.target.value)}
              className="form-input font-mono" placeholder="At least 8 characters"
            />
          </div>
          <div className="mb-3">
            <label className="form-label" htmlFor="password2">Re-enter your password</label>
            <input
              id="password2" type="text" autoComplete="off" required
              value={password2} onChange={(e) => setPassword2(e.target.value)}
              className="form-input font-mono" placeholder="Type it again"
            />
          </div>

          {/* live match feedback so they can see they typed it correctly */}
          {(password || password2) && (
            <p className={`text-xs font-sans mb-5 ${pwReady ? 'text-green-700' : 'text-secondary'}`}>
              {!pwLongEnough ? 'Password must be at least 8 characters.'
                : !pwMatch ? 'The two passwords don’t match yet.'
                  : '✓ Passwords match.'}
            </p>
          )}

          {error && (
            <div role="alert" className="bg-red-50 border border-red-200 text-red-700 text-sm font-sans px-4 py-3 mb-5">
              {error}
            </div>
          )}

          <button type="submit" disabled={state === 'creating' || !pwReady}
            className="btn-primary w-full justify-center disabled:opacity-50">
            {state === 'creating' ? 'Signing you in…' : 'Continue'}
            {state !== 'creating' && <ArrowRight size={16} />}
          </button>
        </form>
      </div>
    </div>
  );
}
