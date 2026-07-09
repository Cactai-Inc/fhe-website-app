import { useEffect, useState } from 'react';
import { useDocumentTitle } from '../../../lib/hooks';
import {
  listContentBlocks, upsertContentBlock, getContentBlockRaw,
  type ContentBlockRow, type ContentKind,
} from '../../../lib/contentStore';

/**
 * OPS CONTENT STORE (Slice 5, /app/ops/content) — the versioned content/policy
 * store editor. Slug-keyed blocks (welcome copy, orientation, policy blurbs),
 * distinct from the legal contract engine. Each save publishes a new version (old
 * versions kept). Bodies may carry {{NS.FIELD}} tokens merged at read time; policy
 * blocks log a version-stamped acknowledgment. Admin-only.
 */
export default function ContentStorePage() {
  useDocumentTitle('Content store');
  const [rows, setRows] = useState<ContentBlockRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // editor
  const [slug, setSlug] = useState('');
  const [title, setTitle] = useState('');
  const [kind, setKind] = useState<ContentKind>('content');
  const [body, setBody] = useState('');
  const [saving, setSaving] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try { setRows(await listContentBlocks()); setError(null); }
    catch { setError('Could not load content blocks.'); }
    finally { setLoading(false); }
  }

  useEffect(() => { void load(); }, []);

  async function edit(r: ContentBlockRow) {
    try {
      const raw = await getContentBlockRaw(r.id, r.current_version);
      setSlug(r.slug); setTitle(r.title); setKind(r.kind); setBody(raw); setNote(null);
    } catch { setError('Could not load that block.'); }
  }

  function reset() {
    setSlug(''); setTitle(''); setKind('content'); setBody(''); setNote(null);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!slug.trim() || !title.trim() || !body.trim()) { setError('Slug, title and body are required.'); return; }
    setSaving(true); setError(null);
    try {
      const v = await upsertContentBlock(slug.trim(), title.trim(), body, kind);
      setNote(`Saved — version ${v}.`);
      await load();
    } catch { setError('Could not save the block.'); }
    finally { setSaving(false); }
  }

  return (
    <div className="max-w-3xl mx-auto py-8 px-4">
      <h1 className="font-serif text-2xl text-green-900 mb-1">Content store</h1>
      <p className="text-sm text-green-800/70 mb-6">
        Versioned content &amp; policy blocks. Use <code className="text-xs">{'{{NS.FIELD}}'}</code> tokens; they merge when read.
        Each save publishes a new version.
      </p>

      {error && <p role="alert" className="form-error mb-4">{error}</p>}
      {note && <p className="mb-4 rounded px-4 py-2 text-sm bg-green-50 text-green-900">{note}</p>}

      {/* editor */}
      <form onSubmit={save} className="bg-white border border-green-800/10 rounded-lg p-5 mb-8 flex flex-col gap-4">
        <div className="grid sm:grid-cols-3 gap-4">
          <label className="block">
            <span className="text-sm font-sans text-secondary">Slug</span>
            <input value={slug} onChange={(e) => setSlug(e.target.value)} className="form-input mt-1" placeholder="welcome-home" required />
          </label>
          <label className="block sm:col-span-2">
            <span className="text-sm font-sans text-secondary">Title</span>
            <input value={title} onChange={(e) => setTitle(e.target.value)} className="form-input mt-1" required />
          </label>
        </div>
        <label className="block">
          <span className="text-sm font-sans text-secondary">Kind</span>
          <select value={kind} onChange={(e) => setKind(e.target.value as ContentKind)} className="form-input mt-1 sm:w-48">
            <option value="content">Content</option>
            <option value="policy">Policy (acknowledged)</option>
          </select>
        </label>
        <label className="block">
          <span className="text-sm font-sans text-secondary">Body</span>
          <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={7} className="form-input mt-1 font-mono text-sm" required />
        </label>
        <div className="flex gap-2">
          <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Saving…' : 'Publish version'}</button>
          <button type="button" onClick={reset} className="btn-secondary">New block</button>
        </div>
      </form>

      {loading && <p className="text-sm text-green-800/70">Loading…</p>}
      {!loading && rows.length === 0 && <p className="text-sm text-green-800/70">No content blocks yet.</p>}

      <div className="flex flex-col gap-2">
        {rows.map((r) => (
          <button key={r.id} type="button" onClick={() => edit(r)}
            className="bg-white border border-green-800/10 rounded-lg p-4 text-left hover:border-green-800/30 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-sans font-medium text-green-900">{r.title}</p>
              <p className="text-xs text-muted mt-0.5">
                <code>{r.slug}</code> · {r.kind} · v{r.current_version}
              </p>
            </div>
            <span className="text-xs text-gold-ink font-sans">Edit</span>
          </button>
        ))}
      </div>
    </div>
  );
}
