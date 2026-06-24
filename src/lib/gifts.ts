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

/** Redeem the gift for the signed-in user. Returns a status string. */
export async function redeemGift(code: string): Promise<string> {
  const { data, error } = await supabase.rpc('redeem_gift', { p_code: code });
  if (error) throw error;
  return data as string;
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
