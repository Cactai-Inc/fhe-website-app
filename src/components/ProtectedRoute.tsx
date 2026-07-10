import { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { fetchMyGrantKeys } from '../lib/grants';
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
  const { user, isAdmin, isStaff, isSuperAdmin, isMember, loading } = useAuth();
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
    return <Navigate to="/account" replace />;
  }

  // Staff area: any operator (admin or trainer) may enter; a plain member cannot.
  if (requireStaff && !isStaff) {
    return <Navigate to="/app" replace />;
  }

  // Member-only areas: signed-in but without an active membership → account page,
  // where a "your membership isn't active yet" note lives.
  if (requireMember && !isMember) {
    return <Navigate to="/account" replace state={{ needsMembership: true }} />;
  }

  return <>{children}</>;
}
