import { contactName } from './types';
import type { DocumentPartyRow, DocumentPartyRole, DocumentSignatureRow, DocumentQueueRow } from './types';

/**
 * TASK-DOCCOLS (20260811) — the one place `party_role` becomes a Party 1 /
 * Party 2 cell. Do not scatter `if (role === …)` through a cell renderer, and
 * do not hardcode a per-template-key list.
 *
 * The rule, measured against production: a document's parties are the DISTINCT
 * CONTACTS on it, not the distinct role rows — 37 of 41 CLIENT+PARTICIPANT
 * pairs are the same adult signing their own release (party 2 collapses into
 * party 1), and only 4 are a parent signing for a different, dependent contact
 * (party 2 = "Dependent"). `PARENT`/`GUARDIAN` are never written — the parent
 * case lives entirely in that CLIENT+PARTICIPANT-different-contact shape, so
 * this module must never key off `party_role === 'PARENT'`.
 */

const ROLE_LABELS: Record<DocumentPartyRole, string> = {
  CLIENT: 'Client',
  BUYER: 'Buyer',
  SELLER: 'Seller',
  LESSOR: 'Lessor',
  LESSEE: 'Lessee',
  OWNER: 'Owner',
  RIDER: 'Rider',
  PARTICIPANT: 'Participant',
  PARENT: 'Parent',
  GUARDIAN: 'Guardian',
  EMERGENCY_CONTACT: 'Emergency Contact',
  CONTRACTOR: 'Contractor',
  FACILITY_CONTACT: 'Facility Contact',
  FHE: 'FHE',
};

/**
 * Party-1-vs-party-2 seniority. Lower sorts first. Only two pairs of this
 * table are exercised by live data (2026-08-11): LESSOR before LESSEE, and
 * CLIENT before PARTICIPANT (the latter only reached via the generic branch
 * below when the CLIENT+PARTICIPANT special case doesn't apply — e.g. a
 * CLIENT alone). SELLER/BUYER and every other pairing have zero rows —
 * declared unexercised in the task report, not proven against real data.
 */
const ROLE_RANK: Record<DocumentPartyRole, number> = {
  LESSOR: 0,
  SELLER: 0,
  OWNER: 1,
  CLIENT: 2,
  PARENT: 2,
  GUARDIAN: 2,
  FHE: 3,
  CONTRACTOR: 4,
  FACILITY_CONTACT: 4,
  EMERGENCY_CONTACT: 5,
  RIDER: 5,
  LESSEE: 10,
  BUYER: 10,
  PARTICIPANT: 10,
};

function roleLabel(role: DocumentPartyRole): string {
  return ROLE_LABELS[role] ?? role;
}

function roleRank(role: DocumentPartyRole): number {
  return ROLE_RANK[role] ?? 6;
}

export interface PartyDisplay {
  contactId: string;
  /** The party_role actually used to derive the label/rank for this party —
   *  the lowest-rank role the contact holds on the document when they hold
   *  more than one (e.g. CLIENT+PARTICIPANT, same contact → 'CLIENT'). */
  role: DocumentPartyRole;
  /** The identifier shown WITH the name — 'Lessor', 'Parent', etc. Overridden
   *  to 'Parent'/'Dependent' by the one named special case; otherwise the
   *  plain role label. */
  label: string;
  name: string;
  /** The org itself acting as a party (`contacts.is_company`) — render as the
   *  company, not a person: no dossier link exists for it. */
  isCompany: boolean;
}

export interface DocumentPartiesDisplay {
  party1: PartyDisplay | null;
  party2: PartyDisplay | null;
}

interface PartyContact {
  contactId: string;
  name: string;
  isCompany: boolean;
  roles: Set<DocumentPartyRole>;
  bestRole: DocumentPartyRole;
  order: number;
}

function toDisplay(c: PartyContact, role: DocumentPartyRole, label: string): PartyDisplay {
  return { contactId: c.contactId, role, label, name: c.name, isCompany: c.isCompany };
}

/**
 * Collapse a document's `document_parties` rows into Party 1 / Party 2.
 *
 * Grouping is by CONTACT, not by role row — a contact holding two roles on
 * one document (the 37-of-41 case) is one party. Ordering is by role rank,
 * never insertion/signer_order (signer_order is only a tie-break for two
 * distinct contacts who'd otherwise rank equal).
 *
 * A document with more than two distinct contacts has never been observed in
 * production (max is 2, 2026-08-11) — if one occurs, this keeps the two
 * highest-ranked and silently drops the rest rather than growing a Party 3
 * column the task never asked for. Flagged in the task report as a known
 * limitation, not a proven one.
 */
