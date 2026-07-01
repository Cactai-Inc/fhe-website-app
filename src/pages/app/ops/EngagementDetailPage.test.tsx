// @vitest-environment jsdom
/**
 * OPS-ENG-LIST executable proof — detail page (PLATFORM_ARCHITECTURE.md §15).
 * Renders the REAL EngagementDetailPage at /app/ops/engagements/:id, mocks the
 * REAL data fn `getEngagement`, and asserts:
 *   - getEngagement is called WITH THE URL id (real route param),
 *   - parties / primary horse / transaction / stages render from the rollup,
 *   - the Documents section lists the engagement's documents,
 *   - "Generate document" is a REAL link to the OPS-DOC-GEN route,
 *   - each document links to the OPS-DOC-VIEW route,
 *   - the error branch renders when getEngagement rejects (not swallowed),
 *   - a null result renders the not-found state.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithRouter, screen } from '../../../test/render';

const getEngagement = vi.fn();
vi.mock('../../../lib/api', () => ({
  getEngagement: (...args: unknown[]) => getEngagement(...args),
}));

import EngagementDetailPage from './EngagementDetailPage';

const DETAIL = {
  id: 'eng-42',
  display_code: 'ENG-0042',
  client_id: 'CLIENT-CODE',
  assigned_staff_id: 'STAFF-CODE',
  service_type: 'PURCHASE',
  status: 'ACTIVE',
  primary_horse_id: 'HORSE-CODE',
  start_date: null,
  notes: null,
  created_at: '2026-01-01',
  updated_at: '2026-01-01',
  stages: [
    {
      id: 'st-1',
      engagement_id: 'eng-42',
      stage: 'TRANSACTION_REP',
      retained_by: 'buyer',
      deal_side: 'BUY',
      status: 'OPEN',
      fee_value_key: null,
      effective_from: '2026-01-01',
      created_at: '2026-01-01',
      updated_at: '2026-01-01',
    },
  ],
  documents: [
    {
      id: 'doc-7',
      display_code: 'DOC-0007',
      engagement_id: 'eng-42',
      template_id: null,
      title: 'Purchase Agreement',
      merged_body: null,
      status: 'DRAFT',
      generated_at: '2026-01-01',
      effective_date: null,
      created_at: '2026-01-01',
      updated_at: '2026-01-01',
    },
  ],
  transactions: [
    {
      id: 'txn-1',
      display_code: 'TXN-0001',
      engagement_id: 'eng-42',
      txn_type: 'PURCHASE',
      amount: 25000,
      deposit_amount: 5000,
      status: 'PENDING',
      created_at: '2026-01-01',
      updated_at: '2026-01-01',
    },
  ],
};

function renderDetail() {
  return renderWithRouter(<EngagementDetailPage />, {
    route: '/app/ops/engagements/eng-42',
    path: '/app/ops/engagements/:id',
  });
}

describe('EngagementDetailPage', () => {
  beforeEach(() => {
    getEngagement.mockReset();
  });

  it('calls getEngagement with the URL id and renders parties/horse/txn/stages', async () => {
    getEngagement.mockResolvedValue(DETAIL);
    renderDetail();

    expect(await screen.findByText('ENG-0042')).toBeInTheDocument();
    // Called with the real route param.
    expect(getEngagement).toHaveBeenCalledTimes(1);
    expect(getEngagement).toHaveBeenCalledWith('eng-42');

    // Parties / horse.
    expect(screen.getByText('CLIENT-CODE')).toBeInTheDocument();
    expect(screen.getByText('STAFF-CODE')).toBeInTheDocument();
    expect(screen.getByText('HORSE-CODE')).toBeInTheDocument();
    // Transaction rollup (Money-formatted amount).
    expect(screen.getByText('$25,000.00')).toBeInTheDocument();
    expect(screen.getByText('$5,000.00')).toBeInTheDocument();
    // Stage.
    expect(screen.getByText('TRANSACTION_REP')).toBeInTheDocument();
  });

  it('lists documents with real links to the generate + viewer routes', async () => {
    getEngagement.mockResolvedValue(DETAIL);
    renderDetail();

    // Documents section lists the doc.
    const docLink = await screen.findByRole('link', { name: /Purchase Agreement/ });
    expect(docLink).toHaveAttribute('href', '/app/ops/documents/doc-7');

    // "Generate document" is a real link to OPS-DOC-GEN.
    const genLink = screen.getByRole('link', { name: 'Generate document' });
    expect(genLink).toHaveAttribute('href', '/app/ops/engagements/eng-42/generate');
  });

  it('renders the not-found state when getEngagement returns null', async () => {
    getEngagement.mockResolvedValue(null);
    renderDetail();

    expect(await screen.findByText('Engagement not found')).toBeInTheDocument();
  });

  it('renders the error branch when getEngagement rejects', async () => {
    getEngagement.mockRejectedValue(new Error('rls denied'));
    renderDetail();

    expect(await screen.findByRole('alert')).toHaveTextContent('rls denied');
  });
});
