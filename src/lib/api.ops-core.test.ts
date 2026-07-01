/**
 * INT-API-CORE unit tests (§15.1, Wiring & Verification Contract — real-path data test).
 *
 * Mocks the Supabase client with a chainable query-builder spy and proves each core
 * CRM / contracts / billing wrapper:
 *   - calls the CORRECT rpc(name, {p_args}) OR .from(table).insert/select/update with
 *     the right columns/filters (asserted against the tested backbone signatures),
 *   - unwraps the result the way the UI consumes it,
 *   - THROWS (never swallows) on an error payload.
 *
 * Every exported wrapper in the INT-API-CORE block is exercised here (static
 * dead-end audit: no defined-but-untested wrapper, no typo'd RPC name).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const rpc = vi.hoisted(() => vi.fn());
const from = vi.hoisted(() => vi.fn());
vi.mock('./supabase', () => ({ supabase: { rpc, from } }));

import {
  listContacts, createContact, updateContact,
  listClients,
  listHorses, createHorse, updateHorse, listHorseBreeds, listHorseColors,
  listEngagements, getEngagement,
  listContractTemplates, generateDocument,
  getDocument, listDocuments,
  recordSignature, listSignatures,
  listDeliveries, recordDelivery,
  listTransactions, getTransaction,
  listOpenBillableLines, settleBillableLines,
  listIntake,
  countContacts, countHorses, countEngagements, countOpenDocuments, countOpenBillableLines,
} from './api';

/**
 * A chainable query-builder mock. Every intermediate method (select/eq/is/order/neq/in…)
 * returns the same builder so a chain like .from(t).select().is().order() works. The
 * builder is thenable so `await builder` resolves to the configured result; terminal
 * shapes like .single()/.maybeSingle() also resolve to it. Records every call for asserts.
 */
function makeBuilder(result: { data?: unknown; error?: unknown; count?: number | null }) {
  const calls: Array<{ method: string; args: unknown[] }> = [];
  const settled = Promise.resolve(result);
  const builder: Record<string, unknown> = {
    __calls: calls,
    then: (onOk: (v: unknown) => unknown, onErr?: (e: unknown) => unknown) =>
      settled.then(onOk, onErr),
  };
  for (const m of ['select', 'insert', 'update', 'delete', 'eq', 'neq', 'is', 'in', 'order', 'gte', 'lte']) {
    builder[m] = (...args: unknown[]) => {
      calls.push({ method: m, args });
      return builder;
    };
  }
  // Terminal single-row shapes resolve directly.
  builder.single = (...args: unknown[]) => { calls.push({ method: 'single', args }); return settled; };
  builder.maybeSingle = (...args: unknown[]) => { calls.push({ method: 'maybeSingle', args }); return settled; };
  return builder;
}

/** Wire supabase.from() to return a fresh builder with the given result, per table. */
function stubFrom(result: { data?: unknown; error?: unknown; count?: number | null }) {
  const builder = makeBuilder(result);
  from.mockReturnValue(builder);
  return builder;
}

/** For getEngagement, from() is called 4× with different results; queue them in order. */
function stubFromSequence(results: Array<{ data?: unknown; error?: unknown }>) {
  const builders = results.map(makeBuilder);
  let i = 0;
  from.mockImplementation(() => builders[i++]);
  return builders;
}

const callsOf = (b: unknown) => (b as { __calls: Array<{ method: string; args: unknown[] }> }).__calls;
const called = (b: unknown, method: string) => callsOf(b).find((c) => c.method === method);

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── CRM: contacts ──────────────────────────────────────────────────────────

describe('listContacts()', () => {
  it('selects from contacts, excludes soft-deleted, ordered by full_name', async () => {
    const b = stubFrom({ data: [{ id: 'c1', full_name: 'Ada' }], error: null });
    const out = await listContacts();
    expect(from).toHaveBeenCalledWith('contacts');
    expect(called(b, 'select')!.args[0]).toBe('*');
    expect(called(b, 'is')!.args).toEqual(['deleted_at', null]);
    expect(called(b, 'order')!.args[0]).toBe('full_name');
    expect(out).toEqual([{ id: 'c1', full_name: 'Ada' }]);
  });

  it('throws on error', async () => {
    stubFrom({ data: null, error: { message: 'boom' } });
    await expect(listContacts()).rejects.toMatchObject({ message: 'boom' });
  });
});

