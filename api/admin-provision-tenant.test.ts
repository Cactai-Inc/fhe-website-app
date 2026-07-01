/* Real-path test for POST /api/admin-provision-tenant (node env).
 *
 * Mocks the service-role admin client (auth admin + rpc). Proves the
 * SUPERADMIN-PROVISION server half (§15 chain 1):
 *  - a valid SUPER_ADMIN request find-or-creates the ADMIN auth user, then calls
 *    rpc('provision_tenant', …) with the EXACT payload, and returns { org_id };
 *  - re-running with the same email does NOT create a second auth user
 *    (idempotent find-or-create — §9);
 *  - a non-SUPER_ADMIN caller is rejected 403 (no user created, no RPC);
 *  - an RPC failure surfaces as a clean 500 with no leaked partial.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---- mutable fake auth + db state ------------------------------------------
interface AuthUser {
  id: string;
  email: string;
}

const state: {
  callerRole: string | null; // role of the token-bearing caller
  authUsers: AuthUser[]; // existing auth users, keyed by email
  createCalls: string[]; // emails passed to createUser
  rpcError: { message: string } | null;
  newOrgId: string;
  seq: number;
} = {
  callerRole: 'SUPER_ADMIN',
  authUsers: [],
  createCalls: [],
  rpcError: null,
  newOrgId: 'org-new',
  seq: 0,
};

const rpc = vi.fn(async (_name: string, _args: Record<string, unknown>) => {
  if (state.rpcError) return { data: null, error: state.rpcError };
  return { data: state.newOrgId, error: null };
});

const createUser = vi.fn(async ({ email }: { email: string }) => {
  state.createCalls.push(email);
  const existing = state.authUsers.find((u) => u.email.toLowerCase() === email.toLowerCase());
  if (existing) {
    // GoTrue returns an error for an already-registered email.
    return { data: { user: null }, error: { message: 'A user with this email address has already been registered' } };
  }
  const user = { id: `auth-${++state.seq}`, email };
  state.authUsers.push(user);
  return { data: { user }, error: null };
});

const listUsers = vi.fn(async (_params?: { page?: number; perPage?: number }) => {
  return { data: { users: state.authUsers.map((u) => ({ id: u.id, email: u.email })) }, error: null };
});

const dbMock = {
  auth: {
    getUser: vi.fn(async (_token: string) => {
      if (state.callerRole == null) return { data: { user: null }, error: { message: 'bad token' } };
      return { data: { user: { id: 'caller-1' } }, error: null };
    }),
    admin: { createUser, listUsers },
  },
  from: vi.fn((_table: string) => {
    const builder: any = {};
    builder.select = () => builder;
    builder.eq = () => builder;
    builder.maybeSingle = async () => ({ data: state.callerRole ? { role: state.callerRole } : null, error: null });
    return builder;
  }),
  rpc,
};

vi.mock('./_lib/supabaseAdmin', () => ({ getSupabaseAdmin: () => dbMock }));

// ---- import after mocks -----------------------------------------------------
import handler from './admin-provision-tenant';

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
  return { method, headers: { authorization: 'Bearer tok' }, body } as any;
}

const VALID_BODY = {
  name: 'Rival Stables',
  slug: 'rival',
  tierKey: 'tier.boarding',
  adminEmail: 'owner@rival.test',
  brand: { NAME: 'Rival' },
  modules: ['mod.employees'],
};

describe('POST /api/admin-provision-tenant', () => {
  beforeEach(() => {
    state.callerRole = 'SUPER_ADMIN';
    state.authUsers = [];
    state.createCalls = [];
    state.rpcError = null;
    state.newOrgId = 'org-new';
    state.seq = 0;
    rpc.mockClear();
    createUser.mockClear();
    listUsers.mockClear();
    dbMock.from.mockClear();
  });

  it('(a) find-or-creates the auth user then calls provision_tenant with the exact payload, returns org_id', async () => {
    const res = makeRes();
    await handler(makeReq(VALID_BODY), res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ org_id: 'org-new' });

    // Created exactly one auth user for the admin email.
    expect(createUser).toHaveBeenCalledTimes(1);
    expect(createUser.mock.calls[0][0]).toMatchObject({ email: 'owner@rival.test', email_confirm: true });
    const createdId = state.authUsers[0].id;

    // RPC called once with the exact provision payload, threading the new user id.
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith('provision_tenant', {
      p_name: 'Rival Stables',
      p_slug: 'rival',
      p_tier_key: 'tier.boarding',
      p_admin_email: 'owner@rival.test',
      p_admin_user_id: createdId,
      p_brand: { NAME: 'Rival' },
      p_legal: {},
      p_rates: {},
      p_modules: ['mod.employees'],
    });
  });

  it('(b) re-running with the same email does NOT create a second auth user (idempotent)', async () => {
    // First run creates the user.
    await handler(makeReq(VALID_BODY), makeRes());
    expect(state.authUsers).toHaveLength(1);
    const firstId = state.authUsers[0].id;

    createUser.mockClear();
    rpc.mockClear();

    // Second run: createUser reports already-registered; we resolve the existing id.
    const res = makeRes();
    await handler(makeReq(VALID_BODY), res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ org_id: 'org-new' });
    // No second user was persisted.
    expect(state.authUsers).toHaveLength(1);
    // The RPC re-ran with the SAME (existing) admin user id — re-runnable, orphan-safe.
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc.mock.calls[0][1]).toMatchObject({ p_admin_user_id: firstId });
    expect(listUsers).toHaveBeenCalled(); // fell back to lookup
  });

  it('(c) rejects a non-SUPER_ADMIN caller with 403 — no user created, no RPC', async () => {
    state.callerRole = 'ADMIN';
    const res = makeRes();
    await handler(makeReq(VALID_BODY), res);

    expect(res.statusCode).toBe(403);
    expect(res.body.error).toMatch(/forbidden/i);
    expect(createUser).not.toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalled();
  });

  it('(d) an RPC error surfaces as a clean 500 with no leaked internals', async () => {
    state.rpcError = { message: 'provision_tenant: slug already taken (internal detail)' };
    const res = makeRes();
    await handler(makeReq(VALID_BODY), res);

    expect(res.statusCode).toBe(500);
    expect(res.body.error).toBe('could not provision tenant');
    // Internal RPC detail is not leaked to the caller.
    expect(JSON.stringify(res.body)).not.toContain('slug already taken');
  });

  it('rejects a missing required field with 400 (no user, no RPC)', async () => {
    const res = makeRes();
    await handler(makeReq({ name: 'X', slug: 'x', tierKey: 'tier.boarding' /* no adminEmail */ }), res);
    expect(res.statusCode).toBe(400);
    expect(createUser).not.toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalled();
  });

  it('rejects a missing bearer token with 401', async () => {
    const res = makeRes();
    await handler({ method: 'POST', headers: {}, body: VALID_BODY } as any, res);
    expect(res.statusCode).toBe(401);
  });
});
