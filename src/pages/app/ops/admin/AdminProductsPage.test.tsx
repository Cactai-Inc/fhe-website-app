// @vitest-environment jsdom
/**
 * ADMIN-PRODUCTS UI-interaction test (Wiring & Verification Contract §15).
 *
 * Renders the REAL AdminProductsPage over the mocked lib/api layer and proves:
 *  - listProducts() drives the catalog table,
 *  - the create flow calls createProduct with the EXACT payload and refreshes,
 *  - clicking a product fetches its price history (listProductPrices(id)) and
 *    renders the effective-dated rows,
 *  - adding a price calls createProductPrice with the exact payload (no
 *    effective_from key when the field is blank → server defaults to now) and
 *    refreshes the history,
 *  - a rejected create renders the inline error branch (modal stays open).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithRouter, screen, userEvent, waitFor } from '../../../../test/render';

const listProducts = vi.hoisted(() => vi.fn());
const createProduct = vi.hoisted(() => vi.fn());
const listProductPrices = vi.hoisted(() => vi.fn());
const createProductPrice = vi.hoisted(() => vi.fn());
vi.mock('../../../../lib/api', () => ({ listProducts, createProduct, listProductPrices, createProductPrice }));

import { AdminProductsPage } from './AdminProductsPage';

const PRODUCT = {
  id: 'p-1', org_id: 'org-1', product_key: 'LESSON_PRIVATE_60', name: 'Private Lesson (60m)',
  service_type: 'RIDING_LESSON', module_key: 'mod.lessons', price_value_key: null, active: true,
  created_at: '', updated_at: '',
};
const PRICE = {
  id: 'pp-1', org_id: 'org-1', product_id: 'p-1', amount: 95,
  effective_from: '2026-06-01T00:00:00Z', effective_to: null, created_at: '', updated_at: '',
};

beforeEach(() => {
  vi.clearAllMocks();
  listProducts.mockResolvedValue([PRODUCT]);
  listProductPrices.mockResolvedValue([PRICE]);
});

describe('AdminProductsPage', () => {
  it('renders the product catalog from listProducts', async () => {
    renderWithRouter(<AdminProductsPage />);
    expect(await screen.findByText('Private Lesson (60m)')).toBeInTheDocument();
    expect(screen.getByText('LESSON_PRIVATE_60')).toBeInTheDocument();
    expect(screen.getByText('mod.lessons')).toBeInTheDocument();
    expect(screen.getByText('ACTIVE')).toBeInTheDocument();
    expect(listProducts).toHaveBeenCalledWith();
  });

  it('creates a product with the exact payload and refreshes the list', async () => {
    createProduct.mockResolvedValue({ ...PRODUCT, id: 'p-2', product_key: 'BOARD_FULL' });
    renderWithRouter(<AdminProductsPage />);
    await screen.findByText('Private Lesson (60m)');

    await userEvent.click(screen.getByRole('button', { name: /new product/i }));
    await userEvent.type(screen.getByLabelText(/product key/i), 'BOARD_FULL');
    await userEvent.type(screen.getByLabelText(/^name/i), 'Full Board');
    await userEvent.type(screen.getByLabelText(/module key/i), 'mod.boarding');
    await userEvent.click(screen.getByRole('button', { name: /create product/i }));

    await waitFor(() => expect(createProduct).toHaveBeenCalledWith({
      product_key: 'BOARD_FULL', name: 'Full Board', module_key: 'mod.boarding', service_type: null,
    }));
    expect(listProducts).toHaveBeenCalledTimes(2); // initial + refresh
  });

  it('clicking a product loads and renders its price history', async () => {
    renderWithRouter(<AdminProductsPage />);
    await userEvent.click(await screen.findByText('Private Lesson (60m)'));

    await waitFor(() => expect(listProductPrices).toHaveBeenCalledWith('p-1'));
    expect(await screen.findByText('$95.00')).toBeInTheDocument();
    expect(screen.getByText('Open')).toBeInTheDocument(); // null effective_to
  });

  it('adds a price with the exact payload (no effective_from when blank) and refreshes', async () => {
    createProductPrice.mockResolvedValue({ ...PRICE, id: 'pp-2', amount: 120 });
    renderWithRouter(<AdminProductsPage />);
    await userEvent.click(await screen.findByText('Private Lesson (60m)'));
    await screen.findByText('$95.00');

    await userEvent.type(screen.getByLabelText(/amount/i), '120');
    await userEvent.click(screen.getByRole('button', { name: /add price/i }));

    await waitFor(() => expect(createProductPrice).toHaveBeenCalledWith({ product_id: 'p-1', amount: 120 }));
    await waitFor(() => expect(listProductPrices).toHaveBeenCalledTimes(2)); // initial + refresh
  });

  it('a rejected create renders the inline error and keeps the modal open', async () => {
    createProduct.mockRejectedValue(new Error('duplicate product_key'));
    renderWithRouter(<AdminProductsPage />);
    await screen.findByText('Private Lesson (60m)');

    await userEvent.click(screen.getByRole('button', { name: /new product/i }));
    await userEvent.type(screen.getByLabelText(/product key/i), 'BOARD_FULL');
    await userEvent.type(screen.getByLabelText(/^name/i), 'Full Board');
    await userEvent.click(screen.getByRole('button', { name: /create product/i }));

    const alerts = await screen.findAllByRole('alert');
    expect(alerts.some((a) => a.textContent?.includes('duplicate product_key'))).toBe(true);
    expect(screen.getByRole('button', { name: /create product/i })).toBeInTheDocument();
  });
});
