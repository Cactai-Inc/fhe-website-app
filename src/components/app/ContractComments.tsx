import { useCallback, useEffect, useMemo, useState } from 'react';
import { MessageSquarePlus, Check, CornerDownRight, AlertTriangle } from 'lucide-react';
import {
  contractCommentsList, postContractComment, resolveContractComment,
  type ContractComment,
} from '../../lib/contracts';

/**
 * CONTRACT COMMENTS — Google-Docs-style pinned comments, always on. A comment is
 * anchored to a field, to a selected span of the document prose, or to the whole
 * document; comments are threaded (reply) and resolvable (resolving closes the
 * thread). Any party may comment; anyone may reply until the thread is resolved.
 *
 * This component renders the thread LIST + composer/reply/resolve controls. The
 * span-selection affordance (select text → "Comment") lives in the body renderer
 * and calls onStartSpanComment, which opens the composer here pre-anchored.
 *
 * Threads are grouped by anchor so a reader sees "3 comments on Lease Term" etc.
 */

export interface PendingAnchor {
  kind: 'field' | 'span' | 'document';
  ref?: string | null;
  quote?: string | null;
  quotePrefix?: string | null;
  label?: string;   // human label for the composer header
}

function when(iso: string): string {
  try { return new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }); }
  catch { return ''; }
}

function anchorLabel(c: ContractComment): string {
  if (c.anchor_kind === 'field') return c.anchor_ref ?? 'a field';
  if (c.anchor_kind === 'span') return c.quote ? `“${c.quote.slice(0, 48)}${c.quote.length > 48 ? '…' : ''}”` : 'a passage';
  return 'the document';
}

/** One thread: a root comment, its replies, resolve control, and a reply box. */
function Thread({
  root, replies, canAct, onReply, onResolve, busy,
}: {
  root: ContractComment;
  replies: ContractComment[];
  canAct: boolean;
  onReply: (parentId: string, body: string) => Promise<void>;
  onResolve: (id: string, resolved: boolean) => Promise<void>;
  busy: boolean;
}) {
  const [replyText, setReplyText] = useState('');
  const [replying, setReplying] = useState(false);
  const resolved = !!root.resolved_at;

  return (
    <div className={`border rounded-lg p-3 ${resolved ? 'border-green-800/10 bg-cream-100/40 opacity-80' : 'border-gold-400/40 bg-white'}`}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-[11px] text-muted">
          On <span className="text-green-900">{anchorLabel(root)}</span>
          {root.is_stale && (
            <span className="inline-flex items-center gap-1 text-amber-700 ml-1.5" title="The text this refers to has changed">
              <AlertTriangle size={11} /> text changed
            </span>
          )}
        </p>
        {canAct && (
          <button type="button" disabled={busy}
            onClick={() => void onResolve(root.id, !resolved)}
            className={`text-[11px] inline-flex items-center gap-1 rounded px-2 py-0.5 focus-ring ${
              resolved ? 'text-muted hover:bg-green-800/5' : 'text-green-700 hover:bg-green-50'}`}>
            <Check size={11} /> {resolved ? 'Reopen' : 'Resolve'}
          </button>
        )}
      </div>

      <p className="text-sm text-green-900 mt-1 whitespace-pre-line">{root.body}</p>
      <p className="text-[11px] text-muted mt-0.5">
        {root.author_label ?? 'A party'}{root.author_role ? ` (${root.author_role})` : ''} · {when(root.created_at)}
      </p>

      {replies.length > 0 && (
        <div className="mt-2 ml-3 pl-3 border-l-2 border-green-800/10 flex flex-col gap-2">
          {replies.map((r) => (
            <div key={r.id}>
              <p className="text-sm text-green-900 whitespace-pre-line flex gap-1.5">
                <CornerDownRight size={13} className="text-muted mt-1 shrink-0" aria-hidden="true" />
                <span>{r.body}</span>
              </p>
              <p className="text-[11px] text-muted mt-0.5 ml-5">
                {r.author_label ?? 'A party'}{r.author_role ? ` (${r.author_role})` : ''} · {when(r.created_at)}
              </p>
            </div>
          ))}
        </div>
      )}

      {!resolved && canAct && (
        replying ? (
          <div className="mt-2 flex flex-col gap-1.5">
            <textarea rows={2} className="form-input resize-y text-sm" placeholder="Reply…"
              value={replyText} onChange={(e) => setReplyText(e.target.value)} autoFocus />
            <div className="flex gap-2">
              <button type="button" className="btn-primary text-xs" disabled={busy || !replyText.trim()}
                onClick={() => void onReply(root.id, replyText.trim()).then(() => { setReplyText(''); setReplying(false); })}>
                Reply
              </button>
              <button type="button" className="btn-secondary text-xs" onClick={() => { setReplyText(''); setReplying(false); }}>Cancel</button>
            </div>
          </div>
        ) : (
          <button type="button" className="text-[11px] text-secondary underline mt-2" onClick={() => setReplying(true)}>
            Reply
          </button>
        )
      )}
    </div>
  );
}

