import { describe, expect, it } from 'vitest';
import {
  normalizeEmail, normalizeKindForField, normalizeName, normalizeOnBlur, normalizePhone,
} from './normalize';

/**
 * TASK-FIX4 §10, criteria 7 and 8.
 *
 * ⚠️ Criterion 8 is the one that needs a test rather than a reading: *"a person's
 * correction is NOT re-normalised — `La buzetta` survives a save."* No pure
 * function can satisfy it, because `normalizeName('La buzetta')` IS `La Buzetta`.
 * It is satisfied by `normalizeOnBlur` remembering what it last produced, and
 * that memory is what the second block below pins.
 */

describe("CR-83's four cases", () => {
  it('capitalises a leading lowercase letter', () => {
    expect(normalizeName('fiszer')).toBe('Fiszer');
  });

  it('does better than nothing on a run-together surname', () => {
    expect(normalizeName('labuzetta')).toBe('Labuzetta');
  });

  it('⚠️ NEVER touches an interior capital', () => {
    expect(normalizeName('LaBuzetta')).toBe('LaBuzetta');
  });

  it('works per WORD, not per field', () => {
    expect(normalizeName('la buzetta')).toBe('La Buzetta');
  });
});

describe('the word rule generalises without over-reaching', () => {
  it('leaves a word that already carries its own capital alone', () => {
    expect(normalizeName('McDonald')).toBe('McDonald');
    expect(normalizeName("O'Brien")).toBe("O'Brien");
  });

  it('⚠️ capitalises a nobiliary particle, and that is the rule working', () => {
    // `van der Berg` becomes `Van Der Berg`: per WORD, a leading lowercase letter
    // is capitalised, and `van` and `der` are words. It is not what a Dutch
    // surname wants — and it is the same trade the owner already accepted for
    // `labuzetta`: *"we cannot be expected to get labuzetta properly changed to
    // LaBuzetta ... the user can adjust it manually on their own."*
    //
    // ⚠️ What makes it safe rather than annoying is the block below: once they
    // put `der` back, the field never touches it again.
    expect(normalizeName('van der Berg')).toBe('Van Der Berg');
    const ours = normalizeOnBlur('name', 'van der Berg', null);
    expect(normalizeOnBlur('name', 'Van der Berg', ours)).toBe('Van der Berg');
  });

  it('fixes the leading lowercase of a hyphenated name and leaves the interior', () => {
    // Deliberate: a hyphen is not a word break. Guessing `Mary-Jane` is the same
    // over-reach as guessing `LaBuzetta`, and the person can fix it themselves.
    expect(normalizeName('mary-jane')).toBe('Mary-jane');
  });

  it('trims and collapses whitespace', () => {
    expect(normalizeName('  elisheva   fiszer ')).toBe('Elisheva Fiszer');
  });

  it('leaves an empty value empty', () => {
    expect(normalizeName('   ')).toBe('');
  });
});

describe('⚠️ a deliberate correction is never re-normalised', () => {
  it('leaves `La buzetta` alone once it is a revision of our own answer', () => {
    // 1 · they type it lowercase; we correct it and remember what we produced.
    const first = normalizeOnBlur('name', 'la buzetta', null);
    expect(first).toBe('La Buzetta');

    // 2 · they revise our answer. Normalising would land back on `La Buzetta`,
    //     which is exactly how we know they meant it — so we return it untouched.
    expect(normalizeOnBlur('name', 'La buzetta', first)).toBe('La buzetta');
  });

  it('still normalises a genuinely NEW value in the same field', () => {
    const first = normalizeOnBlur('name', 'fiszer', null);
    expect(first).toBe('Fiszer');
    // A different surname is not a revision of our answer to the old one.
    expect(normalizeOnBlur('name', 'olenik', first)).toBe('Olenik');
  });

  it('is a no-op when there was nothing to change', () => {
    expect(normalizeOnBlur('name', 'LaBuzetta', null)).toBe('LaBuzetta');
  });
});

describe('phone', () => {
  it('formats a bare 10-digit US number', () => {
    expect(normalizePhone('8585550123')).toBe('(858) 555-0123');
    expect(normalizePhone('858-555-0123')).toBe('(858) 555-0123');
  });

  it('keeps a leading 1 rather than dropping it', () => {
    expect(normalizePhone('1 858 555 0123')).toBe('+1 (858) 555-0123');
  });

  it('⚠️ returns anything it does not recognise EXACTLY as typed', () => {
    // A normaliser that mangles a number to make it fit is the silent correction
    // this whole file exists to prevent — and a wrong phone number, unlike a
    // wrong capital, is not recoverable from what is on screen.
    expect(normalizePhone('+44 20 7946 0958')).toBe('+44 20 7946 0958');
    expect(normalizePhone('858-555-0123 x42')).toBe('858-555-0123 x42');
    expect(normalizePhone('555-0123')).toBe('555-0123');
  });
});

describe('email', () => {
  it('trims and lowercases', () => {
    expect(normalizeEmail('  Elisheva.Fiszer@Example.COM ')).toBe('elisheva.fiszer@example.com');
  });
});

describe('which transform a field asks for', () => {
  it('reads the intent off the field name', () => {
    expect(normalizeKindForField('first_name')).toBe('name');
    expect(normalizeKindForField('emergency_contact_1_name')).toBe('name');
    expect(normalizeKindForField('email')).toBe('email');
    expect(normalizeKindForField('text_only_phone')).toBe('phone');
    expect(normalizeKindForField('whatsapp')).toBe('phone');
  });

  it('⚠️ refuses fields the owner did not name', () => {
    // Widening this is a product decision, not a tidy-up: `po box 12` is not
    // improved by `Po Box 12`.
    expect(normalizeKindForField('city')).toBeNull();
    expect(normalizeKindForField('address_line1')).toBeNull();
    expect(normalizeKindForField('notes')).toBeNull();
  });
});