describe('createContact()', () => {
  it('inserts the contact input and returns the created row', async () => {
    const b = stubFrom({ data: { id: 'c1', full_name: 'Ada' }, error: null });
    const out = await createContact({ full_name: 'Ada', email: 'a@x.io' });
    expect(from).toHaveBeenCalledWith('contacts');
    expect(called(b, 'insert')!.args[0]).toEqual({ full_name: 'Ada', email: 'a@x.io' });
    expect(out).toEqual({ id: 'c1', full_name: 'Ada' });
  });

  it('throws on error', async () => {
    stubFrom({ data: null, error: { message: 'x' } });
    await expect(createContact({ full_name: 'Ada' })).rejects.toBeTruthy();
  });
});

describe('updateContact()', () => {
  it('updates by id with the patch and returns the row', async () => {
    const b = stubFrom({ data: { id: 'c1', notes: 'vip' }, error: null });
    const out = await updateContact('c1', { notes: 'vip' });
    expect(called(b, 'update')!.args[0]).toEqual({ notes: 'vip' });
    expect(called(b, 'eq')!.args).toEqual(['id', 'c1']);
    expect(out).toEqual({ id: 'c1', notes: 'vip' });
  });

  it('throws on error', async () => {
    stubFrom({ data: null, error: { message: 'x' } });
    await expect(updateContact('c1', { notes: 'x' })).rejects.toBeTruthy();
  });
});

// ─── CRM: clients ─────────────────────────────────────────────────────────

describe('listClients()', () => {
  it('selects from clients excluding soft-deleted', async () => {
    const b = stubFrom({ data: [{ id: 'cl1' }], error: null });
    const out = await listClients();
    expect(from).toHaveBeenCalledWith('clients');
    expect(called(b, 'is')!.args).toEqual(['deleted_at', null]);
    expect(out).toEqual([{ id: 'cl1' }]);
  });

  it('throws on error', async () => {
    stubFrom({ data: null, error: { message: 'x' } });
    await expect(listClients()).rejects.toBeTruthy();
  });
});

// ─── Horses + lookups ───────────────────────────────────────────────────────

describe('listHorses()', () => {
  it('selects from horses excluding soft-deleted', async () => {
    const b = stubFrom({ data: [{ id: 'h1', barn_name: 'Star' }], error: null });
    const out = await listHorses();
    expect(from).toHaveBeenCalledWith('horses');
    expect(called(b, 'is')!.args).toEqual(['deleted_at', null]);
    expect(out).toEqual([{ id: 'h1', barn_name: 'Star' }]);
  });
  it('throws on error', async () => {
    stubFrom({ data: null, error: { message: 'x' } });
    await expect(listHorses()).rejects.toBeTruthy();
  });
});

describe('createHorse()', () => {
  it('inserts the horse input and returns the row', async () => {
    const b = stubFrom({ data: { id: 'h1', barn_name: 'Star' }, error: null });
    const out = await createHorse({ barn_name: 'Star', breed: 'WARMBLOOD' });
    expect(from).toHaveBeenCalledWith('horses');
    expect(called(b, 'insert')!.args[0]).toEqual({ barn_name: 'Star', breed: 'WARMBLOOD' });
    expect(out).toEqual({ id: 'h1', barn_name: 'Star' });
  });
  it('throws on error', async () => {
    stubFrom({ data: null, error: { message: 'x' } });
    await expect(createHorse({ barn_name: 'Star' })).rejects.toBeTruthy();
  });
});

describe('updateHorse()', () => {
  it('updates by id with the patch', async () => {
    const b = stubFrom({ data: { id: 'h1', notes: 'lame' }, error: null });
    const out = await updateHorse('h1', { notes: 'lame' });
    expect(called(b, 'update')!.args[0]).toEqual({ notes: 'lame' });
    expect(called(b, 'eq')!.args).toEqual(['id', 'h1']);
    expect(out).toEqual({ id: 'h1', notes: 'lame' });
  });
  it('throws on error', async () => {
    stubFrom({ data: null, error: { message: 'x' } });
    await expect(updateHorse('h1', {})).rejects.toBeTruthy();
  });
});