export function ContractComments({
  documentId, canComment, pendingAnchor, onAnchorConsumed, onChanged,
}: {
  documentId: string;
  canComment: boolean;
  /** When set (e.g. from a text selection or a field's "Comment" button), the
   *  composer opens pre-anchored to it. */
  pendingAnchor?: PendingAnchor | null;
  onAnchorConsumed?: () => void;
  onChanged?: () => void;
}) {
  const [comments, setComments] = useState<ContractComment[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [composerOpen, setComposerOpen] = useState(false);
  const [anchor, setAnchor] = useState<PendingAnchor>({ kind: 'document' });

  const load = useCallback(() => {
    contractCommentsList(documentId).then(setComments).catch(() => setComments([]));
  }, [documentId]);
  useEffect(() => { load(); }, [load]);

  // An external anchor (span selection / field comment) opens the composer.
  useEffect(() => {
    if (pendingAnchor) {
      setAnchor(pendingAnchor);
      setComposerOpen(true);
      onAnchorConsumed?.();
    }
  }, [pendingAnchor, onAnchorConsumed]);

  const { roots, repliesByParent } = useMemo(() => {
    const all = comments ?? [];
    const roots = all.filter((c) => !c.parent_comment_id);
    const repliesByParent = new Map<string, ContractComment[]>();
    for (const c of all) {
      if (c.parent_comment_id) {
        (repliesByParent.get(c.parent_comment_id) ?? repliesByParent.set(c.parent_comment_id, []).get(c.parent_comment_id)!).push(c);
      }
    }
    return { roots, repliesByParent };
  }, [comments]);

  async function run(fn: () => Promise<void>) {
    setBusy(true); setErr(null);
    try { await fn(); load(); onChanged?.(); }
    catch (e) { setErr(e instanceof Error ? e.message : 'That action failed.'); }
    finally { setBusy(false); }
  }

  const post = () => run(async () => {
    await postContractComment(documentId, {
      body: draft.trim(), anchorKind: anchor.kind, anchorRef: anchor.ref ?? null,
      quote: anchor.quote ?? null, quotePrefix: anchor.quotePrefix ?? null,
    });
    setDraft(''); setComposerOpen(false); setAnchor({ kind: 'document' });
  });

  const reply = (parentId: string, body: string) =>
    run(() => postContractComment(documentId, { body, parentId }).then(() => {}));
  const resolve = (id: string, resolved: boolean) =>
    run(() => resolveContractComment(id, resolved));

  const openCount = roots.filter((r) => !r.resolved_at).length;

  return (
    <section className="bg-white border border-green-800/10 rounded-xl p-5">
      <div className="flex items-center gap-2 mb-3">
        <MessageSquarePlus size={16} className="text-gold-ink" aria-hidden="true" />
        <h2 className="font-serif text-green-800">Comments</h2>
        <span className="text-xs text-muted">{openCount > 0 ? `${openCount} open` : 'none open'}</span>
        {canComment && !composerOpen && (
          <button type="button" className="ml-auto btn-outline-gold text-xs"
            onClick={() => { setAnchor({ kind: 'document' }); setComposerOpen(true); }}>
            + Comment
          </button>
        )}
      </div>

      {err && <p role="alert" className="form-error mb-2">{err}</p>}

      {composerOpen && (
        <div className="border border-gold-400/40 rounded-lg p-3 mb-3 bg-gold-50/40">
          <p className="text-[11px] text-muted mb-1.5">
            Commenting on <span className="text-green-900">{
              anchor.label ?? (anchor.kind === 'field' ? (anchor.ref ?? 'a field')
                : anchor.kind === 'span' ? (anchor.quote ? `“${anchor.quote.slice(0, 48)}…”` : 'a passage')
                : 'the whole document')
            }</span>
          </p>
          <textarea rows={2} className="form-input resize-y text-sm" placeholder="Write a comment or a question…"
            value={draft} onChange={(e) => setDraft(e.target.value)} autoFocus />
          <div className="flex gap-2 mt-2">
            <button type="button" className="btn-primary text-xs" disabled={busy || !draft.trim()} onClick={() => void post()}>
              Comment
            </button>
            <button type="button" className="btn-secondary text-xs"
              onClick={() => { setComposerOpen(false); setDraft(''); setAnchor({ kind: 'document' }); }}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {comments === null ? (
        <p className="text-sm text-muted">Loading…</p>
      ) : roots.length === 0 ? (
        <p className="text-sm text-muted">
          No comments yet. {canComment ? 'Select text in the document, or use “+ Comment”, to start a thread.' : ''}
        </p>
      ) : (
        <div className="flex flex-col gap-2.5 max-h-[32rem] overflow-y-auto">
          {roots.map((root) => (
            <Thread key={root.id} root={root} replies={repliesByParent.get(root.id) ?? []}
              canAct={canComment} onReply={reply} onResolve={resolve} busy={busy} />
          ))}
        </div>
      )}
    </section>
  );
}

export default ContractComments;
