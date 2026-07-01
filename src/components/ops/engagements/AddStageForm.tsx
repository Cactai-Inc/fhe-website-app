import { useState } from 'react';
import type { FormEvent } from 'react';
import { FormField } from '../../../lib/ops';
import type { EngagementStageInput } from '../../../lib/api';

/**
 * OPS-ENG-STAGES — add-a-stage form (brokerage).
 *
 * Picks the stage type (SEARCH / EVALUATION / TRANSACTION_REP), retained_by,
 * deal_side (directional) and an optional fee_value_key (from a config key
 * list, prop-injected). Owns the real `<form onSubmit>`; assembles the
 * `EngagementStageInput` for the engagement it is embedded in and hands it to
 * the parent, which calls `createEngagementStage` →
 * `supabase.from('engagement_stages').insert(...)`.
 *
 * Each stage is independent — no required predecessor (§7.1). The payload
 * always carries {engagement_id, stage, retained_by, deal_side}; fee_value_key
 * is only added when a fee key is chosen.
 */
export type StageType = EngagementStageInput['stage'];
export type DealSide = NonNullable<EngagementStageInput['deal_side']>;

const STAGES: { value: StageType; label: string }[] = [
  { value: 'SEARCH', label: 'Search' },
  { value: 'EVALUATION', label: 'Evaluation' },
  { value: 'TRANSACTION_REP', label: 'Transaction rep' },
];

const DEAL_SIDES: DealSide[] = ['BUY', 'SELL', 'LEASE_IN', 'LEASE_OUT'];

const RETAINED_BY: { value: string; label: string }[] = [
  { value: 'buyer', label: 'Buyer' },
  { value: 'seller', label: 'Seller' },
];

export interface AddStageFormProps {
  /** The engagement this stage belongs to (embedded panel). */
  engagementId: string;
  /** Fee config keys the operator can attach to the stage. */
  feeValueKeys?: string[];
  onSubmit: (input: EngagementStageInput) => Promise<void>;
  submitting?: boolean;
  error?: string | null;
}

export function AddStageForm({
  engagementId,
  feeValueKeys = [],
  onSubmit,
  submitting,
  error,
}: AddStageFormProps) {
  const [stage, setStage] = useState<StageType>('SEARCH');
  const [retainedBy, setRetainedBy] = useState('buyer');
  const [dealSide, setDealSide] = useState<DealSide>('BUY');
  const [feeValueKey, setFeeValueKey] = useState('');

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const input: EngagementStageInput = {
      engagement_id: engagementId,
      stage,
      retained_by: retainedBy,
      deal_side: dealSide,
    };
    if (feeValueKey) {
      input.fee_value_key = feeValueKey;
    }
    await onSubmit(input);
  }

  return (
    <form onSubmit={handleSubmit} noValidate aria-label="Add stage" className="flex flex-col gap-2">
      <FormField label="Stage">
        {({ id, describedBy, errorClass }) => (
          <select
            id={id}
            name="stage"
            className={`form-input ${errorClass}`}
            aria-describedby={describedBy}
            value={stage}
            onChange={(e) => setStage(e.target.value as StageType)}
            disabled={submitting}
          >
            {STAGES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
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
            {RETAINED_BY.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
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
            onChange={(e) => setDealSide(e.target.value as DealSide)}
            disabled={submitting}
          >
            {DEAL_SIDES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        )}
      </FormField>

      <FormField label="Fee key">
        {({ id, describedBy, errorClass }) => (
          <select
            id={id}
            name="fee_value_key"
            className={`form-input ${errorClass}`}
            aria-describedby={describedBy}
            value={feeValueKey}
            onChange={(e) => setFeeValueKey(e.target.value)}
            disabled={submitting}
          >
            <option value="">No fee key</option>
            {feeValueKeys.map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </select>
        )}
      </FormField>

      {error && (
        <p role="alert" className="form-error mb-2">
          {error}
        </p>
      )}

      <div className="flex justify-end">
        <button type="submit" className="btn-primary" disabled={submitting} aria-busy={submitting}>
          {submitting ? 'Adding…' : 'Add stage'}
        </button>
      </div>
    </form>
  );
}

export default AddStageForm;
