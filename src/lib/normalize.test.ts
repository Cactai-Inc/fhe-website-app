import { describe, expect, it } from 'vitest';
import {
  normalizeCity, normalizeEmail, normalizeKindForField, normalizeName, normalizeOnBlur,
  normalizePhone, normalizePostal, normalizeRegion, normalizeStreet, normalizeValue,
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

  it('⚠️ the address fields the owner ADDED in CR-100', () => {
    // These two lines used to assert `toBeNull()`, under the note *"widening this
    // is a product decision, not a tidy-up."* 🔒 CR-100 (owner, 2026-09-01) IS that
    // product decision, made by the same person who set the narrowing — so the
    // assertions are rewritten to the new kinds rather than deleted, and this
    // comment is the record of why they flipped.
    expect(normalizeKindForField('city')).toBe('city');
    expect(normalizeKindForField('address_line1')).toBe('street');
  });

  it('still refuses everything nobody named', () => {
    expect(normalizeKindForField('notes')).toBeNull();
    expect(normalizeKindForField('riding_background')).toBeNull();
    expect(normalizeKindForField('preferred_contact')).toBeNull();
  });

  it('⚠️ the address arms are EXACT keys, so a substring can never reach them', () => {
    // `'capacity'.includes('city')` and `'estate'.includes('state')` are both
    // `true`. The exact-key switch is what stops the next key somebody adds to
    // FIELD_GROUPS being silently address-normalised.
    expect(normalizeKindForField('capacity')).toBeNull();
    expect(normalizeKindForField('estate')).toBeNull();
    expect(normalizeKindForField('statement')).toBeNull();
    expect(normalizeKindForField('zipline')).toBeNull();
    expect(normalizeKindForField('street_view_url')).toBeNull();
  });

  it('maps every key CR-100 named', () => {
    for (const k of ['address_line1', 'address_line2', 'address_street', 'street', 'address', 'country']) {
      expect(normalizeKindForField(k)).toBe('street');
    }
    for (const k of ['city', 'address_city']) {
      expect(normalizeKindForField(k)).toBe('city');
    }
    for (const k of ['state', 'address_state', 'region', 'province']) {
      expect(normalizeKindForField(k)).toBe('region');
    }
    for (const k of ['postal_code', 'zip', 'address_zip', 'zip_code', 'postcode']) {
      expect(normalizeKindForField(k)).toBe('postal');
    }
  });

  it('is case-insensitive on the exact keys too', () => {
    expect(normalizeKindForField('Address_Line1')).toBe('street');
    expect(normalizeKindForField('POSTAL_CODE')).toBe('postal');
  });
});

/* ═══ CR-100 — the address kinds ═══════════════════════════════════════
   The owner's own example, typed the way he typed it:
   `752 windemere ct san diego ca 92109`. */

describe("CR-100 — the owner's address, field by field", () => {
  it('street: 752 windemere ct → 752 Windemere Ct', () => {
    expect(normalizeStreet('752 windemere ct')).toBe('752 Windemere Ct');
  });

  it('city: san diego → San Diego', () => {
    expect(normalizeCity('san diego')).toBe('San Diego');
  });

  it('region: ca → CA', () => {
    expect(normalizeRegion('ca')).toBe('CA');
  });

  it('postal: 92109 stays 92109', () => {
    expect(normalizePostal('92109')).toBe('92109');
  });

  it('apt / suite and country take the street rule', () => {
    expect(normalizeStreet('apt 4b')).toBe('Apt 4b');       // ⚠️ not `4B` — never guess a capital
    expect(normalizeStreet('united states')).toBe('United States');
  });

  it('street and city are literally one transform', () => {
    expect(normalizeCity('san diego')).toBe(normalizeStreet('san diego'));
  });
});

describe('CR-100 — street and city inherit the name rule, whole', () => {
  it('trims and collapses whitespace', () => {
    expect(normalizeStreet('  752   windemere   ct  ')).toBe('752 Windemere Ct');
    expect(normalizeStreet('')).toBe('');
    expect(normalizeStreet('   ')).toBe('');
  });

  it('⚠️ never moves a capital the person typed', () => {
    expect(normalizeStreet('McKinley ave')).toBe('McKinley Ave');
    expect(normalizeStreet("o'farrell st")).toBe("O'farrell St");
    expect(normalizeCity('SAN DIEGO')).toBe('SAN DIEGO');
    expect(normalizeCity('La Jolla')).toBe('La Jolla');
  });

  it('the `po box 12` case, which is now the worked example', () => {
    // The old comment offered this as the objection to widening. It is the
    // honest output of the rule the owner asked for: `po` has no capital, so one
    // is added and nothing else moves. We do NOT guess at `PO`.
    expect(normalizeStreet('po box 12')).toBe('Po Box 12');
    expect(normalizeStreet('PO BOX 12')).toBe('PO BOX 12');
  });

  it('leaves a digit-leading word alone', () => {
    expect(normalizeStreet('752')).toBe('752');
  });
});

