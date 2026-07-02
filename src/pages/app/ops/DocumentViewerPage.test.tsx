// @vitest-environment jsdom
/**
 * OPS-DOC-VIEW UI-interaction proof (PLATFORM_ARCHITECTURE.md §15.2).
 *
 * Renders the REAL DocumentViewerPage at `/app/ops/documents/:id`, mocking only
 * the api seam (getDocument / listSignatures / recordSignature / listDeliveries
 * / recordDelivery). The page now HOSTS the document lifecycle inline (no
 * separate /sign route). Asserts:
 *   - getDocument AND listSignatures are called with the URL param id,
 *   - the merged_body text renders (read-only) and StatusBadge shows the status,
 *   - an unsigned/partially-signed document embeds the OPS-DOC-SIGN panel (the
 *     dead /sign link is GONE) and no delivery form is reachable,
 *   - signing the last party calls recordSignature EXACTLY, re-loads the
 *     document, and the now-EXECUTED page renders the read-only roster + the
 *     OPS-DOC-DELIVER form, through which a delivery can really be sent,
 *   - a rejected recordSignature renders the inline error, the document is NOT
 *     re-loaded, and delivery stays unreachable (RPC-error branch),
 *   - the error branch renders when the data path rejects (errors not swallowed).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithRouter, screen, userEvent } from '../../../test/render';
import DocumentViewerPage from './DocumentViewerPage';

const getDocument = vi.hoisted(() => vi.fn());
const listSignatures = vi.hoisted(() => vi.fn());
const recordSignature = vi.hoisted(() => vi.fn());
const listDeliveries = vi.hoisted(() => vi.fn());
const recordDelivery = vi.hoisted(() => vi.fn());
vi.mock('../../../lib/api', () => ({
  getDocument,
  listSignatures,
  recordSignature,
  listDeliveries,
  recordDelivery,
}));

const DOC_ID = 'doc-42';

function doc(status: string) {
  return {
    id: DOC_ID,
    display_code: 'DOC-0001',
    engagement_id: 'eng-1',
    template_id: 't1',
    title: 'Bill of Sale',
    merged_body: 'This agreement is made between Buyer Ann and Seller Bob for the horse Bella.',
    status,
    generated_at: '2026-06-01T00:00:00Z',
    effective_date: '2026-06-15',
    created_at: '2026-06-01T00:00:00Z',
    updated_at: '2026-06-01T00:00:00Z',
  };
}

function sig(
  partyRole: string,
  overrides: Partial<{ typed_name: string | null; signed_at: string | null }> = {},
) {
  return {
    id: `sig-${partyRole}`,
    document_id: DOC_ID,
    signer_contact_id: `c-${partyRole}`,
    party_role: partyRole,
    typed_name: null,
    signed_at: null,
    ip_address: null,
    method: null,
    created_at: '2026-06-01T00:00:00Z',
    ...overrides,
  };
}

const PARTIAL_ROSTER = [
  sig('BUYER', { typed_name: 'Ann Buyer', signed_at: '2026-06-10T00:00:00Z' }),
  sig('SELLER'),
];
const SEALED_ROSTER = [
  sig('BUYER', { typed_name: 'Ann Buyer', signed_at: '2026-06-10T00:00:00Z' }),
  sig('SELLER', { typed_name: 'Sam Seller', signed_at: '2026-07-01T00:00:00Z' }),
];

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
    recordSignature.mockReset();
    listDeliveries.mockReset();
    recordDelivery.mockReset();
    listDeliveries.mockResolvedValue([]);
  });

  it('fetches by the URL id and renders body, status, and the embedded signing roster', async () => {
    getDocument.mockResolvedValue(doc('PARTIALLY_SIGNED'));
    listSignatures.mockResolvedValue(PARTIAL_ROSTER);

    renderAt();

    // Real data path invoked with the URL param id.
    expect(await screen.findByText('Bill of Sale')).toBeInTheDocument();
    expect(getDocument).toHaveBeenCalledTimes(1);
    expect(getDocument).toHaveBeenCalledWith(DOC_ID);
    expect(listSignatures).toHaveBeenCalledWith(DOC_ID);

    // Merged body text renders (read-only region).
    expect(
      screen.getByText(/This agreement is made between Buyer Ann and Seller Bob/),
    ).toBeInTheDocument();

    // StatusBadge shows the document status.
    expect(screen.getByText('PARTIALLY_SIGNED')).toBeInTheDocument();

    // Effective date rendered.
    expect(screen.getByText(new Date('2026-06-15').toLocaleDateString())).toBeInTheDocument();

    // Embedded OPS-DOC-SIGN roster: sealed BUYER row + pending SELLER row.
    expect(await screen.findByTestId('signing-panel')).toBeInTheDocument();
    expect(screen.getByTestId('signed-name-BUYER')).toHaveTextContent('Ann Buyer');
    expect(screen.getByText('Signed')).toBeInTheDocument();
    expect(screen.getByText('Awaiting signature')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sign as SELLER' })).toBeInTheDocument();
  });

  it('has NO dead /sign link and NO delivery form while the document is unsigned', async () => {
    getDocument.mockResolvedValue(doc('PARTIALLY_SIGNED'));
    listSignatures.mockResolvedValue(PARTIAL_ROSTER);

    renderAt();
    await screen.findByTestId('signing-panel');

    // The old dead-route link is gone — signing lives on this page.
    expect(screen.queryByTestId('sign-link')).toBeNull();
    expect(screen.queryByRole('link', { name: /signing/i })).toBeNull();
    // Delivery is gated behind EXECUTED: no send form yet.
    expect(screen.queryByRole('button', { name: 'Send delivery' })).toBeNull();
  });

  it('signs the last party → document re-loads EXECUTED → delivery form appears and sends', async () => {
    const user = userEvent.setup();
    // Document: partially signed first, EXECUTED after the re-load.
    getDocument.mockResolvedValueOnce(doc('PARTIALLY_SIGNED')).mockResolvedValue(doc('EXECUTED'));
    // Roster: page load + panel load see the partial roster; the post-sign
    // refresh (and the page re-load) see everyone sealed.
    listSignatures
      .mockResolvedValueOnce(PARTIAL_ROSTER)
      .mockResolvedValueOnce(PARTIAL_ROSTER)
      .mockResolvedValue(SEALED_ROSTER);
    recordSignature.mockResolvedValue(undefined);
    recordDelivery.mockResolvedValue({
      id: 'del-1',
      document_id: DOC_ID,
      recipient_contact_id: 'contact-7',
      channel: 'EMAIL',
      copy_url: null,
      delivered_at: '2026-07-01T00:00:00Z',
      created_at: '2026-07-01T00:00:00Z',
    });

    renderAt();
    await screen.findByRole('button', { name: 'Sign as SELLER' });

    // Facilitate the last party's signature.
    await user.type(screen.getByLabelText('Signer name for SELLER'), 'Sam Seller');
    await user.click(screen.getByRole('button', { name: 'Sign as SELLER' }));

    // The REAL rpc wrapper fired exactly once with this row's own role.
    expect(recordSignature).toHaveBeenCalledTimes(1);
    expect(recordSignature).toHaveBeenCalledWith(DOC_ID, 'SELLER', 'Sam Seller');

    // onExecuted re-ran the document load → EXECUTED status renders...
    expect(await screen.findByText('EXECUTED')).toBeInTheDocument();
    expect(getDocument).toHaveBeenCalledTimes(2);

    // ...the roster is now read-only (no Sign controls)...
    expect(screen.queryByRole('button', { name: /^Sign as/ })).toBeNull();

    // ...and the OPS-DOC-DELIVER form is reachable and really sends.
    await user.type(await screen.findByLabelText(/Recipient/), 'contact-7');
    await user.click(screen.getByRole('button', { name: 'Send delivery' }));
    expect(recordDelivery).toHaveBeenCalledTimes(1);
    expect(recordDelivery).toHaveBeenCalledWith({
      document_id: DOC_ID,
      channel: 'EMAIL',
      recipient_contact_id: 'contact-7',
    });
    const row = await screen.findByTestId('delivery-row');
    expect(row).toHaveTextContent('contact-7');
  });

  it('rejected recordSignature: inline error renders, document NOT re-loaded, delivery unreachable', async () => {
    const user = userEvent.setup();
    getDocument.mockResolvedValue(doc('PARTIALLY_SIGNED'));
    listSignatures.mockResolvedValue(PARTIAL_ROSTER);
    recordSignature.mockRejectedValue(new Error('RLS: not permitted to sign'));

    renderAt();
    await screen.findByRole('button', { name: 'Sign as SELLER' });

    await user.type(screen.getByLabelText('Signer name for SELLER'), 'Sam Seller');
    await user.click(screen.getByRole('button', { name: 'Sign as SELLER' }));

    expect(recordSignature).toHaveBeenCalledWith(DOC_ID, 'SELLER', 'Sam Seller');

    // Error surfaced, not swallowed; the row stays unsigned.
    expect(await screen.findByRole('alert')).toHaveTextContent('RLS: not permitted to sign');
    expect(screen.getByRole('button', { name: 'Sign as SELLER' })).toBeInTheDocument();

    // The document was NOT re-loaded and delivery stays gated off.
    expect(getDocument).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('button', { name: 'Send delivery' })).toBeNull();
  });

  it('an already-EXECUTED document renders the read-only roster + delivery panel directly', async () => {
    getDocument.mockResolvedValue(doc('EXECUTED'));
    listSignatures.mockResolvedValue(SEALED_ROSTER);

    renderAt();

    expect(await screen.findByText('Bill of Sale')).toBeInTheDocument();

    // Read-only roster (DataTable), no signing controls at all.
    expect(screen.getByText('Signatures')).toBeInTheDocument();
    expect(screen.getAllByText('Signed')).toHaveLength(2);
    expect(screen.queryByTestId('signing-panel')).toBeNull();
    expect(screen.queryByRole('button', { name: /^Sign as/ })).toBeNull();

    // Delivery panel mounted with its send form (log loaded via the real seam).
    expect(listDeliveries).toHaveBeenCalledWith(DOC_ID);
    expect(await screen.findByRole('button', { name: 'Send delivery' })).toBeInTheDocument();
  });

  it('renders the error branch when the data path rejects (errors not swallowed)', async () => {
    getDocument.mockRejectedValue(new Error('RLS: not permitted'));
    listSignatures.mockRejectedValue(new Error('RLS: not permitted'));

    renderAt();

    expect(await screen.findByTestId('viewer-error')).toBeInTheDocument();
    expect(screen.getByText('Could not load document')).toBeInTheDocument();
  });
});
