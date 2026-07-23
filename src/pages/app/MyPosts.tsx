import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Pencil, Trash2, Check, X, Globe, Lock } from 'lucide-react';
import { useDocumentTitle } from '../../lib/hooks';
import {
  feedMyPosts, feedPostUpdate, feedPostDelete,
  type MyFeedPost, type FeedVisibility,
} from '../../lib/feed';
import { FeedVideo } from '../../components/feed/FeedVideo';

/**
 * MY POSTS (/app/my-posts) — the poster manages their own community posts: review,
 * edit the text / link / who-can-see, or delete. Reached from Account → My posts.
 * Media and post type are fixed at creation (re-post to change those); this edits
 * the parts that make sense to change after the fact.
 */

const TYPE_LABEL: Record<string, string> = {
  rider_post: 'Post', horse: 'Horse listing', gear: 'Gear listing',
  event: 'Event', article: 'Article', marketing: 'Announcement', member_joined: 'Milestone',
};

const VIS_OPTIONS: { value: FeedVisibility; label: string }[] = [
  { value: 'members', label: 'Members only' },
  { value: 'public', label: 'Public' },
  { value: 'both', label: 'Members & public' },
];

function statusOf(p: MyFeedPost): { label: string; cls: string } {
  if (p.pulled_down) return { label: 'Removed by moderation', cls: 'bg-red-50 text-red-700' };
  if (!p.published) return { label: 'Draft', cls: 'bg-cream-100 text-muted' };
  if (p.publish_at && new Date(p.publish_at) > new Date()) return { label: 'Scheduled', cls: 'bg-gold-50 text-gold-ink' };
  return { label: 'Published', cls: 'bg-green-800/10 text-green-800' };
}

export default function MyPosts() {
  useDocumentTitle('My posts');
  const navigate = useNavigate();
  const [posts, setPosts] = useState<MyFeedPost[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    feedMyPosts().then(setPosts).catch(() => { setPosts([]); setError('Could not load your posts.'); });
  }, []);
  useEffect(load, [load]);

  return (
    <div className="max-w-3xl mx-auto">
      <button type="button" onClick={() => navigate('/app/account')}
        className="inline-flex items-center gap-1.5 text-sm text-green-700 hover:text-green-800 mb-3 focus-ring rounded">
        <ArrowLeft size={15} /> Account
      </button>
      <header className="mb-5">
        <p className="eyebrow">Community</p>
        <h1 className="font-serif text-green-800 text-3xl font-semibold mt-0.5">My posts</h1>
        <p className="body-text text-sm text-muted mt-1">Review, edit, or delete anything you’ve posted.</p>
      </header>

      {error && <p role="alert" className="form-error mb-3">{error}</p>}

      {posts === null ? (
        <p className="body-text text-muted text-sm">Loading…</p>
      ) : posts.length === 0 ? (
        <div className="text-center py-16 bg-white border border-green-800/10 rounded-xl">
          <p className="font-serif text-lg text-green-800 mb-1">You haven’t posted yet.</p>
          <p className="body-text text-sm text-muted">Anything you share with the community will show up here.</p>
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {posts.map((p) => (
            <PostRow key={p.id} post={p}
              editing={editing === p.id}
              busy={busy}
              onStartEdit={() => setEditing(p.id)}
              onCancelEdit={() => setEditing(null)}
              onSaved={() => { setEditing(null); load(); }}
              onDeleted={() => load()}
              setBusy={setBusy} setError={setError} />
          ))}
        </ul>
      )}
    </div>
  );
}

