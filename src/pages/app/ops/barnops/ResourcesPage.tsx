import { useCallback, useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { Helmet } from 'react-helmet-async';
import { DataTable, FormField, Modal, ModuleGate, Money, useToast } from '../../../../lib/ops';
import { useModules } from '../../../../lib/ops/useModules';
import { contactName } from '../../../../lib/ops/types';
import {
  listResources,
  createResource,
  updateResource,
  listResourceLots,
  createResourceLot,
  listContactOptions,
  RESOURCE_CATEGORIES,
  type Resource,
  type ResourceInput,
  type ResourceLot,
  type ResourceCategory,
  type ContactOption,
} from '../../../../lib/ops/api-barnops';

/**
 * BARNOPS-RESOURCES — resource catalog + purchased lots (mod.barnops).
 *
 * Gated by ModuleGate('mod.barnops'). Lists the resource catalog with live
 * stock levels COMPUTED FROM LOTS (sum of on_hand across the resource's lots —
 * lots are the depletion unit, the resource row itself carries no quantity).
 * "New resource" / row-click-edit drive createResource/updateResource; the
 * "Add lot" row action records a purchased lot (vendor, qty, unit cost) via
 * createResourceLot. Recent lots render below. Errors stay inline in the
 * modal; success refreshes + toasts.
 */

type ModalState =
  | { mode: 'closed' }
  | { mode: 'create' }
  | { mode: 'edit'; resource: Resource }
  | { mode: 'lot'; resource: Resource };

interface ResourceFormValues {
  resource_key: string;
  name: string;
  category: ResourceCategory;
  unit_of_measure: string;
  is_consumable: boolean;
}

const EMPTY_RESOURCE: ResourceFormValues = {
  resource_key: '',
  name: '',
  category: 'feed',
  unit_of_measure: 'unit',
  is_consumable: true,
};

function ResourceForm({
  initial,
  submitLabel,
  submitting,
  error,
  onSubmit,
  onCancel,
}: {
  initial: ResourceFormValues;
  submitLabel: string;
  submitting: boolean;
  error: string | null;
  onSubmit: (values: ResourceInput) => void;
  onCancel: () => void;
}) {
  const [values, setValues] = useState<ResourceFormValues>(initial);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    onSubmit({
      resource_key: values.resource_key.trim(),
      name: values.name.trim(),
      category: values.category,
      unit_of_measure: values.unit_of_measure.trim() || 'unit',
      is_consumable: values.is_consumable,
    });
  };

  return (
    <form onSubmit={handleSubmit} noValidate>
      <FormField label="Resource key" required>
        {({ id, errorClass }) => (
          <input
            id={id}
            type="text"
            className={`form-input ${errorClass}`}
            required
            value={values.resource_key}
            onChange={(e) => setValues((v) => ({ ...v, resource_key: e.target.value }))}
          />
        )}
      </FormField>
      <FormField label="Name" required>
        {({ id, errorClass }) => (
          <input
            id={id}
            type="text"
            className={`form-input ${errorClass}`}
            required
            value={values.name}
            onChange={(e) => setValues((v) => ({ ...v, name: e.target.value }))}
          />
        )}
      </FormField>
      <FormField label="Category" required>
        {({ id, errorClass }) => (
          <select
            id={id}
            className={`form-input ${errorClass}`}
            value={values.category}
            onChange={(e) =>
              setValues((v) => ({ ...v, category: e.target.value as ResourceCategory }))
            }
          >
            {RESOURCE_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        )}
      </FormField>
      <FormField label="Unit of measure">
        {({ id, errorClass }) => (
          <input
            id={id}
            type="text"
            className={`form-input ${errorClass}`}
            value={values.unit_of_measure}
            onChange={(e) => setValues((v) => ({ ...v, unit_of_measure: e.target.value }))}
          />
        )}
      </FormField>
      <div className="mb-4">
        <label className="inline-flex items-center gap-2 text-sm text-green-900">
          <input
            type="checkbox"
            checked={values.is_consumable}
            onChange={(e) => setValues((v) => ({ ...v, is_consumable: e.target.checked }))}
          />
          Consumable
        </label>
      </div>

      {error && (
        <p role="alert" className="form-error mb-3">
          {error}
        </p>
      )}

      <div className="flex justify-end gap-3">
        <button type="button" className="btn-secondary" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="btn-primary" disabled={submitting}>
          {submitLabel}
        </button>
      </div>
    </form>
  );
}

function LotForm({
  resource,
  vendors,
  submitting,
  error,
  onSubmit,
  onCancel,
}: {
  resource: Resource;
  vendors: ContactOption[];
  submitting: boolean;
  error: string | null;
  onSubmit: (values: { vendor_contact_id: string | null; qty_purchased: number; unit_cost: number }) => void;
  onCancel: () => void;
}) {
  const [vendorId, setVendorId] = useState('');
  const [qty, setQty] = useState('');
  const [unitCost, setUnitCost] = useState('');

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    onSubmit({
      vendor_contact_id: vendorId || null,
      qty_purchased: Number(qty),
      unit_cost: Number(unitCost),
    });
  };

  return (
    <form onSubmit={handleSubmit} noValidate>
      <p className="mb-4 text-sm text-green-800/70">
        New purchased lot for <span className="font-medium">{resource.name}</span> (per{' '}
        {resource.unit_of_measure}).
      </p>
      <FormField label="Vendor">
        {({ id, errorClass }) => (
          <select
            id={id}
            className={`form-input ${errorClass}`}
            value={vendorId}
            onChange={(e) => setVendorId(e.target.value)}
          >
            <option value="">— No vendor —</option>
            {vendors.map((v) => (
              <option key={v.id} value={v.id}>
                {contactName(v)}
              </option>
            ))}
          </select>
        )}
      </FormField>
      <FormField label="Quantity purchased" required>
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
      <FormField label="Unit cost" required hint="Cost per unit; the resolver prices consumption from the drawn lot.">
        {({ id, errorClass }) => (
          <input
            id={id}
            type="number"
            min="0"
            step="any"
            className={`form-input ${errorClass}`}
            required
            value={unitCost}
            onChange={(e) => setUnitCost(e.target.value)}
          />
        )}
      </FormField>

      {error && (
        <p role="alert" className="form-error mb-3">
          {error}
        </p>
      )}

      <div className="flex justify-end gap-3">
        <button type="button" className="btn-secondary" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="btn-primary" disabled={submitting}>
          Add lot
        </button>
      </div>
    </form>
  );
}

