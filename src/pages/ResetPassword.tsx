import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Eye, EyeOff, Check, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { updatePassword } from '../lib/auth';
import { useDocumentTitle } from '../lib/hooks';
import { AuthLayout, AuthCard } from '../components/auth/AuthLayout';
import { AuthError, AuthNotice, SubmitButton } from '../components/auth/AuthControls';

/** A password input with a show/hide toggle (fix round 2d — the reset page gave
 *  no way to see what was typed). Reuses the shared field styling. */
function PasswordField({
  id, label, value, onChange, autoFocus,
}: {
  id: string; label: string; value: string;
  onChange: (v: string) => void; autoFocus?: boolean;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="mb-5">
      <label className="form-label" htmlFor={id}>{label}</label>
      <div className="relative">
        <input id={id} type={show ? 'text' : 'password'} className="form-input pr-11"
          autoComplete="new-password" required minLength={8} autoFocus={autoFocus}
          value={value} onChange={(e) => onChange(e.target.value)}
          placeholder="At least 8 characters" />
        <button type="button" onClick={() => setShow((s) => !s)}
          aria-label={show ? 'Hide password' : 'Show password'} aria-pressed={show}
          className="absolute inset-y-0 right-0 px-3 flex items-center text-green-800/60 hover:text-green-800 focus-ring">
          {show ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      </div>
    </div>
  );
}

export default function ResetPassword() {
  useDocumentTitle('Set a New Password');
  const navigate = useNavigate();
  const [ready, setReady] = useState<boolean | null>(null);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  // The reset link carries a recovery token that supabase-js parses from the URL,
  // establishing a short-lived session and firing PASSWORD_RECOVERY. `ready` stays
  // null until we know, so the page can tell "checking" from "no session" (fix
  // round 2d — the old page showed the form regardless and only failed on submit).
  useEffect(() => {
    let settled = false;
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) { settled = true; setReady(true); }
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN') { settled = true; setReady(true); }
    });
    // Give supabase-js a moment to parse the URL hash; if no session appears, the
    // link is spent or was opened directly.
    const t = setTimeout(() => { if (!settled) setReady(false); }, 2500);
    return () => { clearTimeout(t); sub.subscription.unsubscribe(); };
  }, []);

  const tooShort = password.length > 0 && password.length < 8;
  const mismatch = confirm.length > 0 && password !== confirm;
  const match = password.length >= 8 && confirm.length > 0 && password === confirm;
  const canSubmit = ready === true && match && !submitting;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) { setError('Those passwords don’t match.'); return; }
    setSubmitting(true);
    setError(null);
    const { error } = await updatePassword(password);
    setSubmitting(false);
    if (error) {
      setError(error);
      return;
    }
    setDone(true);
    setTimeout(() => navigate('/account', { replace: true }), 1500);
  }

  return (
    <AuthLayout
      eyebrow="Members"
      title="Set a new password"
      footer={
        <Link to="/login" className="text-green-800 underline underline-offset-2 focus-ring">
          Back to sign in
        </Link>
      }
    >
      {done ? (
        <div className="bg-white border border-green-800/10 p-8">
          <AuthNotice>Your password has been updated. Taking you to your account…</AuthNotice>
        </div>
      ) : ready === false ? (
        /* ⚠️ FIX ROUND 2d — NO RECOVERY SESSION. The link is spent, expired, or the
           page was opened directly. Say so plainly and point back to the one place
           that issues a new link — rather than showing a form that can only fail
           with a raw "missing session" error (which is what staff hit in testing). */
        <div className="bg-white border border-green-800/10 p-8">
          <AuthError>This reset link is no longer valid — it may have expired or already been used.</AuthError>
          <p className="body-text text-sm">
            Request a new one from{' '}
            <Link to="/forgot-password" className="text-green-800 underline underline-offset-2 focus-ring">
              Forgot password?
            </Link>{' '}and open the newest email.
          </p>
        </div>
      ) : (
        <AuthCard onSubmit={handleSubmit}>
          <AuthError>{error}</AuthError>
          {ready === null && (
            <p className="body-text text-sm mb-5 text-muted">Checking your reset link…</p>
          )}
          <PasswordField id="password" label="New password" value={password}
            onChange={setPassword} autoFocus />
          {tooShort && (
            <p className="text-xs text-gold-800 -mt-3 mb-5">Use at least 8 characters.</p>
          )}
          <PasswordField id="confirm" label="Confirm new password" value={confirm}
            onChange={setConfirm} />
          {/* Live match feedback (fix round 2d) — no waiting for submit to learn
              the two don't agree. */}
          {(mismatch || match) && (
            <p className={`text-xs -mt-3 mb-5 flex items-center gap-1.5 ${match ? 'text-green-700' : 'text-red-700'}`}>
              {match ? <Check size={14} /> : <X size={14} />}
              {match ? 'Passwords match.' : 'Passwords don’t match yet.'}
            </p>
          )}
          <SubmitButton loading={submitting} loadingLabel="Updating…" disabled={!canSubmit}>
            Update password
          </SubmitButton>
        </AuthCard>
      )}
    </AuthLayout>
  );
}
