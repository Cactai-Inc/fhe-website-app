/**
 * LANE-PUBLIC data seams — the anonymous visitor surface (no session).
 *
 * ONE public flow now, fenced by RLS/RPC server-side (this file only shapes the
 * call; policies are the authority):
 *
 *  intake    — the unified public form (contact/inquiry/booking) writes ONE
 *              requests row through submit_public_request (see lib/api). The
 *              only thing read here is which fields a channel requires
 *              (intake_requirements RPC) so the form can enforce the owner's
 *              per-channel configuration.
 *
 * ⚠️ THE RELEASE KIOSK SEAMS WERE REMOVED 2026-09-01 (TASK-SIGNFLOW-D).
 * `fetchReleasePreview`, `signRelease` and their types served /release and
 * /docs/release-participant — the two surfaces that signed a real document for
 * someone with no account. Owner: "we dont have a situation where a person
 * without an account signs documents on an ipad or any other way." Signing now
 * happens only inside an account, reached through /sign and /app/onboarding, and
 * `sign_release`/`sign_general_release` no longer carry an anon EXECUTE grant
 * (20260902T0010). Nothing anonymous writes a signature from this file.
 */
import { supabase } from '../supabase';

// ---------------------------------------------------------------------------
// unified intake — per-channel required-field config (owner-set, read by anon)
// ---------------------------------------------------------------------------

/** The required-field map for a channel, e.g. { phone: true, message: false }.
 *  Base fields (first/last/email) are always required and not in this map. */
export async function fetchIntakeRequirements(channel: string): Promise<Record<string, boolean>> {
  const { data, error } = await supabase.rpc('intake_requirements', { p_channel: channel });
  if (error) throw error;
  return (data ?? {}) as Record<string, boolean>;
}
