/**
 * Single-source-of-truth enforcement for the service catalog across all four
 * representations:
 *   1. the SQL seed (service_types in migration 008)
 *   2. src/lib/serviceCatalog.ts (the front-end canonical list)
 *   3. src/lib/services.ts (the marketing offerings)
 *   4. the DB offerings reconciliation (offerings.service_type)
 *
 * If any drifts, this fails — so a service can be changed in exactly one place and
 * stay correct everywhere.
 */
import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { createTestDb, type TestDb } from './harness';
import { SERVICE_TYPES, OFFERING_SLUG_TO_SERVICE_TYPE, isServiceCode } from '../../src/lib/serviceCatalog';
import { ALL_SERVICES } from '../../src/lib/services';

let h: TestDb;
beforeAll(async () => {
  h = await createTestDb();
});
afterAll(async () => {
  await h?.close();
});

describe('serviceCatalog.ts ↔ DB service_types', () => {
  it('match exactly on code, label, segment, and requiresHorse', async () => {
    await h.asSuperuser();
    const db = await h.q<{ code: string; display_name: string; segment: string; requires_horse: boolean }>(
      `select code, display_name, segment, requires_horse from service_types order by sort_order`,
    );
    const fromDb = db.map((r) => ({
      code: r.code, label: r.display_name, segment: r.segment, requiresHorse: r.requires_horse,
    }));
    expect(fromDb).toEqual(SERVICE_TYPES);
  });
});

describe('marketing services.ts ↔ canonical catalog', () => {
  it('every marketing offering maps to a real canonical service code', () => {
    for (const svc of ALL_SERVICES) {
      const code = OFFERING_SLUG_TO_SERVICE_TYPE[svc.id];
      expect(code, `offering "${svc.id}" has a canonical mapping`).toBeTruthy();
      expect(isServiceCode(code), `"${code}" is a valid service code`).toBe(true);
    }
  });
});

describe('DB offerings reconciliation ↔ the slug→code bridge', () => {
  it('every active offering carries the service_type the bridge assigns it', async () => {
    await h.asSuperuser();
    const offerings = await h.q<{ slug: string; service_type: string | null }>(
      `select slug, service_type from offerings where active`,
    );
    for (const o of offerings) {
      expect(o.service_type, `offering "${o.slug}" reconciled`).toBe(OFFERING_SLUG_TO_SERVICE_TYPE[o.slug]);
    }
  });
});
