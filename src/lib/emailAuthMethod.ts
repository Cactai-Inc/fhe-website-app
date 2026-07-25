/**
 * Which sign-in method(s) to offer on the invite-activation page, decided by
 * where the invited email is hosted (owner spec 2026-07-25):
 *
 *  - 'google'   Gmail / Google consumer mail → "Continue with Google" ONLY.
 *  - 'password' A known non-Google consumer mailbox (hotmail, outlook, yahoo,
 *               icloud, …) → email + password ONLY (no Google button — pressing
 *               it would authenticate a DIFFERENT Google account than the invited
 *               address).
 *  - 'both'     Anything else — a custom/company domain that MIGHT be Google
 *               Workspace (e.g. jane@herbusiness.com). We can't tell from the
 *               domain alone, so show both and explain how to choose.
 *
 * Domain-only classification: no DNS/MX lookup (deterministic, offline). 'both'
 * is the deliberate safety valve for the ambiguous middle.
 */

export type AuthMethod = 'google' | 'password' | 'both';

/** Google-hosted consumer domains → Google is the only correct method. */
const GOOGLE_CONSUMER_DOMAINS: ReadonlySet<string> = new Set([
  'gmail.com', 'googlemail.com',
]);

/** Known NON-Google consumer mailbox providers → password only. Not exhaustive
 *  of the internet — just the common consumer webmail hosts a client is
 *  realistically invited under. Unknown domains fall through to 'both'. */
const KNOWN_NON_GOOGLE_DOMAINS: ReadonlySet<string> = new Set([
  // Microsoft
  'hotmail.com', 'hotmail.co.uk', 'outlook.com', 'outlook.co.uk',
  'live.com', 'live.co.uk', 'msn.com', 'windowslive.com',
  // Yahoo / AOL / Verizon
  'yahoo.com', 'yahoo.co.uk', 'yahoo.ca', 'ymail.com', 'rocketmail.com',
  'aol.com', 'aim.com', 'verizon.net',
  // Apple
  'icloud.com', 'me.com', 'mac.com',
  // Privacy / European consumer webmail
  'proton.me', 'protonmail.com', 'pm.me',
  'gmx.com', 'gmx.net', 'gmx.de', 'web.de',
  'zoho.com', 'yandex.com', 'mail.com', 'fastmail.com',
  // US ISP mailboxes
  'comcast.net', 'sbcglobal.net', 'att.net', 'cox.net',
  'bellsouth.net', 'charter.net', 'earthlink.net',
]);

/** Lowercased domain portion of an email, or null if it doesn't parse. */
export function emailDomain(email: string | null | undefined): string | null {
  if (!email) return null;
  const at = email.lastIndexOf('@');
  if (at <= 0 || at === email.length - 1) return null;
  const domain = email.slice(at + 1).trim().toLowerCase();
  return domain.includes('.') ? domain : null;
}

/** Decide which auth method(s) to present for an invited email address.
 *  Unparseable/empty → 'both' (never strand a user with zero options). */
export function authMethodForEmail(email: string | null | undefined): AuthMethod {
  const domain = emailDomain(email);
  if (!domain) return 'both';
  if (GOOGLE_CONSUMER_DOMAINS.has(domain)) return 'google';
  if (KNOWN_NON_GOOGLE_DOMAINS.has(domain)) return 'password';
  return 'both';
}
