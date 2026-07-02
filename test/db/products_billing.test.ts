/**
 * U5 — products / product_prices / billable_lines (migration 20260630040000).
 * Module: core.payments.
 *
 * Real-path data test (Wiring & Verification Contract §15(1)): every assertion
 * exercises the ACTUAL tables the app writes/reads, as the CORRECT RLS role, and
 * proves the row lands in the RIGHT table with the RIGHT columns and reads back.
 *
 * Covers the unit's required proofs:
 *  - products / product_prices / billable_lines DEFAULT org_id to the caller's
 *    tenant and ENFORCE it (cross-tenant plant rejected by WITH CHECK; other
 *    tenant's rows hidden by the boundary USING).
 *  - a product with a module_key is HIDDEN (and unwritable) when that module is OFF
 *    for the tenant (the per-row module gate); a plain core product (module_key
 *    NULL) is unaffected.
 *  - billable_lines are readable by their PAYER only (a client sees own lines;
 *    another client sees none).
 *  - a SETTLED billable_line rejects UPDATE and DELETE (append-only seal).
 *  - a product price resolves THROUGH the registry key (products.price_value_key
 *    → config_values PRICING row → resolved amount), the define-once path.
 */
import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { createTestDb, type TestDb } from './harness';

let h: TestDb;
let orgA: string; // FHE (tenant #1): has mod.brokerage/mod.lessons/mod.horserecords; NOT mod.boarding
let orgB: string; // Rival: no modules
let aAdmin: string, bAdmin: string;
let aClient: string, aClient2: string;
let aClientContact: string, aClient2Contact: string;

beforeAll(async () => {
  h = await createTestDb();
  await h.asSuperuser();
  orgA = (await h.q<{ id: string }>(`select id from organizations order by created_at limit 1`))[0].id;
  orgB = (await h.q<{ id: string }>(
    `insert into organizations (name, slug) values ('Billing Rival','billing-rival') returning id`))[0].id;

  aAdmin = await h.createAuthUser({ role: 'ADMIN', org: orgA });
  bAdmin = await h.createAuthUser({ role: 'ADMIN', org: orgB });
  // two plain USERs in org A; the profiles→contact trigger auto-links each a contact.
  aClient = await h.createAuthUser({ role: 'USER', org: orgA });
  aClient2 = await h.createAuthUser({ role: 'USER', org: orgA });

  await h.asSuperuser();
  aClientContact = (await h.q<{ contact_id: string }>(
    `select contact_id from profiles where user_id=$1`, [aClient]))[0].contact_id;
  aClient2Contact = (await h.q<{ contact_id: string }>(
    `select contact_id from profiles where user_id=$1`, [aClient2]))[0].contact_id;
});

afterAll(async () => {
  await h?.close();
});

// ---------------------------------------------------------------------------
// products — default / enforce org_id + module-gate on module_key
// ---------------------------------------------------------------------------
describe('products: default org_id, cross-tenant enforcement, module gate', () => {
  it('defaults org_id to the caller\'s tenant on a plain insert (real staff path)', async () => {
    await h.asUser(aAdmin);
    const [p] = await h.q<{ id: string; org_id: string }>(
      `insert into products (product_key, name) values ('lesson-pack-5','5-Lesson Pack')
         returning id, org_id`);
    expect(p.org_id).toBe(orgA);
    // reads back with the right columns
    await h.asSuperuser();
    const [row] = await h.q<{ name: string; active: boolean }>(
      `select name, active from products where id=$1`, [p.id]);
    expect(row.name).toBe('5-Lesson Pack');
    expect(row.active).toBe(true);
  });

  it('rejects a cross-tenant plant (WITH CHECK) and hides another tenant\'s product', async () => {
    // org-A admin cannot plant into org B
    await h.asUser(aAdmin);
    await expect(
      h.q(`insert into products (org_id, product_key, name) values ($1,'sneak','Sneak')`, [orgB]),
    ).rejects.toThrow();

    // seed a product under org B, then confirm org-A admin cannot SEE it
    await h.asSuperuser();
    await h.q(
      `insert into products (org_id, product_key, name) values ($1,'b-only','B Only')`, [orgB]);
    await h.asUser(aAdmin);
    const visibleToA = await h.q<{ org_id: string }>(`select org_id from products`);
    expect(visibleToA.every((r) => r.org_id === orgA)).toBe(true);
    // org-B admin sees the org-B product
    await h.asUser(bAdmin);
    const visibleToB = await h.q<{ product_key: string }>(
      `select product_key from products where org_id=$1`, [orgB]);
    expect(visibleToB.some((r) => r.product_key === 'b-only')).toBe(true);
  });

  it('a product with a module_key is HIDDEN when that module is OFF for the tenant', async () => {
    // org A does NOT have mod.boarding. Seed a boarding-owned product for org A as
    // superuser (bypasses RLS), then confirm A's ADMIN cannot see it — the module
    // gate hides it even from the owning tenant's admin.
    await h.asSuperuser();
    await h.q(
      `insert into products (org_id, product_key, name, module_key)
         values ($1,'board-monthly','Monthly Board','mod.boarding')`, [orgA]);
    // a plain core product (module_key NULL) and a mod.lessons product (A HAS lessons)
    await h.q(
      `insert into products (org_id, product_key, name, module_key)
         values ($1,'lesson-single','Single Lesson','mod.lessons')`, [orgA]);

    await h.asUser(aAdmin);
    const keys = (await h.q<{ product_key: string; module_key: string | null }>(
      `select product_key, module_key from products where org_id=$1`, [orgA]))
      .map((r) => r.product_key);
    // gated-off module product is invisible; on-module + null-module products visible
    expect(keys).not.toContain('board-monthly');
    expect(keys).toContain('lesson-single');       // mod.lessons is ON for A
    expect(keys).toContain('lesson-pack-5');        // module_key NULL — always visible
  });

  it('an ADMIN cannot INSERT a product for a module the tenant does NOT have (gate WITH CHECK)', async () => {
    await h.asUser(aAdmin); // org A lacks mod.boarding
    await expect(
      h.q(`insert into products (product_key, name, module_key)
             values ('board-sneak','Board Sneak','mod.boarding')`),
    ).rejects.toThrow();
    // but CAN insert a product for a module it DOES have
    await h.q(`insert into products (product_key, name, module_key)
                 values ('brokerage-fee','Brokerage Fee','mod.brokerage')`);
    await h.asSuperuser();
    const [ok] = await h.q<{ product_key: string }>(
      `select product_key from products where product_key='brokerage-fee' and org_id=$1`, [orgA]);
    expect(ok.product_key).toBe('brokerage-fee');
  });
});

