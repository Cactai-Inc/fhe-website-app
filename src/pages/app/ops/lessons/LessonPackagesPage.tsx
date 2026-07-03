import { useEffect, useState } from 'react';
import { toErrorMessage } from '../../../../lib/ops/errors';
import type { FormEvent } from 'react';
import { DataTable, FormField, Modal, ModuleGate, StatusBadge, useAsync, useToast } from '../../../../lib/ops';
import type { Column } from '../../../../lib/ops';
import { useModules } from '../../../../lib/ops/useModules';
import {
  listLessonPackages,
  createLessonPackage,
  updateLessonPackage,
  type LessonPackage,
  type LessonPackageInput,
} from '../../../../lib/ops/api-lessons';

/**
 * OPS-LESSON-PACKAGES — lesson pack catalog CRUD (module mod.lessons).
 *
 * The whole page body is wrapped in ModuleGate('mod.lessons'); a lessons-OFF
 * tenant sees the lock and NO data fetch fires. Inside the gate:
 * listLessonPackages() drives the table; 'New package' opens a Modal form whose
 * submit calls createLessonPackage with the exact writable columns
 * (package_key, name, price_value_key, credits); a row click opens the same
 * form in edit mode → updateLessonPackage(id, patch) including the `active`
 * toggle. Per the schema, price is a config_value() REGISTRY KEY
 * (price_value_key, ns 'PRICING'), never a literal amount. A rejected save
 * renders inline and KEEPS the modal open; success toasts + refreshes.
 */
type DrawerState = { mode: 'closed' } | { mode: 'create' } | { mode: 'edit'; pkg: LessonPackage };

interface PackageFormValues extends LessonPackageInput {
  active: boolean;
}

function PackageForm({
  pkg,
  onSubmit,
  onCancel,
  submitting,
  error,
}: {
  pkg?: LessonPackage;
  onSubmit: (values: PackageFormValues) => Promise<void>;
  onCancel: () => void;
  submitting?: boolean;
  error?: string | null;
}) {
  const [packageKey, setPackageKey] = useState(pkg?.package_key ?? '');
  const [name, setName] = useState(pkg?.name ?? '');
  const [priceValueKey, setPriceValueKey] = useState(pkg?.price_value_key ?? '');
  const [credits, setCredits] = useState(pkg ? String(pkg.credits) : '');
  const [active, setActive] = useState(pkg?.active ?? true);
  const [fieldError, setFieldError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const key = packageKey.trim();
    const trimmedName = name.trim();
    if (!key || !trimmedName) {
      setFieldError('Package key and name are required.');
      return;
    }
    const creditsNum = Number(credits);
    if (!Number.isInteger(creditsNum) || creditsNum < 0) {
      setFieldError('Credits must be a non-negative whole number.');
      return;
    }
    setFieldError(null);
    await onSubmit({
      package_key: key,
      name: trimmedName,
      price_value_key: priceValueKey.trim() || null,
      credits: creditsNum,
      active,
    });
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <FormField label="Package key" required>
        {({ id, describedBy, errorClass }) => (
          <input
            id={id}
            name="package_key"
            className={`form-input ${errorClass}`}
            aria-describedby={describedBy}
            value={packageKey}
            onChange={(e) => setPackageKey(e.target.value)}
            disabled={submitting || !!pkg}
          />
        )}
      </FormField>

      <FormField label="Name" required>
        {({ id, describedBy, errorClass }) => (
          <input
            id={id}
            name="name"
            className={`form-input ${errorClass}`}
            aria-describedby={describedBy}
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={submitting}
          />
        )}
      </FormField>

      <FormField
        label="Price registry key"
        hint="A PRICING registry key resolved via config_value() (e.g. PKG_10_PRICE) — never a literal price."
      >
        {({ id, describedBy, errorClass }) => (
          <input
            id={id}
            name="price_value_key"
            className={`form-input ${errorClass}`}
            aria-describedby={describedBy}
            value={priceValueKey}
            onChange={(e) => setPriceValueKey(e.target.value)}
            disabled={submitting}
          />
        )}
      </FormField>

      <FormField label="Credits" required>
        {({ id, describedBy, errorClass }) => (
          <input
            id={id}
            name="credits"
            type="number"
            min={0}
            step={1}
            className={`form-input ${errorClass}`}
            aria-describedby={describedBy}
            value={credits}
            onChange={(e) => setCredits(e.target.value)}
            disabled={submitting}
          />
        )}
      </FormField>

      {pkg && (
        <div className="mb-4">
          <label className="flex items-center gap-2 text-sm text-green-900">
            <input
              type="checkbox"
              checked={active}
              onChange={(e) => setActive(e.target.checked)}
              disabled={submitting}
            />
            Active (purchasable)
          </label>
        </div>
      )}

      {(fieldError || error) && (
        <p role="alert" className="form-error mb-4">
          {fieldError ?? error}
        </p>
      )}

      <div className="flex justify-end gap-3">
        <button type="button" className="btn-secondary" onClick={onCancel} disabled={submitting}>
          Cancel
        </button>
        <button type="submit" className="btn-primary" disabled={submitting} aria-busy={submitting}>
          {submitting ? 'Saving…' : pkg ? 'Save changes' : 'Create package'}
        </button>
      </div>
    </form>
  );
}

