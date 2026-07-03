import { useState } from 'react';
import type { FormEvent } from 'react';
import { FormField } from '../../../lib/ops';
import { contactName } from '../../../lib/ops/types';
import type { Contact, Horse } from '../../../lib/ops/types';
import type { CreateLeaseEngagementInput } from '../../../lib/api';

/**
 * OPS-ENG-CREATE — lease-engagement form.
 *
 * Client (required) + deal_side (LEASE_IN/LEASE_OUT) + optional counterparty +
 * optional horse. Owns the real `<form onSubmit>`; assembles the exact
 * `CreateLeaseEngagementInput` and hands it to the parent, which calls
 * `createLeaseEngagement` → `create_lease_engagement`. An empty client is blocked
 * inline and never reaches the data fn.
 */
export interface LeaseEngagementFormProps {
  contacts: Contact[];
  horses: Horse[];
  onSubmit: (input: CreateLeaseEngagementInput) => Promise<void>;
  submitting?: boolean;
  error?: string | null;
}

const LEASE_SIDES: NonNullable<CreateLeaseEngagementInput['dealSide']>[] = ['LEASE_IN', 'LEASE_OUT'];

function horseLabel(h: Horse): string {
  return h.barn_name || h.registered_name || h.display_code || h.id;
}

export function LeaseEngagementForm({
  contacts,
  horses,
  onSubmit,
  submitting,
  error,
}: LeaseEngagementFormProps) {
  const [clientContactId, setClientContactId] = useState('');
  const [dealSide, setDealSide] = useState<NonNullable<CreateLeaseEngagementInput['dealSide']>>('LEASE_IN');
  const [counterpartyContactId, setCounterpartyContactId] = useState('');
  const [horseId, setHorseId] = useState('');
  const [clientError, setClientError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!clientContactId) {
      setClientError('Client is required.');
      return;
    }
    setClientError(null);
    const input: CreateLeaseEngagementInput = {
      clientContactId,
      dealSide,
      counterpartyContactId: counterpartyContactId || null,
      horseId: horseId || null,
    };
    await onSubmit(input);
  }

  return (
    <form onSubmit={handleSubmit} noValidate aria-label="Lease engagement">
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

      <FormField label="Deal side">
        {({ id, describedBy, errorClass }) => (
          <select
            id={id}
            name="deal_side"
            className={`form-input ${errorClass}`}
            aria-describedby={describedBy}
            value={dealSide}
            onChange={(e) =>
              setDealSide(e.target.value as NonNullable<CreateLeaseEngagementInput['dealSide']>)
            }
            disabled={submitting}
          >
            {LEASE_SIDES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        )}
      </FormField>

      <FormField label="Counterparty">
        {({ id, describedBy, errorClass }) => (
          <select
            id={id}
            name="counterparty_contact_id"
            className={`form-input ${errorClass}`}
            aria-describedby={describedBy}
            value={counterpartyContactId}
            onChange={(e) => setCounterpartyContactId(e.target.value)}
            disabled={submitting}
          >
            <option value="">No counterparty</option>
            {contacts.map((c) => (
              <option key={c.id} value={c.id}>
                {contactName(c)}
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
          {submitting ? 'Creating…' : 'Create lease engagement'}
        </button>
      </div>
    </form>
  );
}

export default LeaseEngagementForm;
