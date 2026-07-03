// @vitest-environment jsdom
/**
 * OPS-DOC-DELIVER UI-interaction test (PLATFORM_ARCHITECTURE.md §15).
 *
 * Renders the REAL DeliveryPanel, mocks the REAL data fns
 * (listDeliveries → [rows], recordDelivery → row,
 * listEngagementPartyContacts → parties), and proves the wiring:
 *   - the recipient control is a DROPDOWN of the engagement's parties labeled
 *     "First Last — role (email | 'no email')" (name canon: contactName) —
 *     the raw contact-id text input is GONE,
 *   - for an EXECUTED document, submitting the send form calls
 *     recordDelivery({ document_id, channel, recipient_contact_id }) EXACTLY,
 *   - the success branch prepends the sent row to the log (SENT status shown),
 *   - a recipient with NO email disables the send button and shows a hint,
 *   - "Email all parties + company copy" POSTs /api/deliver-document
 *     { documentId } and renders the {delivered.length, companyNotified}
 *     result inline,
 *   - for a DRAFT document the send control is ABSENT (delivery gated on
 *     EXECUTED — recordDelivery never fires on an unsigned contract),
 *   - the error branch renders on rejection and nothing is logged.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderWithRouter, screen, userEvent, waitFor } from '../../../test/render';

vi.mock('../../../lib/api', () => ({
  listDeliveries: vi.fn(),
  recordDelivery: vi.fn(),
}));
vi.mock('../../../lib/ops/api-documents', () => ({
  listEngagementPartyContacts: vi.fn(),
}));

import { listDeliveries, recordDelivery } from '../../../lib/api';
import { listEngagementPartyContacts } from '../../../lib/ops/api-documents';
import { DeliveryPanel } from './DeliveryPanel';
import type { DocumentDelivery, EngagementPartyContact } from '../../../lib/ops/types';

const listMock = vi.mocked(listDeliveries);
const recordMock = vi.mocked(recordDelivery);
const partiesMock = vi.mocked(listEngagementPartyContacts);

const DOC_ID = 'doc-42';
const ENG_ID = 'eng-1';

/* Name canon: contactName(first,last) → "First Last" (owner directive
 * 2026-07-02 — contacts carry first/last only). */
const PARTIES: EngagementPartyContact[] = [
  { contact_id: 'contact-7', party_role: 'BUYER', name: 'Ann Buyer', email: 'ann@fhe.test' },
  { contact_id: 'contact-8', party_role: 'SELLER', name: 'Sam Seller', email: null },
];

const NEW_ROW: DocumentDelivery = {
  id: 'del-1',
  document_id: DOC_ID,
  recipient_contact_id: 'contact-7',
  channel: 'EMAIL',
  copy_url: null,
  delivered_at: '2026-07-01T00:00:00Z',
  created_at: '2026-07-01T00:00:00Z',
};

