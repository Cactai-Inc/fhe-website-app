import { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useDocumentTitle } from '../lib/hooks';
import { needsMfaChallenge, submitMfaChallenge, classifyLoginEmail, sendPasswordReset } from '../lib/auth';
import { AuthLayout, AuthCard } from '../components/auth/AuthLayout';
import { AuthField, AuthError, SubmitButton } from '../components/auth/AuthControls';
import { GoogleButton } from '../components/auth/GoogleButton';

/* ⚠️ FIX ROUND 2d — WHAT A FAILED PASSWORD LOGIN OFFERS NEXT.
   Reset is not an openly-browsed link; it appears only here, in response to a
   wrong password on an email that actually matches an account. The two cases:
     - 'reset'    → the email matches an account, the password was wrong → offer
                    to email a reset link.
     - 'recover'  → the email matches no account (they are unsure which email they
                    used) → send them to us to recover the account; never an
                    automated reset, and we do not say "no account" as a bare fact.
   A Google account never reaches here — it signs in through Google. */
type LoginHelp = null | 'reset' | 'recover';

export default function Login() {
  useDocumentTitle('Sign In');
  const { signInWithPassword, signInWithGoogle } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string })?.from || '/account';

  const [step, setStep] = useState<'credentials' | 'mfa'>('credentials');
  // Google-first: show the large Google button by default; the email/password
  // form is revealed only when the user opts into it.
  const [passwordMode, setPasswordMode] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [factorId, setFactorId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  /* ⚠️ FIX ROUND 2d — what a failed sign-in offers next, decided only on submit.
     `help` drives the affordance shown beside the error; `resetNote` reports the
     outcome of sending a reset. */
  const [help, setHelp] = useState<LoginHelp>(null);
  const [resetNote, setResetNote] = useState<string | null>(null);
  const [resetBusy, setResetBusy] = useState(false);
  /* ⚠️ FIX ROUND 2d — show the reset / recover affordance only after 3 failed
     attempts (owner, 2026-10-25). One or two failures are an ordinary typo; the
     plain "incorrect" error is enough. The count is per-email, so switching the
     email starts it over, and classification only runs once the threshold is hit
     — so we never probe account existence on an incidental mistype. */
  const FAIL_THRESHOLD = 3;
  const [failEmail, setFailEmail] = useState('');
  const [failCount, setFailCount] = useState(0);

  async function handleCredentials(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setHelp(null);
    setResetNote(null);
    const attemptEmail = email.trim();
    const { error } = await signInWithPassword(attemptEmail, password);
    if (error) {
      // Count failures per email; a different email restarts the count.
      const n = (attemptEmail === failEmail ? failCount : 0) + 1;
      setFailEmail(attemptEmail);
      setFailCount(n);
      if (n < FAIL_THRESHOLD) {
        setSubmitting(false);
        setError('Incorrect email or password.');
        return;
      }
      // At the threshold, classify ONCE: does the email match an account? If it
      // does, the password was wrong → offer a reset. If it does not, route them
      // to account recovery — we never state "no account" as a bare fact.
      const { exists } = await classifyLoginEmail(attemptEmail);
      setSubmitting(false);
      if (exists) {
        setError('That password still doesn’t match. You can reset it below.');
        setHelp('reset');
      } else {
        setError('We couldn’t sign you in with that email.');
        setHelp('recover');
      }
      return;
    }
    // Password accepted — clear the failure count and check for a second factor.
    setFailCount(0);
    const mfa = await needsMfaChallenge();
    setSubmitting(false);
    if (mfa.required && mfa.factorId) {
      setFactorId(mfa.factorId);
      setStep('mfa');
      return;
    }
    navigate(from, { replace: true });
  }

  async function handleSendReset() {
    setResetBusy(true);
    setResetNote(null);
    await sendPasswordReset(email.trim());
    setResetBusy(false);
    // Reset send is neutral by contract; report only that it was sent.
    setResetNote('If that email has a password, a reset link is on its way. Open the newest email.');
    setHelp(null);
  }

  async function handleMfa(e: React.FormEvent) {
    e.preventDefault();
    if (!factorId) return;
    setSubmitting(true);
    setError(null);
    const { error } = await submitMfaChallenge(factorId, code.trim());
    setSubmitting(false);
    if (error) {
      setError(error);
      return;
    }
    navigate(from, { replace: true });
  }

  async function handleGoogle() {
    setGoogleLoading(true);
    setError(null);
    const { error } = await signInWithGoogle(from);
    if (error) {
      setGoogleLoading(false);
      setError(error);
    }
    // success → full-page redirect to Google
  }

  if (step === 'mfa') {
    return (
      <AuthLayout
        eyebrow="Two-Step Verification"
        title="Enter your code"
        subtitle="Open your authenticator app and enter the current 6-digit code."
      >
        <AuthCard onSubmit={handleMfa}>
          <AuthError>{error}</AuthError>
          <AuthField
            id="totp"
            label="Verification code"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]*"
            maxLength={6}
            required
            autoFocus
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="123456"
          />
          <SubmitButton loading={submitting} loadingLabel="Verifying…">Verify</SubmitButton>
        </AuthCard>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      eyebrow="Members"
      title="Welcome back"
      footer={
        <>
          Membership is by invitation only. Please{' '}
          <Link to="/contact" className="text-green-800 underline underline-offset-2 focus-ring">
            send us a message
          </Link>{' '}
          to learn more.
        </>
      }
    >
      <AuthCard onSubmit={handleCredentials}>
        <AuthError>{error}</AuthError>

        {/* ⚠️ FIX ROUND 2d — THE HELP BOX, shown only after the 3rd failed attempt.
            Reset is never an openly-browsed link; it appears here, in response to a
            real wrong-password streak on an email that matches an account. A
            non-matching email instead routes to account recovery (a person helps),
            never an automated reset. */}
        {help === 'reset' && (
          <div className="bg-cream-100 border border-green-800/15 px-4 py-3 mb-5 text-sm">
            <p className="text-green-900 mb-2">Reset your password and we’ll email you a link to set a new one.</p>
            <button type="button" onClick={() => void handleSendReset()} disabled={resetBusy}
              className="btn-primary justify-center text-sm disabled:opacity-60">
              {resetBusy ? 'Sending…' : 'Email me a reset link'}
            </button>
          </div>
        )}
        {help === 'recover' && (
          <div className="bg-cream-100 border border-green-800/15 px-4 py-3 mb-5 text-sm">
            <p className="text-green-900 mb-2">
              Can’t get in? If you’re not sure which email is on your account, we’ll help you recover it.
            </p>
            <Link to="/recover-account" state={{ email: email.trim() }}
              className="text-green-800 underline underline-offset-2 focus-ring">
              Recover your account
            </Link>
          </div>
        )}
        {resetNote && (
          <div className="bg-green-50 border border-green-800/15 text-green-800 text-sm px-4 py-3 mb-5">{resetNote}</div>
        )}

        {!passwordMode ? (
          /* Google-first: the primary affordance, with email/password one tap away. */
          <>
            <GoogleButton onClick={handleGoogle} loading={googleLoading} size="lg" />
            <p className="text-center text-sm text-muted mt-5">
              <button
                type="button"
                onClick={() => { setError(null); setPasswordMode(true); }}
                className="text-green-800 underline underline-offset-2 focus-ring"
              >
                Sign in with email and password
              </button>
            </p>
          </>
        ) : (
          <>
            <AuthField
              id="email"
              label="Email"
              type="email"
              autoComplete="email"
              required
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
            />
            <div className="mb-6">
              <label className="form-label" htmlFor="password">Password</label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="form-input"
                placeholder="••••••••"
              />
            </div>

            <SubmitButton loading={submitting} loadingLabel="Signing in…">Sign In</SubmitButton>

            <p className="text-center text-sm text-muted mt-5">
              <button
                type="button"
                onClick={() => { setError(null); setPasswordMode(false); }}
                className="text-green-800 underline underline-offset-2 focus-ring"
              >
                Use Google instead
              </button>
            </p>
          </>
        )}
      </AuthCard>
    </AuthLayout>
  );
}
