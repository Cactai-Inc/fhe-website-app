/* Contact link helpers. Turn stored contact values into the right launch URL so the
 * roster / resources / profile buttons open the native client — plus the member's
 * own contact-prefs read/save (profiles columns, RLS own-row; the role guard keeps
 * sensitive columns admin-only, these are all self-editable). */
import { supabase } from './supabase';

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

/** Label + the profile field a preference depends on (so the picker only offers
 *  channels the member has actually filled in). `channel` null → always available. */
export const PREFERRED_CONTACT_OPTIONS: {
  value: PreferredContact; label: string; requires: keyof MyContactPrefs | null;
}[] = [
  { value: 'none',      label: 'No preference',        requires: null },
  { value: 'platform',  label: 'Message on French Heritage', requires: null },
  // Email is always part of the account, so it's always selectable (the stored
  // prefs.email can be null because it's managed by the auth/email-change flow).
  { value: 'email',     label: 'Email',                requires: null },
  { value: 'sms',       label: 'Text message',         requires: 'mobile' },
  { value: 'call',      label: 'Phone call',           requires: 'mobile' },
  { value: 'whatsapp',  label: 'WhatsApp',             requires: 'whatsapp' },
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

export interface ContactInfo {
  email?: string | null;
  mobile?: string | null;      // used for sms + call
  whatsapp?: string | null;    // used for whatsapp text/call
  allowSms?: boolean;
  allowCall?: boolean;
  allowWhatsappText?: boolean;
  allowWhatsappCall?: boolean;
}

/** The concrete, launchable contact actions for a person, honoring their toggles.
 *  Returns only methods that have a value AND permission. */
export function contactActions(info: ContactInfo): { method: ContactMethod; href: string; label: string }[] {
  const out: { method: ContactMethod; href: string; label: string }[] = [];
  if (info.email) out.push({ method: 'email', href: mailHref(info.email), label: 'Email' });
  if (info.mobile && info.allowSms !== false) out.push({ method: 'sms', href: smsHref(info.mobile), label: 'Text' });
  if (info.mobile && info.allowCall !== false) out.push({ method: 'call', href: telHref(info.mobile), label: 'Call' });
  if (info.whatsapp && info.allowWhatsappText !== false) {
    out.push({ method: 'whatsapp', href: whatsappHref(info.whatsapp), label: 'WhatsApp' });
  }
  if (info.whatsapp && info.allowWhatsappCall !== false) {
    out.push({ method: 'whatsapp_call', href: whatsappCallHref(info.whatsapp), label: 'WhatsApp Call' });
  }
  return out;
}

// ── The member's own contact prefs (Account → Profile section) ──────────────

export interface MyContactPrefs {
  email: string | null;
  mobile: string | null;
  whatsapp: string | null;
  allow_sms: boolean;
  allow_call: boolean;
  allow_whatsapp: boolean;
  allow_whatsapp_call: boolean;
  hide_email: boolean;
  hide_mobile: boolean;
  hide_whatsapp: boolean;
  social_tiktok: string | null;
  social_instagram: string | null;
  social_facebook: string | null;
  social_linkedin: string | null;
  preferred_contact: PreferredContact;
  payment_reminders: boolean;
}

const PREF_COLS =
  'email, mobile, whatsapp, allow_sms, allow_call, allow_whatsapp, allow_whatsapp_call, ' +
  'hide_email, hide_mobile, hide_whatsapp, ' +
  'social_tiktok, social_instagram, social_facebook, social_linkedin, preferred_contact, payment_reminders';

/** Load the signed-in member's contact prefs (own profiles row). */
export async function getMyContactPrefs(): Promise<MyContactPrefs | null> {
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth?.user?.id;
  if (!uid) return null;
  const { data, error } = await supabase
    .from('profiles').select(PREF_COLS).eq('user_id', uid).single();
  if (error) throw error;
  return data as unknown as MyContactPrefs;
}

/** Save a partial set of contact prefs on the member's own row (email is managed
 *  by the email-change flow, never written here). */
export async function saveMyContactPrefs(patch: Partial<Omit<MyContactPrefs, 'email'>>): Promise<void> {
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth?.user?.id;
  if (!uid) throw new Error('not signed in');
  const { error } = await supabase.from('profiles').update(patch).eq('user_id', uid);
  if (error) throw error;
}
