import { useCallback, useEffect, useState } from 'react';
import { toErrorMessage } from '../../../../lib/ops/errors';
import type { FormEvent } from 'react';
import {
  DataTable,
  FormField,
  Modal,
  ModuleGate,
  Money,
  StatusBadge,
  useAsync,
  useToast,
} from '../../../../lib/ops';
import type { Column } from '../../../../lib/ops';
import { useModules } from '../../../../lib/ops/useModules';
import { useDocumentTitle } from '../../../../lib/hooks';
import { contactName } from '../../../../lib/ops/types';
import {
  listBoardCharges,
  createBoardCharge,
  emitBoardCharge,
  listBoardAgreements,
  type BoardAgreement,
  type BoardCharge,
  type BoardChargeInput,
} from '../../../../lib/ops/api-boarding';

/**
 * OPS-BOARD-CHARGES — board_charges list + generate (module mod.boarding,
 * gated by ModuleGate; RLS `_module_gate` underneath).
 *
 * The schema's intended flow (§7.5/§7.11): a charge is deterministic
 * (rate × period) and EMITS a billable_line (source_kind='board') on the
 * agreement's boarder — the payer. 'Generate charge' picks an agreement
 * (amount prefills from its board_rate), a period, and calls createBoardCharge
 * which inserts the charge AND its billable_line. Settlement then happens on
 * the billing surface: an OPEN line rolls up via settle_billable_lines into an
 * INVOICE transaction, so a settled row links to /app/ops/transactions/:id and
 * the header links to /app/ops/transactions. A charge whose emission failed
 * shows UNBILLED with a real 'Emit to billing' retry.
 */

function firstOfMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

function lastOfMonth(): string {
  const d = new Date();
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  return `${last.getFullYear()}-${String(last.getMonth() + 1).padStart(2, '0')}-${String(
    last.getDate(),
  ).padStart(2, '0')}`;
}

function agreementLabel(a: BoardAgreement): string {
  const horse = a.horse?.nickname ?? a.horse?.registered_name ?? 'Horse';
  const boarder = contactName(a.boarder) || 'boarder';
  return `${horse} — ${boarder}`;
}

interface ChargeFormProps {
  agreements: BoardAgreement[];
  onSubmit: (input: BoardChargeInput) => Promise<void>;
  onCancel: () => void;
  submitting?: boolean;
  error?: string | null;
}

