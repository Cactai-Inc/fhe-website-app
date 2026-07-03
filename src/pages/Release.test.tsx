// @vitest-environment jsdom
/**
 * LANE-PUBLIC /release kiosk UI-interaction test (Wiring & Verification §15).
 *
 * Owner directive 2026-07-03: the kiosk serves ONLY the general visitor
 * release; the other releases are signed in the client account. Renders the
 * REAL Release page with the REAL api-public fns mocked and proves:
 *  - the kiosk opens straight on the info step and loads the GENERAL release
 *    preview (plus the FACILITY_RULES gate document) — no chooser,
 *  - /release/general deep-links to the same form; a deep link to a retired
 *    kiosk slug (participant, horse-care, …) renders the "signed in your
 *    client account" notice with a /login link INSTEAD of the form, and loads
 *    no previews,
 *  - EMAIL IS REQUIRED on the info step (label + validation), matching the
 *    sign_general_release RPC contract,
 *  - the minor checkbox swaps the info form between adult fields and
 *    minor + guardian fields (visitors bring kids),
 *  - the RULES GATE: continue stays disabled until the facility-rules checkbox
 *    is checked,
 *  - signing calls signRelease with the EXACT payload (adult AND minor paths,
 *    always RELEASE_GENERAL) and renders the executed confirmation with the
 *    signed document body,
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

const signButton = () => screen.getByRole('button', { name: /sign the release/i });
const continueRules = () => screen.getByRole('button', { name: /continue to the facility rules/i });
const continueRelease = () => screen.getByRole('button', { name: /continue to the release/i });

/** info form filled for an adult (email REQUIRED) → rules step. */
async function adultToRules() {
  renderWithRouter(<Release />);
  await userEvent.type(await screen.findByLabelText(/^first name/i), 'Vera');
  await userEvent.type(screen.getByLabelText(/^last name/i), 'Visitor');
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
  it('opens straight on the general-release info form and loads that preview + the rules gate', async () => {
    renderWithRouter(<Release />);
    expect(await screen.findByLabelText(/^first name/i)).toBeInTheDocument();
    // single-document kiosk: no chooser buttons anywhere
    expect(screen.queryByRole('button', { name: /participant/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /horse/i })).not.toBeInTheDocument();
    await waitFor(() => expect(fetchReleasePreview).toHaveBeenCalledWith('RELEASE_GENERAL'));
    expect(fetchReleasePreview).toHaveBeenCalledWith('FACILITY_RULES');
  });

  it('a /release/general deep link lands on the same general-release form', async () => {
    renderWithRouter(<Release />, { route: '/release/general', path: '/release/:releaseKey' });
    expect(await screen.findByLabelText(/^first name/i)).toBeInTheDocument();
    await waitFor(() => expect(fetchReleasePreview).toHaveBeenCalledWith('RELEASE_GENERAL'));
  });

  it.each(['participant', 'horse-exercise', 'horse-care'])(
    'a retired kiosk deep link (/release/%s) renders the sign-in notice, not a form',
    async (slug) => {
      renderWithRouter(<Release />, { route: `/release/${slug}`, path: '/release/:releaseKey' });
      expect(
        await screen.findByText(/signed in your client account/i),
      ).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /sign in/i })).toHaveAttribute('href', '/login');
      expect(screen.getByText(/invitation link/i)).toBeInTheDocument();
      // no form, no preview loads for in-account documents
      expect(screen.queryByLabelText(/^first name/i)).not.toBeInTheDocument();
      expect(fetchReleasePreview).not.toHaveBeenCalled();
      expect(signRelease).not.toHaveBeenCalled();
    },
  );

  it('EMAIL REQUIRED: continue stays disabled until an email is entered', async () => {
    renderWithRouter(<Release />);
    await userEvent.type(await screen.findByLabelText(/^first name/i), 'Vera');
    await userEvent.type(screen.getByLabelText(/^last name/i), 'Visitor');
    // a phone alone no longer satisfies the kiosk (attribution requires email)
    await userEvent.type(screen.getByLabelText(/phone/i), '619-555-0100');
    expect(screen.getByLabelText(/email/i)).toBeRequired();
    expect(screen.getByText(/please provide an email address/i)).toBeInTheDocument();
    expect(continueRules()).toBeDisabled();

    await userEvent.type(screen.getByLabelText(/email/i), 'vera@visitor.test');
    expect(continueRules()).toBeEnabled();
  });

  it('the minor checkbox swaps the info form to minor + guardian fields', async () => {
    renderWithRouter(<Release />);
    expect(await screen.findByLabelText(/^first name/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/minor's first name/i)).not.toBeInTheDocument();

    await userEvent.click(screen.getByLabelText(/covers a minor/i));
    expect(screen.getByLabelText(/minor's first name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/minor's last name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/minor's date of birth/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/parent\/guardian first name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/parent\/guardian last name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/relationship to minor/i)).toBeInTheDocument();

    await userEvent.click(screen.getByLabelText(/covers a minor/i));
    expect(screen.queryByLabelText(/minor's first name/i)).not.toBeInTheDocument();
    expect(screen.getByLabelText(/^first name/i)).toBeInTheDocument();
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
      first_name: 'Vera',
      last_name: 'Visitor',
      email: 'vera@visitor.test',
      phone: null,
      typed_name: 'Vera Visitor',
      is_minor: false,
      minor_first_name: null,
      minor_last_name: null,
      minor_dob: null,
      guardian_relationship: null,
      rules_acknowledged: true,
    }));
    expect(await screen.findByText(/your release is on file/i)).toBeInTheDocument();
    expect(screen.getByText(/DOC-000042/)).toBeInTheDocument();
    expect(screen.getByText(/fully executed/i)).toBeInTheDocument();
    expect(screen.getByText(/EXECUTED BODY WITH COMPLETED SIGNATURE SECTION/)).toBeInTheDocument();
  });

  it('MINOR path: signs the general release with the exact minor + guardian payload', async () => {
    vi.mocked(signRelease).mockResolvedValue(RESULT as never);
    renderWithRouter(<Release />);
    // visitors bring kids: the minor toggle stays on the single-document kiosk
    await userEvent.click(await screen.findByLabelText(/covers a minor/i));

    await userEvent.type(screen.getByLabelText(/minor's first name/i), 'Mina');
    await userEvent.type(screen.getByLabelText(/minor's last name/i), 'Minor');
    await userEvent.type(screen.getByLabelText(/minor's date of birth/i), '2015-03-04');
    await userEvent.type(screen.getByLabelText(/parent\/guardian first name/i), 'Gwen');
    await userEvent.type(screen.getByLabelText(/parent\/guardian last name/i), 'Guardian');
    await userEvent.type(screen.getByLabelText(/relationship to minor/i), 'Mother');
    await userEvent.type(screen.getByLabelText(/email/i), 'gwen@guardian.test');
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
      template_key: 'RELEASE_GENERAL',
      first_name: 'Gwen',
      last_name: 'Guardian',
      email: 'gwen@guardian.test',
      phone: '619-555-0100',
      typed_name: 'Gwen Guardian',
      is_minor: true,
      minor_first_name: 'Mina',
      minor_last_name: 'Minor',
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
    expect(await screen.findByRole('alert')).toHaveTextContent(/could not load the release/i);
  });
});