function renderPanel(status = 'EXECUTED') {
  return renderWithRouter(
    <DeliveryPanel documentId={DOC_ID} engagementId={ENG_ID} status={status} />,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  listMock.mockResolvedValue([]);
  recordMock.mockResolvedValue(NEW_ROW);
  partiesMock.mockResolvedValue(PARTIES);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('DeliveryPanel (OPS-DOC-DELIVER)', () => {
  it('loads the delivery log for the document on mount', async () => {
    renderPanel();
    await waitFor(() => expect(listMock).toHaveBeenCalledWith(DOC_ID));
    expect(await screen.findByText('No deliveries yet')).toBeInTheDocument();
  });

  it('recipient is a dropdown of the engagement parties (name canon) — no raw-id input', async () => {
    renderPanel();
    await waitFor(() => expect(partiesMock).toHaveBeenCalledWith(ENG_ID));

    // Dropdown options: "First Last — role (email | 'no email')".
    const select = screen.getByLabelText(/Recipient/);
    expect(select.tagName).toBe('SELECT');
    expect(
      await screen.findByRole('option', { name: 'Ann Buyer — BUYER (ann@fhe.test)' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('option', { name: 'Sam Seller — SELLER (no email)' }),
    ).toBeInTheDocument();

    // The raw contact-id text input is gone.
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(screen.queryByPlaceholderText(/contact id/i)).not.toBeInTheDocument();
  });

  it('EXECUTED doc: submitting sends recordDelivery({document_id,channel,recipient}) EXACTLY, then logs the row', async () => {
    const user = userEvent.setup();
    renderPanel();
    await screen.findByText('No deliveries yet');
    await screen.findByRole('option', { name: 'Ann Buyer — BUYER (ann@fhe.test)' });

    await user.selectOptions(screen.getByLabelText('Channel'), 'EMAIL');
    await user.selectOptions(screen.getByLabelText(/Recipient/), 'contact-7');
    await user.click(screen.getByRole('button', { name: 'Send delivery' }));

    // The REAL data fn was called with EXACTLY the delivery payload.
    expect(recordMock).toHaveBeenCalledTimes(1);
    expect(recordMock).toHaveBeenCalledWith({
      document_id: DOC_ID,
      channel: 'EMAIL',
      recipient_contact_id: 'contact-7',
    });

    // Success branch: the sent row now appears in the log with SENT status.
    const row = await screen.findByTestId('delivery-row');
    expect(row).toHaveTextContent('EMAIL');
    expect(row).toHaveTextContent('contact-7');
    expect(row).toHaveTextContent('SENT');
  });

  it('a recipient with no email disables the send button and shows a hint', async () => {
    const user = userEvent.setup();
    renderPanel();
    await screen.findByRole('option', { name: 'Sam Seller — SELLER (no email)' });

    await user.selectOptions(screen.getByLabelText(/Recipient/), 'contact-8');

    const button = screen.getByRole('button', { name: 'Send delivery' });
    expect(button).toBeDisabled();
    expect(screen.getByTestId('no-email-hint')).toHaveTextContent(/no email address on file/);
    expect(recordMock).not.toHaveBeenCalled();

    // Picking a recipient WITH an email re-enables the button.
    await user.selectOptions(screen.getByLabelText(/Recipient/), 'contact-7');
    expect(screen.getByRole('button', { name: 'Send delivery' })).toBeEnabled();
  });

  it('"Email all parties + company copy" POSTs /api/deliver-document and renders the result', async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        delivered: [
          { recipientContactId: 'contact-7', channel: 'EMAIL', emailed: true },
          { recipientContactId: 'contact-9', channel: 'EMAIL', emailed: true },
        ],
        companyNotified: true,
        status: 'EXECUTED',
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    renderPanel();
    await screen.findByText('No deliveries yet');

    await user.click(screen.getByRole('button', { name: 'Email all parties + company copy' }));

    // The endpoint was hit with EXACTLY { documentId }.
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith('/api/deliver-document', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ documentId: DOC_ID }),
    });

    // {delivered.length, companyNotified} surfaced inline.
    const note = await screen.findByTestId('deliver-all-result');
    expect(note).toHaveTextContent('Emailed 2 recipients.');
    expect(note).toHaveTextContent('Company copy sent.');

    // The endpoint records deliveries itself — the log is re-listed.
    await waitFor(() => expect(listMock).toHaveBeenCalledTimes(2));
  });

  it('"Email all parties" surfaces the endpoint error branch', async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 409,
        json: async () => ({ error: 'document not EXECUTED (status=DRAFT)' }),
      }),
    );

    renderPanel();
    await screen.findByText('No deliveries yet');
    await user.click(screen.getByRole('button', { name: 'Email all parties + company copy' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'document not EXECUTED (status=DRAFT)',
    );
    expect(screen.queryByTestId('deliver-all-result')).not.toBeInTheDocument();
  });

  it('DRAFT doc: the send control is absent — delivery gated on EXECUTED', async () => {
    renderPanel('DRAFT');
    await waitFor(() => expect(listMock).toHaveBeenCalledWith(DOC_ID));

    expect(screen.queryByRole('button', { name: 'Send delivery' })).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Email all parties + company copy' }),
    ).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Recipient/)).not.toBeInTheDocument();
    expect(recordMock).not.toHaveBeenCalled();
    // The parties roster is never fetched for a gated document.
    expect(partiesMock).not.toHaveBeenCalled();
    // A gated notice is shown instead.
    expect(screen.getByRole('status')).toHaveTextContent(/available once the document is EXECUTED/);
  });

  it('renders the error branch on rejection and logs nothing', async () => {
    const user = userEvent.setup();
    recordMock.mockRejectedValueOnce(new Error('new row violates row-level security'));
    renderPanel();
    await screen.findByText('No deliveries yet');
    await screen.findByRole('option', { name: 'Ann Buyer — BUYER (ann@fhe.test)' });

    await user.selectOptions(screen.getByLabelText(/Recipient/), 'contact-7');
    await user.click(screen.getByRole('button', { name: 'Send delivery' }));

    expect(recordMock).toHaveBeenCalledWith({
      document_id: DOC_ID,
      channel: 'EMAIL',
      recipient_contact_id: 'contact-7',
    });
    // Error surfaced, not swallowed...
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'new row violates row-level security',
    );
    // ...and nothing was logged.
    expect(screen.queryByTestId('delivery-row')).not.toBeInTheDocument();
    expect(screen.getByText('No deliveries yet')).toBeInTheDocument();
  });

  it('does not fire recordDelivery when no recipient is selected (required)', async () => {
    const user = userEvent.setup();
    renderPanel();
    await screen.findByText('No deliveries yet');

    await user.click(screen.getByRole('button', { name: 'Send delivery' }));

    expect(recordMock).not.toHaveBeenCalled();
    expect(screen.getByText('A recipient is required.')).toBeInTheDocument();
  });
});
