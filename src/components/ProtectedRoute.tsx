import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

/** Gates a route behind authentication. Redirects unauthenticated visitors to
 *  /login (preserving where they were headed). Optionally requires admin or an
 *  active membership. */
export default function ProtectedRoute({
  children,
  requireAdmin = false,
  requireMember = false,
}: {
  children: React.ReactNode;
  requireAdmin?: boolean;
  requireMember?: boolean;
}) {
  const { user, isAdmin, isMember, loading } = useAuth();
  const location = useLocation();

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

  if (requireAdmin && !isAdmin) {
    return <Navigate to="/account" replace />;
  }

  // Member-only areas: signed-in but without an active membership → account page,
  // where a "your membership isn't active yet" note lives.
  if (requireMember && !isMember) {
    return <Navigate to="/account" replace state={{ needsMembership: true }} />;
  }

  return <>{children}</>;
}
