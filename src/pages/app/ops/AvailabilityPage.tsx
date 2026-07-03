import { useEffect, useState } from 'react';
import { toErrorMessage } from '../../../lib/ops/errors';
import { DataTable, Modal, FormField, AsyncButton, StatusBadge, useAsync, useToast } from '../../../lib/ops';
import { useDocumentTitle } from '../../../lib/hooks';
import { weekRange } from '../../../lib/ops/api-employees';
import {
  listSlots, createSlot, createRecurringSlots, updateSlotStatus, deleteSlot,
  SLOT_TYPES, LOCATION_MODES,
  type AvailabilitySlot, type SlotType, type LocationMode,
} from '../../../lib/ops/api-slots';

/**
 * OPS-AVAILABILITY — availability-slots management (surface `ops`, core —
 * ungated). Replaces the manual-SQL step in SETUP.md §5.
 *
 * Monday-anchored week view driven by the shared weekRange() helper (the page
 * and its test compute identical query bounds). New-slot + recurring-slots
 * modals insert through the real api-slots wrappers; block/reopen only moves
 * open ⇄ blocked (held/booked belong to the hold/confirm RPCs) and delete is
 * refused server-side of the wrapper when a booking references the slot.
 */

const WEEKDAYS = [
  { value: 1, label: 'Mon' }, { value: 2, label: 'Tue' }, { value: 3, label: 'Wed' },
  { value: 4, label: 'Thu' }, { value: 5, label: 'Fri' }, { value: 6, label: 'Sat' },
  { value: 0, label: 'Sun' },
];

/** The booking currently holding the slot, if any (active statuses only). */
function activeBooking(slot: AvailabilitySlot) {
  return (slot.bookings ?? []).find((b) =>
    ['pending_slot', 'pending_payment', 'confirmed'].includes(b.status)) ?? null;
}

function bookedBy(slot: AvailabilitySlot): string {
  const b = activeBooking(slot);
  if (!b) return '—';
  return `Order ${b.order_id.slice(0, 8)} (${b.status})`;
}

