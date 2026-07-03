import { useEffect, useState } from 'react';
import { toErrorMessage } from '../../lib/ops/errors';
import { useDocumentTitle } from '../../lib/hooks';
import {
  adminListMembers, adminSetSuspended, adminSetAdmin, adminUpsertMembership,
  adminCreateAnnouncement, adminCreateEvent, adminCreateContentPost, adminCreateResource,
  adminSendInvitation, type AdminMemberRow,
} from '../../lib/admin';

type Tab = 'members' | 'invite' | 'announce' | 'events' | 'content' | 'resources';

const TABS: { id: Tab; label: string }[] = [
  { id: 'members', label: 'Members' },
  { id: 'invite', label: 'Invite' },
  { id: 'announce', label: 'Announce' },
  { id: 'events', label: 'Events' },
  { id: 'content', label: 'Articles' },
  { id: 'resources', label: 'Resources' },
];

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-4">
      <span className="form-label">{label}</span>
      {children}
    </div>
  );
}

// ── Members tab ───────────────────────────────────────────────────────────────
function MembersTab() {
  const [members, setMembers] = useState<AdminMemberRow[]>([]);
  const [loading, setLoading] = useState(true);
  const reload = () => { adminListMembers().then(setMembers).catch(() => setMembers([])).finally(() => setLoading(false)); };
  useEffect(reload, []);

  async function act(fn: () => Promise<void>) {
    await fn();
    setLoading(true);
    reload();
  }

  if (loading) return <p className="body-text text-muted">Loading…</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm font-sans">
        <thead>
          <tr className="text-left text-muted border-b border-green-800/10">
            <th className="py-2 pr-4 font-medium">Name</th>
            <th className="py-2 pr-4 font-medium">Email</th>
            <th className="py-2 pr-4 font-medium">Membership</th>
            <th className="py-2 pr-4 font-medium">Flags</th>
            <th className="py-2 font-medium">Actions</th>
          </tr>
        </thead>
        <tbody>
          {members.map((m) => (
            <tr key={m.user_id} className="border-b border-green-800/[0.06]">
              <td className="py-2.5 pr-4 text-green-900">{m.display_name || `${m.first_name ?? ''} ${m.last_name ?? ''}`.trim() || '—'}</td>
              <td className="py-2.5 pr-4 text-secondary">{m.email}</td>
              <td className="py-2.5 pr-4">
                <select
                  className="border border-green-800/20 px-2 py-1 text-xs bg-white"
                  value={m.membership_status ?? 'none'}
                  onChange={(e) => act(() => adminUpsertMembership(m.user_id, m.membership_tier ?? 'community', e.target.value))}
                >
                  <option value="none">none</option>
                  <option value="active">active</option>
                  <option value="paused">paused</option>
                  <option value="cancelled">cancelled</option>
                </select>
              </td>
              <td className="py-2.5 pr-4 text-xs">
                {m.is_admin && <span className="text-gold-ink mr-2">admin</span>}
                {m.is_suspended && <span className="text-red-700">suspended</span>}
              </td>
              <td className="py-2.5 flex flex-wrap gap-2">
                <button type="button" onClick={() => act(() => adminSetSuspended(m.user_id, !m.is_suspended))}
                  className="text-xs underline text-secondary hover:text-green-800">
                  {m.is_suspended ? 'Reinstate' : 'Suspend'}
                </button>
                <button type="button" onClick={() => act(() => adminSetAdmin(m.user_id, !m.is_admin))}
                  className="text-xs underline text-secondary hover:text-green-800">
                  {m.is_admin ? 'Remove admin' : 'Make admin'}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Invite tab ────────────────────────────────────────────────────────────────
function InviteTab() {
  const [email, setEmail] = useState('');
  const [days, setDays] = useState('7');
  const [result, setResult] = useState<{ url: string; emailed: boolean } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [working, setWorking] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setWorking(true); setError(null); setResult(null);
    try {
      const r = await adminSendInvitation({ email: email.trim(), expiresInDays: Number(days) || 7 });
      setResult({ url: r.registerUrl, emailed: r.emailed });
      setEmail('');
    } catch (err) {
      setError(toErrorMessage(err, 'Could not send invitation.'));
    } finally {
      setWorking(false);
    }
  }

  return (
    <form onSubmit={submit} className="max-w-md">
      <p className="body-text text-sm mb-5">
        Create a registration invitation and email it to the person. After you've spoken with them,
        send the link so they can create their account.
      </p>
      <Field label="Email">
        <input type="email" required className="form-input" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="her@email.com" />
      </Field>
      <Field label="Expires in (days)">
        <input type="number" min={1} className="form-input" value={days} onChange={(e) => setDays(e.target.value)} />
      </Field>
      <button type="submit" disabled={working || !email.trim()} className="btn-primary">
        {working ? 'Sending…' : 'Create & send invitation'}
      </button>

      {error && <p className="form-error mt-4" role="alert">{error}</p>}
      {result && (
        <div className="bg-green-50 border border-green-200 p-4 mt-5 text-sm">
          <p className="text-green-800 mb-2">
            Invitation created{result.emailed ? ' and emailed.' : '. (Email provider not configured — copy the link below.)'}
          </p>
          <code className="block break-all text-xs text-green-900 bg-white border border-green-200 p-2">{result.url}</code>
        </div>
      )}
    </form>
  );
}

// ── Simple "create" forms ─────────────────────────────────────────────────────
function AnnounceTab() {
  const [title, setTitle] = useState(''); const [body, setBody] = useState(''); const [pinned, setPinned] = useState(false);
  const [done, setDone] = useState(false); const [working, setWorking] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setWorking(true); setDone(false);
    try { await adminCreateAnnouncement({ title: title.trim(), body: body.trim(), pinned }); setTitle(''); setBody(''); setPinned(false); setDone(true); }
    finally { setWorking(false); }
  }
  return (
    <form onSubmit={submit} className="max-w-xl">
      <Field label="Title"><input className="form-input" value={title} onChange={(e) => setTitle(e.target.value)} required /></Field>
      <Field label="Body"><textarea rows={5} className="form-input resize-none" value={body} onChange={(e) => setBody(e.target.value)} required /></Field>
      <label className="flex items-center gap-2 mb-4 text-sm text-secondary">
        <input type="checkbox" checked={pinned} onChange={(e) => setPinned(e.target.checked)} className="accent-green-800" /> Pin to top
      </label>
      <button type="submit" disabled={working} className="btn-primary">{working ? 'Posting…' : 'Post announcement'}</button>
      {done && <p className="text-xs text-green-700 mt-3">Posted.</p>}
    </form>
  );
}

function EventsTab() {
  const [f, setF] = useState({ title: '', description: '', starts_at: '', ends_at: '', location: '', capacity: '' });
  const [done, setDone] = useState(false); const [working, setWorking] = useState(false);
  const upd = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }));
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setWorking(true); setDone(false);
    try {
      await adminCreateEvent({
        title: f.title.trim(), description: f.description.trim() || undefined,
        starts_at: new Date(f.starts_at).toISOString(),
        ends_at: f.ends_at ? new Date(f.ends_at).toISOString() : undefined,
        location: f.location.trim() || undefined,
        capacity: f.capacity ? Number(f.capacity) : undefined,
      });
      setF({ title: '', description: '', starts_at: '', ends_at: '', location: '', capacity: '' }); setDone(true);
    } finally { setWorking(false); }
  }
  return (
    <form onSubmit={submit} className="max-w-xl">
      <Field label="Title"><input className="form-input" value={f.title} onChange={(e) => upd('title', e.target.value)} required /></Field>
      <Field label="Description"><textarea rows={3} className="form-input resize-none" value={f.description} onChange={(e) => upd('description', e.target.value)} /></Field>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Starts"><input type="datetime-local" className="form-input" value={f.starts_at} onChange={(e) => upd('starts_at', e.target.value)} required /></Field>
        <Field label="Ends"><input type="datetime-local" className="form-input" value={f.ends_at} onChange={(e) => upd('ends_at', e.target.value)} /></Field>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Location"><input className="form-input" value={f.location} onChange={(e) => upd('location', e.target.value)} /></Field>
        <Field label="Capacity"><input type="number" className="form-input" value={f.capacity} onChange={(e) => upd('capacity', e.target.value)} /></Field>
      </div>
      <button type="submit" disabled={working} className="btn-primary">{working ? 'Creating…' : 'Create event'}</button>
      {done && <p className="text-xs text-green-700 mt-3">Created.</p>}
    </form>
  );
}

