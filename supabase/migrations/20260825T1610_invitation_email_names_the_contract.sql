-- P1 ITEM 1 — ONE EMAIL THAT SAYS BOTH THINGS.
--
-- Owner: the single send must name the account claim AND the contract waiting.
-- Per D13 the WORDING is data, so it goes in the INVITATION row rather than into
-- the sender — the barn can re-word it in the Templates editor without a deploy.
--
-- SAFE TO APPLY BEFORE THE CODE SHIPS. `{{#if MSG.CONTRACT_TITLE}}` on an absent
-- token is falsey (api/_lib/emailTemplates.ts), so until the sender passes it
-- this template renders exactly the words it renders today, byte for byte.

BEGIN;

-- the token dictionary is the one library — TASK-TOKENAUDIT §Q1
INSERT INTO template_tokens (template_id, namespace, field, token, kind, computed, required, notes)
VALUES (NULL, 'MSG', 'CONTRACT_TITLE', '{{MSG.CONTRACT_TITLE}}', 'system', true, false,
  'The name of the contract an account invitation ALSO carries — set only when staff '
  'sent a contract to a counterparty who has no account yet, so ONE email claims the '
  'account and names the document waiting behind it. Passed raw, like DOC.TITLE on '
  'CONTRACT_INVITE, because it renders into the subject line as well as the body. '
  'Empty on an ordinary account invitation.')
ON CONFLICT (namespace, field) WHERE template_id IS NULL DO UPDATE
  SET notes = EXCLUDED.notes;

-- The SUBJECT is set absolutely (an idempotent assignment, so a replay lands the
-- same value); the BODY is a guarded splice, so a replay cannot double-insert it.
-- The brand leads when a contract is named: document titles carry their own em
-- dash ("Horse Lease Agreement — Standard"), and appending the brand after a
-- second one produced "… — Standard — French Heritage Equestrian".
UPDATE email_templates
   SET subject = '{{#if MSG.CONTRACT_TITLE}}{{ORG.BRAND_NAME}}: your account and your {{MSG.CONTRACT_TITLE}}'
               || '{{else}}{{#if MSG.IS_RESEND}}Here''s your invitation link again — {{ORG.BRAND_NAME}}'
               || '{{else}}Your invitation to {{ORG.BRAND_NAME}}{{/if}}{{/if}}',
       version = version + 1,
       updated_at = now()
 WHERE email_key = 'INVITATION';

UPDATE email_templates
   SET body = replace(
         replace(
           body,
           -- the greeting: name the contract before anything else
           '{{#if MSG.IS_RESEND}}<p>Here''s that link again',
           '{{#if MSG.CONTRACT_TITLE}}<p style="margin:0 0 14px;padding:12px 14px;'
           || 'border-left:3px solid #ba9935;background:#faf6ec">'
           || '<strong>Your {{MSG.CONTRACT_TITLE}} is ready for you to review.</strong><br/>'
           || 'Claim your account with the link below and we will take you straight to it — '
           || 'one link does both. If we still need anything from you, such as your address, '
           || 'we will ask for that first and then open the document.</p>{{/if}}'
           || '{{#if MSG.IS_RESEND}}<p>Here''s that link again'),
         -- the call to action: "join the community" is the wrong promise when a
         -- contract is what they were sent
         '<p>Create your account here to join the community. You can sign up with Google',
         '<p>{{#if MSG.CONTRACT_TITLE}}Create your account here to review and sign it.'
         || '{{else}}Create your account here to join the community.{{/if}}'
         || ' You can sign up with Google'),
       version = version + 1,
       updated_at = now()
 WHERE email_key = 'INVITATION'
   AND body NOT LIKE '%MSG.CONTRACT_TITLE%';

COMMIT;
