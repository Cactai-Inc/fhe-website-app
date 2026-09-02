/**
 * NORMALISATION — SHOWN, NEVER SILENT (CR-83 · CR-84 · CR-100 · TASK-FIX4 §4).
 *
 * Owner, 2026-08-31: *"silent correction is not the way to do it … we should show
 * the normalization by normalizing after they click out of the input field."*
 *
 * So every function here is called **on blur**, in front of the person, and the
 * value they can then see is the value that gets saved. ⚠️ ORDER MATTERS AND IS
 * EASY TO INVERT: normalise FIRST, then auto-save the normalised value. Saving raw
 * and normalising later leaves the stored value and the displayed value
 * disagreeing until the next read.
 *
 * ⚠️ AND THE RULE THAT STOPS IT FIGHTING THE PERSON — the whole reason
 * `normalizeOnBlur` takes a `lastOutput` rather than being a pure function.
 * Owner: *"if the person corrects it to La buzetta that is ok we shouldnt
 * recorrect it."* A field that re-normalises overwrites a deliberate correction
 * and the person cannot win. Two guards enforce it, and both are needed:
 *
 *   1. **Never normalise a value that came out of the database.** Only what was
 *      typed in this session is a candidate. (`useFieldNormalizer` only ever sees
 *      a blur, so a record loaded holding `La buzetta` is never touched.)
 *   2. **Never re-apply an output the person walked back.** If normalising what
 *      is in the box right now would land exactly on the value we last produced
 *      for that same box, they edited our answer on purpose. Leave it.
 *
 * 🔒 CR-100 (owner, 2026-09-01) ADDED THE ADDRESS KINDS — `street`, `city`,
 * `region`, `postal`. *"we need the address fields to normalize the inputs, when
 * i enter my address, 752 windemere ct san diego ca 92109, it stays looking like
 * that it should normalize to capitalize and it should make sure its a valid
 * address somehow."* ⚠️ AND HE BOUNDED "VALID" IN THE SAME BREATH: *"just
 * normalize the inputs dont want to setup google api for paid lookup
 * functionality."* **Format-level shaping only. A ZIP is checked for shape,
 * never for existence.** Nothing here calls anything.
 */

export type NormalizeKind =
  | 'name' | 'phone' | 'email'
  /* CR-100 (owner, 2026-09-01) — the address kinds. See `normalizeKindForField`. */
  | 'street' | 'city' | 'region' | 'postal';

/* ── names ──────────────────────────────────────────────────────────────────
   THE RULE, four cases (CR-83):
     fiszer      → Fiszer      a leading lowercase letter is capitalised
     labuzetta   → Labuzetta   better than nothing; they fix the interior capital
     LaBuzetta   → LaBuzetta   ⚠️ an interior capital is NEVER touched
     la buzetta  → La Buzetta  per WORD, not per field

   The second and third cases are one rule seen from two sides: **a word that
   already carries a capital of its own is left completely alone.** That is what
   protects `LaBuzetta`, `McDonald`, `O'Brien` and `van der Berg`'s `Berg` — and
   it is why the transform can only ever ADD the first capital, never move one.

   Splitting is on WHITESPACE ONLY. Hyphens are deliberately not word breaks:
   `mary-jane` becomes `Mary-jane`, which fixes the leading lowercase the owner
   actually named and leaves the interior to the person, exactly as `labuzetta`
   does. Guessing at `Mary-Jane` would be the same over-reach as guessing
   `LaBuzetta`. */

const UPPER = /\p{Lu}/u;
const LOWER_FIRST = /^\p{Ll}/u;

function capitaliseWord(word: string): string {
  if (UPPER.test(word)) return word;        // it already has a capital — hands off
  if (!LOWER_FIRST.test(word)) return word; // starts with a digit, quote, accent-less symbol
  return word[0].toUpperCase() + word.slice(1);
}

/** Trim, collapse runs of whitespace, and capitalise each word that has no capital. */
export function normalizeName(raw: string): string {
  const trimmed = raw.trim().replace(/\s+/g, ' ');
  if (trimmed === '') return trimmed;
  return trimmed.split(' ').map(capitaliseWord).join(' ');
}

/* ── phone ──────────────────────────────────────────────────────────────────
   The app's own placeholder is `(555) 555-5555`, so that is the shape.
   ⚠️ ANYTHING THAT IS NOT RECOGNISABLY A US NUMBER IS RETURNED UNCHANGED. A
   normaliser that mangles an international number to make it fit is a silent
   correction of exactly the kind this file exists to prevent — and unlike a
   name, a wrong phone number is unrecoverable from what is on screen. */
