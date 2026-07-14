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

/** Human label for a stored detail key (for the staff inbox). Falls back to a
 *  humanized key if the field config no longer defines it. */
export function categoryFieldLabel(key: string): string {
  for (const fields of Object.values(CATEGORY_FIELDS)) {
    const f = fields?.find((x) => x.key === key);
    if (f) return f.label;
  }
  return key.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase());
}
