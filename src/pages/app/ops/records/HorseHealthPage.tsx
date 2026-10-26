import { useCallback, useEffect, useState } from 'react';
import { toErrorMessage } from '../../../../lib/ops/errors';
import { Link, useParams } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import {
  DataTable,
  EmptyState,
  FormField,
  Modal,
  ModuleGate,
  useAsync,
  useToast,
  type Column,
} from '../../../../lib/ops';
import { useModules } from '../../../../lib/ops/useModules';
import {
  getRecordHorse,
  listHealthEvents,
  createHealthEvent,
  listHorseDesignatedProviders,
  listRecordContacts,
  type DesignatedProvider,
  type HealthEventInput,
  type HorseHealthEvent,
  type HorseRecord,
} from '../../../../lib/ops/api-records';
import { contactName } from '../../../../lib/ops/types';
import type { Contact } from '../../../../lib/ops/types';

/**
 * OPS-REC-HEALTH — per-horse health log + care team (module mod.horserecords).
 *
 * Staff opens /app/ops/records/horses/:horseId/health → the whole page is
 * wrapped in ModuleGate('mod.horserecords'). Two sections:
 *   - Care team: the horse's vet_name/vet_phone/farrier_name/farrier_phone
 *     (migration 20260701000000) render as a details grid; 'Edit care team'
 *     opens a Modal whose submit calls updateHorseCareTeam(horseId, exact
 *     4-column patch) and re-renders the returned row.
 *   - Health log: horse_health_events (listHealthEvents) in a DataTable
 *     (type, date, provider, next due, notes); 'Log event' opens a Modal
 *     HealthEventForm whose submit calls createHealthEvent with the exact
 *     payload, then refreshes the log. A rejected save renders the message
 *     inline and KEEPS the modal open.
 */

/** Common event types for the log (event_type is free text in the DB —
 *  this select covers the §7.8 catalog; 'other' keeps it open). */
const HEALTH_EVENT_TYPES = [
  'vet_visit',
  'farrier',
  'vaccination',
  'deworming',
  'coggins',
  'other',
] as const;


type EventDraft = {
  event_type: string;
  occurred_at: string;
  provider_contact_id: string;
  next_due: string;
  notes: string;
};

