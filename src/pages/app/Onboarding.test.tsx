// @vitest-environment jsdom
/**
 * RIDER ONBOARDING happy path (/app/onboarding), with the data seams mocked.
 *
 * Proves the 3-step flow against the onboarding RPC contracts:
 *  - step 1 renders the details form (prefilled from the existing profile) and
 *    saving calls update_my_onboarding_profile then
 *    generate_my_onboarding_documents then refreshes my_onboarding_state,
 *  - step 2 walks each non-EXECUTED document in order: merged body rendered,
 *    the Sign button stays DISABLED until the typed name EXACTLY matches the
 *    printed name (server-enforced contract) AND the required e-sign consent
 *    checkbox is checked (release-signing audit), a successful sign calls
 *    record_signature via signMyDocument(doc, 'CLIENT', name, true) — the
 *    consent flag rides along — fires the best-effort /api/deliver-document
 *    POST, and advances "Document 2 of 2",
 *  - step 3 shows the purchase summary (tier label, $ amount, lessons, PAID +
 *    method) and the documents link,
 *  - a member with nothing pending and no purchase gets the friendly
 *    "nothing to do" screen,
 *  - the MINOR RIDER toggle (owner 2026-07-03): off by default and ABSENT from
 *    the save payload when untouched; on → required minor fields ride along as
 *    has_minor:true + minor_*; a server-attached minor prefills the toggle and
 *    switching it off sends an explicit has_minor:false; the confirmation
 *    purchase card names the minor rider.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderWithRouter, screen, fireEvent, userEvent, waitFor } from '../../test/render';

vi.mock('../../lib/api', () => ({
  getMyProfile: vi.fn(),
  getDocument: vi.fn(),
  myOnboardingState: vi.fn(),
  updateMyOnboardingProfile: vi.fn(),
  generateMyOnboardingDocuments: vi.fn(),
}));
vi.mock('../../lib/ops/api-client', () => ({ signMyDocument: vi.fn() }));

import {
  getMyProfile,
  getDocument,
  myOnboardingState,
  updateMyOnboardingProfile,
  generateMyOnboardingDocuments,
  type OnboardingState,
} from '../../lib/api';
import { signMyDocument } from '../../lib/ops/api-client';
import type { Profile } from '../../lib/types';
import Onboarding from './Onboarding';

const PROFILE: Profile = {
  user_id: 'user-1', first_name: 'Alice', last_name: 'Client', email: 'alice@example.com',
  phone: '555-0100', address_line1: '1 Barn Rd', address_line2: null,
  city: 'Ojai', state: 'CA', postal_code: '93023',
  is_admin: false, created_from_request_id: null, created_at: '', updated_at: '',
  display_name: null, avatar_url: null, bio: null, riding_level: null, is_suspended: false,
};

const PURCHASE = {
  tier_label: '4-Lesson Punch Card', amount: 500, lessons_included: 4,
  cadence: null, paid: true, payment_method: 'Zelle',
};

const DOC_1 = { document_id: 'doc-1', template_key: 'liability_waiver', title: 'Liability Waiver & Release', status: 'DRAFT' };
const DOC_2 = { document_id: 'doc-2', template_key: 'lesson_policy', title: 'Lesson & Cancellation Policy', status: 'DRAFT' };

const state = (over: Partial<OnboardingState>): OnboardingState => ({
  needed: true, profile_complete: false, documents: [], purchase: PURCHASE, minor: null, ...over,
});

const MINOR = { first_name: 'Mia', last_name: 'Client', dob: '2018-05-06' };

const docRow = (id: string, body: string) => ({
  id, display_code: null, engagement_id: 'eng-1', template_id: 'tpl-1', title: 'x',
  merged_body: body, status: 'DRAFT', generated_at: '2026-07-02T00:00:00Z',
  effective_date: null, created_at: '', updated_at: '',
});

const fetchMock = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('fetch', fetchMock.mockResolvedValue({ ok: true }));
  vi.mocked(getMyProfile).mockResolvedValue(PROFILE);
  vi.mocked(updateMyOnboardingProfile).mockResolvedValue(undefined);
  vi.mocked(generateMyOnboardingDocuments).mockResolvedValue([DOC_1, DOC_2]);
  vi.mocked(signMyDocument).mockResolvedValue(undefined);
  vi.mocked(getDocument).mockImplementation(async (id: string) =>
    id === 'doc-1'
      ? docRow('doc-1', 'LIABILITY WAIVER\n\nRider: Alice Client\n\nI assume all risks.')
      : docRow('doc-2', 'LESSON POLICY\n\n24-hour cancellation notice required.'));
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('Onboarding — 3-step rider flow', () => {
  it('walks details → sign both documents → confirmation with the purchase summary', async () => {
    vi.mocked(myOnboardingState)
      // initial load: profile not complete yet
      .mockResolvedValueOnce(state({ profile_complete: false, documents: [] }))
      // after saving details: both docs pending, in signing order
      .mockResolvedValueOnce(state({ profile_complete: true, documents: [DOC_1, DOC_2] }))
      // after signing doc 1
      .mockResolvedValueOnce(state({
        profile_complete: true,
        documents: [{ ...DOC_1, status: 'EXECUTED' }, DOC_2],
      }))
      // after signing doc 2: everything executed, onboarding no longer needed
      .mockResolvedValueOnce(state({
        needed: false,
        profile_complete: true,
        documents: [{ ...DOC_1, status: 'EXECUTED' }, { ...DOC_2, status: 'EXECUTED' }],
      }));

    renderWithRouter(<Onboarding />);

    // ── Step 1: details form, prefilled from the existing profile ──────────
    expect(await screen.findByText('Your details')).toBeInTheDocument();
    expect(screen.getByLabelText('Phone')).toHaveValue('555-0100');
    expect(screen.getByLabelText('Street address')).toHaveValue('1 Barn Rd');

    fireEvent.change(screen.getByLabelText('Date of birth'), { target: { value: '1990-04-01' } });
    await userEvent.type(screen.getByLabelText('Contact 1 name'), 'Bob Client');
    await userEvent.type(screen.getByLabelText('Contact 1 relationship'), 'Spouse');
    await userEvent.type(screen.getByLabelText('Contact 1 phone'), '555-0101');
    await userEvent.type(screen.getByLabelText('Years riding'), '3');

    await userEvent.click(screen.getByRole('button', { name: /save & continue/i }));

    // Save → regenerate docs → refreshed state (in that order).
    await waitFor(() => expect(updateMyOnboardingProfile).toHaveBeenCalledTimes(1));
    expect(updateMyOnboardingProfile).toHaveBeenCalledWith(expect.objectContaining({
      phone: '555-0100',
      date_of_birth: '1990-04-01',
      address_street: '1 Barn Rd',
      address_city: 'Ojai',
      address_state: 'CA',
      address_zip: '93023',
      emergency_contact_1_name: 'Bob Client',
      emergency_contact_1_relationship: 'Spouse',
      emergency_contact_1_phone: '555-0101',
      riding_experience_years: '3',
    }));
    // the minor toggle was never touched → NO minor keys in the payload
    expect(vi.mocked(updateMyOnboardingProfile).mock.calls[0][0]).not.toHaveProperty('has_minor');
    await waitFor(() => expect(generateMyOnboardingDocuments).toHaveBeenCalledTimes(1));

    // ── Step 2: document 1 of 2 — merged body + type-to-sign ───────────────
    expect(await screen.findByText('Document 1 of 2')).toBeInTheDocument();
    expect(await screen.findByText(/I assume all risks/)).toBeInTheDocument();

    // Sign stays disabled until the typed name EXACTLY matches the printed
    // name AND the required e-sign consent checkbox is checked.
    const signButton = () => screen.getByRole('button', { name: /^sign$/i });
    const consentBox = () => screen.getByLabelText(/sign this document electronically/i);
    expect(consentBox()).not.toBeChecked();
    expect(signButton()).toBeDisabled();
    await userEvent.type(screen.getByLabelText(/type your name exactly as printed/i), 'Alice');
    expect(signButton()).toBeDisabled();
    await userEvent.type(screen.getByLabelText(/type your name exactly as printed/i), ' Client');
    // name matches, but consent is still missing — button stays disabled
    expect(signButton()).toBeDisabled();
    await userEvent.click(consentBox());
    expect(signButton()).toBeEnabled();

    await userEvent.click(signButton());
    // the consent flag rides along with the signature
    await waitFor(() => expect(signMyDocument).toHaveBeenCalledWith('doc-1', 'CLIENT', 'Alice Client', true));
    // Best-effort delivery fired for the signed document.
    expect(fetchMock).toHaveBeenCalledWith('/api/deliver-document', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ documentId: 'doc-1' }),
    }));

    // ── Document 2 of 2 ─────────────────────────────────────────────────────
    expect(await screen.findByText('Document 2 of 2')).toBeInTheDocument();
    expect(await screen.findByText(/24-hour cancellation notice/)).toBeInTheDocument();
    // consent persists for the signing session (already affirmed above)
    expect(consentBox()).toBeChecked();
    await userEvent.type(screen.getByLabelText(/type your name exactly as printed/i), 'Alice Client');
    await userEvent.click(signButton());
    await waitFor(() => expect(signMyDocument).toHaveBeenCalledWith('doc-2', 'CLIENT', 'Alice Client', true));
    expect(fetchMock).toHaveBeenCalledWith('/api/deliver-document', expect.objectContaining({
      body: JSON.stringify({ documentId: 'doc-2' }),
    }));

    // ── Step 3: confirmation + purchase summary ────────────────────────────
    expect(await screen.findByRole('heading', { name: /you're all set/i })).toBeInTheDocument();
    expect(screen.getByText(/copies of everything you signed have been emailed/i)).toBeInTheDocument();
    const card = screen.getByTestId('purchase-card');
    expect(card).toHaveTextContent('4-Lesson Punch Card');
    expect(card).toHaveTextContent('$500');
    expect(card).toHaveTextContent('4 lessons');
    expect(card).toHaveTextContent('PAID');
    expect(card).toHaveTextContent('via Zelle');
    expect(screen.getByRole('link', { name: /see your documents/i })).toHaveAttribute('href', '/app/documents');
    expect(screen.getByRole('link', { name: /go to your dashboard/i })).toHaveAttribute('href', '/app');
  });

  it('lands directly on Review & sign when the profile is already complete', async () => {
    vi.mocked(myOnboardingState).mockResolvedValue(
      state({ profile_complete: true, documents: [DOC_1, DOC_2] }),
    );
    renderWithRouter(<Onboarding />);
    expect(await screen.findByText('Document 1 of 2')).toBeInTheDocument();
    expect(screen.queryByText('Your details')).not.toBeInTheDocument();
  });

  it('shows the friendly nothing-to-do screen when neither onboarding nor a purchase exists', async () => {
    vi.mocked(myOnboardingState).mockResolvedValue(
      state({ needed: false, profile_complete: false, documents: [], purchase: null }),
    );
    renderWithRouter(<Onboarding />);
    expect(await screen.findByText(/nothing to do here/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /back to your dashboard/i })).toHaveAttribute('href', '/app');
    expect(updateMyOnboardingProfile).not.toHaveBeenCalled();
    expect(signMyDocument).not.toHaveBeenCalled();
  });
});

describe('Onboarding — minor rider toggle', () => {
  /** Fill the always-required details so the form submits. */
  async function fillRequiredDetails() {
    expect(await screen.findByText('Your details')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Date of birth'), { target: { value: '1990-04-01' } });
    await userEvent.type(screen.getByLabelText('Contact 1 name'), 'Bob Client');
    await userEvent.type(screen.getByLabelText('Contact 1 relationship'), 'Spouse');
    await userEvent.type(screen.getByLabelText('Contact 1 phone'), '555-0101');
  }

  it('toggle ON reveals the required minor fields and sends has_minor + minor_* in the payload', async () => {
    vi.mocked(myOnboardingState)
      .mockResolvedValueOnce(state({ profile_complete: false, documents: [] }))
      .mockResolvedValueOnce(state({ profile_complete: true, documents: [DOC_1, DOC_2], minor: MINOR }));
    renderWithRouter(<Onboarding />);
    await fillRequiredDetails();

    // off by default, fields hidden
    expect(screen.getByLabelText(/minor rider/i)).not.toBeChecked();
    expect(screen.queryByLabelText('Minor first name')).not.toBeInTheDocument();

    await userEvent.click(screen.getByLabelText(/minor rider/i));
    expect(screen.getByLabelText('Minor first name')).toBeRequired();
    expect(screen.getByLabelText('Minor last name')).toBeRequired();
    expect(screen.getByLabelText('Minor date of birth')).toBeRequired();

    await userEvent.type(screen.getByLabelText('Minor first name'), 'Mia');
    await userEvent.type(screen.getByLabelText('Minor last name'), 'Client');
    fireEvent.change(screen.getByLabelText('Minor date of birth'), { target: { value: '2018-05-06' } });

    await userEvent.click(screen.getByRole('button', { name: /save & continue/i }));
    await waitFor(() => expect(updateMyOnboardingProfile).toHaveBeenCalledWith(expect.objectContaining({
      has_minor: true,
      minor_first_name: 'Mia',
      minor_last_name: 'Client',
      minor_dob: '2018-05-06',
    })));
  });

  it('a server-attached minor prefills the toggle; switching it off sends an explicit has_minor:false', async () => {
    vi.mocked(myOnboardingState)
      .mockResolvedValueOnce(state({ profile_complete: false, documents: [], minor: MINOR }))
      .mockResolvedValueOnce(state({ profile_complete: true, documents: [DOC_1, DOC_2] }));
    renderWithRouter(<Onboarding />);
    await fillRequiredDetails();

    // prefilled from my_onboarding_state().minor
    expect(screen.getByLabelText(/minor rider/i)).toBeChecked();
    expect(screen.getByLabelText('Minor first name')).toHaveValue('Mia');
    expect(screen.getByLabelText('Minor last name')).toHaveValue('Client');
    expect(screen.getByLabelText('Minor date of birth')).toHaveValue('2018-05-06');

    // explicit toggle-off → the minor detaches server-side
    await userEvent.click(screen.getByLabelText(/minor rider/i));
    expect(screen.queryByLabelText('Minor first name')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /save & continue/i }));
    await waitFor(() => expect(updateMyOnboardingProfile).toHaveBeenCalledWith(
      expect.objectContaining({ has_minor: false })));
    expect(vi.mocked(updateMyOnboardingProfile).mock.calls[0][0]).not.toHaveProperty('minor_first_name');
  });

  it('the confirmation purchase card names the minor rider', async () => {
    vi.mocked(myOnboardingState).mockResolvedValue(state({
      needed: false,
      profile_complete: true,
      documents: [{ ...DOC_1, status: 'EXECUTED' }, { ...DOC_2, status: 'EXECUTED' }],
      minor: MINOR,
    }));
    renderWithRouter(<Onboarding />);
    expect(await screen.findByRole('heading', { name: /you're all set/i })).toBeInTheDocument();
    expect(screen.getByTestId('purchase-card')).toHaveTextContent('Rider: Mia Client');
  });
});
