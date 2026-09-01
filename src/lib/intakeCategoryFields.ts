import type { RequestCategory } from './types';

/*
 * C1 — the category-specific fields the public intake form captures. The one
 * form shape-shifts by category: picking "Riding lessons" reveals rider age +
 * experience, "Horse care" reveals horse count + care type, and so on. Answers
 * land in requests.details (jsonb), keyed by `key`. Shared by the public form
 * (render + collect) and the staff inbox (label the stored values), so the two
 * never drift. All optional — the per-channel intake_requirements config owns
 * which base fields are *required*.
 */
export interface IntakeCategoryField {
  key: string;
  label: string;
  type: 'text' | 'number' | 'select' | 'date';
  options?: string[];
  placeholder?: string;
}

export const CATEGORY_FIELDS: Partial<Record<RequestCategory, IntakeCategoryField[]>> = {
  lessons: [
    { key: 'rider_name', label: 'Rider’s name', type: 'text', placeholder: 'If it isn’t you' },
    { key: 'rider_age', label: 'Rider’s age', type: 'text' },
    { key: 'experience_level', label: 'Riding experience', type: 'select',
      options: ['New to riding', 'Beginner', 'Intermediate', 'Advanced'] },
    { key: 'discipline_interest', label: 'Discipline of interest', type: 'text', placeholder: 'Hunter/jumper, dressage…' },
  ],
  horse_care: [
    { key: 'horse_name', label: 'Horse’s name', type: 'text' },
    { key: 'num_horses', label: 'How many horses', type: 'number' },
    { key: 'care_type', label: 'Type of care', type: 'select',
      options: ['Full care', 'Exercise / riding', 'Grooming', 'Clipping', 'Other'] },
    { key: 'horse_location', label: 'Where the horse is kept', type: 'text' },
  ],
  acquisition: [
    { key: 'buy_or_sell', label: 'Buying or selling', type: 'select', options: ['Buying', 'Selling', 'Both'] },
    { key: 'budget', label: 'Budget', type: 'text' },
    { key: 'discipline', label: 'Discipline', type: 'text' },
    { key: 'timeline', label: 'Timeline', type: 'text', placeholder: 'When are you hoping to act?' },
  ],
  media: [
    { key: 'outlet', label: 'Outlet / publication', type: 'text' },
    { key: 'deadline', label: 'Deadline', type: 'date' },
  ],
  partnership: [
    { key: 'brand', label: 'Brand / company', type: 'text' },
    { key: 'website', label: 'Website', type: 'text' },
  ],
};

/** Labels for detail keys that aren't part of CATEGORY_FIELDS (e.g. the lessons
 *  age attestation, which is rendered by a bespoke block, not the generic list). */
const EXTRA_DETAIL_LABELS: Record<string, string> = {
  age_bracket: 'Age',
  rider_declared_age: 'Declared age',
  guardian_approval_acknowledged: 'Guardian approval',
  // TASK-GIFTPATH — the gift form's own fields, not part of CATEGORY_FIELDS
  // because the gift form is hand-built (Gift.tsx), not the generic intake form.
  gift_item: 'What they have in mind',
  recipient_name: "Recipient's name",
  recipient_email: "Recipient's email",
  gift_message: 'Message for the recipient',
  occasion: 'Occasion / timing',
};

/** Human label for a stored detail key (for the staff inbox). Falls back to a
 *  humanized key if the field config no longer defines it. */
export function categoryFieldLabel(key: string): string {
  for (const fields of Object.values(CATEGORY_FIELDS)) {
    const f = fields?.find((x) => x.key === key);
    if (f) return f.label;
  }
  if (EXTRA_DETAIL_LABELS[key]) return EXTRA_DETAIL_LABELS[key];
  return key.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase());
}

/* ─── TASK-CATEGORISE — one label map for the request categories ──────────────
 *
 * The `requests.category` allowlist, in words. It lived twice — the public
 * form's own dropdown list and `api/request-received.ts`'s CATEGORY_LABEL — and
 * the staff category filter needed a third. This file already exists to stop
 * exactly that drift between the public form and the staff inbox, so the map
 * lives here and both read it. (`api/` compiles under its own tsconfig and is
 * left alone.)
 */
export const REQUEST_CATEGORY_LABEL: Record<RequestCategory, string> = {
  general: 'General question',
  lessons: 'Riding lessons',
  horse_care: 'Horse care',
  acquisition: 'Buying or leasing a horse',
  media: 'Media / press',
  partnership: 'Partnership / sponsorship',
  gift: 'Gift enquiry',
};

/** What the PUBLIC form offers. `gift` is absent deliberately: a gift enquiry
 *  has its own form and is never something a visitor picks from this list. */
export const PUBLIC_CATEGORY_OPTIONS: { value: RequestCategory; label: string }[] =
  (['general', 'lessons', 'horse_care', 'acquisition', 'media', 'partnership'] as const)
    .map((value) => ({ value, label: REQUEST_CATEGORY_LABEL[value] }));

/** The label for a stored category value, however old the row is. */
export function requestCategoryLabel(category: string | null | undefined): string {
  if (!category) return 'Uncategorised';
  return REQUEST_CATEGORY_LABEL[category as RequestCategory] ?? category;
}
