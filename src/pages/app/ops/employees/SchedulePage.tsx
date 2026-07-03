import { useEffect, useState } from 'react';
import { toErrorMessage } from '../../../../lib/ops/errors';
import { ModuleGate, DataTable, Modal, FormField, AsyncButton, useAsync, useToast } from '../../../../lib/ops';
import { useModules } from '../../../../lib/ops/useModules';
import {
  weekRange, listShifts, createShift, listStaffProfiles,
  listTimeEntriesForShift, createTimeEntry, staffDisplayName,
  type Shift, type TimeEntry,
} from '../../../../lib/ops/api-employees';

/**
 * OPS-EMP-SCHED — weekly shift schedule + per-shift time entries
 * (module mod.employees).
 *
 * Monday-anchored week view driven by the shared weekRange() helper (the page
 * and its test compute identical query bounds). Prev/next week re-queries the
 * real listShifts(start, end). Row click opens the shift's time entries with an
 * add-entry form. All writes go through the real api-employees wrappers.
 */
export function SchedulePage() {
  const modules = useModules();
  const on = modules['mod.employees'] === true;
  const toast = useToast();

  const [anchor, setAnchor] = useState(() => new Date());
  const week = weekRange(anchor);

  const shifts = useAsync(() => listShifts(week.startISO, week.endISO));
  const staff = useAsync(listStaffProfiles);

  const [shiftModal, setShiftModal] = useState(false);
  const [shiftForm, setShiftForm] = useState({ staff_profile_id: '', starts_at: '', ends_at: '', role: '' });
  const [shiftError, setShiftError] = useState<string | null>(null);

  const [entriesFor, setEntriesFor] = useState<Shift | null>(null);
  const [entries, setEntries] = useState<TimeEntry[] | null>(null);
  const [entryForm, setEntryForm] = useState({ clock_in: '', clock_out: '' });
  const [entryError, setEntryError] = useState<string | null>(null);

  useEffect(() => {
    if (!on) return;
    shifts.run().catch(() => { /* inline */ });
    staff.run().catch(() => { /* inline */ });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [on, week.startISO]);

  async function openEntries(shift: Shift) {
    setEntriesFor(shift);
    setEntries(null);
    setEntryError(null);
    try {
      setEntries(await listTimeEntriesForShift(shift.id));
    } catch (err) {
      setEntryError(toErrorMessage(err, 'Could not load time entries.'));
    }
  }

  async function submitShift() {
    setShiftError(null);
    if (!shiftForm.staff_profile_id || !shiftForm.starts_at) {
      setShiftError('Staff member and start time are required.');
      return;
    }
    try {
      await createShift({
        staff_profile_id: shiftForm.staff_profile_id,
        starts_at: new Date(shiftForm.starts_at).toISOString(),
        ends_at: shiftForm.ends_at ? new Date(shiftForm.ends_at).toISOString() : null,
        role: shiftForm.role || null,
      });
      toast.success('Shift created');
      setShiftModal(false);
      setShiftForm({ staff_profile_id: '', starts_at: '', ends_at: '', role: '' });
      await shifts.run();
    } catch (err) {
      setShiftError(toErrorMessage(err, 'Could not create the shift.'));
      throw err;
    }
  }

  async function submitEntry() {
    if (!entriesFor) return;
    setEntryError(null);
    if (!entryForm.clock_in) {
      setEntryError('Clock-in time is required.');
      return;
    }
    try {
      await createTimeEntry({
        staff_profile_id: entriesFor.staff_profile_id,
        shift_id: entriesFor.id,
        clock_in: new Date(entryForm.clock_in).toISOString(),
        clock_out: entryForm.clock_out ? new Date(entryForm.clock_out).toISOString() : null,
      });
      toast.success('Time entry recorded');
      setEntryForm({ clock_in: '', clock_out: '' });
      setEntries(await listTimeEntriesForShift(entriesFor.id));
    } catch (err) {
      setEntryError(toErrorMessage(err, 'Could not record the entry.'));
      throw err;
    }
  }

  const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleString() : '—');

  return (
    <div className="max-w-5xl mx-auto py-8 px-4">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-serif text-2xl text-green-900">Schedule</h1>
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

      <ModuleGate moduleKey="mod.employees" modules={modules}>
        {shifts.isError && (
          <p role="alert" className="form-error mb-4">{shifts.error?.message ?? 'Could not load shifts.'}</p>
        )}

        <div className="mb-3 flex justify-end">
          <button type="button" className="btn-primary" onClick={() => setShiftModal(true)}>New shift</button>
        </div>
        <DataTable<Shift>
          columns={[
            { key: 'staff', header: 'Staff', render: (r) => staffDisplayName(r.staff?.profile ?? null, r.staff?.title ?? '—') },
            { key: 'starts', header: 'Starts', render: (r) => fmt(r.starts_at) },
            { key: 'ends', header: 'Ends', render: (r) => fmt(r.ends_at) },
            { key: 'role', header: 'Role', render: (r) => r.role ?? '—' },
          ]}
          rows={shifts.data ?? []}
          rowKey={(r) => r.id}
          loading={shifts.isPending}
          emptyTitle="No shifts this week"
          emptyMessage="Create a shift to build the week's schedule."
          onRowClick={openEntries}
        />

        <Modal
          open={shiftModal}
          onClose={() => setShiftModal(false)}
          title="New shift"
          footer={
            <AsyncButton className="btn-primary" onClick={submitShift} pendingLabel="Creating…">
              Create shift
            </AsyncButton>
          }
        >
          {shiftError && <p role="alert" className="form-error mb-3">{shiftError}</p>}
          <FormField label="Staff member" required>
            {({ id, errorClass }) => (
              <select
                id={id}
                className={`form-input ${errorClass}`}
                value={shiftForm.staff_profile_id}
                onChange={(e) => setShiftForm((f) => ({ ...f, staff_profile_id: e.target.value }))}
              >
                <option value="">Select…</option>
                {(staff.data ?? []).map((s) => (
                  <option key={s.id} value={s.id}>{staffDisplayName(s.profile)}</option>
                ))}
              </select>
            )}
          </FormField>
          <FormField label="Starts" required>
            {({ id, errorClass }) => (
              <input id={id} type="datetime-local" className={`form-input ${errorClass}`} value={shiftForm.starts_at}
                onChange={(e) => setShiftForm((f) => ({ ...f, starts_at: e.target.value }))} />
            )}
          </FormField>
          <FormField label="Ends">
            {({ id, errorClass }) => (
              <input id={id} type="datetime-local" className={`form-input ${errorClass}`} value={shiftForm.ends_at}
                onChange={(e) => setShiftForm((f) => ({ ...f, ends_at: e.target.value }))} />
            )}
          </FormField>
          <FormField label="Role" hint="e.g. Barn duty, Lessons, Show prep">
            {({ id, errorClass }) => (
              <input id={id} className={`form-input ${errorClass}`} value={shiftForm.role}
                onChange={(e) => setShiftForm((f) => ({ ...f, role: e.target.value }))} />
            )}
          </FormField>
        </Modal>

        <Modal
          open={entriesFor !== null}
          onClose={() => setEntriesFor(null)}
          title={entriesFor ? `Time entries — ${staffDisplayName(entriesFor.staff?.profile ?? null, 'shift')}` : ''}
          footer={
            <AsyncButton className="btn-primary" onClick={submitEntry} pendingLabel="Recording…">
              Record entry
            </AsyncButton>
          }
        >
          {entryError && <p role="alert" className="form-error mb-3">{entryError}</p>}
          <ul className="mb-4 space-y-1 text-sm text-green-900" data-testid="time-entries">
            {(entries ?? []).map((e) => (
              <li key={e.id}>
                {fmt(e.clock_in)} → {fmt(e.clock_out)}{e.minutes != null ? ` (${e.minutes} min)` : ''}
              </li>
            ))}
            {entries !== null && entries.length === 0 && <li className="text-green-800/60">No entries yet.</li>}
          </ul>
          <FormField label="Clock in" required>
            {({ id, errorClass }) => (
              <input id={id} type="datetime-local" className={`form-input ${errorClass}`} value={entryForm.clock_in}
                onChange={(e) => setEntryForm((f) => ({ ...f, clock_in: e.target.value }))} />
            )}
          </FormField>
          <FormField label="Clock out">
            {({ id, errorClass }) => (
              <input id={id} type="datetime-local" className={`form-input ${errorClass}`} value={entryForm.clock_out}
                onChange={(e) => setEntryForm((f) => ({ ...f, clock_out: e.target.value }))} />
            )}
          </FormField>
        </Modal>
      </ModuleGate>
    </div>
  );
}

export default SchedulePage;
