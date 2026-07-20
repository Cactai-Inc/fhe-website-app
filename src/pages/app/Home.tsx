import { useState } from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';
import { useDocumentTitle } from '../../lib/hooks';
import { useViewSurfaces } from '../../lib/surfaces';
import { useAuth } from '../../contexts/AuthContext';
import { FeedControls } from '../../components/feed/FeedControls';
import { CommunityFeed } from '../../components/feed/CommunityFeed';
import { SORT_OPTIONS, type FeedView } from '../../lib/seed';

/**
 * COMMUNITY (/app index) — the front door on sign-in for riders, instructors, and
 * admins: the full filterable feed with the View/Sort dropdowns. The dashboard
 * (priority actions + coming up) now lives on its own page at /app/dashboard.
 * Deal/care-only members (no feed surface) are redirected to their purpose-built
 * home, preserving the purchase-driven view model.
 */
export default function Home() {
  const { surfaces, loading: surfacesLoading } = useViewSurfaces();
  const { profile, isStaff, isSuperAdmin } = useAuth();
  useDocumentTitle('Community');
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

  // Deal/care-only members have their own purpose-built home (no community feed).
  if (!surfacesLoading && !hasFeed) {
    if (surfaces.surfaces.includes('deal_dashboard')) return <Navigate to="/app/deal" replace />;
    if (surfaces.surfaces.includes('care_dashboard')) return <Navigate to="/app/care" replace />;
    // A member with no category lands on the dashboard (where their notifications
    // and priority actions live) rather than an empty community feed.
    return <Navigate to="/app/dashboard" replace />;
  }

  return (
    <div>
      <header className="mb-4">
        <p className="eyebrow">Good {daypart}{firstName ? `, ${firstName}` : ''}</p>
        <h1 className="font-serif text-green-800 text-3xl font-semibold mt-0.5">
          {isStaff ? 'Community' : 'Your Community'}
        </h1>
      </header>

      <FeedControls view={view} sort={sort} onView={pickView} onSort={setSort} />

      <CommunityFeed view={view} />
    </div>
  );
}
