/**
 * INT-API-ADMIN — data wrappers for the tenant-admin lane (modules + registry).
 *
 * Reads:
 *   profiles.org_id      (mig 24 organizations: the caller's tenant membership),
 *   org_modules          (mig U2 entitlements: staff-readable per-tenant truth),
 *   config_keys          (mig U3 value registry: global whitelist, world-readable).
 *
 * Writes: NONE here. Toggles go through the SECURITY-DEFINER set_org_module()
 * RPC and registry saves through the config_values upsert — both already
 * wrapped in src/lib/api.ts (setOrgModule / upsertConfigValue /
 * configRequiredMissing), which the admin pages import directly.
 */
import { supabase } from '../supabase';

// ─── Row shapes (mirror the migrations) ──────────────────────────────────────

export interface OrgModuleRow {
  id: string;
  org_id: string;
  module_key: string;
  enabled: boolean;
  source: 'TIER' | 'ADDON' | 'GRANT' | 'SUBSCRIPTION';
  enabled_at: string;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ConfigKeyRow {
  namespace: string;
  key: string;
  expected_type: 'text' | 'num' | 'json';
  required: boolean;
  description: string | null;
}

// ─── Reads ───────────────────────────────────────────────────────────────────

/** The caller's tenant id (profiles.org_id). Null when signed out / unassigned. */
export async function getMyOrgId(): Promise<string | null> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return null;
  const { data, error } = await supabase
    .from('profiles')
    .select('org_id')
    .eq('user_id', auth.user.id)
    .maybeSingle();
  if (error) throw error;
  return (data as { org_id: string | null } | null)?.org_id ?? null;
}

/** The tenant's org_modules entitlement rows (RLS scopes to current_org()). */
export async function listOrgModules(): Promise<OrgModuleRow[]> {
  const { data, error } = await supabase
    .from('org_modules')
    .select('*')
    .order('module_key');
  if (error) throw error;
  return (data ?? []) as OrgModuleRow[];
}

/** The global config_keys whitelist (world-readable) — drives the registry editor. */
export async function listConfigKeys(): Promise<ConfigKeyRow[]> {
  const { data, error } = await supabase
    .from('config_keys')
    .select('*')
    .order('namespace')
    .order('key');
  if (error) throw error;
  return (data ?? []) as ConfigKeyRow[];
}
