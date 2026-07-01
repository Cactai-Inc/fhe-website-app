import { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useDocumentTitle } from '../lib/hooks';
import { needsMfaChallenge, submitMfaChallenge } from '../lib/auth';
import { AuthLayout, AuthCard } from '../components/auth/AuthLayout';
import { AuthField, AuthError, SubmitButton } from '../components/auth/AuthControls';
import { GoogleButton } from '../components/auth/GoogleButton';

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

  async function handleCredentials(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const { error } = await signInWithPassword(email.trim(), password);
    if (error) {
      setSubmitting(false);
      setError(error);
      return;
    }
    // Password accepted — is a second factor required?
    const mfa = await needsMfaChallenge();
    setSubmitting(false);
    if (mfa.required && mfa.factorId) {
      setFactorId(mfa.factorId);
      setStep('mfa');
      return;
    }
    navigate(from, { replace: true });
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
              <div className="flex items-center justify-between">
                <label className="form-label" htmlFor="password">Password</label>
                <Link to="/forgot-password" className="text-xs text-green-800 underline underline-offset-2 focus-ring">
                  Forgot password?
                </Link>
              </div>
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
