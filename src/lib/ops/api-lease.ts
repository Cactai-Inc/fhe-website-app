/* Lease seam (post-realign): the operational lease terms now live on the lease
 * CONTRACT (contract_fields), edited in ContractPage. This file only carries the
 * availability generator, which reads the horse's executed lease document. */
import { supabase } from '../supabase';

/** Generate the leased horse's flexible availability onto the calendar for the
 *  next N weeks (used days ∩ lease window ∩ business hours), read from the
 *  horse's executed HORSE_LEASE contract. Returns count made. */
export async function generateLeaseAvailability(horseId: string, weeks = 4): Promise<number> {
  const { data, error } = await supabase.rpc('generate_lease_availability', { p_horse_id: horseId, p_weeks: weeks });
  if (error) throw error;
  return ((data as { created: number })?.created) ?? 0;
}

// ─── Partial-lease participants + payment options (S5) ───────────────────────

export interface LeaseParticipant {
  contact_id: string;
  name: string;
  days_used: string | null;
  hours: string | null;
  usage_pct: number | null;
  payment_pct: number | null;
}
export interface LeasePaymentOptionRow {
  id: string;
  amount: number | null;
  describe: string | null;
}

export async function fetchLeaseParticipants(documentId: string): Promise<LeaseParticipant[]> {
  const { data, error } = await supabase.rpc('lease_participants_for_doc', { p_document_id: documentId });
  if (error) throw error;
  return (data ?? []) as LeaseParticipant[];
}
export async function addLeaseParticipant(input: {
  documentId: string; contactId: string;
  days?: string | null; hours?: string | null; usagePct?: number | null; paymentPct?: number | null;
}): Promise<void> {
  const { error } = await supabase.rpc('add_lease_participant', {
    p_document_id: input.documentId, p_contact_id: input.contactId,
    p_days: input.days ?? null, p_hours: input.hours ?? null,
    p_usage_pct: input.usagePct ?? null, p_payment_pct: input.paymentPct ?? null,
  });
  if (error) throw error;
}
export async function removeLeaseParticipant(documentId: string, contactId: string): Promise<void> {
  const { error } = await supabase.rpc('remove_lease_participant', { p_document_id: documentId, p_contact_id: contactId });
  if (error) throw error;
}

export async function fetchLeasePaymentOptions(documentId: string): Promise<LeasePaymentOptionRow[]> {
  const { data, error } = await supabase.rpc('lease_payment_options_for_doc', { p_document_id: documentId });
  if (error) throw error;
  return (data ?? []) as LeasePaymentOptionRow[];
}
export async function addLeasePaymentOption(documentId: string, amount: number | null, describe: string): Promise<void> {
  const { error } = await supabase.rpc('add_lease_payment_option', { p_document_id: documentId, p_amount: amount, p_describe: describe });
  if (error) throw error;
}
export async function removeLeasePaymentOption(id: string): Promise<void> {
  const { error } = await supabase.rpc('remove_lease_payment_option', { p_id: id });
  if (error) throw error;
}