function HealthEventForm({
  horseId,
  providers,
  onSubmit,
  onCancel,
  submitting,
  error,
}: {
  horseId: string;
  providers: DesignatedProvider[];
  onSubmit: (input: HealthEventInput) => Promise<void>;
  onCancel: () => void;
  submitting: boolean;
  error: string | null;
}) {
  const [draft, setDraft] = useState<EventDraft>({
    event_type: 'vet_visit',
    occurred_at: new Date().toISOString().slice(0, 10),
    provider_contact_id: '',
    next_due: '',
    notes: '',
  });

  const set = <K extends keyof EventDraft>(key: K, value: EventDraft[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSubmit({
      horse_id: horseId,
      event_type: draft.event_type,
      occurred_at: new Date(`${draft.occurred_at}T00:00:00Z`).toISOString(),
      provider_contact_id: draft.provider_contact_id || null,
      next_due: draft.next_due || null,
      notes: draft.notes.trim() || null,
    });
  };

  return (
    <form onSubmit={handleSubmit} noValidate>
      <FormField label="Event type" required>
        {({ id }) => (
          <select
            id={id}
            className="form-input"
            value={draft.event_type}
            onChange={(e) => set('event_type', e.target.value)}
          >
            {HEALTH_EVENT_TYPES.map((t) => (
              <option key={t} value={t}>
                {t.replace('_', ' ')}
              </option>
            ))}
          </select>
        )}
      </FormField>

      <FormField label="Date" required>
        {({ id }) => (
          <input
            id={id}
            type="date"
            className="form-input"
            value={draft.occurred_at}
            onChange={(e) => set('occurred_at', e.target.value)}
          />
        )}
      </FormField>

      {/* item 6b — designated providers only (this horse's vet / farrier /
          care-giver / trainer on the record), not every contact in the tenant. */}
      <FormField label="Provider" hint="This horse's designated providers.">
        {({ id, describedBy }) => (
          <select
            id={id}
            aria-describedby={describedBy}
            className="form-input"
            value={draft.provider_contact_id}
            onChange={(e) => set('provider_contact_id', e.target.value)}
          >
            <option value="">No provider</option>
            {providers.map((p) => (
              <option key={p.contact_id} value={p.contact_id}>
                {p.label}
              </option>
            ))}
            {providers.length === 0 && (
              <option value="" disabled>No designated providers on the record yet</option>
            )}
          </select>
        )}
      </FormField>

      <FormField label="Next due">
        {({ id }) => (
          <input
            id={id}
            type="date"
            className="form-input"
            value={draft.next_due}
            onChange={(e) => set('next_due', e.target.value)}
          />
        )}
      </FormField>

      <FormField label="Notes">
        {({ id }) => (
          <textarea
            id={id}
            className="form-input"
            rows={2}
            value={draft.notes}
            onChange={(e) => set('notes', e.target.value)}
          />
        )}
      </FormField>

      {error && (
        <p role="alert" className="form-error mb-3">
          {error}
        </p>
      )}

      <div className="flex justify-end gap-3">
        <button type="button" className="btn-secondary" onClick={onCancel} disabled={submitting}>
          Cancel
        </button>
        <button type="submit" className="btn-primary" disabled={submitting}>
          Save event
        </button>
      </div>
    </form>
  );
}

type ModalState = { mode: 'closed' } | { mode: 'event' };

export function HorseHealthPage() {
  const { horseId = '' } = useParams<{ horseId: string }>();
  const modules = useModules();
  const toast = useToast();

  const [horse, setHorse] = useState<HorseRecord | null>(null);
  const [events, setEvents] = useState<HorseHealthEvent[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [providers, setProviders] = useState<DesignatedProvider[]>([]);
  const [modal, setModal] = useState<ModalState>({ mode: 'closed' });
  const [formError, setFormError] = useState<string | null>(null);

  const recordsOn = modules['mod.horserecords'] === true;

  const load = useAsync(
    useCallback(async () => {
      const [h, ev, c, pr] = await Promise.all([
        getRecordHorse(horseId),
        listHealthEvents(horseId),
        listRecordContacts(),
        listHorseDesignatedProviders(horseId),
      ]);
      return { h, ev, c, pr };
    }, [horseId]),
  );

  useEffect(() => {
    if (!recordsOn) return;
    load
      .run()
      .then(({ h, ev, c, pr }) => {
        setHorse(h);
        setEvents(ev);
        setContacts(c);
        setProviders(pr);
      })
      .catch(() => {
        /* surfaced via load.isError */
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recordsOn, horseId]);

  const saveEvent = useAsync(createHealthEvent);

  const handleEventSubmit = async (input: HealthEventInput) => {
    setFormError(null);
    try {
      await saveEvent.run(input);
      setEvents(await listHealthEvents(horseId));
      toast.success('Health event logged.');
      setModal({ mode: 'closed' });
    } catch (err) {
      setFormError(toErrorMessage(err, 'Could not log the event.'));
    }
  };

  const providerName = useCallback(
    (id: string | null) =>
      id === null ? '—' : contactName(contacts.find((c) => c.id === id)) || id.slice(0, 8),
    [contacts],
  );

  const columns: Column<HorseHealthEvent>[] = [
    { key: 'type', header: 'Type', render: (ev) => ev.event_type.replace('_', ' ') },
    { key: 'date', header: 'Date', render: (ev) => ev.occurred_at.slice(0, 10) },
    { key: 'provider', header: 'Provider', render: (ev) => providerName(ev.provider_contact_id) },
    { key: 'next', header: 'Next due', render: (ev) => ev.next_due ?? '—' },
    { key: 'notes', header: 'Notes', render: (ev) => ev.notes ?? '—' },
  ];

  const horseLabel = horse?.nickname ?? horse?.registered_name ?? 'Horse';

  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      <Helmet>
        <title>Health · Records</title>
      </Helmet>

      <Link to="/app/ops/records" className="link-underline text-sm">
        ← Records
      </Link>

      <ModuleGate moduleKey="mod.horserecords" modules={modules}>
        <div className="mt-4 flex items-center justify-between mb-6">
          <div>
            <h1 className="font-serif text-2xl text-green-900">{horseLabel} — health</h1>
            <p className="text-sm text-green-800/70">Health event log. Care providers are on the horse&apos;s record.</p>
          </div>
          <button
            type="button"
            className="btn-primary"
            onClick={() => {
              setFormError(null);
              setModal({ mode: 'event' });
            }}
          >
            Log event
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

        {load.isError && (
          <p role="alert" className="form-error mb-4">
            {load.error?.message ?? 'Could not load the health record.'}
          </p>
        )}

        {/* ⚠️ FIX ROUND item 6b — the flat Care team block is GONE. Vet/farrier are
            no longer scalar columns on the horse; care providers live in Current
            providers on the horse record (horse_relationships). This points there
            rather than re-rendering a removed source. */}
        {horse ? (
          <section className="mb-8">
            <div className="rounded border border-green-800/15 bg-white px-5 py-4 text-sm flex items-center justify-between gap-3">
              <p className="text-green-900">
                Care providers (vet, farrier, and others) live on the horse&apos;s record under
                <span className="font-medium"> Current providers</span>.
              </p>
              <Link to={`/app/horses/${horseId}`} className="link-underline text-sm shrink-0">
                Open record
              </Link>
            </div>
          </section>
        ) : (
          !load.isPending && !load.isError && (
            <EmptyState
              title="Horse not found"
              message="This horse may have been removed or is outside your organization."
            />
          )
        )}

        {/* Health log — horse_health_events. */}
        <section aria-labelledby="log-heading">
          <h2 id="log-heading" className="font-serif text-lg text-green-900 mb-3">
            Health log
          </h2>
          <DataTable
            columns={columns}
            rows={events}
            rowKey={(ev) => ev.id}
            loading={load.isPending && events.length === 0}
            emptyTitle="No health events yet"
            emptyMessage="Log vet visits, farrier work, vaccinations, deworming and Coggins here."
          />
        </section>

        <Modal
          open={modal.mode !== 'closed'}
          onClose={() => setModal({ mode: 'closed' })}
          title="Log health event"
        >
          {modal.mode === 'event' && (
            <HealthEventForm
              horseId={horseId}
              providers={providers}
              onSubmit={handleEventSubmit}
              onCancel={() => setModal({ mode: 'closed' })}
              submitting={saveEvent.isPending}
              error={formError}
            />
          )}
        </Modal>
      </ModuleGate>
    </div>
  );
}

export default HorseHealthPage;
