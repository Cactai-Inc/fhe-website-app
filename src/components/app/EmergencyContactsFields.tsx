/* F7 (2026-10-26) — one way to collect emergency contacts, used by every form that
 * collects them. Each contact is its OWN group spanning the full row: a heading
 * ("Contact 1" / "Contact 2") and three columns inside — name, relationship, phone.
 * Never interleaved in a shared two-column grid.
 *
 * Contact 1 is required; Contact 2 is optional. An entry whose name OR phone matches
 * the person's own name or phone is refused — an emergency contact is someone ELSE.
 * The refusal is a message under the field, and `selfError()` lets the submitting form
 * block the save on the same rule (the browser is not the authority).
 */
import type { ReactNode } from 'react';

export interface EmergencyContact {
  name: string;
  relationship: string;
  phone: string;
}

/** The six values, flat, matching the contacts.emergency_contact_1/2_* columns. */
export interface EmergencyContactValues {
  emergency_contact_1_name: string;
  emergency_contact_1_relationship: string;
  emergency_contact_1_phone: string;
  emergency_contact_2_name: string;
  emergency_contact_2_relationship: string;
  emergency_contact_2_phone: string;
}

const digits = (v: string) => v.replace(/\D/g, '');

/** Does this contact's name or phone match the person's own? An emergency contact
 *  must be someone else. Name match is case/space-insensitive; phone match compares
 *  digits only. Empty values never match. */
export function matchesSelf(
  contact: { name: string; phone: string },
  self: { name: string; phone: string },
): 'name' | 'phone' | null {
  const cn = contact.name.trim().toLowerCase().replace(/\s+/g, ' ');
  const sn = self.name.trim().toLowerCase().replace(/\s+/g, ' ');
  if (cn && sn && cn === sn) return 'name';
  const cp = digits(contact.phone);
  const sp = digits(self.phone);
  if (cp.length >= 7 && cp === sp) return 'phone';
  return null;
}

/** The form-level validation: Contact 1 is required; neither contact may be the
 *  person themselves. Returns an error message, or null when the set is acceptable. */
export function emergencyContactsError(
  v: EmergencyContactValues,
  self: { name: string; phone: string },
): string | null {
  const c1 = { name: v.emergency_contact_1_name, relationship: v.emergency_contact_1_relationship, phone: v.emergency_contact_1_phone };
  const c2 = { name: v.emergency_contact_2_name, relationship: v.emergency_contact_2_relationship, phone: v.emergency_contact_2_phone };
  if (!c1.name.trim() || !c1.relationship.trim() || !c1.phone.trim()) {
    return 'Emergency contact 1 needs a name, relationship, and phone.';
  }
  if (matchesSelf(c1, self)) return 'Your emergency contact must be someone other than yourself.';
  const c2Started = !!(c2.name.trim() || c2.relationship.trim() || c2.phone.trim());
  if (c2Started && matchesSelf(c2, self)) return 'Your emergency contact must be someone other than yourself.';
  return null;
}

/** The shared fields. `onChange(key, value)` writes one flat value; the parent owns
 *  the state. `self` drives the per-field own-contact message. `disabled` greys all. */
export function EmergencyContactsFields({
  values, onChange, self, disabled, heading = 'Emergency contacts', hint,
}: {
  values: EmergencyContactValues;
  onChange: (key: keyof EmergencyContactValues, value: string) => void;
  self: { name: string; phone: string };
  disabled?: boolean;
  heading?: string | null;
  hint?: ReactNode;
}) {
  const c1 = { name: values.emergency_contact_1_name, phone: values.emergency_contact_1_phone };
  const c2 = { name: values.emergency_contact_2_name, phone: values.emergency_contact_2_phone };
  const c1Self = matchesSelf(c1, self);
  const c2Started = !!(values.emergency_contact_2_name.trim() || values.emergency_contact_2_relationship.trim() || values.emergency_contact_2_phone.trim());
  const c2Self = c2Started ? matchesSelf(c2, self) : null;

  const row = (
    which: 1 | 2,
    label: string,
    required: boolean,
    selfMatch: 'name' | 'phone' | null,
  ) => (
    <div>
      <p className="text-[11px] uppercase tracking-wide text-muted font-semibold mb-2">{label}</p>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <label className="form-label" htmlFor={`ec${which}-name`}>Name{required ? '' : ' (optional)'}</label>
          <input id={`ec${which}-name`} required={required} disabled={disabled} className="form-input"
            value={values[`emergency_contact_${which}_name`]}
            onChange={(e) => onChange(`emergency_contact_${which}_name`, e.target.value)} />
        </div>
        <div>
          <label className="form-label" htmlFor={`ec${which}-rel`}>Relationship</label>
          <input id={`ec${which}-rel`} required={required} disabled={disabled} className="form-input"
            value={values[`emergency_contact_${which}_relationship`]}
            onChange={(e) => onChange(`emergency_contact_${which}_relationship`, e.target.value)} />
        </div>
        <div>
          <label className="form-label" htmlFor={`ec${which}-phone`}>Phone</label>
          <input id={`ec${which}-phone`} type="tel" required={required} disabled={disabled} className="form-input"
            value={values[`emergency_contact_${which}_phone`]}
            onChange={(e) => onChange(`emergency_contact_${which}_phone`, e.target.value)} />
        </div>
      </div>
      {selfMatch && (
        <p className="form-error mt-1.5">
          An emergency contact is someone else — this {selfMatch === 'name' ? 'name' : 'phone'} is your own.
        </p>
      )}
    </div>
  );

  return (
    <div>
      {heading && <h3 className="form-label mb-1">{heading}</h3>}
      {hint && <p className="text-[11.5px] text-muted mb-3">{hint}</p>}
      <div className="flex flex-col gap-5">
        {row(1, 'Contact 1', true, c1Self)}
        {row(2, 'Contact 2', false, c2Self)}
      </div>
    </div>
  );
}
