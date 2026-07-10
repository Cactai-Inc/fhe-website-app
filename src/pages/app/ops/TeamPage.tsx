import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { useDocumentTitle } from '../../../lib/hooks';
import { useAuth } from '../../../contexts/AuthContext';
import {
  GRANTABLE_SURFACES, listAllGrants, addGrant, removeGrant, type SurfaceGrant,
} from '../../../lib/grants';
import {
  adminListMembers, adminSetRole, adminSetSuspended,
  type AdminMemberRow, type MemberRole,
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

function RosterSection({
  members, reload,
}: { members: AdminMemberRow[]; reload: () => void }) {
  const { isAdmin, isSuperAdmin } = useAuth();
  const staff = members.filter((m) => (m.role ?? 'USER') !== 'USER');

  async function act(fn: () => Promise<void>) { await fn(); reload(); }

  return (
    <section className="mb-10">
      <h2 className="font-serif text-lg text-green-800 mb-1">Team roster</h2>
      <p className="text-[12.5px] text-muted mb-4">
        Everyone with an internal role. Demoting to Client moves them back to the Clients page.
      </p>
      {staff.length === 0 && <p className="text-sm text-muted">No staff accounts yet.</p>}
      <div className="flex flex-col gap-1.5">
        {staff.map((m) => (
          <div key={m.user_id} className="flex flex-wrap items-center justify-between gap-3 bg-white border border-green-800/10 rounded-lg px-4 py-3">
            <span className="min-w-0">
              <span className="block text-sm font-medium text-green-900 truncate">{memberName(m)}</span>
              <span className="block text-xs text-muted truncate">
                {m.email}{m.is_suspended ? ' · SUSPENDED' : ''}
              </span>
            </span>
            <span className="flex items-center gap-2 shrink-0">
              {isAdmin ? (
                <select
                  className="border border-green-800/20 rounded-md px-2 py-1 text-xs bg-white"
                  value={(m.role as MemberRole) ?? 'USER'}
                  onChange={(e) => void act(() => adminSetRole(m.user_id, e.target.value as MemberRole))}
                  aria-label="Role"
                >
                  <option value="USER">Client</option>
                  <option value="MANAGER">Instructor</option>
                  <option value="ADMIN">Admin</option>
                  {isSuperAdmin && <option value="SUPER_ADMIN">Super admin</option>}
                </select>
              ) : (
                <span className="text-xs text-muted">{ROLE_LABEL[m.role ?? ''] ?? 'Client'}</span>
              )}
              <button type="button" onClick={() => void act(() => adminSetSuspended(m.user_id, !m.is_suspended))}
                className="text-xs underline text-secondary hover:text-green-800">
                {m.is_suspended ? 'Reinstate' : 'Suspend'}
              </button>
            </span>
          </div>
        ))}
      </div>
    </section>
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

export default function TeamPage() {
  useDocumentTitle('Team');
  const navigate = useNavigate();
  const [members, setMembers] = useState<AdminMemberRow[]>([]);
  const reload = () => { adminListMembers().then(setMembers).catch(() => setMembers([])); };
  useEffect(reload, []);

  const instructors = members.filter((m) =>
    (m.role as MemberRole) === 'MANAGER' || (m.role as MemberRole) === 'EMPLOYEE');

  return (
    <div className="max-w-3xl">
      <div className="flex items-center justify-between mb-1">
        <h1 className="font-serif text-2xl text-green-900">Team</h1>
        <button type="button" onClick={() => navigate('/app/ops/accounts/new')}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-green-800 text-white text-sm font-medium hover:bg-green-700 focus-ring">
          <Plus size={15} /> New account
        </button>
      </div>
      <p className="text-sm text-green-800/70 mb-6">
        Internal accounts — admins and instructors — and what instructors can reach.
      </p>
      <RosterSection members={members} reload={reload} />
      <PromoteSection members={members} reload={reload} />
      <InstructorAccessSection instructors={instructors} />
    </div>
  );
}
