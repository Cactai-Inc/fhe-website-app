/* Contact link helpers. Turn stored contact values into the right launch URL so the
 * roster / resources / profile buttons open the native client — plus the member's
 * own contact-prefs read/save (contacts columns, RLS own-row).
 *
 * FIVE-CHANNEL MODEL (2026-08-01): a member shares up to five independent
 * community contact values — mobile_call, mobile_text, whatsapp_call,
 * whatsapp_text, community_email — each with its own hide switch. The old
 * one-value-plus-allow-toggles model is retired; a channel is offered exactly
 * when its field has a value AND is not hidden (the member_directory view nulls
 * hidden fields server-side, so by the time data reaches this module a present
 * value IS an offered channel). The company-on-file number (contacts.phone) is
 * separate and never edited here. */
import { supabase } from './supabase';
import { assertWrote } from './writeGuard';

export function telHref(number: string): string {
  return `tel:${number.replace(/[^\d+]/g, '')}`;
}
export function smsHref(number: string): string {
  return `sms:${number.replace(/[^\d+]/g, '')}`;
}
export function whatsappHref(number: string): string {
  // wa.me wants digits only, no +, no spaces. Opens a chat.
  return `https://wa.me/${number.replace(/[^\d]/g, '')}`;
}
export function whatsappCallHref(number: string): string {
  // Deep link that opens WhatsApp straight to a voice call for the number.
  return `whatsapp://call?phone=${number.replace(/[^\d]/g, '')}`;
}
export function mailHref(email: string, subject?: string): string {
  const q = subject ? `?subject=${encodeURIComponent(subject)}` : '';
  return `mailto:${email.trim()}${q}`;
}

export type ContactMethod = 'email' | 'sms' | 'call' | 'whatsapp' | 'whatsapp_call';

/** A member's preferred way to be reached (a hint shown on their profile — all their
 *  shared channels still appear, this just flags the favored one). 'platform' = a
 *  message on French Heritage; 'none' = no stated preference. */
export type PreferredContact =
  | 'none' | 'platform' | 'email' | 'sms' | 'call' | 'whatsapp'
  | 'instagram' | 'facebook' | 'linkedin' | 'tiktok';

/** Label + the channel field a preference depends on (so the picker only offers
 *  channels the member has actually filled in). `requires` null → always available. */
export const PREFERRED_CONTACT_OPTIONS: {
  value: PreferredContact; label: string; requires: keyof MyContactPrefs | null;
}[] = [
  { value: 'none',      label: 'No preference',        requires: null },
  { value: 'platform',  label: 'Message on French Heritage', requires: null },
  { value: 'email',     label: 'Email',                requires: 'community_email' },
  { value: 'sms',       label: 'Text message',         requires: 'mobile_text' },
  { value: 'call',      label: 'Phone call',           requires: 'mobile_call' },
  { value: 'whatsapp',  label: 'WhatsApp',             requires: 'whatsapp_text' },
  { value: 'instagram', label: 'Instagram',            requires: 'social_instagram' },
  { value: 'facebook',  label: 'Facebook',             requires: 'social_facebook' },
  { value: 'linkedin',  label: 'LinkedIn',             requires: 'social_linkedin' },
  { value: 'tiktok',    label: 'TikTok',               requires: 'social_tiktok' },
];

/** Short label for displaying a member's preference on their profile. */
export function preferredContactLabel(v: PreferredContact | null | undefined): string | null {
  if (!v || v === 'none') return null;
  return PREFERRED_CONTACT_OPTIONS.find((o) => o.value === v)?.label ?? null;
}

/** The five community channels as read from member_directory (hidden fields
 *  arrive as null — a hidden channel is indistinguishable from an empty one,
 *  which is the point). */
export interface ContactInfo {
  communityEmail?: string | null;
  mobileCall?: string | null;
  mobileText?: string | null;
  whatsappCall?: string | null;
  whatsappText?: string | null;
}

/** The concrete, launchable contact actions for a person. A channel appears
 *  exactly when its field carries a value — visibility was already enforced
 *  server-side by the member_directory view. */
