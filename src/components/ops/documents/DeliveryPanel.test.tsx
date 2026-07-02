// @vitest-environment jsdom
/**
 * OPS-DOC-DELIVER UI-interaction test (PLATFORM_ARCHITECTURE.md §15).
 *
 * Renders the REAL DeliveryPanel, mocks the REAL data fns
 * (listDeliveries → [rows], recordDelivery → row), and proves the wiring:
 *   - for an EXECUTED document, submitting the send form calls
 *     recordDelivery({ document_id, channel, recipient_contact_id }) EXACTLY,
 *   - the success branch prepends the sent row to the log (SENT status shown),
 *   - for a DRAFT document the send control is ABSENT (delivery gated on
 *     EXECUTED — recordDelivery never fires on an unsigned contract),
 *   - the error branch renders on rejection and nothing is logged.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithRouter, screen, userEvent, waitFor } from '../../../test/render';

vi.mock('../../../lib/api', () => ({
  listDeliveries: vi.fn(),
  recordDelivery: vi.fn(),
}));

import { listDeliveries, recordDelivery } from '../../../lib/api';
import { DeliveryPanel } from './DeliveryPanel';
import type { DocumentDelivery } from '../../../lib/ops/types';

const listMock = vi.mocked(listDeliveries);
const recordMock = vi.mocked(recordDelivery);

const DOC_ID = 'doc-42';

const NEW_ROW: DocumentDelivery = {
  id: 'del-1',
  document_id: DOC_ID,
  recipient_contact_id: 'contact-7',
  channel: 'EMAIL',
  copy_url: null,
  delivered_at: '2026-07-01T00:00:00Z',
  created_at: '2026-07-01T00:00:00Z',
};

beforeEach(() => {
  vi.clearAllMocks();
  listMock.mockResolvedValue([]);
  recordMock.mockResolvedValue(NEW_ROW);
});

describe('DeliveryPanel (OPS-DOC-DELIVER)', () => {
  it('loads the delivery log for the document on mount', async () => {
    renderWithRouter(<DeliveryPanel documentId={DOC_ID} status="EXECUTED" />);
    await waitFor(() => expect(listMock).toHaveBeenCalledWith(DOC_ID));
    expect(await screen.findByText('No deliveries yet')).toBeInTheDocument();
  });

  it('EXECUTED doc: submitting sends recordDelivery({document_id,channel,recipient}) EXACTLY, then logs the row', async () => {
    const user = userEvent.setup();
    renderWithRouter(<DeliveryPanel documentId={DOC_ID} status="EXECUTED" />);
    await screen.findByText('No deliveries yet');

    await user.selectOptions(screen.getByLabelText('Channel'), 'EMAIL');
    await user.type(screen.getByLabelText(/Recipient/), 'contact-7');
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

  it('DRAFT doc: the send control is absent — delivery gated on EXECUTED', async () => {
    renderWithRouter(<DeliveryPanel documentId={DOC_ID} status="DRAFT" />);
    await waitFor(() => expect(listMock).toHaveBeenCalledWith(DOC_ID));

    expect(screen.queryByRole('button', { name: 'Send delivery' })).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Recipient/)).not.toBeInTheDocument();
    expect(recordMock).not.toHaveBeenCalled();
    // A gated notice is shown instead.
    expect(screen.getByRole('status')).toHaveTextContent(/available once the document is EXECUTED/);
  });

  it('renders the error branch on rejection and logs nothing', async () => {
    const user = userEvent.setup();
    recordMock.mockRejectedValueOnce(new Error('new row violates row-level security'));
    renderWithRouter(<DeliveryPanel documentId={DOC_ID} status="EXECUTED" />);
    await screen.findByText('No deliveries yet');

    await user.type(screen.getByLabelText(/Recipient/), 'contact-7');
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

  it('does not fire recordDelivery when the recipient is empty (required)', async () => {
    const user = userEvent.setup();
    renderWithRouter(<DeliveryPanel documentId={DOC_ID} status="EXECUTED" />);
    await screen.findByText('No deliveries yet');

    await user.click(screen.getByRole('button', { name: 'Send delivery' }));

    expect(recordMock).not.toHaveBeenCalled();
    expect(screen.getByText('A recipient is required.')).toBeInTheDocument();
  });
});
