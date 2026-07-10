import { useMemo, useState } from 'react';
import {
  X, Mail, KeyRound, ArrowRight, ArrowLeft, Check, Eye, EyeOff,
  Loader2, MailCheck, AlertCircle, Sparkles,
} from 'lucide-react';

/**
 * EMAIL CHANGE — the full flow, styled. UI + state machine only; the marked seams
 * (⇢ WIRE) are where Claude Code connects the backend.
 *
 * Flow:
 *  1. enter   — type the new email. Detect: @gmail → Google path. Otherwise show a
 *               "this is a Google-hosted (Workspace) email" checkbox; checked → Google
 *               path, unchecked → password path.
 *  2a Google  — a re-auth panel (Sign in with Google) confirms control; no email sent.
 *  2b Password— set a password (both inputs CLEAR TEXT, visible, must match), then
 *               "verification sent — check spam" state; the emailed link lands on the
 *               standalone VerifyEmailScreen (separate route) to finish.
 *  Current email keeps working; the new one is pending until the path completes.
 *
 * This component is presentation + local flow state. It calls three seam callbacks
 * the caller supplies (all optional here; defaulted to resolve so the UI is
 * demonstrable before wiring).
 */

type Path = 'unknown' | 'google' | 'password';
type Screen = 'enter' | 'google' | 'password' | 'sent';

export interface EmailChangeSeams {
  // ⇢ WIRE: begin a Google-path change; resolves when re-auth + promotion complete.
  startGoogleChange?: (newEmail: string) => Promise<void>;
  // ⇢ WIRE: begin a password-path change; sends the verification email.
  startPasswordChange?: (newEmail: string, password: string) => Promise<void>;
}

const noop = async () => { /* demo seam */ };

function isGmail(email: string): boolean {
  return /@gmail\.com$/i.test(email.trim());
}
function looksLikeEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

// Small stepper dots for the password path (enter → set password → sent).
function Dots({ index, total }: { index: number; total: number }) {
  return (
    <div className="flex items-center gap-1.5">
      {Array.from({ length: total }).map((_, i) => (
        <span key={i} className={`h-1.5 rounded-full transition-all duration-300 ${i === index ? 'w-6 bg-green-800' : i < index ? 'w-1.5 bg-green-800/50' : 'w-1.5 bg-green-800/15'}`} />
      ))}
    </div>
  );
}

function GoogleGlyph({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1Z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z" />
      <path fill="#FBBC05" d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84Z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.06l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38Z" />
    </svg>
  );
}