export function contactActions(info: ContactInfo): { method: ContactMethod; href: string; label: string }[] {
  const out: { method: ContactMethod; href: string; label: string }[] = [];
  if (info.communityEmail) out.push({ method: 'email', href: mailHref(info.communityEmail), label: 'Email' });
  if (info.mobileText) out.push({ method: 'sms', href: smsHref(info.mobileText), label: 'Text' });
  if (info.mobileCall) out.push({ method: 'call', href: telHref(info.mobileCall), label: 'Call' });
  if (info.whatsappText) out.push({ method: 'whatsapp', href: whatsappHref(info.whatsappText), label: 'WhatsApp' });
  if (info.whatsappCall) out.push({ method: 'whatsapp_call', href: whatsappCallHref(info.whatsappCall), label: 'WhatsApp Call' });
  return out;
}

// ── The member's own contact prefs (Account → Profile section) ──────────────

export interface MyContactPrefs {
  /** Account/login email — read-only here (managed by the email-change flow),
   *  shown for reference; never community-visible directly. */
  email: string | null;
  /** The five community channels — each fully the member's to set, each with
   *  its own hide switch below. Seeded once from the company-on-file number
   *  (or account email) at capture; independent ever after. */
  community_email: string | null;
  mobile_call: string | null;
  mobile_text: string | null;
  whatsapp_call: string | null;
  whatsapp_text: string | null;
  hide_community_email: boolean;
  hide_mobile_call: boolean;
  hide_mobile_text: boolean;
  hide_whatsapp_call: boolean;
  hide_whatsapp_text: boolean;
  social_tiktok: string | null;
  social_instagram: string | null;
  social_facebook: string | null;
  social_linkedin: string | null;
  preferred_contact: PreferredContact;
  /** The mailing address — the SAME columns the onboarding intake writes and the
   *  contract party tokens compose from (LESSEE.ADDRESS via
   *  fill_party_fields_from_contacts → compose_address). */
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
}

const PREF_COLS =
  'email, community_email, mobile_call, mobile_text, whatsapp_call, whatsapp_text, ' +
  'hide_community_email, hide_mobile_call, hide_mobile_text, hide_whatsapp_call, hide_whatsapp_text, ' +
  'social_tiktok, social_instagram, social_facebook, social_linkedin, preferred_contact, ' +
  'address_line1, address_line2, city, state, postal_code';

/** Load the signed-in member's contact prefs from their CONTACT row.
 *  Reads through the profile's contact_id rather than assuming one: an account
 *  without a contact (the platform owner, per D1) simply has no prefs. */
export async function getMyContactPrefs(): Promise<MyContactPrefs | null> {
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth?.user?.id;
  if (!uid) return null;
  const { data: prof, error: profErr } = await supabase
    .from('profiles').select('contact_id').eq('user_id', uid).single();
  if (profErr) throw profErr;
  const contactId = (prof as { contact_id: string | null } | null)?.contact_id;
  if (!contactId) return null;
  const { data, error } = await supabase
    .from('contacts').select(PREF_COLS).eq('id', contactId).single();
  if (error) throw error;
  return data as unknown as MyContactPrefs;
}

/** Save a partial set of contact prefs on the member's own CONTACT row (the
 *  account email is managed by the email-change flow, never written here —
 *  community_email IS writable, that's the point of it).
 *
 *  RLS: `contacts_update_own` allows `id = current_contact_id()`, so a member may
 *  write their own record and no one else's. assertWrote() proves the write
 *  landed — a policy-filtered UPDATE returns no error, just zero rows. */
export async function saveMyContactPrefs(patch: Partial<Omit<MyContactPrefs, 'email'>>): Promise<void> {
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth?.user?.id;
  if (!uid) throw new Error('not signed in');
  const { data: prof, error: profErr } = await supabase
    .from('profiles').select('contact_id').eq('user_id', uid).single();
  if (profErr) throw profErr;
  const contactId = (prof as { contact_id: string | null } | null)?.contact_id;
  if (!contactId) throw new Error('Your account has no contact record to update.');
  const res = await supabase.from('contacts').update(patch).eq('id', contactId).select('id');
  assertWrote(res, 'Your changes');
}