describe('CR-100 — region formats what it recognises and mangles nothing else', () => {
  it('uppercases a two-letter code', () => {
    expect(normalizeRegion('ca')).toBe('CA');
    expect(normalizeRegion(' ny ')).toBe('NY');
    expect(normalizeRegion('CA')).toBe('CA');
  });

  it('⚠️ T4 — a spelled-out region comes back EXACTLY as typed', () => {
    // A two-letter rule that also shouted `California` into `CALIFORNIA` would be
    // the silent correction this file exists to prevent.
    expect(normalizeRegion('California')).toBe('California');
    expect(normalizeRegion('california')).toBe('california');
    expect(normalizeRegion('Baja California')).toBe('Baja California');
    expect(normalizeRegion('New South Wales')).toBe('New South Wales');
  });

  it('does not uppercase two characters that are not letters', () => {
    expect(normalizeRegion('12')).toBe('12');
    expect(normalizeRegion('c.')).toBe('c.');
  });

  it('empty stays empty', () => {
    expect(normalizeRegion('   ')).toBe('');
  });
});

describe('CR-100 — postal shapes a US ZIP and nothing else', () => {
  it('passes a 5-digit and a 5+4 ZIP through, trimmed', () => {
    expect(normalizePostal('92109')).toBe('92109');
    expect(normalizePostal('  92109  ')).toBe('92109');
    expect(normalizePostal('92109-1234')).toBe('92109-1234');
  });

  it('⚠️ hyphenates a bare 9-digit ZIP', () => {
    expect(normalizePostal('921091234')).toBe('92109-1234');
    expect(normalizePostal(' 921091234 ')).toBe('92109-1234');
  });

  it('⚠️ returns anything it does not recognise EXACTLY as typed', () => {
    expect(normalizePostal('SW1A 1AA')).toBe('SW1A 1AA');
    expect(normalizePostal('sw1a 1aa')).toBe('sw1a 1aa');
    expect(normalizePostal('9210')).toBe('9210');       // half-typed
    expect(normalizePostal('1234567')).toBe('1234567'); // 7 digits is nothing
    expect(normalizePostal('92109 1234')).toBe('92109 1234');
    expect(normalizePostal('')).toBe('');
  });
});

describe('CR-100 — the address kinds reach normalizeValue and normalizeOnBlur', () => {
  it('the switch dispatches all four', () => {
    expect(normalizeValue('street', '752 windemere ct')).toBe('752 Windemere Ct');
    expect(normalizeValue('city', 'san diego')).toBe('San Diego');
    expect(normalizeValue('region', 'ca')).toBe('CA');
    expect(normalizeValue('postal', '921091234')).toBe('92109-1234');
  });

  it('🔒 THE NO-REFIGHT GUARD covers the new kinds for free', () => {
    // Item 5 of the spec's test: correct our answer back and it stays corrected.
    const street = normalizeOnBlur('street', '752 windemere ct', null);
    expect(street).toBe('752 Windemere Ct');
    expect(normalizeOnBlur('street', '752 Windemere ct', street)).toBe('752 Windemere ct');

    const city = normalizeOnBlur('city', 'san diego', null);
    expect(city).toBe('San Diego');
    expect(normalizeOnBlur('city', 'san Diego', city)).toBe('san Diego');

    const region = normalizeOnBlur('region', 'ca', null);
    expect(region).toBe('CA');
    // `ca` normalises to `CA`, which is what we last produced — so it stands.
    expect(normalizeOnBlur('region', 'ca', region)).toBe('ca');

    const postal = normalizeOnBlur('postal', '921091234', null);
    expect(postal).toBe('92109-1234');
    expect(normalizeOnBlur('postal', '921091234', postal)).toBe('921091234');
  });

  it('a value that is already right registers no correction (T5)', () => {
    expect(normalizeOnBlur('city', 'San Diego', null)).toBe('San Diego');
    expect(normalizeOnBlur('postal', '92109', null)).toBe('92109');
    expect(normalizeOnBlur('region', 'California', null)).toBe('California');
  });
});