describe('listHorseBreeds() / listHorseColors()', () => {
  it('lists active breeds ordered by sort_order', async () => {
    const b = stubFrom({ data: [{ code: 'WARMBLOOD' }], error: null });
    const out = await listHorseBreeds();
    expect(from).toHaveBeenCalledWith('horse_breeds');
    expect(called(b, 'eq')!.args).toEqual(['active', true]);
    expect(called(b, 'order')!.args[0]).toBe('sort_order');
    expect(out).toEqual([{ code: 'WARMBLOOD' }]);
  });
  it('lists active colors', async () => {
    const b = stubFrom({ data: [{ code: 'BAY' }], error: null });
    const out = await listHorseColors();
    expect(from).toHaveBeenCalledWith('horse_colors');
    expect(called(b, 'eq')!.args).toEqual(['active', true]);
    expect(out).toEqual([{ code: 'BAY' }]);
  });
  it('throws on error', async () => {
    stubFrom({ data: null, error: { message: 'x' } });
    await expect(listHorseBreeds()).rejects.toBeTruthy();
  });
});

// ─── Engagements ────────────────────────────────────────────────────────────

describe('listEngagements()', () => {
  it('selects from engagements excluding soft-deleted', async () => {
    const b = stubFrom({ data: [{ id: 'e1' }], error: null });
    const out = await listEngagements();
    expect(from).toHaveBeenCalledWith('engagements');
    expect(called(b, 'is')!.args).toEqual(['deleted_at', null]);
    expect(out).toEqual([{ id: 'e1' }]);
  });
  it('throws on error', async () => {
    stubFrom({ data: null, error: { message: 'x' } });
    await expect(listEngagements()).rejects.toBeTruthy();
  });
});

describe('getEngagement()', () => {
  it('fetches the engagement + stages/documents/transactions rollup', async () => {
    const [eng, stages, docs, txns] = stubFromSequence([
      { data: { id: 'e1', client_id: 'cl1' }, error: null },
      { data: [{ id: 's1', stage: 'SEARCH' }], error: null },
      { data: [{ id: 'd1' }], error: null },
      { data: [{ id: 't1' }], error: null },
    ]);
    const out = await getEngagement('e1');
    expect(from).toHaveBeenNthCalledWith(1, 'engagements');
    expect(from).toHaveBeenNthCalledWith(2, 'engagement_stages');
    expect(from).toHaveBeenNthCalledWith(3, 'documents');
    expect(from).toHaveBeenNthCalledWith(4, 'transactions');
    expect(called(eng, 'eq')!.args).toEqual(['id', 'e1']);
    expect(called(stages, 'eq')!.args).toEqual(['engagement_id', 'e1']);
    expect(called(docs, 'eq')!.args).toEqual(['engagement_id', 'e1']);
    expect(called(txns, 'eq')!.args).toEqual(['engagement_id', 'e1']);
    expect(out).toEqual({
      id: 'e1', client_id: 'cl1',
      stages: [{ id: 's1', stage: 'SEARCH' }],
      documents: [{ id: 'd1' }],
      transactions: [{ id: 't1' }],
    });
  });

  it('returns null for a missing engagement (no child fetches)', async () => {
    stubFromSequence([{ data: null, error: null }]);
    expect(await getEngagement('nope')).toBeNull();
    expect(from).toHaveBeenCalledTimes(1);
  });

  it('throws on error', async () => {
    stubFromSequence([{ data: null, error: { message: 'x' } }]);
    await expect(getEngagement('e1')).rejects.toBeTruthy();
  });
});

// ─── Contracts: templates & documents ────────────────────────────────────────

