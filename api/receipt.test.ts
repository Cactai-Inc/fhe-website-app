/* Real-path tests for the post-payment receipt (api/_lib/receipt.ts) and the
 * Google Workspace SMTP transport priority (api/_lib/email.ts).
 *
 * Proves:
 *  - a confirmed order sends a receipt to the buyer's profile email with the
 *    ORDER's org brand + confirmed amount (registry-resolved, never hardcoded),
 *  - a missing recipient email or order resolves { sent:false } without throwing
 *    (a receipt must never fail a payment confirmation),
 *  - transport priority: with GMAIL_SMTP_USER/PASS set, mail goes via nodemailer
 *    (Google SMTP) and NOT the Resend HTTP API, even when RESEND_API_KEY exists;
 *    with neither configured the send degrades to { ok:false }.
 */
import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';

// ---- nodemailer mock ---------------------------------------------------------
const smtpSends: Record<string, unknown>[] = [];
const smtpConfigs: Record<string, unknown>[] = [];
vi.mock('nodemailer', () => ({
  default: {
    createTransport: (cfg: Record<string, unknown>) => {
      smtpConfigs.push(cfg);
      return { sendMail: async (msg: Record<string, unknown>) => { smtpSends.push(msg); return { messageId: 'smtp-1' }; } };
    },
  },
}));

// ---- fetch mock (Resend path) --------------------------------------------------
const resendCalls: unknown[] = [];
const realFetch = globalThis.fetch;

import { sendViaProvider } from './_lib/email';
import { sendOrderReceipt } from './_lib/receipt';

// ---- fake DB for receipt ------------------------------------------------------
const state: {
  order: { id: string; user_id: string; org_id: string; total: number } | null;
  profileEmail: string | null;
  paymentAmount: number | null;
  registry: Record<string, string>;
} = { order: null, profileEmail: null, paymentAmount: null, registry: {} };

function table(name: string) {
  const maybeSingle = (data: unknown) => ({ maybeSingle: async () => ({ data }) });
  if (name === 'orders') {
    return { select: () => ({ eq: () => maybeSingle(state.order) }) };
  }
  if (name === 'profiles') {
    return { select: () => ({ eq: () => maybeSingle(state.profileEmail ? { email: state.profileEmail } : null) }) };
  }
  if (name === 'payments') {
    return { select: () => ({ eq: () => ({ eq: () => maybeSingle(state.paymentAmount != null ? { amount: state.paymentAmount } : null) }) }) };
  }
  if (name === 'config_values') {
    return {
      select: () => ({
        eq: () => ({
          eq: (_c: string, ns: string) => ({
            eq: (_k: string, key: string) => maybeSingle(
              state.registry[`${ns}.${key}`] ? { value_text: state.registry[`${ns}.${key}`] } : null),
          }),
        }),
      }),
    };
  }
  if (name === 'business_config') {
    return { select: () => ({ eq: () => maybeSingle({ legal_entity_name: 'French Heritage Equestrian', business_address: null }) }) };
  }
  throw new Error(`unexpected table ${name}`);
}
const dbMock = { from: table } as unknown as SupabaseClient;

beforeEach(() => {
  smtpSends.length = 0;
  smtpConfigs.length = 0;
  resendCalls.length = 0;
  delete process.env.GMAIL_SMTP_USER;
  delete process.env.GMAIL_SMTP_PASS;
  delete process.env.RESEND_API_KEY;
  process.env.TRANSACTIONAL_FROM_EMAIL = 'hello@fhequestrian.com';
  state.order = { id: 'order-1', user_id: 'user-1', org_id: 'org-fhe', total: 150 };
  state.profileEmail = 'client@example.com';
  state.paymentAmount = 150.37;
  state.registry = { 'BRAND.NAME': 'French Heritage Equestrian', 'CONTACT.EMAIL': 'hello@fhe.test' };
  globalThis.fetch = (async (...args: unknown[]) => {
    resendCalls.push(args);
    return { ok: true, json: async () => ({ id: 'resend-1' }) };
  }) as typeof fetch;
});

describe('transport priority', () => {
  it('prefers Google SMTP over Resend when both are configured', async () => {
    process.env.GMAIL_SMTP_USER = 'hello@fhequestrian.com';
    process.env.GMAIL_SMTP_PASS = 'app-password';
    process.env.RESEND_API_KEY = 'rk_test';
    const out = await sendViaProvider({
      to: 'x@example.com', fromName: 'FHE', fromEmail: 'hello@fhequestrian.com',
      subject: 's', html: '<p>b</p>',
    });
    expect(out).toMatchObject({ ok: true, messageId: 'smtp-1' });
    expect(smtpSends).toHaveLength(1);
    expect(resendCalls).toHaveLength(0); // Resend NOT used at launch
    expect(smtpConfigs[0]).toMatchObject({ host: 'smtp.gmail.com', port: 465, secure: true });
  });

  it('degrades gracefully when no transport is configured', async () => {
    const out = await sendViaProvider({
      to: 'x@example.com', fromName: 'FHE', fromEmail: 'hello@fhequestrian.com',
      subject: 's', html: '<p>b</p>',
    });
    expect(out.ok).toBe(false);
    expect(out.error).toBe('email provider not configured');
    expect(smtpSends).toHaveLength(0);
    expect(resendCalls).toHaveLength(0);
  });
});

describe('sendOrderReceipt', () => {
  beforeEach(() => {
    process.env.GMAIL_SMTP_USER = 'hello@fhequestrian.com';
    process.env.GMAIL_SMTP_PASS = 'app-password';
  });

  it('sends the confirmed amount with the ORDER org brand to the buyer', async () => {
    const out = await sendOrderReceipt(dbMock, 'order-1');
    expect(out).toEqual({ sent: true });
    expect(smtpSends).toHaveLength(1);
    const msg = smtpSends[0] as { to: string; from: string; subject: string; html: string };
    expect(msg.to).toBe('client@example.com');
    expect(msg.from).toContain('French Heritage Equestrian');
    expect(msg.subject).toContain('French Heritage Equestrian');
    expect(msg.html).toContain('$150.37'); // confirmed payment amount, not order.total
  });

  it('never throws: missing recipient → { sent:false }, no mail', async () => {
    state.profileEmail = null;
    const out = await sendOrderReceipt(dbMock, 'order-1');
    expect(out).toMatchObject({ sent: false, reason: 'no recipient email' });
    expect(smtpSends).toHaveLength(0);
  });

  it('never throws: unknown order → { sent:false }', async () => {
    state.order = null;
    const out = await sendOrderReceipt(dbMock, 'missing');
    expect(out).toMatchObject({ sent: false, reason: 'order not found' });
  });
});

// restore fetch for other files in this worker
afterAll(() => { globalThis.fetch = realFetch; });
