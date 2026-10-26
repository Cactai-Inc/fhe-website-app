-- Fix round 3, item 5 — rework CONTRACT_VIEW_INVITE as a review share, not an
-- activation invite. The old copy said "set up an account", "add your information
-- and sign", and "stays open until the contract is signed". The link is now a
-- read-only share that stays open until the sender revokes it, with no account
-- language.

BEGIN;

UPDATE email_templates
   SET subject = 'A contract to review — {{ORG.BRAND_NAME}}',
       body = '<p>Hello,</p><p>{{ORG.BRAND_NAME}} has shared <strong>{{#if DOC.HAS_TITLE}}{{DOC.TITLE}}{{else}}a contract{{/if}}</strong> with you to review.</p><p><a href="{{MSG.LINK}}">Open the contract</a> to read it — it opens straight away, no account or sign-in needed. This is a read-only copy for your review.</p><p style="color:#666;font-size:12px">This review link was sent to {{MSG.RECIPIENT_EMAIL}} and stays open until the sender revokes it.<br/>{{MSG.LINK}}</p>{{#if ORG.FOOTER}}<hr/><p style="color:#666;font-size:12px;white-space:pre-line">{{ORG.FOOTER}}</p>{{/if}}',
       updated_at = now()
 WHERE email_key = 'CONTRACT_VIEW_INVITE';

COMMIT;