describe('listContractTemplates()', () => {
  it('lists active, non-deleted templates', async () => {
    const b = stubFrom({ data: [{ template_key: 'PURCHASE' }], error: null });
    const out = await listContractTemplates();
    expect(from).toHaveBeenCalledWith('contract_templates');
    expect(called(b, 'eq')!.args).toEqual(['active', true]);
    expect(called(b, 'is')!.args).toEqual(['deleted_at', null]);
    expect(out).toEqual([{ template_key: 'PURCHASE' }]);
  });
  it('throws on error', async () => {
    stubFrom({ data: null, error: { message: 'x' } });
    await expect(listContractTemplates()).rejects.toBeTruthy();
  });
});

describe('generateDocument()', () => {
  it('calls rpc(generate_document, {p_engagement_id, p_template_key}) and returns first row', async () => {
    rpc.mockResolvedValue({ data: [{ document_id: 'd1', merged_body: 'BODY' }], error: null });
    const out = await generateDocument('e1', 'PURCHASE_AGREEMENT');
    expect(rpc).toHaveBeenCalledWith('generate_document', {
      p_engagement_id: 'e1',
      p_template_key: 'PURCHASE_AGREEMENT',
    });
    expect(out).toEqual({ document_id: 'd1', merged_body: 'BODY' });
  });

  it('unwraps a non-array (single object) payload too', async () => {
    rpc.mockResolvedValue({ data: { document_id: 'd2', merged_body: 'B' }, error: null });
    expect(await generateDocument('e1', 'K')).toEqual({ document_id: 'd2', merged_body: 'B' });
  });

  it('throws on error', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'no module' } });
    await expect(generateDocument('e1', 'K')).rejects.toMatchObject({ message: 'no module' });
  });
});

describe('getDocument() / listDocuments()', () => {
  it('getDocument fetches by id', async () => {
    const b = stubFrom({ data: { id: 'd1', status: 'DRAFT' }, error: null });
    const out = await getDocument('d1');
    expect(from).toHaveBeenCalledWith('documents');
    expect(called(b, 'eq')!.args).toEqual(['id', 'd1']);
    expect(out).toEqual({ id: 'd1', status: 'DRAFT' });
  });

  it('listDocuments filters by engagement_id when given', async () => {
    const b = stubFrom({ data: [{ id: 'd1' }], error: null });
    const out = await listDocuments('e1');
    expect(from).toHaveBeenCalledWith('documents');
    expect(called(b, 'eq')!.args).toEqual(['engagement_id', 'e1']);
    expect(out).toEqual([{ id: 'd1' }]);
  });

  it('listDocuments without arg does not filter by engagement', async () => {
    const b = stubFrom({ data: [{ id: 'd1' }], error: null });
    await listDocuments();
    expect(callsOf(b).some((c) => c.method === 'eq')).toBe(false);
  });

  it('throws on error', async () => {
    stubFrom({ data: null, error: { message: 'x' } });
    await expect(getDocument('d1')).rejects.toBeTruthy();
  });
});

// ─── Signatures ───────────────────────────────────────────────────────────

describe('recordSignature()', () => {
  it('calls rpc(record_signature, {p_document_id, p_party_role, p_typed_name, p_ip})', async () => {
    rpc.mockResolvedValue({ data: null, error: null });
    await recordSignature('d1', 'BUYER', 'Ada Lovelace', '1.2.3.4');
    expect(rpc).toHaveBeenCalledWith('record_signature', {
      p_document_id: 'd1',
      p_party_role: 'BUYER',
      p_typed_name: 'Ada Lovelace',
      p_ip: '1.2.3.4',
    });
  });

  it('defaults p_ip to null when omitted', async () => {
    rpc.mockResolvedValue({ data: null, error: null });
    await recordSignature('d1', 'SELLER', 'Bob');
    expect(rpc).toHaveBeenCalledWith('record_signature', {
      p_document_id: 'd1',
      p_party_role: 'SELLER',
      p_typed_name: 'Bob',
      p_ip: null,
    });
  });

  it('throws on error', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'sealed' } });
    await expect(recordSignature('d1', 'BUYER', 'Ada')).rejects.toMatchObject({ message: 'sealed' });
  });
});

