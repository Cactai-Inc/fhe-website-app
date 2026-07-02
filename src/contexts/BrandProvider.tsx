import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { orgPublicConfig } from '../lib/api';
import { BRAND, resolveBrand, type Brand } from '../lib/brand';
import { useAuth } from './AuthContext';

/**
 * Per-tenant brand + module context (U15, module core.branding).
 *
 * Two seams the app gates on:
 *   useBrand()   → the resolved brand identity (name/contact/etc). Starts at the
 *                  hardcoded FHE constant (so the SYNCHRONOUS prerender path renders
 *                  a complete brand and stays green), then, on the client, upgrades
 *                  to org_public_config(slug).brand for the addressed tenant.
 *   useModules() → the tenant's active module set. For a signed-in member this is
 *                  the authoritative my_modules() set surfaced through AuthContext;
 *                  for an anonymous public visitor of a `slug` tenant it is the
 *                  public module list from org_public_config.
 *
 * Scope (U15): the member app + FHE single-tenant path. Public multi-tenant slug
 * resolution is wired here but the addressing (subdomain/path → slug) is a follow-on;
 * `slug` defaults to none, so today the constant fallback + the member's own
 * my_modules() drive everything.
 */
interface BrandContextValue {
  brand: Brand;
  /** Active module keys for the current tenant (e.g. 'mod.lessons'). */
  modules: string[];
  hasModule: (key: string) => boolean;
  /** True while a per-tenant public config fetch is in flight. */
  loading: boolean;
}

const BrandContext = createContext<BrandContextValue | null>(null);

export function BrandProvider({
  children,
  slug,
}: {
  children: React.ReactNode;
  /** Public-site tenant slug. Omit for the FHE single-tenant / member-app path. */
  slug?: string;
}) {
  const { modules: memberModules } = useAuth();

  // Start from the FHE constant so the synchronous SSR/prerender render is complete.
  const [brand, setBrand] = useState<Brand>(() => resolveBrand());
  const [publicModules, setPublicModules] = useState<string[] | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // No slug → FHE fallback (member app / prerender). Nothing to fetch.
    if (!slug) {
      setBrand(resolveBrand());
      setPublicModules(null);
      return;
    }
    let active = true;
    setLoading(true);
    orgPublicConfig(slug)
      .then((cfg) => {
        if (!active) return;
        if (cfg) {
          setBrand(resolveBrand(cfg.brand));
          setPublicModules(cfg.modules);
        } else {
          // Unknown/inactive tenant → keep the FHE fallback, no modules exposed.
          setBrand(resolveBrand());
          setPublicModules([]);
        }
      })
      .catch(() => {
        if (!active) return;
        setBrand(resolveBrand());
        setPublicModules([]);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [slug]);

  // A signed-in member's own my_modules() is authoritative for the member app; a
  // public slug visitor uses the public module list from org_public_config.
  const modules = useMemo(
    () => (slug ? publicModules ?? [] : memberModules),
    [slug, publicModules, memberModules],
  );

  const value = useMemo<BrandContextValue>(
    () => ({
      brand,
      modules,
      hasModule: (key: string) => modules.includes(key),
      loading,
    }),
    [brand, modules, loading],
  );

  return <BrandContext.Provider value={value}>{children}</BrandContext.Provider>;
}

export function useBrand(): Brand {
  const ctx = useContext(BrandContext);
  // Outside a provider (e.g. an isolated unit render) fall back to the FHE constant
  // rather than throwing — brand is always renderable.
  return ctx?.brand ?? resolveBrand(null) ?? { ...BRAND };
}

export function useModules(): { modules: string[]; hasModule: (key: string) => boolean } {
  const ctx = useContext(BrandContext);
  const modules = ctx?.modules ?? [];
  return { modules, hasModule: (key: string) => modules.includes(key) };
}
