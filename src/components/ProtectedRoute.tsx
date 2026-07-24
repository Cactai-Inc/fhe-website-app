import { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { fetchMyGrantKeys } from '../lib/grants';
import { redeemMyPendingInvitation, ensureMyMembership } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';

/** Gates a route behind authentication. Redirects unauthenticated visitors to
 *  /login (preserving where they were headed). Optionally requires admin or an
 *  active membership. */
export default function ProtectedRoute({
  children,
  requireAdmin = false,
  requireStaff = false,
  requireMember = false,
  requireSuperAdmin = false,
  grantKey,
}: {
  children: React.ReactNode;
  requireAdmin?: boolean;
  /** Two-operator model (Slice 5): any operator — admin OR trainer — may enter.
   *  Use for the servicing surfaces trainers share; keep requireAdmin for the
   *  admin-only total-control surfaces (billing, deal terms, config, oversight). */
  requireStaff?: boolean;
  requireMember?: boolean;
  /** Platform surfaces — SUPER_ADMIN only (the platform admin, no tenant). */
  requireSuperAdmin?: boolean;
  /** Admin surface an instructor may enter WHEN granted (instructor_surface_grants;
   *  admin always passes). Pass the surface's nav key (its route path). */
  grantKey?: string;
}) {
  const { user, isAdmin, isStaff, isSuperAdmin, isMember, loading, refreshProfile, signOut } = useAuth();
  const location = useLocation();
  const [grantState, setGrantState] = useState<'idle' | 'checking' | 'granted' | 'denied'>('idle');

  const needsGrantCheck = Boolean(grantKey) && !isAdmin && isStaff;
  useEffect(() => {
    if (!needsGrantCheck) return;
    setGrantState('checking');
    fetchMyGrantKeys()
      .then((keys) => setGrantState(keys.includes(grantKey!) ? 'granted' : 'denied'))
      .catch(() => setGrantState('denied'));
  }, [needsGrantCheck, grantKey]);

  // Self-heal the stale-session trap: a signed-in user who lands on a
  // member-gated route WITHOUT membership (e.g. clicked their invite while
  // already signed in, so the acceptance flow was skipped) shouldn't dead-end.
  // Try to redeem their own pending invitation / heal their membership, then
  // re-fetch. 'healing' → in progress; 'exhausted' → nothing to redeem, show
  // the honest notice.
  const [healState, setHealState] = useState<'idle' | 'healing' | 'exhausted'>('idle');
  const needsHeal = Boolean(user) && requireMember && !isMember && !loading;
  useEffect(() => {
    if (!needsHeal || healState !== 'idle') return;
    setHealState('healing');
    (async () => {
      let healed = false;
      try { healed = await redeemMyPendingInvitation(); } catch { /* fall through */ }
      if (!healed) { try { healed = await ensureMyMembership(); } catch { /* fall through */ } }
      // Whether or not the heal RPCs reported success, ALWAYS re-fetch so isMember
      // reflects the real (possibly already-active) membership — the common case is a
      // freshly-activated account whose membership just hadn't loaded into context yet.
      await refreshProfile().catch(() => {});
      setHealState('exhausted');
    })();
  }, [needsHeal, healState, refreshProfile]);

  // If a membership arrives (heal worked, or it simply finished loading), clear any
  // exhausted heal state so a now-valid member is never stranded on the dead-end.
  useEffect(() => {
    if (isMember && healState !== 'idle') setHealState('idle');
  }, [isMember, healState]);

  if (loading) {
    return (
      <div className="min-h-screen bg-cream flex items-center justify-center">
        <p className="body-text text-muted">Loading…</p>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  if (requireSuperAdmin && !isSuperAdmin) {
    return <Navigate to="/app" replace />;
  }

  // grant-aware admin surface: admins pass; instructors pass only with a grant
  if (grantKey) {
    if (!isAdmin) {
      if (!isStaff) return <Navigate to="/app" replace />;
      if (grantState === 'idle' || grantState === 'checking') {
        return (
          <div className="min-h-screen bg-cream flex items-center justify-center">
            <p className="body-text text-muted">Loading…</p>
          </div>
        );
      }
      if (grantState === 'denied') return <Navigate to="/app" replace />;
    }
  } else if (requireAdmin && !isAdmin) {
    return <Navigate to="/app" replace />;
  }

  // Staff area: any operator (admin or trainer) may enter; a plain member cannot.
  if (requireStaff && !isStaff) {
    return <Navigate to="/app" replace />;
  }

  // Member-only areas: signed-in but without an active membership. We render an
  // inline notice rather than redirecting — the whole /app subtree (incl.
  // /app/account) is member-gated, so any Navigate here would loop into a blank
  // screen. This is the safety net for an account whose provisioning didn't
  // complete (e.g. a redeem that stamped no role); refreshing usually clears it.
  if (requireMember && !isMember) {
    // Still trying to auto-activate (redeem a pending invite / heal membership).
    if (healState !== 'exhausted') {
      return (
        <div className="min-h-screen bg-cream flex items-center justify-center px-6">
          <div className="max-w-md text-center">
            <p className="eyebrow mb-3">Almost there</p>
            <h1 className="heading-section text-green-800 mb-4">Activating your account…</h1>
            <p className="body-text">Just a moment while we finish setting you up.</p>
          </div>
        </div>
      );
    }
    // Genuinely nothing to redeem — be honest, and offer a real next step.
    return (
      <div className="min-h-screen bg-cream flex items-center justify-center px-6">
        <div className="max-w-md text-center">
          <p className="eyebrow mb-3">Almost there</p>
          <h1 className="heading-section text-green-800 mb-4">We couldn’t activate your account</h1>
          <p className="body-text mb-8">
            You’re signed in, but we couldn’t find an active invitation for <strong>{user.email}</strong>.
            If you were invited with a different email, sign out and sign in with that address — or ask
            whoever invited you to re-send it.
          </p>
          <div className="flex items-center justify-center gap-3">
            <button type="button"
              onClick={() => { void refreshProfile().catch(() => {}).finally(() => setHealState('idle')); }}
              className="btn-primary">Try again</button>
            <button type="button" onClick={() => { void signOut(); }} className="btn-secondary">Sign out</button>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
