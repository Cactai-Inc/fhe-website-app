/* Email-change seams (Update B backend). The styled UI lives in EmailChangeModal +
 * VerifyEmailScreen; these functions are the `seams` props they expect
 * (HANDOFF-email-change.md). Backend: /api/email-change-start + /api/email-change-complete.
 *
 * password path: start sets the new password + emails a token link → the member
 * lands on /verify-email and confirms with new email + that password.
 * google path:  start registers the pending change, then linkIdentity(google)
 * redirects through Google consent back to /verify-email?mode=google&token=… where
 * the linked identity is the proof. No verification email. */
import { supabase } from './supabase';

async function accessToken(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  const t = data?.session?.access_token;
  if (!t) throw new Error('You need to be signed in.');
  return t;
}

async function post(path: string, body: unknown, bearer?: string): Promise<Record<string, unknown>> {
  const res = await fetch(path, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}),
    },
    body: JSON.stringify(body),
  });
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) throw new Error((json.error as string) || 'Request failed.');
  return json;
}

/** Google path: register the pending change, then hand off to Google consent.
 *  The page NAVIGATES AWAY on success — the flow completes on /verify-email. */
export async function startGoogleChange(newEmail: string): Promise<void> {
  const bearer = await accessToken();
  const { token } = await post('/api/email-change-start', { newEmail, mode: 'google' }, bearer);
  const redirectTo =
    `${window.location.origin}/verify-email?token=${token}&mode=google`;
  const { data, error } = await supabase.auth.linkIdentity({
    provider: 'google',
    options: { redirectTo },
  });
  if (error) throw new Error(error.message);
  // linkIdentity returns a URL to navigate to (or navigates itself). Belt+braces:
  if (data?.url) window.location.assign(data.url);
  // keep the modal in its busy state until the browser leaves the page
  await new Promise(() => {});
}

/** Password path: set the password + send the verification email. Resolves when
 *  the email is on its way (the modal then shows "check your inbox"). */
export async function startPasswordChange(newEmail: string, password: string): Promise<void> {
  const bearer = await accessToken();
  await post('/api/email-change-start', { newEmail, mode: 'password', password }, bearer);
}

/** /verify-email landing, password path: token + new email + password → promote. */
export async function verifyWithPassword(token: string, email: string, password: string): Promise<void> {
  await post('/api/email-change-complete', { token, mode: 'password', email, password });
}

/** /verify-email landing, google path: the session now carries the linked Google
 *  identity; the server checks it and promotes. */
export async function verifyWithGoogle(token: string): Promise<void> {
  const bearer = await accessToken();
  await post('/api/email-change-complete', { token, mode: 'google' }, bearer);
}
