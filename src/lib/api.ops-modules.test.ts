/**
 * INT-API-MODULES unit tests (§15.1, Wiring & Verification Contract — real-path data test).
 *
 * Mocks the Supabase client with a chainable query-builder spy (+ a storage spy) and
 * proves each module / admin wrapper:
 *   - calls the CORRECT rpc(name, {p_args}) — create_purchase/search/lease_engagement,
 *     resolve_consumption_billing, set_org_module, config_required_missing — with the
 *     exact p_-args, OR the correct .from(table).insert/select/update/upsert with the
 *     right columns/filters (asserted against the tested backbone signatures),
 *   - unwraps the result the way the UI consumes it,
 *   - THROWS (never swallows) on an error payload.
 *
 * Every exported wrapper in the INT-API-MODULES block is exercised here (static
 * dead-end audit: no defined-but-untested wrapper, no typo'd RPC name — the RPC
 * names are checked against the migration RPC list).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const rpc = vi.hoisted(() => vi.fn());
const from = vi.hoisted(() => vi.fn());
const storageUpload = vi.hoisted(() => vi.fn());
const storageFrom = vi.hoisted(() => vi.fn(() => ({ upload: storageUpload })));
vi.mock('./supabase', () => ({ supabase: { rpc, from, storage: { from: storageFrom } } }));

import {
  createPurchaseEngagement, createSearchEngagement, createLeaseEngagement,
  listEngagementStages, createEngagementStage,
  listFacilities, createFacility, listStalls, createStall,
  listBoardAgreements, createBoardAgreement, listBoardCharges, createBoardCharge,
  listResources, createResource, listResourceLots, createResourceLot,
  listConsumptionEvents, createConsumptionEvent,
  listCostAllocationRules, createCostAllocationRule, resolveConsumptionBilling,
  listLessonPackages, createLessonPackage, listLessonCredits, createLessonCredit,
  listHorseParties, createHorseParty, listHealthEvents, createHealthEvent,
  listStaff, createStaff, listShifts, createShift,
  listTimeEntries, createTimeEntry, listServiceAssignments, createServiceAssignment,
  listModuleCatalog, listTiers, setOrgModule,
  getBusinessConfig, updateBusinessConfig,
  listConfigValues, upsertConfigValue, configRequiredMissing,
  listBrandingValues, uploadBrandingAsset,
  listProducts, createProduct, listProductPrices, createProductPrice,
} from './api';

/**
 * A chainable query-builder mock. Every intermediate method returns the same builder so
 * a chain like .from(t).select().is().order() works. The builder is thenable so
 * `await builder` resolves to the configured result; .single()/.maybeSingle() also resolve.
 */
function makeBuilder(result: { data?: unknown; error?: unknown; count?: number | null }) {
  const calls: Array<{ method: string; args: unknown[] }> = [];
  const settled = Promise.resolve(result);
  const builder: Record<string, unknown> = {
    __calls: calls,
    then: (onOk: (v: unknown) => unknown, onErr?: (e: unknown) => unknown) =>
      settled.then(onOk, onErr),
  };
  for (const m of ['select', 'insert', 'update', 'upsert', 'delete', 'eq', 'neq', 'is', 'in', 'order', 'gte', 'lte']) {
    builder[m] = (...args: unknown[]) => {
      calls.push({ method: m, args });
      return builder;
    };
  }
  builder.single = (...args: unknown[]) => { calls.push({ method: 'single', args }); return settled; };
  builder.maybeSingle = (...args: unknown[]) => { calls.push({ method: 'maybeSingle', args }); return settled; };
  return builder;
}

function stubFrom(result: { data?: unknown; error?: unknown; count?: number | null }) {
  const builder = makeBuilder(result);
  from.mockReturnValue(builder);
  return builder;
}

const callsOf = (b: unknown) => (b as { __calls: Array<{ method: string; args: unknown[] }> }).__calls;
const called = (b: unknown, method: string) => callsOf(b).find((c) => c.method === method);
const allCalled = (b: unknown, method: string) => callsOf(b).filter((c) => c.method === method);

beforeEach(() => {
  vi.clearAllMocks();
  storageFrom.mockReturnValue({ upload: storageUpload });
});

// ─── Brokerage: engagement creation ──────────────────────────────────────────

describe('createPurchaseEngagement()', () => {
  it('calls rpc(create_purchase_engagement, {p_...}) and returns the new engagement id', async () => {
    rpc.mockResolvedValue({ data: 'eng-1', error: null });
    const out = await createPurchaseEngagement({
      buyerContactId: 'b1', horseId: 'h1', sellerContactId: 's1', amount: 50000, deposit: 5000,
    });
    expect(rpc).toHaveBeenCalledWith('create_purchase_engagement', {
      p_buyer_contact_id: 'b1', p_horse_id: 'h1', p_seller_contact_id: 's1',
      p_amount: 50000, p_deposit: 5000,
    });
    expect(out).toBe('eng-1');
  });

  it('defaults optional args to null', async () => {
    rpc.mockResolvedValue({ data: 'eng-2', error: null });
    await createPurchaseEngagement({ buyerContactId: 'b1' });
    expect(rpc).toHaveBeenCalledWith('create_purchase_engagement', {
      p_buyer_contact_id: 'b1', p_horse_id: null, p_seller_contact_id: null,
      p_amount: null, p_deposit: null,
    });
  });

  it('throws on error', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'no module' } });
    await expect(createPurchaseEngagement({ buyerContactId: 'b1' }))
      .rejects.toMatchObject({ message: 'no module' });
  });
});

