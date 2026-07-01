/**
 * U15 unit tests — the frontend entitlement/registry/brand wrappers.
 *
 * Category 2 (Wiring & Verification Contract): mocks the Supabase client and proves
 * each wrapper calls the CORRECT RPC with the CORRECT args, unwraps the result the
 * way the UI consumes it, and surfaces (never swallows) errors. Also proves
 * resolveBrand() keeps the FHE constant as the fallback (so prerender stays green).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const rpc = vi.hoisted(() => vi.fn());
vi.mock('./supabase', () => ({ supabase: { rpc } }));

import { myModules, orgPublicConfig, configValue, provisionTenant } from './api';
import { resolveBrand, BRAND } from './brand';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('myModules()', () => {
  it('calls my_modules and flattens {module_key} rows to a string[]', async () => {
    rpc.mockResolvedValue({
      data: [{ module_key: 'mod.lessons' }, { module_key: 'mod.brokerage' }],
      error: null,
    });
    const mods = await myModules();
    expect(rpc).toHaveBeenCalledWith('my_modules');
    expect(mods).toEqual(['mod.lessons', 'mod.brokerage']);
  });

  it('tolerates a bare string[] payload shape', async () => {
    rpc.mockResolvedValue({ data: ['mod.lessons'], error: null });
    expect(await myModules()).toEqual(['mod.lessons']);
  });

  it('returns [] for a null payload (no error)', async () => {
    rpc.mockResolvedValue({ data: null, error: null });
    expect(await myModules()).toEqual([]);
  });

  it('throws (does not swallow) on an RPC error', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'boom' } });
    await expect(myModules()).rejects.toMatchObject({ message: 'boom' });
  });
});

describe('orgPublicConfig(slug)', () => {
  it('calls org_public_config with p_slug and returns the config object', async () => {
    const cfg = { org_id: 'o1', slug: 'rival', brand: { NAME: 'Rival' }, modules: ['mod.boarding'], pricing: [] };
    rpc.mockResolvedValue({ data: cfg, error: null });
    const out = await orgPublicConfig('rival');
    expect(rpc).toHaveBeenCalledWith('org_public_config', { p_slug: 'rival' });
    expect(out).toEqual(cfg);
  });

  it('returns null for an unknown tenant', async () => {
    rpc.mockResolvedValue({ data: null, error: null });
    expect(await orgPublicConfig('nope')).toBeNull();
  });

  it('throws on error', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'x' } });
    await expect(orgPublicConfig('r')).rejects.toBeTruthy();
  });
});

describe('configValue(ns, key)', () => {
  it('calls config_value with p_ns/p_key and returns the text value', async () => {
    rpc.mockResolvedValue({ data: '858-439-3614', error: null });
    const v = await configValue('CONTACT', 'PHONE');
    expect(rpc).toHaveBeenCalledWith('config_value', { p_ns: 'CONTACT', p_key: 'PHONE' });
    expect(v).toBe('858-439-3614');
  });

  it('returns null when unset', async () => {
    rpc.mockResolvedValue({ data: null, error: null });
    expect(await configValue('BRAND', 'MISSING')).toBeNull();
  });
});

describe('provisionTenant(input)', () => {
  it('maps the input to the RPC params and returns the new org id', async () => {
    rpc.mockResolvedValue({ data: 'new-org-uuid', error: null });
    const id = await provisionTenant({
      name: 'Rival Stables',
      slug: 'rival',
      tierKey: 'tier.boarding',
      adminEmail: 'owner@rival.test',
      brand: { NAME: 'Rival' },
      modules: ['mod.employees'],
    });
    expect(rpc).toHaveBeenCalledWith('provision_tenant', {
      p_name: 'Rival Stables',
      p_slug: 'rival',
      p_tier_key: 'tier.boarding',
      p_admin_email: 'owner@rival.test',
      p_admin_user_id: null,
      p_brand: { NAME: 'Rival' },
      p_legal: {},
      p_rates: {},
      p_modules: ['mod.employees'],
    });
    expect(id).toBe('new-org-uuid');
  });

  it('throws when the RPC rejects (SUPER_ADMIN gate)', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'provision_tenant is restricted to SUPER_ADMIN' } });
    await expect(
      provisionTenant({ name: 'X', slug: 'x', tierKey: 'tier.lesson_barn', adminEmail: 'a@b.c' }),
    ).rejects.toMatchObject({ message: /SUPER_ADMIN/ });
  });
});

describe('resolveBrand() — runtime path with FHE constant fallback', () => {
  it('falls back to the FHE constant when no config is passed (prerender path)', () => {
    const b = resolveBrand();
    expect(b.name).toBe(BRAND.name);
    expect(b.email).toBe(BRAND.email);
    expect(b.phoneHref).toBe(BRAND.phoneHref);
  });

  it('overlays a per-tenant config and derives hrefs from the tenant values', () => {
    const b = resolveBrand({
      NAME: 'Rival Stables',
      SHORT_NAME: 'RS',
      CONTACT_EMAIL: 'hi@rival.test',
      CONTACT_PHONE: '(212) 555-0100',
      CONTACT_URL: 'rival.test',
    });
    expect(b.name).toBe('Rival Stables');
    expect(b.shortName).toBe('RS');
    expect(b.email).toBe('hi@rival.test');
    expect(b.emailHref).toBe('mailto:hi@rival.test');
    expect(b.phoneHref).toBe('tel:+12125550100'); // digits normalized
    expect(b.url).toBe('rival.test');
    // Unset fields still fall back to the constant.
    expect(b.tagline).toBe(BRAND.tagline);
  });
});
