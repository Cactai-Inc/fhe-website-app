/**
 * Layer-C entitlement hooks (PLATFORM_ARCHITECTURE.md §4.3). These read the
 * module set + role/org already resolved by `AuthContext` (which called the
 * `my_modules()` RPC and holds it fail-closed to `[]` on error) — they do NOT
 * fetch. The server (RLS `_module_gate` + `require_module`) is the authoritative
 * fence; these hooks drive nav/route gating and `ModuleGate` (convenience only).
 *
 *   const modules = useModules();          // { 'mod.brokerage': true, 'mod.boarding': false, … }
 *   <ModuleGate moduleKey="mod.lessons" modules={modules}>…</ModuleGate>
 *
 *   const { role, orgId, isSuperAdmin, has } = useEntitlements();
 */
import { useMemo } from 'react';
import { useAuth, type AppRole } from '../../contexts/AuthContext';
import type { ModuleMap } from '../../components/ops/kit/ModuleGate';

/**
 * The full platform module catalog (§3). `useModules()` returns a boolean for
 * EVERY key — so a disabled module is present as `false`, not merely absent —
 * letting `ModuleGate`/nav read `modules['mod.boarding'] === false` directly
 * (fail-closed) rather than relying on key-absence.
 */
export const MODULE_CATALOG = [
  'core.tenancy',
  'core.roles',
  'core.registry',
  'core.branding',
  'core.contracts',
  'core.payments',
  'mod.brokerage',
  'mod.lessons',
  'mod.boarding',
  'mod.barnops',
  'mod.horserecords',
  'mod.employees',
] as const;

/**
 * The tenant's module map: every catalog key → enabled?, plus any extra enabled
 * key the server returned that is not (yet) in the static catalog. Reads the
 * `modules` string[] surfaced by AuthContext (fail-closed to none on RPC error).
 */
export function useModules(): ModuleMap {
  const { modules } = useAuth();
  return useMemo(() => {
    const enabled = new Set(modules);
    const map: ModuleMap = {};
    for (const key of MODULE_CATALOG) {
      map[key] = enabled.has(key);
    }
    // Surface any server-enabled key not in the static catalog (forward-compat)
    // as true; never downgrade a catalog key already set to true above.
    for (const key of modules) {
      map[key] = true;
    }
    return map;
  }, [modules]);
}

export interface Entitlements {
  /** Authoritative role from profiles.role (null when signed-out/unresolved). */
  role: AppRole | null;
  /** The caller's tenant id (null when signed-out/unresolved). */
  orgId: string | null;
  /** Tenant ADMIN or platform SUPER_ADMIN. */
  isAdmin: boolean;
  /** Platform operator — separate path, never OR'd into module checks (§4.2). */
  isSuperAdmin: boolean;
  /** The tenant's enabled module map (same shape as `useModules()`). */
  modules: ModuleMap;
  /** Convenience predicate: is a single module enabled for the tenant? */
  has: (key: string) => boolean;
}

/**
 * Role + tenant + entitlement bridge for nav/route gating. Reads AuthContext;
 * pairs with `useModules()` and `ModuleGate`.
 */
export function useEntitlements(): Entitlements {
  const { role, orgId, isAdmin, isSuperAdmin } = useAuth();
  const modules = useModules();
  return useMemo(
    () => ({
      role,
      orgId,
      isAdmin,
      isSuperAdmin,
      modules,
      has: (key: string) => modules[key] === true,
    }),
    [role, orgId, isAdmin, isSuperAdmin, modules],
  );
}