export function EmailChangeModal({
  currentEmail, onClose, seams,
}: {
  currentEmail: string;
  onClose: () => void;
  seams?: EmailChangeSeams;
}) {
  const startGoogle = seams?.startGoogleChange ?? noop;
  const startPassword = seams?.startPasswordChange ?? noop;

  const [screen, setScreen] = useState<Screen>('enter');
  const [email, setEmail] = useState('');
  const [workspace, setWorkspace] = useState(false);
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [showPw, setShowPw] = useState(true); // clear-text by design
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const path: Path = useMemo(() => {
    if (!looksLikeEmail(email)) return 'unknown';
    if (isGmail(email) || workspace) return 'google';
    return 'password';
  }, [email, workspace]);

  const gmail = isGmail(email);

  function proceedFromEnter() {
    setErr(null);
    if (!looksLikeEmail(email)) { setErr('Enter a valid email address.'); return; }
    if (email.trim().toLowerCase() === currentEmail.trim().toLowerCase()) {
      setErr('That’s already your email.'); return;
    }
    if (path === 'google') setScreen('google');
    else setScreen('password');
  }

  async function confirmGoogle() {
    setBusy(true); setErr(null);
    try {
      await startGoogle(email.trim());   // ⇢ WIRE: opens Google re-auth, promotes on success
      onClose();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not verify with Google. Try again.');
    } finally { setBusy(false); }
  }

  async function submitPassword() {
    setErr(null);
    if (pw.length < 8) { setErr('Use at least 8 characters.'); return; }
    if (pw !== pw2) { setErr('The two passwords don’t match.'); return; }
    setBusy(true);
    try {
      await startPassword(email.trim(), pw);  // ⇢ WIRE: sets password, sends verification email
      setScreen('sent');
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not start the change. Try again.');
    } finally { setBusy(false); }
  }

  const stepIndex = screen === 'enter' ? 0 : screen === 'password' ? 1 : 2;

  return (
    <div className="fixed inset-0 bg-green-950/40 backdrop-blur-[2px] z-[70] flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
      <div
        className="bg-cream w-full sm:max-w-[440px] sm:rounded-2xl max-h-[94vh] overflow-y-auto shadow-2xl shadow-green-950/30 animate-fade-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Branded header band */}
        <div className="relative px-5 pt-5 pb-4 bg-gradient-to-br from-green-800 to-green-900 text-white">
          <button type="button" onClick={onClose} aria-label="Close"
            className="absolute top-4 right-4 text-white/70 hover:text-white transition-colors focus-ring rounded">
            <X size={20} />
          </button>
          <div className="w-10 h-10 rounded-xl bg-white/10 grid place-items-center mb-3">
            <Mail size={20} className="text-gold-400" />
          </div>
          <h2 className="font-serif text-xl leading-tight">Change your email</h2>
          <p className="text-white/70 text-[12.5px] mt-1 font-sans">
            Signed in as <span className="text-gold-200">{currentEmail}</span>
          </p>
        </div>

        <div className="p-5">
          {/* STEP: enter new email */}
          {screen === 'enter' && (
            <div className="flex flex-col gap-4 animate-fade-in">
              <div>
                <label className="form-label">New email address</label>
                <input
                  type="email" autoFocus value={email}
                  onChange={(e) => { setEmail(e.target.value); setErr(null); }}
                  className="form-input rounded-lg" placeholder="you@example.com"
                  aria-invalid={!!err}
                />
              </div>

              {/* Google-hosted disclosure — only when not obviously gmail */}
              {looksLikeEmail(email) && !gmail && (
                <button
                  type="button" onClick={() => setWorkspace((v) => !v)}
                  className={`flex items-start gap-3 p-3.5 rounded-xl border text-left transition-all duration-200 ${
                    workspace ? 'border-green-300 bg-green-50' : 'border-green-800/12 bg-white hover:border-green-800/25'
                  }`}
                >
                  <span className={`mt-0.5 w-5 h-5 rounded-md grid place-items-center border shrink-0 transition-colors ${workspace ? 'bg-green-700 border-green-700 text-white' : 'border-green-800/30'}`}>
                    {workspace && <Check size={13} />}
                  </span>
                  <span>
                    <span className="block text-[13px] font-medium text-green-900">This is a Google-hosted email</span>
                    <span className="block text-[11.5px] text-muted mt-0.5">A Workspace address on a custom domain still signs in with Google. Check this to sign in with Google instead of a password.</span>
                  </span>
                </button>
              )}

              {/* Path preview chip */}
              {path !== 'unknown' && (
                <div className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-[12px] ${path === 'google' ? 'bg-gold-50 text-gold-800' : 'bg-green-50 text-green-800'}`}>
                  {path === 'google' ? <GoogleGlyph size={15} /> : <KeyRound size={14} />}
                  <span>
                    {path === 'google'
                      ? 'You’ll confirm with Google — no verification email needed.'
                      : 'You’ll set a password and verify by email.'}
                  </span>
                </div>
              )}

              {err && <p className="form-error flex items-center gap-1.5"><AlertCircle size={13} /> {err}</p>}

              <button type="button" onClick={proceedFromEnter} disabled={!looksLikeEmail(email)}
                className="btn-primary rounded-lg w-full">
                Continue <ArrowRight size={16} />
              </button>
              <p className="text-[11px] text-muted text-center -mt-1">
                Your current email keeps working until the change is verified.
              </p>
            </div>
          )}

          {/* STEP: Google re-auth */}
          {screen === 'google' && (
            <div className="flex flex-col gap-4 animate-fade-in">
              <button type="button" onClick={() => setScreen('enter')} className="inline-flex items-center gap-1.5 text-[12px] text-muted hover:text-green-800 self-start">
                <ArrowLeft size={14} /> Back
              </button>
              <div className="text-center py-2">
                <div className="w-14 h-14 rounded-2xl bg-white border border-green-800/10 shadow-sm grid place-items-center mx-auto mb-4">
                  <GoogleGlyph size={26} />
                </div>
                <h3 className="font-serif text-green-800 text-lg">Confirm with Google</h3>
                <p className="text-[13px] text-secondary mt-1.5 leading-relaxed px-2">
                  Sign in with Google as <span className="font-medium text-green-900">{email}</span> to confirm you own it. This replaces your current email right away — no verification email.
                </p>
              </div>
              {err && <p className="form-error flex items-center gap-1.5 justify-center"><AlertCircle size={13} /> {err}</p>}
              <button type="button" onClick={confirmGoogle} disabled={busy}
                className="w-full inline-flex items-center justify-center gap-3 py-3.5 rounded-lg bg-white border border-green-800/15 text-green-900 font-medium text-sm hover:shadow-md hover:border-green-800/25 transition-all focus-ring disabled:opacity-60">
                {busy ? <Loader2 size={18} className="animate-spin" /> : <GoogleGlyph size={18} />}
                {busy ? 'Confirming…' : 'Sign in with Google'}
              </button>
            </div>
          )}

          {/* STEP: set password */}
          {screen === 'password' && (
            <div className="flex flex-col gap-4 animate-fade-in">
              <div className="flex items-center justify-between">
                <button type="button" onClick={() => setScreen('enter')} className="inline-flex items-center gap-1.5 text-[12px] text-muted hover:text-green-800">
                  <ArrowLeft size={14} /> Back
                </button>
                <Dots index={stepIndex} total={3} />
              </div>
              <div className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl bg-green-50 text-green-800 text-[12px]">
                <KeyRound size={14} />
                <span>Set a password for <span className="font-medium">{email}</span>. You’ll use it to sign in after verifying.</span>
              </div>

              <div>
                <label className="form-label">Password</label>
                <div className="relative">
                  <input
                    type={showPw ? 'text' : 'password'} autoFocus value={pw}
                    onChange={(e) => { setPw(e.target.value); setErr(null); }}
                    className="form-input rounded-lg pr-11" placeholder="At least 8 characters"
                  />
                  <button type="button" onClick={() => setShowPw((v) => !v)} aria-label={showPw ? 'Hide password' : 'Show password'}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-green-800">
                    {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                <p className="form-hint mt-1">Shown as you type so you can check it.</p>
              </div>

              <div>
                <label className="form-label">Confirm password</label>
                <input
                  type={showPw ? 'text' : 'password'} value={pw2}
                  onChange={(e) => { setPw2(e.target.value); setErr(null); }}
                  className={`form-input rounded-lg ${pw2 && pw !== pw2 ? 'form-input-error' : ''}`} placeholder="Re-enter it"
                />
                {pw2 && pw === pw2 && (
                  <p className="text-[11.5px] text-green-700 mt-1 flex items-center gap-1"><Check size={12} /> Passwords match</p>
                )}
              </div>

              {err && <p className="form-error flex items-center gap-1.5"><AlertCircle size={13} /> {err}</p>}

              <button type="button" onClick={submitPassword} disabled={busy}
                className="btn-primary rounded-lg w-full">
                {busy && <Loader2 size={16} className="animate-spin" />}
                {busy ? 'Sending…' : 'Send verification email'}
              </button>
            </div>
          )}

          {/* STEP: verification sent */}
          {screen === 'sent' && (
            <div className="flex flex-col items-center text-center gap-4 py-3 animate-fade-in">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-gold-50 to-white border border-gold-200 grid place-items-center">
                <MailCheck size={30} className="text-gold-600" />
              </div>
              <div>
                <h3 className="font-serif text-green-800 text-xl">Check your inbox</h3>
                <p className="text-[13px] text-secondary mt-1.5 leading-relaxed px-1">
                  We sent a verification link to <span className="font-medium text-green-900">{email}</span>. Open it to finish switching — you’ll sign in there with your new email and password.
                </p>
              </div>
              <div className="w-full flex items-center gap-2.5 px-3.5 py-3 rounded-xl bg-cream-100 text-[12px] text-secondary">
                <Sparkles size={15} className="text-gold-600 shrink-0" />
                <span>Don’t see it within a minute? Check your spam or promotions folder.</span>
              </div>
              <p className="text-[11.5px] text-muted">Your current email stays active until you verify the new one.</p>
              <button type="button" onClick={onClose} className="btn-outline-gold rounded-lg w-full">Done</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
