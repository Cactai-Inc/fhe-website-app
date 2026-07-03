/* Real-path test for POST /api/deliver-document (node env).
 *
 * Mocks the service-role admin client + the email provider (global fetch). Proves
 * the sign->EXECUTED->deliver->email tail (§15 chain 2):
 *  - an EXECUTED document with 2 parties writes exactly 2 document_deliveries rows
 *    with the correct recipient_contact_id / channel='EMAIL' / copy_url,
 *  - send-transactional-email (provider) is called once per party with the tenant-
 *    correct executed-contract template + brand (resolved from the DOCUMENT's org),
 *  - a non-EXECUTED document is rejected 409 with NO deliveries and NO email
 *    (no premature delivery),
 *  - a re-invocation is idempotent: no duplicate deliveries, no duplicate mail,
 *  - a missing documentId -> 400,
 *  - a provider failure writes NO orphan delivery row.
 *
 * Static audit (asserted below): the source guards on status==='EXECUTED' before
 * any delivery, and never inserts a delivery without first attempting the email.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// ---- mutable fake DB state --------------------------------------------------
interface DocState {
  id: string;
  engagement_id: string;
  org_id: string;
  status: string;
  title: string;
}
interface PartyState {
  contact_id: string;
  contacts: { email: string | null; first_name: string | null; last_name: string | null };
}
interface DeliveryRow {
  document_id: string;
  recipient_contact_id: string;
  channel: string;
  copy_url: string;
  org_id: string;
}

const state: {
  document: DocState | null;
  parties: PartyState[];
  deliveries: DeliveryRow[];
} = { document: null, parties: [], deliveries: [] };

// Registry (tenant brand), scoped per org — mirrors the email lib's reads.
const REGISTRY: Record<string, Record<string, string>> = {
  'org-fhe': { 'BRAND.NAME': 'French Heritage Equestrian', 'CONTACT.EMAIL': 'hello@fhe.test' },
  'org-other': { 'BRAND.NAME': 'Other Barn Co' },
};
const BUSINESS_CONFIG: Record<string, { legal_entity_name: string; business_address: string }> = {
  'org-fhe': { legal_entity_name: 'French Heritage Equestrian LLC', business_address: '1 Coast Rd' },
  'org-other': { legal_entity_name: 'Other Barn LLC', business_address: '9 Range Ave' },
};

// Track inserted deliveries by call, for assertions.
const insertedDeliveries: DeliveryRow[] = [];

function makeBuilder(table: string) {
  const filters: Record<string, unknown> = {};
  const builder: any = {};
  builder.select = () => builder;
  builder.eq = (col: string, val: unknown) => {
    filters[col] = val;
    return builder;
  };
  builder.maybeSingle = async () => {
    if (table === 'documents') {
      const d = state.document;
      return { data: d && d.id === filters.id ? d : null, error: null };
    }
    if (table === 'business_config') {
      return { data: BUSINESS_CONFIG[filters.org_id as string] ?? null, error: null };
    }
    if (table === 'config_values') {
      const org = filters.org_id as string;
      const value = REGISTRY[org]?.[`${filters.namespace}.${filters.key}`] ?? null;
      return { data: value == null ? null : { value_text: value }, error: null };
    }
    return { data: null, error: null };
  };
  // engagement_parties + document_deliveries selects resolve as thenable arrays.
  builder.then = (resolve: (r: { data: unknown; error: null }) => unknown) => {
    if (table === 'engagement_parties') {
      const rows = filters.engagement_id === state.document?.engagement_id ? state.parties : [];
      return Promise.resolve({ data: rows, error: null }).then(resolve);
    }
    if (table === 'document_deliveries') {
      const rows = state.deliveries.filter(
        (r) => r.document_id === filters.document_id && r.channel === filters.channel,
      );
      return Promise.resolve({ data: rows, error: null }).then(resolve);
    }
    return Promise.resolve({ data: null, error: null }).then(resolve);
  };
  builder.insert = async (row: DeliveryRow) => {
    if (table === 'document_deliveries') {
      state.deliveries.push(row);
      insertedDeliveries.push(row);
    }
    return { data: null, error: null };
  };
  return builder;
}

const dbMock = { from: vi.fn((table: string) => makeBuilder(table)) };
vi.mock('./_lib/supabaseAdmin', () => ({ getSupabaseAdmin: () => dbMock }));

// ---- import after mocks -----------------------------------------------------
import handler from './deliver-document';

// ---- fake req/res -----------------------------------------------------------
function makeRes() {
  const res: any = { statusCode: 0, body: undefined };
  res.status = (code: number) => {
    res.statusCode = code;
    return res;
  };
  res.json = (payload: unknown) => {
    res.body = payload;
    return res;
  };
  return res;
}
function makeReq(body: unknown, method = 'POST') {
  return { method, headers: {}, body } as any;
}

function seedExecuted(org = 'org-fhe') {
  state.document = { id: 'doc-1', engagement_id: 'eng-1', org_id: org, status: 'EXECUTED', title: 'Purchase Agreement' };
  state.parties = [
    { contact_id: 'con-buyer', contacts: { email: 'buyer@example.com', first_name: 'Bo', last_name: 'Buyer' } },
    { contact_id: 'con-seller', contacts: { email: 'seller@example.com', first_name: 'Sy', last_name: 'Seller' } },
  ];
  state.deliveries = [];
}

describe('POST /api/deliver-document', () => {
  beforeEach(() => {
    state.document = null;
    state.parties = [];
    state.deliveries = [];
    insertedDeliveries.length = 0;
    dbMock.from.mockClear();
    process.env.RESEND_API_KEY = 'test-key';
    process.env.TRANSACTIONAL_FROM_EMAIL = 'notifications@platform.test';
  });
  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.RESEND_API_KEY;
    delete process.env.TRANSACTIONAL_FROM_EMAIL;
  });

  it('delivers to each party on EXECUTED: 2 rows + 2 tenant-branded emails', async () => {
    seedExecuted('org-fhe');
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(JSON.stringify({ id: 'msg_x' }), { status: 200 }) as unknown as Response);

    const res = makeRes();
    await handler(makeReq({ documentId: 'doc-1' }), res);

    expect(res.statusCode).toBe(200);

    // Exactly two deliveries, one per party, correct recipient/channel/copy_url.
    expect(insertedDeliveries).toHaveLength(2);
    const byRecipient = Object.fromEntries(insertedDeliveries.map((d) => [d.recipient_contact_id, d]));
    expect(Object.keys(byRecipient).sort()).toEqual(['con-buyer', 'con-seller']);
    for (const d of insertedDeliveries) {
      expect(d.document_id).toBe('doc-1');
      expect(d.channel).toBe('EMAIL');
      expect(d.copy_url).toBe('/portal/documents/doc-1');
      expect(d.org_id).toBe('org-fhe');
    }

    // One provider call per party + ONE company notification copy, tenant-correct brand + executed-contract template.
    expect(fetchMock).toHaveBeenCalledTimes(3); // 2 parties + 1 company notice
    const recipients = fetchMock.mock.calls.map((c) => JSON.parse((c[1] as RequestInit).body as string).to).sort();
    expect(recipients).toEqual(['buyer@example.com', 'hello@fhe.test', 'seller@example.com']);
    const first = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect(first.from).toBe('French Heritage Equestrian <notifications@platform.test>');
    expect(first.subject.toLowerCase()).toContain('executed');
    // Dead /portal link removed: the executed text ships inline when present
    // (mock doc has no merged_body, so just the notice + footer).
    expect(first.html).not.toContain('/portal/');
    expect(first.html).toContain('French Heritage Equestrian LLC'); // footer from the doc's org
  });

  it('resolves brand from the DOCUMENT org (isolation) — a different tenant', async () => {
    seedExecuted('org-other');
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(JSON.stringify({ id: 'msg_o' }), { status: 200 }) as unknown as Response);

    const res = makeRes();
    await handler(makeReq({ documentId: 'doc-1' }), res);

    expect(res.statusCode).toBe(200);
    const from = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string).from;
    expect(from).toBe('Other Barn Co <notifications@platform.test>');
    expect(from).not.toContain('French Heritage');
  });

  it('rejects a non-EXECUTED document (409) with NO delivery and NO email', async () => {
    seedExecuted('org-fhe');
    state.document!.status = 'PARTIALLY_SIGNED';
    const fetchMock = vi.spyOn(globalThis, 'fetch');

    const res = makeRes();
    await handler(makeReq({ documentId: 'doc-1' }), res);

    expect(res.statusCode).toBe(409);
    expect(insertedDeliveries).toHaveLength(0);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('is idempotent: a second invocation adds no duplicate deliveries or emails', async () => {
    seedExecuted('org-fhe');
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(JSON.stringify({ id: 'm' }), { status: 200 }) as unknown as Response);

    const first = makeRes();
    await handler(makeReq({ documentId: 'doc-1' }), first);
    expect(insertedDeliveries).toHaveLength(2);
    expect(fetchMock).toHaveBeenCalledTimes(3); // 2 parties + 1 company notice

    // Second run: deliveries already exist -> nothing new.
    const second = makeRes();
    await handler(makeReq({ documentId: 'doc-1' }), second);
    expect(second.statusCode).toBe(200);
    expect(second.body.delivered).toHaveLength(0);
    expect(insertedDeliveries).toHaveLength(2); // still 2 total
    expect(fetchMock).toHaveBeenCalledTimes(3); // no extra mail (company notice fired once, on the first call)
    expect(state.deliveries).toHaveLength(2);
  });

  it('writes NO orphan delivery when the provider send fails', async () => {
    seedExecuted('org-fhe');
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ message: 'boom' }), { status: 500 }) as unknown as Response,
    );

    const res = makeRes();
    await expect(handler(makeReq({ documentId: 'doc-1' }), res)).resolves.toBeDefined();
    // Email attempted but failed -> no delivery row (no orphan).
    expect(insertedDeliveries).toHaveLength(0);
  });

  it('rejects a missing documentId with 400', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch');
    const res = makeRes();
    await handler(makeReq({}), res);
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toMatch(/documentId/i);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('returns 404 for an unknown document', async () => {
    const res = makeRes();
    await handler(makeReq({ documentId: 'nope' }), res);
    expect(res.statusCode).toBe(404);
    expect(insertedDeliveries).toHaveLength(0);
  });

  it('static audit: delivery is gated on EXECUTED and only after an email attempt', () => {
    const src = readFileSync(join(__dirname, 'deliver-document.ts'), 'utf8');
    // The status guard exists and precedes any insert.
    expect(src).toContain("!== 'EXECUTED'");
    const guardIdx = src.indexOf("!== 'EXECUTED'");
    const insertIdx = src.indexOf("from('document_deliveries').insert");
    expect(guardIdx).toBeGreaterThan(-1);
    expect(insertIdx).toBeGreaterThan(guardIdx); // guard before the insert
    // The insert is reached only past the `if (!sent.ok) continue;` email gate.
    const sentGateIdx = src.indexOf('if (!sent.ok) continue;');
    expect(sentGateIdx).toBeGreaterThan(-1);
    expect(insertIdx).toBeGreaterThan(sentGateIdx);
  });
});