describe('createSearchEngagement()', () => {
  it('calls rpc(create_search_engagement, {p_...}) with token-driven defaults', async () => {
    rpc.mockResolvedValue({ data: 'eng-3', error: null });
    const out = await createSearchEngagement({ clientContactId: 'c1' });
    expect(rpc).toHaveBeenCalledWith('create_search_engagement', {
      p_client_contact_id: 'c1', p_retained_by: 'buyer', p_deal_side: 'BUY', p_horse_id: null,
    });
    expect(out).toBe('eng-3');
  });

  it('honors explicit retained_by / deal_side / horse', async () => {
    rpc.mockResolvedValue({ data: 'eng-4', error: null });
    await createSearchEngagement({ clientContactId: 'c1', retainedBy: 'seller', dealSide: 'SELL', horseId: 'h9' });
    expect(rpc).toHaveBeenCalledWith('create_search_engagement', {
      p_client_contact_id: 'c1', p_retained_by: 'seller', p_deal_side: 'SELL', p_horse_id: 'h9',
    });
  });

  it('throws on error', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'x' } });
    await expect(createSearchEngagement({ clientContactId: 'c1' })).rejects.toBeTruthy();
  });
});

describe('createLeaseEngagement()', () => {
  it('calls rpc(create_lease_engagement, {p_...}) with LEASE_IN default', async () => {
    rpc.mockResolvedValue({ data: 'eng-5', error: null });
    const out = await createLeaseEngagement({ clientContactId: 'c1' });
    expect(rpc).toHaveBeenCalledWith('create_lease_engagement', {
      p_client_contact_id: 'c1', p_deal_side: 'LEASE_IN', p_horse_id: null, p_counterparty_contact_id: null,
    });
    expect(out).toBe('eng-5');
  });

  it('honors explicit deal_side / counterparty', async () => {
    rpc.mockResolvedValue({ data: 'eng-6', error: null });
    await createLeaseEngagement({ clientContactId: 'c1', dealSide: 'LEASE_OUT', counterpartyContactId: 'cp1' });
    expect(rpc).toHaveBeenCalledWith('create_lease_engagement', {
      p_client_contact_id: 'c1', p_deal_side: 'LEASE_OUT', p_horse_id: null, p_counterparty_contact_id: 'cp1',
    });
  });

  it('throws on error', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'x' } });
    await expect(createLeaseEngagement({ clientContactId: 'c1' })).rejects.toBeTruthy();
  });
});

// ─── Brokerage: engagement stages ────────────────────────────────────────────

describe('listEngagementStages() / createEngagementStage()', () => {
  it('lists stages for an engagement, non-deleted, ordered by effective_from', async () => {
    const b = stubFrom({ data: [{ id: 's1', stage: 'SEARCH' }], error: null });
    const out = await listEngagementStages('e1');
    expect(from).toHaveBeenCalledWith('engagement_stages');
    expect(called(b, 'eq')!.args).toEqual(['engagement_id', 'e1']);
    expect(called(b, 'is')!.args).toEqual(['deleted_at', null]);
    expect(called(b, 'order')!.args[0]).toBe('effective_from');
    expect(out).toEqual([{ id: 's1', stage: 'SEARCH' }]);
  });

  it('inserts a stage with the mapped columns', async () => {
    const b = stubFrom({ data: { id: 's2', stage: 'EVALUATION' }, error: null });
    const out = await createEngagementStage({
      engagement_id: 'e1', stage: 'EVALUATION', retained_by: 'buyer', deal_side: 'BUY', fee_value_key: 'FEE.EVAL',
    });
    expect(from).toHaveBeenCalledWith('engagement_stages');
    expect(called(b, 'insert')!.args[0]).toEqual({
      engagement_id: 'e1', stage: 'EVALUATION', retained_by: 'buyer', deal_side: 'BUY', fee_value_key: 'FEE.EVAL',
    });
    expect(out).toEqual({ id: 's2', stage: 'EVALUATION' });
  });

  it('defaults optional stage columns to null', async () => {
    const b = stubFrom({ data: { id: 's3' }, error: null });
    await createEngagementStage({ engagement_id: 'e1', stage: 'SEARCH' });
    expect(called(b, 'insert')!.args[0]).toEqual({
      engagement_id: 'e1', stage: 'SEARCH', retained_by: null, deal_side: null, fee_value_key: null,
    });
  });

  it('throws on error', async () => {
    stubFrom({ data: null, error: { message: 'x' } });
    await expect(listEngagementStages('e1')).rejects.toBeTruthy();
  });
});

// ─── Boarding ─────────────────────────────────────────────────────────────────

describe('boarding: facilities', () => {
  it('listFacilities selects non-deleted facilities ordered by name', async () => {
    const b = stubFrom({ data: [{ id: 'f1' }], error: null });
    const out = await listFacilities();
    expect(from).toHaveBeenCalledWith('facilities');
    expect(called(b, 'is')!.args).toEqual(['deleted_at', null]);
    expect(called(b, 'order')!.args[0]).toBe('name');
    expect(out).toEqual([{ id: 'f1' }]);
  });

  it('createFacility inserts name + address_value_key', async () => {
    const b = stubFrom({ data: { id: 'f1' }, error: null });
    await createFacility({ name: 'Barn A', address_value_key: 'CONTACT.ADDRESS' });
    expect(called(b, 'insert')!.args[0]).toEqual({ name: 'Barn A', address_value_key: 'CONTACT.ADDRESS' });
  });

  it('createFacility defaults address_value_key to null', async () => {
    const b = stubFrom({ data: { id: 'f2' }, error: null });
    await createFacility({ name: 'Barn B' });
    expect(called(b, 'insert')!.args[0]).toEqual({ name: 'Barn B', address_value_key: null });
  });

  it('throws on error', async () => {
    stubFrom({ data: null, error: { message: 'x' } });
    await expect(listFacilities()).rejects.toBeTruthy();
  });
});

