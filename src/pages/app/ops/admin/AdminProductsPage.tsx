import { useEffect, useState } from 'react';
import { toErrorMessage } from '../../../../lib/ops/errors';
import { DataTable, Modal, FormField, AsyncButton, StatusBadge, Money, useAsync, useToast } from '../../../../lib/ops';
import {
  listProducts, createProduct, listProductPrices, createProductPrice,
  type Product, type ProductPrice,
} from '../../../../lib/api';
import {
  adminListOfferings, adminCreateOffering, adminUpdateOffering, type OfferingInput,
} from '../../../../lib/admin';
import type { Offering, Segment, PriceUnitDb, PurchaseType } from '../../../../lib/types';

/**
 * ADMIN-PRODUCTS — the product catalog + effective-dated price book (admin-only
 * route; requireAdmin at the router, RLS staff-write on products/product_prices).
 *
 * Products table (key / name / module / active) with a create modal. Clicking a
 * row opens that product's price history (listProductPrices, newest first) and
 * an add-price form that inserts a NEW effective-dated product_prices row via
 * createProductPrice — history is preserved, never overwritten.
 */

const EMPTY_PRODUCT = { product_key: '', name: '', module_key: '', service_type: '' };

function PriceBookTab() {
  const toast = useToast();
  const products = useAsync(listProducts);
  const prices = useAsync(listProductPrices);

  const [createOpen, setCreateOpen] = useState(false);
  const [productForm, setProductForm] = useState(EMPTY_PRODUCT);
  const [productError, setProductError] = useState<string | null>(null);

  const [selected, setSelected] = useState<Product | null>(null);
  const [priceForm, setPriceForm] = useState({ amount: '', effective_from: '' });
  const [priceError, setPriceError] = useState<string | null>(null);

  useEffect(() => {
    products.run().catch(() => { /* inline error branch */ });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function openCreate() {
    setProductForm(EMPTY_PRODUCT);
    setProductError(null);
    setCreateOpen(true);
  }

  function openProduct(row: Product) {
    setSelected(row);
    setPriceForm({ amount: '', effective_from: '' });
    setPriceError(null);
    prices.run(row.id).catch(() => { /* inline error branch */ });
  }

  async function submitProduct() {
    setProductError(null);
    if (!productForm.product_key.trim() || !productForm.name.trim()) {
      setProductError('Product key and name are required.');
      return;
    }
    try {
      await createProduct({
        product_key: productForm.product_key.trim(),
        name: productForm.name.trim(),
        module_key: productForm.module_key.trim() || null,
        service_type: productForm.service_type.trim() || null,
      });
      toast.success('Product created');
      setCreateOpen(false);
      await products.run();
    } catch (err) {
      setProductError(toErrorMessage(err, 'Could not create the product.'));
      throw err;
    }
  }

  async function submitPrice() {
    setPriceError(null);
    if (!selected) return;
    const amount = Number(priceForm.amount);
    if (!priceForm.amount.trim() || !Number.isFinite(amount) || amount < 0) {
      setPriceError('Enter a valid non-negative amount.');
      return;
    }
    try {
      await createProductPrice({
        product_id: selected.id,
        amount,
        ...(priceForm.effective_from
          ? { effective_from: new Date(priceForm.effective_from).toISOString() }
          : {}),
      });
      toast.success('Price added');
      setPriceForm({ amount: '', effective_from: '' });
      await prices.run(selected.id);
    } catch (err) {
      setPriceError(toErrorMessage(err, 'Could not add the price.'));
      throw err;
    }
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <p className="text-sm text-green-800/70">Internal product keys and effective-dated pricing history.</p>
        <button type="button" className="btn-primary" onClick={openCreate}>New product</button>
      </div>

      {products.isError && (
        <p role="alert" className="form-error mb-4">{products.error?.message ?? 'Could not load products.'}</p>
      )}
      <DataTable<Product>
        columns={[
          { key: 'key', header: 'Key', render: (r) => <code className="text-xs">{r.product_key}</code> },
          { key: 'name', header: 'Name', render: (r) => r.name },
          { key: 'module', header: 'Module', render: (r) => r.module_key ?? '—' },
          { key: 'active', header: 'Status', render: (r) => <StatusBadge status={r.active ? 'ACTIVE' : 'INACTIVE'} /> },
        ]}
        rows={products.data ?? []}
        rowKey={(r) => r.id}
        loading={products.isPending}
        emptyTitle="No products yet"
        emptyMessage="Create your first product to start selling."
        onRowClick={openProduct}
      />

      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="New product"
        footer={
          <AsyncButton className="btn-primary" onClick={submitProduct} pendingLabel="Creating…">
            Create product
          </AsyncButton>
        }
      >
        {productError && <p role="alert" className="form-error mb-3">{productError}</p>}
        <FormField label="Product key" required hint="Stable identifier, e.g. LESSON_PRIVATE_60">
          {({ id, errorClass }) => (
            <input
              id={id}
              className={`form-input ${errorClass}`}
              value={productForm.product_key}
              onChange={(e) => setProductForm((f) => ({ ...f, product_key: e.target.value }))}
            />
          )}
        </FormField>
        <FormField label="Name" required>
          {({ id, errorClass }) => (
            <input
              id={id}
              className={`form-input ${errorClass}`}
              value={productForm.name}
              onChange={(e) => setProductForm((f) => ({ ...f, name: e.target.value }))}
            />
          )}
        </FormField>
        <FormField label="Module key" hint="Optional — e.g. mod.lessons">
          {({ id, errorClass }) => (
            <input
              id={id}
              className={`form-input ${errorClass}`}
              value={productForm.module_key}
              onChange={(e) => setProductForm((f) => ({ ...f, module_key: e.target.value }))}
            />
          )}
        </FormField>
        <FormField label="Service type" hint="Optional — links the product to a service">
          {({ id, errorClass }) => (
            <input
              id={id}
              className={`form-input ${errorClass}`}
              value={productForm.service_type}
              onChange={(e) => setProductForm((f) => ({ ...f, service_type: e.target.value }))}
            />
          )}
        </FormField>
      </Modal>

      <Modal
        open={selected !== null}
        onClose={() => setSelected(null)}
        title={selected ? `Prices — ${selected.name}` : 'Prices'}
        footer={
          <AsyncButton className="btn-primary" onClick={submitPrice} pendingLabel="Adding…">
            Add price
          </AsyncButton>
        }
      >
        {priceError && <p role="alert" className="form-error mb-3">{priceError}</p>}
        <FormField label="Amount (USD)" required>
          {({ id, errorClass }) => (
            <input
              id={id}
              type="number"
              min="0"
              step="0.01"
              className={`form-input ${errorClass}`}
              value={priceForm.amount}
              onChange={(e) => setPriceForm((f) => ({ ...f, amount: e.target.value }))}
            />
          )}
        </FormField>
        <FormField label="Effective from" hint="Optional — defaults to now">
          {({ id, errorClass }) => (
            <input
              id={id}
              type="datetime-local"
              className={`form-input ${errorClass}`}
              value={priceForm.effective_from}
              onChange={(e) => setPriceForm((f) => ({ ...f, effective_from: e.target.value }))}
            />
          )}
        </FormField>

        <h3 className="font-serif text-lg text-green-900 mt-6 mb-2">Price history</h3>
        {prices.isError && (
          <p role="alert" className="form-error mb-3">{prices.error?.message ?? 'Could not load prices.'}</p>
        )}
        <DataTable<ProductPrice>
          columns={[
            { key: 'amount', header: 'Amount', render: (r) => <Money amount={r.amount} /> },
            { key: 'from', header: 'Effective from', render: (r) => new Date(r.effective_from).toLocaleString() },
            { key: 'to', header: 'Effective to', render: (r) => (r.effective_to ? new Date(r.effective_to).toLocaleString() : 'Open') },
          ]}
          rows={prices.data ?? []}
          rowKey={(r) => r.id}
          loading={prices.isPending}
          emptyTitle="No prices yet"
          emptyMessage="Add the first effective-dated price."
        />
      </Modal>
    </div>
  );
}

// ─── Catalog tab: the OFFERINGS the site, booking, and checkout actually show ──
const SEGMENTS: Segment[] = ['rider', 'horse', 'support'];
const PRICE_UNITS: PriceUnitDb[] = ['session', 'week', 'month', 'flat', 'percent'];
const PURCHASE_TYPES: PurchaseType[] = ['one_time', 'subscription', 'deposit_retainer'];

const EMPTY_OFFERING: OfferingInput = {
  segment: 'rider', name: '', tagline: '', description: '', service_type: '',
  price_amount: null, price_unit: null, price_min: null, purchase_type: null,
  horse_included: null, is_popular: false, note: '', active: true, sort_order: 0,
};

function OfferingForm({
  value, onChange,
}: { value: OfferingInput; onChange: (v: OfferingInput) => void }) {
  const set = <K extends keyof OfferingInput>(k: K, v: OfferingInput[K]) => onChange({ ...value, [k]: v });
  return (
    <div className="grid sm:grid-cols-2 gap-3">
      <FormField label="Name" required hint="The slug is generated from segment + name, collision-free">
        {({ id, errorClass }) => (
          <input id={id} className={`form-input ${errorClass}`} value={value.name}
            onChange={(e) => set('name', e.target.value)} />
        )}
      </FormField>
      <FormField label="Segment" required hint="Which catalog namespace it lives in">
        {({ id, errorClass }) => (
          <select id={id} className={`form-input ${errorClass}`} value={value.segment}
            onChange={(e) => set('segment', e.target.value as Segment)}>
            {SEGMENTS.map((sg) => <option key={sg} value={sg}>{sg}</option>)}
          </select>
        )}
      </FormField>
      <FormField label="Tagline">
        {({ id, errorClass }) => (
          <input id={id} className={`form-input ${errorClass}`} value={value.tagline ?? ''}
            onChange={(e) => set('tagline', e.target.value || null)} />
        )}
      </FormField>
      <FormField label="Service type" hint="Links to servicing (e.g. lesson, training)">
        {({ id, errorClass }) => (
          <input id={id} className={`form-input ${errorClass}`} value={value.service_type ?? ''}
            onChange={(e) => set('service_type', e.target.value || null)} />
        )}
      </FormField>
      <div className="sm:col-span-2">
        <FormField label="Description">
          {({ id, errorClass }) => (
            <textarea id={id} rows={3} className={`form-input resize-none ${errorClass}`} value={value.description ?? ''}
              onChange={(e) => set('description', e.target.value || null)} />
          )}
        </FormField>
      </div>
      <FormField label="Price (USD)" hint="Blank = inquire">
        {({ id, errorClass }) => (
          <input id={id} type="number" min="0" step="0.01" className={`form-input ${errorClass}`}
            value={value.price_amount ?? ''}
            onChange={(e) => set('price_amount', e.target.value === '' ? null : Number(e.target.value))} />
        )}
      </FormField>
      <FormField label="Price unit">
        {({ id, errorClass }) => (
          <select id={id} className={`form-input ${errorClass}`} value={value.price_unit ?? ''}
            onChange={(e) => set('price_unit', (e.target.value || null) as PriceUnitDb | null)}>
            <option value="">—</option>
            {PRICE_UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
          </select>
        )}
      </FormField>
      <FormField label="Minimum price" hint='Shows as "from $X"'>
        {({ id, errorClass }) => (
          <input id={id} type="number" min="0" step="0.01" className={`form-input ${errorClass}`}
            value={value.price_min ?? ''}
            onChange={(e) => set('price_min', e.target.value === '' ? null : Number(e.target.value))} />
        )}
      </FormField>
      <FormField label="Purchase type">
        {({ id, errorClass }) => (
          <select id={id} className={`form-input ${errorClass}`} value={value.purchase_type ?? ''}
            onChange={(e) => set('purchase_type', (e.target.value || null) as PurchaseType | null)}>
            <option value="">—</option>
            {PURCHASE_TYPES.map((u) => <option key={u} value={u}>{u.replace('_', ' ')}</option>)}
          </select>
        )}
      </FormField>
      <FormField label="Lesson horse" hint="Riding lessons only">
        {({ id, errorClass }) => (
          <select id={id} className={`form-input ${errorClass}`}
            value={value.horse_included === null || value.horse_included === undefined ? '' : String(value.horse_included)}
            onChange={(e) => set('horse_included', e.target.value === '' ? null : e.target.value === 'true')}>
            <option value="">Not a lesson</option>
            <option value="true">Ride our horse</option>
            <option value="false">With your horse</option>
          </select>
        )}
      </FormField>
      <FormField label="Sort order">
        {({ id, errorClass }) => (
          <input id={id} type="number" className={`form-input ${errorClass}`} value={value.sort_order ?? 0}
            onChange={(e) => set('sort_order', Number(e.target.value) || 0)} />
        )}
      </FormField>
      <div className="sm:col-span-2 flex gap-6">
        <label className="inline-flex items-center gap-2 text-sm text-secondary">
          <input type="checkbox" className="accent-green-700" checked={value.is_popular ?? false}
            onChange={(e) => set('is_popular', e.target.checked)} />
          Mark as popular
        </label>
        <label className="inline-flex items-center gap-2 text-sm text-secondary">
          <input type="checkbox" className="accent-green-700" checked={value.active ?? true}
            onChange={(e) => set('active', e.target.checked)} />
          Published (visible everywhere it's wired)
        </label>
      </div>
      <div className="sm:col-span-2">
        <FormField label="Note" hint="Small print under the price">
          {({ id, errorClass }) => (
            <input id={id} className={`form-input ${errorClass}`} value={value.note ?? ''}
              onChange={(e) => set('note', e.target.value || null)} />
          )}
        </FormField>
      </div>
    </div>
  );
}

function CatalogTab() {
  const toast = useToast();
  const [rows, setRows] = useState<Offering[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Offering | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<OfferingInput>(EMPTY_OFFERING);
  const [formError, setFormError] = useState<string | null>(null);

  const load = () => {
    adminListOfferings().then(setRows).catch(() => setError('Could not load the catalog.'));
  };
  useEffect(load, []);

  function openCreate() {
    setForm(EMPTY_OFFERING); setFormError(null); setCreating(true); setEditing(null);
  }
  function openEdit(row: Offering) {
    setForm({
      segment: row.segment, name: row.name, tagline: row.tagline, description: row.description,
      service_type: row.service_type, price_amount: row.price_amount, price_unit: row.price_unit,
      price_min: row.price_min, purchase_type: row.purchase_type, horse_included: row.horse_included,
      is_popular: row.is_popular, note: row.note, active: row.active, sort_order: row.sort_order,
    });
    setFormError(null); setEditing(row); setCreating(false);
  }

  async function submit() {
    setFormError(null);
    if (!form.name.trim()) { setFormError('Name is required.'); return; }
    try {
      if (editing) {
        await adminUpdateOffering(editing.id, form);
        toast.success('Offering updated — live everywhere it appears');
      } else {
        const created = await adminCreateOffering({ ...form, name: form.name.trim() });
        toast.success(`Created — slug ${created.slug}`);
      }
      setCreating(false); setEditing(null);
      load();
    } catch (err) {
      setFormError(toErrorMessage(err, 'Could not save the offering.'));
      throw err;
    }
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <p className="text-sm text-green-800/70">
          What the site, booking, and checkout show. Edits reach every published and
          unpublished visibility point immediately.
        </p>
        <button type="button" className="btn-primary" onClick={openCreate}>New offering</button>
      </div>
      {error && <p role="alert" className="form-error mb-4">{error}</p>}
      <DataTable<Offering>
        columns={[
          { key: 'segment', header: 'Segment', render: (r) => r.segment },
          { key: 'name', header: 'Name', render: (r) => r.name },
          { key: 'slug', header: 'Slug', render: (r) => <code className="text-xs">{r.slug}</code> },
          { key: 'price', header: 'Price', render: (r) => (r.price_amount != null ? <Money amount={r.price_amount} /> : r.price_min != null ? `from $${r.price_min}` : '—') },
          { key: 'active', header: 'Status', render: (r) => <StatusBadge status={r.active ? 'PUBLISHED' : 'HIDDEN'} /> },
        ]}
        rows={rows ?? []}
        rowKey={(r) => r.id}
        loading={rows === null && !error}
        emptyTitle="No offerings"
        emptyMessage="Create your first catalog offering."
        onRowClick={openEdit}
      />

      <Modal
        open={creating || editing !== null}
        onClose={() => { setCreating(false); setEditing(null); }}
        title={editing ? `Edit — ${editing.name}` : 'New offering'}
        footer={
          <AsyncButton className="btn-primary" onClick={submit} pendingLabel="Saving…">
            {editing ? 'Save changes' : 'Create offering'}
          </AsyncButton>
        }
      >
        {formError && <p role="alert" className="form-error mb-3">{formError}</p>}
        {editing && (
          <p className="text-[11.5px] text-muted mb-3">
            Slug <code>{editing.slug}</code> stays stable so existing links keep working.
          </p>
        )}
        <OfferingForm value={form} onChange={setForm} />
      </Modal>
    </div>
  );
}

export function AdminProductsPage() {
  const [tab, setTab] = useState<'catalog' | 'pricebook'>('catalog');
  return (
    <div className="max-w-5xl mx-auto py-8 px-4">
      <h1 className="font-serif text-2xl text-green-900 mb-1">Products</h1>
      <p className="text-sm text-green-800/70 mb-5">The catalog customers see, and the internal price book.</p>
      <div className="flex gap-1.5 mb-6">
        {([['catalog', 'Catalog'], ['pricebook', 'Price book']] as ['catalog' | 'pricebook', string][]).map(([k, label]) => (
          <button key={k} type="button" onClick={() => setTab(k)}
            className={`px-4 py-2 rounded-full text-sm font-sans focus-ring ${
              tab === k ? 'bg-green-800 text-white' : 'bg-green-800/10 text-green-800 hover:bg-green-800/20'
            }`}>
            {label}
          </button>
        ))}
      </div>
      {tab === 'catalog' ? <CatalogTab /> : <PriceBookTab />}
    </div>
  );
}

export default AdminProductsPage;
