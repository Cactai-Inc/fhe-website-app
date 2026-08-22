import { AlertTriangle } from 'lucide-react';
import type { ClientAccountRow } from '../../lib/admin';

/**
 * TASK-ROSTERCARD — the triage card. `admin_client_accounts()` (live, 20
 * columns) does not carry groups, guardian pairing, deal-only-party evidence,
 * horse names, or activity — none of it is on the RPC, and this task does no
 * database work. It is read directly under the same admin RLS the RPC itself
 * requires; Admin.tsx assembles this shape once per list load. See
 * docs/reports/TASK-ROSTERCARD-REPORT.md for the exact queries and their
 * verification against direct SQL.
 */
export interface RosterSupplement {
  /** contact_id -> group_type[] (RIDER / HORSE_OWNER / GUEST / PARENT_GUARDIAN). */
  groups: Map<string, string[]>;
  /** dependent contact_id -> guardian (parent) contact_id. */
  guardianOf: Map<string, string>;
  /** parent contact_id -> dependent contact_id[] (the reverse lookup — one
   *  parent may have several). */
  dependentsOf: Map<string, string[]>;
  /** contact_id -> display name, for resolving the PAIR's other name. */
  contactNames: Map<string, string>;
  /** contact_ids that are a party to at least one document. */
  dealParty: Set<string>;
  /** TASK-ROLEBUNDLE — contact_ids holding a CONTRACT ROLE (BUYER / LESSEE /
   *  LESSOR / SELLER) on at least one live document. Deliberately narrower than
   *  `dealParty`, which is "party to any document at all" and therefore true of
   *  every onboarded client the moment they sign a release. */
  contractRole: Set<string>;
  /** contact_ids with a DRAFT or AWAITING_SIGNATURE document (own or party). */
  outstandingDocs: Set<string>;
  /** contact_ids with a purchase awaiting payment. */
  unpaidContacts: Set<string>;
  /** contact_id -> horse display names, owned / leased (separate relationships). */
  horsesOwned: Map<string, string[]>;
  horsesLeased: Map<string, string[]>;
  /** user_id -> most recent audit_logs.occurred_at (ISO). Actions, not sessions;
   *  see the report for what this can and cannot see (bookings is not audited). */
  lastActive: Map<string, string>;
}

export const EMPTY_SUPPLEMENT: RosterSupplement = {
  groups: new Map(), guardianOf: new Map(), dependentsOf: new Map(),
  contactNames: new Map(), dealParty: new Set(), contractRole: new Set(),
  outstandingDocs: new Set(),
  unpaidContacts: new Set(), horsesOwned: new Map(), horsesLeased: new Map(),
  lastActive: new Map(),
};

export const rowKeyOf = (m: ClientAccountRow) => m.user_id ?? m.contact_id ?? m.email ?? '';

export const memberName = (m: ClientAccountRow) =>
  m.display_name || `${m.first_name ?? ''} ${m.last_name ?? ''}`.trim() || m.email || '—';

/* Two letters here — differentiation among a list of OTHER people, deliberately
   different from the header avatar's single "identity" letter (TASK-ROSTER,
   owner-settled). A name with only one part correctly shows one letter: it is
   what the name gives, not a fallback that failed. Do not "fix" this to match
   the header avatar. */
export function initials(m: ClientAccountRow): string {
  const first = m.first_name?.trim();
  const last = m.last_name?.trim();
  if (first && last) return (first[0] + last[0]).toUpperCase();
  if (first) return first[0].toUpperCase();
  if (last) return last[0].toUpperCase();
  return (m.email?.[0] ?? memberName(m)[0] ?? 'C').toUpperCase();
}

// RING — what KIND of relationship, the one dimension with a single source
// (owner-verified 2026-08-10): every `clients` row already carries
// client_since or customer_since (0 exceptions, checked live) — a clients row
// IS the commercial marker, so client_id alone decides gold. A login with no
// clients row is a guest. The bare 'contact' arm (no login, no clients row —
// the F1 gap case) has no relationship yet; grey is the closest state on this
// page to a lead (LEAD itself is excluded from the roster entirely).
export type Ring = 'gold' | 'green' | 'grey';
export function ringOf(m: ClientAccountRow): Ring {
  if (m.client_id) return 'gold';
  if (m.kind === 'account') return 'green';
  return 'grey';
}
const RING_CLASS: Record<Ring, string> = {
  gold: 'ring-gold-600',
  green: 'ring-green-600',
  grey: 'ring-gray-300',
};