describe('boarding: stalls', () => {
  it('listStalls filters by facility when given', async () => {
    const b = stubFrom({ data: [{ id: 'st1' }], error: null });
    const out = await listStalls('f1');
    expect(from).toHaveBeenCalledWith('stalls');
    expect(called(b, 'eq')!.args).toEqual(['facility_id', 'f1']);
    expect(out).toEqual([{ id: 'st1' }]);
  });

  it('listStalls omits the facility filter when none given', async () => {
    const b = stubFrom({ data: [], error: null });
    await listStalls();
    expect(callsOf(b).some((c) => c.method === 'eq')).toBe(false);
  });

  it('createStall inserts facility_id + code + stall_type', async () => {
    const b = stubFrom({ data: { id: 'st1' }, error: null });
    await createStall({ facility_id: 'f1', code: 'A1', stall_type: 'BOX' });
    expect(called(b, 'insert')!.args[0]).toEqual({ facility_id: 'f1', code: 'A1', stall_type: 'BOX' });
  });

  it('throws on error', async () => {
    stubFrom({ data: null, error: { message: 'x' } });
    await expect(createStall({ facility_id: 'f1', code: 'A1' })).rejects.toBeTruthy();
  });
});

describe('boarding: board_agreements', () => {
  it('listBoardAgreements selects non-deleted', async () => {
    const b = stubFrom({ data: [{ id: 'ba1' }], error: null });
    const out = await listBoardAgreements();
    expect(from).toHaveBeenCalledWith('board_agreements');
    expect(called(b, 'is')!.args).toEqual(['deleted_at', null]);
    expect(out).toEqual([{ id: 'ba1' }]);
  });

  it('createBoardAgreement inserts the mapped columns', async () => {
    const b = stubFrom({ data: { id: 'ba1' }, error: null });
    await createBoardAgreement({
      horse_id: 'h1', boarder_contact_id: 'c1', stall_id: 'st1',
      board_rate: 800, board_type: 'FULL', start_date: '2026-01-01', end_date: null,
    });
    expect(from).toHaveBeenCalledWith('board_agreements');
    expect(called(b, 'insert')!.args[0]).toEqual({
      horse_id: 'h1', boarder_contact_id: 'c1', stall_id: 'st1',
      board_rate: 800, board_type: 'FULL', start_date: '2026-01-01', end_date: null,
    });
  });

  it('createBoardAgreement defaults optionals to null', async () => {
    const b = stubFrom({ data: { id: 'ba2' }, error: null });
    await createBoardAgreement({ horse_id: 'h1', boarder_contact_id: 'c1' });
    expect(called(b, 'insert')!.args[0]).toEqual({
      horse_id: 'h1', boarder_contact_id: 'c1', stall_id: null,
      board_rate: null, board_type: null, start_date: null, end_date: null,
    });
  });

  it('throws on error', async () => {
    stubFrom({ data: null, error: { message: 'x' } });
    await expect(listBoardAgreements()).rejects.toBeTruthy();
  });
});

describe('boarding: board_charges', () => {
  it('listBoardCharges filters by board_agreement_id when given', async () => {
    const b = stubFrom({ data: [{ id: 'bc1' }], error: null });
    const out = await listBoardCharges('ba1');
    expect(from).toHaveBeenCalledWith('board_charges');
    expect(called(b, 'eq')!.args).toEqual(['board_agreement_id', 'ba1']);
    expect(out).toEqual([{ id: 'bc1' }]);
  });

  it('createBoardCharge inserts period + amount', async () => {
    const b = stubFrom({ data: { id: 'bc1' }, error: null });
    await createBoardCharge({ board_agreement_id: 'ba1', period_start: '2026-01-01', period_end: '2026-02-01', amount: 800 });
    expect(called(b, 'insert')!.args[0]).toEqual({
      board_agreement_id: 'ba1', period_start: '2026-01-01', period_end: '2026-02-01', amount: 800,
    });
  });

  it('throws on error', async () => {
    stubFrom({ data: null, error: { message: 'x' } });
    await expect(createBoardCharge({ board_agreement_id: 'ba1', period_start: 'a', period_end: 'b', amount: 1 }))
      .rejects.toBeTruthy();
  });
});

// ─── Barn ops / inventory ─────────────────────────────────────────────────────

describe('barnops: resources', () => {
  it('listResources selects non-deleted', async () => {
    const b = stubFrom({ data: [{ id: 'r1' }], error: null });
    const out = await listResources();
    expect(from).toHaveBeenCalledWith('resources');
    expect(called(b, 'is')!.args).toEqual(['deleted_at', null]);
    expect(out).toEqual([{ id: 'r1' }]);
  });

  it('createResource inserts with unit_of_measure + is_consumable defaults', async () => {
    const b = stubFrom({ data: { id: 'r1' }, error: null });
    await createResource({ resource_key: 'HAY', name: 'Hay', category: 'feed' });
    expect(called(b, 'insert')!.args[0]).toEqual({
      resource_key: 'HAY', name: 'Hay', category: 'feed', unit_of_measure: 'unit', is_consumable: true,
    });
  });

  it('createResource honors explicit unit + consumable', async () => {
    const b = stubFrom({ data: { id: 'r2' }, error: null });
    await createResource({ resource_key: 'FORK', name: 'Fork', category: 'equipment', unit_of_measure: 'each', is_consumable: false });
    expect(called(b, 'insert')!.args[0]).toMatchObject({ unit_of_measure: 'each', is_consumable: false });
  });

  it('throws on error', async () => {
    stubFrom({ data: null, error: { message: 'x' } });
    await expect(listResources()).rejects.toBeTruthy();
  });
});

