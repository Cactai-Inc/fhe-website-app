import { useCallback, useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import {
  DataTable,
  FormField,
  Modal,
  ModuleGate,
  StatusBadge,
  useAsync,
  useToast,
} from '../../../../lib/ops';
import type { Column } from '../../../../lib/ops';
import { useModules } from '../../../../lib/ops/useModules';
import { useDocumentTitle } from '../../../../lib/hooks';
import {
  listFacilities,
  createFacility,
  updateFacility,
  listStalls,
  createStall,
  updateStall,
  type Facility,
  type FacilityInput,
  type Stall,
  type StallInput,
} from '../../../../lib/ops/api-boarding';

/**
 * OPS-BOARD-FACILITIES — facilities + stalls CRUD (module mod.boarding).
 *
 * The whole page sits behind ModuleGate('mod.boarding') (Layer C, §4.3); RLS
 * `_module_gate` is the authoritative fence underneath. Staff sees the facility
 * list and the stall grid; 'New facility'/'New stall' open Modal forms wired to
 * createFacility/createStall, a row click opens the same form in edit mode
 * (updateFacility/updateStall). Success → toast + list updated in place; a
 * rejected save renders the error inline and KEEPS THE MODAL OPEN.
 */

type ModalState =
  | { mode: 'closed' }
  | { mode: 'facility-create' }
  | { mode: 'facility-edit'; facility: Facility }
  | { mode: 'stall-create' }
  | { mode: 'stall-edit'; stall: Stall };

interface FacilityFormProps {
  facility?: Facility;
  onSubmit: (input: FacilityInput) => Promise<void>;
  onCancel: () => void;
  submitting?: boolean;
  error?: string | null;
}

function FacilityForm({ facility, onSubmit, onCancel, submitting, error }: FacilityFormProps) {
  const [name, setName] = useState(facility?.name ?? '');
  const [addressKey, setAddressKey] = useState(facility?.address_value_key ?? '');
  const [nameError, setNameError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setNameError('Name is required.');
      return;
    }
    setNameError(null);
    await onSubmit({ name: trimmed, address_value_key: addressKey.trim() || null });
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <FormField label="Name" required error={nameError}>
        {({ id, describedBy, errorClass }) => (
          <input
            id={id}
            className={`form-input ${errorClass}`}
            aria-describedby={describedBy}
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={submitting}
          />
        )}
      </FormField>

      <FormField
        label="Address registry key"
        hint="Registry key (CONTACT/ADDRESS.*) resolving the facility address."
      >
        {({ id, describedBy, errorClass }) => (
          <input
            id={id}
            className={`form-input ${errorClass}`}
            aria-describedby={describedBy}
            value={addressKey}
            onChange={(e) => setAddressKey(e.target.value)}
            disabled={submitting}
          />
        )}
      </FormField>

      {error && (
        <p role="alert" className="form-error mb-4">
          {error}
        </p>
      )}

      <div className="flex justify-end gap-3">
        <button type="button" className="btn-secondary" onClick={onCancel} disabled={submitting}>
          Cancel
        </button>
        <button type="submit" className="btn-primary" disabled={submitting} aria-busy={submitting}>
          {submitting ? 'Saving…' : facility ? 'Save facility' : 'Create facility'}
        </button>
      </div>
    </form>
  );
}

interface StallFormProps {
  stall?: Stall;
  facilities: Facility[];
  onSubmit: (input: StallInput) => Promise<void>;
  onCancel: () => void;
  submitting?: boolean;
  error?: string | null;
}

