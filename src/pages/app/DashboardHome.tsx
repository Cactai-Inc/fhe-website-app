import { Navigate } from 'react-router-dom';
import { useDocumentTitle } from '../../lib/hooks';
import { useViewSurfaces } from '../../lib/surfaces';
import { useAuth } from '../../contexts/AuthContext';
import { DashboardPanel } from '../../components/app/DashboardPanel';

/**
 * DASHBOARD (/app/dashboard) — priority actions + coming up. Split out from the
 * community front door: this is where a member's notifications and to-dos live.
 * Deal/care-only members keep their purpose-built homes.
 */
export default function DashboardHome() {
  const { surfaces, loading: surfacesLoading } = useViewSurfaces();
  const { profile, isSuperAdmin } = useAuth();
  useDocumentTitle('Dashboard');
  const firstName = profile?.first_name || profile?.display_name || null;
  const hour = new Date().getHours();
  const daypart = hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening';

  if (isSuperAdmin) return <Navigate to="/app/ops/superadmin/organizations" replace />;

  // Deal/care members have their own purpose-built dashboard.
  if (!surfacesLoading && !surfaces.has_feed) {
    if (surfaces.surfaces.includes('deal_dashboard')) return <Navigate to="/app/deal" replace />;
    if (surfaces.surfaces.includes('care_dashboard')) return <Navigate to="/app/care" replace />;
  }

  return (
    <div>
      <header className="mb-4">
        <p className="eyebrow">Good {daypart}{firstName ? `, ${firstName}` : ''}</p>
        <h1 className="font-serif text-green-800 text-3xl font-semibold mt-0.5">Dashboard</h1>
      </header>
      <DashboardPanel />
    </div>
  );
}
