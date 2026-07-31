/**
 * WHERE AN IMPORTED FIELD'S VALUE COMES FROM.
 *
 * Some contract fields are not authored in the contract at all — they are copies
 * of data that lives on the horse record or a party's contact record, refreshed
 * whenever the document is regenerated. Editing them here would be editing a
 * copy: the next regeneration overwrites it, and the record everything else
 * reads stays wrong.
 *
 * So each of these carries a tip naming its true home. This REPLACED the old
 * per-field guidance bubbles, which said what a field meant but never where it
 * came from — the more useful fact, and the one that tells you where to go when
 * the value is wrong.
 *
 * Keyed on the part after the namespace, so LESSOR.PHONE and LESSEE.PHONE share
 * one entry.
 */

export interface FieldSource {
  /** Where the value actually lives, in the words the UI uses for that screen. */
  record: string;
  /** The field's name on that record. */
  field: string;
}

const HORSE_SOURCES: Record<string, string> = {
  REGISTERED_NAME: 'Registered name',
  BARN_NAME: 'Barn name',
  BREED: 'Breed',
  COLOR: 'Color',
  MARKINGS: 'Markings',
  SEX: 'Sex',
  AGE_DOB: 'Date of birth',
  HEIGHT: 'Height',
  REGISTRATION_NUMBER: 'Registration number',
  MICROCHIP: 'Microchip',
  PASSPORT_NUMBER: 'Passport number',
  CURRENT_LOCATION: 'Current location',
  HOME_LOCATION: 'Home location',
  FAIR_MARKET_VALUE: 'Fair market value',
  VET_NAME: 'Veterinarian',
  VET_PHONE: 'Vet phone',
  VET_BUSINESS: 'Vet practice',
  VET_ADDRESS: 'Vet address',
  FARRIER_NAME: 'Farrier',
  FARRIER_PHONE: 'Farrier phone',
  KNOWN_CONDITIONS: 'Known conditions',
  MEDICATION_NAME: 'Medications',
  MEDICATION_DOSAGE: 'Medications',
  MEDICATION_INSTRUCTIONS: 'Medications',
  MEDICATION_ADDITIONAL: 'Medications',
};

const PARTY_SOURCES: Record<string, string> = {
  FULL_NAME: 'Name',
  PRINTED_NAME: 'Name',
  EMAIL: 'Email',
  PHONE: 'Phone',
  ADDRESS: 'Mailing address',
  PARTY_TYPE: 'Person or company',
};

/** The record and field a contract field is imported from, or null when the
 *  value is authored in the contract itself. */
export function fieldSource(fieldKey: string): FieldSource | null {
  const [ns, ...rest] = fieldKey.split('.');
  const name = rest.join('.');
  if (ns === 'HORSE' && HORSE_SOURCES[name]) {
    return { record: 'the horse record', field: HORSE_SOURCES[name] };
  }
  if ((ns === 'LESSOR' || ns === 'LESSEE' || ns === 'PARTY') && PARTY_SOURCES[name]) {
    const who = ns === 'PARTY' ? 'that party' : ns.charAt(0) + ns.slice(1).toLowerCase();
    return { record: `${who}'s contact record`, field: PARTY_SOURCES[name] };
  }
  return null;
}

/** The tip shown on hover/focus. Names the destination and says plainly that a
 *  change there flows back here, so nobody hunts for an edit control that
 *  deliberately does not exist. */
export function fieldSourceTip(fieldKey: string): string | null {
  const s = fieldSource(fieldKey);
  if (!s) return null;
  return `Imported from ${s.record} (${s.field}). Change it there and it updates here automatically.`;
}
