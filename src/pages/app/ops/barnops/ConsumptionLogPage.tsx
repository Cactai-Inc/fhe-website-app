import { useCallback, useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { Helmet } from 'react-helmet-async';
import { DataTable, FormField, ModuleGate, useToast } from '../../../../lib/ops';
import { useModules } from '../../../../lib/ops/useModules';
import {
  listConsumptionEvents,
  createConsumptionEvent,
  listResources,
  listResourceLots,
  listHorseOptions,
  type ConsumptionEvent,
  type Resource,
  type ResourceLot,
  type HorseOption,
} from '../../../../lib/ops/api-barnops';

/**
 * BARNOPS-CONSUMPTION — append-only consumption event capture + recent log
 * (mod.barnops).
 *
 * The consumption ledger is the DUMB, cheap fact (§7.7): it records WHAT was
 * used (resource, optional lot, optional horse, qty) and NEVER computes money —
 * pricing/attribution happens later in resolve_consumption_billing. The table
 * is APPEND-ONLY at the database level (UPDATE/DELETE are REVOKEd), so this UI
 * deliberately offers NO edit or delete affordance on logged events;
 * corrections are new offsetting events. Capture form → createConsumptionEvent
 * with the exact payload; success prepends to the log; a rejection renders
 * inline and keeps the entry.
 */

function horseLabel(h: HorseOption): string {
  return h.barn_name ?? h.registered_name ?? h.display_code ?? h.id.slice(0, 8);
}

export default function ConsumptionLogPage() {
  const modules = useModules();
  const barnopsOn = modules['mod.barnops'] === true;
  const toast = useToast();

  const [events, setEvents] = useState<ConsumptionEvent[]>([]);
  const [resources, setResources] = useState<Resource[]>([]);
  const [lots, setLots] = useState<ResourceLot[]>([]);
  const [horses, setHorses] = useState<HorseOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Capture form state.
  const [resourceId, setResourceId] = useState('');
  const [lotId, setLotId] = useState('');
  const [horseId, setHorseId] = useState('');
  const [qty, setQty] = useState('1');
  const [occurredAt, setOccurredAt] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [ev, res, lo, ho] = await Promise.all([
        listConsumptionEvents(),
        listResources(),
        listResourceLots(),
        listHorseOptions(),
      ]);
      setEvents(ev);
      setResources(res);
      setLots(lo);
      setHorses(ho);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Could not load the consumption log.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!barnopsOn) return;
    void load();
  }, [barnopsOn, load]);

  const resourceById = useMemo(() => new Map(resources.map((r) => [r.id, r])), [resources]);
  const horseById = useMemo(() => new Map(horses.map((h) => [h.id, h])), [horses]);
  const lotById = useMemo(() => new Map(lots.map((l) => [l.id, l])), [lots]);
  const lotsForResource = useMemo(
    () => lots.filter((l) => l.resource_id === resourceId),
    [lots, resourceId],
  );

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);
    const qtyNum = Number(qty);
    if (!resourceId) {
      setFormError('Pick a resource.');
      return;
    }
    if (!Number.isFinite(qtyNum) || qtyNum <= 0) {
      setFormError('Quantity must be a positive number.');
      return;
    }
    setSubmitting(true);
    try {
      const created = await createConsumptionEvent({
        resource_id: resourceId,
        resource_lot_id: lotId || null,
        horse_id: horseId || null,
        qty: qtyNum,
        ...(occurredAt ? { occurred_at: new Date(occurredAt).toISOString() } : {}),
        notes: notes.trim() ? notes.trim() : null,
      });
      setEvents((prev) => [created, ...prev]);
      toast.success('Consumption logged.');
      // Reset the capture form for the next entry.
      setLotId('');
      setHorseId('');
      setQty('1');
      setOccurredAt('');
      setNotes('');
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not log consumption.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto py-8 px-4">
      <Helmet>
        <title>Consumption log · Barn Ops</title>
      </Helmet>

      <ModuleGate moduleKey="mod.barnops" modules={modules}>
        <div className="mb-6">
          <h1 className="font-serif text-2xl text-green-900">Consumption log</h1>
          <p className="text-sm text-green-800/70">
            Append-only ledger — logged events cannot be edited or deleted; corrections are new
            offsetting events. Pricing happens later, at billing resolution.
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

        <section
          aria-labelledby="capture-heading"
          className="mb-10 rounded border border-green-800/15 bg-green-800/5 p-5"
        >
          <h2 id="capture-heading" className="font-serif text-lg text-green-900 mb-4">
            Log consumption
          </h2>
          <form onSubmit={handleSubmit} noValidate>
            <div className="grid gap-x-6 sm:grid-cols-2">
              <FormField label="Resource" required>
                {({ id, errorClass }) => (
                  <select
                    id={id}
                    className={`form-input ${errorClass}`}
                    required
                    value={resourceId}
                    onChange={(e) => {
                      setResourceId(e.target.value);
                      setLotId('');
                    }}
                  >
                    <option value="">— Pick a resource —</option>
                    {resources.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                  </select>
                )}
              </FormField>
              <FormField
                label="Lot"
                hint="Optional — the drawn lot prices the event at resolution."
              >
                {({ id, errorClass }) => (
                  <select
                    id={id}
                    className={`form-input ${errorClass}`}
                    value={lotId}
                    onChange={(e) => setLotId(e.target.value)}
                    disabled={!resourceId}
                  >
                    <option value="">— No specific lot —</option>
                    {lotsForResource.map((l) => (
                      <option key={l.id} value={l.id}>
                        {new Date(l.purchased_at).toLocaleDateString()} · ${Number(l.unit_cost)}/
                        {resourceById.get(l.resource_id)?.unit_of_measure ?? 'unit'} · {l.on_hand}{' '}
                        on hand
                      </option>
                    ))}
                  </select>
                )}
              </FormField>
              <FormField label="Horse" hint="Optional — attribution falls to the barn when blank.">
                {({ id, errorClass }) => (
                  <select
                    id={id}
                    className={`form-input ${errorClass}`}
                    value={horseId}
                    onChange={(e) => setHorseId(e.target.value)}
                  >
                    <option value="">— Barn / no horse —</option>
                    {horses.map((h) => (
                      <option key={h.id} value={h.id}>
                        {horseLabel(h)}
                      </option>
                    ))}
                  </select>
                )}
              </FormField>
              <FormField label="Quantity" required>
                {({ id, errorClass }) => (
                  <input
                    id={id}
                    type="number"
                    min="0"
                    step="any"
                    className={`form-input ${errorClass}`}
                    required
                    value={qty}
                    onChange={(e) => setQty(e.target.value)}
                  />
                )}
              </FormField>
              <FormField label="Occurred at" hint="Leave blank to record “now”.">
                {({ id, errorClass }) => (
                  <input
                    id={id}
                    type="datetime-local"
                    className={`form-input ${errorClass}`}
                    value={occurredAt}
                    onChange={(e) => setOccurredAt(e.target.value)}
                  />
                )}
              </FormField>
              <FormField label="Notes">
                {({ id, errorClass }) => (
                  <input
                    id={id}
                    type="text"
                    className={`form-input ${errorClass}`}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                  />
                )}
              </FormField>
            </div>

            {formError && (
              <p role="alert" className="form-error mb-3">
                {formError}
              </p>
            )}

            <button type="submit" className="btn-primary" disabled={submitting}>
              {submitting ? 'Logging…' : 'Log event'}
            </button>
          </form>
        </section>

        <section aria-labelledby="log-heading">
          <h2 id="log-heading" className="font-serif text-lg text-green-900 mb-3">
            Recent events
          </h2>
          {loadError ? (
            <p role="alert" className="form-error">
              {loadError}
            </p>
          ) : (
            <DataTable<ConsumptionEvent>
              columns={[
                {
                  key: 'occurred_at',
                  header: 'When',
                  render: (ev) => new Date(ev.occurred_at).toLocaleString(),
                },
                {
                  key: 'resource',
                  header: 'Resource',
                  render: (ev) => resourceById.get(ev.resource_id)?.name ?? ev.resource_id,
                },
                {
                  key: 'lot',
                  header: 'Lot',
                  render: (ev) => {
                    if (!ev.resource_lot_id) return '—';
                    const lot = lotById.get(ev.resource_lot_id);
                    return lot ? new Date(lot.purchased_at).toLocaleDateString() : '—';
                  },
                },
                {
                  key: 'horse',
                  header: 'Horse',
                  render: (ev) => {
                    if (!ev.horse_id) return 'Barn';
                    const h = horseById.get(ev.horse_id);
                    return h ? horseLabel(h) : '—';
                  },
                },
                { key: 'qty', header: 'Qty', className: 'text-right', render: (ev) => ev.qty },
                { key: 'notes', header: 'Notes', render: (ev) => ev.notes ?? '—' },
              ]}
              rows={events}
              rowKey={(ev) => ev.id}
              loading={loading}
              emptyTitle="No consumption logged yet"
              emptyMessage="Log the first event with the form above."
            />
          )}
        </section>
      </ModuleGate>
    </div>
  );
}
