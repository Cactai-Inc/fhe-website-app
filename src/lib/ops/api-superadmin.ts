/**
 * INT-API-SUPERADMIN — data wrappers for the platform-operator (SUPER_ADMIN) lane.
 *
 * Reads:
 *   organizations (mig 24: RLS organizations_read — is_admin() covers SUPER_ADMIN),
 *   tiers / modules / tier_modules (mig U2 entitlements: world-readable catalog).
 *
 * Writes: NONE directly. Provisioning goes through the single blessed path,
 * POST /api/admin-provision-tenant (bearer token of a SUPER_ADMIN), which
 * find-or-creates the admin auth user then calls the atomic provision_tenant()
 * RPC (supabase/migrations/20260630050000_provision_tenant.sql, §9).
 */
import { supabase } from '../supabase';

// ─── Row shapes (mirror the migrations) ──────────────────────────────────────

export interface OrganizationRow {
  id: string;
  display_code: string | null;
  name: string;
  slug: string | null;
  status: string;
  created_at: string;
}

export interface TierOption {
  tier_key: string;
  name: string;
  monthly_price: number | null;
  sort_order: number;
}

export interface ModuleOption {
  module_key: string;
  name: string;
  description: string | null;
  is_core: boolean;
}

export interface TierModuleRow {
  tier_key: string;
  module_key: string;
}

export interface ProvisionTenantInput {
  name: string;
  slug: string;
  tierKey: string;
  adminEmail: string;
  /** config_values seeds — keys prefixed BRAND./CONTACT./MODULE.<mod>. route to
   *  the matching namespace inside provision_tenant(); bare keys default to BRAND. */
  brand: Record<string, string>;
  /** business_config legal columns (LEGAL_NAME, ENTITY_FORMATION, …). */
  legal: Record<string, string>;
  /** business_config rate columns (COMMISSION_*_RATE, *_FEE, SALES_TAX_RATE). */
  rates: Record<string, string>;
  /** Explicit add-on module keys beyond the tier's grants. */
  modules: string[];
}

export interface ProvisionTenantResult {
  org_id: string;
}

// ─── Organizations ───────────────────────────────────────────────────────────

export async function listOrganizations(): Promise<OrganizationRow[]> {
  const { data, error } = await supabase
    .from('organizations')
    .select('id, display_code, name, slug, status, created_at')
    .is('deleted_at', null)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as OrganizationRow[];
}

// ─── Packaging catalog (tiers / modules / tier_modules) ──────────────────────

export async function listTiers(): Promise<TierOption[]> {
  const { data, error } = await supabase
    .from('tiers')
    .select('tier_key, name, monthly_price, sort_order')
    .eq('active', true)
    .order('sort_order');
  if (error) throw error;
  return (data ?? []) as TierOption[];
}

/** Add-on candidates: the non-core (mod.*) modules. Core modules ship with
 *  every tenant and are not entitlement rows a wizard toggles. */
export async function listAddonModules(): Promise<ModuleOption[]> {
  const { data, error } = await supabase
    .from('modules')
    .select('module_key, name, description, is_core')
    .eq('active', true)
    .eq('is_core', false)
    .order('module_key');
  if (error) throw error;
  return (data ?? []) as ModuleOption[];
}

/** The global tier→module grant map, so the wizard can show which modules the
 *  chosen tier already includes (and only offer the rest as add-ons). */
export async function listTierModules(): Promise<TierModuleRow[]> {
  const { data, error } = await supabase
    .from('tier_modules')
    .select('tier_key, module_key');
  if (error) throw error;
  return (data ?? []) as TierModuleRow[];
}

// ─── Provisioning (the single blessed path — §9) ─────────────────────────────

/**
 * POST /api/admin-provision-tenant with the caller's Supabase access token
 * (same auth-header pattern as src/lib/admin.ts adminSendInvitation). The API
 * authorizes SUPER_ADMIN, find-or-creates the admin auth user, then runs the
 * atomic provision_tenant() RPC. Returns { org_id }.
 */
export async function provisionTenant(input: ProvisionTenantInput): Promise<ProvisionTenantResult> {
  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token;

  const res = await fetch('/api/admin-provision-tenant', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    let msg = '';
    try {
      const body = (await res.json()) as { error?: string };
      msg = body?.error ?? '';
    } catch {
      /* non-JSON error body */
    }
    throw new Error(msg || 'Could not provision the tenant.');
  }
  return (await res.json()) as ProvisionTenantResult;
}