// ---------------------------------------------------------------------------
// product_prices — default / enforce org_id + resolves through the registry key
// ---------------------------------------------------------------------------
describe('product_prices: default org_id + registry-key resolution', () => {
  it('defaults org_id and reads back the effective-dated amount', async () => {
    await h.asUser(aAdmin);
    const [p] = await h.q<{ id: string }>(
      `insert into products (product_key, name, price_value_key)
         values ('clinic-day','Clinic Day','PRICING.CLINIC_DAY.PRICE') returning id`);
    const [pr] = await h.q<{ id: string; org_id: string; amount: string }>(
      `insert into product_prices (product_id, amount) values ($1, 250.00)
         returning id, org_id, amount`, [p.id]);
    expect(pr.org_id).toBe(orgA);
    expect(Number(pr.amount)).toBe(250);
  });

  it('rejects a cross-tenant product_prices plant (WITH CHECK)', async () => {
    await h.asSuperuser();
    const [pb] = await h.q<{ id: string }>(
      `insert into products (org_id, product_key, name) values ($1,'b-price-prod','B Priced') returning id`, [orgB]);
    await h.asUser(aAdmin);
    await expect(
      h.q(`insert into product_prices (org_id, product_id, amount) values ($1,$2,10.00)`, [orgB, pb.id]),
    ).rejects.toThrow();
  });

  it('a product price resolves THROUGH the registry key (price_value_key → config_values PRICING)', async () => {
    // The define-once path: the product carries a registry key; the actual number
    // lives once in config_values ns PRICING and is resolved by config_value().
    await h.asUser(aAdmin);
    const [p] = await h.q<{ id: string }>(
      `insert into products (product_key, name, price_value_key)
         values ('eval-fee','Evaluation Fee','PRICING.EVAL_FEE.PRICE') returning id`);
    // seed the value ONCE in the tenant registry (config_values is org-scoped; the
    // global config_keys guard is SUPER_ADMIN-write and not needed for resolution).
    await h.q(
      `insert into config_values (namespace, key, value_num, category)
         values ('PRICING','EVAL_FEE.PRICE', 350.00, 'pricing')`);

    // resolve the product's price the way the app does: read the key off the
    // product, then resolve it through the single registry seam config_value().
    const [row] = await h.q<{ price_value_key: string }>(
      `select price_value_key from products where id=$1`, [p.id]);
    expect(row.price_value_key).toBe('PRICING.EVAL_FEE.PRICE');
    const [resolved] = await h.q<{ amount: string | null }>(
      `select config_value('PRICING', 'EVAL_FEE.PRICE') as amount`);
    expect(Number(resolved.amount)).toBe(350);

    // a change to the ONE registry row propagates — no product edit needed.
    await h.q(
      `update config_values set value_num = 400.00 where namespace='PRICING' and key='EVAL_FEE.PRICE'`);
    const [resolved2] = await h.q<{ amount: string | null }>(
      `select config_value('PRICING', 'EVAL_FEE.PRICE') as amount`);
    expect(Number(resolved2.amount)).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// billable_lines — default / enforce org_id + payer-only client read
// ---------------------------------------------------------------------------
describe('billable_lines: default org_id, cross-tenant enforcement, payer-only read', () => {
  it('defaults org_id (staff insert) and reads back the right columns', async () => {
    await h.asUser(aAdmin);
    const [bl] = await h.q<{ id: string; org_id: string; source_kind: string; status: string }>(
      `insert into billable_lines (payer_contact_id, source_kind, qty, unit_amount, amount)
         values ($1, 'lesson', 1, 60.00, 60.00)
         returning id, org_id, source_kind, status`, [aClientContact]);
    expect(bl.org_id).toBe(orgA);
    expect(bl.source_kind).toBe('lesson');
    expect(bl.status).toBe('OPEN'); // default
  });

  it('rejects a cross-tenant plant (WITH CHECK)', async () => {
    await h.asUser(aAdmin);
    await expect(
      h.q(`insert into billable_lines (org_id, payer_contact_id, source_kind, amount)
             values ($1, $2, 'fee', 10.00)`, [orgB, aClientContact]),
    ).rejects.toThrow();
  });

  it('a client reads ONLY their own lines (payer_contact_id = current_contact_id())', async () => {
    // staff seeds a line for aClient and a line for aClient2 (both org A)
    await h.asUser(aAdmin);
    await h.q(
      `insert into billable_lines (payer_contact_id, source_kind, amount)
         values ($1,'fee', 25.00)`, [aClientContact]);
    await h.q(
      `insert into billable_lines (payer_contact_id, source_kind, amount)
         values ($1,'fee', 99.00)`, [aClient2Contact]);

    // aClient sees only lines where payer_contact_id = their contact
    await h.asUser(aClient);
    const mine = await h.q<{ payer_contact_id: string }>(
      `select payer_contact_id from billable_lines`);
    expect(mine.length).toBeGreaterThan(0);
    expect(mine.every((r) => r.payer_contact_id === aClientContact)).toBe(true);
    expect(mine.some((r) => r.payer_contact_id === aClient2Contact)).toBe(false);

    // aClient2 sees only THEIR line, not aClient's
    await h.asUser(aClient2);
    const theirs = await h.q<{ payer_contact_id: string }>(
      `select payer_contact_id from billable_lines`);
    expect(theirs.every((r) => r.payer_contact_id === aClient2Contact)).toBe(true);
  });

  it('another tenant\'s admin cannot see org-A billable_lines', async () => {
    await h.asUser(bAdmin);
    const seen = await h.q<{ id: string }>(`select id from billable_lines`);
    // org B has none of its own yet; A's are hidden by the boundary
    expect(seen).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// billable_lines — append-only once SETTLED (the seal, mirroring signatures)
// ---------------------------------------------------------------------------
describe('billable_lines: SETTLED lines are append-only (seal)', () => {
  let settledId: string;

  beforeAll(async () => {
    await h.asUser(aAdmin);
    // create OPEN then settle (this transition is allowed)
    const [bl] = await h.q<{ id: string }>(
      `insert into billable_lines (payer_contact_id, source_kind, amount, status)
         values ($1,'board', 500.00, 'OPEN') returning id`, [aClientContact]);
    settledId = bl.id;
    await h.q(`update billable_lines set status='SETTLED' where id=$1`, [settledId]);
  });

  it('a SETTLED line rejects an UPDATE to a substantive field (amount)', async () => {
    await h.asUser(aAdmin);
    await expect(
      h.q(`update billable_lines set amount=1.00 where id=$1`, [settledId]),
    ).rejects.toThrow(/append-only|settled/i);
  });

  it('a SETTLED line rejects a status change (cannot un-settle)', async () => {
    await h.asUser(aAdmin);
    await expect(
      h.q(`update billable_lines set status='OPEN' where id=$1`, [settledId]),
    ).rejects.toThrow(/append-only|settled/i);
  });

  it('a SETTLED line rejects a DELETE', async () => {
    await h.asUser(aAdmin);
    await expect(
      h.q(`delete from billable_lines where id=$1`, [settledId]),
    ).rejects.toThrow(/append-only|settled/i);
    // even as superuser (the seal is a trigger, not just RLS)
    await h.asSuperuser();
    await expect(
      h.q(`delete from billable_lines where id=$1`, [settledId]),
    ).rejects.toThrow(/append-only|settled/i);
  });

  it('an OPEN line is still freely updatable and deletable (seal only fires on SETTLED)', async () => {
    await h.asUser(aAdmin);
    const [open] = await h.q<{ id: string }>(
      `insert into billable_lines (payer_contact_id, source_kind, amount, status)
         values ($1,'fee', 5.00, 'OPEN') returning id`, [aClientContact]);
    await h.q(`update billable_lines set amount=7.50 where id=$1`, [open.id]); // ok
    const [row] = await h.q<{ amount: string }>(
      `select amount from billable_lines where id=$1`, [open.id]);
    expect(Number(row.amount)).toBe(7.5);
    await h.q(`delete from billable_lines where id=$1`, [open.id]); // ok — open lines deletable
  });

  it('the SETTLED line still reads back unchanged (data preserved, not lost)', async () => {
    await h.asSuperuser();
    const [row] = await h.q<{ status: string; amount: string }>(
      `select status, amount from billable_lines where id=$1`, [settledId]);
    expect(row.status).toBe('SETTLED');
    expect(Number(row.amount)).toBe(500);
  });
});
