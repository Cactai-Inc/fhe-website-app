/* TASK-BOOKS1 (R4) — the customer's copy of a written-down order shows the FULL
 * price, the reduction, and that $0 is owed. This pins the ORDER_RECEIPT
 * template's three shapes (paid / comped / discounted) against the real
 * renderEmail parser, with the exact body migration 20260901T1000 published,
 * so a template or renderer change that would freeze literal {{tokens}} into a
 * customer email fails here instead of in an inbox. (Pure unit test — no DB.)
 */
import { describe, it, expect } from 'vitest';
import { renderEmail, type EmailTemplateRow } from '../api/_lib/emailTemplates.js';

const tpl: EmailTemplateRow = {
  email_key: 'ORDER_RECEIPT', title: 'Order receipt', version: 2,
  from_address_rule: 'tenant', reply_to_rule: 'none',
  subject: 'Your receipt from {{ORG.BRAND_NAME}}',
  body: `{{#if TXN.WRITE_DOWN}}<p>Your order total was {{TXN.AMOUNT}}. {{TXN.REDUCTION_LABEL}} — {{TXN.WRITE_DOWN}} was taken off{{#if TXN.COLLECTED}}, and we received your payment of {{TXN.COLLECTED}}{{/if}}. Nothing further is owed: your balance on this order is $0.00. Thank you.</p>{{else}}<p>We received your payment{{#if TXN.AMOUNT}} of {{TXN.AMOUNT}}{{/if}}. Thank you.</p>{{/if}}
<hr/><pre style="font-family:inherit">{{ORG.FOOTER}}</pre>`,
};

const base = { 'ORG.BRAND_NAME': 'FHE', 'ORG.FOOTER': 'foot' };

describe('ORDER_RECEIPT write-down wording', () => {
  it('ordinary paid order — unchanged sentence', () => {
    const out = renderEmail(tpl, { ...base, 'TXN.AMOUNT': '$120.00', 'TXN.WRITE_DOWN': null, 'TXN.COLLECTED': null, 'TXN.REDUCTION_LABEL': null });
    expect(out.html).toContain('We received your payment of $120.00. Thank you.');
    expect(out.html).not.toContain('{{');
    expect(out.missing).toEqual([]);
  });
  it('comp — full price, Complimentary, $0 owed, no payment sentence', () => {
    const out = renderEmail(tpl, { ...base, 'TXN.AMOUNT': '$880.00', 'TXN.WRITE_DOWN': '$880.00', 'TXN.COLLECTED': null, 'TXN.REDUCTION_LABEL': 'Complimentary' });
    expect(out.html).toContain('Your order total was $880.00. Complimentary — $880.00 was taken off. Nothing further is owed: your balance on this order is $0.00.');
    expect(out.html).not.toContain('received your payment');
    expect(out.html).not.toContain('{{');
  });
  it('discount — full price, Discount, collected, $0 owed', () => {
    const out = renderEmail(tpl, { ...base, 'TXN.AMOUNT': '$880.00', 'TXN.WRITE_DOWN': '$88.00', 'TXN.COLLECTED': '$792.00', 'TXN.REDUCTION_LABEL': 'Discount' });
    expect(out.html).toContain('Discount — $88.00 was taken off, and we received your payment of $792.00.');
    expect(out.html).toContain('$0.00');
    expect(out.html).not.toContain('{{');
  });
});
