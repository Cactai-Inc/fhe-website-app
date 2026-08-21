/**
 * CONTRACTSEND §2 — THE HORSE SECTION IS MATCHED CASE-INSENSITIVELY.
 *
 * The defect this pins (WALK3 F-2): ContractPage compared a field's `section`
 * against the literal `'Horse'` in BOTH of the two places the horse-confirmation
 * control renders, while every template stores the section KEY, `'HORSE'`. The
 * comparison matched nothing, `horseFields` was always empty, the control never
 * rendered, and `contract_lock_blockers`' `horse_unconfirmed` could therefore
 * never be cleared through the browser — no lease on this template could be
 * locked or signed at all.
 *
 * This test guards the DATA half of that pair: it asserts against live rows that
 * the section key really is upper-case, so the old comparison is provably a
 * zero-match and can be recognised if it ever comes back. The RENDER half — that
 * the button is actually on screen and firing `confirm_horse_section` — is
 * proven in a real browser by test/browser (see its README): reach is never
 * concluded from source again (D17).
 */
import { describe, it, expect } from 'vitest';
import fieldRows from './fixtures/averify2-fields.json';
import payloads from './fixtures/contractsend-rpc-payloads.json';

/** The predicate ContractPage now uses (kept in step with `isHorseSection`). */
const isHorseSection = (s: string | null | undefined) =>
  (s ?? '').trim().toUpperCase() === 'HORSE';

type Row = { section: string | null };
const liveDocumentFields = fieldRows as unknown as Row[];
const freshDocumentFields =
  (payloads as { contract_document_detail: { fields: Row[] } }).contract_document_detail.fields;

describe('CONTRACTSEND §2 — horse-section matching', () => {
  for (const [name, rows] of [
    ['a live production lease', liveDocumentFields],
    ['a freshly started lease', freshDocumentFields],
  ] as const) {
    it(`${name} stores the section as 'HORSE', which the old 'Horse' test never matched`, () => {
      const horse = rows.filter((f) => isHorseSection(f.section));
      expect(horse.length, 'no horse-section fields in the fixture').toBeGreaterThan(0);
      // the exact literal the page used to compare against
      expect(rows.filter((f) => (f.section ?? '') === 'Horse')).toHaveLength(0);
      // and every matched row really does carry the upper-case key
      expect(new Set(horse.map((f) => f.section))).toEqual(new Set(['HORSE']));
    });
  }

  it('matches whatever case a template might store, and nothing else', () => {
    expect(['HORSE', 'Horse', 'horse', ' horse '].every(isHorseSection)).toBe(true);
    expect(['HORSES', 'HORSE_CARE', '', null, undefined].some(isHorseSection)).toBe(false);
  });
});