describe('barnops: resource_lots', () => {
  it('listResourceLots filters by resource when given', async () => {
    const b = stubFrom({ data: [{ id: 'l1' }], error: null });
    const out = await listResourceLots('r1');
    expect(from).toHaveBeenCalledWith('resource_lots');
    expect(called(b, 'eq')!.args).toEqual(['resource_id', 'r1']);
    expect(out).toEqual([{ id: 'l1' }]);
  });

  it('createResourceLot defaults on_hand to qty_purchased', async () => {
    const b = stubFrom({ data: { id: 'l1' }, error: null });
    await createResourceLot({ resource_id: 'r1', qty_purchased: 100, unit_cost: 5 });
    expect(called(b, 'insert')!.args[0]).toEqual({
      resource_id: 'r1', vendor_contact_id: null, qty_purchased: 100, unit_cost: 5, on_hand: 100,
    });
  });

  it('createResourceLot honors explicit on_hand + vendor', async () => {
    const b = stubFrom({ data: { id: 'l2' }, error: null });
    await createResourceLot({ resource_id: 'r1', vendor_contact_id: 'v1', qty_purchased: 100, unit_cost: 5, on_hand: 80 });
    expect(called(b, 'insert')!.args[0]).toMatchObject({ vendor_contact_id: 'v1', on_hand: 80 });
  });

  it('throws on error', async () => {
    stubFrom({ data: null, error: { message: 'x' } });
    await expect(listResourceLots()).rejects.toBeTruthy();
  });
});

describe('barnops: consumption_events', () => {
  it('listConsumptionEvents selects non-deleted, newest first', async () => {
    const b = stubFrom({ data: [{ id: 'ce1' }], error: null });
    const out = await listConsumptionEvents();
    expect(from).toHaveBeenCalledWith('consumption_events');
    expect(called(b, 'order')!.args).toEqual(['occurred_at', { ascending: false }]);
    expect(out).toEqual([{ id: 'ce1' }]);
  });

  it('createConsumptionEvent inserts an append-only event', async () => {
    const b = stubFrom({ data: { id: 'ce1' }, error: null });
    await createConsumptionEvent({ resource_id: 'r1', resource_lot_id: 'l1', horse_id: 'h1', qty: 3, occurred_at: '2026-01-05', notes: 'am feed' });
    expect(called(b, 'insert')!.args[0]).toEqual({
      resource_id: 'r1', resource_lot_id: 'l1', horse_id: 'h1', qty: 3, occurred_at: '2026-01-05', notes: 'am feed',
    });
  });

  it('createConsumptionEvent defaults occurred_at + optional links', async () => {
    const b = stubFrom({ data: { id: 'ce2' }, error: null });
    await createConsumptionEvent({ resource_id: 'r1', qty: 1 });
    const args = called(b, 'insert')!.args[0] as Record<string, unknown>;
    expect(args).toMatchObject({ resource_id: 'r1', resource_lot_id: null, horse_id: null, qty: 1, notes: null });
    expect(typeof args.occurred_at).toBe('string');
  });

  it('throws on error', async () => {
    stubFrom({ data: null, error: { message: 'x' } });
    await expect(createConsumptionEvent({ resource_id: 'r1', qty: 1 })).rejects.toBeTruthy();
  });
});

describe('barnops: cost_allocation_rules + resolveConsumptionBilling', () => {
  it('listCostAllocationRules selects non-deleted', async () => {
    const b = stubFrom({ data: [{ id: 'car1' }], error: null });
    const out = await listCostAllocationRules();
    expect(from).toHaveBeenCalledWith('cost_allocation_rules');
    expect(called(b, 'is')!.args).toEqual(['deleted_at', null]);
    expect(out).toEqual([{ id: 'car1' }]);
  });

  it('createCostAllocationRule inserts with share_pct default 100', async () => {
    const b = stubFrom({ data: { id: 'car1' }, error: null });
    await createCostAllocationRule({ scope: 'horse', scope_id: 'h1', payer_contact_id: 'c1' });
    expect(called(b, 'insert')!.args[0]).toEqual({
      scope: 'horse', scope_id: 'h1', payer_contact_id: 'c1', share_pct: 100, effective_from: null, effective_to: null,
    });
  });

  it('createCostAllocationRule honors explicit share_pct + dates', async () => {
    const b = stubFrom({ data: { id: 'car2' }, error: null });
    await createCostAllocationRule({ scope: 'default', payer_contact_id: 'c1', share_pct: 50, effective_from: '2026-01-01', effective_to: '2026-12-31' });
    expect(called(b, 'insert')!.args[0]).toMatchObject({ scope: 'default', scope_id: null, share_pct: 50, effective_from: '2026-01-01' });
  });

  it('resolveConsumptionBilling calls rpc(resolve_consumption_billing, {p_period}) and returns the count', async () => {
    rpc.mockResolvedValue({ data: 7, error: null });
    const out = await resolveConsumptionBilling('[2026-01-01,2026-02-01)');
    expect(rpc).toHaveBeenCalledWith('resolve_consumption_billing', { p_period: '[2026-01-01,2026-02-01)' });
    expect(out).toBe(7);
  });

  it('resolveConsumptionBilling returns 0 for a null count', async () => {
    rpc.mockResolvedValue({ data: null, error: null });
    expect(await resolveConsumptionBilling('[2026-01-01,2026-02-01)')).toBe(0);
  });

  it('resolveConsumptionBilling throws on error', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'no rules' } });
    await expect(resolveConsumptionBilling('p')).rejects.toMatchObject({ message: 'no rules' });
  });
});

