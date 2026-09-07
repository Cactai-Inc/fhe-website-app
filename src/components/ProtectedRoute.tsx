import { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { fetchMyGrantKeys } from '../lib/grants';
import { redeemMyPendingInvitation, ensureMyMemberAccess } from '../lib/api';
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
  const { user, isAdmin, isStaff, isSuperAdmin, isMember, loading, refreshProfile } = useAuth();
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
      if (!healed) { try { healed = await ensureMyMemberAccess(); } catch { /* fall through */ } }
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

  /* Member-only areas: signed in, but no membership yet.
     ⚠️ THERE IS NO DEAD END HERE ANY MORE (owner, 2026-09-06, CR-124).
     This used to render "We couldn’t activate your account" — a page that told a
     visitor their account could not be activated and then offered them nothing
     but Try again / Sign out. It reached real people: logan.tufty@gmail.com hit
     it twice tonight with an auth user and no contact, profile, invitation or
     client row — i.e. someone who simply signed in without ever being invited.
     Owner: "there is no such thing as we are activating your account... if this
     is a person who doesnt have an account the solution is to take them to the
     main page for the /sign url and let them pick which applies to them."
     So: no notice, no lie, no manual step. Somebody signed in with nothing to
     enter is sent to the public chooser, where picking a door creates the
     account and emails the activation link — the self-serve path that already
     exists. `/sign` is a public route outside this guard, so this cannot loop. */
  if (requireMember && !isMember) {
    // A pending invitation may still be redeeming; that path lands them inside.
    // Neutral wording only — same idiom as the grant check above.
    if (healState !== 'exhausted') {
      return (
        <div className="min-h-screen bg-cream flex items-center justify-center">
          <p className="body-text text-muted">Loading…</p>
        </div>
      );
    }
    return <Navigate to="/sign" replace />;
  }

  return <>{children}</>;
}
