/**
 * OPS-DOC-DELIVER data seam (lane-owned; src/lib/api.ts is integrator-owned).
 *
 * Thin, typed read over supabase.from('engagement_parties') joined to
 * contacts, powering the delivery panel's recipient dropdown: staff picks a
 * PERSON (name — role (email)) instead of pasting a raw contact id. RLS
 * (org boundary on engagement_parties + contacts) is the authoritative fence;
 * this seam only shapes the call.
 */
import { supabase } from '../supabase';
import { contactName } from './types';
import type { EngagementPartyContact, PartyRole } from './types';

/**
 * The engagement's parties with their contact name (official canon:
 * first+last via contactName) and email, in signer order. `email` is null
 * when the contact has no address on file — the UI disables email sends to
 * such a recipient.
 */
export async function listEngagementPartyContacts(
  engagementId: string,
): Promise<EngagementPartyContact[]> {
  const { data, error } = await supabase
    .from('engagement_parties')
    .select('contact_id, party_role, contact:contacts(first_name, last_name, email)')
    .eq('engagement_id', engagementId)
    .order('signer_order', { ascending: true, nullsFirst: false });
  if (error) throw error;
  type Row = {
    contact_id: string;
    party_role: PartyRole;
    contact: { first_name: string | null; last_name: string | null; email: string | null } | null;
  };
  return ((data ?? []) as unknown as Row[]).map((r) => ({
    contact_id: r.contact_id,
    party_role: r.party_role,
    name: contactName(r.contact),
    email: r.contact?.email ?? null,
  }));
}
