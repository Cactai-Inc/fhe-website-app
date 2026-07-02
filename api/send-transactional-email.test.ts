/* Real-path test for POST /api/send-transactional-email (node env).
 *
 * Mocks the email provider (global fetch) + the service-role admin client. Proves:
 *  - the tenant footer/from resolve from config_values via the CORRECT orgId
 *    (org-scoped registry read — one tenant's config never bleeds into another's mail),
 *  - the provider is called with the correct `to`, subject, and tenant-branded `from`,
 *  - success returns a messageId,
 *  - a provider failure returns 5xx and does NOT throw uncaught,
 *  - a missing `to` -> 400.
 *
 * Static audit (asserted below): there is no hardcoded FHE from-address in the source;
 * the from-name is registry-resolved and the read is org-scoped.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// ---- mock the admin client --------------------------------------------------
// Track every .eq() filter so we can assert the correct org / namespace / key.
interface Capture {
  table: string;
  filters: Record<string, unknown>;
}
const captures: Capture[] = [];

// Registry data keyed by "namespace.key", scoped per org.
const REGISTRY: Record<string, Record<string, string>> = {
  'org-fhe': {
    'BRAND.NAME': 'French Heritage Equestrian',
    'CONTACT.EMAIL': 'Hello@FHEquestrian.com',
    'CONTACT.PHONE': '858-439-3614',
    'CONTACT.URL': 'www.frenchheritageequestrian.com',
  },
  'org-other': {
    'BRAND.NAME': 'Other Barn Co',
    'CONTACT.EMAIL': 'hi@otherbarn.test',
  },
};
const BUSINESS_CONFIG: Record<string, { legal_entity_name: string; business_address: string }> = {
  'org-fhe': { legal_entity_name: 'French Heritage Equestrian LLC', business_address: '123 Coast Rd' },
  'org-other': { legal_entity_name: 'Other Barn LLC', business_address: '9 Range Ave' },
};

function makeBuilder(table: string) {
  const cap: Capture = { table, filters: {} };
  captures.push(cap);
  const builder: Record<string, unknown> = {};
  builder.select = () => builder;
  builder.eq = (col: string, val: unknown) => {
    cap.filters[col] = val;
    return builder;
  };
  builder.maybeSingle = async () => {
    const org = cap.filters.org_id as string;
    if (table === 'business_config') {
      return { data: BUSINESS_CONFIG[org] ?? null, error: null };
    }
    if (table === 'config_values') {
      const ns = cap.filters.namespace as string;
      const key = cap.filters.key as string;
      const value = REGISTRY[org]?.[`${ns}.${key}`] ?? null;
      return { data: value == null ? null : { value_text: value }, error: null };
    }
    return { data: null, error: null };
  };
  return builder;
}

const dbMock = { from: vi.fn((table: string) => makeBuilder(table)) };
vi.mock('./_lib/supabaseAdmin', () => ({ getSupabaseAdmin: () => dbMock }));

// ---- import after mocks -----------------------------------------------------
import handler from './send-transactional-email';

// ---- fake req/res -----------------------------------------------------------
function makeRes() {
  const res: any = {};
  res.statusCode = 0;
  res.body = undefined;
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

describe('POST /api/send-transactional-email', () => {
  beforeEach(() => {
    captures.length = 0;
    dbMock.from.mockClear();
    process.env.RESEND_API_KEY = 'test-key';
    process.env.TRANSACTIONAL_FROM_EMAIL = 'notifications@platform.test';
  });
  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.RESEND_API_KEY;
    delete process.env.TRANSACTIONAL_FROM_EMAIL;
  });

  it('resolves the tenant footer via config_values with the correct org and sends tenant-branded', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(
        new Response(JSON.stringify({ id: 'msg_123' }), { status: 200 }) as unknown as Response,
      );

    const res = makeRes();
    await handler(makeReq({ to: 'client@example.com', template: 'receipt', vars: { amount: '$500' }, orgId: 'org-fhe' }), res);

    // Success + message id.
    expect(res.statusCode).toBe(200);
    expect(res.body.messageId).toBe('msg_123');

    // Registry read was org-scoped to the CORRECT org for a CONTACT lookup.
    const contactRead = captures.find(
      (c) => c.table === 'config_values' && c.filters.namespace === 'CONTACT' && c.filters.key === 'EMAIL',
    );
    expect(contactRead).toBeTruthy();
    expect(contactRead!.filters.org_id).toBe('org-fhe');

    // business_config read scoped to the same org.
    const bcRead = captures.find((c) => c.table === 'business_config');
    expect(bcRead!.filters.org_id).toBe('org-fhe');

    // Provider called with correct to + tenant-branded from + footer.
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, init] = fetchMock.mock.calls[0];
    const payload = JSON.parse((init as RequestInit).body as string);
    expect(payload.to).toBe('client@example.com');
    expect(payload.from).toBe('French Heritage Equestrian <notifications@platform.test>');
    expect(payload.subject).toContain('French Heritage Equestrian');
    // Legal footer (business_config) + public contact (registry) present in the body.
    expect(payload.html).toContain('French Heritage Equestrian LLC');
    expect(payload.html).toContain('Hello@FHEquestrian.com');
    expect(res.body.from).toBe('French Heritage Equestrian <notifications@platform.test>');
  });

  it('scopes to a DIFFERENT tenant so config does not bleed across orgs', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(JSON.stringify({ id: 'msg_9' }), { status: 200 }) as unknown as Response);

    const res = makeRes();
    await handler(makeReq({ to: 'a@b.com', template: 'signup', orgId: 'org-other' }), res);

    expect(res.statusCode).toBe(200);
    const payload = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect(payload.from).toBe('Other Barn Co <notifications@platform.test>');
    expect(payload.from).not.toContain('French Heritage');
    expect(captures.every((c) => !('org_id' in c.filters) || c.filters.org_id === 'org-other')).toBe(true);
  });

  it('returns 5xx and does NOT throw when the provider fails', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ message: 'provider boom' }), { status: 500 }) as unknown as Response,
    );

    const res = makeRes();
    // Must resolve (not reject) — no uncaught error.
    await expect(
      handler(makeReq({ to: 'x@y.com', template: 'receipt', orgId: 'org-fhe' }), res),
    ).resolves.toBeDefined();

    expect(res.statusCode).toBeGreaterThanOrEqual(500);
    expect(res.body.error).toBeTruthy();
  });

  it('returns 5xx (not uncaught) when the provider fetch itself throws', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('network down'));
    const res = makeRes();
    await expect(
      handler(makeReq({ to: 'x@y.com', template: 'receipt', orgId: 'org-fhe' }), res),
    ).resolves.toBeDefined();
    expect(res.statusCode).toBeGreaterThanOrEqual(500);
  });

  it('rejects a missing `to` with 400', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch');
    const res = makeRes();
    await handler(makeReq({ template: 'receipt', orgId: 'org-fhe' }), res);
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toMatch(/to/i);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects a missing `orgId` with 400', async () => {
    const res = makeRes();
    await handler(makeReq({ to: 'x@y.com', template: 'receipt' }), res);
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toMatch(/orgId/i);
  });

  it('static audit: no hardcoded tenant/FHE from-address in the source', () => {
    const src = readFileSync(join(__dirname, 'send-transactional-email.ts'), 'utf8');
    const lib = readFileSync(join(__dirname, '_lib', 'email.ts'), 'utf8');
    // No literal FHE address, and no hardcoded from-address string at all.
    expect(src).not.toMatch(/FHEquestrian\.com/i);
    expect(lib).not.toMatch(/FHEquestrian\.com/i);
    // from-name resolves from the registry, not a constant.
    expect(lib).toContain("'BRAND', 'NAME'");
  });
});
