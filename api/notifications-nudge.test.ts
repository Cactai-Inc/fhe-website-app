/* Real-path test for /api/notifications-nudge (node env).
 *
 * Mocks the service-role admin client + the shared email transport. Proves the
 * unread-notifications email nudge (BOOKING_FLOWS_PLAN §1 Messaging decision):
 *  - ONE tenant-branded digest per user with pending notifications, listing the
 *    title lines + the /app CTA, and 'You have N updates at {brand}' subjects;
 *  - emailed_at is stamped ONLY on the digested rows and ONLY after a
 *    successful send (a provider failure marks nothing — retry next run);
 *  - the 30-minute grace: a just-created notification is NOT emailed;
 *  - the per-digest cap: at most 10 titles per user, the rest stay pending;
 *  - unauthenticated calls are rejected 401 (no DB reads, no mail) while the
 *    x-vercel-cron header path and the CRON_SECRET bearer path are admitted;
 *  - singular wording: 'You have 1 update at {brand}';
 *  - one user's transport blow-up does not block the next user (per-user fence).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ---- mutable fake state -------------------------------------------------------
interface NotificationRow {
  id: string;
  user_id: string;
  org_id: string | null;
  title: string;
  created_at: string;
  read_at: string | null;
  emailed_at: string | null;
}

const state: {
  notifications: NotificationRow[];
  profiles: Record<string, { email: string | null; org_id: string | null }>;
  markCalls: Array<{ ids: string[]; patch: Record<string, unknown> }>;
} = { notifications: [], profiles: {}, markCalls: [] };

// Captured sendViaProvider calls + per-recipient failure knobs (hoisted: the
// vi.mock factory below runs before this module's body).
const emailCalls = vi.hoisted(() => [] as Array<Record<string, unknown>>);
const emailBehavior = vi.hoisted(() => ({
  failFor: new Set<string>(), // sendViaProvider resolves { ok: false }
  throwFor: new Set<string>(), // sendViaProvider throws (transport blow-up)
}));

vi.mock('./_lib/email', () => ({
  resolveTenantEmailIdentity: vi.fn(async (_db: unknown, orgId: string) => ({
    fromName: orgId === 'org-other' ? 'Other Barn Co' : 'French Heritage Equestrian',
    fromEmail: 'hello@fhe.test',
    footer: 'French Heritage Equestrian · 1 Coast Rd',
    contactEmail: null,
  })),
  sendViaProvider: vi.fn(async (args: { to: string }) => {
    if (emailBehavior.throwFor.has(args.to)) throw new Error('smtp exploded');
    emailCalls.push(args as unknown as Record<string, unknown>);
    if (emailBehavior.failFor.has(args.to)) return { ok: false, messageId: null, error: 'boom' };
    return { ok: true, messageId: 'msg-1' };
  }),
}));

function makeBuilder(table: string) {
  const isFilters: Record<string, null> = {};
  const eqFilters: Record<string, unknown> = {};
  const ltFilters: Record<string, string> = {};
  const builder: any = {};
  builder.select = () => builder;
  builder.is = (col: string, val: null) => {
    isFilters[col] = val;
    return builder;
  };
  builder.eq = (col: string, val: unknown) => {
    eqFilters[col] = val;
    return builder;
  };
  builder.lt = (col: string, val: string) => {
    ltFilters[col] = val;
    return builder;
  };
  builder.order = () => builder;
  builder.maybeSingle = async () => {
    if (table === 'profiles') {
      return { data: state.profiles[eqFilters.user_id as string] ?? null, error: null };
    }
    return { data: null, error: null };
  };
  // The pending scan resolves as a thenable array, honoring the handler's
  // filters (is-null read_at/emailed_at, created_at < cutoff) so the grace
  // window is proven against the REAL query the handler builds.
  builder.then = (resolve: (r: { data: unknown; error: null }) => unknown) => {
    if (table === 'notifications') {
      const rows = state.notifications
        .filter(
          (r) =>
            (!('read_at' in isFilters) || r.read_at === null) &&
            (!('emailed_at' in isFilters) || r.emailed_at === null) &&
            (!ltFilters.created_at || r.created_at < ltFilters.created_at),
        )
        .sort((a, b) => b.created_at.localeCompare(a.created_at))
        .map((r) => ({ id: r.id, user_id: r.user_id, org_id: r.org_id, title: r.title, created_at: r.created_at }));
      return Promise.resolve({ data: rows, error: null }).then(resolve);
    }
    return Promise.resolve({ data: null, error: null }).then(resolve);
  };
  builder.update = (patch: Record<string, unknown>) => ({
    in: async (_col: string, ids: string[]) => {
      state.markCalls.push({ ids: [...ids], patch });
      for (const r of state.notifications) {
        if (ids.includes(r.id)) r.emailed_at = String(patch.emailed_at);
      }
      return { error: null };
    },
  });
  return builder;
}

const dbMock = { from: vi.fn((table: string) => makeBuilder(table)) };
vi.mock('./_lib/supabaseAdmin', () => ({ getSupabaseAdmin: () => dbMock }));

// ---- import after mocks -------------------------------------------------------
import handler from './notifications-nudge';

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
function makeReq(headers: Record<string, string> = {}, method = 'POST') {
  return { method, headers: { origin: 'https://app.fhe.test', ...headers }, body: {} } as any;
}
const AUTHED = { authorization: 'Bearer test-cron-secret' };

const minutesAgo = (m: number) => new Date(Date.now() - m * 60_000).toISOString();

function seedNotification(partial: Partial<NotificationRow> & { id: string; user_id: string }) {
  state.notifications.push({
    org_id: 'org-fhe',
    title: 'Something happened',
    created_at: minutesAgo(120),
    read_at: null,
    emailed_at: null,
    ...partial,
  });
}

describe('/api/notifications-nudge', () => {
  beforeEach(() => {
    state.notifications = [];
    state.profiles = {
      'user-a': { email: 'a@example.com', org_id: 'org-fhe' },
      'user-b': { email: 'b@example.com', org_id: 'org-fhe' },
    };
    state.markCalls = [];
    emailCalls.length = 0;
    emailBehavior.failFor.clear();
    emailBehavior.throwFor.clear();
    dbMock.from.mockClear();
    process.env.CRON_SECRET = 'test-cron-secret';
  });
  afterEach(() => {
    delete process.env.CRON_SECRET;
  });

  it('sends ONE digest per user (titles + /app CTA) and marks exactly those rows', async () => {
    seedNotification({ id: 'n1', user_id: 'user-a', title: 'Purchase Agreement is signed', created_at: minutesAgo(90) });
    seedNotification({ id: 'n2', user_id: 'user-a', title: 'Your lesson is booked', created_at: minutesAgo(60) });
    seedNotification({ id: 'n3', user_id: 'user-b', title: 'New document to sign', created_at: minutesAgo(45) });

    const res = makeRes();
    await handler(makeReq(AUTHED), res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ users_nudged: 2, notifications_marked: 3 });

    // Exactly one email per user.
    expect(emailCalls).toHaveLength(2);
    const byTo = Object.fromEntries(emailCalls.map((c) => [c.to as string, c]));
    expect(Object.keys(byTo).sort()).toEqual(['a@example.com', 'b@example.com']);

    // Plural subject + both title lines + the single /app CTA, tenant-branded.
    const a = byTo['a@example.com'];
    expect(a.subject).toBe('You have 2 updates at French Heritage Equestrian');
    expect(String(a.html)).toContain('<li>Purchase Agreement is signed</li>');
    expect(String(a.html)).toContain('<li>Your lesson is booked</li>');
    expect(String(a.html)).toContain('href="https://app.fhe.test/app"');
    expect(String(a.html)).toContain('French Heritage Equestrian · 1 Coast Rd'); // registry footer
    expect(a.fromName).toBe('French Heritage Equestrian');

    // emailed_at stamped on exactly the digested rows.
    expect(state.markCalls).toHaveLength(2);
    const markedIds = state.markCalls.flatMap((m) => m.ids).sort();
    expect(markedIds).toEqual(['n1', 'n2', 'n3']);
    expect(state.notifications.every((n) => n.emailed_at !== null)).toBe(true);
  });

  it('uses singular wording for a single pending notification', async () => {
    seedNotification({ id: 'n1', user_id: 'user-a', title: 'Your document is signed' });

    const res = makeRes();
    await handler(makeReq(AUTHED), res);

    expect(res.statusCode).toBe(200);
    expect(emailCalls).toHaveLength(1);
    expect(emailCalls[0].subject).toBe('You have 1 update at French Heritage Equestrian');
    expect(res.body).toEqual({ users_nudged: 1, notifications_marked: 1 });
  });

  it('respects the 30-minute grace: a just-created notification is not emailed', async () => {
    seedNotification({ id: 'n-old', user_id: 'user-a', title: 'Old enough', created_at: minutesAgo(31) });
    seedNotification({ id: 'n-new', user_id: 'user-a', title: 'Brand new', created_at: minutesAgo(5) });
    seedNotification({ id: 'n-only-new', user_id: 'user-b', title: 'Also brand new', created_at: minutesAgo(1) });

    const res = makeRes();
    await handler(makeReq(AUTHED), res);

    expect(res.statusCode).toBe(200);
    // user-b's only notification is inside the grace window -> no email at all.
    expect(emailCalls).toHaveLength(1);
    expect(emailCalls[0].to).toBe('a@example.com');
    // user-a's digest carries ONLY the old row; the fresh one stays pending.
    expect(String(emailCalls[0].html)).toContain('<li>Old enough</li>');
    expect(String(emailCalls[0].html)).not.toContain('Brand new');
    expect(res.body).toEqual({ users_nudged: 1, notifications_marked: 1 });
    expect(state.notifications.find((n) => n.id === 'n-old')!.emailed_at).not.toBeNull();
    expect(state.notifications.find((n) => n.id === 'n-new')!.emailed_at).toBeNull();
    expect(state.notifications.find((n) => n.id === 'n-only-new')!.emailed_at).toBeNull();
  });

  it('caps the digest at 10 titles; the overflow stays pending for the next run', async () => {
    for (let i = 1; i <= 12; i++) {
      seedNotification({ id: `n${i}`, user_id: 'user-a', title: `Update ${i}`, created_at: minutesAgo(30 + i) });
    }

    const res = makeRes();
    await handler(makeReq(AUTHED), res);

    expect(res.statusCode).toBe(200);
    expect(emailCalls).toHaveLength(1);
    expect(emailCalls[0].subject).toBe('You have 10 updates at French Heritage Equestrian');
    expect((String(emailCalls[0].html).match(/<li>/g) ?? []).length).toBe(10);
    expect(res.body).toEqual({ users_nudged: 1, notifications_marked: 10 });
    expect(state.notifications.filter((n) => n.emailed_at === null)).toHaveLength(2);
  });

  it('marks emailed_at ONLY on a successful send: a provider failure marks nothing', async () => {
    seedNotification({ id: 'n1', user_id: 'user-a', title: 'Will fail to send' });
    emailBehavior.failFor.add('a@example.com');

    const res = makeRes();
    await handler(makeReq(AUTHED), res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ users_nudged: 0, notifications_marked: 0 });
    expect(state.markCalls).toHaveLength(0);
    expect(state.notifications[0].emailed_at).toBeNull(); // retries next run
  });

  it("one user's transport blow-up does not block the next user", async () => {
    // user-a is processed first (newest notification) and THROWS mid-send.
    seedNotification({ id: 'na', user_id: 'user-a', title: 'Explodes', created_at: minutesAgo(40) });
    seedNotification({ id: 'nb', user_id: 'user-b', title: 'Still delivered', created_at: minutesAgo(50) });
    emailBehavior.throwFor.add('a@example.com');

    const res = makeRes();
    await handler(makeReq(AUTHED), res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ users_nudged: 1, notifications_marked: 1 });
    expect(emailCalls).toHaveLength(1);
    expect(emailCalls[0].to).toBe('b@example.com');
    expect(state.notifications.find((n) => n.id === 'na')!.emailed_at).toBeNull();
    expect(state.notifications.find((n) => n.id === 'nb')!.emailed_at).not.toBeNull();
  });

  it('rejects unauthenticated calls 401 — no DB reads, no mail', async () => {
    seedNotification({ id: 'n1', user_id: 'user-a' });

    const res = makeRes();
    await handler(makeReq({}), res); // no bearer, no cron header
    expect(res.statusCode).toBe(401);

    const wrong = makeRes();
    await handler(makeReq({ authorization: 'Bearer wrong-secret' }), wrong);
    expect(wrong.statusCode).toBe(401);

    expect(dbMock.from).not.toHaveBeenCalled();
    expect(emailCalls).toHaveLength(0);
    expect(state.notifications[0].emailed_at).toBeNull();
  });

  it('rejects the bearer path entirely when CRON_SECRET is unset', async () => {
    delete process.env.CRON_SECRET;
    seedNotification({ id: 'n1', user_id: 'user-a' });

    const res = makeRes();
    await handler(makeReq(AUTHED), res);
    expect(res.statusCode).toBe(401);
    expect(emailCalls).toHaveLength(0);
  });

  it('admits a Vercel cron invocation (GET + x-vercel-cron header, no bearer)', async () => {
    seedNotification({ id: 'n1', user_id: 'user-a', title: 'Cron delivered' });

    const res = makeRes();
    await handler(makeReq({ 'x-vercel-cron': '1' }, 'GET'), res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ users_nudged: 1, notifications_marked: 1 });
    expect(emailCalls).toHaveLength(1);
  });

  it('rejects a plain GET without the cron header (405) and never scans', async () => {
    const res = makeRes();
    await handler(makeReq(AUTHED, 'GET'), res);
    expect(res.statusCode).toBe(405);
    expect(dbMock.from).not.toHaveBeenCalled();
  });
});