export function AvailabilityPage() {
  useDocumentTitle('Availability — Ops');
  const toast = useToast();

  const [anchor, setAnchor] = useState(() => new Date());
  const week = weekRange(anchor);
  const slots = useAsync(() => listSlots(week.startISO, week.endISO));

  const [slotModal, setSlotModal] = useState(false);
  const [slotForm, setSlotForm] = useState({
    start_at: '', end_at: '', slot_type: 'consultation' as SlotType,
    location_mode: 'onsite' as LocationMode, capacity: '1',
  });
  const [slotError, setSlotError] = useState<string | null>(null);

  const [recurModal, setRecurModal] = useState(false);
  const [recurForm, setRecurForm] = useState({
    weekdays: [] as number[], startTime: '', endTime: '', fromDate: '', toDate: '',
    slot_type: 'consultation' as SlotType, location_mode: 'onsite' as LocationMode, capacity: '1',
  });
  const [recurError, setRecurError] = useState<string | null>(null);

  useEffect(() => {
    slots.run().catch(() => { /* inline */ });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [week.startISO]);

  async function submitSlot() {
    setSlotError(null);
    if (!slotForm.start_at || !slotForm.end_at) {
      setSlotError('Start and end times are required.');
      return;
    }
    try {
      await createSlot({
        start_at: new Date(slotForm.start_at).toISOString(),
        end_at: new Date(slotForm.end_at).toISOString(),
        slot_type: slotForm.slot_type,
        location_mode: slotForm.location_mode,
        capacity: Number(slotForm.capacity) || 1,
      });
      toast.success('Slot created');
      setSlotModal(false);
      setSlotForm({ start_at: '', end_at: '', slot_type: 'consultation', location_mode: 'onsite', capacity: '1' });
      await slots.run();
    } catch (err) {
      setSlotError(toErrorMessage(err, 'Could not create the slot.'));
      throw err;
    }
  }

  async function submitRecurring() {
    setRecurError(null);
    if (recurForm.weekdays.length === 0 || !recurForm.startTime || !recurForm.endTime
      || !recurForm.fromDate || !recurForm.toDate) {
      setRecurError('Pick at least one weekday, both times, and the date range.');
      return;
    }
    try {
      const created = await createRecurringSlots({
        weekdays: recurForm.weekdays,
        startTime: recurForm.startTime,
        endTime: recurForm.endTime,
        fromDate: recurForm.fromDate,
        toDate: recurForm.toDate,
        slot_type: recurForm.slot_type,
        location_mode: recurForm.location_mode,
        capacity: Number(recurForm.capacity) || 1,
      });
      toast.success(`${created.length} slot${created.length === 1 ? '' : 's'} created`);
      setRecurModal(false);
      setRecurForm({
        weekdays: [], startTime: '', endTime: '', fromDate: '', toDate: '',
        slot_type: 'consultation', location_mode: 'onsite', capacity: '1',
      });
      await slots.run();
    } catch (err) {
      setRecurError(toErrorMessage(err, 'Could not create the slots.'));
      throw err;
    }
  }

  async function toggleBlocked(slot: AvailabilitySlot) {
    if (slot.status !== 'open' && slot.status !== 'blocked') {
      toast.error('Slot is held or booked — release/cancel the booking first.');
      return;
    }
    try {
      await updateSlotStatus(slot.id, slot.status === 'open' ? 'blocked' : 'open');
      toast.success(slot.status === 'open' ? 'Slot blocked' : 'Slot reopened');
      await slots.run();
    } catch (err) {
      toast.error(toErrorMessage(err, 'Could not update the slot.'));
    }
  }

  async function removeSlot(slot: AvailabilitySlot) {
    try {
      await deleteSlot(slot.id);
      toast.success('Slot deleted');
      await slots.run();
    } catch (err) {
      toast.error(toErrorMessage(err, 'Could not delete the slot.'));
    }
  }

  const fmt = (iso: string) => new Date(iso).toLocaleString();
  const toggleWeekday = (value: number) =>
    setRecurForm((f) => ({
      ...f,
      weekdays: f.weekdays.includes(value)
        ? f.weekdays.filter((w) => w !== value)
        : [...f.weekdays, value],
    }));

  return (
    <div className="max-w-5xl mx-auto py-8 px-4">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-serif text-2xl text-green-900">Availability</h1>
          <p className="text-sm text-green-800/70">
            Week of {week.start.toLocaleDateString()} – {new Date(week.end.getTime() - 1).toLocaleDateString()}
          </p>
        </div>
        <div className="flex gap-2">
          <button type="button" className="btn-outline-gold" onClick={() => setAnchor(new Date(anchor.getTime() - 7 * 86400000))}>
            ← Prev week
          </button>
          <button type="button" className="btn-outline-gold" onClick={() => setAnchor(new Date())}>
            This week
          </button>
          <button type="button" className="btn-outline-gold" onClick={() => setAnchor(new Date(anchor.getTime() + 7 * 86400000))}>
            Next week →
          </button>
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

      {slots.isError && (
        <p role="alert" className="form-error mb-4">{slots.error?.message ?? 'Could not load slots.'}</p>
      )}

      <div className="mb-3 flex justify-end gap-2">
        <button type="button" className="btn-outline-gold" onClick={() => setRecurModal(true)}>Recurring slots</button>
        <button type="button" className="btn-primary" onClick={() => setSlotModal(true)}>New slot</button>
      </div>
      <DataTable<AvailabilitySlot>
        columns={[
          { key: 'start', header: 'Starts', render: (r) => fmt(r.start_at) },
          { key: 'end', header: 'Ends', render: (r) => fmt(r.end_at) },
          { key: 'type', header: 'Type', render: (r) => r.slot_type.replace('_', ' ') },
          { key: 'mode', header: 'Mode', render: (r) => r.location_mode },
          { key: 'status', header: 'Status', render: (r) => <StatusBadge status={r.status} /> },
          { key: 'booked_by', header: 'Booked by', render: (r) => bookedBy(r) },
        ]}
        rows={slots.data ?? []}
        rowKey={(r) => r.id}
        loading={slots.isPending}
        emptyTitle="No slots this week"
        emptyMessage="Create a slot (or a recurring set) so clients can book."
        rowActions={[
          { label: 'Block/Reopen', onClick: toggleBlocked },
          { label: 'Delete', onClick: removeSlot, className: 'text-red-700' },
        ]}
      />

      <Modal
        open={slotModal}
        onClose={() => setSlotModal(false)}
        title="New slot"
        footer={
          <AsyncButton className="btn-primary" onClick={submitSlot} pendingLabel="Creating…">
            Create slot
          </AsyncButton>
        }
      >
        {slotError && <p role="alert" className="form-error mb-3">{slotError}</p>}
        <FormField label="Starts" required>
          {({ id, errorClass }) => (
            <input id={id} type="datetime-local" className={`form-input ${errorClass}`} value={slotForm.start_at}
              onChange={(e) => setSlotForm((f) => ({ ...f, start_at: e.target.value }))} />
          )}
        </FormField>
        <FormField label="Ends" required>
          {({ id, errorClass }) => (
            <input id={id} type="datetime-local" className={`form-input ${errorClass}`} value={slotForm.end_at}
              onChange={(e) => setSlotForm((f) => ({ ...f, end_at: e.target.value }))} />
          )}
        </FormField>
        <FormField label="Type">
          {({ id, errorClass }) => (
            <select id={id} className={`form-input ${errorClass}`} value={slotForm.slot_type}
              onChange={(e) => setSlotForm((f) => ({ ...f, slot_type: e.target.value as SlotType }))}>
              {SLOT_TYPES.map((t) => <option key={t} value={t}>{t.replace('_', ' ')}</option>)}
            </select>
          )}
        </FormField>
        <FormField label="Location mode">
          {({ id, errorClass }) => (
            <select id={id} className={`form-input ${errorClass}`} value={slotForm.location_mode}
              onChange={(e) => setSlotForm((f) => ({ ...f, location_mode: e.target.value as LocationMode }))}>
              {LOCATION_MODES.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          )}
        </FormField>
        <FormField label="Capacity">
          {({ id, errorClass }) => (
            <input id={id} type="number" min="1" className={`form-input ${errorClass}`} value={slotForm.capacity}
              onChange={(e) => setSlotForm((f) => ({ ...f, capacity: e.target.value }))} />
          )}
        </FormField>
      </Modal>

      <Modal
        open={recurModal}
        onClose={() => setRecurModal(false)}
        title="Recurring slots"
        footer={
          <AsyncButton className="btn-primary" onClick={submitRecurring} pendingLabel="Creating…">
            Create slots
          </AsyncButton>
        }
      >
        {recurError && <p role="alert" className="form-error mb-3">{recurError}</p>}
        <fieldset className="mb-4">
          <legend className="form-label">Weekdays</legend>
          <div className="flex flex-wrap gap-3">
            {WEEKDAYS.map(({ value, label }) => (
              <label key={value} className="flex items-center gap-1.5 text-sm text-green-900">
                <input
                  type="checkbox"
                  checked={recurForm.weekdays.includes(value)}
                  onChange={() => toggleWeekday(value)}
                />
                {label}
              </label>
            ))}
          </div>
        </fieldset>
        <FormField label="Start time" required>
          {({ id, errorClass }) => (
            <input id={id} type="time" className={`form-input ${errorClass}`} value={recurForm.startTime}
              onChange={(e) => setRecurForm((f) => ({ ...f, startTime: e.target.value }))} />
          )}
        </FormField>
        <FormField label="End time" required>
          {({ id, errorClass }) => (
            <input id={id} type="time" className={`form-input ${errorClass}`} value={recurForm.endTime}
              onChange={(e) => setRecurForm((f) => ({ ...f, endTime: e.target.value }))} />
          )}
        </FormField>
        <FormField label="From date" required>
          {({ id, errorClass }) => (
            <input id={id} type="date" className={`form-input ${errorClass}`} value={recurForm.fromDate}
              onChange={(e) => setRecurForm((f) => ({ ...f, fromDate: e.target.value }))} />
          )}
        </FormField>
        <FormField label="To date" required>
          {({ id, errorClass }) => (
            <input id={id} type="date" className={`form-input ${errorClass}`} value={recurForm.toDate}
              onChange={(e) => setRecurForm((f) => ({ ...f, toDate: e.target.value }))} />
          )}
        </FormField>
        <FormField label="Type">
          {({ id, errorClass }) => (
            <select id={id} className={`form-input ${errorClass}`} value={recurForm.slot_type}
              onChange={(e) => setRecurForm((f) => ({ ...f, slot_type: e.target.value as SlotType }))}>
              {SLOT_TYPES.map((t) => <option key={t} value={t}>{t.replace('_', ' ')}</option>)}
            </select>
          )}
        </FormField>
        <FormField label="Location mode">
          {({ id, errorClass }) => (
            <select id={id} className={`form-input ${errorClass}`} value={recurForm.location_mode}
              onChange={(e) => setRecurForm((f) => ({ ...f, location_mode: e.target.value as LocationMode }))}>
              {LOCATION_MODES.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          )}
        </FormField>
        <FormField label="Capacity">
          {({ id, errorClass }) => (
            <input id={id} type="number" min="1" className={`form-input ${errorClass}`} value={recurForm.capacity}
              onChange={(e) => setRecurForm((f) => ({ ...f, capacity: e.target.value }))} />
          )}
        </FormField>
      </Modal>
    </div>
  );
}

export default AvailabilityPage;
