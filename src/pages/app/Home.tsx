import { useCallback, useEffect, useRef, useState } from 'react';
import { ExternalLink, Heart, Share2, MessageCircle, Plus, X, Calendar } from 'lucide-react';
import { useDocumentTitle } from '../../lib/hooks';
import {
  feedGet, feedMarkSeen, feedSetViewShape, feedShare, feedReportPost,
  type FeedResult, type FeedPost, type FeedAccountItem, type FeedViewShape,
} from '../../lib/feed';
import { FeedComposer } from '../../components/feed/FeedComposer';

/**
 * HOME — the app's home feed (Slice 3, replaces the old Dashboard as /app index).
 * A feed you open out of desire: pinned nothing but the stream + account cards.
 * View shapes (blended / grouped-pockets / separate), seen-position aware, with
 * the three gestures (ask / share / engage) on each post.
 */

const VIEW_LABELS: Record<FeedViewShape, string> = {
  blended: 'Blended',
  pockets: 'Pockets',
  separate: 'By type',
};

/** The "engage our service" target by post type (spec: horse → evaluation front door). */
function engageLabel(type: FeedPost['post_type']): string | null {
  switch (type) {
    case 'horse': return 'Request an evaluation';
    case 'gear': return 'Ask about this';
    default: return null;
  }
}

function PostCard({
  post, onSeen, onAsk, onShare, onReport,
}: {
  post: FeedPost;
  onSeen: (id: string) => void;
  onAsk: (post: FeedPost) => void;
  onShare: (post: FeedPost) => void;
  onReport: (post: FeedPost) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const ref = useRef<HTMLElement | null>(null);

  // Mark seen when the card scrolls into view (seen-position scroll).
  useEffect(() => {
    if (post.seen || !ref.current) return;
    const el = ref.current;
    const obs = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) { onSeen(post.id); obs.disconnect(); }
    }, { threshold: 0.5 });
    obs.observe(el);
    return () => obs.disconnect();
  }, [post.id, post.seen, onSeen]);

  const engage = engageLabel(post.post_type);

  return (
    <article ref={ref} className="bg-white border border-green-800/10 rounded-lg overflow-hidden mb-5">
      {post.shared_by && (
        <p className="px-4 pt-3 text-xs text-muted font-sans">Shared by {post.shared_by}</p>
      )}
      <div className="relative bg-green-900/5">
        {post.media_kind === 'video' ? (
          <video src={post.media_url} controls className="w-full max-h-[70vh] object-contain" />
        ) : (
          <img src={post.media_url} alt="" className="w-full max-h-[70vh] object-contain" loading="lazy" />
        )}
      </div>

      {post.body && (
        <div className="px-4 pt-3">
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="text-left text-sm text-green-900 body-text w-full"
          >
            <span className={expanded ? '' : 'line-clamp-2'}>{post.body}</span>
            {!expanded && post.body.length > 120 && <span className="text-gold-ink"> more</span>}
          </button>
        </div>
      )}

      {post.source_link && (
        <a href={post.source_link} target="_blank" rel="noopener noreferrer"
           className="px-4 pt-2 inline-flex items-center gap-1 text-xs text-gold-ink font-sans">
          <ExternalLink size={12} /> View source
        </a>
      )}

      <div className="px-4 py-3 flex flex-wrap items-center gap-4 text-sm font-sans">
        <button type="button" onClick={() => onAsk(post)} className="inline-flex items-center gap-1.5 text-secondary hover:text-green-800">
          <MessageCircle size={16} /> Ask
        </button>
        <button type="button" onClick={() => onShare(post)} className="inline-flex items-center gap-1.5 text-secondary hover:text-green-800">
          <Share2 size={16} /> Share
        </button>
        {engage && (
          <button type="button" onClick={() => onAsk(post)} className="inline-flex items-center gap-1.5 text-gold-ink hover:text-green-800 font-medium">
            <Heart size={16} /> {engage}
          </button>
        )}
        <button type="button" onClick={() => onReport(post)} className="ml-auto text-xs text-muted hover:text-red-700">
          Report
        </button>
      </div>
    </article>
  );
}

