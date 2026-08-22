import { Navigate } from 'react-router-dom';
import { useDocumentTitle } from '../../lib/hooks';
import { useViewSurfaces } from '../../lib/surfaces';
import { useAuth } from '../../contexts/AuthContext';
import { DashboardPanel } from '../../components/app/DashboardPanel';
import OwnerDashboard from './ops/OwnerDashboard';
import { timeOfDayWord } from '../../lib/formatDateTime';

/**
 * DASHBOARD (/app/dashboard) — priority actions + coming up. Split out from the
 * community front door: this is where a member's notifications and to-dos live.
 * Deal/care-only members keep their purpose-built homes.
 *
 * TASK-DASHBOARDBUILD (2026-08-22): STAFF GET THE OWNER DASHBOARD HERE, at the
 * route that already carries the first nav row and the notification badge —
 * rather than at a second address beside it. D26 makes the dashboard the landing
 * surface for the two owners; DASHBOARDS-GROUND-UP-PLAN §7 makes it their only
 * one. `/app/ops` (the 2026-07-01 OpsDashboard) is left routed and untouched,
 * with no nav row — retiring it into this shell is named in the report as the
 * remaining half of that plan item, not silently done here.
 *
 * The platform owner (`admin@cactai.io`) never reaches either view: D1a says it
 * is not a tenant identity, and the SUPER_ADMIN redirect below fires first.
 */
const DAYPART_LABEL: Record<ReturnType<typeof timeOfDayWord>, string> = {
  morning: 'Morning',
  afternoon: 'Afternoon',
  evening: 'Evening',
  night: 'Evening', // greeting has no "night" bucket — falls back to Evening
};

export default function DashboardHome() {
  const { surfaces, loading: surfacesLoading } = useViewSurfaces();
  const { profile, isSuperAdmin, isStaff } = useAuth();
  useDocumentTitle('Dashboard');
  const firstName = profile?.first_name || profile?.display_name || null;
  const daypart = DAYPART_LABEL[timeOfDayWord()];

  if (isSuperAdmin) return <Navigate to="/app/ops/superadmin/organizations" replace />;

  // Staff land on the owner dashboard — the two-view board, its toggle, and the
  // zones. Members keep the priority-actions panel below.
  if (isStaff) return <OwnerDashboard />;

  // Deal/care members have their own purpose-built dashboard.
  if (!surfacesLoading && !surfaces.has_feed) {
    if (surfaces.surfaces.includes('deal_dashboard')) return <Navigate to="/app/deal" replace />;
    if (surfaces.surfaces.includes('care_dashboard')) return <Navigate to="/app/care" replace />;
  }

  return (
    <div>
      <header className="mb-4">
        <p className="eyebrow">Dashboard</p>
        <h1 className="font-serif text-green-800 text-3xl font-semibold mt-0.5">
          Good {daypart}{firstName ? `, ${firstName}` : ''}
        </h1>
      </header>
      <DashboardPanel />
    </div>
  );
}
