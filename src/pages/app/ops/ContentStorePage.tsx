import { useCallback, useEffect, useRef, useState } from 'react';
import { Paperclip, Download, Upload, Eye, EyeOff } from 'lucide-react';
import { useDocumentTitle } from '../../../lib/hooks';
import { useAuth } from '../../../contexts/AuthContext';
import {
  listContentBlocks, upsertContentBlock, getContentBlockRaw,
  type ContentBlockRow, type ContentKind,
} from '../../../lib/contentStore';
import { adminListResources, adminSetResourcePublished } from '../../../lib/admin';
import { uploadCompanyResource, fileDownloadUrl, FILES_BUCKET, MAX_FILE_BYTES } from '../../../lib/files';
import type { ContentResource } from '../../../lib/community-types';

/**
 * OPS CONTENT STORE (Slice 5, /app/ops/content) — the versioned content/policy
 * store editor. Slug-keyed blocks (welcome copy, orientation, policy blurbs),
 * distinct from the legal contract engine. Each save publishes a new version (old
 * versions kept). Bodies may carry {{NS.FIELD}} tokens merged at read time; policy
 * blocks log a version-stamped acknowledgment. Admin-only.
 *
 * TASK-UPLOADS (2026-08-11) adds COMPANY FILES below the block editor — the
 * upload this page was routed for and never given. Owner: *"the brand itself
 * needs to be able to hold company documents in the same way a contact can.
 * This is where things i create for posting like articles and guides can have a
 * home that is appropriately centralized around the tenant not any individual
 * staff account."*
 *
 * Centralized around the TENANT is the whole point: these files are stored with
 * `owner_kind='org'`, owned by the organization, not by whichever staff account
 * clicked upload. A staff member leaving takes none of them.
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

      <CompanyFiles />
    </div>
  );
}

/**
 * COMPANY FILES — articles, guides and any other material the COMPANY holds.
 *
 * Stored once in the private `facility-files` bucket under the org's own prefix,
 * catalogued in `content_resources` (the org-scoped home that already existed —
 * no second table), and gated by that table's existing `published` flag. Both
 * the row policy and the storage policy read the same flag, so unpublishing puts
 * the bytes out of members' reach, not just the listing.
 */
function CompanyFiles() {
  const { orgId } = useAuth();
  const [rows, setRows] = useState<ContentResource[] | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [published, setPublished] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    try { setRows(await adminListResources()); }
    catch { setRows([]); setError('Could not load company files.'); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = e.target.files?.[0];
    e.target.value = '';
    if (!picked) return;
    if (!orgId) { setError('Your account is not attached to a stable.'); return; }
    setBusy(true); setError(null); setNote(null);
    try {
      await uploadCompanyResource({
        orgId,
        file: picked,
        // The filename is the fallback title so a hurried upload is still
        // identifiable in the members' resource list.
        title: title.trim() || picked.name,
        description: description.trim() || undefined,
        published,
      });
      setNote(`Uploaded ${picked.name}${published ? '' : ' (unpublished — members cannot see it yet)'}.`);
      setTitle(''); setDescription('');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not upload that file.');
    } finally {
      setBusy(false);
    }
  }

  async function togglePublished(r: ContentResource) {
    setBusy(true); setError(null); setNote(null);
    try {
      await adminSetResourcePublished(r.id, !r.published);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not change that file.');
    } finally {
      setBusy(false);
    }
  }

  async function download(r: ContentResource) {
    if (!r.storage_path) return;
    setError(null);
    const url = await fileDownloadUrl({ bucket_id: FILES_BUCKET, storage_path: r.storage_path });
    if (!url) { setError(`Could not open ${r.title}.`); return; }
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  return (
    <section className="mt-10">
      <h2 className="font-serif text-xl text-green-900 mb-1">Company files</h2>
      <p className="text-sm text-green-800/70 mb-4">
        Articles, guides and other material the <strong>company</strong> holds — owned by the
        stable, not by the person who uploads it. Published files appear to members in the
        community Resources list.
      </p>

      {error && <p role="alert" className="form-error mb-4">{error}</p>}
      {note && <p role="status" className="mb-4 rounded px-4 py-2 text-sm bg-green-50 text-green-900">{note}</p>}

      <div className="bg-white border border-green-800/10 rounded-lg p-5 mb-6 flex flex-col gap-4">
        <div className="grid sm:grid-cols-2 gap-4">
          <label className="block">
            <span className="text-sm font-sans text-secondary">Title</span>
            <input value={title} onChange={(e) => setTitle(e.target.value)} className="form-input mt-1"
              placeholder="Defaults to the filename" />
          </label>
          <label className="block">
            <span className="text-sm font-sans text-secondary">Description</span>
            <input value={description} onChange={(e) => setDescription(e.target.value)} className="form-input mt-1" />
          </label>
        </div>
        <label className="inline-flex items-center gap-2 text-sm text-secondary">
          <input type="checkbox" checked={published} onChange={(e) => setPublished(e.target.checked)} />
          Publish to members immediately
        </label>
        <div className="flex flex-wrap items-center gap-3">
          <input ref={inputRef} type="file" className="sr-only" onChange={onPick}
            aria-label="Choose a company file to upload" data-testid="company-file-input" />
          <button type="button" disabled={busy || !orgId} onClick={() => inputRef.current?.click()}
            className="btn-primary inline-flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
            <Upload size={15} aria-hidden="true" />
            {busy ? 'Working…' : 'Upload a company file'}
          </button>
          <span className="text-xs text-muted">
            Private storage, up to {Math.round(MAX_FILE_BYTES / 1048576)}MB. Links are short-lived.
          </span>
        </div>
      </div>

      {rows === null && <p className="text-sm text-green-800/70">Loading…</p>}
      {rows?.length === 0 && <p className="text-sm text-green-800/70">No company files yet.</p>}

      <div className="flex flex-col gap-2">
        {(rows ?? []).map((r) => (
          <div key={r.id}
            className="bg-white border border-green-800/10 rounded-lg p-4 flex items-center gap-3">
            <span className="w-9 h-9 rounded-lg bg-cream-100 text-green-700 grid place-items-center shrink-0">
              <Paperclip size={16} aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-sans font-medium text-green-900 truncate">{r.title}</p>
              <p className="text-xs text-muted mt-0.5">
                {r.kind}{r.description ? ` · ${r.description}` : ''}
                {' · '}{r.published ? 'Published' : 'Not published'}
              </p>
            </div>
            {r.storage_path && (
              <button type="button" onClick={() => void download(r)}
                className="inline-flex items-center gap-1.5 text-xs text-green-800 hover:text-green-700 px-2.5 py-1 rounded-lg border border-green-800/15 hover:border-green-800/30 focus-ring shrink-0">
                <Download size={13} aria-hidden="true" /> Download
              </button>
            )}
            <button type="button" disabled={busy} onClick={() => void togglePublished(r)}
              className="inline-flex items-center gap-1.5 text-xs text-green-800 hover:text-green-700 px-2.5 py-1 rounded-lg border border-green-800/15 hover:border-green-800/30 focus-ring shrink-0 disabled:opacity-50">
              {r.published
                ? <><EyeOff size={13} aria-hidden="true" /> Unpublish</>
                : <><Eye size={13} aria-hidden="true" /> Publish</>}
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}