function AccountCard({ item }: { item: FeedAccountItem }) {
  return (
    <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-5">
      {item.title && <p className="font-serif text-green-800 mb-1">{item.title}</p>}
      {item.body && <p className="body-text text-sm text-green-900">{item.body}</p>}
      {typeof item.payload?.calendar_url === 'string' && (
        <a href={item.payload.calendar_url as string} className="inline-flex items-center gap-1 text-xs text-gold-ink font-sans mt-2">
          <Calendar size={12} /> Add to calendar
        </a>
      )}
    </div>
  );
}

export default function Home() {
  useDocumentTitle('Home');
  const [feed, setFeed] = useState<FeedResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [composing, setComposing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setFeed(await feedGet());
      setError(null);
    } catch {
      setError('We could not load your feed. Pull to refresh or try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const markSeen = useCallback((id: string) => { feedMarkSeen(id).catch(() => {}); }, []);

  async function setShape(shape: FeedViewShape) {
    if (!feed) return;
    setFeed({ ...feed, shape });
    feedSetViewShape(shape).catch(() => {});
  }

  function onAsk(post: FeedPost) {
    // Ask carries the item into messaging (contextual). Route to messages with the post attached.
    window.location.assign(`/app/messages?about=${post.id}`);
  }
  async function onShare(post: FeedPost) {
    const to = window.prompt('Share to which rider? (enter their member id for now)');
    if (to) { try { await feedShare(post.id, to); } catch { /* ignore */ } }
  }
  async function onReport(post: FeedPost) {
    const reason = window.prompt('Tell us what’s wrong with this post:');
    if (reason) { try { await feedReportPost(post.id, reason); } catch { /* ignore */ } }
  }

  const posts = feed?.posts ?? [];
  const accountItems = feed?.account_items ?? [];

  // View-shape rendering: blended = chronological mix; pockets/separate = grouped by type.
  const grouped = (() => {
    if (!feed || feed.shape === 'blended') return null;
    const by = new Map<string, FeedPost[]>();
    for (const p of posts) { const k = p.post_type; (by.get(k) ?? by.set(k, []).get(k)!).push(p); }
    return by;
  })();

  return (
    <div className="max-w-xl mx-auto">
      {/* view-shape switcher */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex gap-1 text-xs font-sans">
          {(['blended', 'pockets', 'separate'] as FeedViewShape[]).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setShape(s)}
              className={`px-3 py-1.5 rounded-full border ${
                feed?.shape === s ? 'bg-green-800 text-white border-green-800' : 'border-green-800/20 text-secondary'
              }`}
            >
              {VIEW_LABELS[s]}
            </button>
          ))}
        </div>
        <button type="button" onClick={() => setComposing(true)} className="btn-primary text-sm">
          <Plus size={16} /> Post
        </button>
      </div>

      {/* account cards (welcome / orientation / purchase / reminders) pinned above the stream */}
      {accountItems.map((it) => <AccountCard key={it.id} item={it} />)}

      {loading && <p className="body-text text-muted text-sm">Loading your feed…</p>}
      {error && <p role="alert" className="form-error">{error}</p>}

      {!loading && posts.length === 0 && accountItems.length === 0 && (
        <div className="text-center py-16">
          <p className="font-serif text-lg text-green-800 mb-2">Your feed is just getting started.</p>
          <p className="body-text text-sm text-muted mb-4">New horses, gear, and moments from the barn will appear here.</p>
          <button type="button" onClick={() => setComposing(true)} className="btn-outline-gold text-sm">
            Share the first post
          </button>
        </div>
      )}

      {/* stream */}
      {feed?.shape !== 'blended' && grouped
        ? Array.from(grouped.entries()).map(([type, group]) => (
            <section key={type} className="mb-6">
              <h2 className="eyebrow mb-2">{type.replace('_', ' ')}</h2>
              {group.map((p) => (
                <PostCard key={p.id} post={p} onSeen={markSeen} onAsk={onAsk} onShare={onShare} onReport={onReport} />
              ))}
            </section>
          ))
        : posts.map((p) => (
            <PostCard key={p.id} post={p} onSeen={markSeen} onAsk={onAsk} onShare={onShare} onReport={onReport} />
          ))}

      {composing && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-cream w-full sm:max-w-lg sm:rounded-lg max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b border-green-800/10">
              <h2 className="font-serif text-green-800">New post</h2>
              <button type="button" onClick={() => setComposing(false)} aria-label="Close"><X size={20} /></button>
            </div>
            <div className="p-4">
              <FeedComposer onPosted={() => { setComposing(false); load(); }} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
