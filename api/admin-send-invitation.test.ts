/* Real-path test for POST /api/admin-send-invitation (node env).
 *
 * Mocks the service-role admin client + the shared email transport. Proves both
 * invite paths:
 *  - PLAIN INVITE (no tierId): inserts an invitations row, emails the register
 *    link, never touches the provisioning RPC (legacy behavior unchanged);
 *  - PROVISIONED INVITE (tierId present): calls provision_lesson_invitation
 *    with the EXACT payload, does NOT also do the legacy insert, builds the
 *    register URL from the RPC's returned token, includes the tier label in
 *    the email body and returns { registerUrl, emailed, tierLabel };
 *  - provisioning without firstName/lastName is rejected 400 (no RPC, no insert);
 *  - a non-admin caller is rejected 403;
 *  - an RPC failure surfaces as a clean 500 with no leaked internals.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---- mutable fake state -------------------------------------------------------
const state: {
  caller: { is_admin: boolean; role: string; org_id: string | null } | null;
  insertedInvitations: Record<string, unknown>[];
  rpcError: { message: string } | null;
  rpcResult: Record<string, unknown>;
} = {
  caller: { is_admin: true, role: 'ADMIN', org_id: 'org-fhe' },
  insertedInvitations: [],
  rpcError: null,
  rpcResult: {
    invitation_id: 'inv-1',
    token: 'tok-provisioned',
    engagement_id: 'eng-1',
    tier_label: '4-Lesson Punch Card',
    amount: 500,
  },
};

// Captured sendViaProvider calls (the email transport is mocked below; the
// factory is hoisted, so the capture array must be hoisted too).
const emailCalls = vi.hoisted(() => [] as Array<Record<string, unknown>>);

vi.mock('./_lib/email', () => ({
  resolveTenantEmailIdentity: vi.fn(async () => ({
    fromName: 'French Heritage Equestrian',
    fromEmail: 'hello@fhe.test',
    footer: 'French Heritage Equestrian · 1 Coast Rd',
  })),
  sendViaProvider: vi.fn(async (args: Record<string, unknown>) => {
    emailCalls.push(args);
    return { ok: true };
  }),
}));

const rpc = vi.fn(async (_name: string, _args: Record<string, unknown>) => {
  if (state.rpcError) return { data: null, error: state.rpcError };
  return { data: state.rpcResult, error: null };
});

const dbMock = {
  auth: {
    getUser: vi.fn(async (_token: string) => {
      if (!state.caller) return { data: { user: null }, error: { message: 'bad token' } };
      return { data: { user: { id: 'caller-1' } }, error: null };
    }),
  },
  from: vi.fn((table: string) => {
    const builder: any = {};
    builder.select = () => builder;
    builder.eq = () => builder;
    builder.maybeSingle = async () => ({ data: state.caller, error: null });
    builder.insert = async (row: Record<string, unknown>) => {
      if (table === 'invitations') state.insertedInvitations.push(row);
      return { error: null };
    };
    return builder;
  }),
  rpc,
};

vi.mock('./_lib/supabaseAdmin', () => ({ getSupabaseAdmin: () => dbMock }));

// ---- import after mocks -------------------------------------------------------
import handler from './admin-send-invitation';

// ---- fake req/res -------------------------------------------------------------
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
  return {
    method,
    headers: { authorization: 'Bearer tok', origin: 'https://app.fhe.test' },
    body,
  } as any;
}

const PROVISION_BODY = {
  email: 'alice@example.com',
  firstName: 'Alice',
  lastName: 'Client',
  tierId: 'tier-4pc',
  markPaid: true,
  paymentMethod: 'Zelle',
  notes: 'paid via Zelle 7/1',
};

describe('POST /api/admin-send-invitation', () => {
  beforeEach(() => {
    state.caller = { is_admin: true, role: 'ADMIN', org_id: 'org-fhe' };
    state.insertedInvitations = [];
    state.rpcError = null;
    emailCalls.length = 0;
    rpc.mockClear();
    dbMock.from.mockClear();
  });

  it('plain invite (no tierId): inserts an invitation, emails the link, never calls the RPC', async () => {
    const res = makeRes();
    await handler(makeReq({ email: 'plain@example.com', expiresInDays: 7 }), res);

    expect(res.statusCode).toBe(200);
    expect(rpc).not.toHaveBeenCalled();

    // Legacy insert happened with the emailed token.
    expect(state.insertedInvitations).toHaveLength(1);
    const inserted = state.insertedInvitations[0];
    expect(inserted).toMatchObject({ email: 'plain@example.com', org_id: 'org-fhe', status: 'sent' });
    expect(res.body.registerUrl).toBe(`https://app.fhe.test/register?token=${inserted.token}`);
    expect(res.body.emailed).toBe(true);
    expect(res.body.tierLabel).toBeUndefined();

    // Email carries the link but no purchase line.
    expect(emailCalls).toHaveLength(1);
    expect(emailCalls[0].to).toBe('plain@example.com');
    expect(String(emailCalls[0].html)).toContain(res.body.registerUrl);
    expect(String(emailCalls[0].html)).not.toContain('is ready');
  });

  it('provisioned invite: calls provision_lesson_invitation with the exact payload, no legacy insert', async () => {
    const res = makeRes();
    await handler(makeReq(PROVISION_BODY), res);

    expect(res.statusCode).toBe(200);
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith('provision_lesson_invitation', {
      p_email: 'alice@example.com',
      p_first_name: 'Alice',
      p_last_name: 'Client',
      p_tier_id: 'tier-4pc',
      p_mark_paid: true,
      p_payment_method: 'Zelle',
      p_notes: 'paid via Zelle 7/1',
    });

    // NO legacy invitation insert on this path — the RPC created it.
    expect(state.insertedInvitations).toHaveLength(0);

    // Register URL uses the RPC's token; the tier label rides along.
    expect(res.body).toEqual({
      registerUrl: 'https://app.fhe.test/register?token=tok-provisioned',
      emailed: true,
      tierLabel: '4-Lesson Punch Card',
    });

    // The email body announces the purchase.
    expect(emailCalls).toHaveLength(1);
    expect(String(emailCalls[0].html)).toContain(
      'Your 4-Lesson Punch Card is ready — create your account to sign your documents and get started.',
    );
    expect(String(emailCalls[0].html)).toContain('https://app.fhe.test/register?token=tok-provisioned');
  });

  it('provisioned invite with requestId (Request Inbox) passes p_request_id through to the RPC', async () => {
    const res = makeRes();
    await handler(makeReq({ ...PROVISION_BODY, requestId: 'req-42' }), res);

    expect(res.statusCode).toBe(200);
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith('provision_lesson_invitation', {
      p_email: 'alice@example.com',
      p_first_name: 'Alice',
      p_last_name: 'Client',
      p_tier_id: 'tier-4pc',
      p_mark_paid: true,
      p_payment_method: 'Zelle',
      p_notes: 'paid via Zelle 7/1',
      p_request_id: 'req-42',
    });
    // Still no legacy insert on the provisioned path.
    expect(state.insertedInvitations).toHaveLength(0);
  });

  it('plain invite with requestId stamps request_id on the legacy insert', async () => {
    const res = makeRes();
    await handler(makeReq({ email: 'plain@example.com', requestId: 'req-7' }), res);

    expect(res.statusCode).toBe(200);
    expect(rpc).not.toHaveBeenCalled();
    expect(state.insertedInvitations).toHaveLength(1);
    expect(state.insertedInvitations[0]).toMatchObject({
      email: 'plain@example.com',
      request_id: 'req-7',
    });
  });

  it('unpaid provisioning sends p_mark_paid=false and null payment method/notes', async () => {
    const res = makeRes();
    await handler(makeReq({ email: 'alice@example.com', firstName: 'Alice', lastName: 'Client', tierId: 'tier-4pc' }), res);

    expect(res.statusCode).toBe(200);
    expect(rpc).toHaveBeenCalledWith('provision_lesson_invitation', expect.objectContaining({
      p_mark_paid: false,
      p_payment_method: null,
      p_notes: null,
    }));
  });

  it('rejects provisioning without firstName/lastName: 400, no RPC, no insert', async () => {
    const res = makeRes();
    await handler(makeReq({ email: 'alice@example.com', tierId: 'tier-4pc' }), res);

    expect(res.statusCode).toBe(400);
    expect(res.body.error).toMatch(/firstName and lastName/);
    expect(rpc).not.toHaveBeenCalled();
    expect(state.insertedInvitations).toHaveLength(0);
    expect(emailCalls).toHaveLength(0);
  });

  it('rejects a non-admin caller with 403 — no RPC, no insert', async () => {
    state.caller = { is_admin: false, role: 'MEMBER', org_id: 'org-fhe' };
    const res = makeRes();
    await handler(makeReq(PROVISION_BODY), res);

    expect(res.statusCode).toBe(403);
    expect(rpc).not.toHaveBeenCalled();
    expect(state.insertedInvitations).toHaveLength(0);
  });

  it('an RPC failure surfaces as a clean 500 with no leaked internals', async () => {
    state.rpcError = { message: 'provision_lesson_invitation: tier not found (internal detail)' };
    const res = makeRes();
    await handler(makeReq(PROVISION_BODY), res);

    expect(res.statusCode).toBe(500);
    expect(res.body.error).toBe('could not create invitation');
    expect(JSON.stringify(res.body)).not.toContain('tier not found');
    expect(emailCalls).toHaveLength(0);
  });

  it('rejects a missing bearer token with 401', async () => {
    const res = makeRes();
    await handler({ method: 'POST', headers: {}, body: PROVISION_BODY } as any, res);
    expect(res.statusCode).toBe(401);
    expect(rpc).not.toHaveBeenCalled();
  });
});
