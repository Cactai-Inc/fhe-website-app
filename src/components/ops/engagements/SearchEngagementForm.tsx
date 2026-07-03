import { useState } from 'react';
import type { FormEvent } from 'react';
import { FormField } from '../../../lib/ops';
import { contactName } from '../../../lib/ops/types';
import type { Contact, Horse } from '../../../lib/ops/types';
import type { CreateSearchEngagementInput } from '../../../lib/api';

/**
 * OPS-ENG-CREATE — search-engagement form.
 *
 * Client (required) + retained_by + deal_side (+ optional horse). Owns the real
 * `<form onSubmit>`; assembles the exact `CreateSearchEngagementInput` and hands
 * it to the parent, which calls `createSearchEngagement` → `create_search_engagement`.
 * An empty client is blocked inline and never reaches the data fn.
 */
export interface SearchEngagementFormProps {
  contacts: Contact[];
  horses: Horse[];
  onSubmit: (input: CreateSearchEngagementInput) => Promise<void>;
  submitting?: boolean;
  error?: string | null;
}

const DEAL_SIDES: CreateSearchEngagementInput['dealSide'][] = ['BUY', 'SELL', 'LEASE_IN', 'LEASE_OUT'];

function horseLabel(h: Horse): string {
  return h.barn_name || h.registered_name || h.display_code || h.id;
}

export function SearchEngagementForm({
  contacts,
  horses,
  onSubmit,
  submitting,
  error,
}: SearchEngagementFormProps) {
  const [clientContactId, setClientContactId] = useState('');
  const [retainedBy, setRetainedBy] = useState('buyer');
  const [dealSide, setDealSide] = useState<NonNullable<CreateSearchEngagementInput['dealSide']>>('BUY');
  const [horseId, setHorseId] = useState('');
  const [clientError, setClientError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!clientContactId) {
      setClientError('Client is required.');
      return;
    }
    setClientError(null);
    const input: CreateSearchEngagementInput = {
      clientContactId,
      retainedBy,
      dealSide,
      horseId: horseId || null,
    };
    await onSubmit(input);
  }

  return (
    <form onSubmit={handleSubmit} noValidate aria-label="Search engagement">
      <FormField label="Client" required error={clientError}>
        {({ id, describedBy, errorClass }) => (
          <select
            id={id}
            name="client_contact_id"
            className={`form-input ${errorClass}`}
            aria-describedby={describedBy}
            value={clientContactId}
            onChange={(e) => setClientContactId(e.target.value)}
            disabled={submitting}
          >
            <option value="">Select client…</option>
            {contacts.map((c) => (
              <option key={c.id} value={c.id}>
                {contactName(c)}
              </option>
            ))}
          </select>
        )}
      </FormField>

      <FormField label="Retained by">
        {({ id, describedBy, errorClass }) => (
          <select
            id={id}
            name="retained_by"
            className={`form-input ${errorClass}`}
            aria-describedby={describedBy}
            value={retainedBy}
            onChange={(e) => setRetainedBy(e.target.value)}
            disabled={submitting}
          >
            <option value="buyer">Buyer</option>
            <option value="seller">Seller</option>
          </select>
        )}
      </FormField>

      <FormField label="Deal side">
        {({ id, describedBy, errorClass }) => (
          <select
            id={id}
            name="deal_side"
            className={`form-input ${errorClass}`}
            aria-describedby={describedBy}
            value={dealSide}
            onChange={(e) =>
              setDealSide(e.target.value as NonNullable<CreateSearchEngagementInput['dealSide']>)
            }
            disabled={submitting}
          >
            {DEAL_SIDES.map((s) => (
              <option key={s} value={s ?? ''}>
                {s}
              </option>
            ))}
          </select>
        )}
      </FormField>

      <FormField label="Horse">
        {({ id, describedBy, errorClass }) => (
          <select
            id={id}
            name="horse_id"
            className={`form-input ${errorClass}`}
            aria-describedby={describedBy}
            value={horseId}
            onChange={(e) => setHorseId(e.target.value)}
            disabled={submitting}
          >
            <option value="">No horse</option>
            {horses.map((h) => (
              <option key={h.id} value={h.id}>
                {horseLabel(h)}
              </option>
            ))}
          </select>
        )}
      </FormField>

      {error && (
        <p role="alert" className="form-error mb-4">
          {error}
        </p>
      )}

      <div className="flex justify-end">
        <button type="submit" className="btn-primary" disabled={submitting} aria-busy={submitting}>
          {submitting ? 'Creating…' : 'Create search engagement'}
        </button>
      </div>
    </form>
  );
}

export default SearchEngagementForm;
