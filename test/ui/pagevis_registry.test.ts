/**
 * TASK-PAGEVIS — the registry's own contract.
 *
 * The whole design rests on `page_key` being stable while `path` is free to
 * move. That only holds if two things stay true, and both are checked here
 * rather than assumed:
 *
 *  1. Every `path` in the registry is a REGISTERED ROUTE. This is the drift
 *     guard for exactly the case the task named — TASK-HORSEONE moving
 *     /app/ops/horse-records. When that route moves and nobody updates the
 *     registry, this test fails at build time instead of the settings page
 *     quietly offering a dead link.
 *  2. Every `key` satisfies the grammar the database CHECK constraint enforces
 *     (`^[a-z][a-z0-9_]*\.[a-z][a-z0-9_]*$`), so a key that typechecks can never
 *     be rejected at write time.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  PAGE_REGISTRY, MODULE_HUB_PAGE_KEY, PARKED_IN_REVIEW,
  pageByKey, pageKeyForPath, pageSections,
} from '../../src/lib/pageRegistry';

/** Exactly the regex in supabase/migrations/…_pagevis_… — kept in sync by the
 *  test below that asserts the migration still contains it. */
const KEY_GRAMMAR = /^[a-z][a-z0-9_]*\.[a-z][a-z0-9_]*$/;

const appSrc = readFileSync(`${process.cwd()}/src/App.tsx`, 'utf8');
const registered = new Set<string>(
  Array.from(appSrc.matchAll(/path="([^"]+)"/g)).map((m) => {
    const p = m[1];
    return p.startsWith('/') ? p : `/app/${p}`;
  }),
);

describe('PAGEVIS — the page registry', () => {
  it('lists every page exactly once, under a unique key', () => {
    const keys = PAGE_REGISTRY.map((p) => p.key);
    expect(new Set(keys).size, 'duplicate page_key in the registry').toBe(keys.length);

    const paths = PAGE_REGISTRY.map((p) => p.path);
    expect(new Set(paths).size, 'two registry entries share one route').toBe(paths.length);
  });

  it('every key satisfies the grammar the database CHECK enforces', () => {
    for (const p of PAGE_REGISTRY) {
      expect(KEY_GRAMMAR.test(p.key), `page_key rejected by the DB constraint: ${p.key}`).toBe(true);
    }
  });

  it('the migration still carries that same grammar', () => {
    const sql = readFileSync(
      `${process.cwd()}/supabase/migrations/20260812T1600_pagevis_all_modules_and_page_visibility.sql`,
      'utf8',
    );
    // The SQL escapes the dot; the shape either side of it must match.
    expect(sql).toContain("'^[a-z][a-z0-9_]*\\.[a-z][a-z0-9_]*$'");
  });

  /* THE ONE THAT CATCHES A ROUTE RENAME. */
  it('every registry path is a route App.tsx actually registers', () => {
    for (const p of PAGE_REGISTRY) {
      expect(
        registered.has(p.path),
        `"${p.label}" (${p.key}) points at an unregistered route: ${p.path}. `
        + 'If the route moved, update PageEntry.path — and do NOT touch PageEntry.key, '
        + 'or every tenant that hid this page loses that choice.',
      ).toBe(true);
    }
  });

  it('the settings page is registered, protected, and the only protected page', () => {
    const guard = pageByKey('settings.page_visibility');
    expect(guard).toBeDefined();
    expect(guard?.protected).toBe(true);
    expect(registered.has(guard!.path)).toBe(true);
    expect(PAGE_REGISTRY.filter((p) => p.protected).map((p) => p.key))
      .toEqual(['settings.page_visibility']);
  });

  it('the protected key matches the denylist inside set_page_hidden', () => {
    const sql = readFileSync(
      `${process.cwd()}/supabase/migrations/20260812T1600_pagevis_all_modules_and_page_visibility.sql`,
      'utf8',
    );
    // A UI-only guard is bypassable; the database is the authority. If these two
    // ever disagree, the UI is lying about what can be hidden.
    expect(sql).toContain("ARRAY['settings.page_visibility']");
  });

  it('every child names a parent that exists and shares its module', () => {
    for (const p of PAGE_REGISTRY.filter((x) => x.parent)) {
      const parent = pageByKey(p.parent!);
      expect(parent, `${p.key} names a parent that is not in the registry`).toBeDefined();
      expect(parent!.module, `${p.key} and its hub disagree about the module`).toBe(p.module);
      expect(parent!.parent, 'hubs must not themselves have parents').toBeUndefined();
    }
  });

  it('every module hub is a page with a module and no parent', () => {
    for (const [moduleKey, pageKey] of Object.entries(MODULE_HUB_PAGE_KEY)) {
      const hub = pageByKey(pageKey);
      expect(hub, `${moduleKey} maps to a key that is not in the registry`).toBeDefined();
      expect(hub!.module).toBe(moduleKey);
      expect(hub!.parent).toBeUndefined();
    }
    // mod.brokerage genuinely has no hub page — the tile stays non-navigating.
    expect(MODULE_HUB_PAGE_KEY['mod.brokerage']).toBeUndefined();
  });

  it('covers all 11 pages the three newly-enabled modules surface', () => {
    const expected = [
      '/app/ops/boarding', '/app/ops/boarding/facilities',
      '/app/ops/boarding/agreements', '/app/ops/boarding/charges',
      '/app/ops/barnops', '/app/ops/barnops/resources',
      '/app/ops/barnops/consumption', '/app/ops/barnops/allocation-rules',
      '/app/ops/employees', '/app/ops/employees/staff', '/app/ops/employees/schedule',
    ];
    expect(expected).toHaveLength(11);
    for (const path of expected) {
      expect(registered.has(path), `route not registered: ${path}`).toBe(true);
      expect(pageKeyForPath(path), `not hideable — no registry entry for ${path}`).toBeDefined();
    }
  });

  it('every parked-in-Review key is a real registry entry', () => {
    for (const key of PARKED_IN_REVIEW) {
      expect(pageByKey(key), `PARKED_IN_REVIEW names a key not in the registry: ${key}`)
        .toBeDefined();
    }
  });

  it('pageSections() shows every page exactly once', () => {
    const listed = pageSections().flatMap((s) => s.pages.map((p) => p.key));
    expect(new Set(listed).size).toBe(listed.length);
    expect(listed.sort()).toEqual(PAGE_REGISTRY.map((p) => p.key).sort());
  });

  it('module sections lead with the hub, children after it', () => {
    for (const s of pageSections().filter((x) => x.module)) {
      const firstChild = s.pages.findIndex((p) => p.parent);
      if (firstChild === -1) continue;
      expect(s.pages.slice(0, firstChild).every((p) => !p.parent)).toBe(true);
      expect(s.pages.slice(firstChild).every((p) => p.parent)).toBe(true);
    }
  });
});
