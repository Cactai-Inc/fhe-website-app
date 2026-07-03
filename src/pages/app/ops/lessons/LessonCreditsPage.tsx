import { useCallback, useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { DataTable, FormField, Modal, ModuleGate, useAsync, useToast } from '../../../../lib/ops';
import type { Column, RowAction } from '../../../../lib/ops';
import { useModules } from '../../../../lib/ops/useModules';
import {
  listLessonCredits,
  createLessonCredit,
  consumeLessonCredit,
  listLessonClients,
  listLessonPackages,
  type LessonCredit,
  type LessonClientOption,
  type LessonPackage,
} from '../../../../lib/ops/api-lessons';

/**
 * OPS-LESSON-CREDITS — per-client credits ledger (module mod.lessons).
 *
 * Gated by ModuleGate('mod.lessons'); a lessons-OFF tenant sees the lock and no
 * fetch fires. Inside the gate: listLessonCredits() drives the ledger (client
 * name resolved via listLessonClients), a client filter re-queries WITH the
 * exact client_id, and the outstanding balance sums credits_remaining over the
 * visible rows. 'Grant credits' opens a Modal: pick a client + a package (the
 * pack's credit count pre-fills, editable) → createLessonCredit with the exact
 * insert shape ({ client_id, package_key, credits_total }). Each row's
 * 'Use 1 credit' action calls consumeLessonCredit(id) — the schema has no
 * bookings⇄credits linkage or consume RPC, so this guarded decrement IS the
 * real consumption path. Rejected grant keeps the modal open with the message;
 * a failed consume toasts the error.
 */
type DrawerState = { mode: 'closed' } | { mode: 'grant' };

function GrantForm({
  clients,
  packages,
  onSubmit,
  onCancel,
  submitting,
  error,
}: {
  clients: LessonClientOption[];
  packages: LessonPackage[];
  onSubmit: (input: { client_id: string; package_key: string | null; credits_total: number }) => Promise<void>;
  onCancel: () => void;
  submitting?: boolean;
  error?: string | null;
}) {
  const [clientId, setClientId] = useState('');
  const [packageKey, setPackageKey] = useState('');
  const [credits, setCredits] = useState('');
  const [fieldError, setFieldError] = useState<string | null>(null);

  const pickPackage = (key: string) => {
    setPackageKey(key);
    const pkg = packages.find((p) => p.package_key === key);
    if (pkg) setCredits(String(pkg.credits));
  };

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!clientId) {
      setFieldError('Pick a client.');
      return;
    }
    const creditsNum = Number(credits);
    if (!Number.isInteger(creditsNum) || creditsNum <= 0) {
      setFieldError('Credits must be a positive whole number.');
      return;
    }
    setFieldError(null);
    await onSubmit({
      client_id: clientId,
      package_key: packageKey || null,
      credits_total: creditsNum,
    });
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <FormField label="Client" required>
        {({ id, describedBy, errorClass }) => (
          <select
            id={id}
            name="client_id"
            className={`form-input ${errorClass}`}
            aria-describedby={describedBy}
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            disabled={submitting}
          >
            <option value="">Select a client…</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        )}
      </FormField>

      <FormField label="Package" hint="Pre-fills the pack's credit count; leave blank for an ad-hoc grant.">
        {({ id, describedBy, errorClass }) => (
          <select
            id={id}
            name="package_key"
            className={`form-input ${errorClass}`}
            aria-describedby={describedBy}
            value={packageKey}
            onChange={(e) => pickPackage(e.target.value)}
            disabled={submitting}
          >
            <option value="">No package (ad-hoc)</option>
            {packages
              .filter((p) => p.active)
              .map((p) => (
                <option key={p.id} value={p.package_key}>
                  {p.name} ({p.credits} credits)
                </option>
              ))}
          </select>
        )}
      </FormField>

      <FormField label="Credits" required>
        {({ id, describedBy, errorClass }) => (
          <input
            id={id}
            name="credits_total"
            type="number"
            min={1}
            step={1}
            className={`form-input ${errorClass}`}
            aria-describedby={describedBy}
            value={credits}
            onChange={(e) => setCredits(e.target.value)}
            disabled={submitting}
          />
        )}
      </FormField>

      {(fieldError || error) && (
        <p role="alert" className="form-error mb-4">
          {fieldError ?? error}
        </p>
      )}

      <div className="flex justify-end gap-3">
        <button type="button" className="btn-secondary" onClick={onCancel} disabled={submitting}>
          Cancel
        </button>
        <button type="submit" className="btn-primary" disabled={submitting} aria-busy={submitting}>
          {submitting ? 'Granting…' : 'Grant credits'}
        </button>
      </div>
    </form>
  );
}

