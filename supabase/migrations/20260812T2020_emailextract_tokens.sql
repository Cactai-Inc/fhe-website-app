-- EMAILEXTRACT — register the email merge tokens in the ONE token library.
--
-- The task's constraint: "Do NOT create an email-specific token namespace. One
-- token library." These rows go into `template_tokens` as dictionary rows
-- (template_id IS NULL), which is the same place every document token lives and
-- the same set `template_editor_tokens()` already returns — so TASK-TEXTEDIT's
-- picker lists them with no change on its side. There is no second registry.
--
-- REUSED, not redefined: PARTY.FULL_NAME and ORG.PHONE already exist and already
-- mean what the emails need. They are left exactly as they are.
--
-- ONE DEVIATION, STATED RATHER THAN SLIPPED IN: the MSG.* namespace is new, and
-- it is email-shaped. It exists because the values in it are properties of the
-- MESSAGE — the action link, the digest list, the item count, "is this a resend" —
-- and a document vocabulary has no home for them. Filing "the number of unread
-- notifications" under TXN.* or ORD.* would be worse than a new namespace. It is
-- registered here, in the one library, with descriptions, exactly as TOKENAUDIT
-- established. Owner ruling welcome; nothing else depends on the name.
--
-- HOW AN EMAIL TOKEN RESOLVES. Per TASK-TOKENAUDIT's Question 1, source_table is
-- documentation and never the resolution mechanism — document tokens resolve from
-- a CASE ladder inside generate_document, or from contract_fields for the clause
-- engine. Email tokens resolve the third way: from a value map the sender builds
-- where the data already is. source_table is therefore left NULL rather than
-- pointed at a table that nothing would read — that is the honest state, and it is
-- exactly the stale-provenance problem TOKENAUDIT documented for 59 other rows.

INSERT INTO public.template_tokens
  (template_id, namespace, field, token, kind, computed, required, party_scoped, notes)
