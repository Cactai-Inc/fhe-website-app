import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { orgPublicConfig } from '../lib/api';
import { BRAND, resolveBrand, type Brand } from '../lib/brand';
import { DEFAULT_PROPERTY_TERM, resolvePropertyTerm, type PropertyTerm } from '../lib/propertyTerm';
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
  /** U16: the current tenant's own word for their facility. Public-slug visitors
   *  resolve it from org_public_config().property; the signed-in app resolves it
   *  from AuthContext's my_property_term() fetch (see useAuth().propertyTerm). */
  propertyTerm: PropertyTerm;
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
  const { modules: memberModules, propertyTerm: memberPropertyTerm } = useAuth();

  // Start from the FHE constant so the synchronous SSR/prerender render is complete.
  const [brand, setBrand] = useState<Brand>(() => resolveBrand());
  const [publicModules, setPublicModules] = useState<string[] | null>(null);
  const [publicPropertyTerm, setPublicPropertyTerm] = useState<PropertyTerm | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // No slug → FHE fallback (member app / prerender). Nothing to fetch; the
    // signed-in app's property term comes from AuthContext instead (below).
    if (!slug) {
      setBrand(resolveBrand());
      setPublicModules(null);
      setPublicPropertyTerm(null);
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
          setPublicPropertyTerm(resolvePropertyTerm(cfg.property));
        } else {
          // Unknown/inactive tenant → keep the FHE fallback, no modules exposed.
          setBrand(resolveBrand());
          setPublicModules([]);
          setPublicPropertyTerm(null);
        }
      })
      .catch(() => {
        if (!active) return;
        setBrand(resolveBrand());
        setPublicModules([]);
        setPublicPropertyTerm(null);
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

  // Same split as modules: public slug visitor uses org_public_config().property;
  // the signed-in app uses AuthContext's my_property_term() fetch.
  const propertyTerm = useMemo(
    () => (slug ? publicPropertyTerm ?? DEFAULT_PROPERTY_TERM : memberPropertyTerm),
    [slug, publicPropertyTerm, memberPropertyTerm],
  );

  const value = useMemo<BrandContextValue>(
    () => ({
      brand,
      modules,
      hasModule: (key: string) => modules.includes(key),
      loading,
      propertyTerm,
    }),
    [brand, modules, loading, propertyTerm],
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

/** U16: the current tenant's own word for their facility, as a complete
 *  {term, article, plural, preposition} shape. Outside a provider, falls back to
 *  the neutral FACILITY default rather than throwing — always renderable. */
export function usePropertyTerm(): PropertyTerm {
  const ctx = useContext(BrandContext);
  return ctx?.propertyTerm ?? DEFAULT_PROPERTY_TERM;
}
