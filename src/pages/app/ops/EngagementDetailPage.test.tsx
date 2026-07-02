// @vitest-environment jsdom
/**
 * OPS-ENG-LIST executable proof — detail page (PLATFORM_ARCHITECTURE.md §15).
 * Renders the REAL EngagementDetailPage at /app/ops/engagements/:id, mocks the
 * REAL data fns `getEngagement` / `listContractTemplates` / `generateDocument`,
 * and asserts:
 *   - getEngagement is called WITH THE URL id (real route param),
 *   - parties / primary horse / transaction / stages render from the rollup,
 *   - the Documents section lists the engagement's documents,
 *   - "Generate document" is a REAL button that opens the OPS-DOC-GEN modal
 *     (no dead /generate route link),
 *   - picking a template + confirming calls generateDocument(engagementId,
 *     chosenKey) and NAVIGATES to the new document's OPS-DOC-VIEW route,
 *   - a rejected generate renders the inline error, keeps the modal open, and
 *     does NOT navigate,
 *   - each document links to the OPS-DOC-VIEW route,
 *   - the error branch renders when getEngagement rejects (not swallowed),
 *   - a null result renders the not-found state.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter, Routes, Route, useParams } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import { render, renderWithRouter, screen, userEvent } from '../../../test/render';

const getEngagement = vi.fn();
const listContractTemplates = vi.fn();
const generateDocument = vi.fn();
vi.mock('../../../lib/api', () => ({
  getEngagement: (...args: unknown[]) => getEngagement(...args),
  listContractTemplates: (...args: unknown[]) => listContractTemplates(...args),
  generateDocument: (...args: unknown[]) => generateDocument(...args),
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

const TEMPLATES = [
  {
    id: 't1',
    template_key: 'purchase_agreement',
    title: 'Purchase Agreement',
    service_type: 'brokerage',
    party_namespaces: ['BUYER', 'SELLER'],
    version: 1,
    active: true,
  },
];

function renderDetail() {
  return renderWithRouter(<EngagementDetailPage />, {
    route: '/app/ops/engagements/eng-42',
    path: '/app/ops/engagements/:id',
  });
}

/** Probe standing in for OPS-DOC-VIEW so the generate → navigate handoff is
 *  provable against the REAL viewer route pattern. */
function ViewerProbe() {
  const { id } = useParams<{ id: string }>();
  return <div data-testid="viewer-probe">{id}</div>;
}

/** Mount detail + viewer routes so a successful generate really navigates. */
function renderWithViewerRoute() {
  return render(
    <HelmetProvider>
      <MemoryRouter initialEntries={['/app/ops/engagements/eng-42']}>
        <Routes>
          <Route path="/app/ops/engagements/:id" element={<EngagementDetailPage />} />
          <Route path="/app/ops/documents/:id" element={<ViewerProbe />} />
        </Routes>
      </MemoryRouter>
    </HelmetProvider>,
  );
}

describe('EngagementDetailPage', () => {
  beforeEach(() => {
    getEngagement.mockReset();
    listContractTemplates.mockReset();
    generateDocument.mockReset();
    listContractTemplates.mockResolvedValue(TEMPLATES);
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

  it('lists documents with real links to the viewer route; Generate is a button, not a dead link', async () => {
    getEngagement.mockResolvedValue(DETAIL);
    renderDetail();

    // Documents section lists the doc.
    const docLink = await screen.findByRole('link', { name: /Purchase Agreement/ });
    expect(docLink).toHaveAttribute('href', '/app/ops/documents/doc-7');

    // "Generate document" opens the inline OPS-DOC-GEN modal — the dead
    // /generate route link is gone.
    expect(screen.queryByRole('link', { name: 'Generate document' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Generate document' })).toBeInTheDocument();
  });

  it('opens the OPS-DOC-GEN modal, generates, and navigates to the new document viewer', async () => {
    const user = userEvent.setup();
    getEngagement.mockResolvedValue(DETAIL);
    generateDocument.mockResolvedValue({ document_id: 'DOC-9', merged_body: 'Merged body' });
    renderWithViewerRoute();

    // Open the modal from the Documents section.
    await user.click(await screen.findByRole('button', { name: 'Generate document' }));
    expect(await screen.findByRole('dialog')).toBeInTheDocument();

    // Templates load through the real seam.
    expect(listContractTemplates).toHaveBeenCalledTimes(1);
    await user.click(await screen.findByRole('radio', { name: /Purchase Agreement/ }));
    await user.click(screen.getByRole('button', { name: 'Generate' }));

    // The REAL rpc wrapper fired with the engagement id + chosen key, exactly.
    expect(generateDocument).toHaveBeenCalledTimes(1);
    expect(generateDocument).toHaveBeenCalledWith('eng-42', 'purchase_agreement');

    // onGenerated → navigate to the viewer route with the new document id.
    expect(await screen.findByTestId('viewer-probe')).toHaveTextContent('DOC-9');
  });

  it('rejected generate: inline error renders, modal stays open, NO navigation', async () => {
    const user = userEvent.setup();
    getEngagement.mockResolvedValue(DETAIL);
    generateDocument.mockRejectedValue(new Error('require_module: brokerage'));
    renderWithViewerRoute();

    await user.click(await screen.findByRole('button', { name: 'Generate document' }));
    await user.click(await screen.findByRole('radio', { name: /Purchase Agreement/ }));
    await user.click(screen.getByRole('button', { name: 'Generate' }));

    expect(generateDocument).toHaveBeenCalledWith('eng-42', 'purchase_agreement');

    // Error surfaced, not swallowed — and the modal stays open for retry.
    expect(await screen.findByRole('alert')).toHaveTextContent('require_module: brokerage');
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    // Still on the engagement page; no navigation happened.
    expect(screen.queryByTestId('viewer-probe')).toBeNull();
    expect(screen.getByText('ENG-0042')).toBeInTheDocument();
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