SELECT NULL, v.ns, v.f, '{{' || v.ns || '.' || v.f || '}}', 'system', true, false, false, v.note
FROM (VALUES
  -- ── ORG: the tenant's identity as an email shows it ────────────────────────
  ('ORG','BRAND_NAME',        'The tenant''s display name, as it appears in the From line and in email prose — e.g. "French Heritage Equestrian". Comes from BRAND/NAME in the value registry. Blank only if no brand name is configured, which would also break the From header.'),
  ('ORG','FOOTER',            'The legal/contact footer block: legal entity name on one line, then email · phone · website. Built from ORG.* and CONTACT.* registry values. Insert it RAW — most emails wrap it in <pre> or a pre-line paragraph. Blank when neither a legal name nor any contact detail is configured; wrap it in {{#if ORG.FOOTER}} so an unconfigured tenant does not get a stray horizontal rule.'),
  ('ORG','FOOTER_HTML',       'The same footer as ORG.FOOTER, HTML-escaped. Use this one in the two barn-facing emails (new inquiry, new support request) that escape it today; use ORG.FOOTER everywhere else. The split preserves existing behaviour exactly — unifying it is a named follow-up, not a silent change.'),
  ('ORG','PHONE_TEL',         'The tenant''s public phone reduced to a dialable string (digits and a leading + only) — e.g. "8584393614" for "858-439-3614". For the href of a tel: link; show ORG.PHONE as the visible text. Blank when no phone is configured.'),
  ('ORG','SITE_LINK',         'The tenant''s website as it should READ to a person — e.g. "fhequestrian.com". Prefers CONTACT/URL, falling back to BRAND/SITE_URL. Blank when neither is set.'),
  ('ORG','SITE_HOST',         'The same website with any http:// or https:// stripped, for building an href — e.g. "fhequestrian.com" for "https://fhequestrian.com". Pair it with ORG.SITE_LINK as the visible text. Blank when no site is configured.'),

  -- ── DOC: the document an email is about ───────────────────────────────────
  ('DOC','TITLE',             'The document''s title as stored — e.g. "Horse Lease Agreement". Insert raw; use DOC.TITLE_HTML where the surrounding email escapes it. Blank when the document has no title, which is why the templates that need a fallback word test DOC.HAS_TITLE first.'),
  ('DOC','TITLE_HTML',        'The same title, HTML-escaped. Present because the void and change-request emails escape the title in the body but not in the subject line; both are preserved. Blank when the document has no title.'),
  ('DOC','HAS_TITLE',         'A yes/no flag: does this document have a title at all? Non-empty when it does. Use it as {{#if DOC.HAS_TITLE}}{{DOC.TITLE}}{{else}}your contract{{/if}} so the fallback wording lives in the template and can be edited. It tests for NULL, not for emptiness — an empty-string title keeps behaving exactly as it did before extraction.'),
  ('DOC','TITLES',            'The list of document titles in a multi-document delivery, for {{#each DOC.TITLES}}<li>{{.}}</li>{{/each}}. Each item is a plain title string. Empty for a single-document email.'),
  ('DOC','DISPLAY_CODE',      'The document''s short human reference — e.g. "CTR-000101". On the company copy of an execution it falls back to the first eight characters of the document id, so it is never blank there. Blank elsewhere when the document has no code.'),
  ('DOC','REFERENCE_CODE',    'The first twelve characters of the execution hash, shown to a SIGNER as a tamper-evidence reference — e.g. "a1b2c3d4e5f6". Deliberately not the full hash: that is company-copy-only. Blank on a document with no execution hash.'),
  ('DOC','INTEGRITY_HASH',    'The FULL SHA-256 execution hash. COMPANY COPY ONLY — never put this in an email to a signer; they get DOC.REFERENCE_CODE instead. Blank on a document with no execution hash.'),
  ('DOC','PARTY_NEEDS_INFO',  'A yes/no flag: does this party still have fields to fill on this contract? Non-empty when their controls allow filling AND at least one of their fields is empty. Drives the "add your information" phrase in the contract invitation — never promise an action the party''s controls do not allow.'),
  ('DOC','PARTY_CAN_EDIT_DEAL','A yes/no flag: may this party edit the terms directly? Non-empty when they may. Takes precedence over DOC.PARTY_CAN_SUGGEST — a party who can edit is never told they may only suggest.'),
  ('DOC','PARTY_CAN_SUGGEST', 'A yes/no flag: may this party suggest changes (but not make them)? Non-empty when they may. Only consult it when DOC.PARTY_CAN_EDIT_DEAL is blank; with both blank the party is read-only and reviews the terms as written.'),

  -- ── PARTY: the person an email is to or about ─────────────────────────────
  ('PARTY','FULL_NAME_HTML',  'The same value as PARTY.FULL_NAME, HTML-escaped, for use inside markup where the original sender escaped it. Blank when no name is on file — the templates fall back to "The other party" or "A member" themselves.'),
  ('PARTY','GREETING_NAME',   'The single name to greet the reader by — first name, or display name where that is what the account carries. Use as {{#if PARTY.GREETING_NAME}}Hi {{PARTY.GREETING_NAME}},{{else}}Hello,{{/if}}. Blank for a nameless contact, or when the email deliberately does not personalise (the executed-document copy is plain on purpose).'),
  ('PARTY','GUARDIAN_FIRST_NAME','The GUARDIAN''s first name on a copy redirected because the party is a minor. Blank when the guardian record has no first name — greet them as "there" in that case. A minor''s own address is never used: with no guardian email the send is skipped entirely and staff are alerted.'),
  ('PARTY','SIGNERS',         'Every signer on an execution, joined for one line of prose — e.g. "Mary Richardson, CJ Zigmund". Blank when no signer has a name on file; the company-copy templates fall back to "A signer".'),
  ('PARTY','EMAIL_HTML',      'The reader''s or submitter''s email address, HTML-escaped, for a contact line inside markup. Blank when no address is on file.'),

  -- ── HORSE ────────────────────────────────────────────────────────────────
  ('HORSE','LABEL',           'The horse an evaluation report is about, as it should read to a person — e.g. "Beaumont de Cactai". Blank on a report with no horse attached, and every use is wrapped in {{#if HORSE.LABEL}} so the sentence still reads correctly without it.'),

  -- ── TXN ──────────────────────────────────────────────────────────────────
  ('TXN','AMOUNT',            'A payment amount already formatted for display, currency symbol included — e.g. "$450.00". Blank when the amount is unknown, in which case the receipt simply says "We received your payment."'),

  -- ── REQ: a website inquiry, as the barn reads it ──────────────────────────
  ('REQ','EMAIL_HTML',        'The visitor''s email address from the inquiry, HTML-escaped. Always present — an inquiry cannot be submitted without one.'),
  ('REQ','PHONE_HTML',        'The visitor''s phone number, HTML-escaped. Blank when they did not give one.'),
  ('REQ','CONTACT_METHOD_HTML','How the visitor prefers to be reached, as a label — "Text", "Call" or "Email". An unrecognised value passes through as stored rather than disappearing. Blank when they expressed no preference.'),
  ('REQ','CATEGORY_HTML',     'What the inquiry is about, as a label — e.g. "Riding lessons", "Horse care", "Buying or selling a horse". An unrecognised value passes through as stored. Blank when uncategorised.'),
  ('REQ','CHANNEL_HTML',      'Which surface the inquiry came through — "Contact form", "Inquiry form", "Booking request" or "Kiosk". Blank when not recorded.'),
  ('REQ','ENTRY_LOCATION_HTML','The page the visitor was on when they submitted — e.g. "/lessons". Useful for knowing what they had just read. Blank when not recorded.'),
  ('REQ','SUBJECT_HTML',      'The subject line the visitor typed, HTML-escaped. Blank when the form did not ask for one.'),
  ('REQ','INTENT_HTML',       'The stated intent recorded with the inquiry — e.g. "book". Blank when not recorded.'),
  ('REQ','SUBMITTED_AT_HTML', 'When the inquiry was submitted, in Pacific time and already formatted — e.g. "Aug 12, 2026, 4:15 PM". Always present.'),
  ('REQ','AVAILABILITY_HTML', 'The visitor''s proposed times as one line, entries separated by "; " — e.g. "2026-08-20 – 2026-08-22; Weekends". Blank when they proposed none.'),
  ('REQ','DETAILS',           'The category-specific answers, for {{#each REQ.DETAILS}}. Each item has .LABEL (the humanised question, e.g. "Rider age") and .VALUE (the answer). Empty when the form asked no follow-up questions or all were left blank.'),
  ('REQ','NOTES_HTML',        'The free-text note the visitor wrote, HTML-escaped, newlines preserved by the surrounding white-space:pre-line style. Blank when they wrote nothing.'),

  -- ── MSG: properties of the message itself (see the header note) ───────────
  ('MSG','LINK',              'The one action link this email exists to offer — open the contract, activate the account, open the Request Inbox. Already absolute and correct for the deployment that sent it (preview links point at preview). Never blank on an email that has a call to action.'),
  ('MSG','COUNT',             'How many things this email is about — updates in a digest, change requests listed, sessions upcoming. Already a string. Pair with MSG.IS_SINGLE to get the grammar right.'),
  ('MSG','IS_SINGLE',         'A yes/no flag: is MSG.COUNT exactly one? Non-empty when it is. Use as {{#if MSG.IS_SINGLE}}update{{else}}updates{{/if}} so singular and plural wording is editable instead of compiled in.'),
  ('MSG','ITEMS',             'The list this email is built around — notification titles, calendar reminders, lapsed holds. Scalar items: {{#each MSG.ITEMS}}<li>{{.}}</li>{{/each}}. Already escaped where the original sender escaped. Empty when there is nothing to list, and every use is guarded so no empty <ul> is emitted.'),
  ('MSG','IS_RESEND',         'A yes/no flag on the invitation: is this the SAME link sent again, rather than a new one? Non-empty on a resend. It changes the subject as well as the opening, because the subject is the only part of a resend most people read and it has to say "you already have this" without looking like a second invitation.'),
  ('MSG','IS_GUARDIAN_COPY',  'A yes/no flag: is this copy addressed to a guardian because the party is a minor? Non-empty when it is. The greeting then names the guardian and the body names the minor as the SUBJECT of the document, not as the addressee.'),
  ('MSG','IS_SHARE',          'A yes/no flag on an evaluation report: was it shared with someone other than the buyer? Non-empty when shared. Changes "Your report" to "A report has been shared with you".'),
  ('MSG','OFFERING_LABEL',    'What the invited person bought, when the invitation carries a purchase — e.g. "Private Lesson Package". Blank on an invitation with no purchase, and the whole "your purchase is ready" line disappears with it.'),
  ('MSG','CHECKLIST',         'What the invited person will be asked to do after clicking, for {{#each MSG.CHECKLIST}}. Each item has .TITLE (the thing) and .ACTION (what to do with it, already lower-cased so it reads mid-sentence). Only unfinished items appear. Empty when nothing is assigned yet.'),
  ('MSG','EXPIRES_ON',        'The date an invitation link stops working, already written out — e.g. "Wednesday, August 20, 2026". Blank when the invitation carries no expiry, in which case the email says the link "expires soon" instead of naming a date.'),
  ('MSG','RECIPIENT_EMAIL',   'The address this personal link was issued to, shown so the reader can tell which of their addresses to sign in with. Never blank — a contract invitation cannot be sent without one.'),
  ('MSG','NEW_EMAIL',         'The address a member is changing their sign-in email TO. This email is sent to that address and nowhere else; the current address keeps working until it is verified.'),
  ('MSG','NOTE_HTML',         'The reason a party gave when voiding a contract, HTML-escaped. Blank when they gave none, in which case the email says so plainly rather than leaving a silence.'),
  ('MSG','GENERATED_AT',      'When a working copy was produced, already formatted — e.g. "August 12, 2026 at 4:15 PM". It matters because a working copy is a snapshot of an unfinished contract and the reader needs to know how fresh it is.'),
  ('MSG','SENDER_NAME',       'Who submitted a website inquiry, raw, for the subject line — falls back to "A visitor" when they left the name blank. Use MSG.SENDER_NAME_HTML in the body.'),
  ('MSG','SENDER_NAME_HTML',  'The same as MSG.SENDER_NAME, HTML-escaped, for use inside markup.'),
  ('MSG','SUBJECT_HTML',      'The subject line a member typed on a support request, HTML-escaped.'),
  ('MSG','BODY_HTML',         'The message body a member typed on a support request, HTML-escaped, newlines preserved by the surrounding white-space:pre-line style.')
) AS v(ns, f, note)
WHERE NOT EXISTS (
  SELECT 1 FROM public.template_tokens t
   WHERE t.template_id IS NULL AND t.namespace = v.ns AND t.field = v.f
);
