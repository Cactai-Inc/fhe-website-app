// @vitest-environment jsdom
/**
 * LANE-PUBLIC /release kiosk UI-interaction test (Wiring & Verification §15).
 *
 * Renders the REAL Release page with the REAL api-public fns mocked and proves:
 *  - the RELEASE_GENERAL body from fetchGeneralRelease renders for reading,
 *  - the sign button stays disabled until name + a contact channel + an
 *    exactly-matching typed signature are present (mirror of the RPC fence),
 *  - signing calls signGeneralRelease with the EXACT args and renders the
 *    countersign-pending confirmation (AWAITING_SIGNATURE branch),
 *  - an EXECUTED result renders the fully-executed confirmation,
 *  - a rejected RPC renders the inline error branch (form stays up),
 *  - a failed template load renders the load-error branch.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithRouter, screen, userEvent, waitFor } from '../test/render';

vi.mock('../lib/ops/api-public', async (importOriginal) => {
  const real = await importOriginal<typeof import('../lib/ops/api-public')>();
  return {
    ...real,
    fetchGeneralRelease: vi.fn(),
    signGeneralRelease: vi.fn(),
  };
});

import { fetchGeneralRelease, signGeneralRelease } from '../lib/ops/api-public';
import Release from './Release';

const TEMPLATE = {
  title: 'General Visitor Liability Release',
  body: 'GENERAL VISITOR LIABILITY RELEASE\n\nVisitor knowingly and voluntarily assumes all risks…',
};
const RESULT = {
  document_id: 'doc-1',
  document_code: 'DOC-000042',
  engagement_id: 'eng-1',
  contact_id: 'con-1',
  status: 'AWAITING_SIGNATURE',
  merged_body: 'merged',
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(fetchGeneralRelease).mockResolvedValue(TEMPLATE as never);
});

async function fillVisitor() {
  renderWithRouter(<Release />);
  await screen.findByText(/assumes all risks/i);
  await userEvent.type(screen.getByLabelText(/full legal name/i), 'Vera Visitor');
  await userEvent.type(screen.getByLabelText(/email/i), 'vera@visitor.test');
}

const signButton = () => screen.getByRole('button', { name: /sign the release/i });

describe('Release', () => {
  it('renders the release document body for reading', async () => {
    renderWithRouter(<Release />);
    expect(await screen.findByText(/assumes all risks/i)).toBeInTheDocument();
    expect(screen.getByText('General Visitor Liability Release')).toBeInTheDocument();
    expect(fetchGeneralRelease).toHaveBeenCalledWith();
  });

  it('keeps signing disabled until the typed signature matches the name exactly', async () => {
    await fillVisitor();
    expect(signButton()).toBeDisabled();

    await userEvent.type(screen.getByLabelText(/type your full name to sign/i), 'V. Visitor');
    expect(screen.getByText(/must match your full legal name/i)).toBeInTheDocument();
    expect(signButton()).toBeDisabled();
    expect(signGeneralRelease).not.toHaveBeenCalled();

    await userEvent.clear(screen.getByLabelText(/type your full name to sign/i));
    await userEvent.type(screen.getByLabelText(/type your full name to sign/i), 'Vera Visitor');
    expect(signButton()).toBeEnabled();
  });

  it('signs with the exact args and shows the countersign-pending confirmation', async () => {
    vi.mocked(signGeneralRelease).mockResolvedValue(RESULT as never);
    await fillVisitor();
    await userEvent.type(screen.getByLabelText(/phone/i), '619-555-0100');
    await userEvent.type(screen.getByLabelText(/type your full name to sign/i), 'Vera Visitor');
    await userEvent.click(signButton());

    await waitFor(() => expect(signGeneralRelease).toHaveBeenCalledWith({
      full_name: 'Vera Visitor',
      email: 'vera@visitor.test',
      phone: '619-555-0100',
      typed_name: 'Vera Visitor',
    }));
    expect(await screen.findByText(/your release is on file/i)).toBeInTheDocument();
    expect(screen.getByText(/DOC-000042/)).toBeInTheDocument();
    expect(screen.getByText(/countersign shortly/i)).toBeInTheDocument();
  });

  it('an EXECUTED result shows the fully-executed confirmation', async () => {
    vi.mocked(signGeneralRelease).mockResolvedValue({ ...RESULT, status: 'EXECUTED' } as never);
    await fillVisitor();
    await userEvent.type(screen.getByLabelText(/type your full name to sign/i), 'Vera Visitor');
    await userEvent.click(signButton());

    expect(await screen.findByText(/fully executed/i)).toBeInTheDocument();
    expect(screen.queryByText(/countersign shortly/i)).not.toBeInTheDocument();
  });

  it('a rejected sign renders the inline error and keeps the form up', async () => {
    vi.mocked(signGeneralRelease).mockRejectedValue(new Error('validation failed'));
    await fillVisitor();
    await userEvent.type(screen.getByLabelText(/type your full name to sign/i), 'Vera Visitor');
    await userEvent.click(signButton());

    expect(await screen.findByRole('alert')).toHaveTextContent(/could not record your signature/i);
    expect(signButton()).toBeInTheDocument();
    expect(screen.queryByText(/your release is on file/i)).not.toBeInTheDocument();
  });

  it('a failed template load renders the load-error branch', async () => {
    vi.mocked(fetchGeneralRelease).mockRejectedValue(new Error('network'));
    renderWithRouter(<Release />);
    expect(await screen.findByRole('alert')).toHaveTextContent(/could not load the release/i);
    expect(screen.queryByLabelText(/full legal name/i)).not.toBeInTheDocument();
  });
});
