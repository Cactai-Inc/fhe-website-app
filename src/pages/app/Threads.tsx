import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Pin, Lock, Plus, MessageSquare } from 'lucide-react';
import { fetchThreads, createThread } from '../../lib/community';
import { useDocumentTitle } from '../../lib/hooks';
import type { Thread } from '../../lib/community-types';

function authorName(t: Thread): string {
  return t.author?.display_name || t.author?.first_name || 'Member';
}

export default function Threads() {
  useDocumentTitle('Threads');
  const [threads, setThreads] = useState<Thread[]>([]);
  const [loading, setLoading] = useState(true);
  const [composing, setComposing] = useState(false);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [posting, setPosting] = useState(false);

  function reload() {
    fetchThreads().then(setThreads).catch(() => setThreads([])).finally(() => setLoading(false));
  }
  useEffect(reload, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !body.trim()) return;
    setPosting(true);
    try {
      await createThread(title.trim(), body.trim());
      setTitle(''); setBody(''); setComposing(false);
      setLoading(true); reload();
    } finally {
      setPosting(false);
    }
  }

  return (
    <div className="max-w-3xl">
      <div className="flex items-center justify-between mb-8">
        <div>
          <p className="eyebrow mb-2">Conversations</p>
          <h1 className="heading-section text-green-800">Threads</h1>
        </div>
        <button type="button" onClick={() => setComposing((v) => !v)} className="btn-primary">
          <Plus size={16} aria-hidden="true" /> New thread
        </button>
      </div>

      {composing && (
        <form onSubmit={submit} className="bg-white border border-green-800/10 p-6 mb-6">
          <div className="mb-4">
            <label className="form-label" htmlFor="t-title">Title</label>
            <input id="t-title" className="form-input" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="mb-4">
            <label className="form-label" htmlFor="t-body">What's on your mind?</label>
            <textarea id="t-body" rows={4} className="form-input resize-none" value={body} onChange={(e) => setBody(e.target.value)} />
          </div>
          <button type="submit" disabled={posting || !title.trim() || !body.trim()} className="btn-primary">
            {posting ? 'Posting…' : 'Post thread'}
          </button>
        </form>
      )}

      {loading ? (
        <p className="body-text text-muted">Loading…</p>
      ) : threads.length === 0 ? (
        <p className="body-text text-muted text-sm">No threads yet. Start the first one.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {threads.map((t) => (
            <Link key={t.id} to={`/app/threads/${t.id}`}
              className="bg-white border border-green-800/10 p-5 hover:shadow-md transition-shadow focus-ring block">
              <div className="flex items-center gap-2 mb-1">
                {t.pinned && <Pin size={13} className="text-gold-ink" aria-hidden="true" />}
                {t.locked && <Lock size={13} className="text-muted" aria-hidden="true" />}
                <h2 className="font-serif font-medium text-green-800 text-lg">{t.title}</h2>
              </div>
              <p className="text-sm text-secondary line-clamp-2 mb-2">{t.body}</p>
              <p className="text-xs text-muted inline-flex items-center gap-1.5">
                <MessageSquare size={12} aria-hidden="true" />
                {authorName(t)} · {new Date(t.last_post_at).toLocaleDateString()}
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
