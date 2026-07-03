import { useEffect, useState } from 'react';
import { ModuleGate, DataTable, Modal, FormField, AsyncButton, StatusBadge, useAsync, useToast } from '../../../../lib/ops';
import { useModules } from '../../../../lib/ops/useModules';
import { contactName } from '../../../../lib/ops/types';
import {
  listStaffProfiles, createStaffProfile, updateStaffProfile,
  listProfileOptions, listContactOptions,
  listServiceAssignments, createServiceAssignment, updateServiceAssignmentStatus,
  listEngagementOptions, listServiceTypes, staffDisplayName,
  type StaffProfile, type StaffProfileInput, type ServiceAssignment, type ServiceAssignmentStatus,
} from '../../../../lib/ops/api-employees';

/**
 * OPS-EMP-STAFF — staff profiles + service assignments (module mod.employees).
 *
 * Gated by ModuleGate('mod.employees'); with the module off nothing fetches.
 * Staff table: create (link to an auth profile, optional CRM contact, title,
 * pay type) and edit via row click. Assignments table: create against a staff
 * profile (optional engagement + service type) and transition SCHEDULED →
 * COMPLETED / CANCELLED. All writes go through the real api-employees wrappers.
 */

const EMPTY_FORM: StaffProfileInput = { profile_user_id: '', contact_id: null, title: '', pay_type: '' };

