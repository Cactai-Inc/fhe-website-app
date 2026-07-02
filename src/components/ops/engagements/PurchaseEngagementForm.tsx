import { useState } from 'react';
import type { FormEvent } from 'react';
import { FormField } from '../../../lib/ops';
import type { Contact, Horse } from '../../../lib/ops/types';
import type { CreatePurchaseEngagementInput } from '../../../lib/api';

/**
 * OPS-ENG-CREATE — purchase-engagement form.
 *
 * Buyer (required) + seller + horse pickers (reuse listContacts/listHorses rows,
 * passed in as props), plus amount + deposit. Owns the real `<form onSubmit>`;
 * assembles the exact `CreatePurchaseEngagementInput` and hands it to the parent,
 * which calls `createPurchaseEngagement` → `create_purchase_engagement`. Never a
 * no-op handler: an empty buyer is blocked inline and never reaches the data fn.
 */
export interface PurchaseEngagementFormProps {
  contacts: Contact[];
  horses: Horse[];
  onSubmit: (input: CreatePurchaseEngagementInput) => Promise<void>;
  submitting?: boolean;
  error?: string | null;
}

function horseLabel(h: Horse): string {
  return h.barn_name || h.registered_name || h.display_code || h.id;
}

export function PurchaseEngagementForm({
  contacts,
  horses,
  onSubmit,
  submitting,
  error,
}: PurchaseEngagementFormProps) {
  const [buyerContactId, setBuyerContactId] = useState('');
  const [sellerContactId, setSellerContactId] = useState('');
  const [horseId, setHorseId] = useState('');
  const [amount, setAmount] = useState('');
  const [deposit, setDeposit] = useState('');
  const [buyerError, setBuyerError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!buyerContactId) {
      setBuyerError('Buyer is required.');
      return;
    }
    setBuyerError(null);
    const input: CreatePurchaseEngagementInput = {
      buyerContactId,
      sellerContactId: sellerContactId || null,
      horseId: horseId || null,
      amount: amount.trim() ? Number(amount) : null,
      deposit: deposit.trim() ? Number(deposit) : null,
    };
    await onSubmit(input);
  }

  return (
    <form onSubmit={handleSubmit} noValidate aria-label="Purchase engagement">
      <FormField label="Buyer" required error={buyerError}>
        {({ id, describedBy, errorClass }) => (
          <select
            id={id}
            name="buyer_contact_id"
            className={`form-input ${errorClass}`}
            aria-describedby={describedBy}
            value={buyerContactId}
            onChange={(e) => setBuyerContactId(e.target.value)}
            disabled={submitting}
          >
            <option value="">Select buyer…</option>
            {contacts.map((c) => (
              <option key={c.id} value={c.id}>
                {c.full_name}
              </option>
            ))}
          </select>
        )}
      </FormField>

      <FormField label="Seller">
        {({ id, describedBy, errorClass }) => (
          <select
            id={id}
            name="seller_contact_id"
            className={`form-input ${errorClass}`}
            aria-describedby={describedBy}
            value={sellerContactId}
            onChange={(e) => setSellerContactId(e.target.value)}
            disabled={submitting}
          >
            <option value="">No seller</option>
            {contacts.map((c) => (
              <option key={c.id} value={c.id}>
                {c.full_name}
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

      <FormField label="Amount">
        {({ id, describedBy, errorClass }) => (
          <input
            id={id}
            name="amount"
            type="number"
            min="0"
            step="0.01"
            className={`form-input ${errorClass}`}
            aria-describedby={describedBy}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            disabled={submitting}
          />
        )}
      </FormField>

      <FormField label="Deposit">
        {({ id, describedBy, errorClass }) => (
          <input
            id={id}
            name="deposit"
            type="number"
            min="0"
            step="0.01"
            className={`form-input ${errorClass}`}
            aria-describedby={describedBy}
            value={deposit}
            onChange={(e) => setDeposit(e.target.value)}
            disabled={submitting}
          />
        )}
      </FormField>

      {error && (
        <p role="alert" className="form-error mb-4">
          {error}
        </p>
      )}

      <div className="flex justify-end">
        <button type="submit" className="btn-primary" disabled={submitting} aria-busy={submitting}>
          {submitting ? 'Creating…' : 'Create purchase engagement'}
        </button>
      </div>
    </form>
  );
}

export default PurchaseEngagementForm;
