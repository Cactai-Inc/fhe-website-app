/**
 * Category 1 — Schema: business config (migration 014), closes Phase 1.
 *
 * Proves the owner-blanks singleton:
 *  - migration 14 applies last,
 *  - exactly one row exists and ships all-blank,
 *  - the singleton constraint blocks a second row,
 *  - travel_fee_method is constrained,
 *  - RLS is admin-only (plain users see nothing, cannot write),
 *  - a config change is captured by the audit trail.
 */
import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { createTestDb, migrationFiles, type TestDb } from './harness';

let h: TestDb;

beforeAll(async () => {
  h = await createTestDb();
});
afterAll(async () => {
  await h?.close();
});

describe('migration applies additively', () => {
  it('lands after the audit_logs migration', () => {
    const files = migrationFiles();
    const aud = files.findIndex((f) => f.includes('audit_logs'));
    const cfg = files.findIndex((f) => f.includes('business_config'));
    expect(aud).toBeGreaterThanOrEqual(0);
    expect(cfg).toBeGreaterThan(aud);
  });
});

describe('singleton; identity seeded, commercial blanks unset', () => {
  it('ships exactly one row: identity from the brand (migration 20), pricing still blank', async () => {
    await h.asSuperuser();
    const rows = await h.q<{ legal_entity_name: string | null; commission_min: string | null; protection_period: string | null }>(
      `select legal_entity_name, commission_min, protection_period from business_config`);
    expect(rows).toHaveLength(1);
    // identity seeded from src/lib/brand.ts; commercial/pricing stay NULL (Rates Card, not the website)
    expect(rows[0].legal_entity_name).toBe('French Heritage Equestrian');
    expect(rows[0].commission_min).toBeNull();
    expect(rows[0].protection_period).toBeNull();
  });

  it('refuses a second row', async () => {
    await h.asSuperuser();
    await expect(h.q(`insert into business_config (legal_entity_name) values ('Second')`)).rejects.toThrow();
  });

  it('constrains travel_fee_method', async () => {
    await h.asSuperuser();
    await expect(h.q(`update business_config set travel_fee_method='SOMEHOW'`)).rejects.toThrow();
    await h.q(`update business_config set travel_fee_method='MILEAGE'`);
    const m = (await h.q<{ travel_fee_method: string }>(`select travel_fee_method from business_config`))[0].travel_fee_method;
    expect(m).toBe('MILEAGE');
  });
});

describe('RLS — admin only, and changes are audited', () => {
  it('hides config from plain users and blocks their writes; admin can set values', async () => {
    await h.asSuperuser();
    const adminUid = await h.createAuthUser({ email: 'ops@cfg.fhe', isAdmin: true });
    const plainUid = await h.createAuthUser({ email: 'plain@cfg.fhe' });

    // plain user: invisible, and an update matches no rows (RLS USING filters
    // them out → zero rows affected, no data changed)
    await h.asUser(plainUid);
    expect(await h.q(`select id from business_config`)).toHaveLength(0);
    await h.q(`update business_config set commission_min=500`); // affects 0 rows
    await h.asSuperuser();
    expect((await h.q<{ commission_min: string | null }>(
      `select commission_min from business_config`))[0].commission_min).toBeNull();

    // admin: reads and updates
    await h.asUser(adminUid);
    expect(await h.q(`select id from business_config`)).toHaveLength(1);
    await h.q(`update business_config set commission_min=2500, legal_entity_name='FHE LLC'`);
    const cfg = (await h.q<{ commission_min: string; legal_entity_name: string }>(
      `select commission_min, legal_entity_name from business_config`))[0];
    expect(Number(cfg.commission_min)).toBe(2500);
    expect(cfg.legal_entity_name).toBe('FHE LLC');

    // the change is on the audit trail
    await h.asSuperuser();
    const audited = await h.q(
      `select id from audit_logs where table_name='business_config' and action='UPDATE'`);
    expect(audited.length).toBeGreaterThanOrEqual(1);
  });
});
