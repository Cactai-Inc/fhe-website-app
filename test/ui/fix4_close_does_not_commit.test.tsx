// @vitest-environment jsdom
/**
 * TASK-FIX4 §10, criteria 1 and 2 — on the surface the task names.
 *
 * ⚠️ CRITERION 1 IS A REGRESSION TEST ON A SHIPPED FIX. `TASK-FIX2` routed every
 * exit of `ContactDossierModal` through `requestClose`, which called `commit()`
 * and only then closed — so clicking the X SUBMITTED the form. The owner ruled
 * that out on 2026-08-31: *"commits on continue/send/commit/done...etc... not a
 * close button click, no user would input data and click close and expect the form
 * submitted."*
 *
 * ⚠️ AND CRITERION 2 IS WHY REVERTING IS NOT THE ANSWER. Before FIX2, closing
 * DISCARDED. The fix is neither: **closing does nothing, and the record has
 * already auto-saved.** Both halves are asserted here, because a test that only
 * checked "close does not write" would pass on a modal that lost everything.
 *
 * The write itself is spied at `updateContactRecord` — the single RPC seam this
 * surface has — so what is being pinned is whether a WRITE LEAVES THE APP, not
 * which function called it.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';

const updateContactRecord = vi.fn();
const contactDossier = vi.fn();

vi.mock('../../src/lib/api', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('../../src/lib/api');
  return {
    ...actual,
    contactDossier: (...a: unknown[]) => contactDossier(...a),
    updateContactRecord: (...a: unknown[]) => updateContactRecord(...a),
    listLookupOptionsAll: () => Promise.resolve([]),
    addLookupValue: () => Promise.resolve(null),
    setContactType: () => Promise.resolve(null),
  };
});
vi.mock('../../src/lib/ops/api-calendar', () => ({ fetchClientStandingSlots: () => Promise.resolve([]) }));
vi.mock('../../src/lib/admin', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('../../src/lib/admin');
  return { ...actual, adminInvitationHistory: () => Promise.resolve([]) };
});
vi.mock('../../src/components/app/ClientRecordActions', () => ({
  AssignDocumentsModal: () => null,
  ClientHorseRecordsCard: () => null,
  AttachOfferingPanel: () => null,
  PaperworkEditor: () => null,
}));
vi.mock('../../src/components/app/StandingSlotPicker', () => ({ StaffStandingSlotSection: () => null }));
vi.mock('../../src/components/app/ClientInvitationSection', () => ({ ClientInvitationSection: () => null }));

const DOSSIER = {
  contact: {
    id: 'c1', first_name: 'Elisheva', last_name: 'Fiszer', email: 'e@example.com',
    display_code: 'CON-000001', deleted_at: null,
  },
  standing: { contact_type: 'CONTACT', is_client: false, groups: [] },
  account: null,
  family: { dependants: [], guardians: [] },
  horses: [],
  documents: [],
  orders: [],
};

let ContactDossierModal: typeof import('../../src/components/app/ContactDossierModal')['ContactDossierModal'];

beforeEach(async () => {
  vi.clearAllMocks();
  contactDossier.mockResolvedValue(structuredClone(DOSSIER));
  updateContactRecord.mockImplementation(() => Promise.resolve(structuredClone(DOSSIER)));
  ({ ContactDossierModal } = await import('../../src/components/app/ContactDossierModal'));
});
afterEach(() => { cleanup(); vi.useRealTimers(); });

/**
 * ⚠️ FAKE TIMERS ARE INSTALLED *AFTER* THE RECORD HAS LOADED, NOT BEFORE.
 * RTL's `findBy*` polls on a timer; freezing the clock first means the initial
 * `contactDossier` render never resolves and the test hangs rather than failing.
 * The debounce under test is created by the `change` below, so it is fully
 * covered by timers installed at this point.
 */
