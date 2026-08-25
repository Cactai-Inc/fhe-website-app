/**
 * Single source of truth for the finalized 13-service catalog on the front end.
 *
 * Mirrors the `service_types` lookup seeded in migration 008. The structured fields
 * (code, label, segment, requiresHorse) are kept in lockstep with the database by
 * test/db/service_catalog.test.ts, which fails if the two ever drift — so this file
 * is the one place to change a service label, and the DB is the one home for the
 * longer prose description. Every UI that names a service reads from here.
 */

export type ServiceSegment = 'rider' | 'horse' | 'acquisition' | 'internal';

export interface ServiceTypeDef {
  /** Canonical code, e.g. 'RIDING_LESSON' (security-model §10). */
  code: string;
  /** Human label shown in the UI. */
  label: string;
  segment: ServiceSegment;
  /** Whether a horse record is involved (drives intake/engagement branching). */
  requiresHorse: boolean;
}

export const SERVICE_TYPES: ServiceTypeDef[] = [
  { code: 'HORSE_FINDER',              label: 'Horse Finder',              segment: 'acquisition',  requiresHorse: false },
  { code: 'HORSE_EVALUATION',         label: 'Horse Evaluation',          segment: 'acquisition',  requiresHorse: true },
  { code: 'HORSE_PURCHASE_ASSISTANCE', label: 'Acquisition Assistance',    segment: 'acquisition',  requiresHorse: true },
  { code: 'HORSE_SALE_ASSISTANCE',     label: 'Horse Sale Assistance',     segment: 'acquisition',  requiresHorse: true },
  { code: 'HORSE_LEASE_IN_ASSISTANCE', label: 'Horse Lease-In Assistance', segment: 'acquisition',  requiresHorse: true },
  { code: 'HORSE_LEASE_OUT_ASSISTANCE',label: 'Horse Lease-Out Assistance',segment: 'acquisition',  requiresHorse: true },
  { code: 'HORSE_TRAINING',           label: 'Horse Training',            segment: 'horse',    requiresHorse: true },
  { code: 'HORSE_EXERCISE',           label: 'Horse Exercise',            segment: 'horse',    requiresHorse: true },
  { code: 'HORSE_CLIPPING',           label: 'Horse Clipping',            segment: 'horse',    requiresHorse: true },
  { code: 'RIDING_LESSON',            label: 'Riding Lesson',             segment: 'rider',    requiresHorse: false },
  { code: 'JUMPER_TRAINING',          label: 'Jumper Training',           segment: 'rider',    requiresHorse: false },
  { code: 'HORSEMANSHIP_TRAINING',    label: 'Horsemanship Training',     segment: 'rider',    requiresHorse: false },
  { code: 'INDEPENDENT_CONTRACTOR',   label: 'Independent Contractor',    segment: 'internal', requiresHorse: false },
  { code: 'ONBOARDING',               label: 'Account Onboarding',        segment: 'acquisition',  requiresHorse: false },
];

export const SERVICE_TYPE_BY_CODE: Record<string, ServiceTypeDef> = Object.fromEntries(
  SERVICE_TYPES.map((s) => [s.code, s]),
);

export type ServiceTypeCode = (typeof SERVICE_TYPES)[number]['code'];

/** UI label for a service code (falls back to the code itself if unknown). */
export function serviceLabel(code: string): string {
  return SERVICE_TYPE_BY_CODE[code]?.label ?? code;
}

export function isServiceCode(code: string): boolean {
  return code in SERVICE_TYPE_BY_CODE;
}

/**
 * Maps an existing marketing offering slug → canonical service_type code. Mirrors
 * the offerings reconciliation in migration 008; this is the single bridge between
 * the public catalog (offering slugs) and the CRM service types.
 */
export const OFFERING_SLUG_TO_SERVICE_TYPE: Record<string, string> = {
  'riding-lesson': 'RIDING_LESSON',
  'hunter-jumper': 'JUMPER_TRAINING',
  'horsemanship': 'HORSEMANSHIP_TRAINING',
  'horse-training': 'HORSE_TRAINING',
  'horse-exercise': 'HORSE_EXERCISE',
  'riding-turnout': 'HORSE_EXERCISE', // turnout is exercise-family in the 13-service canon
  'hair-clipping': 'HORSE_CLIPPING',
  'horse-locator': 'HORSE_FINDER',
  'evaluation': 'HORSE_EVALUATION',
  'brokering': 'HORSE_PURCHASE_ASSISTANCE',
};

/** Canonical service code for a marketing offering slug — the one bridge between
 *  the public catalog and the CRM. Returns undefined for an unknown slug. */
export function serviceTypeForOfferingSlug(slug: string): string | undefined {
  return OFFERING_SLUG_TO_SERVICE_TYPE[slug];
}

/* ─── THE EVALUATION LESSON, AND THE ORDER SERVICES ARE OFFERED IN ──────────────
 *
 * ⚠️ `isEvaluationOffering` MATCHES ON THE OFFERING'S NAME. That is the
 * a TENANT FACT HARDCODED IN CODE — and it stops working the
 * day someone renames the offering. It lives here, alone, because there were about
 * to be TWO copies of it (the member shop and the staff provisioning form) and two
 * name-matchers drifting apart is worse than one that is honest about itself.
 * THE REAL FIX is a column on `offerings` saying so; see TASK-DAYSHEET §10.5.
 */
export function isEvaluationOffering(
  o: { name?: string | null; service_type?: string | null },
): boolean {
  return (o.service_type ?? '') === 'RIDING_LESSON' && /evaluation/i.test(o.name ?? '');
}

/** Owner, 2026-08-25: "horsemanship should be shown below lessons, then horse
 *  training then exercise then clipping." Anything not listed keeps its catalog
 *  order AFTER these — a new service type appears rather than being silently
 *  sorted to the front. */
const SERVICE_DISPLAY_ORDER = [
  'RIDING_LESSON',
  'HORSEMANSHIP_TRAINING',
  'HORSE_TRAINING',
  'HORSE_EXERCISE',
  'HORSE_CLIPPING',
];

/** Sort key for a service-type group. Unlisted types sort after every listed one. */
export function serviceDisplayRank(code: string): number {
  const i = SERVICE_DISPLAY_ORDER.indexOf(code);
  return i === -1 ? SERVICE_DISPLAY_ORDER.length : i;
}
