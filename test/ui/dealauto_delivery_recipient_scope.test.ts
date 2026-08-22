/**
 * TASK DEALAUTO follow-up §F1 — a recipient is sent the documents their email
 * is actually on, and no others.
 *
 * Owner, 2026-08-22: "they only get things sent to them based on their email
 * being actually on it."
 *
 * WHY THIS BECAME REACHABLE. Until DEALAUTO, a delivery set was documents that
 * shared their parties — the four documents of an onboarding run all belong to
 * one person, so "all the PDFs to every party" and "each party's own PDFs" were
 * the same list and the difference could not be observed. DEALAUTO made a
 * contract's whole signing set one delivery: a lease both sides are on, plus
 * each side's own role paperwork, which the other side is not a party to. The
 * first real run of it emailed the lessee the lessor's signed liability release.
 *
 * The assertion that pins the fix is therefore ATTACHMENT IDENTITY per
 * recipient, not the count of emails sent — the batching was already right, and
 * asserting "one email each" passes on the broken version too.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── the documents of one deal: a lease both parties are on, and one document
//    that belongs to the lessor alone ────────────────────────────────────────
const LEASE = { id: 'doc-lease', title: 'Horse Lease Agreement' };
const LESSOR_RELEASE = { id: 'doc-release', title: 'General Visitor Liability Release' };
const LESSEE = { id: 'c-lessee', email: 'lessee@example.test', first_name: 'Lee', last_name: 'See' };
const LESSOR = { id: 'c-lessor', email: 'lessor@example.test', first_name: 'Les', last_name: 'Or' };

const PARTY_ROWS = [
  { document_id: LEASE.id, contact_id: LESSEE.id, contacts: LESSEE },
  { document_id: LEASE.id, contact_id: LESSOR.id, contacts: LESSOR },
  // the visitor release is the LESSOR's alone
  { document_id: LESSOR_RELEASE.id, contact_id: LESSOR.id, contacts: LESSOR },
];

const sent: Array<{ to: string; filenames: string[] }> = [];
const deliveryRows: Array<{ document_id: string; recipient_contact_id: string }> = [];

function docRow(d: { id: string; title: string }) {
  return { ...d, org_id: 'org-1', status: 'EXECUTED', display_code: d.id, merged_body: 'BODY' };
}

/** Minimal stand-in for the PostgREST builder shapes this endpoint uses. */
function makeDb() {
  return {
    from(table: string) {
      const chain: Record<string, unknown> = {};
      const result = (data: unknown) => Promise.resolve({ data, error: null });
      const self = {
        select: () => self,
        eq: () => self,
        in: (col: string, vals: string[]) => {
          if (table === 'documents') {
            chain.value = result([LEASE, LESSOR_RELEASE].filter((d) => vals.includes(d.id)).map(docRow));
          } else if (table === 'document_parties') {
            chain.value = result(PARTY_ROWS.filter((r) => vals.includes(r.document_id)));
          } else if (table === 'document_deliveries') {
            chain.value = result(deliveryRows.map((r) => ({ ...r, channel: 'EMAIL' })));
          } else {
            chain.value = result([]);
          }
          return self;
        },
        insert: (row: { document_id: string; recipient_contact_id: string }) => {
          deliveryRows.push(row);
          return Promise.resolve({ error: null });
        },
        then: (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) =>
          (chain.value as Promise<unknown>).then(res, rej),
      };
      return self;
    },
    rpc: () => Promise.resolve({ error: null }),
  };
}

vi.mock('../../api/_lib/supabaseAdmin.js', () => ({ getSupabaseAdmin: () => makeDb() }));
vi.mock('../../api/_lib/email.js', () => ({
  resolveTenantEmailIdentity: () => Promise.resolve({
    fromName: 'FHE', fromEmail: 'no-reply@example.test', footer: '',
    opsInbox: 'ops@example.test', contactEmail: 'ops@example.test',
  }),
  sendViaProvider: (m: { to: string; attachments?: Array<{ filename: string }> }) => {
    sent.push({ to: m.to, filenames: (m.attachments ?? []).map((a) => a.filename) });
    return Promise.resolve({ ok: true });
  },
}));
vi.mock('../../api/_lib/documentPdf.js', () => ({
  renderDocumentPdf: () => Promise.resolve(new Uint8Array([1])),
  pdfFileName: (t: string) => `${t}.pdf`,
}));
vi.mock('../../api/_lib/delivery.js', () => ({
  resolveMinorRecipient: () => Promise.resolve(null),
  notifyMinorRecipientsSkipped: () => Promise.resolve(undefined),
}));
vi.mock('../../api/_lib/emailTemplates.js', () => ({
  renderEmailTemplate: () => Promise.resolve({ subject: 's', html: 'h' }),
}));

import handler from '../../api/deliver-documents';

function call() {
  const res = {
    statusCode: 0,
    body: null as unknown,
    status(c: number) { this.statusCode = c; return this; },
    json(b: unknown) { this.body = b; return this; },
  };
  const req = { method: 'POST', headers: {}, body: { documentIds: [LEASE.id, LESSOR_RELEASE.id] } };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return handler(req as any, res as any).then(() => res);
}

describe('DEALAUTO F1 — party copies are scoped to the recipient', () => {
  beforeEach(() => { sent.length = 0; deliveryRows.length = 0; });

  it('sends the lessee the lease only — never the lessor’s own release', async () => {
    await call();
    const toLessee = sent.find((s) => s.to === LESSEE.email);
    expect(toLessee, 'the lessee was emailed').toBeTruthy();
    expect(toLessee!.filenames).toEqual([`${LEASE.title}.pdf`]);
    expect(toLessee!.filenames).not.toContain(`${LESSOR_RELEASE.title}.pdf`);
  });

  it('sends the lessor both, because they are a party to both', async () => {
    await call();
    const toLessor = sent.find((s) => s.to === LESSOR.email);
    expect(toLessor, 'the lessor was emailed').toBeTruthy();
    expect(toLessor!.filenames.sort()).toEqual(
      [`${LEASE.title}.pdf`, `${LESSOR_RELEASE.title}.pdf`].sort());
  });

  it('still sends ONE email per person — the batching is unchanged', async () => {
    await call();
    expect(sent.filter((s) => s.to === LESSEE.email)).toHaveLength(1);
    expect(sent.filter((s) => s.to === LESSOR.email)).toHaveLength(1);
  });

  it('logs a delivery row only for what that person was actually sent', async () => {
    await call();
    const lesseeRows = deliveryRows.filter((r) => r.recipient_contact_id === LESSEE.id);
    expect(lesseeRows.map((r) => r.document_id)).toEqual([LEASE.id]);
  });

  it('gives the company file copy the whole set', async () => {
    await call();
    const toOps = sent.find((s) => s.to === 'ops@example.test');
    expect(toOps, 'the company inbox was copied').toBeTruthy();
    expect(toOps!.filenames.sort()).toEqual(
      [`${LEASE.title}.pdf`, `${LESSOR_RELEASE.title}.pdf`].sort());
  });
});