// ─── Lessons ──────────────────────────────────────────────────────────────────

describe('lessons: packages', () => {
  it('listLessonPackages selects non-deleted ordered by name', async () => {
    const b = stubFrom({ data: [{ id: 'p1' }], error: null });
    const out = await listLessonPackages();
    expect(from).toHaveBeenCalledWith('lesson_packages');
    expect(called(b, 'is')!.args).toEqual(['deleted_at', null]);
    expect(out).toEqual([{ id: 'p1' }]);
  });

  it('createLessonPackage inserts key/name/price_value_key/credits', async () => {
    const b = stubFrom({ data: { id: 'p1' }, error: null });
    await createLessonPackage({ package_key: 'TEN', name: '10 pack', price_value_key: 'PRICING.LESSON10', credits: 10 });
    expect(called(b, 'insert')!.args[0]).toEqual({
      package_key: 'TEN', name: '10 pack', price_value_key: 'PRICING.LESSON10', credits: 10,
    });
  });

  it('createLessonPackage defaults credits to 0 and price_value_key null', async () => {
    const b = stubFrom({ data: { id: 'p2' }, error: null });
    await createLessonPackage({ package_key: 'ONE', name: 'single' });
    expect(called(b, 'insert')!.args[0]).toEqual({ package_key: 'ONE', name: 'single', price_value_key: null, credits: 0 });
  });

  it('throws on error', async () => {
    stubFrom({ data: null, error: { message: 'x' } });
    await expect(listLessonPackages()).rejects.toBeTruthy();
  });
});

describe('lessons: credits', () => {
  it('listLessonCredits filters by client when given', async () => {
    const b = stubFrom({ data: [{ id: 'lc1' }], error: null });
    const out = await listLessonCredits('cl1');
    expect(from).toHaveBeenCalledWith('lesson_credits');
    expect(called(b, 'eq')!.args).toEqual(['client_id', 'cl1']);
    expect(out).toEqual([{ id: 'lc1' }]);
  });

  it('createLessonCredit defaults credits_remaining to credits_total', async () => {
    const b = stubFrom({ data: { id: 'lc1' }, error: null });
    await createLessonCredit({ client_id: 'cl1', package_key: 'TEN', credits_total: 10 });
    expect(called(b, 'insert')!.args[0]).toEqual({
      client_id: 'cl1', package_key: 'TEN', credits_total: 10, credits_remaining: 10,
    });
  });

  it('createLessonCredit honors explicit credits_remaining', async () => {
    const b = stubFrom({ data: { id: 'lc2' }, error: null });
    await createLessonCredit({ client_id: 'cl1', credits_total: 10, credits_remaining: 4 });
    expect(called(b, 'insert')!.args[0]).toMatchObject({ package_key: null, credits_remaining: 4 });
  });

  it('throws on error', async () => {
    stubFrom({ data: null, error: { message: 'x' } });
    await expect(listLessonCredits()).rejects.toBeTruthy();
  });
});

// ─── Records ──────────────────────────────────────────────────────────────────

describe('records: horse_parties', () => {
  it('listHorseParties filters by horse when given', async () => {
    const b = stubFrom({ data: [{ id: 'hp1' }], error: null });
    const out = await listHorseParties('h1');
    expect(from).toHaveBeenCalledWith('horse_parties');
    expect(called(b, 'eq')!.args).toEqual(['horse_id', 'h1']);
    expect(out).toEqual([{ id: 'hp1' }]);
  });

  it('createHorseParty inserts the ownership/rights row', async () => {
    const b = stubFrom({ data: { id: 'hp1' }, error: null });
    await createHorseParty({ horse_id: 'h1', contact_id: 'c1', role: 'owner', share_pct: 50, effective_from: '2026-01-01', effective_to: null, notes: 'co-own' });
    expect(called(b, 'insert')!.args[0]).toEqual({
      horse_id: 'h1', contact_id: 'c1', role: 'owner', share_pct: 50, effective_from: '2026-01-01', effective_to: null, notes: 'co-own',
    });
  });

  it('createHorseParty defaults optionals to null', async () => {
    const b = stubFrom({ data: { id: 'hp2' }, error: null });
    await createHorseParty({ horse_id: 'h1', contact_id: 'c1', role: 'trainer' });
    expect(called(b, 'insert')!.args[0]).toEqual({
      horse_id: 'h1', contact_id: 'c1', role: 'trainer', share_pct: null, effective_from: null, effective_to: null, notes: null,
    });
  });

  it('throws on error', async () => {
    stubFrom({ data: null, error: { message: 'x' } });
    await expect(listHorseParties()).rejects.toBeTruthy();
  });
});