export function StaffPage() {
  const modules = useModules();
  const on = modules['mod.employees'] === true;
  const toast = useToast();

  const staff = useAsync(listStaffProfiles);
  const assignments = useAsync(listServiceAssignments);
  const profileOpts = useAsync(listProfileOptions);
  const contactOpts = useAsync(listContactOptions);
  const engagementOpts = useAsync(listEngagementOptions);
  const serviceTypes = useAsync(listServiceTypes);

  const [modal, setModal] = useState<null | { mode: 'create' } | { mode: 'edit'; row: StaffProfile }>(null);
  const [form, setForm] = useState<StaffProfileInput>(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const [assignModal, setAssignModal] = useState(false);
  const [assignForm, setAssignForm] = useState({ staff_profile_id: '', engagement_id: '', service_type: '', scheduled_at: '' });
  const [assignError, setAssignError] = useState<string | null>(null);

  useEffect(() => {
    if (!on) return;
    for (const l of [staff, assignments, profileOpts, contactOpts, engagementOpts, serviceTypes]) {
      l.run().catch(() => { /* inline error branches */ });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [on]);

  function openCreate() {
    setForm(EMPTY_FORM);
    setFormError(null);
    setModal({ mode: 'create' });
  }
  function openEdit(row: StaffProfile) {
    setForm({
      profile_user_id: row.profile_user_id,
      contact_id: row.contact_id,
      title: row.title ?? '',
      pay_type: row.pay_type ?? '',
      active: row.active,
    });
    setFormError(null);
    setModal({ mode: 'edit', row });
  }

  async function submitStaff() {
    setFormError(null);
    if (!form.profile_user_id) {
      setFormError('Choose the team member’s account.');
      return;
    }
    try {
      if (modal?.mode === 'edit') {
        await updateStaffProfile(modal.row.id, form);
        toast.success('Staff profile updated');
      } else {
        await createStaffProfile(form);
        toast.success('Staff profile created');
      }
      setModal(null);
      await staff.run();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not save the staff profile.');
      throw err;
    }
  }

  async function submitAssignment() {
    setAssignError(null);
    if (!assignForm.staff_profile_id) {
      setAssignError('Choose a staff member.');
      return;
    }
    try {
      await createServiceAssignment({
        staff_profile_id: assignForm.staff_profile_id,
        engagement_id: assignForm.engagement_id || null,
        service_type: assignForm.service_type || null,
        scheduled_at: assignForm.scheduled_at || null,
      });
      toast.success('Assignment created');
      setAssignModal(false);
      setAssignForm({ staff_profile_id: '', engagement_id: '', service_type: '', scheduled_at: '' });
      await assignments.run();
    } catch (err) {
      setAssignError(err instanceof Error ? err.message : 'Could not create the assignment.');
      throw err;
    }
  }

  async function transition(row: ServiceAssignment, status: ServiceAssignmentStatus) {
    await updateServiceAssignmentStatus(row.id, status);
    toast.success(`Assignment ${status.toLowerCase()}`);
    await assignments.run();
  }

  return (
    <div className="max-w-5xl mx-auto py-8 px-4">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-serif text-2xl text-green-900">Staff</h1>
          <p className="text-sm text-green-800/70">Team profiles and service assignments.</p>
        </div>
      </div>

      <ModuleGate moduleKey="mod.employees" modules={modules}>
        {staff.isError && (
          <p role="alert" className="form-error mb-4">{staff.error?.message ?? 'Could not load staff.'}</p>
        )}

        <div className="mb-3 flex justify-end">
          <button type="button" className="btn-primary" onClick={openCreate}>Add staff member</button>
        </div>
        <DataTable<StaffProfile>
          columns={[
            { key: 'name', header: 'Name', render: (r) => staffDisplayName(r.profile, contactName(r.contact) || 'Unknown staff') },
            { key: 'title', header: 'Title', render: (r) => r.title ?? '—' },
            { key: 'pay', header: 'Pay type', render: (r) => r.pay_type ?? '—' },
            { key: 'active', header: 'Status', render: (r) => <StatusBadge status={r.active ? 'ACTIVE' : 'INACTIVE'} /> },
          ]}
          rows={staff.data ?? []}
          rowKey={(r) => r.id}
          loading={staff.isPending}
          emptyTitle="No staff yet"
          emptyMessage="Add your first team member to schedule shifts and assignments."
          onRowClick={openEdit}
        />

        <div className="mt-10 mb-3 flex items-center justify-between">
          <h2 className="font-serif text-xl text-green-900">Service assignments</h2>
          <button type="button" className="btn-outline-gold" onClick={() => setAssignModal(true)}>New assignment</button>
        </div>
        {assignments.isError && (
          <p role="alert" className="form-error mb-4">{assignments.error?.message ?? 'Could not load assignments.'}</p>
        )}
        <DataTable<ServiceAssignment>
          columns={[
            { key: 'staff', header: 'Staff', render: (r) => staffDisplayName(r.staff?.profile ?? null, r.staff?.title ?? '—') },
            { key: 'engagement', header: 'Engagement', render: (r) => r.engagement?.display_code ?? '—' },
            { key: 'service', header: 'Service', render: (r) => r.service?.display_name ?? r.service_type ?? '—' },
            { key: 'when', header: 'Scheduled', render: (r) => (r.scheduled_at ? new Date(r.scheduled_at).toLocaleString() : '—') },
            { key: 'status', header: 'Status', render: (r) => <StatusBadge status={r.status} /> },
            {
              key: 'actions',
              header: '',
              render: (r) =>
                r.status === 'SCHEDULED' ? (
                  <span className="flex gap-2">
                    <AsyncButton className="btn-outline-gold text-xs" onClick={() => transition(r, 'COMPLETED')} pendingLabel="…">
                      Complete
                    </AsyncButton>
                    <AsyncButton className="btn-outline-gold text-xs" onClick={() => transition(r, 'CANCELLED')} pendingLabel="…">
                      Cancel
                    </AsyncButton>
                  </span>
                ) : null,
            },
          ]}
          rows={assignments.data ?? []}
          rowKey={(r) => r.id}
          loading={assignments.isPending}
          emptyTitle="No assignments"
        />

        <Modal
          open={modal !== null}
          onClose={() => setModal(null)}
          title={modal?.mode === 'edit' ? 'Edit staff profile' : 'Add staff member'}
          footer={
            <AsyncButton className="btn-primary" onClick={submitStaff} pendingLabel="Saving…">
              {modal?.mode === 'edit' ? 'Save changes' : 'Create staff profile'}
            </AsyncButton>
          }
        >
          {formError && <p role="alert" className="form-error mb-3">{formError}</p>}
          <FormField label="Team member account" required>
            {({ id, errorClass }) => (
              <select
                id={id}
                className={`form-input ${errorClass}`}
                value={form.profile_user_id}
                disabled={modal?.mode === 'edit'}
                onChange={(e) => setForm((f) => ({ ...f, profile_user_id: e.target.value }))}
              >
                <option value="">Select an account…</option>
                {(profileOpts.data ?? []).map((p) => (
                  <option key={p.user_id} value={p.user_id}>
                    {[p.first_name, p.last_name].filter(Boolean).join(' ') || p.email}
                  </option>
                ))}
              </select>
            )}
          </FormField>
          <FormField label="CRM contact (optional)">
            {({ id, errorClass }) => (
              <select
                id={id}
                className={`form-input ${errorClass}`}
                value={form.contact_id ?? ''}
                onChange={(e) => setForm((f) => ({ ...f, contact_id: e.target.value || null }))}
              >
                <option value="">None</option>
                {(contactOpts.data ?? []).map((c) => (
                  <option key={c.id} value={c.id}>{contactName(c)}</option>
                ))}
              </select>
            )}
          </FormField>
          <FormField label="Title">
            {({ id, errorClass }) => (
              <input
                id={id}
                className={`form-input ${errorClass}`}
                value={form.title ?? ''}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              />
            )}
          </FormField>
          <FormField label="Pay type" hint="e.g. HOURLY, SALARY, PER_SERVICE">
            {({ id, errorClass }) => (
              <input
                id={id}
                className={`form-input ${errorClass}`}
                value={form.pay_type ?? ''}
                onChange={(e) => setForm((f) => ({ ...f, pay_type: e.target.value }))}
              />
            )}
          </FormField>
          {modal?.mode === 'edit' && (
            <FormField label="Active">
              {({ id }) => (
                <input
                  id={id}
                  type="checkbox"
                  checked={form.active !== false}
                  onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))}
                />
              )}
            </FormField>
          )}
        </Modal>

        <Modal
          open={assignModal}
          onClose={() => setAssignModal(false)}
          title="New service assignment"
          footer={
            <AsyncButton className="btn-primary" onClick={submitAssignment} pendingLabel="Creating…">
              Create assignment
            </AsyncButton>
          }
        >
          {assignError && <p role="alert" className="form-error mb-3">{assignError}</p>}
          <FormField label="Staff member" required>
            {({ id, errorClass }) => (
              <select
                id={id}
                className={`form-input ${errorClass}`}
                value={assignForm.staff_profile_id}
                onChange={(e) => setAssignForm((f) => ({ ...f, staff_profile_id: e.target.value }))}
              >
                <option value="">Select…</option>
                {(staff.data ?? []).map((s) => (
                  <option key={s.id} value={s.id}>{staffDisplayName(s.profile, contactName(s.contact) || 'Unknown staff')}</option>
                ))}
              </select>
            )}
          </FormField>
          <FormField label="Engagement (optional)">
            {({ id, errorClass }) => (
              <select
                id={id}
                className={`form-input ${errorClass}`}
                value={assignForm.engagement_id}
                onChange={(e) => setAssignForm((f) => ({ ...f, engagement_id: e.target.value }))}
              >
                <option value="">None</option>
                {(engagementOpts.data ?? []).map((eng) => (
                  <option key={eng.id} value={eng.id}>{eng.display_code} — {eng.service_type}</option>
                ))}
              </select>
            )}
          </FormField>
          <FormField label="Service type (optional)">
            {({ id, errorClass }) => (
              <select
                id={id}
                className={`form-input ${errorClass}`}
                value={assignForm.service_type}
                onChange={(e) => setAssignForm((f) => ({ ...f, service_type: e.target.value }))}
              >
                <option value="">None</option>
                {(serviceTypes.data ?? []).map((s) => (
                  <option key={s.code} value={s.code}>{s.display_name}</option>
                ))}
              </select>
            )}
          </FormField>
          <FormField label="Scheduled for (optional)">
            {({ id, errorClass }) => (
              <input
                id={id}
                type="datetime-local"
                className={`form-input ${errorClass}`}
                value={assignForm.scheduled_at}
                onChange={(e) => setAssignForm((f) => ({ ...f, scheduled_at: e.target.value }))}
              />
            )}
          </FormField>
        </Modal>
      </ModuleGate>
    </div>
  );
}

export default StaffPage;