function StallForm({ stall, facilities, onSubmit, onCancel, submitting, error }: StallFormProps) {
  const [facilityId, setFacilityId] = useState(stall?.facility_id ?? '');
  const [code, setCode] = useState(stall?.code ?? '');
  const [stallType, setStallType] = useState(stall?.stall_type ?? '');
  const [active, setActive] = useState(stall?.active ?? true);
  const [formError, setFormError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!facilityId || !code.trim()) {
      setFormError('Facility and code are required.');
      return;
    }
    setFormError(null);
    await onSubmit({
      facility_id: facilityId,
      code: code.trim(),
      stall_type: stallType.trim() || null,
      active,
    });
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <FormField label="Facility" required>
        {({ id, describedBy, errorClass }) => (
          <select
            id={id}
            className={`form-input ${errorClass}`}
            aria-describedby={describedBy}
            value={facilityId}
            onChange={(e) => setFacilityId(e.target.value)}
            disabled={submitting}
          >
            <option value="">Select a facility…</option>
            {facilities.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
        )}
      </FormField>

      <FormField label="Code" required>
        {({ id, describedBy, errorClass }) => (
          <input
            id={id}
            className={`form-input ${errorClass}`}
            aria-describedby={describedBy}
            value={code}
            onChange={(e) => setCode(e.target.value)}
            disabled={submitting}
          />
        )}
      </FormField>

      <FormField label="Stall type" hint="e.g. 12x12, foaling, paddock.">
        {({ id, describedBy, errorClass }) => (
          <input
            id={id}
            className={`form-input ${errorClass}`}
            aria-describedby={describedBy}
            value={stallType}
            onChange={(e) => setStallType(e.target.value)}
            disabled={submitting}
          />
        )}
      </FormField>

      <FormField label="Active">
        {({ id }) => (
          <input
            id={id}
            type="checkbox"
            checked={active}
            onChange={(e) => setActive(e.target.checked)}
            disabled={submitting}
          />
        )}
      </FormField>

      {(formError || error) && (
        <p role="alert" className="form-error mb-4">
          {formError ?? error}
        </p>
      )}

      <div className="flex justify-end gap-3">
        <button type="button" className="btn-secondary" onClick={onCancel} disabled={submitting}>
          Cancel
        </button>
        <button type="submit" className="btn-primary" disabled={submitting} aria-busy={submitting}>
          {submitting ? 'Saving…' : stall ? 'Save stall' : 'Create stall'}
        </button>
      </div>
    </form>
  );
}

