// @vitest-environment jsdom
/**
 * OPS-DOC-VIEW — UI-interaction proof (PLATFORM_ARCHITECTURE.md §15.2).
 *
 * Renders the REAL DocumentViewerPage at `/app/ops/documents/:id`, mocking only
 * the api seam (getDocument / listSignatures). Asserts:
 *   - getDocument AND listSignatures are called with the URL param id,
 *   - the merged_body text renders (read-only),
 *   - StatusBadge shows the document status,
 *   - the signature roster renders BOTH signed and pending parties,
 *   - the sign link targets the real OPS-DOC-SIGN route,
 *   - the error branch renders when the data path rejects (errors not swallowed).
 *
 * Static dead-end audit: no editable field / input / form on this read-only
 * viewer; the sign link is a real <Link>, not a dead handler.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithRouter, screen } from '../../../test/render';
import DocumentViewerPage from './DocumentViewerPage';

const getDocument = vi.hoisted(() => vi.fn());
const listSignatures = vi.hoisted(() => vi.fn());
vi.mock('../../../lib/api', () => ({ getDocument, listSignatures }));

const DOC_ID = 'doc-42';

function stubDocument() {
  getDocument.mockResolvedValue({
    id: DOC_ID,
    display_code: 'DOC-0001',
    engagement_id: 'eng-1',
    template_id: 't1',
    title: 'Bill of Sale',
    merged_body: 'This agreement is made between Buyer Ann and Seller Bob for the horse Bella.',
    status: 'PARTIALLY_SIGNED',
    generated_at: '2026-06-01T00:00:00Z',
    effective_date: '2026-06-15',
    created_at: '2026-06-01T00:00:00Z',
    updated_at: '2026-06-01T00:00:00Z',
  });
}

function stubSignatures() {
  listSignatures.mockResolvedValue([
    {
      id: 'sig-1',
      document_id: DOC_ID,
      signer_contact_id: 'c1',
      party_role: 'BUYER',
      typed_name: 'Ann Buyer',
      signed_at: '2026-06-10T00:00:00Z',
      ip_address: '1.2.3.4',
      method: 'TYPED',
      created_at: '2026-06-01T00:00:00Z',
    },
    {
      id: 'sig-2',
      document_id: DOC_ID,
      signer_contact_id: 'c2',
      party_role: 'SELLER',
      typed_name: null,
      signed_at: null,
      ip_address: null,
      method: null,
      created_at: '2026-06-01T00:00:00Z',
    },
  ]);
}

function renderAt(id = DOC_ID) {
  return renderWithRouter(<DocumentViewerPage />, {
    route: `/app/ops/documents/${id}`,
    path: '/app/ops/documents/:id',
  });
}

describe('DocumentViewerPage (OPS-DOC-VIEW)', () => {
  beforeEach(() => {
    getDocument.mockReset();
    listSignatures.mockReset();
  });

  it('fetches by the URL id and renders body, status, and roster', async () => {
    stubDocument();
    stubSignatures();

    renderAt();

    // Real data path invoked with the URL param id.
    expect(await screen.findByText('Bill of Sale')).toBeInTheDocument();
    expect(getDocument).toHaveBeenCalledTimes(1);
    expect(getDocument).toHaveBeenCalledWith(DOC_ID);
    expect(listSignatures).toHaveBeenCalledTimes(1);
    expect(listSignatures).toHaveBeenCalledWith(DOC_ID);

    // Merged body text renders (read-only region).
    expect(
      screen.getByText(/This agreement is made between Buyer Ann and Seller Bob/),
    ).toBeInTheDocument();

    // StatusBadge shows the document status.
    expect(screen.getByText('PARTIALLY_SIGNED')).toBeInTheDocument();

    // Effective date rendered.
    expect(screen.getByText(new Date('2026-06-15').toLocaleDateString())).toBeInTheDocument();

    // Roster: a signed party and a pending party.
    expect(screen.getByText('BUYER')).toBeInTheDocument();
    expect(screen.getByText('Ann Buyer')).toBeInTheDocument();
    expect(screen.getByText('Signed')).toBeInTheDocument();
    expect(screen.getByText('SELLER')).toBeInTheDocument();
    expect(screen.getByText('Pending')).toBeInTheDocument();
  });

  it('links to the real OPS-DOC-SIGN signing panel for this document', async () => {
    stubDocument();
    stubSignatures();

    renderAt();

    const link = await screen.findByTestId('sign-link');
    expect(link).toHaveAttribute('href', `/app/ops/documents/${DOC_ID}/sign`);
  });

  it('is read-only: renders no editable field, input, textarea, or form', async () => {
    stubDocument();
    stubSignatures();

    const { container } = renderAt();
    await screen.findByText('Bill of Sale');

    expect(container.querySelector('input')).toBeNull();
    expect(container.querySelector('textarea')).toBeNull();
    expect(container.querySelector('select')).toBeNull();
    expect(container.querySelector('form')).toBeNull();
    expect(container.querySelector('[contenteditable="true"]')).toBeNull();
  });

  it('renders the error branch when the data path rejects (errors not swallowed)', async () => {
    getDocument.mockRejectedValue(new Error('RLS: not permitted'));
    listSignatures.mockRejectedValue(new Error('RLS: not permitted'));

    renderAt();

    expect(await screen.findByTestId('viewer-error')).toBeInTheDocument();
    expect(screen.getByText('Could not load document')).toBeInTheDocument();
  });
});
