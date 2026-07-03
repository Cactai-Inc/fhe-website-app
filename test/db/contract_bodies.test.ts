/**
 * Phase 2 — tokenized contract bodies vs. the dictionary (owner template
 * revision 2026-07-03; docs/TOKEN_DICTIONARY.md is the canon). For every
 * tokenized body in supabase/contract_templates/:
 *  - every {{TOKEN}} resolves to a dictionary entry (template_tokens, global) —
 *    either literally (e.g. the CLIENT-specific profile fields) or after
 *    normalizing party namespaces (BUYER/SELLER/… → PARTY; SIG.* → SIG.PARTY),
 *  - it only uses recognized namespaces (party namespaces + the non-party input
 *    namespaces ORD/REQ and the ORG/HORSE/TXN/ENG/DOC/SIG/DIR sets),
 *  - it never resurrects a retired STANDALONE service offering.
 *
 * This is the "no orphan tokens" gate; it runs per file, so each contract is
 * guarded the moment its body lands.
 */
import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join, dirname, resolve, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createTestDb, type TestDb } from './harness';

const BODIES_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '../../supabase/contract_templates');

const PARTY_NS = new Set([
  'BUYER', 'SELLER', 'LESSOR', 'LESSEE', 'CLIENT', 'OWNER',
  'PARTICIPANT', 'CONTRACTOR', 'PARENT', 'GUARDIAN', 'RIDER',
  'COMPANY', 'EMERGENCY_CONTACT',
]);
const KILLED = /grooming|horse care|bathing|mane[- ]pull|turnout[- ]assist|show[- ]prep|tack[- ]clean/i;
// What the killed-service scan actually guards: no retired STANDALONE service
// offering may resurface as its own agreement / order form. The owner's
// 2026-07-03 revision legitimately says these words in exactly two sanctioned
// places, both exempt from the scan:
//  - order forms list them as ACTIVITY NAMES inside a live offering (the
//    "Available services:" line of HORSE_EXERCISE names Turnout / Clipping /
//    Bathing / Grooming as activities within the exercise offering),
//  - the RELEASE_* documents authorize and release routine care, grooming, and
//    husbandry — that is the release's own subject matter, not a sold service —
//    so releases are scanned by their title line only.
const ACTIVITY_LINE = /^(?:Available services|Instruction may include).*$/gim;

// ── Stripped service agreements (liability-release pass) ─────────────────────
// The embedded release / assumption-of-risk / hold-harmless sections were
// removed from these agreements; the protections live exclusively in the
// standalone RELEASE_* documents, incorporated by this exact clause.
// RIDER_LESSON_JUMPER is deliberately NOT in this set: the owner's 2026-07-03
// revision makes the jumper addendum a release ADDENDUM — it extends the
// Participant Release to jumping risks and carries release language BY DESIGN.
// MINOR_RIDER is retired (no source file).
const STRIPPED_AGREEMENTS = new Set([
  'HORSE_EXERCISE', 'HORSE_TRAINING',
  'HORSEMANSHIP_TRAINING', 'HORSE_SEARCH_RETAINER',
  // contract-module decomposition: HORSE_REPRESENTATION retired (folded into the
  // finder's lease directions); the reworked evaluation module and the new
  // transaction-representation module are service agreements → stripped too.
  'HORSE_EVALUATION', 'HORSE_TRANSACTION_REP',
  // owner revision 2026-07-03: the lesson order form and the Company Policies
  // are CLIENT-signer commercial documents — no embedded release language.
  'RIDER_LESSON', 'COMPANY_POLICIES',
]);
// The canonical incorporation clause (heading + sentence) — the ONLY sanctioned
// release-adjacent wording in a stripped agreement (owner revision 2026-07-03:
// the "INCORPORATED DOCUMENTS" section of the retainer/representation modules).
const INCORPORATION_CLAUSE =
  /INCORPORATED DOCUMENTS\n\nThe risk acknowledgments, releases, and indemnity obligations applicable to activities under this Agreement are set forth exclusively in the separately executed liability release and assumption of risk agreements, incorporated herein by reference\./g;
// The release phrase families that must NOT survive in a stripped agreement:
// the discharge operative words, ASSUMPTION OF RISK as a section heading, and
// hold-harmless obligations.
const RELEASE_PHRASES = [
  /releases and (?:forever )?discharges/i,
  /^(?:\d+\.\s*)?ASSUMPTION OF RISKS?$/m,
  /hold harmless/i,
  /indemnif/i,
];

/** Normalize a contract token to its dictionary form (PARTY placeholder). */
function normalize(token: string): string {
  const parts = token.slice(2, -2).split('.'); // strip {{ }}
  if (parts[0] === 'SIG') { parts[1] = 'PARTY'; return `{{${parts.join('.')}}}`; }
  if (PARTY_NS.has(parts[0])) parts[0] = 'PARTY';
  return `{{${parts.join('.')}}}`;
}

