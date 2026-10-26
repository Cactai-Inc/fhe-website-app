/* F7 (2026-10-26) — one way to collect emergency contacts, used by every form that
 * collects them. Each contact is its OWN group spanning the full row: a heading
 * ("Contact 1" / "Contact 2") and three columns inside — name, relationship, phone.
 * Never interleaved in a shared two-column grid.
 *
 * One emergency contact is required at all times; a second is otherwise optional.
 *
 * Who may be a contact (owner, 2026-10-26): the person on the record IS a valid
 * emergency contact — the number-one one — because for a horse owner / lessor /
 * seller the emergency is about the HORSE. The one exception is a RIDER: an emergency
 * about the rider cannot be reported to the rider, so a rider needs at least one
 * emergency contact who is SOMEONE ELSE.
 *   - A rider who is ALSO a horse owner may still list themselves as Contact 1 (valid
 *     for horse-care / vet-auth), but then Contact 2 is REQUIRED and must be someone
 *     else — in case they are hurt while riding.
 *   - A rider who is not an owner simply makes Contact 1 someone else.
 * For a minor rider the person at risk is the MINOR; the guardian (the account on the
 * record) is a valid Contact 1. So the AT-RISK person — supplied by the caller — is
 * the account holder for an adult rider, the minor for a minor rider.
 */
import type { ReactNode } from 'react';

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
const filled = (v: string) => v.trim().length > 0;
const contactComplete = (name: string, rel: string, phone: string) =>
  filled(name) && filled(rel) && filled(phone);

/** Does this contact's name or phone match the at-risk person's own? Only meaningful
 *  when `atRisk` is supplied (a rider). Name match is case/space-insensitive; phone
 *  match compares digits only. Empty values never match. */
export function matchesAtRisk(
  contact: { name: string; phone: string },
  atRisk: { name: string; phone: string },
): 'name' | 'phone' | null {
  const cn = contact.name.trim().toLowerCase().replace(/\s+/g, ' ');
  const an = atRisk.name.trim().toLowerCase().replace(/\s+/g, ' ');
  if (cn && an && cn === an) return 'name';
  const cp = digits(contact.phone);
  const ap = digits(atRisk.phone);
  if (cp.length >= 7 && cp === ap) return 'phone';
  return null;
}

/** The form-level validation. One emergency contact is required (contact 1); a second
 *  is otherwise optional. A rider (`atRisk` supplied) needs at least one contact who
 *  is NOT the at-risk person: if contact 1 is them, contact 2 is required and must be
 *  someone else; a contact-2 that is them is always refused. Returns an error message,
 *  or null when acceptable. */
export function emergencyContactsError(
  v: EmergencyContactValues,
  opts: { atRisk?: { name: string; phone: string } | null } = {},
): string | null {
  const c1 = { name: v.emergency_contact_1_name, phone: v.emergency_contact_1_phone };
  const c2 = { name: v.emergency_contact_2_name, phone: v.emergency_contact_2_phone };
  const c1Complete = contactComplete(v.emergency_contact_1_name, v.emergency_contact_1_relationship, v.emergency_contact_1_phone);
  const c2Complete = contactComplete(v.emergency_contact_2_name, v.emergency_contact_2_relationship, v.emergency_contact_2_phone);
  const c2Started = filled(v.emergency_contact_2_name) || filled(v.emergency_contact_2_relationship) || filled(v.emergency_contact_2_phone);

  if (!c1Complete) return 'Emergency contact 1 needs a name, relationship, and phone.';

  if (opts.atRisk) {
    // Contact 2, if it is the rider, is always wrong.
    if (c2Started && matchesAtRisk(c2, opts.atRisk)) {
      return 'A rider’s second emergency contact must be someone else — an emergency about you can’t be reported to you.';
    }
    // The rider may put themselves as contact 1 (valid for the horse side), but then
    // needs a complete, different second — in case they are hurt while riding.
    if (matchesAtRisk(c1, opts.atRisk)) {
      if (!c2Complete) {
        return 'You listed yourself as contact 1. A rider needs a second emergency contact who is someone else, in case you are hurt while riding.';
      }
      if (matchesAtRisk(c2, opts.atRisk)) {
        return 'A rider’s second emergency contact must be someone else.';
      }
    }
  }
  return null;
}

/** The shared fields. One contact is required, a second is always optional. When
 *  `atRisk` is supplied, a contact matching that person is flagged (a rider may not
 *  be their own contact); omit it where self is a valid contact. */
export function EmergencyContactsFields({
  values, onChange, atRisk = null, disabled, heading = 'Emergency contacts', hint,
}: {
  values: EmergencyContactValues;
  onChange: (key: keyof EmergencyContactValues, value: string) => void;
  atRisk?: { name: string; phone: string } | null;
  disabled?: boolean;
  heading?: string | null;
  hint?: ReactNode;
}) {
  const c2Started = filled(values.emergency_contact_2_name)
    || filled(values.emergency_contact_2_relationship) || filled(values.emergency_contact_2_phone);
  const c2Complete = contactComplete(values.emergency_contact_2_name, values.emergency_contact_2_relationship, values.emergency_contact_2_phone);
  const c1Self = atRisk ? matchesAtRisk({ name: values.emergency_contact_1_name, phone: values.emergency_contact_1_phone }, atRisk) : null;
  const c2Self = atRisk && c2Started ? matchesAtRisk({ name: values.emergency_contact_2_name, phone: values.emergency_contact_2_phone }, atRisk) : null;
  // A rider who lists themselves as contact 1 needs a complete second contact who is
  // someone else — contact 2 becomes required for them.
  const c2Required = !!c1Self;

  const row = (
    which: 1 | 2, label: string, required: boolean,
    message: ReactNode | null, tone: 'error' | 'hint',
  ) => (
    <div>
      <p className="text-[11px] uppercase tracking-wide text-muted font-semibold mb-2">
        {label}{required ? '' : ' (optional)'}
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <label className="form-label" htmlFor={`ec${which}-name`}>Name</label>
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
      {message && (
        <p className={`${tone === 'error' ? 'form-error' : 'text-[11.5px] text-gold-800'} mt-1.5`}>{message}</p>
      )}
    </div>
  );

  // Contact 1 self-match is a HINT (allowed, but prompts for a second); contact 2
  // self-match is an ERROR (the rider's non-self contact can't be them).
  const c1Message = c1Self
    ? (c2Complete ? null : 'You may list yourself here, but as a rider you need a second contact who is someone else — in case you are hurt while riding.')
    : null;
  const c2Message = c2Self
    ? `A rider’s second emergency contact must be someone else — this ${c2Self === 'name' ? 'name' : 'phone'} is your own.`
    : null;

  return (
    <div>
      {heading && <h3 className="form-label mb-1">{heading}</h3>}
      {hint && <p className="text-[11.5px] text-muted mb-3">{hint}</p>}
      <div className="flex flex-col gap-5">
        {row(1, 'Contact 1', true, c1Message, 'hint')}
        {row(2, 'Contact 2', c2Required, c2Message, 'error')}
      </div>
    </div>
  );
}
