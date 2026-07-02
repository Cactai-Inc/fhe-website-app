// @vitest-environment jsdom
/**
 * LANE-PUBLIC /release kiosk UI-interaction test (Wiring & Verification §15).
 *
 * Renders the REAL Release page with the REAL api-public fns mocked and proves:
 *  - the chooser renders all FOUR release buttons; choosing one loads the
 *    preview for THAT key (plus the FACILITY_RULES gate document),
 *  - a /release/:releaseKey deep link skips the chooser and previews the right
 *    release,
 *  - the minor checkbox swaps the info form between adult fields and
 *    minor + guardian fields,
 *  - the RULES GATE: continue stays disabled until the facility-rules checkbox
 *    is checked,
 *  - signing calls signRelease with the EXACT payload (adult AND minor paths)
 *    and renders the executed confirmation with the signed document body,
 *  - a rejected RPC renders the inline error branch (form stays up),
 *  - a failed preview load renders the load-error branch.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithRouter, screen, userEvent, waitFor } from '../test/render';

vi.mock('../lib/ops/api-public', async (importOriginal) => {
  const real = await importOriginal<typeof import('../lib/ops/api-public')>();
  return {
    ...real,
    fetchReleasePreview: vi.fn(),
    signRelease: vi.fn(),
  };
});

import { fetchReleasePreview, signRelease } from '../lib/ops/api-public';
import Release from './Release';

const PREVIEWS: Record<string, { title: string; body: string }> = {
  RELEASE_GENERAL: { title: 'General Visitor Liability Release', body: 'GENERAL RELEASE BODY — assumes all risks…' },
  RELEASE_PARTICIPANT: { title: 'Participant Liability Release', body: 'PARTICIPANT RELEASE BODY — assumes all risks…' },
  RELEASE_HORSE_EXERCISE: { title: 'Horse Exercise Liability Release', body: 'HORSE EXERCISE RELEASE BODY — assumes all risks…' },
  RELEASE_HORSE_CARE: { title: 'Horse Handling and Routine Care Liability Release', body: 'HORSE CARE RELEASE BODY — assumes all risks…' },
  FACILITY_RULES: { title: 'Facility Rules and Safety Acknowledgment', body: 'FACILITY RULES BODY — helmets required…' },
};
const RESULT = {
  document_id: 'doc-1',
  document_code: 'DOC-000042',
  engagement_id: 'eng-1',
  contact_id: 'con-1',
  status: 'EXECUTED',
  merged_body: 'EXECUTED BODY WITH COMPLETED SIGNATURE SECTION',
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(fetchReleasePreview).mockImplementation(async (key: string) => PREVIEWS[key] as never);
});

const chooserButton = (label: RegExp) => screen.getByRole('button', { name: label });
const signButton = () => screen.getByRole('button', { name: /sign the release/i });
const continueRules = () => screen.getByRole('button', { name: /continue to the facility rules/i });
const continueRelease = () => screen.getByRole('button', { name: /continue to the release/i });

/** chooser → info form filled for an adult → rules step. */
async function adultToRules() {
  renderWithRouter(<Release />);
  await userEvent.click(chooserButton(/general visitor/i));
  await userEvent.type(screen.getByLabelText(/^full legal name/i), 'Vera Visitor');
  await userEvent.type(screen.getByLabelText(/email/i), 'vera@visitor.test');
  await userEvent.click(continueRules());
  await screen.findByText(/helmets required/i);
}

/** …and through the rules gate onto the signing step. */
async function adultToSign() {
  await adultToRules();
  await userEvent.click(screen.getByLabelText(/read and agree to the facility rules/i));
  await userEvent.click(continueRelease());
  await screen.findByText(/assumes all risks/i);
}

