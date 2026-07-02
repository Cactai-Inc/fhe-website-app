/**
 * OPS-INTAKE — staff intake-submissions queue (surface `ops`, core — ungated).
 *
 * /app/ops/intake → intake_submissions filtered by status (NEW default) via
 * listIntakeSubmissions. Clicking a row opens a detail drawer that renders the
 * submission's payload fields plus the actions:
 *   - Mark reviewed / Dismiss  → markSubmissionStatus(id, status)
 *   - Convert to engagement    → (brokerage form_keys only) resolve the contact
 *     (findOrCreateContactByEmail), open the engagement through the REAL
 *     brokerage RPC wrappers in src/lib/api.ts, then stamp CONVERTED +
 *     converted_engagement_id via markSubmissionConverted.
 *
 * The brokerage RPCs self-gate on mod.brokerage server-side (require_module);
 * a gate rejection surfaces on the drawer's error branch — nothing is faked.
 */
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { DataTable, Modal, StatusBadge, useAsync, useToast } from '../../../lib/ops';
import type { Column } from '../../../lib/ops';
import { useDocumentTitle } from '../../../lib/hooks';
import {
  listIntakeSubmissions,
  markSubmissionStatus,
  markSubmissionConverted,
  findOrCreateContactByEmail,
} from '../../../lib/ops/api-intake';
import type { IntakeSubmission, IntakeSubmissionStatus } from '../../../lib/ops/api-intake';
import {
  createPurchaseEngagement,
  createSearchEngagement,
  createLeaseEngagement,
} from '../../../lib/api';

type StatusFilter = IntakeSubmissionStatus | 'ALL';

const STATUS_FILTERS: StatusFilter[] = ['NEW', 'REVIEWED', 'CONVERTED', 'DISMISSED', 'ALL'];

/**
 * Brokerage form_key → engagement RPC wrapper. Direction (retained_by /
 * deal_side) is token-driven per form (§7.1) — never hard-coded per document.
 * Non-brokerage intake forms have no conversion path (the button is not
 * rendered for them).
 */
const BROKERAGE_CONVERSIONS: Record<string, (contactId: string) => Promise<string>> = {
  INTAKE_HORSE_PURCHASE: (contactId) => createPurchaseEngagement({ buyerContactId: contactId }),
  INTAKE_HORSE_FINDER: (contactId) =>
    createSearchEngagement({ clientContactId: contactId, retainedBy: 'buyer', dealSide: 'BUY' }),
  INTAKE_HORSE_SALE: (contactId) =>
    createSearchEngagement({ clientContactId: contactId, retainedBy: 'owner', dealSide: 'SELL' }),
  INTAKE_HORSE_LEASE_IN: (contactId) =>
    createLeaseEngagement({ clientContactId: contactId, dealSide: 'LEASE_IN' }),
  INTAKE_HORSE_LEASE_OUT: (contactId) =>
    createLeaseEngagement({ clientContactId: contactId, dealSide: 'LEASE_OUT' }),
};

/** Best-available display name for the submitter (drawer + contact creation). */
function submitterName(sub: IntakeSubmission): string {
  if (sub.contact_name) return sub.contact_name;
  const fromPayload =
    sub.payload['full_legal_name'] ?? sub.payload['full_name'] ?? sub.payload['client_name'];
  if (typeof fromPayload === 'string' && fromPayload.trim()) return fromPayload;
  return 'Intake contact';
}

