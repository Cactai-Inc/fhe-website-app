import { useCallback, useEffect, useMemo, useState } from 'react';
import { toErrorMessage } from '../../../../lib/ops/errors';
import type { FormEvent } from 'react';
import { Helmet } from 'react-helmet-async';
import {
  AsyncButton,
  DataTable,
  FormField,
  Modal,
  ModuleGate,
  Money,
  StatusBadge,
  useToast,
} from '../../../../lib/ops';
import { useModules } from '../../../../lib/ops/useModules';
import { contactName } from '../../../../lib/ops/types';
import type { BillableLine } from '../../../../lib/ops/types';
import {
  listCostAllocationRules,
  createCostAllocationRule,
  updateCostAllocationRule,
  deleteCostAllocationRule,
  resolveConsumptionBilling,
  listConsumptionBillableLines,
  listContactOptions,
  listHorseOptions,
  monthToPeriod,
  ALLOCATION_SCOPES,
  type CostAllocationRule,
  type CostAllocationRuleInput,
  type AllocationScope,
  type ContactOption,
  type HorseOption,
} from '../../../../lib/ops/api-barnops';

/**
 * BARNOPS-ALLOCATION — cost_allocation_rules CRUD + "Resolve billing"
 * (mod.barnops).
 *
 * Rules are the explicit OVERRIDE layer for attribution (§7.7): a
 * horse/lease/board-scoped payer split, or the tenant's default/barn payer
 * ('default' scope) that absorbs any uncovered remainder. Create/edit via a
 * modal (createCostAllocationRule/updateCostAllocationRule); "Remove"
 * soft-deletes. "Resolve billing" picks a month, calls the REAL
 * resolve_consumption_billing RPC with that month's tstzrange, then fetches
 * and renders the billable_lines the run produced (payer, horse, qty, amount,
 * status). The resolver is idempotent server-side, so re-running is safe.
 */

type ModalState = { mode: 'closed' } | { mode: 'create' } | { mode: 'edit'; rule: CostAllocationRule };

function currentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function horseLabel(h: HorseOption): string {
  return h.nickname ?? h.registered_name ?? h.display_code ?? h.id.slice(0, 8);
}

function RuleForm({
  rule,
  contacts,
  horses,
  submitting,
  error,
  onSubmit,
  onCancel,
}: {
  rule: CostAllocationRule | null;
  contacts: ContactOption[];
  horses: HorseOption[];
  submitting: boolean;
  error: string | null;
  onSubmit: (input: CostAllocationRuleInput) => void;
  onCancel: () => void;
}) {
  const [scope, setScope] = useState<AllocationScope>(rule?.scope ?? 'horse');
  const [scopeId, setScopeId] = useState(rule?.scope_id ?? '');
  const [payerId, setPayerId] = useState(rule?.payer_contact_id ?? '');
  const [sharePct, setSharePct] = useState(rule ? String(rule.share_pct) : '100');
  const [effectiveFrom, setEffectiveFrom] = useState(rule?.effective_from ?? '');
  const [effectiveTo, setEffectiveTo] = useState(rule?.effective_to ?? '');

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    onSubmit({
      scope,
      scope_id: scope === 'default' ? null : scopeId || null,
      payer_contact_id: payerId,
      share_pct: Number(sharePct),
      effective_from: effectiveFrom || null,
      effective_to: effectiveTo || null,
    });
  };

  return (
    <form onSubmit={handleSubmit} noValidate>
      <FormField
        label="Scope"
        required
        hint="'default' names the barn payer that absorbs uncovered remainders."
      >
        {({ id, errorClass }) => (
          <select
            id={id}
            className={`form-input ${errorClass}`}
            value={scope}
            onChange={(e) => {
              setScope(e.target.value as AllocationScope);
              setScopeId('');
            }}
          >
            {ALLOCATION_SCOPES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        )}
      </FormField>

      {scope === 'horse' && (
        <FormField label="Horse" required>
          {({ id, errorClass }) => (
            <select
              id={id}
              className={`form-input ${errorClass}`}
              required
              value={scopeId}
              onChange={(e) => setScopeId(e.target.value)}
            >
              <option value="">— Pick a horse —</option>
              {horses.map((h) => (
                <option key={h.id} value={h.id}>
                  {horseLabel(h)}
                </option>
              ))}
            </select>
          )}
        </FormField>
      )}
      {(scope === 'lease' || scope === 'board') && (
        <FormField
          label={scope === 'lease' ? 'Lease id' : 'Board agreement id'}
          required
          hint="The scoped record's UUID."
        >
          {({ id, errorClass }) => (
            <input
              id={id}
              type="text"
              className={`form-input ${errorClass}`}
              required
              value={scopeId}
              onChange={(e) => setScopeId(e.target.value)}
            />
          )}
        </FormField>
      )}

      <FormField label="Payer" required>
        {({ id, errorClass }) => (
          <select
            id={id}
            className={`form-input ${errorClass}`}
            required
            value={payerId}
            onChange={(e) => setPayerId(e.target.value)}
          >
            <option value="">— Pick a payer —</option>
            {contacts.map((c) => (
              <option key={c.id} value={c.id}>
                {contactName(c)}
              </option>
            ))}
          </select>
        )}
      </FormField>

      <FormField label="Share %" required hint="Splits for a scope should sum to 100.">
        {({ id, errorClass }) => (
          <input
            id={id}
            type="number"
            min="0"
            max="100"
            step="any"
            className={`form-input ${errorClass}`}
            required
            value={sharePct}
            onChange={(e) => setSharePct(e.target.value)}
          />
        )}
      </FormField>

      <div className="grid gap-x-6 sm:grid-cols-2">
        <FormField label="Effective from">
          {({ id, errorClass }) => (
            <input
              id={id}
              type="date"
              className={`form-input ${errorClass}`}
              value={effectiveFrom}
              onChange={(e) => setEffectiveFrom(e.target.value)}
            />
          )}
        </FormField>
        <FormField label="Effective to">
          {({ id, errorClass }) => (
            <input
              id={id}
              type="date"
              className={`form-input ${errorClass}`}
              value={effectiveTo}
              onChange={(e) => setEffectiveTo(e.target.value)}
            />
          )}
        </FormField>
      </div>

      {error && (
        <p role="alert" className="form-error mb-3">
          {error}
        </p>
      )}

      <div className="flex justify-end gap-3">
        <button type="button" className="btn-secondary" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="btn-primary" disabled={submitting}>
          {rule ? 'Save changes' : 'Create rule'}
        </button>
      </div>
    </form>
  );
}

