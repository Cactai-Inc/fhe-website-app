import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { toErrorMessage } from '../../../../lib/ops/errors';
import { DataTable, ModuleGate, Modal, AsyncButton, StatusBadge, formatMoney } from '../../../../lib/ops';
import type { Column } from '../../../../lib/ops';
import { useModules } from '../../../../lib/ops/useModules';
import {
  creditLedger,
  listLessonClients,
  listGrantableOfferings,
  compedCreditValue,
  revokeCreditGrant,
  requestGrantPayment,
  type CreditLedgerRow,
  type CreditOrigin,
  type CompedValue,
  type GrantableOffering,
  type LessonClientOption,
} from '../../../../lib/ops/api-lessons';
import { GrantCreditDialog } from './GrantCreditDialog';

/**
 * OPS-LESSON-CREDITS — the credits ledger, and where credits come FROM.
 *
 * TASK-AUTHORITY (2026-08-22) made this page read-only: it used to write
 * lesson_credits directly (a raw-insert grant modal, a read-modify-write consume
 * row action) — a second write path beside the credit engine, with no offering, no
 * purchase, no period, no expiry and no audit trail (D18/D19). Both are still gone.
 *
 * TASK-CREDITGRANT (2026-08-23) puts ORIGINATION back, and not as that button.
 * "Grant a credit" opens a three-mode form whose act is a staff-initiated ORDER;
 * the existing mint trigger makes the credit, exactly as a real checkout does.
 * Consumption still belongs to Sessions — this page has never debited anything.
 *
 * THE REACH (D17): Records → Lessons → "Open credits ledger" → here. The grant
 * button is the page's own primary action, and every staff-granted row carries its
 * mode, its reason, and its undo.
 *
 * The ledger is `credit_ledger()` — ONE named query — so a comped credit, a
 * billed-but-unpaid credit and a purchased one can never render identically again.
 */

const ORIGIN_LABEL: Record<CreditOrigin, string> = {
  purchase: 'Purchased',
  handwrite: 'Hand-written',
  comp: 'Comped',
  bill: 'Billed',
  // A cancelled or rescheduled standing slot leaves this behind — it was never
  // bought and never comped, and calling it either would be wrong.
  change: 'Returned',
  unknown: 'Unattributed',
};
const ORIGIN_TONE: Record<CreditOrigin, 'neutral' | 'info' | 'success' | 'warning' | 'danger'> = {
  purchase: 'neutral',
  handwrite: 'success',
  comp: 'info',
  bill: 'warning',
  change: 'neutral',
  unknown: 'danger',
};