const columns: Column<LessonPackage>[] = [
  { key: 'name', header: 'Package', render: (p) => p.name },
  { key: 'key', header: 'Key', render: (p) => <span className="text-green-800/70">{p.package_key}</span> },
  { key: 'credits', header: 'Credits', render: (p) => p.credits, className: 'text-right' },
  {
    key: 'price',
    header: 'Price key',
    render: (p) => p.price_value_key ?? '—',
  },
  {
    key: 'active',
    header: 'Status',
    render: (p) => <StatusBadge status={p.active ? 'ACTIVE' : 'INACTIVE'} />,
  },
];

export function LessonPackagesPage() {
  const modules = useModules();
  const lessonsOn = modules['mod.lessons'] === true;

  const [rows, setRows] = useState<LessonPackage[]>([]);
  const [drawer, setDrawer] = useState<DrawerState>({ mode: 'closed' });
  const [formError, setFormError] = useState<string | null>(null);

  const load = useAsync(listLessonPackages);
  const toast = useToast();

  useEffect(() => {
    if (!lessonsOn) return;
    load
      .run()
      .then(setRows)
      .catch(() => {
        /* surfaced via load.isError */
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lessonsOn]);

  const save = useAsync(async (values: PackageFormValues, editing: LessonPackage | null) => {
    if (editing) {
      return updateLessonPackage(editing.id, {
        name: values.name,
        price_value_key: values.price_value_key,
        credits: values.credits,
        active: values.active,
      });
    }
    return createLessonPackage({
      package_key: values.package_key,
      name: values.name,
      price_value_key: values.price_value_key,
      credits: values.credits,
    });
  });

  const closeDrawer = () => {
    setFormError(null);
    setDrawer({ mode: 'closed' });
  };

  const handleSubmit = async (values: PackageFormValues) => {
    const editing = drawer.mode === 'edit' ? drawer.pkg : null;
    setFormError(null);
    try {
      const saved = await save.run(values, editing);
      setRows((prev) =>
        editing ? prev.map((p) => (p.id === saved.id ? saved : p)) : [saved, ...prev],
      );
      toast.success(editing ? 'Package updated.' : 'Package created.');
      setDrawer({ mode: 'closed' });
    } catch (err) {
      // Error branch: keep the modal open, surface the message.
      setFormError(toErrorMessage(err, 'Could not save the package.'));
    }
  };

  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-serif text-2xl text-green-900">Lesson packages</h1>
          <p className="text-sm text-green-800/70">The lesson packs your barn sells.</p>
        </div>
        {lessonsOn && (
          <button
            type="button"
            className="btn-primary"
            onClick={() => {
              setFormError(null);
              setDrawer({ mode: 'create' });
            }}
          >
            New package
          </button>
        )}
      </div>

      <ModuleGate moduleKey="mod.lessons" modules={modules}>
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
            {load.error?.message ?? 'Could not load lesson packages.'}
          </p>
        )}

        <DataTable
          columns={columns}
          rows={rows}
          rowKey={(p) => p.id}
          loading={load.isPending && rows.length === 0}
          emptyTitle="No lesson packages yet"
          emptyMessage="Create your first pack to start selling lessons in bundles."
          onRowClick={(pkg) => {
            setFormError(null);
            setDrawer({ mode: 'edit', pkg });
          }}
        />

        <Modal
          open={drawer.mode !== 'closed'}
          onClose={closeDrawer}
          title={drawer.mode === 'edit' ? 'Edit package' : 'New package'}
          disableBackdropClose={save.isPending}
        >
          {drawer.mode !== 'closed' && (
            <PackageForm
              pkg={drawer.mode === 'edit' ? drawer.pkg : undefined}
              onSubmit={handleSubmit}
              onCancel={closeDrawer}
              submitting={save.isPending}
              error={formError}
            />
          )}
        </Modal>
      </ModuleGate>
    </div>
  );
}

export default LessonPackagesPage;
