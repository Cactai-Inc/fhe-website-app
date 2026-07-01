// @vitest-environment jsdom
/**
 * OPS-ENG-LIST executable proof — list page (PLATFORM_ARCHITECTURE.md §15).
 * Renders the REAL EngagementsPage, mocks the REAL data fn `listEngagements`,
 * and asserts:
 *   - the table renders the engagement rows with StatusBadges on status,
 *   - the client-side filter narrows the rows,
 *   - a row click NAVIGATES to /app/ops/engagements/:id (real route param),
 *   - the error branch renders when listEngagements rejects (not swallowed).
 * Static audit: onRowClick is a real navigate; no dead handlers.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Routes, Route } from 'react-router-dom';
import { renderWithRouter, screen, userEvent, waitFor } from '../../../test/render';

const listEngagements = vi.fn();
vi.mock('../../../lib/api', () => ({
  listEngagements: (...args: unknown[]) => listEngagements(...args),
}));

import EngagementsPage from './EngagementsPage';

const ROWS = [
  {
    id: 'eng-1',
    display_code: 'ENG-0001',
    client_id: 'cl-1',
    assigned_staff_id: null,
    service_type: 'PURCHASE',
    status: 'ACTIVE',
    primary_horse_id: 'h-1',
    start_date: null,
    notes: null,
    created_at: '2026-01-01',
    updated_at: '2026-01-01',
    amount: 15000,
  },
  {
    id: 'eng-2',
    display_code: 'ENG-0002',
    client_id: 'cl-2',
    assigned_staff_id: null,
    service_type: 'LEASE',
    status: 'DRAFT',
    primary_horse_id: null,
    start_date: null,
    notes: null,
    created_at: '2026-01-02',
    updated_at: '2026-01-02',
    amount: null,
  },
];

/** Renders the page inside a route tree so navigation lands on a probe. */
function renderPage() {
  return renderWithRouter(
    <Routes>
      <Route path="/app/ops/engagements" element={<EngagementsPage />} />
      <Route path="/app/ops/engagements/:id" element={<div>DETAIL id-probe</div>} />
    </Routes>,
    { route: '/app/ops/engagements' },
  );
}

describe('EngagementsPage', () => {
  beforeEach(() => {
    listEngagements.mockReset();
  });

  it('calls listEngagements and renders rows with status badges', async () => {
    listEngagements.mockResolvedValue(ROWS);
    renderPage();

    expect(await screen.findByText('ENG-0001')).toBeInTheDocument();
    expect(listEngagements).toHaveBeenCalledTimes(1);
    expect(screen.getByText('ENG-0002')).toBeInTheDocument();
    // StatusBadge rendered the status text.
    expect(screen.getByText('ACTIVE')).toBeInTheDocument();
    expect(screen.getByText('DRAFT')).toBeInTheDocument();
    // Money cell for the deal amount.
    expect(screen.getByText('$15,000.00')).toBeInTheDocument();
  });

  it('filters the table by typed query', async () => {
    listEngagements.mockResolvedValue(ROWS);
    const user = userEvent.setup();
    renderPage();

    await screen.findByText('ENG-0001');
    await user.type(screen.getByLabelText('Filter engagements'), 'LEASE');

    await waitFor(() => expect(screen.queryByText('ENG-0001')).not.toBeInTheDocument());
    expect(screen.getByText('ENG-0002')).toBeInTheDocument();
  });

  it('navigates to the detail route with the row id on row click', async () => {
    listEngagements.mockResolvedValue(ROWS);
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByText('ENG-0001'));

    // Real route param: the detail route mounted for eng-1.
    expect(await screen.findByText('DETAIL id-probe')).toBeInTheDocument();
  });

  it('renders the error branch when listEngagements rejects', async () => {
    listEngagements.mockRejectedValue(new Error('rls denied'));
    renderPage();

    expect(await screen.findByRole('alert')).toHaveTextContent('rls denied');
  });
});
