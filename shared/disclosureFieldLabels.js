// The box labels, in order, for each disclosure section — the single source for the
// record view (via src/lib/disclosureMarker.ts), the sample generator, and any other
// reader, so none can drift from the record field spec. Plain ESM so both the TypeScript
// app (shared/ is on both tsconfig include paths) and the plain-node scripts can read it.
// The four list sections mirror disclosure_section_spec (…disc_20…); MEDICATIONS and
// SUPPLEMENTS mirror the labels horse_section_entries writes for the medication table.
export const DISCLOSURE_FIELD_LABELS = {
  KNOWN_CONDITIONS: ['Description', 'Trigger', 'Current or Date of last occurrence', 'Accommodations'],
  MEDICAL_HISTORY: ['Description', 'Date', 'Type', 'Status'],
  BEHAVIORAL_HISTORY: ['Description', 'Trigger', 'Current or Date of last occurrence'],
  INJURIES_TO_HORSE: ['Description', 'Date or date range', 'Outcome', 'Status'],
  MEDICATIONS: ['Name', 'Purpose', 'Dose', 'Frequency', 'Cost per dose', 'Rx required'],
  SUPPLEMENTS: ['Name', 'Purpose', 'Dose', 'Frequency', 'Cost per dose', 'Rx required'],
};
