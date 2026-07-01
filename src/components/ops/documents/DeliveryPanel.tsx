import { useEffect, useState } from 'react';
import { FormField, StatusBadge, EmptyState, useAsync } from '../../../lib/ops';
import { listDeliveries, recordDelivery } from '../../../lib/api';
import type { DocumentDelivery, DeliveryChannel, DeliveryInput } from '../../../lib/ops/types';

/**
 * OPS-DOC-DELIVER — Document delivery panel (§15 critical chain 2 tail).
 *
 * The tail of the contract chain: once a document reaches EXECUTED, staff
 * records/sends a delivery (channel EMAIL/PORTAL to a recipient contact) via
 * `recordDelivery` → `supabase.from('document_deliveries').insert(...)`
 * (RLS org-scoped). The delivery log lists prior sends (newest first) from
 * `listDeliveries(documentId)`.
 *
 * GATING: the send form is HIDDEN and the control DISABLED until the document
 * is EXECUTED — you cannot deliver a DRAFT/SENT contract. A non-EXECUTED
 * document shows a locked notice instead of the form, so `recordDelivery`
 * never fires on an unsigned contract.
 *
 * On success the new row is prepended to the log (optimistic re-list) and the
 * form resets. On rejection the error renders inline and nothing is logged.
 */
const DELIVERABLE_STATUS = 'EXECUTED';

const CHANNELS: { value: DeliveryChannel; label: string }[] = [
  { value: 'EMAIL', label: 'Email' },
  { value: 'PORTAL', label: 'Client portal' },
];

export interface DeliveryPanelProps {
  documentId: string;
  /** The document's current lifecycle status; delivery is gated on EXECUTED. */
  status: string;
}

export function DeliveryPanel({ documentId, status }: DeliveryPanelProps) {
  const isExecuted = status.trim().toUpperCase() === DELIVERABLE_STATUS;

  const [deliveries, setDeliveries] = useState<DocumentDelivery[]>([]);
  const [loadError, setLoadError] = useState<Error | null>(null);
  const [recipient, setRecipient] = useState('');
  const [channel, setChannel] = useState<DeliveryChannel>('EMAIL');
  const [fieldError, setFieldError] = useState<string | null>(null);

  const send = useAsync<DocumentDelivery, [DeliveryInput]>(recordDelivery);

  // Load the existing delivery log for this document.
  useEffect(() => {
    let cancelled = false;
    setLoadError(null);
    listDeliveries(documentId)
      .then((rows) => {
        if (!cancelled) setDeliveries(rows);
      })
      .catch((err) => {
        if (!cancelled) setLoadError(err instanceof Error ? err : new Error(String(err)));
      });
    return () => {
      cancelled = true;
    };
  }, [documentId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isExecuted) return;
    if (!recipient.trim()) {
      setFieldError('A recipient is required.');
      return;
    }
    setFieldError(null);
    try {
      const row = await send.run({
        document_id: documentId,
        channel,
        recipient_contact_id: recipient.trim(),
      });
      // Prepend the freshly-recorded delivery so the log shows sent status.
      setDeliveries((prev) => [row, ...prev]);
      setRecipient('');
    } catch {
      // Surfaced via send.error below; nothing is logged on failure.
    }
  };

  return (
    <section aria-label="Document delivery" className="flex flex-col gap-6">
      <div>
        <h3 className="font-serif text-lg text-green-900 mb-1">Delivery</h3>
        {!isExecuted ? (
          <p role="status" className="text-sm text-green-800/70">
            Delivery is available once the document is {DELIVERABLE_STATUS}. Current status:{' '}
            <StatusBadge status={status} />
          </p>
        ) : (
          <p className="text-sm text-green-800/70">
            Record or send a copy of the executed document.
          </p>
        )}
      </div>

      {isExecuted && (
        <form onSubmit={handleSubmit} className="flex flex-col gap-2" aria-label="Send delivery">
          <FormField label="Channel">
            {({ id }) => (
              <select
                id={id}
                className="form-input"
                value={channel}
                onChange={(e) => setChannel(e.target.value as DeliveryChannel)}
              >
                {CHANNELS.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            )}
          </FormField>

          <FormField label="Recipient" required error={fieldError}>
            {({ id, errorClass }) => (
              <input
                id={id}
                className={`form-input ${errorClass}`}
                placeholder="Recipient contact id"
                value={recipient}
                onChange={(e) => setRecipient(e.target.value)}
              />
            )}
          </FormField>

          <div>
            <button
              type="submit"
              className="btn-primary"
              disabled={send.isPending}
              aria-busy={send.isPending}
            >
              {send.isPending ? 'Sending…' : 'Send delivery'}
            </button>
          </div>

          {send.isError && send.error && (
            <p role="alert" className="form-error">
              {send.error.message}
            </p>
          )}
        </form>
      )}

      <div>
        <h4 className="font-sans text-sm font-medium text-green-800 mb-2">Delivery log</h4>
        {loadError && (
          <p role="alert" className="form-error">
            Could not load deliveries: {loadError.message}
          </p>
        )}
        {deliveries.length === 0 && !loadError ? (
          <EmptyState title="No deliveries yet" message="Sent copies will appear here." />
        ) : (
          <ul className="flex flex-col gap-2">
            {deliveries.map((d) => (
              <li
                key={d.id}
                className="flex items-center justify-between rounded border border-green-800/10 px-3 py-2"
                data-testid="delivery-row"
              >
                <span className="text-sm text-green-900">
                  {d.channel} → <span className="font-mono">{d.recipient_contact_id}</span>
                </span>
                <StatusBadge status="SENT" />
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
