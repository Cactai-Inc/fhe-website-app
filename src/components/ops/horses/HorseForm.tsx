import { useState } from 'react';
import { toErrorMessage } from '../../../lib/ops/errors';
import type { FormEvent } from 'react';
import { FormField } from '../../../lib/ops';
import { contactName } from '../../../lib/ops/types';
import type { Horse, HorseInput, HorseSex, LookupCode, Contact } from '../../../lib/ops/types';

/**
 * Create/edit form for a horse. Breed/color are driven by the injected global
 * lookups (horse_breeds/horse_colors), primary owner from the contacts list.
 * On submit it calls `onSubmit(input)` with the assembled HorseInput and, on
 * rejection, surfaces the error inline (never swallowed). Used inside a Modal
 * by HorsesPage for both the "New horse" and row-click "Edit" flows.
 */
const SEXES: HorseSex[] = ['MARE', 'GELDING', 'STALLION', 'FILLY', 'COLT'];

export interface HorseFormProps {
  breeds: LookupCode[];
  colors: LookupCode[];
  owners: Contact[];
  /** When set, the form is in edit mode and pre-fills from this row. */
  horse?: Horse | null;
  onSubmit: (input: HorseInput) => Promise<unknown>;
  onCancel: () => void;
}

function emptyish(value: string): string | null {
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

export function HorseForm({ breeds, colors, owners, horse, onSubmit, onCancel }: HorseFormProps) {
  const [barnName, setBarnName] = useState(horse?.barn_name ?? '');
  const [registeredName, setRegisteredName] = useState(horse?.registered_name ?? '');
  const [breed, setBreed] = useState(horse?.breed ?? '');
  const [color, setColor] = useState(horse?.color ?? '');
  const [sex, setSex] = useState<string>(horse?.sex ?? '');
  const [ownerId, setOwnerId] = useState(horse?.current_owner_contact_id ?? '');
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const buildInput = (): HorseInput | null => {
    if (emptyish(barnName) === null && emptyish(registeredName) === null) {
      setFieldError('Enter a barn name or registered name.');
      return null;
    }
    setFieldError(null);
    return {
      barn_name: emptyish(barnName),
      registered_name: emptyish(registeredName),
      breed: emptyish(breed),
      color: emptyish(color),
      sex: (sex === '' ? null : (sex as HorseSex)),
      current_owner_contact_id: ownerId === '' ? null : ownerId,
    };
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitError(null);
    const input = buildInput();
    if (!input) return;
    setSaving(true);
    try {
      await onSubmit(input);
    } catch (err) {
      setSubmitError(toErrorMessage(err, 'Could not save horse.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} noValidate>
      <FormField label="Barn name" error={fieldError} hint="Barn name or registered name is required.">
        {({ id, describedBy, errorClass }) => (
          <input
            id={id}
            aria-describedby={describedBy}
            className={`form-input ${errorClass}`}
            value={barnName}
            onChange={(e) => setBarnName(e.target.value)}
          />
        )}
      </FormField>

      <FormField label="Registered name">
        {({ id, errorClass }) => (
          <input
            id={id}
            className={`form-input ${errorClass}`}
            value={registeredName}
            onChange={(e) => setRegisteredName(e.target.value)}
          />
        )}
      </FormField>

      <FormField label="Breed">
        {({ id, errorClass }) => (
          <select
            id={id}
            className={`form-input ${errorClass}`}
            value={breed}
            onChange={(e) => setBreed(e.target.value)}
          >
            <option value="">— Select breed —</option>
            {breeds.map((b) => (
              <option key={b.code} value={b.code}>
                {b.display_name}
              </option>
            ))}
          </select>
        )}
      </FormField>

      <FormField label="Color">
        {({ id, errorClass }) => (
          <select
            id={id}
            className={`form-input ${errorClass}`}
            value={color}
            onChange={(e) => setColor(e.target.value)}
          >
            <option value="">— Select color —</option>
            {colors.map((c) => (
              <option key={c.code} value={c.code}>
                {c.display_name}
              </option>
            ))}
          </select>
        )}
      </FormField>

      <FormField label="Sex">
        {({ id, errorClass }) => (
          <select
            id={id}
            className={`form-input ${errorClass}`}
            value={sex}
            onChange={(e) => setSex(e.target.value)}
          >
            <option value="">— Select sex —</option>
            {SEXES.map((s) => (
              <option key={s} value={s}>
                {s.charAt(0) + s.slice(1).toLowerCase()}
              </option>
            ))}
          </select>
        )}
      </FormField>

      <FormField label="Primary owner">
        {({ id, errorClass }) => (
          <select
            id={id}
            className={`form-input ${errorClass}`}
            value={ownerId}
            onChange={(e) => setOwnerId(e.target.value)}
          >
            <option value="">— No owner —</option>
            {owners.map((o) => (
              <option key={o.id} value={o.id}>
                {contactName(o)}
              </option>
            ))}
          </select>
        )}
      </FormField>

      {submitError && (
        <p role="alert" className="form-error mb-3">
          {submitError}
        </p>
      )}

      <div className="flex justify-end gap-3">
        <button type="button" className="btn-secondary" onClick={onCancel} disabled={saving}>
          Cancel
        </button>
        <button type="submit" className="btn-primary" disabled={saving} aria-busy={saving}>
          {saving ? 'Saving…' : horse ? 'Save changes' : 'Create horse'}
        </button>
      </div>
    </form>
  );
}