export function normalizePhone(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed === '') return trimmed;
  // An explicit international prefix that is not +1 is somebody else's format.
  if (trimmed.startsWith('+') && !trimmed.startsWith('+1')) return trimmed;
  const digits = trimmed.replace(/\D/g, '');
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  if (digits.length === 11 && digits.startsWith('1')) {
    const d = digits.slice(1);
    return `+1 (${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
  }
  return trimmed; // extensions, partials, non-US — leave exactly as typed
}

/* ── address ────────────────────────────────────────────────────────────────
   CR-100 (owner, 2026-09-01): *"we need the address fields to normalize the
   inputs, when i enter my address, 752 windemere ct san diego ca 92109, it stays
   looking like that it should normalize to capitalize and it should make sure its
   a valid address somehow."*

   ⚠️ "VALID SOMEHOW" IS FORMAT-LEVEL SHAPING AND NOTHING MORE. The owner closed
   the obvious other reading himself, in the same breath: *"just normalize the
   inputs dont want to setup google api for paid lookup functionality."* So a ZIP
   is checked for SHAPE, never for EXISTENCE — no verification service, no lookup,
   no autocomplete, not now and not behind a flag.

   `street` and `city` are ONE transform under TWO names. They both defer to
   `normalizeName`, so `LaBuzetta`'s rule — only ever ADD the first capital, never
   move one — protects `McKinley Ave` and `O'Farrell St` for free. The two names
   exist so a reader of a call site can see what the field is. */

/** `752 windemere ct` → `752 Windemere Ct`. `normalizeName`'s word rule, reused. */
export function normalizeStreet(raw: string): string {
  return normalizeName(raw);
}

/** `san diego` → `San Diego`. Identical to `normalizeStreet`; named for the reader. */
export function normalizeCity(raw: string): string {
  return normalizeName(raw);
}

/* ⚠️ `region` and `postal` follow `normalizePhone`'s precedent above, and its
   reasoning binds them: FORMAT WHAT IS RECOGNISABLE, NEVER MANGLE WHAT IS NOT.
   A two-letter uppercase rule that also shouted `California` into `CALIFORNIA`
   would be the silent correction this file exists to prevent — so anything that
   is not a two-letter code comes back EXACTLY as typed. */

/** `ca` → `CA`. `California`, `Baja California`, `Île-de-France` → untouched. */
export function normalizeRegion(raw: string): string {
  const trimmed = raw.trim();
  if (/^\p{L}{2}$/u.test(trimmed)) return trimmed.toUpperCase();
  return trimmed;
}

/** `92109` → `92109`; ` 921091234 ` → `92109-1234`; `SW1A 1AA` → untouched. */
export function normalizePostal(raw: string): string {
  const trimmed = raw.trim();
  if (/^\d{5}$/.test(trimmed) || /^\d{5}-\d{4}$/.test(trimmed)) return trimmed;
  if (/^\d{9}$/.test(trimmed)) return `${trimmed.slice(0, 5)}-${trimmed.slice(5)}`;
  return trimmed; // non-US, partial, PO-box-with-letters — leave exactly as typed
}

/* ── email ──────────────────────────────────────────────────────────────── */
/** Trim and lowercase. Owner: *"if we make the email addresses all lowercase we
 *  can show that too."* */
export function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

/** Apply the transform for `kind`. Pure — no memory of what the person did. */
export function normalizeValue(kind: NormalizeKind, raw: string): string {
  switch (kind) {
    case 'name': return normalizeName(raw);
    case 'phone': return normalizePhone(raw);
    case 'email': return normalizeEmail(raw);
    case 'street': return normalizeStreet(raw);
    case 'city': return normalizeCity(raw);
    case 'region': return normalizeRegion(raw);
    case 'postal': return normalizePostal(raw);
  }
}

/**
 * What the field should hold after blur — the function the UI actually calls.
 *
 * @param lastOutput the value this same field was last normalised TO, or null if
 *   we have never changed it. ⚠️ This is the whole "do not fight the person"
 *   mechanism: if normalising what is in the box now would land back on our own
 *   previous answer, they revised it deliberately and we return it untouched.
 */
export function normalizeOnBlur(
  kind: NormalizeKind,
  raw: string,
  lastOutput: string | null,
): string {
  const next = normalizeValue(kind, raw);
  if (next === raw) return raw;                              // nothing to show them
  if (lastOutput !== null && next === lastOutput) return raw; // they walked our answer back
  return next;
}

/* ── which transform a field asks for ───────────────────────────────────────
   ⚠️ THIS SET WAS DELIBERATELY NARROW AND THE OWNER HIMSELF WIDENED IT. The
   original note said: *"Owner named three things — names, phone numbers, email
   lowercasing — and a city or a street is NOT one of them. Widening this is a
   product decision, not a tidy-up: `po box 12` is not improved by `Po Box 12`."*

   🔒 CR-100 (owner, 2026-09-01) IS THAT PRODUCT DECISION, MADE BY THE SAME
   PERSON WHO SET THE NARROWING: *"we need the address fields to normalize the
   inputs … it should normalize to capitalize."* Addresses are IN. The narrowing
   is superseded, not overruled — this is its stated escape hatch, taken.

   And `po box 12` is now the WORKED EXAMPLE rather than the objection: `po` has
   no capital of its own, so the rule adds one and stops — `Po Box 12`. That is
   the honest output of the transform the owner asked for. It does not guess at
   `PO`, because guessing at a capital nobody typed is the `LaBuzetta` defect. */

/**
 * Which transform a field name asks for, or null for "do not normalise this".
 *
 * ⚠️ THE ADDRESS KINDS MATCH ON EXACT KEYS, AND THEY MATCH FIRST. The arms below
 * them use `String.includes()`, and `'capacity'.includes('city')` is `true` —
 * so is `'estate'.includes('state')`. This function is advertised at
 * `ContactDossierModal.tsx:519` as wiring a new row without anyone remembering
 * to, which means the trap is the NEXT key somebody adds, not today's.
 * **Exact keys. That is the rule. Do not "simplify" them into the substring arm.**
 */
export function normalizeKindForField(field: string): NormalizeKind | null {
  const f = field.toLowerCase();
  switch (f) {
    // A country is words, so it takes the street/name word rule.
    case 'address_line1': case 'address_line2': case 'address_street':
    case 'street': case 'address': case 'country':
      return 'street';
    case 'city': case 'address_city':
      return 'city';
    case 'state': case 'address_state': case 'region': case 'province':
      return 'region';
    case 'postal_code': case 'zip': case 'address_zip': case 'zip_code': case 'postcode':
      return 'postal';
  }
  if (f.includes('email')) return 'email';
  if (f.includes('phone') || f.includes('mobile') || f.includes('whatsapp')) return 'phone';
  if (f.includes('name')) return 'name';
  return null;
}