// BADGES — what SERVICES they engage in, DERIVED ONLY (never tags). Source:
// `groups`, apply_affiliations' sole output. A separate, independent
// dimension from the ring — a gold-ringed client can carry no badge at all
// (a clients row with no group yet), and that gap is itself information.
interface Badge { key: string; label: string }
function badgesOf(m: ClientAccountRow, supp: RosterSupplement): Badge[] {
  const cid = m.contact_id ?? '';
  const groups = supp.groups.get(cid) ?? [];
  const badges: Badge[] = [];
  if (groups.includes('RIDER')) badges.push({ key: 'rider', label: 'Rider' });
  if (groups.includes('HORSE_OWNER')) badges.push({ key: 'horse_owner', label: 'Horse Owner' });
  // TASK-ROLEBUNDLE — DEAL PARTY, DERIVED, NOT A CATEGORY (D31).
  //
  // Owner, 2026-08-22: *"derive it from 'this account holds a contract role and
  // has no purchases' — don't add it as a category token."* So it is computed
  // here from two facts the roster already loads, and there is no fifth entry in
  // CLIENT_CATEGORIES and no fifth `groups.group_type`.
  //
  // This REPLACES the old 'Deal-only party' chip, which was wrong twice over:
  // it read `dealParty` — party to ANY document, which is true of every client
  // who has ever signed a release — and it was saved from showing on all of them
  // only by an unrelated `kind === 'contact'` gate, so a real account holding a
  // lease and buying nothing (exactly the person this badge is for) never got it.
  if (supp.contractRole.has(cid) && (m.order_count ?? 0) === 0) {
    badges.push({ key: 'deal_party', label: 'Deal party' });
  }
  return badges;
}

// PAIR — parent <-> dependent, both cards, both names. Source: guardian_contact_id
// (the foreign key), NOT the PARENT_GUARDIAN group (zero rows today — deriving
// from it would show nothing). Replaces the old contract-role "Counterparty"
// chip, which described a position in a document rather than who someone is.
interface Pair { role: 'DEPENDENT' | 'PARENT'; names: string[] }
function pairOf(m: ClientAccountRow, supp: RosterSupplement): Pair | null {
  const cid = m.contact_id ?? '';
  const parentId = supp.guardianOf.get(cid);
  if (parentId) return { role: 'DEPENDENT', names: [supp.contactNames.get(parentId) ?? 'their guardian'] };
  const dependents = supp.dependentsOf.get(cid) ?? [];
  if (dependents.length > 0) {
    return { role: 'PARENT', names: dependents.map((id) => supp.contactNames.get(id) ?? 'a dependent') };
  }
  return null;
}

// NAMES — horses owned / leased, distinct relationships, named not counted.
function horsesOf(m: ClientAccountRow, supp: RosterSupplement) {
  const cid = m.contact_id ?? '';
  return { owned: supp.horsesOwned.get(cid) ?? [], leased: supp.horsesLeased.get(cid) ?? [] };
}

// COUNTS — orders, credits (open balance, summed), lessons consumed. Horse-
// care consumption and every other service type stay off the card — the
// triage brief is who's stuck and who's engaging, not a full ledger.
function countsOf(m: ClientAccountRow) {
  const credits = (m.credits ?? []).reduce((sum, c) => sum + c.remaining, 0);
  const lessons = m.services?.RIDING_LESSON ?? 0;
  return { orders: m.order_count ?? 0, credits, lessons };
}

// ACTIVITY — actions, not sessions. A row with no user_id has never logged
// in, so no activity signal can exist for it (not the same as "inactive").
function activityOf(m: ClientAccountRow, supp: RosterSupplement): { label: string; live: boolean } | null {
  if (!m.user_id) return null;
  const last = supp.lastActive.get(m.user_id);
  if (!last) return { label: 'No recorded activity', live: false };
  const d = new Date(last);
  const live = Date.now() - d.getTime() < 60 * 60 * 1000;
  const label = `Active ${d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}`;
  return { label, live };
}

// FLAGS — only what he can act on today. Nothing else.
interface Flag { key: string; label: string }
function flagsOf(m: ClientAccountRow, supp: RosterSupplement): Flag[] {
  const flags: Flag[] = [];
  const cid = m.contact_id ?? '';
  const expired = m.invite_status === 'sent' && m.invite_expires_at
    ? new Date(m.invite_expires_at) < new Date() : false;
  if (m.kind === 'pending' && !m.invite_status) flags.push({ key: 'not_invited', label: 'Not yet invited' });
  if (m.invite_status === 'sent' && !expired) flags.push({ key: 'unclaimed', label: 'Invite sent — unclaimed' });
  if (m.invite_status === 'sent' && expired) flags.push({ key: 'expired', label: 'Invite expired' });
  if (m.invite_status === 'accepted' && m.kind !== 'account') {
    flags.push({ key: 'incomplete_signup', label: 'Signup incomplete' });
  }
  if (supp.outstandingDocs.has(cid)) flags.push({ key: 'outstanding_docs', label: 'Documents outstanding' });
  if (cid && supp.unpaidContacts.has(cid)) flags.push({ key: 'unpaid', label: 'Unpaid' });
  return flags;
}