describe('listSignatures()', () => {
  it('lists signatures for a document', async () => {
    const b = stubFrom({ data: [{ id: 'sig1', party_role: 'BUYER' }], error: null });
    const out = await listSignatures('d1');
    expect(from).toHaveBeenCalledWith('signatures');
    expect(called(b, 'eq')!.args).toEqual(['document_id', 'd1']);
    expect(out).toEqual([{ id: 'sig1', party_role: 'BUYER' }]);
  });
  it('throws on error', async () => {
    stubFrom({ data: null, error: { message: 'x' } });
    await expect(listSignatures('d1')).rejects.toBeTruthy();
  });
});

// ─── Deliveries ───────────────────────────────────────────────────────────

describe('listDeliveries() / recordDelivery()', () => {
  it('listDeliveries filters by document_id', async () => {
    const b = stubFrom({ data: [{ id: 'del1' }], error: null });
    const out = await listDeliveries('d1');
    expect(from).toHaveBeenCalledWith('document_deliveries');
    expect(called(b, 'eq')!.args).toEqual(['document_id', 'd1']);
    expect(out).toEqual([{ id: 'del1' }]);
  });

  it('recordDelivery inserts with channel default PORTAL', async () => {
    const b = stubFrom({ data: { id: 'del1', channel: 'PORTAL' }, error: null });
    const out = await recordDelivery({ document_id: 'd1', recipient_contact_id: 'c1' });
    expect(from).toHaveBeenCalledWith('document_deliveries');
    expect(called(b, 'insert')!.args[0]).toEqual({
      document_id: 'd1',
      recipient_contact_id: 'c1',
      channel: 'PORTAL',
      copy_url: null,
    });
    expect(out).toEqual({ id: 'del1', channel: 'PORTAL' });
  });

  it('recordDelivery honors an explicit channel + copy_url', async () => {
    const b = stubFrom({ data: { id: 'del2' }, error: null });
    await recordDelivery({ document_id: 'd1', recipient_contact_id: 'c1', channel: 'EMAIL', copy_url: 'u' });
    expect(called(b, 'insert')!.args[0]).toMatchObject({ channel: 'EMAIL', copy_url: 'u' });
  });

  it('throws on error', async () => {
    stubFrom({ data: null, error: { message: 'x' } });
    await expect(recordDelivery({ document_id: 'd1', recipient_contact_id: 'c1' })).rejects.toBeTruthy();
  });
});

// ─── Transactions ─────────────────────────────────────────────────────────

describe('listTransactions() / getTransaction()', () => {
  it('listTransactions selects non-deleted', async () => {
    const b = stubFrom({ data: [{ id: 't1' }], error: null });
    const out = await listTransactions();
    expect(from).toHaveBeenCalledWith('transactions');
    expect(called(b, 'is')!.args).toEqual(['deleted_at', null]);
    expect(out).toEqual([{ id: 't1' }]);
  });

  it('getTransaction fetches by id', async () => {
    const b = stubFrom({ data: { id: 't1' }, error: null });
    const out = await getTransaction('t1');
    expect(called(b, 'eq')!.args).toEqual(['id', 't1']);
    expect(out).toEqual({ id: 't1' });
  });

  it('throws on error', async () => {
    stubFrom({ data: null, error: { message: 'x' } });
    await expect(listTransactions()).rejects.toBeTruthy();
  });
});

// ─── Billing: billable_lines + settlement ────────────────────────────────

describe('listOpenBillableLines()', () => {
  it('filters status OPEN and the payer when given', async () => {
    const b = stubFrom({ data: [{ id: 'bl1', status: 'OPEN' }], error: null });
    const out = await listOpenBillableLines('payer1');
    expect(from).toHaveBeenCalledWith('billable_lines');
    expect(callsOf(b).find((c) => c.method === 'eq' && c.args[0] === 'status')!.args).toEqual(['status', 'OPEN']);
    expect(callsOf(b).find((c) => c.method === 'eq' && c.args[0] === 'payer_contact_id')!.args)
      .toEqual(['payer_contact_id', 'payer1']);
    expect(out).toEqual([{ id: 'bl1', status: 'OPEN' }]);
  });

  it('omits the payer filter when no payer given', async () => {
    const b = stubFrom({ data: [], error: null });
    await listOpenBillableLines();
    expect(callsOf(b).some((c) => c.method === 'eq' && c.args[0] === 'payer_contact_id')).toBe(false);
  });

  it('throws on error', async () => {
    stubFrom({ data: null, error: { message: 'x' } });
    await expect(listOpenBillableLines()).rejects.toBeTruthy();
  });
});

