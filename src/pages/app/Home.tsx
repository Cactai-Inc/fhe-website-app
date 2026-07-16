import { useState } from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';
import { useDocumentTitle } from '../../lib/hooks';
import { useViewSurfaces } from '../../lib/surfaces';
import { useAuth } from '../../contexts/AuthContext';
import { DashboardPanel } from '../../components/app/DashboardPanel';
import { FeedControls } from '../../components/feed/FeedControls';
import { CommunityFeed } from '../../components/feed/CommunityFeed';
import { SORT_OPTIONS, type FeedView } from '../../lib/seed';

/**
 * MAIN PAGE (/app index) — the shared landing for riders, instructors, and admins.
 * Top: the dashboard panel (priority actions + coming up). Below: "Your Community"
 * = the full filterable feed with the View/Sort dropdowns and per-view adaptive
 * layouts. Deal/care-only members (no feed surface) are redirected to their
 * purpose-built dashboard, preserving the purchase-driven view model.
 */
export default function Home() {
  const { surfaces, loading: surfacesLoading } = useViewSurfaces();
  const { profile, isStaff, isSuperAdmin } = useAuth();
  // Riders get no page name — this IS the app. Staff see their Dashboard.
  useDocumentTitle(isStaff ? 'Dashboard' : 'French Heritage');
  const firstName = profile?.first_name || profile?.display_name || null;
  const hour = new Date().getHours();
  const daypart = hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening';
  const [params] = useSearchParams();
  const initialFilter = (params.get('filter') as FeedView | null) ?? 'all';
  const [view, setView] = useState<FeedView>(initialFilter);
  const [sort, setSort] = useState<string>((SORT_OPTIONS[initialFilter] ?? SORT_OPTIONS.all)[0]);

  const hasFeed = surfaces.has_feed;

  function pickView(v: FeedView) {
    setView(v);
    setSort((SORT_OPTIONS[v] ?? SORT_OPTIONS.all)[0]); // reset sort to the view's default
  }

  // The PLATFORM operator belongs to no tenant — land on Organizations.
  if (isSuperAdmin) return <Navigate to="/app/ops/superadmin/organizations" replace />;

  // Deal/care-only members have their own purpose-built home.
  if (!surfacesLoading && !hasFeed) {
    if (surfaces.surfaces.includes('deal_dashboard')) return <Navigate to="/app/deal" replace />;
    if (surfaces.surfaces.includes('care_dashboard')) return <Navigate to="/app/care" replace />;
    // Everyone gets a dashboard (it's where notifications live). A member with no
    // category still lands here — the priority-actions panel, minus the community
    // feed — instead of being bounced to Account in a redirect loop.
    return (
      <div>
        <header className="mb-4">
          <p className="eyebrow">Good {daypart}{firstName ? `, ${firstName}` : ''}</p>
        </header>
        <DashboardPanel />
      </div>
    );
  }

  return (
    <div>
      <header className="mb-4">
        <p className="eyebrow">Good {daypart}{firstName ? `, ${firstName}` : ''}</p>
        {isStaff && (
          <h1 className="font-serif text-green-800 text-3xl font-semibold mt-0.5">Dashboard</h1>
        )}
      </header>

      <DashboardPanel />

      <div className="pt-1.5 border-t border-green-800/10 mb-4">
        <h2 className="font-serif text-green-800 text-2xl font-semibold pt-3.5">Your Community</h2>
      </div>

      <FeedControls view={view} sort={sort} onView={pickView} onSort={setSort} />

      <CommunityFeed view={view} />
    </div>
  );
}
