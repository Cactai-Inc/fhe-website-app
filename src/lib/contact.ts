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
  // wa.me wants digits only, no +, no spaces.
  return `https://wa.me/${number.replace(/[^\d]/g, '')}`;
}
export function mailHref(email: string, subject?: string): string {
  const q = subject ? `?subject=${encodeURIComponent(subject)}` : '';
  return `mailto:${email.trim()}${q}`;
}

export type ContactMethod = 'email' | 'sms' | 'call' | 'whatsapp';

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
  if (info.whatsapp && (info.allowWhatsappText !== false || info.allowWhatsappCall !== false)) {
    out.push({ method: 'whatsapp', href: whatsappHref(info.whatsapp), label: 'WhatsApp' });
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
  hide_email: boolean;
  hide_mobile: boolean;
  hide_whatsapp: boolean;
  social_tiktok: string | null;
  social_instagram: string | null;
  social_facebook: string | null;
  social_linkedin: string | null;
  payment_reminders: boolean;
}

const PREF_COLS =
  'email, mobile, whatsapp, allow_sms, allow_call, allow_whatsapp, ' +
  'hide_email, hide_mobile, hide_whatsapp, ' +
  'social_tiktok, social_instagram, social_facebook, social_linkedin, payment_reminders';

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