export default function ResourcesPage() {
  const modules = useModules();
  const barnopsOn = modules['mod.barnops'] === true;
  const toast = useToast();

  const [resources, setResources] = useState<Resource[]>([]);
  const [lots, setLots] = useState<ResourceLot[]>([]);
  const [vendors, setVendors] = useState<ContactOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [modal, setModal] = useState<ModalState>({ mode: 'closed' });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [r, l, v] = await Promise.all([
        listResources(),
        listResourceLots(),
        listContactOptions(),
      ]);
      setResources(r);
      setLots(l);
      setVendors(v);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Could not load resources.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!barnopsOn) return;
    void load();
  }, [barnopsOn, load]);

  const onHandByResource = useMemo(() => {
    const map = new Map<string, number>();
    for (const lot of lots) {
      map.set(lot.resource_id, (map.get(lot.resource_id) ?? 0) + Number(lot.on_hand));
    }
    return map;
  }, [lots]);

  const resourceById = useMemo(() => new Map(resources.map((r) => [r.id, r])), [resources]);
  const vendorById = useMemo(() => new Map(vendors.map((v) => [v.id, v])), [vendors]);

  const closeModal = () => {
    setFormError(null);
    setModal({ mode: 'closed' });
  };

  const handleResourceSubmit = async (input: ResourceInput) => {
    const editing = modal.mode === 'edit' ? modal.resource : null;
    setSaving(true);
    setFormError(null);
    try {
      if (editing) {
        await updateResource(editing.id, input);
      } else {
        await createResource(input);
      }
      await load();
      toast.success(editing ? 'Resource updated.' : 'Resource created.');
      setModal({ mode: 'closed' });
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not save resource.');
    } finally {
      setSaving(false);
    }
  };

  const handleLotSubmit = async (values: {
    vendor_contact_id: string | null;
    qty_purchased: number;
    unit_cost: number;
  }) => {
    if (modal.mode !== 'lot') return;
    setSaving(true);
    setFormError(null);
    try {
      await createResourceLot({
        resource_id: modal.resource.id,
        vendor_contact_id: values.vendor_contact_id,
        qty_purchased: values.qty_purchased,
        unit_cost: values.unit_cost,
      });
      await load();
      toast.success('Lot recorded.');
      setModal({ mode: 'closed' });
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not record lot.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto py-8 px-4">
      <Helmet>
        <title>Resources · Barn Ops</title>
      </Helmet>

      <ModuleGate moduleKey="mod.barnops" modules={modules}>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="font-serif text-2xl text-green-900">Resources</h1>
            <p className="text-sm text-green-800/70">
              Consumables catalog — stock levels are the sum of on-hand across purchased lots.
            </p>
          </div>
          <button
            type="button"
            className="btn-primary"
            onClick={() => {
              setFormError(null);
              setModal({ mode: 'create' });
            }}
          >
            New resource
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

        {loadError ? (
          <p role="alert" className="form-error mb-4">
            {loadError}
          </p>
        ) : (
          <>
            <DataTable<Resource>
              columns={[
                { key: 'name', header: 'Name', render: (r) => r.name },
                { key: 'key', header: 'Key', render: (r) => r.resource_key },
                { key: 'category', header: 'Category', render: (r) => r.category },
                { key: 'unit', header: 'Unit', render: (r) => r.unit_of_measure },
                {
                  key: 'on_hand',
                  header: 'On hand',
                  className: 'text-right',
                  render: (r) => (
                    <span data-testid={`on-hand-${r.resource_key}`}>
                      {onHandByResource.get(r.id) ?? 0}
                    </span>
                  ),
                },
              ]}
              rows={resources}
              rowKey={(r) => r.id}
              loading={loading}
              emptyTitle="No resources yet"
              emptyMessage="Create a resource, then record purchased lots against it."
              onRowClick={(resource) => {
                setFormError(null);
                setModal({ mode: 'edit', resource });
              }}
              rowActions={[
                {
                  label: 'Add lot',
                  onClick: (resource) => {
                    setFormError(null);
                    setModal({ mode: 'lot', resource });
                  },
                },
              ]}
            />

            <section aria-labelledby="lots-heading" className="mt-10">
              <h2 id="lots-heading" className="font-serif text-lg text-green-900 mb-3">
                Recent lots
              </h2>
              <DataTable<ResourceLot>
                columns={[
                  {
                    key: 'resource',
                    header: 'Resource',
                    render: (l) => resourceById.get(l.resource_id)?.name ?? l.resource_id,
                  },
                  {
                    key: 'vendor',
                    header: 'Vendor',
                    render: (l) =>
                      l.vendor_contact_id
                        ? contactName(vendorById.get(l.vendor_contact_id)) || '—'
                        : '—',
                  },
                  {
                    key: 'qty',
                    header: 'Purchased',
                    className: 'text-right',
                    render: (l) => l.qty_purchased,
                  },
                  {
                    key: 'unit_cost',
                    header: 'Unit cost',
                    className: 'text-right',
                    render: (l) => <Money amount={Number(l.unit_cost)} />,
                  },
                  {
                    key: 'on_hand',
                    header: 'On hand',
                    className: 'text-right',
                    render: (l) => l.on_hand,
                  },
                  {
                    key: 'purchased_at',
                    header: 'Purchased at',
                    render: (l) => new Date(l.purchased_at).toLocaleDateString(),
                  },
                ]}
                rows={lots}
                rowKey={(l) => l.id}
                loading={loading}
                emptyTitle="No lots yet"
                emptyMessage="Use “Add lot” on a resource to record a purchase."
              />
            </section>
          </>
        )}

        <Modal
          open={modal.mode !== 'closed'}
          onClose={closeModal}
          title={
            modal.mode === 'edit'
              ? 'Edit resource'
              : modal.mode === 'lot'
                ? 'Add lot'
                : 'New resource'
          }
          disableBackdropClose={saving}
        >
          {(modal.mode === 'create' || modal.mode === 'edit') && (
            <ResourceForm
              initial={
                modal.mode === 'edit'
                  ? {
                      resource_key: modal.resource.resource_key,
                      name: modal.resource.name,
                      category: modal.resource.category,
                      unit_of_measure: modal.resource.unit_of_measure,
                      is_consumable: modal.resource.is_consumable,
                    }
                  : EMPTY_RESOURCE
              }
              submitLabel={modal.mode === 'edit' ? 'Save changes' : 'Create resource'}
              submitting={saving}
              error={formError}
              onSubmit={handleResourceSubmit}
              onCancel={closeModal}
            />
          )}
          {modal.mode === 'lot' && (
            <LotForm
              resource={modal.resource}
              vendors={vendors}
              submitting={saving}
              error={formError}
              onSubmit={handleLotSubmit}
              onCancel={closeModal}
            />
          )}
        </Modal>
      </ModuleGate>
    </div>
  );
}
