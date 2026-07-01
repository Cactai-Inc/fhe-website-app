import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useDocumentTitle } from '../lib/hooks';
import { sendPasswordReset } from '../lib/auth';
import { AuthLayout, AuthCard } from '../components/auth/AuthLayout';
import { AuthField, AuthError, AuthNotice, SubmitButton } from '../components/auth/AuthControls';

export default function ForgotPassword() {
  useDocumentTitle('Reset Your Password');
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const { error } = await sendPasswordReset(email.trim());
    setSubmitting(false);
    if (error) {
      setError(error);
      return;
    }
    setSent(true); // do not reveal whether the address exists
  }

  return (
    <AuthLayout
      eyebrow="Members"
      title="Reset your password"
      footer={
        <Link to="/login" className="text-green-800 underline underline-offset-2 focus-ring">
          Back to sign in
        </Link>
      }
    >
      {sent ? (
        <div className="bg-white border border-green-800/10 p-8">
          <AuthNotice>
            If an account exists for <strong>{email}</strong>, a password-reset link is on its way.
          </AuthNotice>
          <p className="text-sm text-muted">Didn't get it? Check your spam folder, or try again in a minute.</p>
        </div>
      ) : (
        <AuthCard onSubmit={handleSubmit}>
          <AuthError>{error}</AuthError>
          <p className="body-text text-sm mb-5">
            Enter your email and we'll send a link to set a new password.
          </p>
          <AuthField
            id="email"
            label="Email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="your@email.com"
          />
          <SubmitButton loading={submitting} loadingLabel="Sending…">Send reset link</SubmitButton>
        </AuthCard>
      )}
    </AuthLayout>
  );
}
