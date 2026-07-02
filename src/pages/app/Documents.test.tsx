// @vitest-environment jsdom
/**
 * MEMBER self-signing on Documents (lane 1, Wiring & Verification Contract §15).
 *
 * Renders the REAL Documents page with the REAL data seams mocked and proves:
 *  - contracts where the member is a signer party render in the self-sign
 *    section alongside the existing order documents,
 *  - typing a name and signing calls signMyDocument with the EXACT
 *    (documentId, party_role, typed_name) and refreshes the list to sealed,
 *  - the Sign button stays disabled until a non-empty name is typed,
 *  - a rejected sign (e.g. the RPC's "not authorized" authz error) renders the
 *    inline error and the row stays unsigned,
 *  - with no signable contracts the section does not render at all.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithRouter, screen, userEvent, waitFor } from '../../test/render';

vi.mock('../../lib/api', () => ({ fetchMyDocuments: vi.fn() }));
vi.mock('../../lib/ops/api-client', () => ({
  listMySignableDocuments: vi.fn(),
  signMyDocument: vi.fn(),
}));

import { fetchMyDocuments } from '../../lib/api';
import { listMySignableDocuments, signMyDocument } from '../../lib/ops/api-client';
import type { SignableDocument } from '../../lib/ops/api-client';
import Documents from './Documents';

const DOC = {
  id: 'doc-1', display_code: 'DOC-000001', engagement_id: 'eng-1', template_id: 'tpl-1',
  title: 'Horse Purchase and Sale Agreement', merged_body: null, status: 'DRAFT',
  generated_at: '2026-07-01T00:00:00Z', effective_date: null, created_at: '', updated_at: '',
};
const SIGNABLE: SignableDocument = { document: DOC, party_role: 'BUYER', signed: false };
const SEALED: SignableDocument = { document: DOC, party_role: 'BUYER', signed: true };

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(fetchMyDocuments).mockResolvedValue([]);
  vi.mocked(listMySignableDocuments).mockResolvedValue([SIGNABLE]);
});

describe('Documents — member self-signing', () => {
  it('renders the contract awaiting the member\'s signature', async () => {
    renderWithRouter(<Documents />);
    expect(await screen.findByText('Horse Purchase and Sale Agreement')).toBeInTheDocument();
    expect(screen.getByText('Contracts awaiting your signature')).toBeInTheDocument();
    expect(screen.getByText(/you sign as buyer/i)).toBeInTheDocument();
  });

  it('signs with the exact (doc, role, name) and re-renders sealed after refresh', async () => {
    vi.mocked(signMyDocument).mockResolvedValue(undefined);
    renderWithRouter(<Documents />);
    await screen.findByText('Horse Purchase and Sale Agreement');

    // second load (post-sign refresh) returns the sealed row
    vi.mocked(listMySignableDocuments).mockResolvedValue([SEALED]);

    await userEvent.type(screen.getByLabelText(/type your full legal name/i), 'Alice Client');
    await userEvent.click(screen.getByRole('button', { name: /^sign$/i }));

    await waitFor(() =>
      expect(signMyDocument).toHaveBeenCalledWith('doc-1', 'BUYER', 'Alice Client'));
    expect(await screen.findByText(/you've signed this document/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^sign$/i })).not.toBeInTheDocument();
  });

  it('keeps Sign disabled until a non-empty name is typed', async () => {
    renderWithRouter(<Documents />);
    await screen.findByText('Horse Purchase and Sale Agreement');
    const button = screen.getByRole('button', { name: /^sign$/i });
    expect(button).toBeDisabled();
    await userEvent.type(screen.getByLabelText(/type your full legal name/i), '   ');
    expect(button).toBeDisabled();
    await userEvent.type(screen.getByLabelText(/type your full legal name/i), 'Alice');
    expect(button).toBeEnabled();
  });

  it('a rejected sign renders inline and the row stays unsigned', async () => {
    vi.mocked(signMyDocument).mockRejectedValue(new Error('not authorized to sign as BUYER'));
    renderWithRouter(<Documents />);
    await screen.findByText('Horse Purchase and Sale Agreement');

    await userEvent.type(screen.getByLabelText(/type your full legal name/i), 'Sam Stranger');
    await userEvent.click(screen.getByRole('button', { name: /^sign$/i }));

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('not authorized to sign as BUYER');
    // no refresh on failure — still one initial roster load
    expect(listMySignableDocuments).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: /^sign$/i })).toBeInTheDocument();
  });

  it('renders no self-sign section when the member has no signable contracts', async () => {
    vi.mocked(listMySignableDocuments).mockResolvedValue([]);
    renderWithRouter(<Documents />);
    await screen.findByText(/no documents yet/i);
    expect(screen.queryByTestId('self-sign-section')).not.toBeInTheDocument();
  });
});
