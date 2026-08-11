// @vitest-environment jsdom
/**
 * TASK-GOOGLEAUTH — the My Login control that lets a member activate Sign in
 * with Google themselves.
 *
 * These cover what this task changed and can be checked without a live
 * authenticated browser session (no real Supabase credentials exist in this
 * environment — see docs/reports/TASK-GOOGLEAUTH-REPORT.md): who is offered the
 * control, that it is never gated on the email domain, that the linked state
 * names the connected Google address even when it differs from the sign-in
 * email, and that every outcome is reported from the server's identity list
 * rather than from the fact that a redirect happened.
 *
 * `vi.mock` calls are hoisted to the top of the module by vitest regardless of
 * where they are written, so they live at top level here.
 */
import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import type { LinkedIdentity } from '../../src/lib/auth';
import { LoginSecurityCard } from '../../src/components/app/profile/LoginSecurityCard';
import { resetGoogleLinkReturnForTests } from '../../src/lib/googleLink';

const authUser = { id: 'user-1', email: 'member@icloud.com' };
let identities: LinkedIdentity[] = [];
const listLinkedIdentities = vi.fn(async () => identities);
const linkOAuthIdentity = vi.fn(async () => ({ error: null as string | null, code: null as string | null }));

vi.mock('../../src/contexts/AuthContext', () => ({
  useAuth: () => ({ user: authUser }),
}));
vi.mock('../../src/lib/auth', () => ({
  listLinkedIdentities: (...args: unknown[]) => listLinkedIdentities(...(args as [])),
  linkOAuthIdentity: (...args: unknown[]) => linkOAuthIdentity(...(args as [])),
  updatePassword: async () => ({ error: null }),
}));
vi.mock('../../src/lib/emailChange', () => ({
  startGoogleChange: async () => ({ error: null }),
  startPasswordChange: async () => ({ error: null }),
}));
vi.mock('../../src/components/app/EmailChangeModal', () => ({ EmailChangeModal: () => null }));

const PASSWORD_ONLY: LinkedIdentity[] = [
  { provider: 'email', email: 'member@icloud.com', linkedAt: '2026-07-28T00:00:00Z' },
];

beforeEach(() => {
  sessionStorage.clear();
  window.history.replaceState({}, '', '/app/account');
  resetGoogleLinkReturnForTests();
  identities = PASSWORD_ONLY;
  authUser.email = 'member@icloud.com';
  listLinkedIdentities.mockClear();
  linkOAuthIdentity.mockClear();
  linkOAuthIdentity.mockResolvedValue({ error: null, code: null });
});

// No global test-framework hooks are configured for vitest here (no
// `globals: true`), so @testing-library/react's auto-cleanup never engages.
afterEach(() => cleanup());

const activateButton = () => screen.findByTestId('activate-google-signin');

describe('who is offered the control', () => {
  it('offers it to a password-only member on a NON-Google address', async () => {
    render(<LoginSecurityCard />);
    expect(await activateButton()).toHaveTextContent(/activate sign in with google/i);
  });

  it('offers it to a password-only member on a Google address too — the domain is never the gate', async () => {
    authUser.email = 'member@gmail.com';
    identities = [{ provider: 'email', email: 'member@gmail.com', linkedAt: null }];
    render(<LoginSecurityCard />);
    expect(await activateButton()).toBeInTheDocument();
  });

  it('shows the linked state, not the control, once google is among the identities', async () => {
    identities = [
      { provider: 'email', email: 'member@icloud.com', linkedAt: null },
      { provider: 'google', email: 'member@icloud.com', linkedAt: '2026-08-11T00:00:00Z' },
    ];
    render(<LoginSecurityCard />);
    expect(await screen.findByText(/connected as member@icloud\.com/i)).toBeInTheDocument();
    expect(screen.queryByTestId('activate-google-signin')).not.toBeInTheDocument();
  });

  it('names the connected Google address when it differs from the sign-in email', async () => {
    identities = [
      { provider: 'email', email: 'member@icloud.com', linkedAt: null },
      { provider: 'google', email: 'someone.else@gmail.com', linkedAt: null },
    ];
    render(<LoginSecurityCard />);
    expect(await screen.findByText(/connected as someone\.else@gmail\.com/i)).toBeInTheDocument();
    // ...and reassures them their own sign-in email did not move.
    expect(screen.getByText(/has not changed/i)).toHaveTextContent(
      /You sign in here as member@icloud\.com, and that has not changed/i,
    );
  });
});

describe('pressing the control', () => {
  it('links the CURRENT account and stays busy while the browser leaves', async () => {
    render(<LoginSecurityCard />);
    fireEvent.click(await activateButton());
    await waitFor(() => expect(linkOAuthIdentity).toHaveBeenCalledWith('google', '/app/account'));
    const btn = await activateButton();
    // Terminal on purpose: the redirect is in flight, so it never returns to idle.
    await waitFor(() => expect(btn).toBeDisabled());
    expect(btn).toHaveTextContent(/taking you to google/i);
  });

  it('explains a configuration refusal that happens before any redirect, and unmarks the trip', async () => {
    linkOAuthIdentity.mockResolvedValue({ error: 'Manual linking is disabled', code: 'manual_linking_disabled' });
    render(<LoginSecurityCard />);
    fireEvent.click(await activateButton());
    expect(await screen.findByRole('alert')).toHaveTextContent(/cannot be activated yet/i);
    expect(sessionStorage.getItem('fhe.googleLink.pending')).toBeNull();
    expect(await activateButton()).toBeEnabled();
  });
});

describe('coming back from Google', () => {
  it('confirms success only from the server, never from the redirect', async () => {
    sessionStorage.setItem('fhe.googleLink.pending', '1');
    identities = [
      { provider: 'email', email: 'member@icloud.com', linkedAt: null },
      { provider: 'google', email: 'member.alt@gmail.com', linkedAt: null },
    ];
    render(<LoginSecurityCard />);
    expect(await screen.findByText(/connected as member\.alt@gmail\.com/i)).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('does NOT claim success when the redirect happened but the server has no google identity', async () => {
    sessionStorage.setItem('fhe.googleLink.pending', '1');
    render(<LoginSecurityCard />);
    expect(await screen.findByRole('status')).toHaveTextContent(/did not finish, so nothing changed/i);
    expect(screen.queryByText(/connected as/i)).not.toBeInTheDocument();
    expect(await activateButton()).toBeEnabled();
  });

  it('surfaces the conflict case as an explained message routed to staff', async () => {
    sessionStorage.setItem('fhe.googleLink.pending', '1');
    window.history.replaceState({}, '', '/app/account#error=server_error'
      + '&error_code=identity_already_exists&error_description=Identity+is+already+linked+to+another+user');
    render(<LoginSecurityCard />);
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/already attached to a different account/i);
    expect(alert).toHaveTextContent(/office/i);
    expect(alert).not.toHaveTextContent(/Identity is already linked to another user/);
  });

  it('says nothing at all on an ordinary visit that was not a return', async () => {
    render(<LoginSecurityCard />);
    await activateButton();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
});
