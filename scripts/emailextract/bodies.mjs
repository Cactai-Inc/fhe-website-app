/* EMAILEXTRACT — the 19 extracted email templates, in one place.
 *
 * This module is the SOURCE for two things that must never disagree:
 *   1. supabase/migrations/20260812T2010_emailextract_seed.sql  (generated)
 *   2. scripts/emailextract/diff.mjs                            (the proof)
 * If the seed and the proof were transcribed separately, a typo would make the
 * proof pass against a body that is not the one in the database. They are not.
 *
 * WHITESPACE IS SIGNIFICANT. Several of these reproduce multi-line template
 * literals including their source indentation (INVITATION most of all). Do not
 * reflow them.
 *
 * CONVENTIONS
 *  - {{X}}            raw substitution (the renderer never escapes — see
 *                     api/_lib/emailTemplates.ts for why).
 *  - {{X_HTML}}       the same value, escaped by the caller. Present only where
 *                     the original code escaped that particular interpolation and
 *                     not another one of the same value. The inconsistency is
 *                     preserved on purpose; correcting it is a named follow-up.
 *  - {{#if DOC.HAS_TITLE}}  reproduces `??` (null-check) rather than `||`
 *                     (emptiness), so a null title and an empty-string title keep
 *                     behaving exactly as they did.
 */

/** @typedef {{key:string,title:string,description:string,category:string,
 *             subject:string,body:string,fromRule?:string,replyRule?:string,
 *             transactional?:boolean,recipients:string}} EmailTemplate */

const FOOTER_P =
  '{{#if ORG.FOOTER}}<hr/><p style="color:#666;font-size:12px;white-space:pre-line">{{ORG.FOOTER}}</p>{{/if}}';
const FOOTER_P_ESCAPED =
  '{{#if ORG.FOOTER_HTML}}<hr/><p style="color:#666;font-size:12px;white-space:pre-line">{{ORG.FOOTER_HTML}}</p>{{/if}}';

