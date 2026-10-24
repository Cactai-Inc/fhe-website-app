/* documentPdf (server) — the serverless surface over the shared PDF core.
 *
 * The layout engine lives in shared/documentPdf.ts, imported by BOTH this file
 * and src/lib/documentPdf.ts so the emailed copy and the in-app download are one
 * implementation (they used to be two hand-synced copies that drifted on margin,
 * token resolution, and type syntax). This file adds only the server-only piece:
 * the signer-attributed party-copy filename. Everything else re-exports.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { DisclosureEntries as DisclosureEntriesT, DisclosureEntry } from '../../shared/documentPdf.js';

export {
  renderDocumentPdf, pdfFileName, resolveUnsignedSignatureTokens,
  disclosureMarkerSection,
} from '../../shared/documentPdf.js';
export type {
  DisclosureField, DisclosureEntry, DisclosureEntries,
} from '../../shared/documentPdf.js';

/** The seven record-fed disclosure sections (INJURIES_TO_HUMANS is a scalar, not
 *  entries, so it is absent). */
const DISCLOSURE_SECTIONS = [
  'KNOWN_CONDITIONS', 'MEDICAL_HISTORY', 'BEHAVIORAL_HISTORY',
  'INJURIES_TO_HORSE', 'MEDICATIONS', 'SUPPLEMENTS',
] as const;

/** Read a document's frozen disclosure entries from its own stored field values
 *  (contract_fields.structured for HORSE.<SECTION>), so the server-rendered
 *  executed PDF carries the boxed entries — the same source the in-app download
 *  uses. Part 6: the emailed PDF attachment shows boxes; only the email BODY and
 *  the frozen text snapshot fall back to text. */
export async function fetchDocumentDisclosureEntries(
  db: SupabaseClient, documentId: string,
): Promise<DisclosureEntriesT> {
  const { data, error } = await db
    .from('contract_fields')
    .select('field_key, structured')
    .eq('document_id', documentId)
    .in('field_key', DISCLOSURE_SECTIONS.map((s) => `HORSE.${s}`));
  const out: DisclosureEntriesT = {};
  if (error || !data) return out;
  for (const row of data as { field_key: string; structured: unknown }[]) {
    const section = row.field_key.replace(/^HORSE\./, '');
    const raw = row.structured;
    if (!Array.isArray(raw)) continue;
    const entries: DisclosureEntry[] = [];
    for (const entry of raw) {
      if (!Array.isArray(entry)) continue;
      entries.push(entry
        .filter((p): p is { label?: unknown; value?: unknown } => !!p && typeof p === 'object')
        .map((p) => ({ label: String(p.label ?? ''), value: String(p.value ?? '') })));
    }
    if (entries.length) out[section] = entries;
  }
  return out;
}

/** The signer-attributed party-copy filename (owner spec, 2026-08-02), e.g.
 *  "General Visitor Liability Release" + "CJ Z" + 2026-08-02 ->
 *  "General_Visitor_Liability_Release_CJ-Z_French-Heritage-Equestrian_08_02_26.pdf".
 *  Underscored title, signer name, tenant brand, MM_DD_YY execution date —
 *  distinct from pdfFileName (used by the multi-document/company sends). */
export function partyPdfFileName(
  title: string,
  signerFirstName: string | null | undefined,
  signerLastName: string | null | undefined,
  executedAt: Date,
  /** The tenant's own name. Owner, 2026-08-24: "we lost the file name
   *  personalization, the names are generic, it doesnt have our company name nor
   *  the persons name." Optional so the one-argument callers keep working. */
  brandName?: string | null,
): string {
  const slug = (v: string, max: number) => (v || '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, max);
  const base = slug(title || 'Document', 60) || 'Document';
  /* ⚠️ THE PERSON'S NAME, not their initials. The 2026-08-02 spec used lowercase
     initials ("cjz"), which is unreadable in a Downloads folder six months later
     and is what the owner is describing as missing. Full name where we have it,
     falling back to initials, falling back to nothing. */
  const who = slug([signerFirstName, signerLastName].filter(Boolean).join(' '), 40)
    || [signerFirstName, signerLastName].map((n) => (n || '').trim().charAt(0)).join('').toLowerCase();
  const brand = slug(brandName ?? '', 40);
  const mm = String(executedAt.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(executedAt.getUTCDate()).padStart(2, '0');
  const yy = String(executedAt.getUTCFullYear()).slice(-2);
  // Document first — it is what the reader is looking for; then who signed it,
  // then whose paperwork it is, then when.
  return [base, who, brand, `${mm}_${dd}_${yy}`].filter(Boolean).join('_') + '.pdf';
}