export function deriveDocumentParties(rows: DocumentPartyRow[]): DocumentPartiesDisplay {
  if (rows.length === 0) return { party1: null, party2: null };

  const byContact = new Map<string, PartyContact>();
  for (const row of rows) {
    const name = row.contact ? (contactName(row.contact) || (row.contact.is_company ? 'FHE' : '—')) : '—';
    const isCompany = row.contact?.is_company ?? false;
    const existing = byContact.get(row.contact_id);
    if (existing) {
      existing.roles.add(row.party_role);
      if (roleRank(row.party_role) < roleRank(existing.bestRole)) existing.bestRole = row.party_role;
      if (row.signer_order != null) existing.order = Math.min(existing.order, row.signer_order);
    } else {
      byContact.set(row.contact_id, {
        contactId: row.contact_id,
        name,
        isCompany,
        roles: new Set([row.party_role]),
        bestRole: row.party_role,
        order: row.signer_order ?? Number.POSITIVE_INFINITY,
      });
    }
  }

  const contacts = [...byContact.values()];

  if (contacts.length === 1) {
    const c = contacts[0];
    return { party1: toDisplay(c, c.bestRole, roleLabel(c.bestRole)), party2: null };
  }

  // The one named special case: CLIENT + PARTICIPANT, DIFFERENT contacts, is
  // Parent + Dependent — not the generic rank ordering below. CLIENT does not
  // mean "Parent" on its own (see the 35 CLIENT-alone / 37 same-contact rows,
  // which never reach this branch).
  const clientContact = contacts.find((c) => c.roles.has('CLIENT'));
  const participantContact = contacts.find((c) => c.roles.has('PARTICIPANT'));
  if (contacts.length === 2 && clientContact && participantContact && clientContact !== participantContact) {
    return {
      party1: toDisplay(clientContact, 'CLIENT', 'Parent'),
      party2: toDisplay(participantContact, 'PARTICIPANT', 'Dependent'),
    };
  }

  const ordered = [...contacts].sort((a, b) =>
    roleRank(a.bestRole) - roleRank(b.bestRole) || a.order - b.order || a.contactId.localeCompare(b.contactId));
  const [first, second] = ordered;
  return {
    party1: toDisplay(first, first.bestRole, roleLabel(first.bestRole)),
    party2: second ? toDisplay(second, second.bestRole, roleLabel(second.bestRole)) : null,
  };
}

/** Date Signed — `max(signed_at)` over non-deleted signature rows. There is no
 *  `documents.signed_at` column (measured 2026-08-11); every EXECUTED document
 *  is fully signed and nothing else has a single signature, but this derives
 *  from the data rather than assuming "signed ⇔ EXECUTED" will always hold. */
export function deriveDateSigned(signatures: DocumentSignatureRow[]): string | null {
  let max: string | null = null;
  for (const s of signatures) {
    if (s.deleted_at || !s.signed_at) continue;
    if (!max || new Date(s.signed_at).getTime() > new Date(max).getTime()) max = s.signed_at;
  }
  return max;
}

export interface VersionDisplay {
  version: number | null;
  /** True when a signed document's version differs from the template's
   *  current version — the wording moved on after signing. */
  drift: boolean;
  currentVersion: number | null;
}

/** `signed_template_version` where it exists (61 of 82 rows, exactly the
 *  EXECUTED set, 2026-08-11); the template's CURRENT version for an unsigned
 *  document, since that's what it would compose from today. Flags drift when
 *  a signed document's version differs from where the template sits now — 20
 *  of 61 signed rows, not a rare case, so the UI must surface it, not bury it
 *  in a tooltip nobody opens. */
export function deriveVersion(doc: Pick<DocumentQueueRow, 'signed_template_version' | 'template'>): VersionDisplay {
  const currentVersion = doc.template?.version ?? null;
  if (doc.signed_template_version != null) {
    return {
      version: doc.signed_template_version,
      currentVersion,
      drift: currentVersion != null && currentVersion !== doc.signed_template_version,
    };
  }
  return { version: currentVersion, currentVersion, drift: false };
}
