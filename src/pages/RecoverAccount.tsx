import { useState } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { useDocumentTitle } from '../lib/hooks';
import { submitRequest } from '../lib/api';
import { toErrorMessage } from '../lib/ops/errors';
import { AuthLayout, AuthCard } from '../components/auth/AuthLayout';
import { AuthField, AuthError, AuthNotice, SubmitButton } from '../components/auth/AuthControls';

/**
 * ⚠️ FIX ROUND 2d — ACCOUNT RECOVERY (owner, 2026-10-25).
 *
 * When someone tries to sign in with an email that does NOT match an account —
 * usually because they are unsure which address they used — there is no automated
 * reset to send (an automated reset to a non-account would be an enumeration
 * signal and a dead end). Instead they file an issue alert TO US, and a person
 * resolves it. The login form routes its "recover your account" affordance here
 * and carries the email they tried, prefilled.
 *
 * It files through `submitRequest`, the one anon-safe SECURITY DEFINER request
 * spine (it stamps the tenant, writes the `requests` row, and fires the staff
 * alert) — never a bespoke insert. Marked `entry_location: 'account_recovery'`
 * so staff can see what the alert is.
 */
export default function RecoverAccount() {
  useDocumentTitle('Recover Your Account');
  const location = useLocation();
  const prefillEmail = (location.state as { email?: string } | null)?.email ?? '';

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  // The email to REPLY to (one they can read now) — not the one that failed.
  const [replyEmail, setReplyEmail] = useState(prefillEmail);
  const [phone, setPhone] = useState('');
  const [note, setNote] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await submitRequest(
        {
          first_name: firstName.trim(),
          // last name is required server-side; fall back so a one-name person
          // is not blocked from reaching us about getting back in.
          last_name: lastName.trim() || '—',
          contact_email: replyEmail.trim(),
          contact_phone: phone.trim() || undefined,
          channel: 'contact',
          entry_location: 'account_recovery',
          notes: note.trim() || 'Account recovery: cannot sign in / unsure which email is on the account.',
          details: { reason: 'account_recovery' },
        },
        [],
      );
      setSent(true);
    } catch (err) {
      setError(toErrorMessage(err, 'Could not send your request. Please try again.'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthLayout
      eyebrow="Members"
      title="Recover your account"
      footer={
        <Link to="/login" className="text-green-800 underline underline-offset-2 focus-ring">
          Back to sign in
        </Link>
      }
    >
      {sent ? (
        <div className="bg-white border border-green-800/10 p-8">
          <AuthNotice>
            Thanks — we&apos;ve received your request and someone will reach out to help you get back in.
          </AuthNotice>
          <p className="text-sm text-muted">
            We&apos;ll contact you at the email you entered. If it&apos;s urgent, you can also reach us
            from the{' '}
            <Link to="/contact" className="text-green-800 underline underline-offset-2 focus-ring">contact page</Link>.
          </p>
        </div>
      ) : (
        <AuthCard onSubmit={handleSubmit}>
          <AuthError>{error}</AuthError>
          <p className="body-text text-sm mb-5">
            Can&apos;t sign in? Give us your name and phone number — that&apos;s how we find the email your
            account is actually under — plus the email you tried. A person will get you back in.
          </p>
          <div className="grid grid-cols-2 gap-3">
            <AuthField id="first" label="First name" autoComplete="given-name" required
              value={firstName} onChange={(e) => setFirstName(e.target.value)} />
            <AuthField id="last" label="Last name" autoComplete="family-name"
              value={lastName} onChange={(e) => setLastName(e.target.value)} />
          </div>
          <AuthField id="phone" label="Phone number" type="tel" autoComplete="tel" required
            hint="How we match your record to find the right account."
            value={phone} onChange={(e) => setPhone(e.target.value)}
            placeholder="(555) 555-5555" />
          {/* The email they tried is CAPTURED from the sign-in attempt. When it was
              carried over it is shown read-only; reached directly (no attempt), it
              is asked for, because the request needs a contactable address. */}
          {prefillEmail ? (
            <div className="mb-5">
              <label className="form-label">The email you tried</label>
              <p className="form-input bg-cream-100 text-muted">{replyEmail}</p>
            </div>
          ) : (
            <AuthField id="tried" label="The email you tried" type="email" autoComplete="email" required
              value={replyEmail} onChange={(e) => setReplyEmail(e.target.value)}
              placeholder="your@email.com" />
          )}
          <div className="mb-5">
            <label className="form-label" htmlFor="note">Anything else (optional)</label>
            <textarea id="note" rows={2} className="form-input resize-y"
              value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
          <SubmitButton loading={submitting} loadingLabel="Sending…">Send recovery request</SubmitButton>
        </AuthCard>
      )}
    </AuthLayout>
  );
}
