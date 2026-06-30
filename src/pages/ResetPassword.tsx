import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { updatePassword } from '../lib/auth';
import { useDocumentTitle } from '../lib/hooks';
import { AuthLayout, AuthCard } from '../components/auth/AuthLayout';
import { AuthField, AuthError, AuthNotice, SubmitButton } from '../components/auth/AuthControls';

export default function ResetPassword() {
  useDocumentTitle('Set a New Password');
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  // The reset link carries a recovery token that supabase-js parses from the URL,
  // establishing a short-lived session and firing PASSWORD_RECOVERY.
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN') setReady(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) {
      setError('Those passwords don’t match.');
      return;
    }
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
      ) : (
        <AuthCard onSubmit={handleSubmit}>
          <AuthError>{error}</AuthError>
          {!ready && (
            <p className="body-text text-sm mb-5 text-muted">
              Open this page from the reset link we emailed you. If you got here directly, request a new
              link from “Forgot password?”.
            </p>
          )}
          <AuthField
            id="password"
            label="New password"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="At least 8 characters"
          />
          <AuthField
            id="confirm"
            label="Confirm new password"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="Re-enter your new password"
          />
          <SubmitButton loading={submitting} loadingLabel="Updating…">Update password</SubmitButton>
        </AuthCard>
      )}
    </AuthLayout>
  );
}