/** @type {EmailTemplate[]} */
export const TEMPLATES = [
  // ─────────────────────────────── invitations ───────────────────────────────
  {
    key: 'INVITATION',
    title: 'Account invitation',
    description:
      'The activation link that turns an invited contact into an account holder. One template, two voices: the first send welcomes, the resend says "this is the same link you already have" so a mailbox can be triaged on the subject line.',
    category: 'INVITATION',
    fromRule: 'invite',
    recipients:
      'The invited address on the invitation row. Staff-initiated (admin-send-invitation), staff resend (admin-resend-invitation) and the invitee\'s own "send it again" (invitation-resend-request) all reach this one template.',
    subject:
      "{{#if MSG.IS_RESEND}}Here's your invitation link again — {{ORG.BRAND_NAME}}{{else}}Your invitation to {{ORG.BRAND_NAME}}{{/if}}",
    body:
      '\n      ' +
      "{{#if MSG.IS_RESEND}}<p>Here's that link again — this is the <strong>same invitation</strong> we sent you\n" +
      '       before, not a new one. If you still have the first email, either link works.</p>' +
      "{{else}}<p>Welcome — we're so glad to have you.</p>{{/if}}" +
      '\n      ' +
      '{{#if MSG.OFFERING_LABEL}}<p>Your {{MSG.OFFERING_LABEL}} is ready — create your account to sign your documents and get started.</p>{{/if}}' +
      '\n      ' +
      "{{#if MSG.CHECKLIST}}<p>When you click the link, here's what we'll ask you to do:</p>" +
      '<ul style="padding-left:18px">' +
      '{{#each MSG.CHECKLIST}}<li style="margin:4px 0"><strong>{{.TITLE}}</strong> — {{.ACTION}}</li>{{/each}}' +
      '</ul>' +
      '<p style="color:#666;font-size:13px">This same checklist will be on your dashboard, ticking itself off as you go.</p>{{/if}}' +
      '\n      <p>Create your account here to join the community. You can sign up with Google' +
      '\n      or set a password — your choice on the next page:</p>' +
      '\n      <p><a href="{{MSG.LINK}}">{{MSG.LINK}}</a></p>' +
      '\n      <p>{{#if MSG.EXPIRES_ON}}This link is valid until <strong>{{MSG.EXPIRES_ON}}</strong>. ' +
      "If it expires, just reach out and we'll send a fresh one." +
      "{{else}}This link expires soon. If it does, just reach out and we'll send a fresh one.{{/if}}</p>" +
      '\n      <hr/><pre style="font-family:inherit">{{ORG.FOOTER}}</pre>',
  },

  // ──────────────────────────────── contracts ────────────────────────────────
  {
    key: 'CONTRACT_INVITE',
    title: 'Contract ready to sign',
    description:
      'Sent to a contract counterparty when a document is prepared for them. The list of what they will be asked to do is built from that party\'s own document controls, so the email never promises an action the controls do not allow.',
    category: 'CONTRACT',
    recipients:
      'The counterparty contact on the named party role, at the address on their contact record (or one passed by staff). Never sent to someone who has already signed.',
    subject: 'A contract is ready for you — {{ORG.BRAND_NAME}}',
    body:
      '<p>Hello,</p>' +
      '<p><strong>{{#if DOC.HAS_TITLE}}{{DOC.TITLE}}{{else}}A contract{{/if}}</strong> has been prepared for you.</p>' +
      '<p><a href="{{MSG.LINK}}">Open the contract</a> — sign in with Google if this is a Gmail address, ' +
      "or set a password with this email. You'll land directly on the contract to " +
      '{{#if DOC.PARTY_NEEDS_INFO}}add your information, {{/if}}' +
      '{{#if DOC.PARTY_CAN_EDIT_DEAL}}review and edit the terms' +
      '{{else}}{{#if DOC.PARTY_CAN_SUGGEST}}review and suggest changes{{else}}review the terms{{/if}}{{/if}}' +
      ', and sign.</p>' +
      '<p style="color:#666;font-size:12px">This link is personal to {{MSG.RECIPIENT_EMAIL}} and expires in 14 days.<br/>{{MSG.LINK}}</p>' +
      FOOTER_P,
  },
  {
    key: 'CONTRACT_VOIDED',
    title: 'Contract voided by the other party',
    description:
      'The email half of a void. The in-app notification is written by the database; this carries the same note plus the keep-or-remove choice, and says plainly that removing it only affects the reader\'s own documents page.',
    category: 'CONTRACT',
    recipients: 'Every other party on the document who has an email address on file.',
    subject:
      '{{#if PARTY.FULL_NAME}}{{PARTY.FULL_NAME}}{{else}}The other party{{/if}} voided ' +
      '{{#if DOC.HAS_TITLE}}{{DOC.TITLE}}{{else}}your contract{{/if}}',
    body:
      '<p>Hello,</p>' +
      '<p><strong>{{#if PARTY.FULL_NAME_HTML}}{{PARTY.FULL_NAME_HTML}}{{else}}The other party{{/if}}</strong> voided ' +
      '<strong>{{#if DOC.HAS_TITLE}}{{DOC.TITLE_HTML}}{{else}}your contract{{/if}}</strong>. ' +
      'It is no longer going ahead.</p>' +
      '{{#if MSG.NOTE_HTML}}<p>They left this note:</p>' +
      '<blockquote style="margin:0 0 0 12px;padding-left:12px;border-left:3px solid #ddd;color:#444">{{MSG.NOTE_HTML}}</blockquote>' +
      '{{else}}<p>No reason was given.</p>{{/if}}' +
      '<p><a href="{{MSG.LINK}}">Open the contract</a> to keep a copy on your documents page, ' +
      'or remove it from your view.</p>' +
      '<p style="color:#666;font-size:12px">Removing it only affects your own documents page — ' +
      'the record is retained.<br/>{{MSG.LINK}}</p>' +
      FOOTER_P,
  },
  {
    key: 'CONTRACT_CHANGE_REQUESTS',
    title: 'Change requests submitted for review',
    description:
      'Lists the five highest-impact change requests a party submitted. The ranking is the database\'s (change_request_impact_rank) — money, then liability, then term, and so on — so the email and the app agree on what matters most.',
    category: 'CONTRACT',
    recipients: 'Every other party on the document who has an email address on file.',
    subject:
      '{{#if PARTY.FULL_NAME}}{{PARTY.FULL_NAME}}{{else}}The other party{{/if}} requested changes to ' +
      '{{#if DOC.HAS_TITLE}}{{DOC.TITLE}}{{else}}your contract{{/if}}',
    body:
      '<p>Hello,</p>' +
      '<p><strong>{{#if PARTY.FULL_NAME_HTML}}{{PARTY.FULL_NAME_HTML}}{{else}}The other party{{/if}}</strong> submitted change requests on ' +
      '<strong>{{#if DOC.HAS_TITLE}}{{DOC.TITLE_HTML}}{{else}}your contract{{/if}}</strong> for your review.</p>' +
      '<p>The most significant {{#if MSG.IS_SINGLE}}one is{{else}}{{MSG.COUNT}} are{{/if}}:</p>' +
      '<ol>{{#each MSG.ITEMS}}<li style="margin-bottom:8px"><strong>#{{.NUMBER}} — ' +
      '{{#if .HAS_SECTION}}{{.WHERE_HTML}}{{else}}The whole document{{/if}}</strong><br/>{{.BODY_HTML}}</li>{{/each}}</ol>' +
      '<p><a href="{{MSG.LINK}}">Open the contract</a> to reply to each request and agree or discuss.</p>' +
      '<p style="color:#666;font-size:12px">The contract cannot be locked for signing until these are resolved.<br/>{{MSG.LINK}}</p>' +
      FOOTER_P,
  },
  {
    key: 'CONTRACT_WORKING_COPY',
    title: 'Working copy of a contract',
    description:
      'A party asks for the contract as it stands right now, unexecuted, so an adviser can read it. Unselected options and empty fields are included on purpose and the email says so, because a working copy that looked finished would be worse than none.',
    category: 'CONTRACT',
    recipients: "The requesting party, at their contact address (falling back to their account's).",
    subject: 'Working copy — {{#if DOC.HAS_TITLE}}{{DOC.TITLE}}{{else}}Contract{{/if}}',
    body:
      '<p>Attached is the current working copy of <strong>{{#if DOC.HAS_TITLE}}{{DOC.TITLE}}{{else}}this contract{{/if}}</strong>' +
      '{{#if DOC.DISPLAY_CODE}} ({{DOC.DISPLAY_CODE}}){{/if}}.</p>' +
      '<p>It is <strong>not executed</strong> and reflects the contract as of {{MSG.GENERATED_AT}}. ' +
      'Unselected options and empty fields are included on purpose, so anyone advising ' +
      'you can see what is still open.</p>',
  },

  // ────────────────────────── executed-document copies ──────────────────────────
  {
    key: 'DOCUMENT_PARTY_COPY',
    title: 'Your signed document (single)',
    description:
      "A signer's own copy of one executed document, with the PDF attached. Deliberately plain — no personalised greeting, matching the company copy's tone. Only the PDF filename is personalised. Carries a short reference code, never the full integrity hash.",
    category: 'DOCUMENT',
    recipients:
      "Each party on the executed document, once per document (a unique index makes a duplicate impossible). A minor's copy is addressed to their guardian; with no guardian email the send is skipped and staff are alerted.",
    subject: '{{DOC.TITLE}} — signed and executed',
    body:
      '{{#if MSG.IS_GUARDIAN_COPY}}' +
      '<p>Hi {{#if PARTY.GUARDIAN_FIRST_NAME}}{{PARTY.GUARDIAN_FIRST_NAME}}{{else}}there{{/if}},</p>' +
      '<p>The document <strong>{{DOC.TITLE}}</strong> for ' +
      '{{#if PARTY.FULL_NAME}}{{PARTY.FULL_NAME}}{{else}}the minor named on this document{{/if}} ' +
      'has been signed and executed. The PDF is attached.</p>' +
      '{{else}}' +
      '<p>Your document <strong>{{DOC.TITLE}}</strong> has been signed and executed. ' +
      'The PDF is attached.</p>' +
      '{{/if}}' +
      '<p style="font-size:16px;margin-top:16px"><strong>{{ORG.BRAND_NAME}}</strong>' +
      '{{#if ORG.PHONE}}<br/><a href="tel:{{ORG.PHONE_TEL}}" style="color:inherit;text-decoration:none">{{ORG.PHONE}}</a>{{/if}}' +
      '{{#if ORG.SITE_LINK}}<br/><a href="https://{{ORG.SITE_HOST}}" style="color:inherit">{{ORG.SITE_LINK}}</a>{{/if}}' +
      '</p>' +
      '{{#if DOC.REFERENCE_CODE}}<p style="color:#888;font-size:12px">Reference code: {{DOC.REFERENCE_CODE}}</p>{{/if}}',
  },
  {
    key: 'DOCUMENT_COMPANY_COPY',
    title: 'Company copy — one document executed',
    description:
      'The org inbox copy of a single execution. Unlike the party copy it carries the FULL SHA-256 integrity hash and the unstripped body, because this is the file-of-record copy.',
    category: 'DOCUMENT',
    transactional: false,
    recipients:
      'The org public contact address, once per document, and only when at least one party copy actually sent. Skipped when that inbox was already a party recipient.',
    subject: '{{DOC.TITLE}} — signed and executed ({{DOC.DISPLAY_CODE}})',
    body:
      '<p>{{#if PARTY.SIGNERS}}{{PARTY.SIGNERS}}{{else}}A signer{{/if}} executed <strong>{{DOC.TITLE}}</strong>. The signed PDF is attached.</p>' +
      '{{#if DOC.INTEGRITY_HASH}}<hr/><p style="color:#666;font-size:12px">Integrity hash (SHA-256): {{DOC.INTEGRITY_HASH}}</p>{{/if}}',
  },
  {
    key: 'DOCUMENT_SET_PARTY_COPY',
    title: 'Your signed documents (set)',
    description:
      'One email with every document of a flow attached as its own PDF, instead of one email per document. This is what an onboarding signer receives after the participant flow.',
    category: 'DOCUMENT',
    recipients:
      'Each distinct signer across the whole set, once. Guardian-addressed for a minor. A staff "send me a copy" is targeted and logged as a mirror, not a party delivery.',
    subject: 'Your signed documents — {{ORG.BRAND_NAME}}',
    body:
      '<p>{{#if PARTY.GREETING_NAME}}Hi {{PARTY.GREETING_NAME}},{{else}}Hello,{{/if}}</p>' +
      '{{#if MSG.IS_GUARDIAN_COPY}}' +
      '<p>The signed documents for ' +
      '{{#if PARTY.FULL_NAME}}{{PARTY.FULL_NAME}}{{else}}the minor named below{{/if}} ' +
      'are attached to this email:</p>' +
      '{{else}}<p>Thank you. Your signed documents are attached to this email:</p>{{/if}}' +
      '<ul>{{#each DOC.TITLES}}<li>{{.}}</li>{{/each}}</ul>' +
      '<p>Please keep these for your records.</p>' +
      FOOTER_P,
  },
  {
    key: 'DOCUMENT_SET_COMPANY_COPY',
    title: 'Company copy — document set executed',
    description:
      'The ops-inbox mirror of a completed set. Never fires for a staff-targeted re-send: that is not a new execution event and must not ping the inbox twice.',
    category: 'DOCUMENT',
    transactional: false,
    recipients: 'The ops inbox (CONTACT.OPS_INBOX), falling back to the public contact address.',
    subject: 'Signed document set{{#if PARTY.SIGNERS}} — {{PARTY.SIGNERS}}{{/if}}',
    body:
      '<p>{{#if PARTY.SIGNERS}}{{PARTY.SIGNERS}}{{else}}A signer{{/if}} executed the following documents (attached):</p>' +
      '<ul>{{#each DOC.TITLES}}<li>{{.}}</li>{{/each}}</ul>',
  },
  {
    key: 'DOCUMENT_WITHDRAWN',
    title: 'A document you were shown has been withdrawn',
    description:
      'Sent before a non-executed document is hard-deleted, to anyone who was notified about it or had it delivered. They keep a PDF of the draft they reviewed even though the document itself is about to stop existing.',
    category: 'DOCUMENT',
    recipients:
      'Parties who have "seen" the document — an in-app notification linking to it, or a delivery row — and who have an email on file.',
    subject: '{{DOC.TITLE}} was withdrawn — copy attached',
    body:
      '<p>{{#if PARTY.GREETING_NAME}}Hi {{PARTY.GREETING_NAME}},{{else}}Hello,{{/if}}</p>' +
      '<p>The document <strong>{{DOC.TITLE}}</strong> that was shared with you has been withdrawn and removed. ' +
      'A copy is attached to this email for your records.</p>' +
      FOOTER_P,
  },

  // ───────────────────────────────── other ─────────────────────────────────
  {
    key: 'EVALUATION_REPORT',
    title: 'Horse evaluation report',
    description:
      'Delivers a completed evaluation report as a PDF. Three voices in one template: the buyer\'s own copy, a copy shared with someone else, and a guardian-addressed copy when the report belongs to a minor.',
    category: 'EVALUATION',
    recipients:
      "The report's buyer contact, an explicitly shared address, or the guardian of a minor buyer. A minor with no guardian email is refused, not redirected.",
    subject: '{{DOC.TITLE}}{{#if HORSE.LABEL}} — {{HORSE.LABEL}}{{/if}} — {{ORG.BRAND_NAME}}',
    body:
      '<p>{{#if PARTY.GREETING_NAME}}Hi {{PARTY.GREETING_NAME}},{{else}}Hello,{{/if}}</p>' +
      '{{#if MSG.IS_GUARDIAN_COPY}}' +
      '<p>A horse evaluation report{{#if HORSE.LABEL}} for {{HORSE.LABEL}}{{/if}} has been prepared for ' +
      '{{#if PARTY.FULL_NAME}}{{PARTY.FULL_NAME}}{{else}}the account holder{{/if}} and is attached to this email.</p>' +
      '{{else}}{{#if MSG.IS_SHARE}}' +
      "<p>A horse evaluation report has been shared with you{{#if HORSE.LABEL}} for {{HORSE.LABEL}}{{/if}}. It's attached to this email.</p>" +
      '{{else}}' +
      '<p>Your horse evaluation report{{#if HORSE.LABEL}} for {{HORSE.LABEL}}{{/if}} is attached to this email.</p>' +
      '{{/if}}{{/if}}' +
      '<p>Please keep it for your records.</p>' +
      FOOTER_P,
  },
  {
    key: 'EMAIL_CHANGE_VERIFY',
    title: 'Verify a new sign-in email',
    description:
      'Sent to the NEW address when a member changes their sign-in email by password. The current email keeps working until they verify, and the email says so — that reassurance is the whole point of the message.',
    category: 'ACCOUNT',
    recipients:
      'The new address only. The Google path sends nothing at all — the linked identity is the proof there.',
    subject: 'Verify your new email — {{ORG.BRAND_NAME}}',
    body:
      '<p>{{#if PARTY.GREETING_NAME}}Hi {{PARTY.GREETING_NAME}},{{else}}Hello,{{/if}}</p>' +
      '<p>You asked to change your sign-in email to <strong>{{MSG.NEW_EMAIL}}</strong>.</p>' +
      '<p><a href="{{MSG.LINK}}">Verify this address</a> and sign in with it plus the password you just set to finish the switch. ' +
      'Your current email keeps working until then.</p>' +
      '<p style="color:#666;font-size:12px">If the link doesn\'t open, check your spam folder or paste it into your browser:<br/>{{MSG.LINK}}</p>' +
      FOOTER_P,
  },
  {
    key: 'ORDER_RECEIPT',
    title: 'Payment receipt',
    description:
      'Confirms a payment after an order flips to confirmed, from either the Stripe webhook or the Zelle reconcile. Provable and single: every attempt is logged and a second send is refused once one has succeeded.',
    category: 'ORDER',
    recipients: "The buyer's account email.",
    subject: 'Your receipt from {{ORG.BRAND_NAME}}',
    body:
      '<p>We received your payment{{#if TXN.AMOUNT}} of {{TXN.AMOUNT}}{{/if}}. Thank you.</p>' +
      '\n<hr/><pre style="font-family:inherit">{{ORG.FOOTER}}</pre>',
  },
  {
    key: 'HOLD_EXPIRED',
    title: 'Booking hold expired',
    description:
      'The 48-hour hold on a requested booking lapsed without payment. Deliberately warm and non-final — the closing line invites them to reply and get fresh dates rather than treating the lapse as a rejection.',
    category: 'BOOKING',
    recipients: 'The requester on each lapsed hold, grouped so one person gets one email listing all of theirs.',
    subject: 'Your hold has expired — {{ORG.BRAND_NAME}}',
    body:
      '<p>{{#if PARTY.GREETING_NAME}}Hi {{PARTY.GREETING_NAME}},{{else}}Hello,{{/if}}</p>' +
      "<p>The 48-hour hold on your requested booking has expired because payment wasn't completed in time.</p>" +
      '{{#if MSG.ITEMS}}<ul>{{#each MSG.ITEMS}}<li>{{.}}</li>{{/each}}</ul>{{/if}}' +
      "<p>No problem — just reply and we'll re-offer new dates with a fresh hold.</p>" +
      FOOTER_P,
  },

  // ─────────────────────────────── digests ───────────────────────────────
  {
    key: 'NOTIFICATION_DIGEST',
    title: 'Daily update digest',
    description:
      'One daily email listing in-app notifications a member has not read. Nothing is included until it is 30 minutes old, so reading something in the app right now never produces an email about it.',
    category: 'DIGEST',
    transactional: false,
    recipients:
      'Each member with unread, never-emailed notifications older than the grace window. At most ten items per person per run; the rest roll to the next.',
    subject: 'You have {{MSG.COUNT}} {{#if MSG.IS_SINGLE}}update{{else}}updates{{/if}} at {{ORG.BRAND_NAME}}',
    body:
      "<p>Here's what's waiting for you at {{ORG.BRAND_NAME}}:</p>" +
      '<ul>{{#each MSG.ITEMS}}<li>{{.}}</li>{{/each}}</ul>' +
      '<p><a href="{{MSG.LINK}}">Open the app to catch up</a></p>' +
      FOOTER_P,
  },
  {
    key: 'CALENDAR_UPDATE',
    title: 'Calendar update',
    description:
      'Booking and lease reminders, sent on the hour rather than waiting for the daily digest. Only sends between 6am and 9pm Pacific; outside the window the in-app rows are still written.',
    category: 'DIGEST',
    transactional: false,
    recipients: 'Each member with un-emailed booking_* or lease_* notifications.',
    subject: 'Calendar update — {{ORG.BRAND_NAME}}',
    body:
      '<p>Calendar update from {{ORG.BRAND_NAME}}:</p>' +
      '<ul>{{#each MSG.ITEMS}}<li>{{.}}</li>{{/each}}</ul>' +
      '<p><a href="{{MSG.LINK}}">Open your calendar</a></p>' +
      FOOTER_P,
  },
  {
    key: 'CALENDAR_OPS_DIGEST',
    title: 'Upcoming sessions (ops inbox)',
    description:
      'One consolidated copy of the hour\'s booking reminders to the shared ops inbox, so the barn sees everything coming up without reading each rider\'s copy.',
    category: 'DIGEST',
    transactional: false,
    recipients: 'The ops inbox only. One email per sweep, de-duplicated across members.',
    subject: 'Upcoming sessions ({{MSG.COUNT}})',
    body: '<p>Upcoming calendar items:</p><ul>{{#each MSG.ITEMS}}<li>{{.}}</li>{{/each}}</ul>',
  },

  // ─────────────────────────── inbound to the barn ───────────────────────────
  {
    key: 'REQUEST_RECEIVED',
    title: 'New website inquiry',
    description:
      'The full submission from a public intake form, mailed to the barn immediately so the owners see what was actually written without opening the app. Replies go straight to the visitor.',
    category: 'INBOUND',
    fromRule: 'tenant_or_recipient',
    replyRule: 'submitter',
    recipients:
      "The tenant's configured ops inbox only. Never an address taken from the submission — every field in this email is read back from the stored request row.",
    subject: 'New inquiry from {{#if MSG.SENDER_NAME}}{{MSG.SENDER_NAME}}{{else}}A visitor{{/if}}',
    body:
      '<p><strong>{{#if MSG.SENDER_NAME_HTML}}{{MSG.SENDER_NAME_HTML}}{{else}}A visitor{{/if}}</strong> just submitted an inquiry on the website.</p>' +
      '<ul style="padding-left:18px">' +
      '<li><strong>Email:</strong> {{REQ.EMAIL_HTML}}</li>' +
      '{{#if REQ.PHONE_HTML}}<li><strong>Phone:</strong> {{REQ.PHONE_HTML}}</li>{{/if}}' +
      '{{#if REQ.CONTACT_METHOD_HTML}}<li><strong>Prefers:</strong> {{REQ.CONTACT_METHOD_HTML}}</li>{{/if}}' +
      '{{#if REQ.CATEGORY_HTML}}<li><strong>Interested in:</strong> {{REQ.CATEGORY_HTML}}</li>{{/if}}' +
      '{{#if REQ.CHANNEL_HTML}}<li><strong>Via:</strong> {{REQ.CHANNEL_HTML}}</li>{{/if}}' +
      '{{#if REQ.ENTRY_LOCATION_HTML}}<li><strong>From:</strong> {{REQ.ENTRY_LOCATION_HTML}}</li>{{/if}}' +
      '{{#if REQ.SUBJECT_HTML}}<li><strong>Subject:</strong> {{REQ.SUBJECT_HTML}}</li>{{/if}}' +
      '{{#if REQ.INTENT_HTML}}<li><strong>Intent:</strong> {{REQ.INTENT_HTML}}</li>{{/if}}' +
      '<li><strong>Submitted:</strong> {{REQ.SUBMITTED_AT_HTML}}</li>' +
      '</ul>' +
      '{{#if REQ.AVAILABILITY_HTML}}<p><strong>Availability:</strong> {{REQ.AVAILABILITY_HTML}}</p>{{/if}}' +
      '{{#if REQ.DETAILS}}<ul style="padding-left:18px">{{#each REQ.DETAILS}}<li><strong>{{.LABEL}}:</strong> {{.VALUE}}</li>{{/each}}</ul>{{/if}}' +
      '{{#if REQ.NOTES_HTML}}<p style="white-space:pre-line;border-left:3px solid #ddd;padding-left:12px;color:#333">{{REQ.NOTES_HTML}}</p>{{/if}}' +
      '<p><a href="{{MSG.LINK}}">Open the Request Inbox</a> to reply.</p>' +
      FOOTER_P_ESCAPED,
  },
  {
    key: 'SUPPORT_RECEIVED',
    title: 'New support request',
    description:
      'A signed-in member asked for help from their account page. Fired by the database itself right after the request row lands, so the barn hears about it whether or not anyone is in the app.',
    category: 'INBOUND',
    fromRule: 'tenant_or_recipient',
    recipients: "The tenant's configured ops inbox only.",
    subject: 'New website inquiry — {{#if PARTY.FULL_NAME}}{{PARTY.FULL_NAME}}{{else}}A member{{/if}}',
    body:
      '<p><strong>{{#if PARTY.FULL_NAME_HTML}}{{PARTY.FULL_NAME_HTML}}{{else}}A member{{/if}}</strong> just submitted a support request.</p>' +
      '{{#if PARTY.EMAIL_HTML}}<ul style="padding-left:18px"><li><strong>Email:</strong> {{PARTY.EMAIL_HTML}}</li></ul>{{/if}}' +
      '<p><strong>Subject:</strong> {{MSG.SUBJECT_HTML}}</p>' +
      '<p style="white-space:pre-line;border-left:3px solid #ddd;padding-left:12px;color:#333">{{MSG.BODY_HTML}}</p>' +
      '<p><a href="{{MSG.LINK}}">Open Support</a> to reply.</p>' +
      FOOTER_P_ESCAPED,
  },
];
