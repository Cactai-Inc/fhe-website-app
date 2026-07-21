/* Lease seam: the operational lease terms live on the lease CONTRACT (clause
 * defs, edited in ContractPage). This file only carries the availability
 * generator, which reads the horse's executed lease document.
 *
 * The old partial-lease participants / payment-options helpers were removed with
 * LeaseExtrasSection (2026-07-20 cutover) — the clause-model lease captures
 * shared-use via its own fields (TXN.SHARED_WITH). */
import { supabase } from '../supabase';

/** Generate the leased horse's flexible availability onto the calendar for the
 *  next N weeks (used days ∩ lease window ∩ business hours), read from the
 *  horse's executed lease contract. Returns count made. */
export async function generateLeaseAvailability(horseId: string, weeks = 4): Promise<number> {
  const { data, error } = await supabase.rpc('generate_lease_availability', { p_horse_id: horseId, p_weeks: weeks });
  if (error) throw error;
  return ((data as { created: number })?.created) ?? 0;
}
