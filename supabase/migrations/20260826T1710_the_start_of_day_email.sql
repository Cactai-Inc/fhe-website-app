-- THE START-OF-DAY EMAIL TEMPLATE.
--
-- One email, to the shared ops inbox, listing what is on today. Modelled on
-- CALENDAR_OPS_DIGEST so the two calendar emails read as a pair.
--
-- ⚠️ `recipient_note` is not decoration — it is the only place a person editing
-- these templates can see WHO receives one, and getting that wrong is exactly the
-- complaint this work answers.

BEGIN;

INSERT INTO email_templates (email_key, title, description, category, subject, body,
                             from_address_rule, reply_to_rule, recipient_note,
                             transactional, version, active)
VALUES (
  'CALENDAR_DAY_SHEET',
  'Today at the barn (ops inbox)',
  'The start-of-day rundown: every session on today''s calendar, in order. Sent once, at 07:00 Pacific.',
  'DIGEST',
  'Today at the barn — {{MSG.COUNT}} session(s)',
  '<p>Today, {{MSG.DAY}}:</p><ul>{{#each MSG.ITEMS}}<li>{{.}}</li>{{/each}}</ul>',
  'tenant', 'none',
  'The ops inbox ONLY (hello@). Owner, 2026-08-26: admin@ receives no calendar email at all, and the client receives the 1-hour notice only.',
  true, 1, true)
ON CONFLICT (email_key) DO UPDATE
  SET subject = EXCLUDED.subject,
      body = EXCLUDED.body,
      recipient_note = EXCLUDED.recipient_note,
      active = true;

-- The two surviving calendar templates get their recipient notes corrected — the
-- CALENDAR_UPDATE note still described the fan-out that has just been retired.
UPDATE email_templates
   SET recipient_note = 'Members only. Staff and admin accounts are skipped by the sender '
                     || '(owner, 2026-08-26: admin gets no calendar email). Today this is the '
                     || '1-hour reminder and nothing else.'
 WHERE email_key = 'CALENDAR_UPDATE';

UPDATE email_templates
   SET recipient_note = 'The ops inbox ONLY (hello@). One consolidated email per sweep. This '
                     || 'is what replaced notifying each staff account individually.'
 WHERE email_key = 'CALENDAR_OPS_DIGEST';

COMMIT;
