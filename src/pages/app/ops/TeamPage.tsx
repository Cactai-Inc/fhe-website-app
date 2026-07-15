import { useEffect, useState } from 'react';
import { useDocumentTitle } from '../../../lib/hooks';
import { useAuth } from '../../../contexts/AuthContext';
import {
  GRANTABLE_SURFACES, listAllGrants, addGrant, removeGrant, type SurfaceGrant,
} from '../../../lib/grants';
import { X, ChevronRight } from 'lucide-react';
import {
  adminListMembers, adminSetRole, adminSetSuspended, adminSendInvitation,
  adminUpdateProfile, adminHardDeleteMember,
  adminPendingStaffInvites, adminRevokeStaffInvite,
  type AdminMemberRow, type MemberRole, type PendingStaffInvite,
} from '../../../lib/admin';

/**
 * TEAM (/app/ops/team, Accounts section) — the internal-accounts zone. The
 * Clients page is customers only; everything staff-facing lives here:
 *   - the team roster (admins, instructors) with role + suspend controls,
 *   - promoting an existing client into a staff role,
 *   - instructor access grants (org-wide or per-instructor).
 */

const ROLE_LABEL: Record<string, string> = {
  SUPER_ADMIN: 'Super admin', ADMIN: 'Admin', MANAGER: 'Instructor', EMPLOYEE: 'Staff',
};
const memberName = (m: AdminMemberRow) =>
  m.display_name || `${m.first_name ?? ''} ${m.last_name ?? ''}`.trim() || m.email || '—';

const inviteName = (i: PendingStaffInvite) =>
  `${i.first_name ?? ''} ${i.last_name ?? ''}`.trim() || i.email;

function RosterSection({
  members, pending, reload,
}: { members: AdminMemberRow[]; pending: PendingStaffInvite[]; reload: () => void }) {
  const { isAdmin } = useAuth();
  const staff = members.filter((m) => (m.role ?? 'USER') !== 'USER');
  const [selected, setSelected] = useState<AdminMemberRow | null>(null);
  const [revoking, setRevoking] = useState<string | null>(null);

  async function revoke(id: string) {
    setRevoking(id);
    try { await adminRevokeStaffInvite(id); reload(); }
    finally { setRevoking(null); }
  }

  return (
    <section className="mb-10">
      <h2 className="font-serif text-lg text-green-800 mb-1">Team roster</h2>
      <p className="text-[12.5px] text-muted mb-4">
        Everyone with an internal role. Click a member to edit their record, change their role,
        demote them back to a client, or delete their account.
      </p>
      {staff.length === 0 && pending.length === 0 && <p className="text-sm text-muted">No staff accounts yet.</p>}
      <div className="flex flex-col gap-1.5">
        {staff.map((m) => (
          <button key={m.user_id} type="button" onClick={() => setSelected(m)}
            className="flex items-center justify-between gap-3 bg-white border border-green-800/10 rounded-lg px-4 py-3 text-left hover:border-green-800/30 hover:bg-green-50/40 focus-ring transition-colors">
            <span className="min-w-0">
              <span className="block text-sm font-medium text-green-900 truncate">{memberName(m)}</span>
              <span className="block text-xs text-muted truncate">
                {m.email}{m.is_suspended ? ' · SUSPENDED' : ''}
              </span>
            </span>
            <span className="flex items-center gap-2 shrink-0">
              <span className={`text-xs font-sans uppercase tracking-wide px-2.5 py-1 rounded-full ${
                m.role === 'SUPER_ADMIN' ? 'bg-green-800 text-gold-300' : 'bg-cream-100 text-secondary'}`}>
                {ROLE_LABEL[m.role ?? ''] ?? 'Staff'}
              </span>
              <ChevronRight size={16} className="text-green-800/40" aria-hidden="true" />
            </span>
          </button>
        ))}

        {/* Invited-but-not-yet-accepted staff. No profile exists until they redeem,
            so these come straight from the invitations table — matching how the
            Clients page shows pending invitees. */}
        {pending.map((i) => (
          <div key={i.id}
            className="flex items-center justify-between gap-3 bg-gold-50/60 border border-dashed border-gold-300 rounded-lg px-4 py-3">
            <span className="min-w-0">
              <span className="block text-sm font-medium text-green-900 truncate">{inviteName(i)}</span>
              <span className="block text-xs text-muted truncate">
                {i.email}{i.title ? ` · ${i.title}` : ''}
              </span>
            </span>
            <span className="flex items-center gap-2 shrink-0">
              <span className="text-xs font-sans uppercase tracking-wide px-2.5 py-1 rounded-full bg-gold-200 text-gold-900">
                Invited · {ROLE_LABEL[i.invited_role] ?? 'Staff'}
              </span>
              {isAdmin && (
                <button type="button" onClick={() => revoke(i.id)} disabled={revoking === i.id}
                  className="text-xs text-red-700 hover:text-red-800 underline underline-offset-2 disabled:opacity-50 focus-ring">
                  {revoking === i.id ? 'Revoking…' : 'Revoke'}
                </button>
              )}
            </span>
          </div>
        ))}
      </div>
      {selected && (
        <TeamMemberPanel
          member={selected}
          canManage={isAdmin}
          onClose={() => setSelected(null)}
          onChanged={() => { setSelected(null); reload(); }}
        />
      )}
    </section>
  );
}