describe('records: health_events', () => {
  it('listHealthEvents filters by horse, newest first', async () => {
    const b = stubFrom({ data: [{ id: 'he1' }], error: null });
    const out = await listHealthEvents('h1');
    expect(from).toHaveBeenCalledWith('horse_health_events');
    expect(called(b, 'eq')!.args).toEqual(['horse_id', 'h1']);
    expect(called(b, 'order')!.args).toEqual(['occurred_at', { ascending: false }]);
    expect(out).toEqual([{ id: 'he1' }]);
  });

  it('createHealthEvent inserts the event row', async () => {
    const b = stubFrom({ data: { id: 'he1' }, error: null });
    await createHealthEvent({ horse_id: 'h1', event_type: 'VACCINATION', occurred_at: '2026-01-05', provider_contact_id: 'v1', next_due: '2027-01-05', notes: 'flu', document_id: 'd1' });
    expect(called(b, 'insert')!.args[0]).toEqual({
      horse_id: 'h1', event_type: 'VACCINATION', occurred_at: '2026-01-05', provider_contact_id: 'v1', next_due: '2027-01-05', notes: 'flu', document_id: 'd1',
    });
  });

  it('createHealthEvent defaults occurred_at + optionals', async () => {
    const b = stubFrom({ data: { id: 'he2' }, error: null });
    await createHealthEvent({ horse_id: 'h1', event_type: 'COGGINS' });
    const args = called(b, 'insert')!.args[0] as Record<string, unknown>;
    expect(args).toMatchObject({ horse_id: 'h1', event_type: 'COGGINS', provider_contact_id: null, next_due: null, notes: null, document_id: null });
    expect(typeof args.occurred_at).toBe('string');
  });

  it('throws on error', async () => {
    stubFrom({ data: null, error: { message: 'x' } });
    await expect(listHealthEvents()).rejects.toBeTruthy();
  });
});

// ─── Employees ────────────────────────────────────────────────────────────────

describe('employees: staff', () => {
  it('listStaff selects non-deleted', async () => {
    const b = stubFrom({ data: [{ id: 'sp1' }], error: null });
    const out = await listStaff();
    expect(from).toHaveBeenCalledWith('staff_profiles');
    expect(called(b, 'is')!.args).toEqual(['deleted_at', null]);
    expect(out).toEqual([{ id: 'sp1' }]);
  });

  it('createStaff inserts profile_user_id + optionals', async () => {
    const b = stubFrom({ data: { id: 'sp1' }, error: null });
    await createStaff({ profile_user_id: 'u1', contact_id: 'c1', title: 'Groom', pay_type: 'HOURLY' });
    expect(called(b, 'insert')!.args[0]).toEqual({
      profile_user_id: 'u1', contact_id: 'c1', title: 'Groom', pay_type: 'HOURLY',
    });
  });

  it('createStaff defaults optionals to null', async () => {
    const b = stubFrom({ data: { id: 'sp2' }, error: null });
    await createStaff({ profile_user_id: 'u1' });
    expect(called(b, 'insert')!.args[0]).toEqual({ profile_user_id: 'u1', contact_id: null, title: null, pay_type: null });
  });

  it('throws on error', async () => {
    stubFrom({ data: null, error: { message: 'x' } });
    await expect(listStaff()).rejects.toBeTruthy();
  });
});

describe('employees: shifts / time_entries / service_assignments', () => {
  it('listShifts filters by staff when given', async () => {
    const b = stubFrom({ data: [{ id: 'sh1' }], error: null });
    const out = await listShifts('sp1');
    expect(from).toHaveBeenCalledWith('shifts');
    expect(called(b, 'eq')!.args).toEqual(['staff_profile_id', 'sp1']);
    expect(out).toEqual([{ id: 'sh1' }]);
  });

  it('createShift inserts staff + start/end/role', async () => {
    const b = stubFrom({ data: { id: 'sh1' }, error: null });
    await createShift({ staff_profile_id: 'sp1', starts_at: '2026-01-05T08:00Z', ends_at: '2026-01-05T16:00Z', role: 'BARN' });
    expect(called(b, 'insert')!.args[0]).toEqual({
      staff_profile_id: 'sp1', starts_at: '2026-01-05T08:00Z', ends_at: '2026-01-05T16:00Z', role: 'BARN',
    });
  });

  it('listTimeEntries filters by staff', async () => {
    const b = stubFrom({ data: [{ id: 'te1' }], error: null });
    await listTimeEntries('sp1');
    expect(from).toHaveBeenCalledWith('time_entries');
    expect(called(b, 'eq')!.args).toEqual(['staff_profile_id', 'sp1']);
  });

  it('createTimeEntry inserts clock_in + optionals', async () => {
    const b = stubFrom({ data: { id: 'te1' }, error: null });
    await createTimeEntry({ staff_profile_id: 'sp1', clock_in: '2026-01-05T08:00Z' });
    expect(called(b, 'insert')!.args[0]).toEqual({
      staff_profile_id: 'sp1', clock_in: '2026-01-05T08:00Z', clock_out: null, minutes: null, source_kind: null, source_id: null,
    });
  });

  it('listServiceAssignments filters by staff', async () => {
    const b = stubFrom({ data: [{ id: 'sa1' }], error: null });
    await listServiceAssignments('sp1');
    expect(from).toHaveBeenCalledWith('service_assignments');
    expect(called(b, 'eq')!.args).toEqual(['staff_profile_id', 'sp1']);
  });

  it('createServiceAssignment inserts staff + engagement/service/scheduled', async () => {
    const b = stubFrom({ data: { id: 'sa1' }, error: null });
    await createServiceAssignment({ staff_profile_id: 'sp1', engagement_id: 'e1', service_type: 'FARRIER', scheduled_at: '2026-01-06T09:00Z' });
    expect(called(b, 'insert')!.args[0]).toEqual({
      staff_profile_id: 'sp1', engagement_id: 'e1', service_type: 'FARRIER', scheduled_at: '2026-01-06T09:00Z',
    });
  });

  it('createServiceAssignment defaults optionals to null', async () => {
    const b = stubFrom({ data: { id: 'sa2' }, error: null });
    await createServiceAssignment({ staff_profile_id: 'sp1' });
    expect(called(b, 'insert')!.args[0]).toEqual({
      staff_profile_id: 'sp1', engagement_id: null, service_type: null, scheduled_at: null,
    });
  });

  it('throws on error', async () => {
    stubFrom({ data: null, error: { message: 'x' } });
    await expect(listShifts()).rejects.toBeTruthy();
  });
});

