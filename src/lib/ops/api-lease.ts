/* Lease terms (Phase 8) — structured terms for a horse lease plus generation of
 * the leased horse's availability onto the calendar. Staff-gated server-side. */
import { supabase } from '../supabase';

export interface LeasePaymentOption {
  amount: number | null;
  describe: string;
}

export interface LeaseTerms {
  id?: string;
  horse_id: string;
  lessee_contact_id: string | null;
  payment_options: LeasePaymentOption[];
  days_used: string[];
  days_unavailable: string[];
  lessons_per_day: { beginner?: number; intermediate?: number; advanced?: number };
  exclusivity_rules: string[];
  events_authorized: boolean;
  shared_with_contact_id: string | null;
  notes: string | null;
}

export async function fetchLeaseTerms(horseId: string): Promise<LeaseTerms | null> {
  const { data, error } = await supabase.rpc('lease_terms_for_horse', { p_horse_id: horseId });
  if (error) throw error;
  return (data as LeaseTerms) ?? null;
}

export async function saveLeaseTerms(terms: LeaseTerms): Promise<{ id: string; horse_id: string }> {
  const { data, error } = await supabase.rpc('save_lease_terms', { p: terms });
  if (error) throw error;
  return data as { id: string; horse_id: string };
}

/** Generate the leased horse's flexible availability onto the calendar for the
 *  next N weeks (used days ∩ lease window ∩ business hours). Returns count made. */
export async function generateLeaseAvailability(horseId: string, weeks = 4): Promise<number> {
  const { data, error } = await supabase.rpc('generate_lease_availability', { p_horse_id: horseId, p_weeks: weeks });
  if (error) throw error;
  return ((data as { created: number })?.created) ?? 0;
}
