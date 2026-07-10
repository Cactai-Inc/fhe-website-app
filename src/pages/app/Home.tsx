import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useDocumentTitle } from '../../lib/hooks';
import { useViewSurfaces } from '../../lib/surfaces';
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
  useDocumentTitle('Your Dashboard');
  const { surfaces, loading: surfacesLoading } = useViewSurfaces();
  const [view, setView] = useState<FeedView>('all');
  const [sort, setSort] = useState<string>(SORT_OPTIONS.all[0]);

  const hasFeed = surfaces.has_feed;

  function pickView(v: FeedView) {
    setView(v);
    setSort((SORT_OPTIONS[v] ?? SORT_OPTIONS.all)[0]); // reset sort to the view's default
  }

  // Non-rider (deal/care only) members have no feed — send them to their dashboard.
  if (!surfacesLoading && !hasFeed) {
    if (surfaces.surfaces.includes('deal_dashboard')) return <Navigate to="/app/deal" replace />;
    if (surfaces.surfaces.includes('care_dashboard')) return <Navigate to="/app/care" replace />;
    return <Navigate to="/app/dashboard" replace />;
  }

  return (
    <div>
      <header className="mb-4">
        <p className="eyebrow">Good afternoon, Claire</p>
        <h1 className="font-serif text-green-800 text-3xl font-semibold mt-0.5">Your Dashboard</h1>
      </header>

      <DashboardPanel />

      <div className="pt-1.5 border-t border-green-800/10 mb-4">
        <h2 className="font-serif text-green-800 text-xl font-semibold pt-3.5">Your Community</h2>
      </div>

      <FeedControls view={view} sort={sort} onView={pickView} onSort={setSort} />

      <CommunityFeed view={view} />
    </div>
  );
}
