import { useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { Store, ExternalLink, ArrowLeft } from 'lucide-react';
import { useDocumentTitle } from '../../lib/hooks';
import { useViewSurfaces } from '../../lib/surfaces';
import { feedGet, type FeedPost } from '../../lib/feed';

/**
 * MARKET (Slice 4, /app/community/market) — the Market filter over the feed: the
 * horse + gear posts, the things members are sharing to buy/sell/pass along. Same
 * feed data, narrowed to the two commerce post types. Riding-gated (community).
 */
const MARKET_TYPES: FeedPost['post_type'][] = ['horse', 'gear'];

export default function Market() {
  useDocumentTitle('Market');
  const { surfaces, loading: sLoading } = useViewSurfaces();
  const [posts, setPosts] = useState<FeedPost[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    feedGet(100)
      .then((r) => setPosts(r.posts.filter((p) => MARKET_TYPES.includes(p.post_type))))
      .catch(() => setError('Could not load the market.'));
  }, []);

  if (!sLoading && !surfaces.has_community) return <Navigate to="/app" replace />;

  return (
    <div className="max-w-3xl">
      <Link to="/app/community" className="inline-flex items-center gap-1 text-sm text-muted mb-4">
        <ArrowLeft size={14} /> Community
      </Link>
      <p className="eyebrow mb-2">Market</p>
      <h1 className="heading-section text-green-800 mb-6 flex items-center gap-2">
        <Store size={22} /> Horses &amp; gear.
      </h1>

      {error && <p role="alert" className="form-error mb-4">{error}</p>}
      {posts === null && !error && <p className="body-text text-muted text-sm">Loading…</p>}
      {posts?.length === 0 && (
        <p className="body-text text-muted text-sm">Nothing in the market right now.</p>
      )}

      <div className="grid sm:grid-cols-2 gap-4">
        {posts?.map((p) => (
          <div key={p.id} className="bg-white border border-green-800/10 rounded-lg overflow-hidden">
            {p.media_kind === 'video' ? (
              <video src={p.media_url} controls className="w-full aspect-square object-cover bg-black/5" />
            ) : (
              <img src={p.media_url} alt="" className="w-full aspect-square object-cover bg-black/5" loading="lazy" />
            )}
            <div className="p-3">
              <span className="text-xs font-sans uppercase tracking-wide text-gold-ink">{p.post_type}</span>
              {p.body && <p className="body-text text-sm text-green-900 mt-1 line-clamp-3">{p.body}</p>}
              {p.source_link && (
                <a href={p.source_link} target="_blank" rel="noopener noreferrer"
                   className="mt-2 inline-flex items-center gap-1 text-xs text-gold-ink font-sans">
                  <ExternalLink size={12} /> Details
                </a>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