// ─── Admin: entitlements ──────────────────────────────────────────────────────

describe('listModuleCatalog() / listTiers() / setOrgModule()', () => {
  it('listModuleCatalog lists active modules', async () => {
    const b = stubFrom({ data: [{ module_key: 'mod.lessons' }], error: null });
    const out = await listModuleCatalog();
    expect(from).toHaveBeenCalledWith('modules');
    expect(called(b, 'eq')!.args).toEqual(['active', true]);
    expect(called(b, 'order')!.args[0]).toBe('module_key');
    expect(out).toEqual([{ module_key: 'mod.lessons' }]);
  });

  it('listTiers lists active tiers ordered by sort_order', async () => {
    const b = stubFrom({ data: [{ tier_key: 'tier.lesson_brokerage' }], error: null });
    const out = await listTiers();
    expect(from).toHaveBeenCalledWith('tiers');
    expect(called(b, 'eq')!.args).toEqual(['active', true]);
    expect(called(b, 'order')!.args[0]).toBe('sort_order');
    expect(out).toEqual([{ tier_key: 'tier.lesson_brokerage' }]);
  });

  it('setOrgModule calls rpc(set_org_module, {p_org, p_key, p_enabled, p_source})', async () => {
    rpc.mockResolvedValue({ data: null, error: null });
    await setOrgModule('org1', 'mod.boarding', true, 'ADDON');
    expect(rpc).toHaveBeenCalledWith('set_org_module', {
      p_org: 'org1', p_key: 'mod.boarding', p_enabled: true, p_source: 'ADDON',
    });
  });

  it('setOrgModule defaults enabled=true, source=ADDON', async () => {
    rpc.mockResolvedValue({ data: null, error: null });
    await setOrgModule('org1', 'mod.barnops');
    expect(rpc).toHaveBeenCalledWith('set_org_module', {
      p_org: 'org1', p_key: 'mod.barnops', p_enabled: true, p_source: 'ADDON',
    });
  });

  it('setOrgModule can disable a module', async () => {
    rpc.mockResolvedValue({ data: null, error: null });
    await setOrgModule('org1', 'mod.barnops', false);
    expect(rpc).toHaveBeenCalledWith('set_org_module', {
      p_org: 'org1', p_key: 'mod.barnops', p_enabled: false, p_source: 'ADDON',
    });
  });

  it('setOrgModule throws on error', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'forbidden' } });
    await expect(setOrgModule('org1', 'mod.x')).rejects.toMatchObject({ message: 'forbidden' });
  });
});

// ─── Admin: value registry ─────────────────────────────────────────────────────

describe('businessConfig + configValues + configRequiredMissing', () => {
  it('getBusinessConfig reads the singleton row', async () => {
    const b = stubFrom({ data: { id: 'bc1', legal_entity_name: 'FHE LLC' }, error: null });
    const out = await getBusinessConfig();
    expect(from).toHaveBeenCalledWith('business_config');
    expect(called(b, 'maybeSingle')).toBeTruthy();
    expect(out).toEqual({ id: 'bc1', legal_entity_name: 'FHE LLC' });
  });

  it('updateBusinessConfig updates by id with the patch', async () => {
    const b = stubFrom({ data: { id: 'bc1', sales_tax_rate: 7.5 }, error: null });
    await updateBusinessConfig({ id: 'bc1', sales_tax_rate: 7.5 });
    expect(called(b, 'update')!.args[0]).toEqual({ id: 'bc1', sales_tax_rate: 7.5 });
    expect(called(b, 'eq')!.args).toEqual(['id', 'bc1']);
  });

  it('listConfigValues lists rows ordered by namespace then key', async () => {
    const b = stubFrom({ data: [{ id: 'cv1' }], error: null });
    const out = await listConfigValues();
    expect(from).toHaveBeenCalledWith('config_values');
    expect(allCalled(b, 'order').map((c) => c.args[0])).toEqual(['namespace', 'key']);
    expect(out).toEqual([{ id: 'cv1' }]);
  });

  it('upsertConfigValue upserts with the org+namespace+key conflict target', async () => {
    const b = stubFrom({ data: { id: 'cv1' }, error: null });
    await upsertConfigValue({ namespace: 'PRICING', key: 'LESSON', value_num: 90, category: 'rates' });
    expect(called(b, 'upsert')!.args[0]).toEqual({
      namespace: 'PRICING', key: 'LESSON', value_text: null, value_num: 90, value_json: null, category: 'rates',
    });
    expect(called(b, 'upsert')!.args[1]).toEqual({ onConflict: 'org_id,namespace,key' });
  });

  it('configRequiredMissing calls rpc(config_required_missing, {p_org})', async () => {
    rpc.mockResolvedValue({ data: [{ namespace: 'BRAND', key: 'NAME' }], error: null });
    const out = await configRequiredMissing('org1');
    expect(rpc).toHaveBeenCalledWith('config_required_missing', { p_org: 'org1' });
    expect(out).toEqual([{ namespace: 'BRAND', key: 'NAME' }]);
  });

  it('getBusinessConfig throws on error', async () => {
    stubFrom({ data: null, error: { message: 'x' } });
    await expect(getBusinessConfig()).rejects.toBeTruthy();
  });

  it('configRequiredMissing throws on error', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'x' } });
    await expect(configRequiredMissing('org1')).rejects.toBeTruthy();
  });
});