function tokensIn(body: string): string[] {
  return Array.from(body.matchAll(/\{\{[A-Z0-9_.]+\}\}/g)).map((m) => m[0]);
}

function bodyFiles(): string[] {
  try {
    return readdirSync(BODIES_DIR).filter((f) => f.endsWith('.md'));
  } catch {
    return [];
  }
}

let h: TestDb;
let dict: Set<string>;
let templateParties: Record<string, string[]>;

beforeAll(async () => {
  h = await createTestDb();
  await h.asSuperuser();
  dict = new Set(
    (await h.q<{ token: string }>(`select token from template_tokens where template_id is null`)).map((r) => r.token),
  );
  templateParties = Object.fromEntries(
    (await h.q<{ template_key: string; party_namespaces: string[] }>(
      `select template_key, party_namespaces from contract_templates`)).map((r) => [r.template_key, r.party_namespaces]),
  );
});
afterAll(async () => {
  await h?.close();
});

describe('tokenized contract bodies', () => {
  const files = bodyFiles();

  it('has at least one tokenized body to check', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  for (const file of files) {
    const key = basename(file, '.md');

    describe(key, () => {
      const body = readFileSync(join(BODIES_DIR, file), 'utf8');
      const tokens = tokensIn(body);

      it('maps to a known contract_templates row', () => {
        expect(templateParties[key], `${key} not seeded in contract_templates`).toBeDefined();
      });

      it('uses only tokens that exist in the dictionary', () => {
        // A token resolves if the dictionary carries it LITERALLY (the
        // CLIENT-specific profile/attestation fields, ORD/REQ inputs, …) or via
        // the PARTY placeholder (the shared person field set + signatures).
        const orphans = [...new Set(tokens)].filter((t) => !dict.has(t) && !dict.has(normalize(t)));
        expect(orphans, `orphan tokens in ${file}`).toEqual([]);
      });

      it('only uses recognized party namespaces', () => {
        // The orphan-token check already proves every token resolves; this guards
        // that any party-shaped namespace is a real one. (Per-contract party sets
        // can drift from the seed metadata, so we don't assert subset-of-seed.)
        // FHE is deliberately NOT recognized: bodies must use the tenant-neutral
        // ORG.* / COMPANY tokens as of the Contracts Legal Pass. DIR is the
        // directional-terminology namespace (contract-module decomposition):
        // resolved from the engagement's current stage via template_variants.
        // ORD (order instance) and REQ (request inputs submitted with an order)
        // are NON-party input namespaces of the owner's 2026-07-03 order forms.
        const known = new Set([...PARTY_NS, 'ORG', 'HORSE', 'TXN', 'ENG', 'DOC', 'SIG', 'DIR', 'ORD', 'REQ']);
        const unknown = new Set<string>();
        for (const t of tokens) {
          const ns = t.slice(2, -2).split('.')[0];
          if (!known.has(ns)) unknown.add(ns);
        }
        expect([...unknown], `${key} has unrecognized namespaces`).toEqual([]);
      });

      it('contains no killed-service references (no retired standalone offering)', () => {
        // Releases COVER these activities as their subject matter → title-only
        // scan; everywhere else, activity-name list lines are exempt.
        const scanned = key.startsWith('RELEASE_')
          ? body.slice(0, body.indexOf('\n'))
          : body.replace(ACTIVITY_LINE, '');
        const hit = scanned.match(KILLED);
        expect(hit, `killed-service term in ${file}: ${hit?.[0]}`).toBeNull();
      });

      // Owner directive (liability-release pass): release / assumption-of-risk /
      // hold-harmless protections live EXCLUSIVELY in the standalone RELEASE_*
      // documents. The stripped service agreements may only carry the canonical
      // incorporation-by-reference clause. Allowlisted by design: the RELEASE_*
      // files themselves, RIDER_LESSON_JUMPER (a release ADDENDUM extending the
      // Participant Release to jumping — owner decision 2026-07-03),
      // FACILITY_RULES (the property-rules acknowledgment keeps its own risk
      // language), HORSE_EMERGENCY_VET (its release/indemnity is scoped to
      // good-faith emergency-care decisions — its narrow authorization subject),
      // and HUMAN_EMERGENCY_MEDICAL (not a service agreement).
      if (STRIPPED_AGREEMENTS.has(key)) {
        it('carries no embedded release language (stripped to the incorporation clause)', () => {
          const stripped = body.replace(INCORPORATION_CLAUSE, '');
          for (const phrase of RELEASE_PHRASES) {
            const hit = stripped.match(phrase);
            expect(hit, `embedded release language in ${file}: ${hit?.[0]}`).toBeNull();
          }
        });
      }
    });
  }
});