function ChargeForm({ agreements, onSubmit, onCancel, submitting, error }: ChargeFormProps) {
  const [agreementId, setAgreementId] = useState('');
  const [periodStart, setPeriodStart] = useState(firstOfMonth());
  const [periodEnd, setPeriodEnd] = useState(lastOfMonth());
  const [amount, setAmount] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  const pickAgreement = (id: string) => {
    setAgreementId(id);
    const picked = agreements.find((a) => a.id === id);
    // Deterministic rate × period: prefill the amount from the agreement's rate.
    setAmount(picked?.board_rate !== null && picked?.board_rate !== undefined ? String(picked.board_rate) : '');
  };

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const agreement = agreements.find((a) => a.id === agreementId);
    const parsed = Number(amount);
    if (!agreement || !periodStart || !periodEnd || amount.trim() === '' || Number.isNaN(parsed)) {
      setFormError('Agreement, period and amount are required.');
      return;
    }
    setFormError(null);
    await onSubmit({
      board_agreement_id: agreement.id,
      payer_contact_id: agreement.boarder_contact_id,
      horse_id: agreement.horse_id,
      period_start: periodStart,
      period_end: periodEnd,
      amount: parsed,
    });
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <FormField label="Agreement" required>
        {({ id, describedBy, errorClass }) => (
          <select
            id={id}
            className={`form-input ${errorClass}`}
            aria-describedby={describedBy}
            value={agreementId}
            onChange={(e) => pickAgreement(e.target.value)}
            disabled={submitting}
          >
            <option value="">Select an agreement…</option>
            {agreements
              .filter((a) => a.status === 'ACTIVE')
              .map((a) => (
                <option key={a.id} value={a.id}>
                  {agreementLabel(a)}
                </option>
              ))}
          </select>
        )}
      </FormField>

      <FormField label="Period start" required>
        {({ id, describedBy, errorClass }) => (
          <input
            id={id}
            type="date"
            className={`form-input ${errorClass}`}
            aria-describedby={describedBy}
            value={periodStart}
            onChange={(e) => setPeriodStart(e.target.value)}
            disabled={submitting}
          />
        )}
      </FormField>

      <FormField label="Period end" required>
        {({ id, describedBy, errorClass }) => (
          <input
            id={id}
            type="date"
            className={`form-input ${errorClass}`}
            aria-describedby={describedBy}
            value={periodEnd}
            onChange={(e) => setPeriodEnd(e.target.value)}
            disabled={submitting}
          />
        )}
      </FormField>

      <FormField label="Amount" required hint="Prefilled from the agreement's monthly rate.">
        {({ id, describedBy, errorClass }) => (
          <input
            id={id}
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

      {(formError || error) && (
        <p role="alert" className="form-error mb-4">
          {formError ?? error}
        </p>
      )}

      <div className="flex justify-end gap-3">
        <button type="button" className="btn-secondary" onClick={onCancel} disabled={submitting}>
          Cancel
        </button>
        <button type="submit" className="btn-primary" disabled={submitting} aria-busy={submitting}>
          {submitting ? 'Generating…' : 'Generate'}
        </button>
      </div>
    </form>
  );
}

export function BoardChargesPage() {
  useDocumentTitle('Board charges · Boarding');
  const modules = useModules();
  const boardingOn = modules['mod.boarding'] === true;

  const [charges, setCharges] = useState<BoardCharge[]>([]);
  const [agreements, setAgreements] = useState<BoardAgreement[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [generateOpen, setGenerateOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const toast = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [ch, ag] = await Promise.all([listBoardCharges(), listBoardAgreements()]);
      setCharges(ch);
      setAgreements(ag);
    } catch (err) {
      setLoadError(toErrorMessage(err, 'Could not load board charges.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!boardingOn) return;
    void load();
  }, [boardingOn, load]);

  const generate = useAsync(createBoardCharge);
  const emit = useAsync(emitBoardCharge);

  const handleGenerate = async (input: BoardChargeInput) => {
    setFormError(null);
    try {
      const created = await generate.run(input);
      setCharges((prev) => [created, ...prev]);
      toast.success('Charge generated and emitted to billing.');
      setGenerateOpen(false);
    } catch (err) {
      setFormError(toErrorMessage(err, 'Could not generate the charge.'));
    }
  };

  /** Retry the billable_line emission for a charge that has none (UNBILLED). */
  const handleEmit = async (charge: BoardCharge) => {
    const payer = charge.agreement?.boarder_contact_id;
    if (!payer) {
      toast.error('Cannot emit: the owning agreement is unavailable.');
      return;
    }
    try {
      const updated = await emit.run(charge, payer, charge.agreement?.horse_id ?? null);
      setCharges((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
      toast.success('Charge emitted to billing.');
    } catch (err) {
      toast.error(toErrorMessage(err, 'Could not emit the charge.'));
    }
  };

  const columns: Column<BoardCharge>[] = [
    {
      key: 'agreement',
      header: 'Agreement',
      render: (c) =>
        c.agreement
          ? `${c.agreement.horse?.nickname ?? c.agreement.horse?.registered_name ?? '—'} — ${
              contactName(c.agreement.boarder) || '—'
            }`
          : '—',
    },
    {
      key: 'period',
      header: 'Period',
      render: (c) => `${c.period_start} → ${c.period_end}`,
    },
    {
      key: 'amount',
      header: 'Amount',
      render: (c) => <Money amount={c.amount} />,
      className: 'text-right',
    },
    {
      key: 'billing',
      header: 'Billing',
      render: (c) => <StatusBadge status={c.billable_line?.status ?? 'UNBILLED'} />,
    },
    {
      key: 'settlement',
      header: '',
      render: (c) =>
        c.billable_line ? (
          <span className="text-green-800/70">Emitted</span>
        ) : (
          <button
            type="button"
            className="link-underline"
            disabled={emit.isPending}
            onClick={() => void handleEmit(c)}
          >
            Emit to billing
          </button>
        ),
    },
  ];

  return (
    <div className="max-w-5xl mx-auto py-8 px-4">
      <ModuleGate moduleKey="mod.boarding" modules={modules}>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="font-serif text-2xl text-green-900">Board charges</h1>
            <p className="text-sm text-green-800/70">
              Period charges emitted to billing.
            </p>
          </div>
          <button
            type="button"
            className="btn-primary"
            onClick={() => {
              setFormError(null);
              setGenerateOpen(true);
            }}
          >
            Generate charge
          </button>
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

        {loadError && (
          <p role="alert" className="form-error mb-4">
            {loadError}
          </p>
        )}

        <DataTable
          columns={columns}
          rows={charges}
          rowKey={(c) => c.id}
          loading={loading}
          emptyTitle="No board charges yet"
          emptyMessage="Generate a period charge from an active agreement."
        />

        <Modal
          open={generateOpen}
          onClose={() => setGenerateOpen(false)}
          title="Generate board charge"
          disableBackdropClose={generate.isPending}
        >
          {generateOpen && (
            <ChargeForm
              agreements={agreements}
              onSubmit={handleGenerate}
              onCancel={() => setGenerateOpen(false)}
              submitting={generate.isPending}
              error={formError}
            />
          )}
        </Modal>
      </ModuleGate>
    </div>
  );
}

export default BoardChargesPage;