function ContentTab() {
  const [f, setF] = useState({ title: '', slug: '', excerpt: '', body: '', cover_url: '', published: true });
  const [done, setDone] = useState(false); const [working, setWorking] = useState(false);
  const upd = (k: string, v: string | boolean) => setF((p) => ({ ...p, [k]: v }));
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setWorking(true); setDone(false);
    try {
      await adminCreateContentPost({
        title: f.title.trim(),
        slug: f.slug.trim() || f.title.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
        excerpt: f.excerpt.trim() || undefined, body: f.body, cover_url: f.cover_url.trim() || undefined,
        published: f.published,
      });
      setF({ title: '', slug: '', excerpt: '', body: '', cover_url: '', published: true }); setDone(true);
    } finally { setWorking(false); }
  }
  return (
    <form onSubmit={submit} className="max-w-xl">
      <Field label="Title"><input className="form-input" value={f.title} onChange={(e) => upd('title', e.target.value)} required /></Field>
      <Field label="Slug (optional)"><input className="form-input" value={f.slug} onChange={(e) => upd('slug', e.target.value)} placeholder="auto from title" /></Field>
      <Field label="Excerpt"><input className="form-input" value={f.excerpt} onChange={(e) => upd('excerpt', e.target.value)} /></Field>
      <Field label="Cover image URL"><input className="form-input" value={f.cover_url} onChange={(e) => upd('cover_url', e.target.value)} /></Field>
      <Field label="Body"><textarea rows={8} className="form-input resize-none" value={f.body} onChange={(e) => upd('body', e.target.value)} required /></Field>
      <label className="flex items-center gap-2 mb-4 text-sm text-secondary">
        <input type="checkbox" checked={f.published} onChange={(e) => upd('published', e.target.checked)} className="accent-green-800" /> Publish now
      </label>
      <button type="submit" disabled={working} className="btn-primary">{working ? 'Saving…' : 'Save article'}</button>
      {done && <p className="text-xs text-green-700 mt-3">Saved.</p>}
    </form>
  );
}

