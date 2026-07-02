import { useEffect, useState } from 'react';
import { DataTable, Modal, FormField, AsyncButton, StatusBadge, Money, useAsync, useToast } from '../../../../lib/ops';
import {
  listProducts, createProduct, listProductPrices, createProductPrice,
  type Product, type ProductPrice,
} from '../../../../lib/api';

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

export function AdminProductsPage() {
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
      setProductError(err instanceof Error ? err.message : 'Could not create the product.');
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
      setPriceError(err instanceof Error ? err.message : 'Could not add the price.');
      throw err;
    }
  }

  return (
    <div className="max-w-5xl mx-auto py-8 px-4">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-serif text-2xl text-green-900">Products</h1>
          <p className="text-sm text-green-800/70">Catalog and effective-dated pricing.</p>
        </div>
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

export default AdminProductsPage;
