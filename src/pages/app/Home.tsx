import { Navigate, useSearchParams } from 'react-router-dom';
import { useDocumentTitle } from '../../lib/hooks';
import { useViewSurfaces } from '../../lib/surfaces';
import { useAuth } from '../../contexts/AuthContext';
import { CommunityFeed } from '../../components/feed/CommunityFeed';
import { FEED_VIEW_META, FEED_VIEWS, type FeedView } from '../../lib/seed';

/**
 * COMMUNITY FEED (/app index) — the front door on sign-in. ONE stream of
 * categorized posts; the `?filter=` param picks which category shows. The nav
 * nests each filter under "Community Feed" as an indented link (→ /app?filter=…),
 * so each view reads like its own page while really just filtering this feed. The
 * URL is the source of truth: nav links, the in-page pills, and the header all
 * stay in sync through it. Deal/care-only members (no feed) redirect to their home.
 */
const isFeedView = (v: string | null): v is FeedView =>
  !!v && FEED_VIEWS.some((f) => f.key === v);

export default function Home() {
  const { surfaces, loading: surfacesLoading } = useViewSurfaces();
  const { isSuperAdmin } = useAuth();
  const [params] = useSearchParams();

  // URL is the source of truth for the active view — the nested nav links drive it.
  const view: FeedView = isFeedView(params.get('filter')) ? (params.get('filter') as FeedView) : 'all';
  const meta = FEED_VIEW_META[view];
  useDocumentTitle(view === 'all' ? 'Community Feed' : `${meta.title} · Community`);

  const hasFeed = surfaces.has_feed;

  // The PLATFORM operator belongs to no tenant — land on Organizations.
  if (isSuperAdmin) return <Navigate to="/app/ops/superadmin/organizations" replace />;

  // Deal/care-only members have their own purpose-built home (no community feed).
  if (!surfacesLoading && !hasFeed) {
    if (surfaces.surfaces.includes('deal_dashboard')) return <Navigate to="/app/deal" replace />;
    if (surfaces.surfaces.includes('care_dashboard')) return <Navigate to="/app/care" replace />;
    return <Navigate to="/app/dashboard" replace />;
  }

  return (
    <div>
      <header className="mb-4">
        <p className="eyebrow">Community Feed</p>
        <h1 className="font-serif text-green-800 text-3xl font-semibold mt-0.5">{meta.title}</h1>
        <p className="body-text text-secondary text-sm mt-1.5 max-w-2xl">{meta.description}</p>
      </header>

      <CommunityFeed view={view} />
    </div>
  );
}