export function LessonCreditsPage() {
  const modules = useModules();
  const lessonsOn = modules['mod.lessons'] === true;

  const [rows, setRows] = useState<CreditLedgerRow[]>([]);
  const [clients, setClients] = useState<LessonClientOption[]>([]);
  const [offerings, setOfferings] = useState<GrantableOffering[]>([]);
  const [comped, setComped] = useState<CompedValue | null>(null);
  const [clientFilter, setClientFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [granting, setGranting] = useState(false);

  // The undo, and the ask — each a small confirm of its own, never a bare click.
  const [undoing, setUndoing] = useState<CreditLedgerRow | null>(null);
  const [undoReason, setUndoReason] = useState('');
  const [asking, setAsking] = useState<CreditLedgerRow | null>(null);
  const [askNote, setAskNote] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async (clientId?: string) => {
    setLoading(true);
    setLoadError(null);
    try {
      const [ledger, clientRows, offeringRows, comps] = await Promise.all([
        creditLedger(clientId || undefined),
        listLessonClients(),
        listGrantableOfferings(),
        compedCreditValue(),
      ]);
      setRows(ledger);
      setClients(clientRows);
      setOfferings(offeringRows);
      setComped(comps);
    } catch (err) {
      setLoadError(toErrorMessage(err, 'Could not load lesson credits.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!lessonsOn) return;
    void load();
  }, [lessonsOn, load]);

  const applyFilter = async (clientId: string) => {
    setClientFilter(clientId);
    await load(clientId);
  };

  const reload = useCallback(() => load(clientFilter), [load, clientFilter]);

  const outstanding = useMemo(
    () => rows.reduce((sum, r) => sum + (Number(r.credits_remaining) || 0), 0),
    [rows],
  );

  const doUndo = async () => {
    if (!undoing?.purchase_id) return;
    setActionError(null);
    const out = await revokeCreditGrant(undoing.purchase_id, undoReason.trim());
    setUndoing(null);
    setUndoReason('');
    setNotice(
      `Undone — ${out.credits_revoked} credit row${out.credits_revoked === 1 ? '' : 's'} withdrawn and order ${out.display_code ?? ''} voided.`,
    );
    await reload();
  };

  const doAsk = async () => {
    if (!asking?.purchase_id) return;
    setActionError(null);
    const out = await requestGrantPayment(asking.purchase_id, askNote.trim() || null);
    setAsking(null);
    setAskNote('');
    setNotice(
      out.sent
        ? `Asked for ${formatMoney(out.amountDue)} — email sent and the client notified in the app.`
        : `Request recorded and the client notified in the app, but the email did not send${out.reason ? `: ${out.reason}` : '.'}`,
    );
    await reload();
  };

  const columns: Column<CreditLedgerRow>[] = [
    { key: 'client', header: 'Client', render: (r) => r.client_name ?? r.client_id.slice(0, 8) },
    {
      key: 'what',
      header: 'What it is for',
      render: (r) => (
        <span>
          {r.offering_name ?? r.package_key ?? '—'}
          {r.reason && (
            <span className="block text-xs text-green-800/60">“{r.reason}”</span>
          )}
        </span>
      ),
    },
    {
      key: 'origin',
      header: 'Origin',
      render: (r) => (
        <span>
          <StatusBadge status={ORIGIN_LABEL[r.origin]} tone={ORIGIN_TONE[r.origin]} />
          {r.origin === 'comp' && r.list_value !== null && (
            <span className="block text-xs text-green-800/60">
              {formatMoney(Number(r.list_value))} written off
            </span>
          )}
          {r.origin === 'bill' && Number(r.amount_due) > 0 && (
            <span className="block text-xs text-amber-800">
              {formatMoney(Number(r.amount_due))} owed
            </span>
          )}
        </span>
      ),
    },
    { key: 'total', header: 'Granted', render: (r) => r.credits_total, className: 'text-right' },
    {
      key: 'remaining',
      header: 'Remaining',
      render: (r) => (
        <span className={r.credits_remaining === 0 ? 'text-green-800/50' : 'font-medium'}>
          {r.credits_remaining}
        </span>
      ),
      className: 'text-right',
    },
    {
      key: 'purchased',
      header: 'Purchased',
      render: (r) => new Date(r.purchased_at).toLocaleDateString(),
    },
    {
      key: 'actions',
      header: '',
      render: (r) => (
        <span className="flex flex-wrap gap-3 justify-end">
          {r.origin === 'bill' && Number(r.amount_due) > 0 && (
            <button type="button" className="link-underline text-sm"
                    onClick={() => { setActionError(null); setAsking(r); }}>
              Request payment
            </button>
          )}
          {r.can_undo ? (
            <button type="button" className="link-underline text-sm"
                    onClick={() => { setActionError(null); setUndoing(r); }}>
              Undo
            </button>
          ) : (
            !['purchase', 'change', 'unknown'].includes(r.origin) && r.undo_blocked && (
              <span className="text-xs text-green-800/50" title={r.undo_blocked}>
                No undo
              </span>
            )
          )}
        </span>
      ),
      className: 'text-right',
    },
  ];

  return (
    <div className="max-w-5xl mx-auto py-8 px-4">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-serif text-2xl text-green-900">Lesson credits</h1>
          <p className="text-sm text-green-800/70">Per-client credit ledger and balances.</p>
        </div>
        {lessonsOn && (
          <button type="button" className="btn-primary" onClick={() => setGranting(true)}>
            Grant a credit
          </button>
        )}
      </div>

      <ModuleGate moduleKey="mod.lessons" modules={modules}>
        <p className="mb-4 rounded bg-green-50 px-4 py-3 text-sm text-green-900">
          Credits are minted by orders — a client's own purchase, or a staff grant from
          this page. They are consumed by completing a session on{' '}
          <Link to="/app/ops/lessons/sessions" className="link-underline font-medium">
            Sessions
          </Link>
          . Nothing here debits a credit.
        </p>

        <div className="mb-4 flex flex-wrap items-end justify-between gap-4">
          <div>
            <label htmlFor="credits-client-filter" className="form-label">
              Client
            </label>
            <select
              id="credits-client-filter"
              className="form-input"
              value={clientFilter}
              onChange={(e) => void applyFilter(e.target.value)}
            >
              <option value="">All clients</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-wrap gap-8">
            <p className="text-sm text-green-900" data-testid="credits-outstanding">
              Credits outstanding: <span className="font-serif text-xl">{outstanding}</span>
            </p>
            {/* D17: the comps figure is REACHABLE here today. Dashboard zone B1 is
                the named follow-up surface, not a substitute for showing it. */}
            {comped && (
              <p className="text-sm text-green-900" data-testid="credits-comped">
                Comped this month:{' '}
                <span className="font-serif text-xl">{formatMoney(Number(comped.list_value))}</span>
                <span className="block text-xs text-green-800/60">
                  {comped.comp_count} comp{comped.comp_count === 1 ? '' : 's'} ·{' '}
                  {comped.credits_comped} credit{comped.credits_comped === 1 ? '' : 's'}
                </span>
              </p>
            )}
          </div>
        </div>

        {loadError && (
          <p role="alert" className="form-error mb-4">
            {loadError}
          </p>
        )}
        {notice && (
          <p className="mb-4 rounded bg-green-800/5 px-4 py-3 text-sm text-green-900"
             data-testid="credits-notice">
            {notice}
          </p>
        )}

        <DataTable
          columns={columns}
          rows={rows}
          rowKey={(r) => r.id}
          loading={loading && rows.length === 0}
          emptyTitle="No lesson credits yet"
          emptyMessage="Credits appear here once an order mints them — a client purchase, or a staff grant."
        />

        <GrantCreditDialog
          open={granting}
          onClose={() => setGranting(false)}
          clients={clients}
          offerings={offerings}
          onGranted={reload}
        />

        {/* D19.1 — the undo states itself before it runs, and takes its own reason. */}
        <Modal
          open={Boolean(undoing)}
          onClose={() => { setUndoing(null); setUndoReason(''); }}
          title="Undo this grant"
          footer={
            <>
              <button type="button" className="btn-secondary"
                      onClick={() => { setUndoing(null); setUndoReason(''); }}>
                Keep it
              </button>
              <AsyncButton onClick={doUndo} pendingLabel="Undoing…"
                           disabled={!undoReason.trim()}
                           onError={(e) => setActionError(e.message)}>
                Undo the grant
              </AsyncButton>
            </>
          }
        >
          {undoing && (
            <div className="space-y-3 text-sm text-green-900">
              <p>
                This withdraws <strong>{undoing.credits_total}</strong> ×{' '}
                {undoing.offering_name ?? undoing.package_key} from{' '}
                <strong>{undoing.client_name}</strong> and voids order{' '}
                <span className="font-mono">{undoing.display_code}</span>.
              </p>
              {undoing.origin === 'handwrite' && (
                <p>The {formatMoney(Number(undoing.amount))} recorded as received is reversed with it.</p>
              )}
              {undoing.origin === 'comp' && (
                <p>The comped {formatMoney(Number(undoing.list_value))} stops counting as a loss.</p>
              )}
              {undoing.origin === 'bill' && (
                <p>The {formatMoney(Number(undoing.amount_due))} owed is cancelled.</p>
              )}
              <div>
                <label htmlFor="undo-reason" className="form-label">Reason (required)</label>
                <textarea id="undo-reason" className="form-input" rows={2} value={undoReason}
                          onChange={(e) => setUndoReason(e.target.value)} />
              </div>
              <p className="text-green-800/60">
                The order and its line are kept as evidence, marked void — nothing is deleted.
              </p>
            </div>
          )}
          {actionError && <p role="alert" className="form-error mt-3">{actionError}</p>}
        </Modal>

        {/* One message, on purpose. There is no reminder schedule behind it (D9). */}
        <Modal
          open={Boolean(asking)}
          onClose={() => { setAsking(null); setAskNote(''); }}
          title="Request payment"
          footer={
            <>
              <button type="button" className="btn-secondary"
                      onClick={() => { setAsking(null); setAskNote(''); }}>
                Cancel
              </button>
              <AsyncButton onClick={doAsk} pendingLabel="Sending…"
                           onError={(e) => setActionError(e.message)}>
                Send the request
              </AsyncButton>
            </>
          }
        >
          {asking && (
            <div className="space-y-3 text-sm text-green-900">
              <p>
                Asks <strong>{asking.client_name}</strong> for{' '}
                <strong>{formatMoney(Number(asking.amount_due))}</strong> on order{' '}
                <span className="font-mono">{asking.display_code}</span> — one notification in
                the app and one email. Nothing repeats it.
              </p>
              <div>
                <label htmlFor="ask-note" className="form-label">Note (optional)</label>
                <textarea id="ask-note" className="form-input" rows={2} value={askNote}
                          onChange={(e) => setAskNote(e.target.value)} />
              </div>
            </div>
          )}
          {actionError && <p role="alert" className="form-error mt-3">{actionError}</p>}
        </Modal>
      </ModuleGate>
    </div>
  );
}

export default LessonCreditsPage;