export function FacilitiesPage() {
  useDocumentTitle('Facilities · Boarding');
  const modules = useModules();
  const boardingOn = modules['mod.boarding'] === true;

  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [stalls, setStalls] = useState<Stall[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [modal, setModal] = useState<ModalState>({ mode: 'closed' });
  const [formError, setFormError] = useState<string | null>(null);
  const toast = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [f, s] = await Promise.all([listFacilities(), listStalls()]);
      setFacilities(f);
      setStalls(s);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Could not load facilities.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!boardingOn) return;
    void load();
  }, [boardingOn, load]);

  const saveFacility = useAsync(async (input: FacilityInput, editing: Facility | null) =>
    editing ? updateFacility(editing.id, input) : createFacility(input),
  );
  const saveStall = useAsync(async (input: StallInput, editing: Stall | null) =>
    editing ? updateStall(editing.id, input) : createStall(input),
  );

  const closeModal = () => {
    setFormError(null);
    setModal({ mode: 'closed' });
  };

  const handleFacilitySubmit = async (input: FacilityInput) => {
    const editing = modal.mode === 'facility-edit' ? modal.facility : null;
    setFormError(null);
    try {
      const saved = await saveFacility.run(input, editing);
      setFacilities((prev) =>
        editing ? prev.map((f) => (f.id === saved.id ? saved : f)) : [saved, ...prev],
      );
      toast.success(editing ? 'Facility updated.' : 'Facility created.');
      setModal({ mode: 'closed' });
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not save facility.');
    }
  };

  const handleStallSubmit = async (input: StallInput) => {
    const editing = modal.mode === 'stall-edit' ? modal.stall : null;
    setFormError(null);
    try {
      const saved = await saveStall.run(input, editing);
      setStalls((prev) =>
        editing ? prev.map((s) => (s.id === saved.id ? saved : s)) : [...prev, saved],
      );
      toast.success(editing ? 'Stall updated.' : 'Stall created.');
      setModal({ mode: 'closed' });
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not save stall.');
    }
  };

  const facilityColumns: Column<Facility>[] = [
    { key: 'name', header: 'Name', render: (f) => f.name },
    {
      key: 'address',
      header: 'Address key',
      render: (f) => f.address_value_key ?? '—',
    },
    {
      key: 'stalls',
      header: 'Stalls',
      render: (f) => stalls.filter((s) => s.facility_id === f.id).length,
    },
  ];

  const stallColumns: Column<Stall>[] = [
    { key: 'code', header: 'Code', render: (s) => s.code },
    {
      key: 'facility',
      header: 'Facility',
      render: (s) => s.facility?.name ?? facilities.find((f) => f.id === s.facility_id)?.name ?? '—',
    },
    { key: 'type', header: 'Type', render: (s) => s.stall_type ?? '—' },
    {
      key: 'active',
      header: 'Status',
      render: (s) => <StatusBadge status={s.active ? 'ACTIVE' : 'INACTIVE'} />,
    },
  ];

  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      <ModuleGate moduleKey="mod.boarding" modules={modules}>
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

        <section aria-labelledby="facilities-heading" className="mb-10">
          <div className="flex items-center justify-between mb-4">
            <h1 id="facilities-heading" className="font-serif text-2xl text-green-900">
              Facilities
            </h1>
            <button
              type="button"
              className="btn-primary"
              onClick={() => {
                setFormError(null);
                setModal({ mode: 'facility-create' });
              }}
            >
              New facility
            </button>
          </div>
          <DataTable
            columns={facilityColumns}
            rows={facilities}
            rowKey={(f) => f.id}
            loading={loading}
            emptyTitle="No facilities yet"
            emptyMessage="Create your first facility to start assigning stalls."
            onRowClick={(facility) => {
              setFormError(null);
              setModal({ mode: 'facility-edit', facility });
            }}
          />
        </section>

        <section aria-labelledby="stalls-heading">
          <div className="flex items-center justify-between mb-4">
            <h2 id="stalls-heading" className="font-serif text-xl text-green-900">
              Stalls
            </h2>
            <button
              type="button"
              className="btn-primary"
              onClick={() => {
                setFormError(null);
                setModal({ mode: 'stall-create' });
              }}
              disabled={facilities.length === 0}
            >
              New stall
            </button>
          </div>
          <DataTable
            columns={stallColumns}
            rows={stalls}
            rowKey={(s) => s.id}
            loading={loading}
            emptyTitle="No stalls yet"
            emptyMessage="Add stalls under a facility to track occupancy."
            onRowClick={(stall) => {
              setFormError(null);
              setModal({ mode: 'stall-edit', stall });
            }}
          />
        </section>

        <Modal
          open={modal.mode === 'facility-create' || modal.mode === 'facility-edit'}
          onClose={closeModal}
          title={modal.mode === 'facility-edit' ? 'Edit facility' : 'New facility'}
          disableBackdropClose={saveFacility.isPending}
        >
          {(modal.mode === 'facility-create' || modal.mode === 'facility-edit') && (
            <FacilityForm
              facility={modal.mode === 'facility-edit' ? modal.facility : undefined}
              onSubmit={handleFacilitySubmit}
              onCancel={closeModal}
              submitting={saveFacility.isPending}
              error={formError}
            />
          )}
        </Modal>

        <Modal
          open={modal.mode === 'stall-create' || modal.mode === 'stall-edit'}
          onClose={closeModal}
          title={modal.mode === 'stall-edit' ? 'Edit stall' : 'New stall'}
          disableBackdropClose={saveStall.isPending}
        >
          {(modal.mode === 'stall-create' || modal.mode === 'stall-edit') && (
            <StallForm
              stall={modal.mode === 'stall-edit' ? modal.stall : undefined}
              facilities={facilities}
              onSubmit={handleStallSubmit}
              onCancel={closeModal}
              submitting={saveStall.isPending}
              error={formError}
            />
          )}
        </Modal>
      </ModuleGate>
    </div>
  );
}

export default FacilitiesPage;
