import { Navigate, useSearchParams } from 'react-router-dom';
import { useDocumentTitle } from '../../lib/hooks';
import { useViewSurfaces } from '../../lib/surfaces';
import { useAuth } from '../../contexts/AuthContext';
import { CommunityFeed } from '../../components/feed/CommunityFeed';
import { FEED_VIEW_META, FEED_VIEWS, type FeedView } from '../../lib/seed';
import { PageCreateButton } from '../../components/app/PageCreateButton';
import { useCreateModalTrigger } from '../../contexts/CreateModalContext';

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
  const { surfaces } = useViewSurfaces();
  const { isSuperAdmin } = useAuth();
  const [params] = useSearchParams();
  const createModal = useCreateModalTrigger();

  // URL is the source of truth for the active view — the nested nav links drive it.
  const view: FeedView = isFeedView(params.get('filter')) ? (params.get('filter') as FeedView) : 'all';
  const meta = FEED_VIEW_META[view];
  useDocumentTitle(view === 'all' ? 'Community Feed' : `${meta.title} · Community`);

  const hasFeed = surfaces.has_feed;

  // The PLATFORM operator belongs to no tenant — land on Organizations.
  if (isSuperAdmin) return <Navigate to="/app/ops/superadmin/organizations" replace />;

  /* ⚠️ THE REDIRECT AWAY FROM THE FEED IS GONE (owner, 2026-08-24: "Everyone gets
     the feed remove the guard").

     This sent anyone without a 'riding' category to /app/deal, /app/care or the
     dashboard — and since `has_feed` required a rider PURCHASE, that included a
     rider who had signed all four releases and simply not bought a lesson yet.
     Both halves of what the owner reported were this one line: "it takes me to
     the dashboard" and "the community feed isnt even accessible" are the same
     redirect seen from two directions.

     D8 already said so: "Community access is gated by ACCOUNT, not documents —
     any account holder views and participates." `my_view_surfaces` now grants
     feed + community to every member, so this could only ever be dead code; it is
     removed rather than left to read as though it still guards something.

     Deal and care members keep their purpose-built dashboards — they are in the
     nav and reachable directly. What they no longer do is get bounced out of the
     community to reach them. */

  return (
    <div>
      {/* Title model (owner spec 2026-08-05): small gold eyebrow is the view's
          title; the large dark-green line is an optional per-page intro, only
          shown on the default/all view ("Welcome new members!"), not a repeat
          of the title. Filtered views keep their own eyebrow + description. */}
      <header className="mb-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="eyebrow">{meta.title}</p>
            {view === 'all' ? (
              <h1 className="font-serif text-green-800 text-3xl font-semibold mt-0.5">Welcome new members!</h1>
            ) : null}
          </div>
          {hasFeed && createModal && (
            <PageCreateButton label="Post" onClick={() => createModal.openCreate('post_type')} />
          )}
        </div>
        {view === 'all' ? (
          <p className="body-text text-secondary text-sm mt-1.5 max-w-2xl">
            This is a space to share your experiences at the ranch, links you find helpful, events you
            hear about, and ads for tack or gear you no longer use that others may need.
          </p>
        ) : (
          <p className="body-text text-secondary text-sm mt-1.5 max-w-2xl">{meta.description}</p>
        )}
      </header>

      <CommunityFeed view={view} />
    </div>
  );
}
