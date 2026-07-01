// @vitest-environment jsdom
/**
 * OPS-DOC-SIGN UI-interaction test (PLATFORM_ARCHITECTURE.md §15).
 *
 * Renders the REAL SigningPanel + SignPartyRow, mocks the REAL data seam
 * (listSignatures → roster; recordSignature → sealed/status), and proves the
 * staff-facilitated multi-party signing wiring end to end:
 *   - the roster renders one row per party (unsigned rows expose a name input +
 *     Sign button; sealed rows are read-only),
 *   - typing a name for a party and clicking Sign calls
 *     recordSignature(documentId, THAT party_role, typed_name) EXACTLY — each
 *     Sign button is bound to its OWN role (no shared-role bug),
 *   - after a successful sign the roster refreshes and that row re-renders sealed,
 *   - signing the LAST required party resolves to an all-signed roster → the
 *     document is EXECUTED and the executed banner + onExecuted fire,
 *   - a rejected sign renders the inline error branch and the row STAYS unsigned
 *     (no false "signed" state — the roster is only refreshed on success),
 *   - the Sign control is disabled until a non-empty name is typed (no no-op
 *     blank signature is ever sealed).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithRouter, screen, userEvent, waitFor } from '../../../test/render';

// Mock the real api module — the exact fns the panel imports + calls.
vi.mock('../../../lib/api', () => ({
  recordSignature: vi.fn(),
  listSignatures: vi.fn(),
}));

import { recordSignature, listSignatures } from '../../../lib/api';
import { SigningPanel } from './SigningPanel';
import type { Signature } from '../../../lib/ops/types';

const recordMock = vi.mocked(recordSignature);
const listMock = vi.mocked(listSignatures);

const DOC_ID = 'DOC-1';

function sig(
  partyRole: Signature['party_role'],
  overrides: Partial<Signature> = {},
): Signature {
  return {
    id: `sig-${partyRole}`,
    document_id: DOC_ID,
    signer_contact_id: `c-${partyRole}`,
    party_role: partyRole,
    typed_name: null,
    signed_at: null,
    ip_address: null,
    method: null,
    created_at: '2026-07-01T00:00:00Z',
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('SigningPanel (OPS-DOC-SIGN)', () => {
  it('renders one Sign control per unsigned party role', async () => {
    listMock.mockResolvedValue([sig('BUYER'), sig('SELLER')]);

    renderWithRouter(<SigningPanel documentId={DOC_ID} />);

    expect(await screen.findByRole('button', { name: 'Sign as BUYER' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sign as SELLER' })).toBeInTheDocument();
    expect(listMock).toHaveBeenCalledWith(DOC_ID);
  });

  it('keeps Sign disabled until a non-empty name is typed (no blank signature)', async () => {
    const user = userEvent.setup();
    listMock.mockResolvedValue([sig('BUYER'), sig('SELLER')]);

    renderWithRouter(<SigningPanel documentId={DOC_ID} />);
    const buyerSign = await screen.findByRole('button', { name: 'Sign as BUYER' });
    expect(buyerSign).toBeDisabled();

    await user.type(screen.getByLabelText('Signer name for BUYER'), 'Jane Buyer');
    expect(buyerSign).toBeEnabled();
    expect(recordMock).not.toHaveBeenCalled();
  });

  it('signs a party → recordSignature(documentId, THAT role, typed_name) EXACTLY; row re-renders sealed', async () => {
    const user = userEvent.setup();
    // initial load: both unsigned; refresh after BUYER signs: BUYER sealed, SELLER still open.
    listMock
      .mockResolvedValueOnce([sig('BUYER'), sig('SELLER')])
      .mockResolvedValueOnce([
        sig('BUYER', { typed_name: 'Jane Buyer', signed_at: '2026-07-01T01:00:00Z' }),
        sig('SELLER'),
      ]);
    // record_signature returns the resulting doc status server-side; the wrapper
    // is void — the roster refresh is the panel's source of truth.
    recordMock.mockResolvedValue();

    renderWithRouter(<SigningPanel documentId={DOC_ID} />);
    await screen.findByRole('button', { name: 'Sign as BUYER' });

    await user.type(screen.getByLabelText('Signer name for BUYER'), 'Jane Buyer');
    await user.click(screen.getByRole('button', { name: 'Sign as BUYER' }));

    // The BUYER button is wired to the BUYER role — exact args, exactly once.
    expect(recordMock).toHaveBeenCalledTimes(1);
    expect(recordMock).toHaveBeenCalledWith(DOC_ID, 'BUYER', 'Jane Buyer');

    // Roster refreshed → BUYER row now sealed, SELLER still awaiting.
    expect(await screen.findByTestId('signed-name-BUYER')).toHaveTextContent('Jane Buyer');
    expect(screen.getByRole('button', { name: 'Sign as SELLER' })).toBeInTheDocument();
    // Not yet executed — one party still open.
    expect(screen.queryByTestId('executed-banner')).not.toBeInTheDocument();
  });

  it('each Sign button is bound to its OWN role (no shared-role bug)', async () => {
    const user = userEvent.setup();
    listMock
      .mockResolvedValueOnce([sig('BUYER'), sig('SELLER')])
      .mockResolvedValueOnce([
        sig('BUYER'),
        sig('SELLER', { typed_name: 'Sam Seller', signed_at: '2026-07-01T01:00:00Z' }),
      ]);
    recordMock.mockResolvedValue();

    renderWithRouter(<SigningPanel documentId={DOC_ID} />);
    await screen.findByRole('button', { name: 'Sign as SELLER' });

    // Type into the SELLER field and click the SELLER button.
    await user.type(screen.getByLabelText('Signer name for SELLER'), 'Sam Seller');
    await user.click(screen.getByRole('button', { name: 'Sign as SELLER' }));

    // The SELLER role — NOT the first (BUYER) row — is what got sent.
    expect(recordMock).toHaveBeenCalledTimes(1);
    expect(recordMock).toHaveBeenCalledWith(DOC_ID, 'SELLER', 'Sam Seller');
  });

  it('last required party signs → EXECUTED: banner renders + onExecuted fires', async () => {
    const user = userEvent.setup();
    const onExecuted = vi.fn();
    // initial: BUYER already sealed, SELLER open; refresh: BOTH sealed → EXECUTED.
    listMock
      .mockResolvedValueOnce([
        sig('BUYER', { typed_name: 'Jane Buyer', signed_at: '2026-07-01T00:30:00Z' }),
        sig('SELLER'),
      ])
      .mockResolvedValueOnce([
        sig('BUYER', { typed_name: 'Jane Buyer', signed_at: '2026-07-01T00:30:00Z' }),
        sig('SELLER', { typed_name: 'Sam Seller', signed_at: '2026-07-01T01:00:00Z' }),
      ]);
    recordMock.mockResolvedValue();

    renderWithRouter(<SigningPanel documentId={DOC_ID} onExecuted={onExecuted} />);
    await screen.findByRole('button', { name: 'Sign as SELLER' });
    // Not executed while a party is still open.
    expect(screen.queryByTestId('executed-banner')).not.toBeInTheDocument();

    await user.type(screen.getByLabelText('Signer name for SELLER'), 'Sam Seller');
    await user.click(screen.getByRole('button', { name: 'Sign as SELLER' }));

    expect(recordMock).toHaveBeenCalledWith(DOC_ID, 'SELLER', 'Sam Seller');

    // The document flipped to EXECUTED — banner + status render, callback fired.
    expect(await screen.findByTestId('executed-banner')).toBeInTheDocument();
    expect(onExecuted).toHaveBeenCalledTimes(1);
  });

  it('rejected sign → inline error branch renders and the row STAYS unsigned', async () => {
    const user = userEvent.setup();
    listMock.mockResolvedValue([sig('BUYER'), sig('SELLER')]);
    recordMock.mockRejectedValueOnce(new Error('RLS: not permitted to sign'));

    renderWithRouter(<SigningPanel documentId={DOC_ID} />);
    await screen.findByRole('button', { name: 'Sign as BUYER' });

    await user.type(screen.getByLabelText('Signer name for BUYER'), 'Jane Buyer');
    await user.click(screen.getByRole('button', { name: 'Sign as BUYER' }));

    expect(recordMock).toHaveBeenCalledWith(DOC_ID, 'BUYER', 'Jane Buyer');

    // Error is surfaced, not swallowed.
    expect(await screen.findByRole('alert')).toHaveTextContent('RLS: not permitted to sign');
    // The row stayed unsigned: the Sign control is still there, no sealed state,
    // and the roster was NOT refreshed (only the initial load happened).
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Sign as BUYER' })).toBeInTheDocument(),
    );
    expect(screen.queryByTestId('signed-name-BUYER')).not.toBeInTheDocument();
    expect(listMock).toHaveBeenCalledTimes(1);
  });
});
