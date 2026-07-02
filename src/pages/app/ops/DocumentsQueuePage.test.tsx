// @vitest-environment jsdom
/**
 * OPS-DOCS-QUEUE executable proof (PLATFORM_ARCHITECTURE.md §15.2).
 *
 * Renders the REAL DocumentsQueuePage, mocks the REAL data fn `listDocuments`,
 * and asserts:
 *   - listDocuments is called and the queue renders the document rows with a
 *     StatusBadge on each `status`,
 *   - changing the status filter RE-FIRES the query (listDocuments called again)
 *     and narrows the rendered rows to the selected status — the filter is wired
 *     to the data path, not decorative,
 *   - each row's title is a real <Link> to /app/ops/documents/:id (OPS-DOC-VIEW),
 *     and clicking it navigates there,
 *   - the error branch renders when listDocuments rejects (errors not swallowed).
 *
 * Static dead-end audit: the status <select> has a real onChange wired to the
 * fetch; row links are real <Link>s, not dead handlers.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Routes, Route } from 'react-router-dom';
import { renderWithRouter, screen, userEvent, waitFor, within } from '../../../test/render';

const listDocuments = vi.fn();
vi.mock('../../../lib/api', () => ({
  listDocuments: (...args: unknown[]) => listDocuments(...args),
}));

import DocumentsQueuePage from './DocumentsQueuePage';

const ROWS = [
  {
    id: 'doc-1',
    display_code: 'DOC-0001',
    engagement_id: 'eng-11111111',
    template_id: 't1',
    title: 'Bill of Sale',
    merged_body: null,
    status: 'DRAFT',
    generated_at: '2026-06-03T00:00:00Z',
    effective_date: null,
    created_at: '2026-06-03T00:00:00Z',
    updated_at: '2026-06-03T00:00:00Z',
  },
  {
    id: 'doc-2',
    display_code: 'DOC-0002',
    engagement_id: 'eng-22222222',
    template_id: 't2',
    title: 'Purchase Agreement',
    merged_body: null,
    status: 'EXECUTED',
    generated_at: '2026-06-10T00:00:00Z',
    effective_date: null,
    created_at: '2026-06-10T00:00:00Z',
    updated_at: '2026-06-10T00:00:00Z',
  },
  {
    id: 'doc-3',
    display_code: 'DOC-0003',
    engagement_id: 'eng-33333333',
    title: 'Lease',
    merged_body: null,
    template_id: 't3',
    status: 'SENT',
    generated_at: '2026-06-07T00:00:00Z',
    effective_date: null,
    created_at: '2026-06-07T00:00:00Z',
    updated_at: '2026-06-07T00:00:00Z',
  },
];

/** Renders the page inside a route tree so the row <Link> can navigate. */
function renderPage() {
  return renderWithRouter(
    <Routes>
      <Route path="/app/ops/documents-queue" element={<DocumentsQueuePage />} />
      <Route path="/app/ops/documents/:id" element={<div>VIEWER id-probe</div>} />
    </Routes>,
    { route: '/app/ops/documents-queue' },
  );
}

describe('DocumentsQueuePage (OPS-DOCS-QUEUE)', () => {
  beforeEach(() => {
    listDocuments.mockReset();
  });

  it('calls listDocuments and renders rows with status badges, newest first', async () => {
    listDocuments.mockResolvedValue(ROWS);
    renderPage();

    expect(await screen.findByText('Bill of Sale')).toBeInTheDocument();
    expect(listDocuments).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Purchase Agreement')).toBeInTheDocument();
    expect(screen.getByText('Lease')).toBeInTheDocument();

    // StatusBadge rendered the status text for each row (scoped to the table,
    // since the filter <select> also lists status option labels).
    const table = screen.getByRole('table');
    const cells = within(table);
    expect(cells.getByText('DRAFT')).toBeInTheDocument();
    expect(cells.getByText('EXECUTED')).toBeInTheDocument();
    expect(cells.getByText('SENT')).toBeInTheDocument();

    // Sorted by generated_at desc: EXECUTED (06-10) before SENT (06-07) before DRAFT (06-03).
    const titles = screen
      .getAllByTestId(/^doc-link-/)
      .map((el) => el.textContent);
    expect(titles).toEqual(['Purchase Agreement', 'Lease', 'Bill of Sale']);
  });

  it('re-fires the query and narrows rows to the selected status on filter change', async () => {
    listDocuments.mockResolvedValue(ROWS);
    const user = userEvent.setup();
    renderPage();

    await screen.findByText('Bill of Sale');
    expect(listDocuments).toHaveBeenCalledTimes(1);

    // Change the status filter → the load re-fires (query re-runs) and the
    // rendered rows narrow to EXECUTED only.
    await user.selectOptions(screen.getByLabelText('Status'), 'EXECUTED');

    await waitFor(() => expect(listDocuments).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.queryByText('Bill of Sale')).not.toBeInTheDocument());
    expect(screen.getByText('Purchase Agreement')).toBeInTheDocument();
    expect(screen.queryByText('Lease')).not.toBeInTheDocument();
  });

  it('links each row to the OPS-DOC-VIEW route and navigates on click', async () => {
    listDocuments.mockResolvedValue(ROWS);
    const user = userEvent.setup();
    renderPage();

    const link = await screen.findByTestId('doc-link-doc-2');
    expect(link).toHaveAttribute('href', '/app/ops/documents/doc-2');

    await user.click(link);
    expect(await screen.findByText('VIEWER id-probe')).toBeInTheDocument();
  });

  it('renders the error branch when listDocuments rejects (errors not swallowed)', async () => {
    listDocuments.mockRejectedValue(new Error('rls denied'));
    renderPage();

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Could not load documents');
    expect(alert).toHaveTextContent('rls denied');
  });
});
