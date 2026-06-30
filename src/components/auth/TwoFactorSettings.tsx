/**
 * Optional TOTP two-factor management — enroll (scan QR → verify), show status,
 * and turn off. Self-contained: drop <TwoFactorSettings/> anywhere a signed-in
 * user manages their account. 2FA is suggested but never required.
 */
import { useEffect, useState } from 'react';
import { ShieldCheck, Shield } from 'lucide-react';
import {
  listMfaFactors, enrollTotp, verifyTotpEnrollment, unenrollTotp, type TotpEnrollment,
} from '../../lib/auth';
import { AuthError, AuthNotice } from './AuthControls';

export function TwoFactorSettings() {
  const [loading, setLoading] = useState(true);
  const [enabled, setEnabled] = useState(false);
  const [factorId, setFactorId] = useState<string | null>(null);
  const [enroll, setEnroll] = useState<TotpEnrollment | null>(null);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function refresh() {
    const f = await listMfaFactors();
    setEnabled(f.hasVerifiedTotp);
    setFactorId(f.totp.find((t) => t.status === 'verified')?.id ?? null);
    setLoading(false);
  }
  useEffect(() => {
    void refresh();
  }, []);

  async function start() {
    setBusy(true);
    setError(null);
    const e = await enrollTotp('FHE Authenticator');
    setBusy(false);
    if (e.error) {
      setError(e.error);
      return;
    }
    setEnroll(e);
  }

  async function confirm(ev: React.FormEvent) {
    ev.preventDefault();
    if (!enroll) return;
    setBusy(true);
    setError(null);
    const { error } = await verifyTotpEnrollment(enroll.factorId, code.trim());
    setBusy(false);
    if (error) {
      setError(error);
      return;
    }
    setEnroll(null);
    setCode('');
    await refresh();
  }

  async function disable() {
    if (!factorId) return;
    setBusy(true);
    setError(null);
    const { error } = await unenrollTotp(factorId);
    setBusy(false);
    if (error) {
      setError(error);
      return;
    }
    await refresh();
  }

  return (
    <div className="bg-white border border-green-800/10 p-6">
      <div className="flex items-center gap-2 mb-1">
        {enabled ? <ShieldCheck size={18} className="text-green-700" /> : <Shield size={18} className="text-green-800/50" />}
        <h3 className="font-serif font-medium text-green-800 text-lg">Two-step verification</h3>
      </div>
      <p className="text-xs text-muted mb-4">
        Recommended. Adds a one-time code from an authenticator app when you sign in. Optional — you
        can turn it off any time.
      </p>

      {loading ? (
        <p className="body-text text-sm text-muted">Loading…</p>
      ) : enroll ? (
        <form onSubmit={confirm}>
          <p className="text-sm font-sans text-green-900 mb-3">
            Scan this with Google Authenticator, 1Password, or Authy, then enter the 6-digit code.
          </p>
          {enroll.qrSvg ? (
            <div className="inline-block bg-white p-2 border border-green-800/10 mb-3" aria-label="2FA QR code"
              dangerouslySetInnerHTML={{ __html: enroll.qrSvg }} />
          ) : (
            <p className="text-xs break-all text-muted mb-3">{enroll.uri}</p>
          )}
          <AuthError>{error}</AuthError>
          <label className="form-label" htmlFor="enroll_code">Verification code</label>
          <input
            id="enroll_code"
            className="form-input"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={6}
            autoComplete="one-time-code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="123456"
          />
          <div className="flex gap-2 mt-4">
            <button type="submit" disabled={busy} className="btn-primary justify-center flex-1">
              {busy ? 'Verifying…' : 'Turn on'}
            </button>
            <button type="button" onClick={() => { setEnroll(null); setError(null); }}
              className="px-4 text-sm text-secondary hover:text-green-800 focus-ring">
              Cancel
            </button>
          </div>
        </form>
      ) : enabled ? (
        <>
          <AuthNotice>Two-step verification is on.</AuthNotice>
          <AuthError>{error}</AuthError>
          <button type="button" onClick={disable} disabled={busy}
            className="text-sm text-red-700 hover:text-red-800 underline underline-offset-2 focus-ring">
            {busy ? 'Turning off…' : 'Turn off two-step verification'}
          </button>
        </>
      ) : (
        <>
          <AuthError>{error}</AuthError>
          <button type="button" onClick={start} disabled={busy} className="btn-primary justify-center">
            {busy ? 'Starting…' : 'Enable two-step verification'}
          </button>
        </>
      )}
    </div>
  );
}