export function RosterCard({ m, supplement, onOpen }: {
  m: ClientAccountRow; supplement: RosterSupplement; onOpen: (key: string) => void;
}) {
  const ring = ringOf(m);
  const badges = badgesOf(m, supplement);
  const pair = pairOf(m, supplement);
  const { owned, leased } = horsesOf(m, supplement);
  const counts = countsOf(m);
  const activity = activityOf(m, supplement);
  const flags = flagsOf(m, supplement);
  const tags = m.tags ?? [];

  return (
    <button type="button" onClick={() => onOpen(rowKeyOf(m))}
      className="w-full text-left bg-white border border-green-800/10 rounded-xl p-4 hover:border-green-800/30 focus-ring flex flex-col gap-2.5">
      <div className="flex items-center gap-3">
        {/* The ring carries the relationship; no green fill any more (TASK-
            ROSTERCARD). Background stays neutral so the ring colour reads
            cleanly against it. */}
        <span className={`w-11 h-11 rounded-full bg-cream-100 text-green-800 grid place-items-center text-base font-serif font-semibold shrink-0 ring-2 ring-offset-2 ring-offset-white ${RING_CLASS[ring]}`}>
          {initials(m)}
        </span>
        <div className="min-w-0">
          <p className="text-sm font-medium text-green-900 truncate">{memberName(m)}</p>
          <p className="text-[11px] text-muted truncate">{m.email ?? 'no email on file'}</p>
        </div>
      </div>

      {(badges.length > 0 || pair || tags.length > 0) && (
        <div className="flex flex-wrap gap-1">
          {badges.map((b) => (
            <span key={b.key}
              className="text-[10px] font-sans uppercase tracking-wide px-2 py-0.5 rounded-full bg-green-50 text-green-800 border border-green-200">
              {b.label}
            </span>
          ))}
          {pair && (
            <>
              <span className="text-[10px] font-sans uppercase tracking-wide px-2 py-0.5 rounded-full bg-green-50 text-green-800 border border-green-200">Client</span>
              <span className="text-[10px] font-sans uppercase tracking-wide px-2 py-0.5 rounded-full bg-green-50 text-green-800 border border-green-200">
                {pair.role === 'DEPENDENT' ? 'Dependent' : 'Parent'}
              </span>
            </>
          )}
          {/* Free text, uncontrolled — visually distinct from the derived
              badges above (dashed border, muted tone) so a claim never reads
              like a verification. Never blended, never deduped against groups. */}
          {tags.map((t) => (
            <span key={t}
              className="text-[10px] font-sans px-2 py-0.5 rounded-full bg-cream-100 text-secondary border border-dashed border-green-800/25">
              {t}
            </span>
          ))}
        </div>
      )}

      {pair && (
        <p className="text-[11.5px] text-secondary">
          {pair.role === 'DEPENDENT' ? 'Parent' : 'Dependent'}: {pair.names.join(', ')}
        </p>
      )}

      {(owned.length > 0 || leased.length > 0) && (
        <div className="text-[11.5px] text-secondary flex flex-col gap-0.5">
          {owned.length > 0 && <p><span className="text-muted">Owns</span> {owned.join(', ')}</p>}
          {leased.length > 0 && <p><span className="text-muted">Leasing</span> {leased.join(', ')}</p>}
        </div>
      )}

      {(counts.orders > 0 || counts.credits > 0 || counts.lessons > 0) && (
        <div className="flex flex-wrap gap-x-3 text-[11.5px] text-secondary">
          {counts.orders > 0 && <span>{counts.orders} order{counts.orders === 1 ? '' : 's'}</span>}
          {counts.credits > 0 && <span>{counts.credits} credit{counts.credits === 1 ? '' : 's'}</span>}
          {counts.lessons > 0 && <span>{counts.lessons} lesson{counts.lessons === 1 ? '' : 's'}</span>}
        </div>
      )}

      {activity && (
        <p className="text-[11px] text-muted flex items-center gap-1.5">
          {activity.live && <span className="w-1.5 h-1.5 rounded-full bg-green-500 shrink-0" aria-hidden="true" />}
          {activity.label}
        </p>
      )}

      {flags.length > 0 && (
        <div className="flex flex-col gap-1 pt-1.5 border-t border-green-800/[0.06]">
          {flags.map((f) => (
            <span key={f.key} className="text-[11px] text-gold-800 flex items-center gap-1.5">
              <AlertTriangle size={11} className="shrink-0" aria-hidden="true" /> {f.label}
            </span>
          ))}
        </div>
      )}
    </button>
  );
}