export function LessonCreditsPage() {
  const modules = useModules();
  const lessonsOn = modules['mod.lessons'] === true;

  const [rows, setRows] = useState<LessonCredit[]>([]);
  const [clients, setClients] = useState<LessonClientOption[]>([]);
  const [packages, setPackages] = useState<LessonPackage[]>([]);
  const [clientFilter, setClientFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [drawer, setDrawer] = useState<DrawerState>({ mode: 'closed' });
  const [formError, setFormError] = useState<string | null>(null);

  const toast = useToast();

  // Initial load: ledger + the client/package lookups the form and names need.
  const loadAll = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [credits, clientRows, packageRows] = await Promise.all([
        listLessonCredits(),
        listLessonClients(),
        listLessonPackages(),
      ]);
      setRows(credits);
      setClients(clientRows);
      setPackages(packageRows);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Could not load lesson credits.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!lessonsOn) return;
    void loadAll();
  }, [lessonsOn, loadAll]);

  // The client filter re-queries the ledger WITH the exact client_id (server-side scope).
  const applyFilter = async (clientId: string) => {
    setClientFilter(clientId);
    setLoading(true);
    setLoadError(null);
    try {
      setRows(await listLessonCredits(clientId || undefined));
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Could not load lesson credits.');
    } finally {
      setLoading(false);
    }
  };

  const clientName = useCallback(
    (clientId: string) => clients.find((c) => c.id === clientId)?.name ?? clientId.slice(0, 8),
    [clients],
  );

  const outstanding = useMemo(
    () => rows.reduce((sum, r) => sum + (Number(r.credits_remaining) || 0), 0),
    [rows],
  );

  const grant = useAsync(createLessonCredit);

  const handleGrant = async (input: {
    client_id: string;
    package_key: string | null;
    credits_total: number;
  }) => {
    setFormError(null);
    try {
      const created = await grant.run(input);
      // The new grant shows unless a different client filter hides it.
      if (!clientFilter || clientFilter === created.client_id) {
        setRows((prev) => [created, ...prev]);
      }
      toast.success('Credits granted.');
      setDrawer({ mode: 'closed' });
    } catch (err) {
      // Error branch: keep the modal open, surface the message.
      setFormError(err instanceof Error ? err.message : 'Could not grant credits.');
    }
  };

  const handleConsume = async (row: LessonCredit) => {
    try {
      const updated = await consumeLessonCredit(row.id);
      setRows((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
      toast.success(`1 credit used — ${updated.credits_remaining} remaining.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not use a credit.');
    }
  };

  const columns: Column<LessonCredit>[] = [
    { key: 'client', header: 'Client', render: (r) => clientName(r.client_id) },
    {
      key: 'package',
      header: 'Package',
      render: (r) => r.package_key ?? '—',
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
  ];

  const rowActions: RowAction<LessonCredit>[] = [
    { label: 'Use 1 credit', onClick: (row) => void handleConsume(row) },
  ];

  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-serif text-2xl text-green-900">Lesson credits</h1>
          <p className="text-sm text-green-800/70">Per-client credit ledger and balances.</p>
        </div>
        {lessonsOn && (
          <button
            type="button"
            className="btn-primary"
            onClick={() => {
              setFormError(null);
              setDrawer({ mode: 'grant' });
            }}
          >
            Grant credits
          </button>
        )}
      </div>

      <ModuleGate moduleKey="mod.lessons" modules={modules}>
        <div className="mb-4 flex items-end justify-between gap-4">
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
          <p className="text-sm text-green-900" data-testid="credits-outstanding">
            Credits outstanding: <span className="font-serif text-xl">{outstanding}</span>
          </p>
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
          rows={rows}
          rowKey={(r) => r.id}
          loading={loading && rows.length === 0}
          rowActions={rowActions}
          emptyTitle="No lesson credits yet"
          emptyMessage="Grant credits from a package purchase to start a client's ledger."
        />

        <Modal
          open={drawer.mode !== 'closed'}
          onClose={() => setDrawer({ mode: 'closed' })}
          title="Grant credits"
          disableBackdropClose={grant.isPending}
        >
          {drawer.mode !== 'closed' && (
            <GrantForm
              clients={clients}
              packages={packages}
              onSubmit={handleGrant}
              onCancel={() => setDrawer({ mode: 'closed' })}
              submitting={grant.isPending}
              error={formError}
            />
          )}
        </Modal>
      </ModuleGate>
    </div>
  );
}

export default LessonCreditsPage;
