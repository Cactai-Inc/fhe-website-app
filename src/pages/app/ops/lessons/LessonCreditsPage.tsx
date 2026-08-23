import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { toErrorMessage } from '../../../../lib/ops/errors';
import { DataTable, ModuleGate } from '../../../../lib/ops';
import type { Column } from '../../../../lib/ops';
import { useModules } from '../../../../lib/ops/useModules';
import {
  listLessonCredits,
  listLessonClients,
  type LessonCredit,
  type LessonClientOption,
} from '../../../../lib/ops/api-lessons';

/**
 * OPS-LESSON-CREDITS — the read-only credits ledger (module mod.lessons).
 *
 * TASK-AUTHORITY (2026-08-22): this page used to write lesson_credits directly
 * (a raw-insert grant modal, a read-modify-write consume row action) — a
 * second write path beside the credit engine, with no offering, no purchase,
 * no period, no expiry, no audit trail (D18/D19). Both are deleted.
 * The ledger only reads now: listLessonCredits() drives the table (client name
 * resolved via listLessonClients), a client filter re-queries WITH the exact
 * client_id, and the outstanding balance sums credits_remaining over the
 * visible rows. Credits are minted by purchases and consumed by completing a
 * session on the Sessions page — the banner below says so and links there.
 */

export function LessonCreditsPage() {
  const modules = useModules();
  const lessonsOn = modules['mod.lessons'] === true;

  const [rows, setRows] = useState<LessonCredit[]>([]);
  const [clients, setClients] = useState<LessonClientOption[]>([]);
  const [clientFilter, setClientFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Initial load: ledger + the client lookup the names need.
  const loadAll = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [credits, clientRows] = await Promise.all([
        listLessonCredits(),
        listLessonClients(),
      ]);
      setRows(credits);
      setClients(clientRows);
    } catch (err) {
      setLoadError(toErrorMessage(err, 'Could not load lesson credits.'));
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
      setLoadError(toErrorMessage(err, 'Could not load lesson credits.'));
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

  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      <div className="mb-6">
        <h1 className="font-serif text-2xl text-green-900">Lesson credits</h1>
        <p className="text-sm text-green-800/70">Per-client credit ledger and balances.</p>
      </div>

      <ModuleGate moduleKey="mod.lessons" modules={modules}>
        <p className="mb-4 rounded bg-green-50 px-4 py-3 text-sm text-green-900">
          This ledger is read-only. Credits are minted automatically by purchases and
          consumed by completing a session on{' '}
          <Link to="/app/ops/lessons/sessions" className="link-underline font-medium">
            Sessions
          </Link>
          .
        </p>

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
          emptyTitle="No lesson credits yet"
          emptyMessage="Credits appear here once a purchase mints them."
        />
      </ModuleGate>
    </div>
  );
}

export default LessonCreditsPage;