function ResourcesTab() {
  const [f, setF] = useState({ title: '', description: '', kind: 'link', url: '', storage_path: '' });
  const [done, setDone] = useState(false); const [working, setWorking] = useState(false);
  const upd = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }));
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setWorking(true); setDone(false);
    try {
      await adminCreateResource({
        title: f.title.trim(), description: f.description.trim() || undefined,
        kind: f.kind as 'file' | 'video' | 'link',
        url: f.url.trim() || undefined, storage_path: f.storage_path.trim() || undefined,
      });
      setF({ title: '', description: '', kind: 'link', url: '', storage_path: '' }); setDone(true);
    } finally { setWorking(false); }
  }
  return (
    <form onSubmit={submit} className="max-w-xl">
      <Field label="Title"><input className="form-input" value={f.title} onChange={(e) => upd('title', e.target.value)} required /></Field>
      <Field label="Description"><input className="form-input" value={f.description} onChange={(e) => upd('description', e.target.value)} /></Field>
      <Field label="Kind">
        <select className="form-input" value={f.kind} onChange={(e) => upd('kind', e.target.value)}>
          <option value="link">Link</option><option value="video">Video</option><option value="file">File (Storage)</option>
        </select>
      </Field>
      {f.kind === 'file' ? (
        <Field label="Storage path (in 'members' bucket)"><input className="form-input" value={f.storage_path} onChange={(e) => upd('storage_path', e.target.value)} placeholder="guides/seat-basics.pdf" /></Field>
      ) : (
        <Field label="URL"><input className="form-input" value={f.url} onChange={(e) => upd('url', e.target.value)} placeholder="https://…" /></Field>
      )}
      <button type="submit" disabled={working} className="btn-primary">{working ? 'Adding…' : 'Add resource'}</button>
      {done && <p className="text-xs text-green-700 mt-3">Added.</p>}
    </form>
  );
}

export default function Admin() {
  useDocumentTitle('Admin');
  const [tab, setTab] = useState<Tab>('members');

  return (
    <div className="max-w-5xl">
      <p className="eyebrow mb-2">Admin</p>
      <h1 className="heading-section text-green-800 mb-8">Manage the community.</h1>

      <div className="flex flex-wrap gap-2 mb-8 border-b border-green-800/10">
        {TABS.map((t) => (
          <button key={t.id} type="button" onClick={() => setTab(t.id)}
            className={`px-4 py-2 text-sm font-sans -mb-px border-b-2 transition-colors focus-ring ${
              tab === t.id ? 'border-green-800 text-green-800 font-medium' : 'border-transparent text-muted hover:text-green-800'
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'members' && <MembersTab />}
      {tab === 'invite' && <InviteTab />}
      {tab === 'announce' && <AnnounceTab />}
      {tab === 'events' && <EventsTab />}
      {tab === 'content' && <ContentTab />}
      {tab === 'resources' && <ResourcesTab />}
    </div>
  );
}