export default function AllocationRulesPage() {
  const modules = useModules();
  const barnopsOn = modules['mod.barnops'] === true;
  const toast = useToast();

  const [rules, setRules] = useState<CostAllocationRule[]>([]);
  const [contacts, setContacts] = useState<ContactOption[]>([]);
  const [horses, setHorses] = useState<HorseOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [modal, setModal] = useState<ModalState>({ mode: 'closed' });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Resolve-billing state.
  const [month, setMonth] = useState(currentMonth());
  const [resolved, setResolved] = useState<{
    period: string;
    count: number;
    lines: BillableLine[];
  } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [r, c, h] = await Promise.all([
        listCostAllocationRules(),
        listContactOptions(),
        listHorseOptions(),
      ]);
      setRules(r);
      setContacts(c);
      setHorses(h);
    } catch (err) {
      setLoadError(toErrorMessage(err, 'Could not load allocation rules.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!barnopsOn) return;
    void load();
  }, [barnopsOn, load]);

  const contactById = useMemo(() => new Map(contacts.map((c) => [c.id, c])), [contacts]);
  const horseById = useMemo(() => new Map(horses.map((h) => [h.id, h])), [horses]);

  const scopeTarget = (rule: CostAllocationRule): string => {
    if (rule.scope === 'default') return 'Barn default';
    if (!rule.scope_id) return '—';
    if (rule.scope === 'horse') {
      const h = horseById.get(rule.scope_id);
      return h ? horseLabel(h) : rule.scope_id.slice(0, 8);
    }
    return rule.scope_id.slice(0, 8);
  };

  const closeModal = () => {
    setFormError(null);
    setModal({ mode: 'closed' });
  };

  const handleRuleSubmit = async (input: CostAllocationRuleInput) => {
    const editing = modal.mode === 'edit' ? modal.rule : null;
    setSaving(true);
    setFormError(null);
    try {
      if (editing) {
        await updateCostAllocationRule(editing.id, input);
      } else {
        await createCostAllocationRule(input);
      }
      await load();
      toast.success(editing ? 'Rule updated.' : 'Rule created.');
      setModal({ mode: 'closed' });
    } catch (err) {
      setFormError(toErrorMessage(err, 'Could not save the rule.'));
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async (rule: CostAllocationRule) => {
    try {
      await deleteCostAllocationRule(rule.id);
      setRules((prev) => prev.filter((r) => r.id !== rule.id));
      toast.success('Rule removed.');
    } catch (err) {
      toast.error(toErrorMessage(err, 'Could not remove the rule.'));
    }
  };

  const handleResolve = async () => {
    const period = monthToPeriod(month);
    const count = await resolveConsumptionBilling(period);
    const lines = await listConsumptionBillableLines(period);
    setResolved({ period, count, lines });
  };

  return (
    <div className="max-w-5xl mx-auto py-8 px-4">
      <Helmet>
        <title>Allocation rules · Barn Ops</title>
      </Helmet>

      <ModuleGate moduleKey="mod.barnops" modules={modules}>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="font-serif text-2xl text-green-900">Cost allocation rules</h1>
            <p className="text-sm text-green-800/70">
              Overrides for consumption attribution — plus the default/barn payer that absorbs
              uncovered remainders.
            </p>
          </div>
          <button
            type="button"
            className="btn-primary"
            onClick={() => {
              setFormError(null);
              setModal({ mode: 'create' });
            }}
          >
            New rule
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

        {loadError ? (
          <p role="alert" className="form-error mb-4">
            {loadError}
          </p>
        ) : (
          <DataTable<CostAllocationRule>
            columns={[
              { key: 'scope', header: 'Scope', render: (r) => r.scope },
              { key: 'target', header: 'Target', render: (r) => scopeTarget(r) },
              {
                key: 'payer',
                header: 'Payer',
                render: (r) => contactName(contactById.get(r.payer_contact_id)) || '—',
              },
              {
                key: 'share',
                header: 'Share %',
                className: 'text-right',
                render: (r) => `${r.share_pct}%`,
              },
              {
                key: 'effective',
                header: 'Effective',
                render: (r) =>
                  r.effective_from || r.effective_to
                    ? `${r.effective_from ?? '…'} → ${r.effective_to ?? '…'}`
                    : 'Always',
              },
            ]}
            rows={rules}
            rowKey={(r) => r.id}
            loading={loading}
            emptyTitle="No allocation rules yet"
            emptyMessage="Without an override, attribution derives from each horse's parties; add a 'default' rule for the barn payer."
            onRowClick={(rule) => {
              setFormError(null);
              setModal({ mode: 'edit', rule });
            }}
            rowActions={[
              {
                label: 'Remove',
                onClick: (rule) => {
                  void handleRemove(rule);
                },
              },
            ]}
          />
        )}

        <section
          aria-labelledby="resolve-heading"
          className="mt-10 rounded border border-green-800/15 bg-green-800/5 p-5"
        >
          <h2 id="resolve-heading" className="font-serif text-lg text-green-900 mb-2">
            Resolve billing
          </h2>
          <p className="text-sm text-green-800/70 mb-4">
            Deterministically turns the period's consumption events into billable lines per payer
            (override → horse parties → barn default). Safe to re-run: a re-run replaces its own
            open lines for the period.
          </p>
          <div className="flex items-end gap-4">
            <FormField label="Period (month)" required>
              {({ id, errorClass }) => (
                <input
                  id={id}
                  type="month"
                  className={`form-input ${errorClass}`}
                  required
                  value={month}
                  onChange={(e) => setMonth(e.target.value)}
                />
              )}
            </FormField>
            <div className="mb-4">
              <AsyncButton onClick={handleResolve} pendingLabel="Resolving…">
                Resolve billing
              </AsyncButton>
            </div>
          </div>

          {resolved && (
            <div className="mt-4">
              <p className="text-sm text-green-900 mb-3" data-testid="resolve-summary">
                Resolver emitted {resolved.count} line{resolved.count === 1 ? '' : 's'} for{' '}
                {resolved.period}.
              </p>
              <DataTable<BillableLine>
                columns={[
                  {
                    key: 'payer',
                    header: 'Payer',
                    render: (l) => contactName(contactById.get(l.payer_contact_id)) || l.payer_contact_id,
                  },
                  {
                    key: 'horse',
                    header: 'Horse',
                    render: (l) => {
                      if (!l.horse_id) return 'Barn';
                      const h = horseById.get(l.horse_id);
                      return h ? horseLabel(h) : '—';
                    },
                  },
                  { key: 'qty', header: 'Qty', className: 'text-right', render: (l) => l.qty },
                  {
                    key: 'unit',
                    header: 'Unit',
                    className: 'text-right',
                    render: (l) => <Money amount={Number(l.unit_amount)} />,
                  },
                  {
                    key: 'amount',
                    header: 'Amount',
                    className: 'text-right',
                    render: (l) => <Money amount={Number(l.amount)} />,
                  },
                  {
                    key: 'status',
                    header: 'Status',
                    render: (l) => <StatusBadge status={l.status} />,
                  },
                ]}
                rows={resolved.lines}
                rowKey={(l) => l.id}
                emptyTitle="No billable lines produced"
                emptyMessage="No consumption events fell inside this period."
              />
            </div>
          )}
        </section>

        <Modal
          open={modal.mode !== 'closed'}
          onClose={closeModal}
          title={modal.mode === 'edit' ? 'Edit rule' : 'New rule'}
          disableBackdropClose={saving}
        >
          {modal.mode !== 'closed' && (
            <RuleForm
              rule={modal.mode === 'edit' ? modal.rule : null}
              contacts={contacts}
              horses={horses}
              submitting={saving}
              error={formError}
              onSubmit={handleRuleSubmit}
              onCancel={closeModal}
            />
          )}
        </Modal>
      </ModuleGate>
    </div>
  );
}
