/**
 * OPS-DOC-REQUIRED data seam (lane-owned; src/lib/api.ts is integrator-owned).
 *
 * Thin, typed wrapper over supabase.from('contract_requirements') — the
 * signing-requirements matrix created by
 * 20260701070000_liability_releases.sql: (service_type, template_key) rows
 * meaning "a purchase of this service requires this document signed"
 * (releases, facility rules, medical/vet authorizations). RLS (RESTRICTIVE
 * org_boundary + authenticated read) is the authoritative fence; this seam
 * only shapes the call.
 */
import { supabase } from '../supabase';

/**
 * Template_keys of the documents the matrix requires signed for a service
 * type (the engagement's required signing set), alphabetical.
 */
export async function listRequiredDocuments(serviceType: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('contract_requirements')
    .select('template_key')
    .eq('service_type', serviceType)
    .order('template_key');
  if (error) throw error;
  return ((data ?? []) as { template_key: string }[]).map((r) => r.template_key);
}
