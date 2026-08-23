-- TASK-CREDITGRANT 6 — the one email a payment request sends.
--
-- Lives in `email_templates` like every other transactional email, so it renders
-- through `renderEmailTemplate` with the tenant's own brand identity and footer, and
-- the server code owns no word of English (EMAILEXTRACT's content/plumbing line).
--
-- TOKENS ARE THE ONE LIBRARY (api/_lib/emailTemplates.ts header): every {{NS.FIELD}}
-- used below gets a dictionary row in `template_tokens` so TASK-TEXTEDIT's picker
-- lists it. Three are new. ORD.DISPLAY_CODE in particular closes a gap ORD.UUID's own
-- notes recorded on 2026-08-12: *"The real order number lives on the purchase
-- (PUR-000001 style) and has no token today."*
--
-- ⚠️ D13, FLAGGED NOT FIXED: `email_templates` has NO editing surface in the app —
-- zero frontend references to `email_key` (grep, 2026-08-23). All 21 existing
-- templates share that gap; a 22nd does not create it and this task does not close
-- it. The email-template editor is named as the follow-up in the report.

INSERT INTO template_tokens (template_id, namespace, field, token, kind, computed, required, party_scoped, notes)
VALUES
  (NULL, 'ORD', 'DISPLAY_CODE', '{{ORD.DISPLAY_CODE}}', 'system', true, false, false,
   'The order number a person can quote back — "PUR-000123", from purchases.display_code. Blank on an order that somehow has none. Added by TASK-CREDITGRANT; it is the readable reference ORD.UUID was wrongly reached for.'),
  (NULL, 'ORD', 'LABEL', '{{ORD.LABEL}}', 'system', true, false, false,
   'What is ON the order — the live line labels joined with commas, e.g. "4-Lesson Punch Card". Voided lines are excluded. Falls back to "Your order" so a sentence built on it is never headless.'),
  (NULL, 'MSG', 'STAFF_NOTE', '{{MSG.STAFF_NOTE}}', 'system', true, false, false,
   'The note a staff member typed when they asked for payment, HTML-escaped. Blank when they typed none, and the paragraph carrying it disappears with it.')
ON CONFLICT (namespace, field) WHERE template_id IS NULL DO NOTHING;

INSERT INTO email_templates (email_key, title, description, category, subject, body,
                             from_address_rule, reply_to_rule, recipient_note, transactional, active)
VALUES (
  'PAYMENT_REQUEST',
  'Payment request for an outstanding balance',
  'Sent once, by a staff member, when they ask a client for a balance that is owed. Nothing schedules it — there is no dunning loop (D9).',
  'ORDER',
  '{{#if ORD.LABEL}}{{ORD.LABEL}}{{else}}Your order{{/if}} — {{TXN.AMOUNT}} due',
  '<p>Hello{{#if PARTY.FULL_NAME}} {{PARTY.FULL_NAME}}{{/if}},</p>' ||
  '<p>There is a balance of <strong>{{TXN.AMOUNT}}</strong> outstanding on ' ||
  '{{#if ORD.LABEL}}{{ORD.LABEL}}{{else}}your order{{/if}}' ||
  '{{#if ORD.DISPLAY_CODE}} ({{ORD.DISPLAY_CODE}}){{/if}}.</p>' ||
  '{{#if MSG.STAFF_NOTE}}<p>{{MSG.STAFF_NOTE}}</p>{{/if}}' ||
  '<p>You can open the order and tell us how you have paid here:<br/>' ||
  '<a href="{{MSG.LINK}}">{{MSG.LINK}}</a></p>' ||
  '<hr/><pre style="font-family:inherit">{{ORG.FOOTER}}</pre>',
  'tenant', 'none',
  'The buyer''s account email, falling back to their contact email when they have no login.',
  true, true)
ON CONFLICT (email_key) DO NOTHING;
