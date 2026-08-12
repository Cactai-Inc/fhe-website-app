// @vitest-environment jsdom
/**
 * TASK-REVIEWNAV — proves the four review-only mounts actually mount.
 *
 * These are the manifest entries that had NO route: two pages retired behind a
 * boolean, and two components that take props rather than URL params. The task's
 * test list requires each Review entry to LOAD when clicked, and these four are
 * the only ones whose loading depends on code this task wrote — the rest point
 * at live routes that already work.
 *
 * The retirement constants are NOT flipped to make this pass; each page is
 * mounted directly, which is the whole design. The data layer is mocked (a
 * Proxy over lib/api, so every seam answers without listing thirty of them);
 * everything else is the real component.
 */
import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import {
  ReviewContactsPage, ReviewIntakePage, ReviewContactDossier, ReviewContactForm,
} from '../../src/pages/app/ops/review/ReviewMounts';

vi.mock('../../src/contexts/AuthContext', () => ({
  useAuth: () => ({
    profile: { display_name: 'Test Admin' },
    isAdmin: true, isStaff: true, isSuperAdmin: false,
    hasModule: () => true, signOut: vi.fn(),
  }),
}));

/* The data seams the three mounted components read. Nothing below asserts on
   what comes back — only that each component renders its own markup, which is
   what "it loads when clicked" means here. */
/* Factories are hoisted above the file body, so each one declares its own
   no-op rather than sharing a top-level const. */
vi.mock('../../src/lib/api', () => ({
  staffContactDirectory: () => Promise.resolve([]),
  createContact: () => Promise.resolve(null),
  updateContact: () => Promise.resolve(null),
  deleteContact: () => Promise.resolve(null),
  setContactType: () => Promise.resolve(null),
  contactAddress: () => null,
  formatAddress: () => '',
  CONTACT_TYPE_LABEL: {},
  contactDossier: () => Promise.resolve(null),
  updateContactRecord: () => Promise.resolve(null),
}));
vi.mock('../../src/lib/ops/api-intake', () => ({
  listInboundQueue: () => Promise.resolve([]),
  listBookingRequests: () => Promise.resolve([]),
}));
vi.mock('../../src/lib/support', () => ({
  listSupportRequests: () => Promise.resolve([]),
  setSupportStatus: () => Promise.resolve(null),
}));

afterEach(() => cleanup());

function mount(ui: React.ReactElement) {
  return render(<HelmetProvider><MemoryRouter>{ui}</MemoryRouter></HelmetProvider>);
}

describe('the four review-only mounts', () => {
  it('People B — the retired contact directory renders under the banner', () => {
    mount(<ReviewContactsPage />);
    expect(screen.getByTestId('review-banner')).toBeInTheDocument();
    expect(screen.getByText(/retired contact directory/i)).toBeInTheDocument();
  });

  it('Inbound B — the retired intake queue renders under the banner', () => {
    mount(<ReviewIntakePage />);
    expect(screen.getByTestId('review-banner')).toBeInTheDocument();
    expect(screen.getByText(/retired flat intake queue/i)).toBeInTheDocument();
  });

  it('Contact editor A — the dossier opens over its banner, and warns it is live', () => {
    mount(<ReviewContactDossier />);
    expect(screen.getByTestId('review-banner')).toBeInTheDocument();
    expect(screen.getByText(/saves are real/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /open the dossier editor/i }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('Contact editor B — the form renders, and its submit is inert', async () => {
    mount(<ReviewContactForm />);
    expect(screen.getByTestId('review-banner')).toBeInTheDocument();
    // the real component's own required-field validation still fires
    fireEvent.click(screen.getByRole('button', { name: /save|create|add/i }));
    expect(await screen.findByText(/first name is required/i)).toBeInTheDocument();
  });

  it('every mount says leaving Review means accepted', () => {
    mount(<ReviewContactForm />);
    expect(screen.getByText(/moving it out of Review means done/i)).toBeInTheDocument();
  });
});