/** Click-into record for one team member: edit identity/contact, change role,
 *  demote to client, suspend, or delete. Admin-only actions are gated. */
function TeamMemberPanel({
  member, canManage, onClose, onChanged,
}: { member: AdminMemberRow; canManage: boolean; onClose: () => void; onChanged: () => void }) {
  const isSuper = member.role === 'SUPER_ADMIN';
  const [form, setForm] = useState({
    first_name: member.first_name ?? '', last_name: member.last_name ?? '',
    display_name: member.display_name ?? '', email: member.email ?? '',
    phone: member.phone ?? '', riding_level: member.riding_level ?? '', bio: member.bio ?? '',
  });
  const [role, setRole] = useState<MemberRole>((member.role as MemberRole) ?? 'MANAGER');
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState('');

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  async function run(fn: () => Promise<void>, done?: string) {
    setBusy(true); setError(null); setNote(null);
    try {
      await fn();
      if (done) { setNote(done); } else { onChanged(); }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'That action failed.');
    } finally { setBusy(false); }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/30 flex justify-end" onClick={onClose}>
      <div className="bg-cream w-full max-w-md h-full overflow-y-auto shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-green-800/10 sticky top-0 bg-cream z-10">
          <h2 className="font-serif text-lg text-green-900 truncate">{memberName(member)}</h2>
          <button type="button" onClick={onClose} aria-label="Close"><X size={20} /></button>
        </div>

        <div className="p-4 flex flex-col gap-5">
          <p className="text-xs text-muted">
            {ROLE_LABEL[member.role ?? ''] ?? 'Staff'}{member.is_suspended ? ' · Suspended' : ''}
          </p>

          {!canManage ? (
            <p className="text-sm text-muted">You have read-only access. An admin can edit this record.</p>
          ) : (
            <>
              {/* ── Record ── */}
              <div className="flex flex-col gap-3">
                <p className="form-label">Record</p>
                <div className="grid grid-cols-2 gap-3">
                  <label className="text-sm"><span className="form-label">First name</span>
                    <input className="form-input" value={form.first_name} onChange={set('first_name')} /></label>
                  <label className="text-sm"><span className="form-label">Last name</span>
                    <input className="form-input" value={form.last_name} onChange={set('last_name')} /></label>
                </div>
                <label className="text-sm"><span className="form-label">Display name</span>
                  <input className="form-input" value={form.display_name} onChange={set('display_name')} /></label>
                <label className="text-sm"><span className="form-label">Email</span>
                  <input type="email" className="form-input" value={form.email} onChange={set('email')} /></label>
                <label className="text-sm"><span className="form-label">Phone</span>
                  <input className="form-input" value={form.phone} onChange={set('phone')} /></label>
                <label className="text-sm"><span className="form-label">Riding level</span>
                  <input className="form-input" value={form.riding_level} onChange={set('riding_level')} /></label>
                <label className="text-sm"><span className="form-label">Bio</span>
                  <textarea rows={2} className="form-input resize-none" value={form.bio} onChange={set('bio')} /></label>
                <button type="button" className="btn-primary justify-center" disabled={busy}
                  onClick={() => void run(() => adminUpdateProfile(member.user_id, form), 'Saved.')}>
                  {busy ? 'Saving…' : 'Save record'}
                </button>
              </div>

              {!isSuper && (
                <>
                  {/* ── Role ── */}
                  <div className="flex flex-col gap-2 border-t border-green-800/10 pt-4">
                    <p className="form-label">Role</p>
                    <div className="flex gap-2">
                      <select className="form-input" value={role} onChange={(e) => setRole(e.target.value as MemberRole)} aria-label="Role">
                        <option value="MANAGER">Instructor</option>
                        <option value="EMPLOYEE">Staff</option>
                        <option value="ADMIN">Admin</option>
                      </select>
                      <button type="button" className="btn-secondary shrink-0" disabled={busy || role === member.role}
                        onClick={() => void run(() => adminSetRole(member.user_id, role))}>
                        Update role
                      </button>
                    </div>
                  </div>

                  {/* ── Status ── */}
                  <div className="flex items-center justify-between border-t border-green-800/10 pt-4">
                    <span className="text-sm text-green-900">{member.is_suspended ? 'Suspended' : 'Active'}</span>
                    <button type="button" className="btn-secondary" disabled={busy}
                      onClick={() => void run(() => adminSetSuspended(member.user_id, !member.is_suspended))}>
                      {member.is_suspended ? 'Reinstate' : 'Suspend'}
                    </button>
                  </div>

                  {/* ── Demote to client ── */}
                  <div className="border-t border-green-800/10 pt-4">
                    <p className="form-label mb-1">Demote to client</p>
                    <p className="text-xs text-muted mb-2">
                      Removes their internal role and moves them to the Clients page. Their account and history stay.
                    </p>
                    <button type="button" className="btn-secondary" disabled={busy}
                      onClick={() => void run(() => adminSetRole(member.user_id, 'USER'))}>
                      Demote to client
                    </button>
                  </div>

                  {/* ── Delete ── */}
                  <div className="border-t border-red-800/15 pt-4">
                    <p className="form-label mb-1 text-red-800">Delete account</p>
                    <p className="text-xs text-muted mb-2">
                      Permanently deletes this team member’s account and login. This can’t be undone.
                      Type <strong>DELETE</strong> to confirm.
                    </p>
                    <div className="flex gap-2">
                      <input className="form-input" placeholder="DELETE" value={confirmDelete}
                        onChange={(e) => setConfirmDelete(e.target.value)} aria-label="Type DELETE to confirm" />
                      <button type="button" disabled={busy || confirmDelete !== 'DELETE'}
                        className="px-4 py-2 rounded-lg bg-red-700 text-white text-sm font-medium hover:bg-red-800 focus-ring disabled:opacity-50 shrink-0"
                        onClick={() => void run(() => adminHardDeleteMember(member.user_id))}>
                        Delete
                      </button>
                    </div>
                  </div>
                </>
              )}

              {note && <p className="text-sm text-green-700">{note}</p>}
              {error && <p role="alert" className="form-error">{error}</p>}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function PromoteSection({
  members, reload,
}: { members: AdminMemberRow[]; reload: () => void }) {
  const clients = members.filter((m) => (m.role ?? 'USER') === 'USER');
  const [who, setWho] = useState('');
  const [role, setRole] = useState<MemberRole>('MANAGER');
  const [err, setErr] = useState<string | null>(null);

  async function promote() {
    if (!who) return;
    setErr(null);
    try {
      await adminSetRole(who, role);
      setWho('');
      reload();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not change the role.');
    }
  }

  return (
    <section className="mb-10">
      <h2 className="font-serif text-lg text-green-800 mb-1">Promote a client</h2>
      <p className="text-[12.5px] text-muted mb-4">
        Give an existing client account an internal role.
      </p>
      <div className="flex flex-wrap gap-2 items-center">
        <select className="form-input max-w-xs" value={who} onChange={(e) => setWho(e.target.value)} aria-label="Client">
          <option value="">Choose a client…</option>
          {clients.map((c) => <option key={c.user_id} value={c.user_id}>{memberName(c)}</option>)}
        </select>
        <select className="form-input w-auto" value={role} onChange={(e) => setRole(e.target.value as MemberRole)} aria-label="New role">
          <option value="MANAGER">Instructor</option>
          <option value="ADMIN">Admin</option>
        </select>
        <button type="button" disabled={!who} onClick={() => void promote()}
          className="px-4 py-2 rounded-lg bg-green-800 text-white text-xs font-medium hover:bg-green-700 focus-ring disabled:opacity-50">
          Promote
        </button>
      </div>
      {err && <p role="alert" className="form-error mt-2">{err}</p>}
    </section>
  );
}

function InstructorAccessSection({ instructors }: { instructors: AdminMemberRow[] }) {
  const [grants, setGrants] = useState<SurfaceGrant[]>([]);
  const [who, setWho] = useState<string>('');        // '' = every instructor
  const [err, setErr] = useState<string | null>(null);

  const load = () => {
    listAllGrants().then(setGrants).catch(() => setErr('Could not load grants.'));
  };
  useEffect(load, []);

  const scopeGrants = grants.filter((g) => (who ? g.user_id === who : g.user_id === null));
  const has = (key: string) => scopeGrants.some((g) => g.nav_key === key);

  async function toggle(key: string) {
    setErr(null);
    try {
      const existing = scopeGrants.find((g) => g.nav_key === key);
      if (existing) await removeGrant(existing.id);
      else await addGrant(key, who || null);
      load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not update the grant.');
    }
  }

  return (
    <section className="max-w-2xl">
      <h2 className="font-serif text-lg text-green-800 mb-1">Instructor access</h2>
      <p className="text-[12.5px] text-muted mb-4">
        Instructors always have the servicing set (inbound, contacts, lessons,
        availability, horses, engagements, documents). Add management surfaces
        here — for every instructor, or for one account.
      </p>
      <div className="mb-4">
        <label className="form-label" htmlFor="grant-scope">Applies to</label>
        <select id="grant-scope" className="border border-green-800/20 rounded-md px-3 py-2 text-sm bg-white"
          value={who} onChange={(e) => setWho(e.target.value)}>
          <option value="">Every instructor</option>
          {instructors.map((i) => (
            <option key={i.user_id} value={i.user_id}>{memberName(i)}</option>
          ))}
        </select>
      </div>
      {err && <p role="alert" className="form-error mb-3">{err}</p>}
      <div className="flex flex-col gap-2">
        {GRANTABLE_SURFACES.map((sfc) => (
          <label key={sfc.key}
            className="flex items-center justify-between bg-white border border-green-800/10 rounded-lg px-4 py-3">
            <span className="text-sm text-green-900">{sfc.label}</span>
            <input type="checkbox" className="accent-green-700 w-4 h-4"
              checked={has(sfc.key)} onChange={() => void toggle(sfc.key)} />
          </label>
        ))}
      </div>
      {who && (
        <p className="text-xs text-muted mt-3">
          Account-specific grants stack on top of the every-instructor grants.
        </p>
      )}
    </section>
  );
}

function InviteStaffSection({ onSent }: { onSent: () => void }) {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [title, setTitle] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'MANAGER' | 'ADMIN'>('MANAGER');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [result, setResult] = useState<{ url: string; emailed: boolean } | null>(null);

  async function send() {
    setBusy(true); setErr(null); setResult(null);
    try {
      const r = await adminSendInvitation({
        email: email.trim(), role, expiresInDays: 7,
        firstName: firstName.trim(), lastName: lastName.trim(), title: title.trim(),
      });
      setResult({ url: r.registerUrl, emailed: r.emailed });
      setFirstName(''); setLastName(''); setTitle(''); setEmail('');
      onSent(); // surface the new "Invited" row in the roster immediately
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not send the invitation.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mb-10">
      <h2 className="font-serif text-lg text-green-800 mb-1">Invite staff</h2>
      <p className="text-[12.5px] text-muted mb-4">
        Set their name, title, and role — applied to their account the moment they register.
      </p>
      <div className="grid sm:grid-cols-2 gap-2 max-w-xl mb-2">
        <input className="form-input" placeholder="First name"
          value={firstName} onChange={(e) => setFirstName(e.target.value)} aria-label="First name" />
        <input className="form-input" placeholder="Last name"
          value={lastName} onChange={(e) => setLastName(e.target.value)} aria-label="Last name" />
        <input className="form-input" placeholder="Title (e.g. Head Trainer)"
          value={title} onChange={(e) => setTitle(e.target.value)} aria-label="Title" />
        <input type="email" className="form-input" placeholder="their@email.com"
          value={email} onChange={(e) => setEmail(e.target.value)} aria-label="Email" />
      </div>
      <div className="flex flex-wrap gap-2 items-center">
        <select className="form-input w-auto" value={role}
          onChange={(e) => setRole(e.target.value as 'MANAGER' | 'ADMIN')} aria-label="Role">
          <option value="MANAGER">Instructor</option>
          <option value="ADMIN">Admin</option>
        </select>
        <button type="button" disabled={busy || !email.trim()} onClick={() => void send()}
          className="px-4 py-2 rounded-lg bg-green-800 text-white text-xs font-medium hover:bg-green-700 focus-ring disabled:opacity-50">
          {busy ? 'Sending…' : 'Send invite'}
        </button>
      </div>
      {err && <p role="alert" className="form-error mt-2">{err}</p>}
      {result && (
        <div className="bg-green-50 border border-green-200 p-3 mt-3 text-sm rounded-lg max-w-xl">
          <p className="text-green-800 mb-1.5">
            Invitation {result.emailed ? 'sent by email.' : 'created — email not configured; copy the link:'}
          </p>
          <code className="block break-all text-xs text-green-900 bg-white border border-green-200 p-2">{result.url}</code>
        </div>
      )}
    </section>
  );
}

export default function TeamPage() {
  useDocumentTitle('Team');
  const [members, setMembers] = useState<AdminMemberRow[]>([]);
  const [pending, setPending] = useState<PendingStaffInvite[]>([]);
  const reload = () => {
    adminListMembers().then(setMembers).catch(() => setMembers([]));
    adminPendingStaffInvites().then(setPending).catch(() => setPending([]));
  };
  useEffect(reload, []);

  const instructors = members.filter((m) =>
    (m.role as MemberRole) === 'MANAGER' || (m.role as MemberRole) === 'EMPLOYEE');

  return (
    <div className="max-w-5xl">
      <h1 className="font-serif text-2xl text-green-900 mb-1">Team</h1>
      <p className="text-sm text-green-800/70 mb-6">
        Internal accounts — admins and instructors — and what instructors can reach.
      </p>
      <RosterSection members={members} pending={pending} reload={reload} />
      <InviteStaffSection onSent={reload} />
      <PromoteSection members={members} reload={reload} />
      <InstructorAccessSection instructors={instructors} />
    </div>
  );
}