describe('Release', () => {
  it('renders the four-release chooser and loads the preview for the chosen key', async () => {
    renderWithRouter(<Release />);
    expect(chooserButton(/general visitor/i)).toBeInTheDocument();
    expect(chooserButton(/participant/i)).toBeInTheDocument();
    expect(chooserButton(/horse exercise/i)).toBeInTheDocument();
    expect(chooserButton(/horse care/i)).toBeInTheDocument();
    expect(fetchReleasePreview).not.toHaveBeenCalled();

    await userEvent.click(chooserButton(/horse exercise/i));
    await waitFor(() => expect(fetchReleasePreview).toHaveBeenCalledWith('RELEASE_HORSE_EXERCISE'));
    expect(fetchReleasePreview).toHaveBeenCalledWith('FACILITY_RULES');
  });

  it('a deep link (/release/horse-care) skips the chooser and previews that release', async () => {
    renderWithRouter(<Release />, { route: '/release/horse-care', path: '/release/:releaseKey' });
    expect(screen.queryByRole('button', { name: /general visitor/i })).not.toBeInTheDocument();
    expect(await screen.findByLabelText(/^full legal name/i)).toBeInTheDocument();
    await waitFor(() => expect(fetchReleasePreview).toHaveBeenCalledWith('RELEASE_HORSE_CARE'));
  });

  it('the minor checkbox swaps the info form to minor + guardian fields', async () => {
    renderWithRouter(<Release />);
    await userEvent.click(chooserButton(/general visitor/i));
    expect(screen.getByLabelText(/^full legal name/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/minor's full legal name/i)).not.toBeInTheDocument();

    await userEvent.click(screen.getByLabelText(/covers a minor/i));
    expect(screen.getByLabelText(/minor's full legal name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/minor's date of birth/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/parent\/guardian full legal name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/relationship to minor/i)).toBeInTheDocument();

    await userEvent.click(screen.getByLabelText(/covers a minor/i));
    expect(screen.queryByLabelText(/minor's full legal name/i)).not.toBeInTheDocument();
    expect(screen.getByLabelText(/^full legal name/i)).toBeInTheDocument();
  });

  it('RULES GATE: continue stays disabled until the rules checkbox is checked', async () => {
    await adultToRules();
    expect(continueRelease()).toBeDisabled();
    await userEvent.click(screen.getByLabelText(/read and agree to the facility rules/i));
    expect(continueRelease()).toBeEnabled();
  });

  it('keeps signing disabled until the typed signature matches the signer name exactly', async () => {
    await adultToSign();
    expect(signButton()).toBeDisabled();

    await userEvent.type(screen.getByLabelText(/type your full name to sign/i), 'V. Visitor');
    expect(screen.getByText(/must match your full legal name/i)).toBeInTheDocument();
    expect(signButton()).toBeDisabled();
    expect(signRelease).not.toHaveBeenCalled();

    await userEvent.clear(screen.getByLabelText(/type your full name to sign/i));
    await userEvent.type(screen.getByLabelText(/type your full name to sign/i), 'Vera Visitor');
    expect(signButton()).toBeEnabled();
  });

  it('ADULT path: signs with the exact payload and shows the executed document', async () => {
    vi.mocked(signRelease).mockResolvedValue(RESULT as never);
    await adultToSign();
    await userEvent.type(screen.getByLabelText(/type your full name to sign/i), 'Vera Visitor');
    await userEvent.click(signButton());

    await waitFor(() => expect(signRelease).toHaveBeenCalledWith({
      template_key: 'RELEASE_GENERAL',
      full_name: 'Vera Visitor',
      email: 'vera@visitor.test',
      phone: null,
      typed_name: 'Vera Visitor',
      is_minor: false,
      minor_name: null,
      minor_dob: null,
      guardian_relationship: null,
      rules_acknowledged: true,
    }));
    expect(await screen.findByText(/your release is on file/i)).toBeInTheDocument();
    expect(screen.getByText(/DOC-000042/)).toBeInTheDocument();
    expect(screen.getByText(/fully executed/i)).toBeInTheDocument();
    expect(screen.getByText(/EXECUTED BODY WITH COMPLETED SIGNATURE SECTION/)).toBeInTheDocument();
  });

  it('MINOR path: signs with the exact minor + guardian payload', async () => {
    vi.mocked(signRelease).mockResolvedValue(RESULT as never);
    renderWithRouter(<Release />);
    await userEvent.click(chooserButton(/participant/i));
    // the minor toggle lives on the info step (removed from the chooser per owner)
    await userEvent.click(screen.getByLabelText(/covers a minor/i));

    await userEvent.type(screen.getByLabelText(/minor's full legal name/i), 'Mina Minor');
    await userEvent.type(screen.getByLabelText(/minor's date of birth/i), '2015-03-04');
    await userEvent.type(screen.getByLabelText(/parent\/guardian full legal name/i), 'Gwen Guardian');
    await userEvent.type(screen.getByLabelText(/relationship to minor/i), 'Mother');
    await userEvent.type(screen.getByLabelText(/phone/i), '619-555-0100');
    await userEvent.click(continueRules());

    await screen.findByText(/helmets required/i);
    await userEvent.click(screen.getByLabelText(/read and agree to the facility rules/i));
    await userEvent.click(continueRelease());

    await screen.findByText(/assumes all risks/i);
    await userEvent.type(
      screen.getByLabelText(/parent\/guardian: type your full name to sign/i), 'Gwen Guardian');
    await userEvent.click(signButton());

    await waitFor(() => expect(signRelease).toHaveBeenCalledWith({
      template_key: 'RELEASE_PARTICIPANT',
      full_name: 'Gwen Guardian',
      email: null,
      phone: '619-555-0100',
      typed_name: 'Gwen Guardian',
      is_minor: true,
      minor_name: 'Mina Minor',
      minor_dob: '2015-03-04',
      guardian_relationship: 'Mother',
      rules_acknowledged: true,
    }));
    expect(await screen.findByText(/your release is on file/i)).toBeInTheDocument();
  });

  it('a rejected sign renders the inline error and keeps the form up', async () => {
    vi.mocked(signRelease).mockRejectedValue(new Error('validation failed'));
    await adultToSign();
    await userEvent.type(screen.getByLabelText(/type your full name to sign/i), 'Vera Visitor');
    await userEvent.click(signButton());

    expect(await screen.findByRole('alert')).toHaveTextContent(/could not record your signature/i);
    expect(signButton()).toBeInTheDocument();
    expect(screen.queryByText(/your release is on file/i)).not.toBeInTheDocument();
  });

  it('a failed preview load renders the load-error branch', async () => {
    vi.mocked(fetchReleasePreview).mockRejectedValue(new Error('network'));
    renderWithRouter(<Release />);
    await userEvent.click(chooserButton(/general visitor/i));
    expect(await screen.findByRole('alert')).toHaveTextContent(/could not load the release/i);
  });
});
