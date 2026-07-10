import { useEffect, useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Lock } from 'lucide-react';
import { fetchThread, replyToThread } from '../../lib/community';
import { useDocumentTitle } from '../../lib/hooks';
import type { Thread, ThreadPost } from '../../lib/community-types';

function name(a?: { display_name: string | null; first_name: string | null }): string {
  return a?.display_name || a?.first_name || 'Member';
}

export default function ThreadDetail() {
  useDocumentTitle('Thread');
  const { id } = useParams<{ id: string }>();
  const [thread, setThread] = useState<Thread | null>(null);
  const [posts, setPosts] = useState<ThreadPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [reply, setReply] = useState('');
  const [posting, setPosting] = useState(false);

  const load = useCallback(() => {
    if (!id) return;
    fetchThread(id).then(({ thread, posts }) => { setThread(thread); setPosts(posts); })
      .catch(() => setThread(null)).finally(() => setLoading(false));
  }, [id]);
  useEffect(load, [load]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!reply.trim() || !id) return;
    setPosting(true);
    try {
      await replyToThread(id, reply.trim());
      setReply('');
      load();
    } finally {
      setPosting(false);
    }
  }

  if (loading) return <p className="body-text text-muted">Loading…</p>;
  if (!thread) {
    return (
      <div className="max-w-2xl">
        <h1 className="heading-section text-green-800 mb-4">Thread not found</h1>
        <Link to="/app?filter=discussions" className="link-underline">Back to discussions</Link>
      </div>
    );
  }

  return (
    <div className="max-w-2xl">
      <Link to="/app?filter=discussions" className="inline-flex items-center gap-2 text-sm text-secondary hover:text-green-800 mb-6 focus-ring">
        <ArrowLeft size={16} /> Back to discussions
      </Link>

      <h1 className="heading-section text-green-800 mb-2">{thread.title}</h1>
      <p className="text-xs text-muted mb-6">
        {name(thread.author)} · {new Date(thread.created_at).toLocaleDateString()}
      </p>

      {/* Opening post */}
      <div className="bg-white border border-green-800/10 p-6 mb-6">
        <p className="body-text text-sm whitespace-pre-line">{thread.body}</p>
      </div>

      {/* Replies */}
      <div className="flex flex-col gap-4 mb-8">
        {posts.map((p) => (
          <div key={p.id} className="bg-cream-50 border border-green-800/10 p-5">
            <p className="text-xs text-muted mb-1.5">{name(p.author)} · {new Date(p.created_at).toLocaleString()}</p>
            <p className="body-text text-sm whitespace-pre-line">{p.body}</p>
          </div>
        ))}
      </div>

      {thread.locked ? (
        <p className="text-sm text-muted inline-flex items-center gap-2">
          <Lock size={14} aria-hidden="true" /> This thread is locked.
        </p>
      ) : (
        <form onSubmit={submit} className="bg-white border border-green-800/10 p-5">
          <label className="form-label" htmlFor="reply">Add a reply</label>
          <textarea id="reply" rows={3} className="form-input resize-none mb-3" value={reply}
            onChange={(e) => setReply(e.target.value)} placeholder="Share your thoughts…" />
          <button type="submit" disabled={posting || !reply.trim()} className="btn-primary">
            {posting ? 'Posting…' : 'Reply'}
          </button>
        </form>
      )}
    </div>
  );
}
