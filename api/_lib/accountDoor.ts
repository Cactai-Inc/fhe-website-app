/* THE DOOR'S ONE ANSWER TO "WHO IS KNOCKING" — owner ruling, 2026-09-01.
 *
 * > *"if they already completed that flow and we just didnt realize it, the input
 * > of the email address should trigger an email to them that says click here to
 * > sign into your account. and the link takes them to the login page … if they
 * > didnt do that step and all they did was submit the form to us then the email
 * > should be recognized as belonging to that account but needing auth set up and
 * > docs signed."*
 *
 * ⚠️ THIS LIVES IN ONE FILE BECAUSE HE ASKED FOR ONE FLOW: *"that is the exact
 * same flow as this one, same link destination, everything."* Two callers — the
 * `/sign/*` door (`api/sign-start.ts`) and a website order submission
 * (`api/request-activation.ts`) — and if the branch were written twice they would
 * disagree about what "already has an account" means within a week (D18).
 *
 * ⚠️ ANTI-ENUMERATION IS UNAFFECTED, and it is worth being exact about why. The
 * rule is that the RESPONSE must not reveal whether an address is known. It still
 * does not: every caller reports the same send-outcome shape whichever branch ran.
 * What changes is which email WE send — a decision made server-side, from a
 * `service_role`-only function, and never surfaced to the browser.
 */
import type { getSupabaseAdmin } from './supabaseAdmin.js';
import { resolveTenantEmailIdentity, sendViaProvider } from './email.js';
import { renderEmailTemplate } from './emailTemplates.js';

type Db = ReturnType<typeof getSupabaseAdmin>;

/** What we hold on one address.
 *  · `active` — a working sign-in exists. Send them to the login page.
 *  · `known`  — we hold a record (a lead, an order, an invitation) and they have
 *               never set up auth. Send the activation email.
 *  · `new`    — nobody. Send the activation email. */
export type AccountState = 'active' | 'known' | 'new';

export interface AccountFacts {
  state: AccountState;
  userId: string | null;
  contactId: string | null;
}

/**
 * Read the state of one address.
 *
 * ⚠️ FAILS TO `'new'`, DELIBERATELY. If this read breaks, the caller provisions
 * and sends the activation email — which is exactly what every door did before
 * this existed. A degraded door that still onboards people is the right failure;
 * one that refuses everybody because a lookup hiccuped is not.
 */
export async function accountStateForEmail(db: Db, email: string): Promise<AccountFacts> {
  const { data, error } = await db.rpc('account_state_for_email', { p_email: email });
  if (error || !data) {
    if (error) console.error('accountStateForEmail failed; treating as new', { error: error.message });
    return { state: 'new', userId: null, contactId: null };
  }
  const d = data as { state?: string; user_id?: string | null; contact_id?: string | null };
  const state: AccountState =
    d.state === 'active' || d.state === 'known' ? d.state : 'new';
  return { state, userId: d.user_id ?? null, contactId: d.contact_id ?? null };
}

export interface SignInEmailResult {
  ok: boolean;
  messageId: string | null;
  error?: string;
}

/**
 * "You already have an account — click here to sign in", with the link on the
 * LOGIN page rather than on activation.
 *
 * ⚠️ NO TOKEN IN THIS LINK, and that is the point. There is nothing to claim:
 * they already hold the credential. Minting an invitation for somebody who can
 * sign in is what produced the 409 this ruling came out of.
 */
export async function sendSignInEmail(db: Db, input: {
  orgId: string | null;
  to: string;
  origin: string;
  greetingName?: string | null;
}): Promise<SignInEmailResult> {
  const identity = await resolveTenantEmailIdentity(db, input.orgId ?? '');
  const rendered = await renderEmailTemplate(db, 'SIGN_IN_EXISTING', {
    'ORG.BRAND_NAME': identity.fromName,
    'ORG.FOOTER': identity.footer,
    'MSG.LINK': `${identity.siteUrl ?? input.origin}/login`,
    'MSG.RECIPIENT_EMAIL': input.to,
    'PARTY.GREETING_NAME': input.greetingName ?? '',
  });
  if (!rendered) {
    return { ok: false, messageId: null, error: 'the SIGN_IN_EXISTING email template is missing or deactivated' };
  }
  const sent = await sendViaProvider({
    to: input.to,
    fromName: identity.fromName,
    fromEmail: identity.fromEmail,
    subject: rendered.subject,
    html: rendered.html,
  });
  return {
    ok: sent.ok,
    messageId: sent.messageId ?? null,
    ...(sent.ok ? {} : { error: sent.error ?? 'the email transport rejected the send' }),
  };
}

/** The first name we can greet them by, if we hold one. Never a placeholder. */
export async function greetingNameForContact(db: Db, contactId: string | null): Promise<string | null> {
  if (!contactId) return null;
  const { data } = await db.from('contacts').select('first_name').eq('id', contactId).maybeSingle();
  const n = (data as { first_name: string | null } | null)?.first_name ?? null;
  return n && n.trim() !== '' ? n.trim() : null;
}