// ─── Admin: branding ───────────────────────────────────────────────────────────

describe('branding: listBrandingValues + uploadBrandingAsset', () => {
  it('listBrandingValues filters to BRAND + CONTACT namespaces', async () => {
    const b = stubFrom({ data: [{ id: 'cv1', namespace: 'BRAND' }], error: null });
    const out = await listBrandingValues();
    expect(from).toHaveBeenCalledWith('config_values');
    expect(called(b, 'in')!.args).toEqual(['namespace', ['BRAND', 'CONTACT']]);
    expect(out).toEqual([{ id: 'cv1', namespace: 'BRAND' }]);
  });

  it('uploadBrandingAsset uploads to brand-assets under the org prefix and returns the path', async () => {
    storageUpload.mockResolvedValue({ data: { path: 'org1/logo.png' }, error: null });
    const file = new File(['x'], 'logo.png', { type: 'image/png' });
    const out = await uploadBrandingAsset('org1', file);
    expect(storageFrom).toHaveBeenCalledWith('brand-assets');
    expect(storageUpload).toHaveBeenCalledWith('org1/logo.png', file, { upsert: true });
    expect(out).toBe('org1/logo.png');
  });

  it('uploadBrandingAsset honors an explicit filename', async () => {
    storageUpload.mockResolvedValue({ data: {}, error: null });
    const file = new File(['x'], 'x.png', { type: 'image/png' });
    const out = await uploadBrandingAsset('org1', file, 'brand-logo.png');
    expect(storageUpload).toHaveBeenCalledWith('org1/brand-logo.png', file, { upsert: true });
    expect(out).toBe('org1/brand-logo.png');
  });

  it('uploadBrandingAsset throws on storage error', async () => {
    storageUpload.mockResolvedValue({ data: null, error: { message: 'denied' } });
    const file = new File(['x'], 'logo.png', { type: 'image/png' });
    await expect(uploadBrandingAsset('org1', file)).rejects.toMatchObject({ message: 'denied' });
  });

  it('listBrandingValues throws on error', async () => {
    stubFrom({ data: null, error: { message: 'x' } });
    await expect(listBrandingValues()).rejects.toBeTruthy();
  });
});

// ─── Admin: products & pricing ─────────────────────────────────────────────────

describe('products + product_prices', () => {
  it('listProducts selects non-deleted ordered by name', async () => {
    const b = stubFrom({ data: [{ id: 'pr1' }], error: null });
    const out = await listProducts();
    expect(from).toHaveBeenCalledWith('products');
    expect(called(b, 'is')!.args).toEqual(['deleted_at', null]);
    expect(called(b, 'order')!.args[0]).toBe('name');
    expect(out).toEqual([{ id: 'pr1' }]);
  });

  it('createProduct inserts the mapped columns', async () => {
    const b = stubFrom({ data: { id: 'pr1' }, error: null });
    await createProduct({ product_key: 'LESSON', name: 'Lesson', service_type: 'RIDING_LESSON', module_key: 'mod.lessons', price_value_key: 'PRICING.LESSON' });
    expect(called(b, 'insert')!.args[0]).toEqual({
      product_key: 'LESSON', name: 'Lesson', service_type: 'RIDING_LESSON', module_key: 'mod.lessons', price_value_key: 'PRICING.LESSON',
    });
  });

  it('createProduct defaults optionals to null', async () => {
    const b = stubFrom({ data: { id: 'pr2' }, error: null });
    await createProduct({ product_key: 'X', name: 'X' });
    expect(called(b, 'insert')!.args[0]).toEqual({
      product_key: 'X', name: 'X', service_type: null, module_key: null, price_value_key: null,
    });
  });

  it('listProductPrices filters by product, non-deleted, newest first', async () => {
    const b = stubFrom({ data: [{ id: 'pp1' }], error: null });
    const out = await listProductPrices('pr1');
    expect(from).toHaveBeenCalledWith('product_prices');
    expect(called(b, 'eq')!.args).toEqual(['product_id', 'pr1']);
    expect(called(b, 'is')!.args).toEqual(['deleted_at', null]);
    expect(called(b, 'order')!.args).toEqual(['effective_from', { ascending: false }]);
    expect(out).toEqual([{ id: 'pp1' }]);
  });

  it('createProductPrice inserts an effective-dated price row', async () => {
    const b = stubFrom({ data: { id: 'pp1' }, error: null });
    await createProductPrice({ product_id: 'pr1', amount: 90, effective_from: '2026-01-01', effective_to: null });
    expect(called(b, 'insert')!.args[0]).toEqual({
      product_id: 'pr1', amount: 90, effective_from: '2026-01-01', effective_to: null,
    });
  });

  it('createProductPrice defaults effective_from to now', async () => {
    const b = stubFrom({ data: { id: 'pp2' }, error: null });
    await createProductPrice({ product_id: 'pr1', amount: 90 });
    const args = called(b, 'insert')!.args[0] as Record<string, unknown>;
    expect(args).toMatchObject({ product_id: 'pr1', amount: 90, effective_to: null });
    expect(typeof args.effective_from).toBe('string');
  });

  it('throws on error', async () => {
    stubFrom({ data: null, error: { message: 'x' } });
    await expect(listProducts()).rejects.toBeTruthy();
  });
});