function PostRow({
  post, editing, busy, onStartEdit, onCancelEdit, onSaved, onDeleted, setBusy, setError,
}: {
  post: MyFeedPost;
  editing: boolean;
  busy: boolean;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onSaved: () => void;
  onDeleted: () => void;
  setBusy: (b: boolean) => void;
  setError: (s: string | null) => void;
}) {
  const [body, setBody] = useState(post.body ?? '');
  const [link, setLink] = useState(post.source_link ?? '');
  const [visibility, setVisibility] = useState<FeedVisibility>(post.visibility);
  const status = statusOf(post);

  // keep local drafts in sync if the row re-renders from a fresh load
  useEffect(() => {
    if (!editing) { setBody(post.body ?? ''); setLink(post.source_link ?? ''); setVisibility(post.visibility); }
  }, [editing, post.body, post.source_link, post.visibility]);

  async function save() {
    setBusy(true); setError(null);
    try {
      await feedPostUpdate(post.id, { body: body.trim() || null, source_link: link.trim() || null, visibility });
      onSaved();
    } catch {
      setError('Could not save your changes.');
    } finally { setBusy(false); }
  }
  async function remove() {
    if (!window.confirm('Delete this post? This can’t be undone.')) return;
    setBusy(true); setError(null);
    try { await feedPostDelete(post.id); onDeleted(); }
    catch { setError('Could not delete the post.'); }
    finally { setBusy(false); }
  }

  return (
    <li className="bg-white border border-green-800/10 rounded-xl overflow-hidden">
      <div className="flex gap-4 p-4">
        {/* media thumbnail */}
        {post.media_url && (
          <div className="w-24 h-24 shrink-0 rounded-lg overflow-hidden bg-gradient-to-br from-green-50 to-gold-50">
            {post.media_kind === 'video'
              ? <FeedVideo src={post.media_url} mode="card" className="w-full h-full" />
              : <img src={post.media_url} alt="" className="w-full h-full object-cover" />}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] uppercase tracking-wide text-gold-800 font-semibold">{TYPE_LABEL[post.post_type] ?? 'Post'}</span>
            <span className={`text-[10px] px-2 py-0.5 rounded-full ${status.cls}`}>{status.label}</span>
            <span className="text-[11px] text-muted ml-auto">{new Date(post.created_at).toLocaleDateString()}</span>
          </div>

          {editing ? (
            <div className="flex flex-col gap-2.5 mt-1">
              <textarea className="form-input min-h-[70px]" value={body} placeholder="Write something…"
                onChange={(e) => setBody(e.target.value)} />
              <input className="form-input" value={link} placeholder="Optional link"
                onChange={(e) => setLink(e.target.value)} />
              <div className="flex items-center gap-2 flex-wrap">
                <label className="text-[12px] text-muted">Who can see this:</label>
                <select className="form-input py-1.5" value={visibility}
                  onChange={(e) => setVisibility(e.target.value as FeedVisibility)}>
                  {VIS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div className="flex gap-2">
                <button type="button" className="btn-primary text-sm" disabled={busy} onClick={() => void save()}>
                  <Check size={15} /> Save
                </button>
                <button type="button" className="btn-secondary text-sm" disabled={busy} onClick={onCancelEdit}>
                  <X size={15} /> Cancel
                </button>
              </div>
            </div>
          ) : (
            <>
              {post.body
                ? <p className="text-[13px] text-secondary leading-relaxed line-clamp-3 whitespace-pre-line">{post.body}</p>
                : <p className="text-[13px] text-muted italic">No caption</p>}
              <div className="flex items-center gap-3 mt-2 text-[11px] text-muted">
                <span className="inline-flex items-center gap-1">
                  {post.visibility === 'members' ? <Lock size={12} /> : <Globe size={12} />}
                  {VIS_OPTIONS.find((v) => v.value === post.visibility)?.label ?? post.visibility}
                </span>
                {post.as_company && <span className="text-gold-800 font-medium">Posted as French Heritage Equestrian</span>}
              </div>
              <div className="flex gap-2 mt-3">
                <button type="button" className="btn-secondary text-xs" disabled={busy} onClick={onStartEdit}>
                  <Pencil size={13} /> Edit
                </button>
                <button type="button"
                  className="text-xs text-red-700 hover:bg-red-50 rounded-lg px-3 py-1.5 focus-ring inline-flex items-center gap-1.5"
                  disabled={busy} onClick={() => void remove()}>
                  <Trash2 size={13} /> Delete
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </li>
  );
}
