/* Gifting data-access. Gift creation at scale happens server-side (after payment),
 * but for the request-to-gift / invite-only model we capture the gift as a request
 * and let FHE fulfill + send the reveal link. Reveal + redeem use SECURITY DEFINER
 * RPCs so the gifts table is never exposed directly.
 */
import { supabase } from './supabase';

export interface GiftReveal {
  item_type: string;
  item_label: string;
  recipient_name: string | null;
  gift_message: string | null;
  buyer_name: string | null;
  status: string;
  unlock_gate: string;
  unlocked: boolean;
}

export interface GiftPurchaseInput {
  itemType: string;      // 'lessons' | 'membership' | ...
  itemLabel: string;
  buyerName: string;
  buyerEmail: string;
  recipientName: string;
  recipientEmail?: string;
  message?: string;
}

/** Look up + open a gift by its code (marks it opened). Null if invalid. */
export async function openGift(code: string): Promise<GiftReveal | null> {
  const { data, error } = await supabase.rpc('open_gift', { p_code: code });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  return (row as GiftReveal) ?? null;
}

/** Redeem the gift for the signed-in user. Returns a status string — including
 *  'redemption_failed' when provisioning didn't complete (the gift stays
 *  redeemable; try again or contact us). */
export async function redeemGift(code: string): Promise<string> {
  const { data, error } = await supabase.rpc('redeem_gift', { p_code: code });
  if (error) throw error;
  return data as string;
}

/** Create an account for a gift recipient who has none yet. The gift code is
 *  the credential (open_gift/redeem_gift are unguarded/self-guarding for the
 *  same reason) — not an invitation token, so this hits its own endpoint
 *  rather than the invited-registration path. Signs the new account in on
 *  success; the caller still needs to call redeemGift() after. */
export async function registerForGift(code: string, email: string, password: string): Promise<void> {
  const resp = await fetch('/api/register-gift', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code, email, password }),
  });
  if (!resp.ok) {
    const payload = await resp.json().catch(() => ({ error: '' }));
    throw new Error(payload.error || 'Could not create your account.');
  }
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
}

/** Staff-only: the one gift-creation path (D4). Converts a reviewed inquiry +
 *  a real catalog offering into a redeemable gift. item_type/item_label/amount
 *  are captured server-side from the offering, never passed as free text. */
export interface CreateGiftInput {
  offeringId: string;
  buyerName: string;
  buyerEmail: string;
  recipientName: string;
  recipientEmail?: string;
  giftMessage?: string;
  markPaid?: boolean;
  requestId?: string;
}
export interface CreateGiftResult {
  giftId: string;
  code: string;
  claimLink: string;
  buyerContactId: string | null;
}
export async function createGift(input: CreateGiftInput): Promise<CreateGiftResult> {
  const { data, error } = await supabase.rpc('create_gift', {
    p_offering_id: input.offeringId,
    p_buyer_name: input.buyerName,
    p_buyer_email: input.buyerEmail,
    p_recipient_name: input.recipientName,
    p_recipient_email: input.recipientEmail ?? null,
    p_gift_message: input.giftMessage ?? null,
    p_mark_paid: input.markPaid ?? false,
    p_request_id: input.requestId ?? null,
  });
  if (error) throw error;
  return {
    giftId: data.gift_id,
    code: data.code,
    claimLink: data.claim_link,
    buyerContactId: data.buyer_contact_id ?? null,
  };
}

/**
 * Submit a gift purchase as a request (invite-only model: FHE fulfills, generates
 * the code, and sends the recipient the reveal link). Records as a request with
 * the gift details in the notes/selection so it lands in the admin queue.
 */
export async function requestGift(input: GiftPurchaseInput): Promise<void> {
  const { error } = await supabase.from('requests').insert({
    contact_name: input.buyerName,
    contact_email: input.buyerEmail,
    notes:
      `GIFT for ${input.recipientName}` +
      (input.recipientEmail ? ` <${input.recipientEmail}>` : '') +
      `: ${input.itemLabel} (${input.itemType}).` +
      (input.message ? ` Message: "${input.message}"` : ''),
    proposed_times: [],
  });
  if (error) throw error;
}

// ── Gift actions (Stage 4c) ──────────────────────────────────────────────────

/** The recipient-facing claim link for a gift (buyer or staff). */
export async function giftClaimLink(giftId: string): Promise<string> {
  const { data, error } = await supabase.rpc('gift_claim_link', { p_gift_id: giftId });
  if (error) throw error;
  return data as string;
}

/** Move the delivery date of an unredeemed gift. */
export async function giftReschedule(giftId: string, deliverOn: string): Promise<void> {
  const { error } = await supabase.rpc('gift_reschedule', { p_gift_id: giftId, p_deliver_on: deliverOn });
  if (error) throw error;
}

/** Send an unredeemed gift to a different recipient. */
export async function giftTransfer(giftId: string, recipientName: string, recipientEmail?: string): Promise<void> {
  const { error } = await supabase.rpc('gift_transfer', {
    p_gift_id: giftId,
    p_recipient_name: recipientName,
    p_recipient_email: recipientEmail ?? null,
  });
  if (error) throw error;
}

/** Record a (re)send of the gift's reveal link. */
export async function giftMarkSent(giftId: string): Promise<void> {
  const { error } = await supabase.rpc('gift_mark_sent', { p_gift_id: giftId });
  if (error) throw error;
}
