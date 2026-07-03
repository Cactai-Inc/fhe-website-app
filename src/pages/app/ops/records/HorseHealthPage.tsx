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
  updateHorseCareTeam,
  listRecordContacts,
  type CareTeamInput,
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

type CareDraft = { vet_name: string; vet_phone: string; farrier_name: string; farrier_phone: string };

function CareTeamForm({
  horse,
  onSubmit,
  onCancel,
  submitting,
  error,
}: {
  horse: HorseRecord;
  onSubmit: (patch: CareTeamInput) => Promise<void>;
  onCancel: () => void;
  submitting: boolean;
  error: string | null;
}) {
  const [draft, setDraft] = useState<CareDraft>({
    vet_name: horse.vet_name ?? '',
    vet_phone: horse.vet_phone ?? '',
    farrier_name: horse.farrier_name ?? '',
    farrier_phone: horse.farrier_phone ?? '',
  });

  const set = (key: keyof CareDraft, value: string) => setDraft((d) => ({ ...d, [key]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSubmit({
      vet_name: draft.vet_name.trim() || null,
      vet_phone: draft.vet_phone.trim() || null,
      farrier_name: draft.farrier_name.trim() || null,
      farrier_phone: draft.farrier_phone.trim() || null,
    });
  };

  return (
    <form onSubmit={handleSubmit} noValidate>
      <FormField label="Vet name">
        {({ id }) => (
          <input
            id={id}
            type="text"
            className="form-input"
            value={draft.vet_name}
            onChange={(e) => set('vet_name', e.target.value)}
          />
        )}
      </FormField>
      <FormField label="Vet phone">
        {({ id }) => (
          <input
            id={id}
            type="tel"
            className="form-input"
            value={draft.vet_phone}
            onChange={(e) => set('vet_phone', e.target.value)}
          />
        )}
      </FormField>
      <FormField label="Farrier name">
        {({ id }) => (
          <input
            id={id}
            type="text"
            className="form-input"
            value={draft.farrier_name}
            onChange={(e) => set('farrier_name', e.target.value)}
          />
        )}
      </FormField>
      <FormField label="Farrier phone">
        {({ id }) => (
          <input
            id={id}
            type="tel"
            className="form-input"
            value={draft.farrier_phone}
            onChange={(e) => set('farrier_phone', e.target.value)}
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
          Save care team
        </button>
      </div>
    </form>
  );
}

type EventDraft = {
  event_type: string;
  occurred_at: string;
  provider_contact_id: string;
  next_due: string;
  notes: string;
};

function HealthEventForm({
  horseId,
  contacts,
  onSubmit,
  onCancel,
  submitting,
  error,
}: {
  horseId: string;
  contacts: Contact[];
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

      <FormField label="Provider" hint="Vet/farrier contact, if on file.">
        {({ id, describedBy }) => (
          <select
            id={id}
            aria-describedby={describedBy}
            className="form-input"
            value={draft.provider_contact_id}
            onChange={(e) => set('provider_contact_id', e.target.value)}
          >
            <option value="">No provider contact</option>
            {contacts.map((c) => (
              <option key={c.id} value={c.id}>
                {contactName(c)}
              </option>
            ))}
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

type ModalState = { mode: 'closed' } | { mode: 'care' } | { mode: 'event' };

export function HorseHealthPage() {
  const { horseId = '' } = useParams<{ horseId: string }>();
  const modules = useModules();
  const toast = useToast();

  const [horse, setHorse] = useState<HorseRecord | null>(null);
  const [events, setEvents] = useState<HorseHealthEvent[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [modal, setModal] = useState<ModalState>({ mode: 'closed' });
  const [formError, setFormError] = useState<string | null>(null);

  const recordsOn = modules['mod.horserecords'] === true;

  const load = useAsync(
    useCallback(async () => {
      const [h, ev, c] = await Promise.all([
        getRecordHorse(horseId),
        listHealthEvents(horseId),
        listRecordContacts(),
      ]);
      return { h, ev, c };
    }, [horseId]),
  );

  useEffect(() => {
    if (!recordsOn) return;
    load
      .run()
      .then(({ h, ev, c }) => {
        setHorse(h);
        setEvents(ev);
        setContacts(c);
      })
      .catch(() => {
        /* surfaced via load.isError */
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recordsOn, horseId]);

  const saveCare = useAsync(updateHorseCareTeam);
  const saveEvent = useAsync(createHealthEvent);

  const handleCareSubmit = async (patch: CareTeamInput) => {
    setFormError(null);
    try {
      const updated = await saveCare.run(horseId, patch);
      setHorse(updated);
      toast.success('Care team updated.');
      setModal({ mode: 'closed' });
    } catch (err) {
      setFormError(toErrorMessage(err, 'Could not save the care team.'));
    }
  };

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

  const horseLabel = horse?.barn_name ?? horse?.registered_name ?? 'Horse';

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
            <p className="text-sm text-green-800/70">Care team and health event log.</p>
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

        {/* Care team — the horses vet/farrier columns (migration 20260701000000). */}
        <section aria-labelledby="care-heading" className="mb-8">
          <div className="flex items-center justify-between mb-3">
            <h2 id="care-heading" className="font-serif text-lg text-green-900">
              Care team
            </h2>
            {horse && (
              <button
                type="button"
                className="link-underline text-sm"
                onClick={() => {
                  setFormError(null);
                  setModal({ mode: 'care' });
                }}
              >
                Edit care team
              </button>
            )}
          </div>
          {horse ? (
            <dl className="grid grid-cols-2 gap-x-6 gap-y-3 rounded border border-green-800/15 bg-white px-5 py-4 text-sm">
              <dt className="form-label mb-0">Vet</dt>
              <dd className="text-green-900" data-testid="care-vet">
                {horse.vet_name ?? '—'}
                {horse.vet_phone ? ` · ${horse.vet_phone}` : ''}
              </dd>
              <dt className="form-label mb-0">Farrier</dt>
              <dd className="text-green-900" data-testid="care-farrier">
                {horse.farrier_name ?? '—'}
                {horse.farrier_phone ? ` · ${horse.farrier_phone}` : ''}
              </dd>
            </dl>
          ) : (
            !load.isPending &&
            !load.isError && (
              <EmptyState
                title="Horse not found"
                message="This horse may have been removed or is outside your organization."
              />
            )
          )}
        </section>

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
          title={modal.mode === 'care' ? 'Edit care team' : 'Log health event'}
          disableBackdropClose={saveCare.isPending || saveEvent.isPending}
        >
          {modal.mode === 'care' && horse && (
            <CareTeamForm
              horse={horse}
              onSubmit={handleCareSubmit}
              onCancel={() => setModal({ mode: 'closed' })}
              submitting={saveCare.isPending}
              error={formError}
            />
          )}
          {modal.mode === 'event' && (
            <HealthEventForm
              horseId={horseId}
              contacts={contacts}
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
