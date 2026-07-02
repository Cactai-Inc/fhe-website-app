/**
 * Read-only summary block for an engagement detail (OPS-ENG-LIST). Renders the
 * engagement header (code/service/status), the parties, the primary horse, the
 * transaction rollup, and the stages timeline from the `EngagementDetail`
 * rollup returned by `getEngagement(id)`.
 *
 * Pure presentational — no data calls. StatusBadge on statuses, Money on the
 * transaction amount/deposit.
 */
import { StatusBadge, Money } from '../../../lib/ops';
import type { EngagementDetail } from '../../../lib/ops/types';

export interface EngagementSummaryProps {
  engagement: EngagementDetail;
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="form-label mb-0.5">{label}</p>
      <p className="text-sm text-green-900">{value ?? '—'}</p>
    </div>
  );
}

export function EngagementSummary({ engagement }: EngagementSummaryProps) {
  const txn = engagement.transactions[0] ?? null;

  return (
    <div className="flex flex-col gap-8">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="eyebrow mb-1">Engagement</p>
          <h1 className="heading-section text-green-800">
            {engagement.display_code ?? engagement.id.slice(0, 8)}
          </h1>
        </div>
        <StatusBadge status={engagement.status} />
      </div>

      {/* Parties + horse + service */}
      <section aria-labelledby="parties-heading">
        <h2 id="parties-heading" className="font-serif text-lg text-green-900 mb-3">
          Parties &amp; horse
        </h2>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
          <Field label="Service type" value={engagement.service_type} />
          <Field label="Client" value={engagement.client_id} />
          <Field label="Assigned staff" value={engagement.assigned_staff_id} />
          <Field label="Primary horse" value={engagement.primary_horse_id} />
          <Field
            label="Start date"
            value={
              engagement.start_date
                ? new Date(engagement.start_date).toLocaleDateString()
                : null
            }
          />
        </div>
      </section>

      {/* Transaction */}
      <section aria-labelledby="txn-heading">
        <h2 id="txn-heading" className="font-serif text-lg text-green-900 mb-3">
          Transaction
        </h2>
        {txn ? (
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <Field label="Type" value={txn.txn_type} />
            <Field label="Amount" value={<Money amount={txn.amount} />} />
            <Field label="Deposit" value={<Money amount={txn.deposit_amount} />} />
            <Field label="Status" value={<StatusBadge status={txn.status} />} />
          </div>
        ) : (
          <p className="text-sm text-green-800/70">No transaction on this engagement.</p>
        )}
      </section>

      {/* Stages */}
      <section aria-labelledby="stages-heading">
        <h2 id="stages-heading" className="font-serif text-lg text-green-900 mb-3">
          Stages
        </h2>
        {engagement.stages.length === 0 ? (
          <p className="text-sm text-green-800/70">No stages recorded yet.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {engagement.stages.map((stage) => (
              <li
                key={stage.id}
                className="flex items-center justify-between gap-4 border border-green-800/10 bg-white px-4 py-3"
              >
                <div>
                  <p className="text-sm font-sans font-medium text-green-900">{stage.stage}</p>
                  {stage.deal_side && (
                    <p className="text-xs text-green-800/70">{stage.deal_side}</p>
                  )}
                </div>
                <StatusBadge status={stage.status} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
