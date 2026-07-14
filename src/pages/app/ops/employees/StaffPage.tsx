import { useEffect, useState } from 'react';
import { toErrorMessage } from '../../../../lib/ops/errors';
import { ModuleGate, DataTable, Modal, FormField, AsyncButton, StatusBadge, useAsync, useToast } from '../../../../lib/ops';
import { useModules } from '../../../../lib/ops/useModules';
import { contactName } from '../../../../lib/ops/types';
import {
  listStaffProfiles, createStaffProfile, updateStaffProfile,
  listProfileOptions, listContactOptions, staffDisplayName,
  type StaffProfile, type StaffProfileInput,
} from '../../../../lib/ops/api-employees';

/**
 * OPS-EMP-STAFF — staff profiles (module mod.employees).
 *
 * Gated by ModuleGate('mod.employees'); with the module off nothing fetches.
 * Staff table: create (link to an auth profile, optional CRM contact, title,
 * pay type) and edit via row click. All writes go through the real
 * api-employees wrappers. (Service assignments retired with the engagements
 * teardown — staffing is scheduled via shifts.)
 */

const EMPTY_FORM: StaffProfileInput = { profile_user_id: '', contact_id: null, title: '', pay_type: '' };

export function StaffPage() {
  const modules = useModules();
  const on = modules['mod.employees'] === true;
  const toast = useToast();

  const staff = useAsync(listStaffProfiles);
  const profileOpts = useAsync(listProfileOptions);
  const contactOpts = useAsync(listContactOptions);

  const [modal, setModal] = useState<null | { mode: 'create' } | { mode: 'edit'; row: StaffProfile }>(null);
  const [form, setForm] = useState<StaffProfileInput>(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (!on) return;
    for (const l of [staff, profileOpts, contactOpts]) {
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
      setFormError(toErrorMessage(err, 'Could not save the staff profile.'));
      throw err;
    }
  }

  return (
    <div className="max-w-5xl mx-auto py-8 px-4">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-serif text-2xl text-green-900">Staff</h1>
          <p className="text-sm text-green-800/70">Team profiles.</p>
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
          emptyMessage="Add your first team member to schedule shifts."
          onRowClick={openEdit}
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
      </ModuleGate>
    </div>
  );
}

export default StaffPage;
