// GENERATED from the DB by scripts/gen-disclosure-labels.mjs — do not edit by hand.
// The single source is disclosure_section_spec(); check-disclosure-labels.mjs fails a
// gate when this file drifts from it. The frontend (src/lib/disclosureMarker.ts) reads
// these labels; the sample script reads the DB directly.
export const DISCLOSURE_FIELD_LABELS = {
  KNOWN_CONDITIONS: ["Description","Trigger","Current or Date of last occurrence","Accommodations"],
  MEDICAL_HISTORY: ["Description","Date","Type","Status"],
  BEHAVIORAL_HISTORY: ["Description","Trigger","Current or Date of last occurrence"],
  INJURIES_TO_HORSE: ["Description","Date or date range","Outcome","Status"],
  MEDICATIONS: ["Name","Purpose","Dose","Frequency","Cost per dose","Rx required"],
  SUPPLEMENTS: ["Name","Purpose","Dose","Frequency","Cost per dose","Rx required"],
};
