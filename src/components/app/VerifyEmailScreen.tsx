import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { KeyRound, Eye, EyeOff, Loader2, CheckCircle2, AlertCircle, Mail } from 'lucide-react';

/**
 * VERIFY EMAIL — the standalone screen the emailed verification link lands on. No app
 * chrome: a centered, branded card on the cream canvas. The user signs in with the
 * new email + the password they set; success completes the change (promotion happens
 * server-side). UI + local state only; the seam (⇢ WIRE) is where Claude Code verifies
 * the token + credentials and promotes new→current.
 *
 * Route to add (Claude Code): a public route e.g. /verify-email that renders this,
 * reading ?token= (and optionally ?email=) from the link.
 */

const GoogleGlyph = ({ size = 18 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1Z" />
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z" />
    <path fill="#FBBC05" d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84Z" />
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.06l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38Z" />
  </svg>
);

export interface VerifyEmailSeams {
  // ⇢ WIRE: verify token + (email,password); resolves on success, then promotes.
  verifyWithPassword?: (token: string, email: string, password: string) => Promise<void>;
  // ⇢ WIRE: Google-path landing (if the link opens here for a Google change).
  verifyWithGoogle?: (token: string) => Promise<void>;
}
const noop = async () => { /* demo seam */ };

export default function VerifyEmailScreen({ seams }: { seams?: VerifyEmailSeams }) {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const emailParam = params.get('email') ?? '';
  const mode = params.get('mode') ?? 'password'; // 'password' | 'google'

  const verifyPw = seams?.verifyWithPassword ?? noop;
  const verifyGoogle = seams?.verifyWithGoogle ?? noop;

  const [email, setEmail] = useState(emailParam);
  const [pw, setPw] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit() {
    setErr(null);
    if (!email.trim() || !pw) { setErr('Enter your new email and password.'); return; }
    setBusy(true);
    try {
      await verifyPw(token, email.trim(), pw);  // ⇢ WIRE
      setDone(true);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'We couldn’t verify that. The link may have expired.');
    } finally { setBusy(false); }
  }
  async function submitGoogle() {
    setBusy(true); setErr(null);
    try { await verifyGoogle(token); setDone(true); }
    catch (e) { setErr(e instanceof Error ? e.message : 'Google verification failed.'); }
    finally { setBusy(false); }
  }

  return (
    <div className="min-h-screen bg-cream grid place-items-center px-4 py-10">
      <div className="w-full max-w-[420px]">
        {/* Brand mark */}
        <div className="flex items-center justify-center gap-2.5 mb-6">
          <span className="w-9 h-9 rounded-lg bg-green-800 text-gold-400 grid place-items-center font-display text-lg font-semibold">F</span>
          <span className="font-display text-green-800 text-lg uppercase tracking-wide">French Heritage</span>
        </div>

        <div className="bg-white border border-green-800/10 rounded-2xl shadow-xl shadow-green-950/5 overflow-hidden">
          {!done ? (
            <>
              <div className="px-6 pt-6 pb-4 border-b border-green-800/[0.07]">
                <div className="w-11 h-11 rounded-xl bg-green-50 grid place-items-center mb-3">
                  <Mail size={20} className="text-green-700" />
                </div>
                <h1 className="font-serif text-green-800 text-xl">Verify your new email</h1>
                <p className="text-[12.5px] text-muted mt-1">
                  {mode === 'google' ? 'Confirm with Google to finish switching.' : 'Sign in with your new email and password to finish switching.'}
                </p>
              </div>

              <div className="p-6">
                {mode === 'google' ? (
                  <>
                    {err && <p className="form-error flex items-center gap-1.5 mb-3"><AlertCircle size={13} /> {err}</p>}
                    <button type="button" onClick={submitGoogle} disabled={busy}
                      className="w-full inline-flex items-center justify-center gap-3 py-3.5 rounded-lg bg-white border border-green-800/15 text-green-900 font-medium text-sm hover:shadow-md hover:border-green-800/25 transition-all focus-ring disabled:opacity-60">
                      {busy ? <Loader2 size={18} className="animate-spin" /> : <GoogleGlyph size={18} />}
                      {busy ? 'Confirming…' : 'Sign in with Google'}
                    </button>
                  </>
                ) : (
                  <div className="flex flex-col gap-4">
                    <div>
                      <label className="form-label">New email</label>
                      <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                        className="form-input rounded-lg" placeholder="you@example.com" />
                    </div>
                    <div>
                      <label className="form-label">Password</label>
                      <div className="relative">
                        <input type={showPw ? 'text' : 'password'} value={pw} onChange={(e) => setPw(e.target.value)}
                          className="form-input rounded-lg pr-11" placeholder="The password you just set" />
                        <button type="button" onClick={() => setShowPw((v) => !v)} aria-label={showPw ? 'Hide password' : 'Show password'}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-green-800">
                          {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                      </div>
                    </div>
                    {err && <p className="form-error flex items-center gap-1.5"><AlertCircle size={13} /> {err}</p>}
                    <button type="button" onClick={submit} disabled={busy} className="btn-primary rounded-lg w-full">
                      {busy && <Loader2 size={16} className="animate-spin" />}
                      {busy ? 'Verifying…' : 'Verify & switch'}
                      {!busy && <KeyRound size={15} />}
                    </button>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="p-8 flex flex-col items-center text-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-green-50 grid place-items-center">
                <CheckCircle2 size={32} className="text-green-600" />
              </div>
              <div>
                <h1 className="font-serif text-green-800 text-xl">Email updated</h1>
                <p className="text-[13px] text-secondary mt-1.5">
                  {email ? <>You’re now signed in with <span className="font-medium text-green-900">{email}</span>.</> : 'Your email has been switched.'}
                </p>
              </div>
              <a href="/app" className="btn-primary rounded-lg w-full">Go to your dashboard</a>
            </div>
          )}
        </div>

        <p className="text-center text-[11px] text-muted mt-5">
          If you didn’t request this change, you can ignore this page — nothing changes until it’s verified.
        </p>
      </div>
    </div>
  );
}