function payloadValue(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

const COLUMNS: Column<IntakeSubmission>[] = [
  {
    key: 'created_at',
    header: 'Received',
    render: (r) => new Date(r.created_at).toLocaleDateString(),
  },
  { key: 'form_key', header: 'Form', render: (r) => <span className="font-mono text-xs">{r.form_key}</span> },
  { key: 'contact_name', header: 'Name', render: (r) => submitterName(r) },
  { key: 'contact_email', header: 'Email', render: (r) => r.contact_email ?? '—' },
  { key: 'status', header: 'Status', render: (r) => <StatusBadge status={r.status} /> },
];

export function IntakePage() {
  useDocumentTitle('Intake');
  const [rows, setRows] = useState<IntakeSubmission[]>([]);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('NEW');
  const [selected, setSelected] = useState<IntakeSubmission | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const load = useAsync(listIntakeSubmissions);
  const toast = useToast();

  const refresh = useCallback(
    async (filter: StatusFilter) => {
      const data = await load.run(filter === 'ALL' ? undefined : filter);
      setRows(data);
    },
    [load],
  );

  useEffect(() => {
    refresh(statusFilter).catch(() => {
      /* surfaced via load.isError */
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  const review = useAsync(async (sub: IntakeSubmission, status: 'REVIEWED' | 'DISMISSED') => {
    return markSubmissionStatus(sub.id, status);
  });

  const convert = useAsync(async (sub: IntakeSubmission) => {
    const toEngagement = BROKERAGE_CONVERSIONS[sub.form_key];
    if (!toEngagement) {
      throw new Error(`No engagement conversion is defined for ${sub.form_key}.`);
    }
    const contactId = await findOrCreateContactByEmail(submitterName(sub), sub.contact_email);
    const engagementId = await toEngagement(contactId);
    await markSubmissionConverted(sub.id, engagementId);
    return engagementId;
  });

  const closeDrawer = () => {
    setActionError(null);
    setSelected(null);
  };

  const handleReview = async (sub: IntakeSubmission, status: 'REVIEWED' | 'DISMISSED') => {
    setActionError(null);
    try {
      await review.run(sub, status);
      toast.success(status === 'REVIEWED' ? 'Submission marked reviewed.' : 'Submission dismissed.');
      setSelected(null);
      await refresh(statusFilter);
    } catch (err) {
      // Error branch: keep the drawer open, surface the message.
      setActionError(err instanceof Error ? err.message : 'Could not update submission.');
    }
  };

  const handleConvert = async (sub: IntakeSubmission) => {
    setActionError(null);
    try {
      const engagementId = await convert.run(sub);
      toast.success(`Converted to engagement ${engagementId.slice(0, 8)}.`);
      setSelected(null);
      await refresh(statusFilter);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Could not convert submission.');
    }
  };

  const busy = review.isPending || convert.isPending;
  const convertible =
    selected !== null &&
    BROKERAGE_CONVERSIONS[selected.form_key] !== undefined &&
    (selected.status === 'NEW' || selected.status === 'REVIEWED');
  const actionable = selected !== null && (selected.status === 'NEW' || selected.status === 'REVIEWED');

  return (
    <div className="max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-serif text-2xl text-green-900">Intake</h1>
        <div>
          <label htmlFor="intake-status-filter" className="sr-only">
            Filter by status
          </label>
          <select
            id="intake-status-filter"
            className="form-input"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
          >
            {STATUS_FILTERS.map((s) => (
              <option key={s} value={s}>
                {s === 'ALL' ? 'All statuses' : s}
              </option>
            ))}
          </select>
        </div>
      </div>

      {toast.toasts.map((t) => (
        <div
          key={t.id}
          role="status"
          className={`mb-4 rounded px-4 py-2 text-sm ${
            t.tone === 'error' ? 'bg-red-50 text-red-800' : 'bg-green-50 text-green-900'
          }`}
        >
          {t.message}
        </div>
      ))}

      {load.isError && (
        <p role="alert" className="form-error mb-4">
          {load.error?.message ?? 'Could not load intake submissions.'}
        </p>
      )}

      <DataTable
        columns={COLUMNS}
        rows={rows}
        loading={load.isPending && rows.length === 0}
        rowKey={(r) => r.id}
        emptyTitle="No submissions"
        emptyMessage="Nothing in the intake queue for this status."
        onRowClick={(row) => {
          setActionError(null);
          setSelected(row);
        }}
      />

      <Modal
        open={selected !== null}
        onClose={closeDrawer}
        title="Intake submission"
        disableBackdropClose={busy}
      >
        {selected && (
          <div className="flex flex-col gap-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-sans font-medium text-green-900">
                  {submitterName(selected)}
                </p>
                <p className="text-xs text-green-800/70">{selected.contact_email ?? 'No email'}</p>
                <p className="font-mono text-xs text-green-800/70 mt-1">{selected.form_key}</p>
              </div>
              <StatusBadge status={selected.status} />
            </div>

            {selected.converted_engagement_id && (
              <p className="text-sm">
                <Link
                  to={`/app/ops/engagements/${selected.converted_engagement_id}`}
                  className="link-underline"
                >
                  View converted engagement
                </Link>
              </p>
            )}

            <section aria-label="Submission fields">
              <h3 className="form-label mb-2">Submitted fields</h3>
              {Object.keys(selected.payload).length === 0 ? (
                <p className="text-sm text-green-800/70">No fields submitted.</p>
              ) : (
                <dl className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {Object.entries(selected.payload).map(([key, value]) => (
                    <div key={key}>
                      <dt className="text-xs font-sans font-medium text-green-800/70">{key}</dt>
                      <dd className="text-sm text-green-900">{payloadValue(value)}</dd>
                    </div>
                  ))}
                </dl>
              )}
            </section>

            {actionError && (
              <p role="alert" className="form-error">
                {actionError}
              </p>
            )}

            <div className="flex flex-wrap justify-end gap-3">
              {actionable && (
                <>
                  {selected.status === 'NEW' && (
                    <button
                      type="button"
                      className="btn-outline-gold text-sm"
                      disabled={busy}
                      onClick={() => handleReview(selected, 'REVIEWED')}
                    >
                      Mark reviewed
                    </button>
                  )}
                  <button
                    type="button"
                    className="btn-outline-gold text-sm"
                    disabled={busy}
                    onClick={() => handleReview(selected, 'DISMISSED')}
                  >
                    Dismiss
                  </button>
                </>
              )}
              {convertible && (
                <button
                  type="button"
                  className="btn-primary text-sm"
                  disabled={busy}
                  aria-busy={convert.isPending}
                  onClick={() => handleConvert(selected)}
                >
                  {convert.isPending ? 'Converting…' : 'Convert to engagement'}
                </button>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

export default IntakePage;
