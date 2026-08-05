import { useEffect, useState } from 'react';
import { ShieldCheck, ChevronRight, KeyRound } from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import { listLinkedProviders, linkOAuthIdentity, updatePassword } from '../../../lib/auth';
import { startGoogleChange, startPasswordChange } from '../../../lib/emailChange';
import { EmailChangeModal } from '../EmailChangeModal';
import { SectionCard } from './SectionCard';

/** Standalone change-password (auth-level update on the live session — distinct
 *  from the email-change flow's own password seam). Modal, explicit close (X),
 *  matching the interaction law: no inner pages. */
function ChangePasswordModal({ onClose }: { onClose: () => void }) {
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    if (pw.length < 8) { setErr('Use at least 8 characters.'); return; }
    if (pw !== pw2) { setErr('The passwords do not match.'); return; }
    setBusy(true);
    const { error } = await updatePassword(pw);
    setBusy(false);
    if (error) { setErr(error); return; }
    setDone(true);
  }

  return (
    <div className="fixed inset-0 z-[80] bg-green-950/40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
        <h2 className="font-serif text-xl text-green-900 mb-1">Change password</h2>
        {done ? (
          <div>
            <p className="body-text text-sm text-green-800 mt-2">Your password is updated.</p>
            <div className="mt-4 flex justify-end">
              <button type="button" className="btn-primary" onClick={onClose}>Done</button>
            </div>
          </div>
        ) : (
          <form onSubmit={submit} className="flex flex-col gap-3 mt-3">
            <label className="text-xs text-muted" htmlFor="np">New password</label>
            <input id="np" type="password" autoComplete="new-password" className="border border-green-800/20 rounded-lg px-3 py-2 text-sm focus-ring"
              value={pw} onChange={(e) => setPw(e.target.value)} />
            <label className="text-xs text-muted" htmlFor="np2">Repeat new password</label>
            <input id="np2" type="password" autoComplete="new-password" className="border border-green-800/20 rounded-lg px-3 py-2 text-sm focus-ring"
              value={pw2} onChange={(e) => setPw2(e.target.value)} />
            <p className="text-[11px] text-muted -mt-1">Password reset always sends a magic link to your login email.</p>
            {err && <p role="alert" className="text-sm text-red-700">{err}</p>}
            <div className="mt-1 flex justify-end gap-2">
              <button type="button" className="btn-outline-gold" onClick={onClose}>Cancel</button>
              <button type="submit" className="btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Save password'}</button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

function Row({
  title, sub, onClick,
}: { title: string; sub?: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full flex items-center justify-between gap-3 bg-cream-100/60 border border-green-800/10 rounded-xl px-3.5 py-3 text-left hover:border-green-800/25 focus-ring"
    >
      <span className="min-w-0">
        <span className="block text-[13px] font-medium text-green-900">{title}</span>
        {sub && <span className="block text-[11.5px] text-muted mt-0.5">{sub}</span>}
      </span>
      <ChevronRight size={16} className="text-muted shrink-0" />
    </button>
  );
}

/** SECTION 4 — LOGIN & SECURITY. Owner spec 2026-08-05 (TASK-PROFILE): no inner
 *  pages — email change and password change are modals (already were), Google
 *  is a direct connect action. This dissolves the last surviving inner page
 *  (/app/profile's duplicate "Sign-in methods" card) into this one section. */
export function LoginSecurityCard() {
  const { user } = useAuth();
  const [emailOpen, setEmailOpen] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [linked, setLinked] = useState<string[] | null>(null);
  const [linkError, setLinkError] = useState<string | null>(null);

  useEffect(() => {
    listLinkedProviders().then(setLinked).catch(() => setLinked([]));
  }, [user?.id]);

  async function connectGoogle() {
    setLinkError(null);
    const { error } = await linkOAuthIdentity('google', '/app/account');
    if (error) setLinkError(error);
  }

  const googleConnected = linked?.includes('google') ?? false;

  return (
    <SectionCard icon={ShieldCheck} title="Login & security">
      <div className="flex flex-col gap-2.5">
        <Row title="Login" sub={user?.email ?? undefined} onClick={() => setEmailOpen(true)} />
        <Row title="Password" sub="Set or change your password" onClick={() => setPasswordOpen(true)} />
        <div className="flex items-center justify-between gap-3 bg-cream-100/60 border border-green-800/10 rounded-xl px-3.5 py-3">
          <span className="min-w-0">
            <span className="block text-[13px] font-medium text-green-900">Sign in with Google</span>
            <span className="block text-[11.5px] text-muted mt-0.5">
              {googleConnected ? 'Connected' : 'Switch this account to Google sign-in'}
            </span>
          </span>
          {!googleConnected && (
            <button type="button" onClick={() => { void connectGoogle(); }}
              className="text-[12px] font-medium text-green-800 border border-green-800/25 rounded-lg px-3 py-1.5 hover:border-green-800/40 focus-ring shrink-0">
              Connect
            </button>
          )}
        </div>
        {linkError && <p role="alert" className="form-error flex items-center gap-1.5"><KeyRound size={13} /> {linkError}</p>}
      </div>

      {passwordOpen && <ChangePasswordModal onClose={() => setPasswordOpen(false)} />}
      {emailOpen && (
        <EmailChangeModal
          currentEmail={user?.email ?? ''}
          onClose={() => setEmailOpen(false)}
          seams={{ startGoogleChange, startPasswordChange }}
        />
      )}
    </SectionCard>
  );
}
