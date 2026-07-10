import { useCallback, useEffect, useState } from 'react';
import { useDocumentTitle } from '../../../lib/hooks';
import {
  feedModerationList, feedModerate,
  type ModerationPost,
} from '../../../lib/feed';

/**
 * OPS MODERATION (Slice 3) — the two admin lists, both showing the ACTUAL media
 * so the admin can eyeball real content (spec Part 5):
 *   - All flagged: everything not-clean (QC / oversight; reviewed at the admin's pace).
 *   - Disputed: the subset a user reported as inaccurate (approve / affirm — someone waits).
 * Admin can also pull down anything live. Report-and-review at launch (owner B3);
 * the scan seam returns clean, so these lists are driven by user reports for now.
 */

type Tab = 'flagged' | 'disputed';

function MediaThumb({ post }: { post: ModerationPost }) {
  return post.media_kind === 'video' ? (
    <video src={post.media_url} controls className="w-40 h-40 object-cover rounded bg-black/5" />
  ) : (
    <img src={post.media_url} alt="" className="w-40 h-40 object-cover rounded bg-black/5" />
  );
}

export default function ModerationPage() {
  useDocumentTitle('Moderation');
  const [tab, setTab] = useState<Tab>('disputed');
  const [rows, setRows] = useState<ModerationPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async (which: Tab) => {
    setLoading(true);
    try {
      setRows(await feedModerationList(which === 'disputed'));
      setError(null);
    } catch {
      setError('Could not load the moderation queue.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(tab); }, [tab, load]);

  async function act(post: ModerationPost, action: 'approve' | 'affirm' | 'pull_down') {
    setBusy(post.id);
    try {
      await feedModerate(post.id, action);
      await load(tab);
    } catch {
      setError('That action failed. Try again.');
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="max-w-4xl">
      <h1 className="font-serif text-2xl text-green-900 mb-1">Moderation</h1>
      <p className="text-sm text-muted mb-6 font-sans">
        Review flagged and disputed posts. Both lists show the actual uploaded media.
      </p>

      <div className="flex gap-2 mb-6 font-sans text-sm">
        <button
          type="button"
          onClick={() => setTab('disputed')}
          className={`px-4 py-2 rounded-full border ${tab === 'disputed' ? 'bg-green-800 text-white border-green-800' : 'border-green-800/20 text-secondary'}`}
        >
          Disputed — needs a decision
        </button>
        <button
          type="button"
          onClick={() => setTab('flagged')}
          className={`px-4 py-2 rounded-full border ${tab === 'flagged' ? 'bg-green-800 text-white border-green-800' : 'border-green-800/20 text-secondary'}`}
        >
          All flagged — oversight
        </button>
      </div>

      {error && <p role="alert" className="form-error mb-4">{error}</p>}
      {loading && <p className="body-text text-muted text-sm">Loading…</p>}

      {!loading && rows.length === 0 && (
        <div className="bg-white border border-green-800/10 rounded-lg p-8 text-center">
          <p className="font-serif text-green-800">Nothing here.</p>
          <p className="text-sm text-muted mt-1">
            {tab === 'disputed' ? 'No disputed posts waiting on you.' : 'No flagged posts to review.'}
          </p>
        </div>
      )}

      <div className="flex flex-col gap-4">
        {rows.map((post) => (
          <div key={post.id} className="bg-white border border-green-800/10 rounded-lg p-4 flex gap-4">
            <MediaThumb post={post} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-sans uppercase tracking-wide text-muted">{post.post_type.replace('_', ' ')}</span>
                <span className={`text-xs font-sans px-2 py-0.5 rounded-full ${
                  post.scan_state === 'disputed' ? 'bg-gold-50 text-gold-ink' : 'bg-red-50 text-red-700'
                }`}>
                  {post.scan_state}{post.pulled_down ? ' · pulled' : ''}
                </span>
              </div>
              {post.body && <p className="body-text text-sm text-green-900 mb-1 line-clamp-3">{post.body}</p>}
              {post.reported_reason && (
                <p className="text-xs text-secondary font-sans mb-2">
                  <span className="text-muted">Reported:</span> {post.reported_reason}
                </p>
              )}
              <div className="flex flex-wrap gap-2 mt-2">
                <button type="button" disabled={busy === post.id} onClick={() => act(post, 'approve')}
                  className="btn-primary text-xs">Approve (let it post)</button>
                <button type="button" disabled={busy === post.id} onClick={() => act(post, 'affirm')}
                  className="btn-outline-gold text-xs">Affirm block</button>
                {!post.pulled_down && (
                  <button type="button" disabled={busy === post.id} onClick={() => act(post, 'pull_down')}
                    className="text-xs text-red-700 font-sans px-3 py-1.5">Pull down</button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
