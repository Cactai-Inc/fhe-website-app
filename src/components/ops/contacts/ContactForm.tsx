import { useState } from 'react';
import type { FormEvent } from 'react';
import { FormField } from '../../../lib/ops';
import type { Contact, ContactInput } from '../../../lib/ops/types';

/**
 * Create/edit form for a CRM contact. Controlled inputs bound to the writable
 * `ContactInput` columns; `onSubmit` receives the assembled patch. The parent
 * (ContactsPage) owns the async call (createContact/updateContact) + toast, so
 * this component stays presentational — but it OWNS the real `<form onSubmit>`
 * and validation, never a no-op handler.
 *
 * `first_name` is required (mirrors `ContactInput`'s required field); a submit
 * with an empty first name is blocked inline and never reaches the data fn.
 */
export interface ContactFormProps {
  /** Existing contact when editing; undefined when creating. */
  contact?: Contact;
  /** Assembled writable patch. May reject; the parent renders the error. */
  onSubmit: (input: ContactInput) => Promise<void>;
  onCancel: () => void;
  /** Disable the controls while a parent submit is in flight. */
  submitting?: boolean;
  /** Error text from a rejected submit, surfaced at the form foot. */
  error?: string | null;
}

export function ContactForm({
  contact,
  onSubmit,
  onCancel,
  submitting,
  error,
}: ContactFormProps) {
  const [firstName, setFirstName] = useState(contact?.first_name ?? '');
  const [lastName, setLastName] = useState(contact?.last_name ?? '');
  const [email, setEmail] = useState(contact?.email ?? '');
  const [phone, setPhone] = useState(contact?.phone ?? '');
  const [nameError, setNameError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const trimmedFirst = firstName.trim();
    if (!trimmedFirst) {
      setNameError('First name is required.');
      return;
    }
    setNameError(null);
    const trimmedLast = lastName.trim();
    const input: ContactInput = {
      first_name: trimmedFirst,
      last_name: trimmedLast || null,
      email: email.trim() || null,
      phone: phone.trim() || null,
    };
    await onSubmit(input);
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      {contact?.tags?.includes('owner') && (
        <p className="mb-4">
          <span className="inline-block rounded bg-green-100 px-1.5 py-0.5 text-xs font-medium text-green-800">
            Owner
          </span>
        </p>
      )}

      <FormField label="First name" required error={nameError}>
        {({ id, describedBy, errorClass }) => (
          <input
            id={id}
            name="first_name"
            className={`form-input ${errorClass}`}
            aria-describedby={describedBy}
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            disabled={submitting}
          />
        )}
      </FormField>

      <FormField label="Last name">
        {({ id, describedBy, errorClass }) => (
          <input
            id={id}
            name="last_name"
            className={`form-input ${errorClass}`}
            aria-describedby={describedBy}
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            disabled={submitting}
          />
        )}
      </FormField>

      <FormField label="Email">
        {({ id, describedBy, errorClass }) => (
          <input
            id={id}
            name="email"
            type="email"
            className={`form-input ${errorClass}`}
            aria-describedby={describedBy}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={submitting}
          />
        )}
      </FormField>

      <FormField label="Phone">
        {({ id, describedBy, errorClass }) => (
          <input
            id={id}
            name="phone"
            className={`form-input ${errorClass}`}
            aria-describedby={describedBy}
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            disabled={submitting}
          />
        )}
      </FormField>

      {error && (
        <p role="alert" className="form-error mb-4">
          {error}
        </p>
      )}

      <div className="flex justify-end gap-3">
        <button
          type="button"
          className="btn-secondary"
          onClick={onCancel}
          disabled={submitting}
        >
          Cancel
        </button>
        <button type="submit" className="btn-primary" disabled={submitting} aria-busy={submitting}>
          {submitting ? 'Saving…' : contact ? 'Save changes' : 'Create contact'}
        </button>
      </div>
    </form>
  );
}