async function openWithEdit({ freeze = true } = {}) {
  const onClose = vi.fn();
  render(<ContactDossierModal contactId="c1" onClose={onClose} />);
  const firstName = await screen.findByLabelText('First name');
  if (freeze) vi.useFakeTimers();
  fireEvent.change(firstName, { target: { value: 'Elishevaa' } });
  return { onClose, firstName };
}

/** The header X and the footer button both read "Close"; index 0 is the X. */
const closeControls = () => screen.getAllByRole('button', { name: 'Close' });

describe('⚠️ criterion 1 — closing a record with unsaved input does NOT commit', () => {
  it('the footer Close button writes nothing', async () => {
    const { onClose } = await openWithEdit();
    // Closed BEFORE the auto-save debounce elapses — precisely where TASK-FIX2's
    // `requestClose` fired `commit()`.
    fireEvent.click(closeControls().at(-1)!);
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(updateContactRecord).not.toHaveBeenCalled();
  });

  it('the header X writes nothing', async () => {
    const { onClose } = await openWithEdit();
    fireEvent.click(closeControls()[0]);
    expect(onClose).toHaveBeenCalled();
    expect(updateContactRecord).not.toHaveBeenCalled();
  });

  it('Escape writes nothing', async () => {
    const { onClose } = await openWithEdit();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
    expect(updateContactRecord).not.toHaveBeenCalled();
  });

  it('⚠️ a click on the backdrop neither commits NOR closes', async () => {
    const { onClose } = await openWithEdit();
    const overlay = document.querySelector('[role="dialog"]');
    if (overlay) fireEvent.click(overlay);
    expect(updateContactRecord).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });
});

describe('criterion 2 — input DOES commit, on its own', () => {
  it('⚠️ the record auto-saves after the debounce, without anyone pressing anything', async () => {
    await openWithEdit();
    expect(updateContactRecord).not.toHaveBeenCalled();

    await act(async () => { await vi.advanceTimersByTimeAsync(1200); });

    expect(updateContactRecord).toHaveBeenCalledTimes(1);
    expect(updateContactRecord).toHaveBeenCalledWith('c1', { first_name: 'Elishevaa' });
  });

  it('shows the auto-save indicator, so the person can tell it happened', async () => {
    await openWithEdit({ freeze: false });
    await waitFor(() => expect(updateContactRecord).toHaveBeenCalled(), { timeout: 3000 });
    await waitFor(() => expect(screen.getByText('Saved to the record')).toBeTruthy());
  });

  it('⚠️ a failed write keeps the record open, the edits in the boxes, and says why', async () => {
    updateContactRecord.mockRejectedValue(new Error('permission denied for table contacts'));
    const { onClose } = await openWithEdit({ freeze: false });

    await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy(), { timeout: 3000 });
    expect(screen.getByRole('alert').textContent).toContain('permission denied');
    expect((screen.getByLabelText('First name') as HTMLInputElement).value).toBe('Elishevaa');
    expect(onClose).not.toHaveBeenCalled();
  });
});

describe('⚠️ §4 — a staff-entered name normalises on blur, here too', () => {
  it("'fiszer' becomes 'Fiszer' when they leave the box", async () => {
    render(<ContactDossierModal contactId="c1" onClose={vi.fn()} />);
    const last = await screen.findByLabelText('Last name');
    fireEvent.change(last, { target: { value: 'fiszer' } });
    expect((last as HTMLInputElement).value).toBe('fiszer'); // untouched while focused
    fireEvent.blur(last);
    expect((last as HTMLInputElement).value).toBe('Fiszer');
  });

  it('⚠️ an interior capital is never touched', async () => {
    render(<ContactDossierModal contactId="c1" onClose={vi.fn()} />);
    const last = await screen.findByLabelText('Last name');
    fireEvent.change(last, { target: { value: 'LaBuzetta' } });
    fireEvent.blur(last);
    expect((last as HTMLInputElement).value).toBe('LaBuzetta');
  });
});
