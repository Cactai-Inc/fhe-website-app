import { useCallback, useEffect, useState } from 'react';
import { FormField, StatusBadge, EmptyState, useAsync } from '../../../lib/ops';
import { listDeliveries, recordDelivery } from '../../../lib/api';
import { listEngagementPartyContacts } from '../../../lib/ops/api-documents';
import type {
  DocumentDelivery,
  DeliveryChannel,
  DeliveryInput,
  EngagementPartyContact,
} from '../../../lib/ops/types';

/**
 * OPS-DOC-DELIVER — Document delivery panel (§15 critical chain 2 tail).
 *
 * The tail of the contract chain: once a document reaches EXECUTED, staff
 * records/sends a delivery via `recordDelivery` →
 * `supabase.from('document_deliveries').insert(...)` (RLS org-scoped). The
 * delivery log lists prior sends (newest first) from `listDeliveries`.
 *
 * RECIPIENT is picked from the engagement's parties (owner directive: no raw
 * contact-id input) — `listEngagementPartyContacts(engagementId)` flattens
 * engagement_parties → contacts into "Name — role (email)". A recipient with
 * no email on file DISABLES the send button (with a hint) so staff never
 * records an email delivery that cannot land.
 *
 * A second action, "Email all parties + company copy", POSTs
 * /api/deliver-document {documentId}: the endpoint emails every party with an
 * address (inlining the executed text), sends the company notice, and is
 * idempotent. Its {delivered, companyNotified} result renders as an inline
 * note and the log is re-listed (the endpoint records deliveries itself).
 *
 * GATING: the send form is HIDDEN until the document is EXECUTED — you cannot
 * deliver a DRAFT/SENT contract. A non-EXECUTED document shows a locked
 * notice instead of the form, so `recordDelivery` never fires on an unsigned
 * contract.
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
  /** The document's engagement — source of the recipient (parties) dropdown. */
  engagementId: string;
  /** The document's current lifecycle status; delivery is gated on EXECUTED. */
  status: string;
}

export function DeliveryPanel({ documentId, engagementId, status }: DeliveryPanelProps) {
  const isExecuted = status.trim().toUpperCase() === DELIVERABLE_STATUS;

  const [deliveries, setDeliveries] = useState<DocumentDelivery[]>([]);
  const [loadError, setLoadError] = useState<Error | null>(null);
  const [parties, setParties] = useState<EngagementPartyContact[]>([]);
  const [partiesError, setPartiesError] = useState<Error | null>(null);
  const [recipient, setRecipient] = useState('');
  const [channel, setChannel] = useState<DeliveryChannel>('EMAIL');
  const [fieldError, setFieldError] = useState<string | null>(null);

  // "Email all parties + company copy" (POST /api/deliver-document) state.
  const [bulkPending, setBulkPending] = useState(false);
  const [bulkError, setBulkError] = useState<string | null>(null);
  const [bulkResult, setBulkResult] = useState<{
    delivered: number;
    companyNotified: boolean;
  } | null>(null);

  const send = useAsync<DocumentDelivery, [DeliveryInput]>(recordDelivery);

  // Load the existing delivery log for this document.
  const loadLog = useCallback(() => {
    setLoadError(null);
    return listDeliveries(documentId)
      .then((rows) => setDeliveries(rows))
      .catch((err) => {
        setLoadError(err instanceof Error ? err : new Error(String(err)));
      });
  }, [documentId]);

  useEffect(() => {
    void loadLog();
  }, [loadLog]);

  // Load the engagement's parties for the recipient dropdown (only once the
  // form is reachable — a gated DRAFT never needs the roster).
  useEffect(() => {
    if (!isExecuted) return;
    let cancelled = false;
    setPartiesError(null);
    listEngagementPartyContacts(engagementId)
      .then((rows) => {
        if (!cancelled) setParties(rows);
      })
      .catch((err) => {
        if (!cancelled) setPartiesError(err instanceof Error ? err : new Error(String(err)));
      });
    return () => {
      cancelled = true;
    };
  }, [engagementId, isExecuted]);

  const selected = parties.find((p) => p.contact_id === recipient) ?? null;
  const selectedHasNoEmail = selected !== null && !selected.email;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isExecuted || selectedHasNoEmail) return;
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

  const handleDeliverAll = async () => {
    setBulkPending(true);
    setBulkError(null);
    setBulkResult(null);
    try {
      const res = await fetch('/api/deliver-document', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentId }),
      });
      const body = (await res.json()) as {
        delivered?: { recipientContactId: string }[];
        companyNotified?: boolean;
        error?: string;
      };
      if (!res.ok) throw new Error(body.error ?? `Delivery failed (HTTP ${res.status})`);
      setBulkResult({
        delivered: body.delivered?.length ?? 0,
        companyNotified: body.companyNotified === true,
      });
      // The endpoint records document_deliveries itself — re-list the log.
      void loadLog();
    } catch (err) {
      setBulkError(err instanceof Error ? err.message : String(err));
    } finally {
      setBulkPending(false);
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
              <select
                id={id}
                className={`form-input ${errorClass}`}
                value={recipient}
                onChange={(e) => {
                  setRecipient(e.target.value);
                  setFieldError(null);
                }}
              >
                <option value="">Select a recipient…</option>
                {parties.map((p) => (
                  <option key={p.contact_id} value={p.contact_id}>
                    {`${p.name || 'Unnamed contact'} — ${p.party_role} (${p.email ?? 'no email'})`}
                  </option>
                ))}
              </select>
            )}
          </FormField>

          {partiesError && (
            <p role="alert" className="form-error">
              Could not load recipients: {partiesError.message}
            </p>
          )}

          {selectedHasNoEmail && (
            <p className="form-hint" data-testid="no-email-hint">
              This recipient has no email address on file — add one on their contact record
              before sending.
            </p>
          )}

          <div>
            <button
              type="submit"
              className="btn-primary"
              disabled={send.isPending || selectedHasNoEmail}
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

      {isExecuted && (
        <div className="flex flex-col gap-2">
          <div>
            <button
              type="button"
              className="btn-secondary"
              onClick={handleDeliverAll}
              disabled={bulkPending}
              aria-busy={bulkPending}
            >
              {bulkPending ? 'Emailing…' : 'Email all parties + company copy'}
            </button>
          </div>
          {bulkResult && (
            <p role="status" className="text-sm text-green-800/85" data-testid="deliver-all-result">
              Emailed {bulkResult.delivered} recipient{bulkResult.delivered === 1 ? '' : 's'}.{' '}
              Company copy {bulkResult.companyNotified ? 'sent' : 'not sent'}.
            </p>
          )}
          {bulkError && (
            <p role="alert" className="form-error">
              {bulkError}
            </p>
          )}
        </div>
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