describe('settleBillableLines()', () => {
  it('calls rpc(settle_billable_lines, {p_payer_contact_id, p_period}) and returns rows', async () => {
    rpc.mockResolvedValue({ data: [{ transaction_id: 't1', amount: 100, lines_settled: 3 }], error: null });
    const out = await settleBillableLines('payer1', '[2026-01-01,2026-02-01)');
    expect(rpc).toHaveBeenCalledWith('settle_billable_lines', {
      p_payer_contact_id: 'payer1',
      p_period: '[2026-01-01,2026-02-01)',
    });
    expect(out).toEqual([{ transaction_id: 't1', amount: 100, lines_settled: 3 }]);
  });

  it('defaults p_period to null when omitted', async () => {
    rpc.mockResolvedValue({ data: [], error: null });
    await settleBillableLines('payer1');
    expect(rpc).toHaveBeenCalledWith('settle_billable_lines', {
      p_payer_contact_id: 'payer1',
      p_period: null,
    });
  });

  it('throws on error', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'no lines' } });
    await expect(settleBillableLines('payer1')).rejects.toMatchObject({ message: 'no lines' });
  });
});

// ─── Public intake ────────────────────────────────────────────────────────

describe('listIntake()', () => {
  it('lists request rows newest first', async () => {
    const b = stubFrom({ data: [{ id: 'r1', status: 'new' }], error: null });
    const out = await listIntake();
    expect(from).toHaveBeenCalledWith('requests');
    expect(called(b, 'order')!.args).toEqual(['created_at', { ascending: false }]);
    expect(out).toEqual([{ id: 'r1', status: 'new' }]);
  });
  it('throws on error', async () => {
    stubFrom({ data: null, error: { message: 'x' } });
    await expect(listIntake()).rejects.toBeTruthy();
  });
});

// ─── Count helpers ──────────────────────────────────────────────────────────

describe('count* helpers', () => {
  it('countContacts uses head+exact count on contacts', async () => {
    const b = stubFrom({ count: 7, error: null });
    const out = await countContacts();
    expect(from).toHaveBeenCalledWith('contacts');
    expect(called(b, 'select')!.args).toEqual(['*', { count: 'exact', head: true }]);
    expect(out).toBe(7);
  });

  it('countHorses counts non-deleted horses', async () => {
    const b = stubFrom({ count: 3, error: null });
    expect(await countHorses()).toBe(3);
    expect(from).toHaveBeenCalledWith('horses');
    expect(called(b, 'is')!.args).toEqual(['deleted_at', null]);
  });

  it('countEngagements counts non-deleted engagements', async () => {
    stubFrom({ count: 2, error: null });
    expect(await countEngagements()).toBe(2);
    expect(from).toHaveBeenCalledWith('engagements');
  });

  it('countOpenDocuments excludes EXECUTED', async () => {
    const b = stubFrom({ count: 5, error: null });
    expect(await countOpenDocuments()).toBe(5);
    expect(from).toHaveBeenCalledWith('documents');
    expect(called(b, 'neq')!.args).toEqual(['status', 'EXECUTED']);
  });

  it('countOpenBillableLines counts OPEN lines', async () => {
    const b = stubFrom({ count: 4, error: null });
    expect(await countOpenBillableLines()).toBe(4);
    expect(from).toHaveBeenCalledWith('billable_lines');
    expect(called(b, 'eq')!.args).toEqual(['status', 'OPEN']);
  });

  it('count helpers return 0 for a null count', async () => {
    stubFrom({ count: null, error: null });
    expect(await countContacts()).toBe(0);
  });

  it('throws on error', async () => {
    stubFrom({ count: null, error: { message: 'x' } });
    await expect(countContacts()).rejects.toBeTruthy();
  });
});
