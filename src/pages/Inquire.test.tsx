// @vitest-environment jsdom
/**
 * LANE-PUBLIC /inquire UI-interaction test (Wiring & Verification Contract §15).
 *
 * Renders the REAL Inquire page with the REAL api-public fns mocked and proves:
 *  - the form picker lists the CLIENT forms from listPublicIntakeForms,
 *  - picking a form renders its sections/fields; signature and system fields
 *    are NOT rendered (an inquiry is not a signing surface),
 *  - submit calls submitIntakeSubmission with the EXACT payload (checkbox
 *    groups as arrays, empties dropped) and the mined contact_name/email,
 *    then shows the success branch,
 *  - a rejected submit renders the inline error branch (form stays up),
 *  - a failed forms load renders the load-error branch.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithRouter, screen, userEvent, waitFor } from '../test/render';

vi.mock('../lib/ops/api-public', async (importOriginal) => {
  const real = await importOriginal<typeof import('../lib/ops/api-public')>();
  return {
    ...real,
    listPublicIntakeForms: vi.fn(),
    submitIntakeSubmission: vi.fn(),
  };
});

import { listPublicIntakeForms, submitIntakeSubmission } from '../lib/ops/api-public';
import Inquire from './Inquire';

const PURCHASE_FORM = {
  form_key: 'INTAKE_HORSE_PURCHASE',
  title: 'Horse Purchase Client Intake Form',
  purpose: 'To collect information necessary to assist a client with the purchase of a horse.',
  schema: {
    sections: [
      {
        heading: 'CLIENT INFORMATION',
        fields: [
          { key: 'full_legal_name', label: 'Full Legal Name', type: 'text' as const },
          { key: 'email', label: 'Email', type: 'email' as const },
          { key: 'phone', label: 'Phone', type: 'phone' as const },
        ],
      },
      {
        heading: 'DISCIPLINE & USE',
        fields: [
          { key: 'intended_use', label: 'Intended Use', type: 'checkbox' as const, options: ['Hunters', 'Jumpers', 'Trail'] },
        ],
      },
      {
        heading: 'CLIENT ACKNOWLEDGMENT',
        fields: [
          { key: 'client_signature', label: 'Client Signature', type: 'signature' as const },
          { key: 'uuid', label: 'UUID', type: 'system' as const },
        ],
      },
    ],
  },
};
const CLIPPING_FORM = {
  form_key: 'INTAKE_HORSE_CLIPPING',
  title: 'Horse Clipping Intake Form',
  purpose: null,
  schema: { sections: [{ heading: 'CLIENT INFORMATION', fields: [{ key: 'client_name', label: 'Client Name', type: 'text' as const }] }] },
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(listPublicIntakeForms).mockResolvedValue([PURCHASE_FORM, CLIPPING_FORM] as never);
});

async function pickPurchaseForm() {
  renderWithRouter(<Inquire />);
  await screen.findByLabelText(/what can we help with/i);
  await userEvent.selectOptions(
    screen.getByLabelText(/what can we help with/i),
    'INTAKE_HORSE_PURCHASE',
  );
}

describe('Inquire', () => {
  it('lists the forms and renders the picked form; signature/system fields never render', async () => {
    await pickPurchaseForm();
    expect(listPublicIntakeForms).toHaveBeenCalledWith();
    expect(screen.getByText('CLIENT INFORMATION')).toBeInTheDocument();
    expect(screen.getByLabelText(/full legal name/i)).toBeInTheDocument();
    expect(screen.getByText('Hunters')).toBeInTheDocument();
    // signature + system fields are omitted; their empty section vanishes too
    expect(screen.queryByText(/client signature/i)).not.toBeInTheDocument();
    expect(screen.queryByText('UUID')).not.toBeInTheDocument();
    expect(screen.queryByText('CLIENT ACKNOWLEDGMENT')).not.toBeInTheDocument();
  });

  it('submits the exact payload with mined contact fields and shows the success branch', async () => {
    vi.mocked(submitIntakeSubmission).mockResolvedValue(undefined as never);
    await pickPurchaseForm();

    await userEvent.type(screen.getByLabelText(/full legal name/i), 'Pia Public');
    await userEvent.type(screen.getByLabelText(/email/i), 'pia@public.test');
    await userEvent.click(screen.getByRole('checkbox', { name: 'Hunters' }));
    await userEvent.click(screen.getByRole('checkbox', { name: 'Trail' }));
    // phone stays empty → must NOT travel in the payload
    await userEvent.click(screen.getByRole('button', { name: /send my inquiry/i }));

    await waitFor(() => expect(submitIntakeSubmission).toHaveBeenCalledWith({
      form_key: 'INTAKE_HORSE_PURCHASE',
      payload: {
        full_legal_name: 'Pia Public',
        email: 'pia@public.test',
        intended_use: ['Hunters', 'Trail'],
      },
      contact_name: 'Pia Public',
      contact_email: 'pia@public.test',
    }));
    expect(await screen.findByText(/your inquiry just landed/i)).toBeInTheDocument();
  });

  it('a rejected submit renders the inline error and keeps the form up', async () => {
    vi.mocked(submitIntakeSubmission).mockRejectedValue(new Error('rls denied'));
    await pickPurchaseForm();

    await userEvent.type(screen.getByLabelText(/full legal name/i), 'Pia Public');
    await userEvent.click(screen.getByRole('button', { name: /send my inquiry/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/something went wrong/i);
    expect(screen.getByRole('button', { name: /send my inquiry/i })).toBeInTheDocument();
    expect(screen.queryByText(/your inquiry just landed/i)).not.toBeInTheDocument();
  });

  it('a failed forms load renders the load-error branch', async () => {
    vi.mocked(listPublicIntakeForms).mockRejectedValue(new Error('network'));
    renderWithRouter(<Inquire />);
    expect(await screen.findByRole('alert')).toHaveTextContent(/could not load/i);
    expect(screen.queryByLabelText(/what can we help with/i)).not.toBeInTheDocument();
  });
});
