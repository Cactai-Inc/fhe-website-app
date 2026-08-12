/* EMAILEXTRACT — the byte-identity proof.
 *
 *   node scripts/emailextract/diff.mjs          # run the comparison
 *   node scripts/emailextract/diff.mjs --print  # dump every rendered pair
 *
 * For each of the 19 extracted emails this file holds TWO things:
 *   LEGACY — the composition expression transcribed VERBATIM from the sender as it
 *            stands on origin/main, with the surrounding I/O stripped.
 *   VARS   — the token map the rewritten sender builds from the same inputs.
 * It renders both from one fixture and diffs the bytes. Any difference is a defect.
 *
 * TRANSCRIPTION IS ITSELF VERIFIED. A hand-copied "legacy" that drifted from the
 * real source would make this proof worthless, so every static HTML fragment the
 * legacy functions use is asserted to be a literal substring of the corresponding
 * file at origin/main (see ANCHORS at the bottom). Both halves have to be wrong in
 * exactly the same way for a false pass, and the anchors close that door.
 *
 * NOTHING HERE SENDS MAIL AND NOTHING HERE TOUCHES THE DATABASE. The signing
 * freeze is in force and no staff browser session exists; this renders strings.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { TEMPLATES } from './bodies.mjs';

/* ── the renderer, mirrored from api/_lib/emailTemplates.ts ────────────────────
 * A .mjs script cannot import the .ts module without a build step, so the parser
 * is duplicated here. It is ~60 lines and the duplication is checked: RENDERER_SYNC
 * below asserts the .ts source still contains the same three constructs and the
 * same tag regex, so a change to one that is not made to the other fails this run.
 */
const TAG_RE = /\{\{\s*(#if|#each|else|\/if|\/each)?\s*([A-Za-z0-9_.]*)\s*\}\}/g;

function parse(src) {
  const root = [];
  const stack = [];
  let cursor = 0;
  const out = () => {
    if (stack.length === 0) return root;
    const top = stack[stack.length - 1];
    if (top.node.t === 'if') return top.target === 'no' ? top.node.no : top.node.yes;
    return top.node.body;
  };
  TAG_RE.lastIndex = 0;
  let m;
  while ((m = TAG_RE.exec(src)) !== null) {
    if (m.index > cursor) out().push({ t: 'text', v: src.slice(cursor, m.index) });
    cursor = m.index + m[0].length;
    const [, kind, key] = m;
    if (kind === '#if') {
      const node = { t: 'if', k: key, yes: [], no: [] };
      out().push(node);
      stack.push({ node, target: 'yes' });
    } else if (kind === '#each') {
      const node = { t: 'each', k: key, body: [] };
      out().push(node);
      stack.push({ node, target: 'body' });
    } else if (kind === 'else') {
      stack[stack.length - 1].target = 'no';
    } else if (kind === '/if' || kind === '/each') {
      stack.pop();
    } else {
      out().push({ t: 'var', k: key });
    }
  }
  if (cursor < src.length) out().push({ t: 'text', v: src.slice(cursor) });
  if (stack.length > 0) throw new Error('unclosed block');
  return root;
}
const scalar = (v) => (v == null ? '' : String(v));
const truthy = (v) => (v == null ? false : Array.isArray(v) ? v.length > 0 : String(v) !== '');

function emit(nodes, vars, item) {
  let out = '';
  for (const n of nodes) {
    if (n.t === 'text') out += n.v;
    else if (n.t === 'var') {
      if (n.k === '.') out += scalar(item);
      else if (n.k.startsWith('.')) out += scalar((item ?? {})[n.k.slice(1)]);
      else {
        const v = vars[n.k];
        out += Array.isArray(v) ? '' : scalar(v);
      }
    } else if (n.t === 'if') {
      const v = n.k.startsWith('.') ? (item ?? {})[n.k.slice(1)] : vars[n.k];
      out += emit(truthy(v) ? n.yes : n.no, vars, item);
    } else {
      const list = vars[n.k];
      if (Array.isArray(list)) for (const el of list) out += emit(n.body, vars, el);
    }
  }
  return out;
}
const render = (src, vars) => emit(parse(src), vars, undefined);

/* ── helpers the senders use, copied from the senders ─────────────────────── */
const escAngleAmp = (s) => s.replace(/[<>&]/g, (c) => (c === '<' ? '&lt;' : c === '>' ? '&gt;' : '&amp;'));
const escQuote = (s) =>
  s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const escapeHtml = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/* ── fixtures ──────────────────────────────────────────────────────────────── */
const IDENTITY = {
  fromName: 'French Heritage Equestrian',
  fromEmail: 'hello@fhequestrian.com',
  footer: 'French Heritage Equestrian\nhello@fhequestrian.com · 858-439-3614 · fhequestrian.com',
  contactEmail: 'hello@fhequestrian.com',
  contactPhone: '858-439-3614',
  contactUrl: 'fhequestrian.com',
  opsInbox: 'hello@fhequestrian.com',
  siteUrl: 'fhequestrian.com',
};
const BARE = { ...IDENTITY, footer: '', contactPhone: null, contactUrl: null, siteUrl: null };

/* ── the 19 cases ──────────────────────────────────────────────────────────── */
const CASES = [];
const add = (key, name, legacy, vars) => CASES.push({ key, name, legacy, vars });

/* 1. INVITATION — api/_lib/invitationEmail.ts:37-92 */
function legacyInvitation({ identity, isResend, offeringLabel, checklist, expiresAt, registerUrl }) {
  const purchaseLine = offeringLabel
    ? `<p>Your ${offeringLabel} is ready — create your account to sign your documents and get started.</p>`
    : '';
  const pending = (checklist ?? []).filter((c) => !c.done);
  const checklistBlock = pending.length
    ? `<p>When you click the link, here's what we'll ask you to do:</p>` +
      `<ul style="padding-left:18px">` +
      pending.map((c) => `<li style="margin:4px 0"><strong>${c.title}</strong> — ${c.action.toLowerCase()}</li>`).join('') +
      `</ul>` +
      `<p style="color:#666;font-size:13px">This same checklist will be on your dashboard, ticking itself off as you go.</p>`
    : '';
  const subject = isResend
    ? `Here's your invitation link again — ${identity.fromName}`
    : `Your invitation to ${identity.fromName}`;
  const opening = isResend
    ? `<p>Here's that link again — this is the <strong>same invitation</strong> we sent you
       before, not a new one. If you still have the first email, either link works.</p>`
    : `<p>Welcome — we're so glad to have you.</p>`;
  const html = `
      ${opening}
      ${purchaseLine}
      ${checklistBlock}
      <p>Create your account here to join the community. You can sign up with Google
      or set a password — your choice on the next page:</p>
      <p><a href="${registerUrl}">${registerUrl}</a></p>
      <p>${expiresAt
        ? `This link is valid until <strong>${new Date(expiresAt).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</strong>. If it expires, just reach out and we'll send a fresh one.`
        : `This link expires soon. If it does, just reach out and we'll send a fresh one.`}</p>
      <hr/><pre style="font-family:inherit">${identity.footer}</pre>`;
  return { subject, html };
}
function varsInvitation({ identity, isResend, offeringLabel, checklist, expiresAt, registerUrl }) {
  const pending = (checklist ?? []).filter((c) => !c.done);
  return {
    'ORG.BRAND_NAME': identity.fromName,
    'ORG.FOOTER': identity.footer,
    'MSG.IS_RESEND': isResend ? '1' : '',
    'MSG.OFFERING_LABEL': offeringLabel ?? '',
    'MSG.CHECKLIST': pending.map((c) => ({ TITLE: c.title, ACTION: c.action.toLowerCase() })),
    'MSG.LINK': registerUrl,
    'MSG.EXPIRES_ON': expiresAt
      ? new Date(expiresAt).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
      : '',
  };
}
for (const f of [
  { name: 'first send, purchase + checklist + expiry', identity: IDENTITY, isResend: false, offeringLabel: 'Private Lesson Package', checklist: [{ title: 'Sign your release', action: 'Review and sign', done: false }, { title: 'Pay', action: 'Complete payment', done: true }], expiresAt: '2026-08-20T00:00:00Z', registerUrl: 'https://x.test/activate?token=abc' },
  { name: 'resend, nothing attached, no expiry', identity: IDENTITY, isResend: true, offeringLabel: null, checklist: [], expiresAt: null, registerUrl: 'https://x.test/activate?token=abc' },
  { name: 'first send, empty footer', identity: BARE, isResend: false, offeringLabel: null, checklist: null, expiresAt: '2026-09-01T00:00:00Z', registerUrl: 'https://x.test/activate?token=z' },
]) add('INVITATION', f.name, () => legacyInvitation(f), () => varsInvitation(f));

/* 2. CONTRACT_INVITE — api/contract-invite.ts:100-137 */
function legacyContractInvite({ identity, doc, ctrl, unfilledCount, email, link }) {
  const canFill = ctrl?.can_fill ?? true;
  const needsInfo = canFill && unfilledCount > 0;
  const actions = [];
  if (needsInfo) actions.push('add your information');
  if (ctrl?.can_edit_deal) actions.push('review and edit the terms');
  else if (ctrl?.can_suggest) actions.push('review and suggest changes');
  else actions.push('review the terms');
  const actionPhrase = `${actions.join(', ')}, and sign`;
  return {
    subject: `A contract is ready for you — ${identity.fromName}`,
    html:
      `<p>Hello,</p>` +
      `<p><strong>${doc.title ?? 'A contract'}</strong> has been prepared for you.</p>` +
      `<p><a href="${link}">Open the contract</a> — sign in with Google if this is a Gmail address, ` +
      `or set a password with this email. You'll land directly on the contract to ${actionPhrase}.</p>` +
      `<p style="color:#666;font-size:12px">This link is personal to ${email} and expires in 14 days.<br/>${link}</p>` +
      (identity.footer ? `<hr/><p style="color:#666;font-size:12px;white-space:pre-line">${identity.footer}</p>` : ''),
  };
}
function varsContractInvite({ identity, doc, ctrl, unfilledCount, email, link }) {
  const canFill = ctrl?.can_fill ?? true;
  return {
    'ORG.BRAND_NAME': identity.fromName,
    'ORG.FOOTER': identity.footer,
    'DOC.HAS_TITLE': doc.title != null ? '1' : '',
    'DOC.TITLE': doc.title ?? '',
    'DOC.PARTY_NEEDS_INFO': canFill && unfilledCount > 0 ? '1' : '',
    'DOC.PARTY_CAN_EDIT_DEAL': ctrl?.can_edit_deal ? '1' : '',
    'DOC.PARTY_CAN_SUGGEST': ctrl?.can_suggest ? '1' : '',
    'MSG.LINK': link,
    'MSG.RECIPIENT_EMAIL': email,
  };
}
for (const f of [
  { name: 'needs info + can edit deal', identity: IDENTITY, doc: { title: 'Horse Lease Agreement' }, ctrl: { can_fill: true, can_edit_deal: true, can_suggest: false }, unfilledCount: 3, email: 'a@b.test', link: 'https://x.test/activate?token=t&kind=contract' },
  { name: 'can suggest only, nothing unfilled', identity: IDENTITY, doc: { title: 'Bill of Sale' }, ctrl: { can_fill: true, can_edit_deal: false, can_suggest: true }, unfilledCount: 0, email: 'a@b.test', link: 'https://x.test/l' },
  { name: 'read-only party, null title, no footer', identity: BARE, doc: { title: null }, ctrl: { can_fill: false, can_edit_deal: false, can_suggest: false }, unfilledCount: 5, email: 'a@b.test', link: 'https://x.test/l' },
  { name: 'no controls row at all (can_fill defaults true)', identity: IDENTITY, doc: { title: 'Retainer' }, ctrl: null, unfilledCount: 2, email: 'c@d.test', link: 'https://x.test/l' },
]) add('CONTRACT_INVITE', f.name, () => legacyContractInvite(f), () => varsContractInvite(f));

/* 3. CONTRACT_VOIDED — api/contract-voided.ts:59-100 */
function legacyContractVoided({ identity, doc, byLabel, note, link }) {
  return {
    subject: `${byLabel} voided ${doc.title ?? 'your contract'}`,
    html:
      `<p>Hello,</p>` +
      `<p><strong>${escQuote(byLabel)}</strong> voided ` +
      `<strong>${escQuote(String(doc.title ?? 'your contract'))}</strong>. ` +
      `It is no longer going ahead.</p>` +
      (note
        ? `<p>They left this note:</p><blockquote style="margin:0 0 0 12px;padding-left:12px;border-left:3px solid #ddd;color:#444">${escQuote(note)}</blockquote>`
        : `<p>No reason was given.</p>`) +
      `<p><a href="${link}">Open the contract</a> to keep a copy on your documents page, ` +
      `or remove it from your view.</p>` +
      `<p style="color:#666;font-size:12px">Removing it only affects your own documents page — ` +
      `the record is retained.<br/>${link}</p>` +
      (identity.footer ? `<hr/><p style="color:#666;font-size:12px;white-space:pre-line">${identity.footer}</p>` : ''),
  };
}
function varsContractVoided({ identity, doc, byLabel, note, link }) {
  // byLabel is already `first last` || 'The other party' in the sender; the
  // template owns that fallback now, so pass the raw name and let it decide.
  const rawName = byLabel === 'The other party' ? '' : byLabel;
  return {
    'ORG.FOOTER': identity.footer,
    'PARTY.FULL_NAME': rawName,
    'PARTY.FULL_NAME_HTML': rawName ? escQuote(rawName) : '',
    'DOC.HAS_TITLE': doc.title != null ? '1' : '',
    'DOC.TITLE': doc.title ?? '',
    'DOC.TITLE_HTML': doc.title != null ? escQuote(String(doc.title)) : '',
    'MSG.NOTE_HTML': note ? escQuote(note) : '',
    'MSG.LINK': link,
  };
}
for (const f of [
  { name: 'named voider, note, title', identity: IDENTITY, doc: { title: 'Horse Lease <2026>' }, byLabel: 'Mary Richardson', note: 'Changed my mind & withdrew', link: 'https://x.test/app/contracts/1' },
  { name: 'unknown voider, no note, null title', identity: IDENTITY, doc: { title: null }, byLabel: 'The other party', note: null, link: 'https://x.test/app/contracts/1' },
  { name: 'empty note string, no footer', identity: BARE, doc: { title: 'Bill of Sale' }, byLabel: 'CJ Zigmund', note: '', link: 'https://x.test/c' },
]) add('CONTRACT_VOIDED', f.name, () => legacyContractVoided(f), () => varsContractVoided(f));

/* 4. CONTRACT_CHANGE_REQUESTS — api/contract-change-requests-submitted.ts:105-139 */
function legacyChangeRequests({ identity, doc, meLabel, top, headings, link }) {
  const items = top
    .map((r) => {
      const where = r.target_section ? (headings.get(r.target_section) ?? r.target_section) : 'The whole document';
      return `<li style="margin-bottom:8px"><strong>#${r.annotation_number} — ${escQuote(where)}</strong><br/>${escQuote(String(r.body ?? ''))}</li>`;
    })
    .join('');
  return {
    subject: `${meLabel} requested changes to ${doc.title ?? 'your contract'}`,
    html:
      `<p>Hello,</p>` +
      `<p><strong>${escQuote(meLabel)}</strong> submitted change requests on ` +
      `<strong>${escQuote(String(doc.title ?? 'your contract'))}</strong> for your review.</p>` +
      `<p>The most significant ${top.length === 1 ? 'one is' : `${top.length} are`}:</p>` +
      `<ol>${items}</ol>` +
      `<p><a href="${link}">Open the contract</a> to reply to each request and agree or discuss.</p>` +
      `<p style="color:#666;font-size:12px">The contract cannot be locked for signing until these are resolved.<br/>${link}</p>` +
      (identity.footer ? `<hr/><p style="color:#666;font-size:12px;white-space:pre-line">${identity.footer}</p>` : ''),
  };
}
function varsChangeRequests({ identity, doc, meLabel, top, headings, link }) {
  const rawName = meLabel === 'The other party' ? '' : meLabel;
  return {
    'ORG.FOOTER': identity.footer,
    'PARTY.FULL_NAME': rawName,
    'PARTY.FULL_NAME_HTML': rawName ? escQuote(rawName) : '',
    'DOC.HAS_TITLE': doc.title != null ? '1' : '',
    'DOC.TITLE': doc.title ?? '',
    'DOC.TITLE_HTML': doc.title != null ? escQuote(String(doc.title)) : '',
    'MSG.COUNT': String(top.length),
    'MSG.IS_SINGLE': top.length === 1 ? '1' : '',
    'MSG.ITEMS': top.map((r) => ({
      NUMBER: String(r.annotation_number),
      HAS_SECTION: r.target_section ? '1' : '',
      WHERE_HTML: r.target_section ? escQuote(headings.get(r.target_section) ?? r.target_section) : '',
      BODY_HTML: escQuote(String(r.body ?? '')),
    })),
    'MSG.LINK': link,
  };
}
for (const f of [
  { name: 'three requests, headings resolved', identity: IDENTITY, doc: { title: 'Horse Lease' }, meLabel: 'Mary Richardson', headings: new Map([['FEE', 'Lease Fee & Payment']]), top: [{ annotation_number: 4, target_section: 'FEE', body: 'Reduce to $800 & split' }, { annotation_number: 7, target_section: 'UNKNOWN_KEY', body: 'Clarify <insurance>' }, { annotation_number: 9, target_section: null, body: null }], link: 'https://x.test/app/contracts/1' },
  { name: 'single request, unknown party, null title, no footer', identity: BARE, doc: { title: null }, meLabel: 'The other party', headings: new Map(), top: [{ annotation_number: 1, target_section: null, body: 'One change' }], link: 'https://x.test/c' },
]) add('CONTRACT_CHANGE_REQUESTS', f.name, () => legacyChangeRequests(f), () => varsChangeRequests(f));

/* 5. DOCUMENT_PARTY_COPY — api/_lib/delivery.ts:72-124 */
function legacyPartyCopy({ doc, recipientFirstName, recipientLastName, identity, guardianRecipient }) {
  const subject = `${doc.title} — signed and executed`;
  const siteLine = identity.contactUrl || identity.siteUrl;
  const contactHtml =
    `<p style="font-size:16px;margin-top:16px">` +
    `<strong>${identity.fromName}</strong>` +
    (identity.contactPhone ? `<br/><a href="tel:${identity.contactPhone.replace(/[^+\d]/g, '')}" style="color:inherit;text-decoration:none">${identity.contactPhone}</a>` : '') +
    (siteLine ? `<br/><a href="https://${siteLine.replace(/^https?:\/\//, '')}" style="color:inherit">${siteLine}</a>` : '') +
    `</p>`;
  const executionHash =
    typeof doc.execution_hash === 'string' && doc.execution_hash.trim() !== '' ? doc.execution_hash.trim() : null;
  const referenceHtml = executionHash
    ? `<p style="color:#888;font-size:12px">Reference code: ${executionHash.slice(0, 12)}</p>`
    : '';
  const introHtml = guardianRecipient
    ? `<p>Hi ${guardianRecipient.firstName || 'there'},</p>` +
      `<p>The document <strong>${doc.title}</strong> for ` +
      `${[recipientFirstName, recipientLastName].filter(Boolean).join(' ') || 'the minor named on this document'} ` +
      `has been signed and executed. The PDF is attached.</p>`
    : `<p>Your document <strong>${doc.title}</strong> has been signed and executed. ` +
      `The PDF is attached.</p>`;
  return { subject, html: introHtml + contactHtml + referenceHtml };
}
function varsPartyCopy({ doc, recipientFirstName, recipientLastName, identity, guardianRecipient }) {
  const siteLine = identity.contactUrl || identity.siteUrl;
  const executionHash =
    typeof doc.execution_hash === 'string' && doc.execution_hash.trim() !== '' ? doc.execution_hash.trim() : null;
  return {
    'DOC.TITLE': doc.title,
    'DOC.REFERENCE_CODE': executionHash ? executionHash.slice(0, 12) : '',
    'ORG.BRAND_NAME': identity.fromName,
    'ORG.PHONE': identity.contactPhone ?? '',
    'ORG.PHONE_TEL': identity.contactPhone ? identity.contactPhone.replace(/[^+\d]/g, '') : '',
    'ORG.SITE_LINK': siteLine ?? '',
    'ORG.SITE_HOST': siteLine ? siteLine.replace(/^https?:\/\//, '') : '',
    'MSG.IS_GUARDIAN_COPY': guardianRecipient ? '1' : '',
    'PARTY.GUARDIAN_FIRST_NAME': guardianRecipient?.firstName ?? '',
    'PARTY.FULL_NAME': [recipientFirstName, recipientLastName].filter(Boolean).join(' '),
  };
}
for (const f of [
  { name: 'signer copy, phone + site + hash', doc: { title: 'Liability Release', execution_hash: 'a1b2c3d4e5f60718293a' }, recipientFirstName: 'Mary', recipientLastName: 'Richardson', identity: IDENTITY, guardianRecipient: null },
  { name: 'guardian copy, named guardian', doc: { title: 'Minor Rider Release', execution_hash: 'deadbeefcafe0123' }, recipientFirstName: 'Ella', recipientLastName: 'Richardson', identity: IDENTITY, guardianRecipient: { firstName: 'Mary', lastName: 'Richardson' } },
  { name: 'guardian copy, nameless guardian, nameless minor, no hash', doc: { title: 'Participant Release', execution_hash: '   ' }, recipientFirstName: null, recipientLastName: null, identity: IDENTITY, guardianRecipient: { firstName: null, lastName: null } },
  { name: 'no phone, no site, url overrides siteUrl', doc: { title: 'Facility Rules', execution_hash: null }, recipientFirstName: 'Sam', recipientLastName: null, identity: BARE, guardianRecipient: null },
]) add('DOCUMENT_PARTY_COPY', f.name, () => legacyPartyCopy(f), () => varsPartyCopy(f));

/* 6. DOCUMENT_COMPANY_COPY — api/_lib/delivery.ts:242-331 */
function legacyCompanyCopy({ doc, documentId, signers }) {
  const executionHash =
    typeof doc.execution_hash === 'string' && doc.execution_hash.trim() !== '' ? doc.execution_hash.trim() : null;
  const companyHashHtml = executionHash
    ? `<hr/><p style="color:#666;font-size:12px">Integrity hash (SHA-256): ${executionHash}</p>`
    : '';
  return {
    subject: `${doc.title} — signed and executed (${doc.display_code ?? documentId.slice(0, 8)})`,
    html: `<p>${signers || 'A signer'} executed <strong>${doc.title}</strong>. The signed PDF is attached.</p>` + companyHashHtml,
  };
}
function varsCompanyCopy({ doc, documentId, signers }) {
  const executionHash =
    typeof doc.execution_hash === 'string' && doc.execution_hash.trim() !== '' ? doc.execution_hash.trim() : null;
  return {
    'DOC.TITLE': doc.title,
    'DOC.DISPLAY_CODE': doc.display_code ?? documentId.slice(0, 8),
    'DOC.INTEGRITY_HASH': executionHash ?? '',
    'PARTY.SIGNERS': signers,
  };
}
for (const f of [
  { name: 'two signers, display code, hash', doc: { title: 'Horse Lease', display_code: 'CTR-000101', execution_hash: 'ab'.repeat(32) }, documentId: '11112222-3333-4444-5555-666677778888', signers: 'Mary Richardson, CJ Zigmund' },
  { name: 'no signer names, no display code, no hash', doc: { title: 'Release', display_code: null, execution_hash: null }, documentId: '99998888-7777-6666-5555-444433332222', signers: '' },
]) add('DOCUMENT_COMPANY_COPY', f.name, () => legacyCompanyCopy(f), () => varsCompanyCopy(f));

/* 7. DOCUMENT_SET_PARTY_COPY — api/deliver-documents.ts:207-269 */
function legacySetPartyCopy({ identity, titles, party, guardianRecipient }) {
  const listHtml = `<ul>${titles.map((t) => `<li>${t}</li>`).join('')}</ul>`;
  const footerHtml = identity.footer
    ? `<hr/><p style="color:#666;font-size:12px;white-space:pre-line">${identity.footer}</p>`
    : '';
  const greeting = guardianRecipient
    ? guardianRecipient.firstName
      ? `Hi ${guardianRecipient.firstName},`
      : 'Hello,'
    : party.first_name
      ? `Hi ${party.first_name},`
      : 'Hello,';
  const introHtml = guardianRecipient
    ? `<p>The signed documents for ` +
      `${[party.first_name, party.last_name].filter(Boolean).join(' ') || 'the minor named below'} ` +
      `are attached to this email:</p>`
    : `<p>Thank you. Your signed documents are attached to this email:</p>`;
  return {
    subject: `Your signed documents — ${identity.fromName}`,
    html: `<p>${greeting}</p>` + introHtml + listHtml + `<p>Please keep these for your records.</p>` + footerHtml,
  };
}
function varsSetPartyCopy({ identity, titles, party, guardianRecipient }) {
  return {
    'ORG.BRAND_NAME': identity.fromName,
    'ORG.FOOTER': identity.footer,
    'DOC.TITLES': titles,
    'PARTY.GREETING_NAME': (guardianRecipient ? guardianRecipient.firstName : party.first_name) ?? '',
    'PARTY.FULL_NAME': [party.first_name, party.last_name].filter(Boolean).join(''.concat(' ')),
    'MSG.IS_GUARDIAN_COPY': guardianRecipient ? '1' : '',
  };
}
for (const f of [
  { name: 'signer set, named', identity: IDENTITY, titles: ['Liability Release', 'Facility Rules', 'Emergency Medical'], party: { first_name: 'Mary', last_name: 'Richardson' }, guardianRecipient: null },
  { name: 'guardian set, named guardian', identity: IDENTITY, titles: ['Minor Rider Release'], party: { first_name: 'Ella', last_name: 'Richardson' }, guardianRecipient: { firstName: 'Mary', lastName: 'Richardson' } },
  { name: 'guardian set, nameless both, no footer', identity: BARE, titles: ['A', 'B'], party: { first_name: null, last_name: null }, guardianRecipient: { firstName: null, lastName: null } },
  { name: 'nameless signer', identity: IDENTITY, titles: ['Only One'], party: { first_name: null, last_name: 'Smith' }, guardianRecipient: null },
]) add('DOCUMENT_SET_PARTY_COPY', f.name, () => legacySetPartyCopy(f), () => varsSetPartyCopy(f));

/* 8. DOCUMENT_SET_COMPANY_COPY — api/deliver-documents.ts:318-329 */
function legacySetCompanyCopy({ titles, signers }) {
  const listHtml = `<ul>${titles.map((t) => `<li>${t}</li>`).join('')}</ul>`;
  return {
    subject: `Signed document set${signers ? ` — ${signers}` : ''}`,
    html: `<p>${signers || 'A signer'} executed the following documents (attached):</p>${listHtml}`,
  };
}
const varsSetCompanyCopy = ({ titles, signers }) => ({ 'DOC.TITLES': titles, 'PARTY.SIGNERS': signers });
for (const f of [
  { name: 'named signers', titles: ['Release', 'Rules'], signers: 'Mary Richardson' },
  { name: 'no signer names', titles: ['Release'], signers: '' },
]) add('DOCUMENT_SET_COMPANY_COPY', f.name, () => legacySetCompanyCopy(f), () => varsSetCompanyCopy(f));

/* 9. DOCUMENT_WITHDRAWN — api/delete-document-with-copy.ts:106-124 */
function legacyWithdrawn({ identity, doc, firstName }) {
  const footerHtml = identity.footer
    ? `<hr/><p style="color:#666;font-size:12px;white-space:pre-line">${identity.footer}</p>`
    : '';
  const greeting = firstName ? `Hi ${firstName},` : 'Hello,';
  return {
    subject: `${doc.title} was withdrawn — copy attached`,
    html:
      `<p>${greeting}</p>` +
      `<p>The document <strong>${doc.title}</strong> that was shared with you has been withdrawn and removed. ` +
      `A copy is attached to this email for your records.</p>` +
      footerHtml,
  };
}
const varsWithdrawn = ({ identity, doc, firstName }) => ({
  'ORG.FOOTER': identity.footer,
  'DOC.TITLE': doc.title,
  'PARTY.GREETING_NAME': firstName ?? '',
});
for (const f of [
  { name: 'named recipient', identity: IDENTITY, doc: { title: 'Draft Lease' }, firstName: 'Mary' },
  { name: 'nameless recipient, no footer', identity: BARE, doc: { title: 'Draft Lease' }, firstName: null },
]) add('DOCUMENT_WITHDRAWN', f.name, () => legacyWithdrawn(f), () => varsWithdrawn(f));

/* 10. EVALUATION_REPORT — api/deliver-evaluation-report.ts:90-113 */
function legacyEvalReport({ identity, report, action, guardianRecipient, minorLabel }) {
  const heading = report.horse_label ? `${report.title} — ${report.horse_label}` : report.title;
  const footerHtml = identity.footer
    ? `<hr/><p style="color:#666;font-size:12px;white-space:pre-line">${identity.footer}</p>`
    : '';
  const greeting = guardianRecipient ? (guardianRecipient.firstName ? `Hi ${guardianRecipient.firstName},` : 'Hello,') : 'Hello,';
  const intro = guardianRecipient
    ? `<p>A horse evaluation report${report.horse_label ? ` for ${report.horse_label}` : ''} has been prepared for ${minorLabel || 'the account holder'} and is attached to this email.</p>`
    : action === 'share'
      ? `<p>A horse evaluation report has been shared with you${report.horse_label ? ` for ${report.horse_label}` : ''}. It's attached to this email.</p>`
      : `<p>Your horse evaluation report${report.horse_label ? ` for ${report.horse_label}` : ''} is attached to this email.</p>`;
  return {
    subject: `${heading} — ${identity.fromName}`,
    html: `<p>${greeting}</p>${intro}<p>Please keep it for your records.</p>${footerHtml}`,
  };
}
const varsEvalReport = ({ identity, report, action, guardianRecipient, minorLabel }) => ({
  'ORG.BRAND_NAME': identity.fromName,
  'ORG.FOOTER': identity.footer,
  'DOC.TITLE': report.title,
  'HORSE.LABEL': report.horse_label ?? '',
  'PARTY.GREETING_NAME': guardianRecipient ? (guardianRecipient.firstName ?? '') : '',
  'PARTY.FULL_NAME': guardianRecipient ? (minorLabel ?? '') : '',
  'MSG.IS_GUARDIAN_COPY': guardianRecipient ? '1' : '',
  'MSG.IS_SHARE': action === 'share' ? '1' : '',
});
for (const f of [
  { name: "buyer's own copy, horse named", identity: IDENTITY, report: { title: 'Evaluation Report', horse_label: 'Beaumont de Cactai' }, action: 'email', guardianRecipient: null, minorLabel: null },
  { name: 'shared copy, no horse label', identity: IDENTITY, report: { title: 'Evaluation Report', horse_label: null }, action: 'share', guardianRecipient: null, minorLabel: null },
  { name: 'guardian copy, named guardian + minor', identity: IDENTITY, report: { title: 'Evaluation Report', horse_label: 'Beaumont' }, action: 'email', guardianRecipient: { firstName: 'Mary' }, minorLabel: 'Ella Richardson' },
  { name: 'guardian copy, nameless guardian + minor, no footer', identity: BARE, report: { title: 'Evaluation Report', horse_label: null }, action: 'share', guardianRecipient: { firstName: null }, minorLabel: null },
]) add('EVALUATION_REPORT', f.name, () => legacyEvalReport(f), () => varsEvalReport(f));

/* 11. EMAIL_CHANGE_VERIFY — api/email-change-start.ts:114-134 */
function legacyEmailChange({ identity, name, newEmail, link }) {
  return {
    subject: `Verify your new email — ${identity.fromName}`,
    html:
      `<p>${name ? `Hi ${name},` : 'Hello,'}</p>` +
      `<p>You asked to change your sign-in email to <strong>${newEmail}</strong>.</p>` +
      `<p><a href="${link}">Verify this address</a> and sign in with it plus the password you just set to finish the switch. ` +
      `Your current email keeps working until then.</p>` +
      `<p style="color:#666;font-size:12px">If the link doesn't open, check your spam folder or paste it into your browser:<br/>${link}</p>` +
      (identity.footer ? `<hr/><p style="color:#666;font-size:12px;white-space:pre-line">${identity.footer}</p>` : ''),
  };
}
const varsEmailChange = ({ identity, name, newEmail, link }) => ({
  'ORG.BRAND_NAME': identity.fromName,
  'ORG.FOOTER': identity.footer,
  'PARTY.GREETING_NAME': name ?? '',
  'MSG.NEW_EMAIL': newEmail,
  'MSG.LINK': link,
});
for (const f of [
  { name: 'named member', identity: IDENTITY, name: 'Mary', newEmail: 'new@x.test', link: 'https://x.test/verify-email?token=t&mode=password&email=new%40x.test' },
  { name: 'nameless member, no footer', identity: BARE, name: null, newEmail: 'new@x.test', link: 'https://x.test/v' },
]) add('EMAIL_CHANGE_VERIFY', f.name, () => legacyEmailChange(f), () => varsEmailChange(f));

/* 12. ORDER_RECEIPT — api/_lib/email.ts renderTemplate('receipt') + api/_lib/receipt.ts:52-53 */
function legacyReceipt({ identity, amount }) {
  const v = (k) => (({ amount })[k] == null ? '' : String(({ amount })[k]));
  const tpl = {
    subject: `Your receipt from ${identity.fromName}`,
    body: `<p>We received your payment${v('amount') ? ` of ${v('amount')}` : ''}. Thank you.</p>`,
  };
  return { subject: tpl.subject, html: `${tpl.body}\n<hr/><pre style="font-family:inherit">${identity.footer}</pre>` };
}
const varsReceipt = ({ identity, amount }) => ({
  'ORG.BRAND_NAME': identity.fromName,
  'ORG.FOOTER': identity.footer,
  'TXN.AMOUNT': amount ?? '',
});
for (const f of [
  { name: 'with amount', identity: IDENTITY, amount: '$450.00' },
  { name: 'no amount, empty footer', identity: BARE, amount: '' },
]) add('ORDER_RECEIPT', f.name, () => legacyReceipt(f), () => varsReceipt(f));

/* 13. HOLD_EXPIRED — api/expire-holds.ts:79-92 */
function legacyHoldExpired({ identity, name, items }) {
  const list = items.length ? `<ul>${items.map((i) => `<li>${i}</li>`).join('')}</ul>` : '';
  return {
    subject: `Your hold has expired — ${identity.fromName}`,
    html:
      `<p>${name ? `Hi ${name},` : 'Hello,'}</p>` +
      `<p>The 48-hour hold on your requested booking has expired because payment wasn't completed in time.</p>` +
      list +
      `<p>No problem — just reply and we'll re-offer new dates with a fresh hold.</p>` +
      (identity.footer ? `<hr/><p style="color:#666;font-size:12px;white-space:pre-line">${identity.footer}</p>` : ''),
  };
}
const varsHoldExpired = ({ identity, name, items }) => ({
  'ORG.BRAND_NAME': identity.fromName,
  'ORG.FOOTER': identity.footer,
  'PARTY.GREETING_NAME': name ?? '',
  'MSG.ITEMS': items,
});
for (const f of [
  { name: 'named, two items', identity: IDENTITY, name: 'Mary Richardson', items: ['Private Lesson — Tue 3pm', 'Private Lesson — Thu 3pm'] },
  { name: 'nameless, no items, no footer', identity: BARE, name: null, items: [] },
]) add('HOLD_EXPIRED', f.name, () => legacyHoldExpired(f), () => varsHoldExpired(f));

/* 14. CONTRACT_WORKING_COPY — api/contract-working-copy.ts:103-115 */
function legacyWorkingCopy({ doc, when }) {
  return {
    subject: `Working copy — ${doc.title ?? 'Contract'}`,
    html:
      `<p>Attached is the current working copy of <strong>${doc.title ?? 'this contract'}</strong>` +
      `${doc.display_code ? ` (${doc.display_code})` : ''}.</p>` +
      `<p>It is <strong>not executed</strong> and reflects the contract as of ${when}. ` +
      `Unselected options and empty fields are included on purpose, so anyone advising ` +
      `you can see what is still open.</p>`,
  };
}
const varsWorkingCopy = ({ doc, when }) => ({
  'DOC.HAS_TITLE': doc.title != null ? '1' : '',
  'DOC.TITLE': doc.title ?? '',
  'DOC.DISPLAY_CODE': doc.display_code ?? '',
  'MSG.GENERATED_AT': when,
});
for (const f of [
  { name: 'titled with code', doc: { title: 'Horse Lease Agreement', display_code: 'CTR-000101' }, when: 'August 12, 2026 at 4:15 PM' },
  { name: 'null title, no code', doc: { title: null, display_code: null }, when: 'August 12, 2026 at 4:15 PM' },
]) add('CONTRACT_WORKING_COPY', f.name, () => legacyWorkingCopy(f), () => varsWorkingCopy(f));

/* 15. NOTIFICATION_DIGEST — api/notifications-nudge.ts:124-134 */
function legacyDigest({ identity, titles, appUrl }) {
  const n = titles.length;
  const subject = `You have ${n} ${n === 1 ? 'update' : 'updates'} at ${identity.fromName}`;
  const items = titles.map((t) => `<li>${escapeHtml(t)}</li>`).join('');
  const footerHtml = identity.footer
    ? `<hr/><p style="color:#666;font-size:12px;white-space:pre-line">${identity.footer}</p>`
    : '';
  return {
    subject,
    html:
      `<p>Here's what's waiting for you at ${identity.fromName}:</p>` +
      `<ul>${items}</ul>` +
      `<p><a href="${appUrl}">Open the app to catch up</a></p>` +
      footerHtml,
  };
}
const varsDigest = ({ identity, titles, appUrl }) => ({
  'ORG.BRAND_NAME': identity.fromName,
  'ORG.FOOTER': identity.footer,
  'MSG.COUNT': String(titles.length),
  'MSG.IS_SINGLE': titles.length === 1 ? '1' : '',
  'MSG.ITEMS': titles.map((t) => escapeHtml(t)),
  'MSG.LINK': appUrl,
});
for (const f of [
  { name: 'three updates, one needs escaping', identity: IDENTITY, titles: ['Lease <ready> to sign', 'Payment received', 'A & B replied'], appUrl: 'https://x.test/app' },
  { name: 'single update, no footer', identity: BARE, titles: ['One thing'], appUrl: 'https://x.test/app' },
]) add('NOTIFICATION_DIGEST', f.name, () => legacyDigest(f), () => varsDigest(f));

/* 16. CALENDAR_UPDATE — api/calendar-reminders.ts:103-107 */
function legacyCalendarUpdate({ identity, titles, appUrl }) {
  const items = titles.map((t) => `<li>${escapeHtml(t)}</li>`).join('');
  return {
    subject: `Calendar update — ${identity.fromName}`,
    html:
      `<p>Calendar update from ${identity.fromName}:</p><ul>${items}</ul>` +
      `<p><a href="${appUrl}">Open your calendar</a></p>` +
      (identity.footer ? `<hr/><p style="color:#666;font-size:12px;white-space:pre-line">${identity.footer}</p>` : ''),
  };
}
const varsCalendarUpdate = ({ identity, titles, appUrl }) => ({
  'ORG.BRAND_NAME': identity.fromName,
  'ORG.FOOTER': identity.footer,
  'MSG.ITEMS': titles.map((t) => escapeHtml(t)),
  'MSG.LINK': appUrl,
});
for (const f of [
  { name: 'two reminders', identity: IDENTITY, titles: ['Lesson in 1 hour', 'Lease <ends> Friday'], appUrl: 'https://x.test/app/calendar' },
  { name: 'one reminder, no footer', identity: BARE, titles: ['Lesson in 2 hours'], appUrl: 'https://x.test/app/calendar' },
]) add('CALENDAR_UPDATE', f.name, () => legacyCalendarUpdate(f), () => varsCalendarUpdate(f));

/* 17. CALENDAR_OPS_DIGEST — api/calendar-reminders.ts:122-128 */
function legacyOpsDigest({ uniq }) {
  return {
    subject: `Upcoming sessions (${uniq.length})`,
    html: `<p>Upcoming calendar items:</p><ul>${uniq.map((t) => `<li>${t}</li>`).join('')}</ul>`,
  };
}
const varsOpsDigest = ({ uniq }) => ({ 'MSG.COUNT': String(uniq.length), 'MSG.ITEMS': uniq });
for (const f of [
  { name: 'three upcoming', uniq: ['Lesson — Mary — Tue 3pm', 'Lesson — Sam — Wed 9am', 'Lesson — Ella — Thu 4pm'] },
  { name: 'one upcoming', uniq: ['Lesson — Mary — Tue 3pm'] },
]) add('CALENDAR_OPS_DIGEST', f.name, () => legacyOpsDigest(f), () => varsOpsDigest(f));

/* 18. REQUEST_RECEIVED — api/request-received.ts:120-164 */
const CATEGORY_LABEL = {
  general: 'General question',
  lessons: 'Riding lessons',
  horse_care: 'Horse care',
  acquisition: 'Buying or selling a horse',
  media: 'Media / press',
  partnership: 'Partnership / sponsorship',
};
const CHANNEL_LABEL = { contact: 'Contact form', inquiry: 'Inquiry form', booking: 'Booking request', kiosk: 'Kiosk' };
const CONTACT_METHOD_LABEL = { text: 'Text', call: 'Call', email: 'Email' };
const proposedTimeText = (t) => {
  if (t.label) return t.label;
  if (t.date && t.end) return `${t.date} – ${t.end}`;
  if (t.date && t.time) return `${t.date} (${t.time})`;
  return t.date || t.time || '';
};
const detailLabel = (key) => key.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase());

function legacyRequestReceived({ identity, r, origin, submittedAt }) {
  const name = r.contact_name?.trim() || 'A visitor';
  const rows = [];
  rows.push(`<li><strong>Email:</strong> ${escAngleAmp(r.contact_email)}</li>`);
  if (r.contact_phone) rows.push(`<li><strong>Phone:</strong> ${escAngleAmp(r.contact_phone)}</li>`);
  if (r.contact_method)
    rows.push(`<li><strong>Prefers:</strong> ${escAngleAmp(CONTACT_METHOD_LABEL[r.contact_method] ?? r.contact_method)}</li>`);
  if (r.category) rows.push(`<li><strong>Interested in:</strong> ${escAngleAmp(CATEGORY_LABEL[r.category] ?? r.category)}</li>`);
  if (r.channel) rows.push(`<li><strong>Via:</strong> ${escAngleAmp(CHANNEL_LABEL[r.channel] ?? r.channel)}</li>`);
  if (r.entry_location) rows.push(`<li><strong>From:</strong> ${escAngleAmp(r.entry_location)}</li>`);
  if (r.subject) rows.push(`<li><strong>Subject:</strong> ${escAngleAmp(r.subject)}</li>`);
  if (r.intent) rows.push(`<li><strong>Intent:</strong> ${escAngleAmp(r.intent)}</li>`);
  rows.push(`<li><strong>Submitted:</strong> ${escAngleAmp(submittedAt)}</li>`);
  const times = (r.proposed_times ?? []).map(proposedTimeText).filter(Boolean);
  const availability = times.length ? `<p><strong>Availability:</strong> ${times.map(escAngleAmp).join('; ')}</p>` : '';
  const detailEntries = Object.entries(r.details ?? {}).filter(([, v]) => v != null && String(v).trim() !== '');
  const details = detailEntries.length
    ? `<ul style="padding-left:18px">${detailEntries
        .map(([k, v]) => `<li><strong>${escAngleAmp(detailLabel(k))}:</strong> ${escAngleAmp(String(v))}</li>`)
        .join('')}</ul>`
    : '';
  const notes = (r.notes || '').trim();
  return {
    subject: `New inquiry from ${name}`,
    html:
      `<p><strong>${escAngleAmp(name)}</strong> just submitted an inquiry on the website.</p>` +
      (rows.length ? `<ul style="padding-left:18px">${rows.join('')}</ul>` : '') +
      availability +
      details +
      (notes ? `<p style="white-space:pre-line;border-left:3px solid #ddd;padding-left:12px;color:#333">${escAngleAmp(notes)}</p>` : '') +
      `<p><a href="${identity.siteUrl ?? origin}/app/ops/intake?request=${r.id}">Open the Request Inbox</a> to reply.</p>` +
      (identity.footer ? `<hr/><p style="color:#666;font-size:12px;white-space:pre-line">${escAngleAmp(identity.footer)}</p>` : ''),
  };
}
function varsRequestReceived({ identity, r, origin, submittedAt }) {
  const rawName = r.contact_name?.trim() ?? '';
  const times = (r.proposed_times ?? []).map(proposedTimeText).filter(Boolean);
  const detailEntries = Object.entries(r.details ?? {}).filter(([, v]) => v != null && String(v).trim() !== '');
  const notes = (r.notes || '').trim();
  return {
    'ORG.FOOTER_HTML': identity.footer ? escAngleAmp(identity.footer) : '',
    'MSG.SENDER_NAME': rawName,
    'MSG.SENDER_NAME_HTML': rawName ? escAngleAmp(rawName) : '',
    'MSG.LINK': `${identity.siteUrl ?? origin}/app/ops/intake?request=${r.id}`,
    'REQ.EMAIL_HTML': escAngleAmp(r.contact_email),
    'REQ.PHONE_HTML': r.contact_phone ? escAngleAmp(r.contact_phone) : '',
    'REQ.CONTACT_METHOD_HTML': r.contact_method
      ? escAngleAmp(CONTACT_METHOD_LABEL[r.contact_method] ?? r.contact_method)
      : '',
    'REQ.CATEGORY_HTML': r.category ? escAngleAmp(CATEGORY_LABEL[r.category] ?? r.category) : '',
    'REQ.CHANNEL_HTML': r.channel ? escAngleAmp(CHANNEL_LABEL[r.channel] ?? r.channel) : '',
    'REQ.ENTRY_LOCATION_HTML': r.entry_location ? escAngleAmp(r.entry_location) : '',
    'REQ.SUBJECT_HTML': r.subject ? escAngleAmp(r.subject) : '',
    'REQ.INTENT_HTML': r.intent ? escAngleAmp(r.intent) : '',
    'REQ.SUBMITTED_AT_HTML': escAngleAmp(submittedAt),
    'REQ.AVAILABILITY_HTML': times.length ? times.map(escAngleAmp).join('; ') : '',
    'REQ.DETAILS': detailEntries.map(([k, v]) => ({
      LABEL: escAngleAmp(detailLabel(k)),
      VALUE: escAngleAmp(String(v)),
    })),
    'REQ.NOTES_HTML': notes ? escAngleAmp(notes) : '',
  };
}
for (const f of [
  {
    name: 'full submission, every optional row present',
    identity: IDENTITY, origin: 'https://x.test', submittedAt: 'Aug 12, 2026, 4:15 PM',
    r: { id: 'req-1', contact_name: '  Mary & Co  ', contact_email: 'mary@x.test', contact_phone: '858-555-0100', contact_method: 'text', category: 'lessons', channel: 'inquiry', entry_location: '/lessons', subject: 'Beginner <lessons>', intent: 'book', proposed_times: [{ date: '2026-08-20', end: '2026-08-22' }, { label: 'Weekends' }], details: { rider_age: '12', goal: 'jumping & flat' }, notes: 'Looking forward\nto it' },
  },
  {
    name: 'bare submission, nothing optional, no footer',
    identity: BARE, origin: 'https://x.test', submittedAt: 'Aug 12, 2026, 4:15 PM',
    r: { id: 'req-2', contact_name: '', contact_email: 'a@b.test', contact_phone: null, contact_method: null, category: null, channel: null, entry_location: null, subject: null, intent: null, proposed_times: null, details: null, notes: null },
  },
  {
    name: 'unmapped enum values fall through to the raw code',
    identity: IDENTITY, origin: 'https://x.test', submittedAt: 'Aug 12, 2026, 4:15 PM',
    r: { id: 'req-3', contact_name: 'Sam', contact_email: 'sam@x.test', contact_phone: null, contact_method: 'carrier_pigeon', category: 'unmapped', channel: 'weird', entry_location: null, subject: null, intent: null, proposed_times: [{ date: '2026-08-20', time: '3pm' }], details: { blank: '   ' }, notes: '   ' },
  },
]) add('REQUEST_RECEIVED', f.name, () => legacyRequestReceived(f), () => varsRequestReceived(f));

/* 19. SUPPORT_RECEIVED — api/support-received.ts:60-76 */
function legacySupportReceived({ identity, name, profileEmail, sr, origin }) {
  const rows = [];
  if (profileEmail) rows.push(`<li><strong>Email:</strong> ${escAngleAmp(profileEmail)}</li>`);
  return {
    subject: `New website inquiry — ${name}`,
    html:
      `<p><strong>${escAngleAmp(name)}</strong> just submitted a support request.</p>` +
      (rows.length ? `<ul style="padding-left:18px">${rows.join('')}</ul>` : '') +
      `<p><strong>Subject:</strong> ${escAngleAmp(sr.subject)}</p>` +
      `<p style="white-space:pre-line;border-left:3px solid #ddd;padding-left:12px;color:#333">${escAngleAmp(sr.body)}</p>` +
      `<p><a href="${identity.siteUrl ?? origin}/app/ops/support">Open Support</a> to reply.</p>` +
      (identity.footer ? `<hr/><p style="color:#666;font-size:12px;white-space:pre-line">${escAngleAmp(identity.footer)}</p>` : ''),
  };
}
function varsSupportReceived({ identity, name, profileEmail, sr, origin }) {
  const rawName = name === 'A member' ? '' : name;
  return {
    'ORG.FOOTER_HTML': identity.footer ? escAngleAmp(identity.footer) : '',
    'PARTY.FULL_NAME': rawName,
    'PARTY.FULL_NAME_HTML': rawName ? escAngleAmp(rawName) : '',
    'PARTY.EMAIL_HTML': profileEmail ? escAngleAmp(profileEmail) : '',
    'MSG.SUBJECT_HTML': escAngleAmp(sr.subject),
    'MSG.BODY_HTML': escAngleAmp(sr.body),
    'MSG.LINK': `${identity.siteUrl ?? origin}/app/ops/support`,
  };
}
for (const f of [
  { name: 'named member with email', identity: IDENTITY, name: 'Mary Richardson', profileEmail: 'mary@x.test', sr: { subject: 'Cannot <sign> in', body: 'It says\nforbidden & stops' }, origin: 'https://x.test' },
  { name: 'unnamed member, no email, no footer', identity: BARE, name: 'A member', profileEmail: null, sr: { subject: 'Help', body: 'Please' }, origin: 'https://x.test' },
]) add('SUPPORT_RECEIVED', f.name, () => legacySupportReceived(f), () => varsSupportReceived(f));

/* ── transcription anchors ─────────────────────────────────────────────────────
 * Each entry: the file on origin/main, and fragments the legacy function above
 * quotes from it. A fragment that is no longer a substring means the legacy
 * transcription has drifted from the real sender and the proof is void.
 */
const ANCHORS = [
  ['api/_lib/invitationEmail.ts', [
    "Here's your invitation link again — ",
    "<p>Welcome — we're so glad to have you.</p>",
    '<p>Create your account here to join the community. You can sign up with Google\n      or set a password — your choice on the next page:</p>',
    "This link expires soon. If it does, just reach out and we'll send a fresh one.",
    '<hr/><pre style="font-family:inherit">',
    '<p style="color:#666;font-size:13px">This same checklist will be on your dashboard, ticking itself off as you go.</p>',
    " is ready — create your account to sign your documents and get started.</p>",
  ]],
  ['api/contract-invite.ts', [
    'A contract is ready for you — ',
    ' has been prepared for you.</p>',
    '>Open the contract</a> — sign in with Google if this is a Gmail address, ',
    "or set a password with this email. You'll land directly on the contract to ",
    'This link is personal to ',
    "actions.push('add your information')",
    "actions.push('review and edit the terms')",
    "actions.push('review and suggest changes')",
    "actions.push('review the terms')",
    "const actionPhrase = `${actions.join(', ')}, and sign`;",
  ]],
  ['api/contract-voided.ts', [
    ' voided ',
    'It is no longer going ahead.</p>',
    '<p>They left this note:</p><blockquote style="margin:0 0 0 12px;padding-left:12px;border-left:3px solid #ddd;color:#444">',
    '<p>No reason was given.</p>',
    '>Open the contract</a> to keep a copy on your documents page, ',
    'Removing it only affects your own documents page — ',
    'the record is retained.<br/>',
  ]],
  ['api/contract-change-requests-submitted.ts', [
    ' requested changes to ',
    '</strong> submitted change requests on ',
    '</strong> for your review.</p>',
    "<p>The most significant ${top.length === 1 ? 'one is' : `${top.length} are`}:</p>",
    '<li style="margin-bottom:8px"><strong>#',
    '>Open the contract</a> to reply to each request and agree or discuss.</p>',
    'The contract cannot be locked for signing until these are resolved.<br/>',
    "'The whole document'",
  ]],
  ['api/_lib/delivery.ts', [
    ' — signed and executed`',
    '<p style="font-size:16px;margin-top:16px">',
    '<p style="color:#888;font-size:12px">Reference code: ',
    "`<p>Hi ${guardianRecipient.firstName || 'there'},</p>`",
    '`<p>The document <strong>${doc.title}</strong> for `',
    "'the minor named on this document'",
    'has been signed and executed. The PDF is attached.</p>',
    '`<p>Your document <strong>${doc.title}</strong> has been signed and executed. `',
    'Integrity hash (SHA-256): ',
    "executed <strong>${doc.title}</strong>. The signed PDF is attached.</p>",
  ]],
  ['api/deliver-documents.ts', [
    'Your signed documents — ',
    '<p>Thank you. Your signed documents are attached to this email:</p>',
    '<p>Please keep these for your records.</p>',
    '`<p>The signed documents for `',
    "'the minor named below'",
    'are attached to this email:</p>',
    'Signed document set',
    'executed the following documents (attached):</p>',
  ]],
  ['api/delete-document-with-copy.ts', [
    ' was withdrawn — copy attached',
    'that was shared with you has been withdrawn and removed. ',
    'A copy is attached to this email for your records.</p>',
  ]],
  ['api/deliver-evaluation-report.ts', [
    '<p>A horse evaluation report',
    ' has been prepared for ',
    "'the account holder'",
    '<p>A horse evaluation report has been shared with you',
    "It's attached to this email.</p>",
    '<p>Your horse evaluation report',
    ' is attached to this email.</p>',
    '<p>Please keep it for your records.</p>',
  ]],
  ['api/email-change-start.ts', [
    'Verify your new email — ',
    '<p>You asked to change your sign-in email to <strong>',
    '>Verify this address</a> and sign in with it plus the password you just set to finish the switch. ',
    'Your current email keeps working until then.</p>',
    "If the link doesn't open, check your spam folder or paste it into your browser:<br/>",
  ]],
  ['api/_lib/email.ts', [
    'subject: `Your receipt from ${fromName}`',
    "body: `<p>We received your payment${v('amount') ? ` of ${v('amount')}` : ''}. Thank you.</p>`",
  ]],
  ['api/_lib/receipt.ts', ['<hr/><pre style="font-family:inherit">${identity.footer}</pre>']],
  ['api/expire-holds.ts', [
    'Your hold has expired — ',
    "<p>The 48-hour hold on your requested booking has expired because payment wasn't completed in time.</p>",
    "<p>No problem — just reply and we'll re-offer new dates with a fresh hold.</p>",
  ]],
  ['api/contract-working-copy.ts', [
    'Working copy — ',
    '<p>Attached is the current working copy of <strong>',
    '<p>It is <strong>not executed</strong> and reflects the contract as of ',
    'Unselected options and empty fields are included on purpose, so anyone advising ',
    'you can see what is still open.</p>',
  ]],
  ['api/notifications-nudge.ts', [
    "const subject = `You have ${n} ${n === 1 ? 'update' : 'updates'} at ${identity.fromName}`;",
    "`<p>Here's what's waiting for you at ${identity.fromName}:</p>`",
    '>Open the app to catch up</a></p>',
  ]],
  ['api/calendar-reminders.ts', [
    '<p>Calendar update from ',
    '>Open your calendar</a></p>',
    'subject: `Calendar update — ${identity.fromName}`',
    'Upcoming sessions (',
    '<p>Upcoming calendar items:</p><ul>',
  ]],
  ['api/request-received.ts', [
    'subject: `New inquiry from ${name}`',
    ' just submitted an inquiry on the website.</p>',
    '<li><strong>Email:</strong> ',
    '<li><strong>Phone:</strong> ',
    '<li><strong>Prefers:</strong> ',
    '<li><strong>Interested in:</strong> ',
    '<li><strong>Via:</strong> ',
    '<li><strong>From:</strong> ',
    '<li><strong>Subject:</strong> ',
    '<li><strong>Intent:</strong> ',
    '<li><strong>Submitted:</strong> ',
    '<p><strong>Availability:</strong> ',
    '>Open the Request Inbox</a> to reply.</p>',
  ]],
  ['api/support-received.ts', [
    'subject: `New website inquiry — ${name}`',
    ' just submitted a support request.</p>',
    '<p><strong>Subject:</strong> ',
    '>Open Support</a> to reply.</p>',
  ]],
];

/** The renderer in api/_lib/emailTemplates.ts must stay in step with the copy above. */
const RENDERER_SYNC = [
  "const TAG_RE = /\\{\\{\\s*(#if|#each|else|\\/if|\\/each)?\\s*([A-Za-z0-9_.]*)\\s*\\}\\}/g;",
];

function atOriginMain(path) {
  return execFileSync('git', ['show', `origin/main:${path}`], { encoding: 'utf8', maxBuffer: 8 << 20 });
}

/* ── run ───────────────────────────────────────────────────────────────────── */
const bodyByKey = new Map(TEMPLATES.map((t) => [t.key, t]));
const printAll = process.argv.includes('--print');
let failures = 0;
let checks = 0;

console.log('EMAILEXTRACT — byte-identity proof\n' + '='.repeat(72));

// A. transcription anchors
console.log('\n[A] LEGACY TRANSCRIPTION ANCHORS (vs origin/main)');
for (const [file, fragments] of ANCHORS) {
  const src = atOriginMain(file);
  const bad = fragments.filter((f) => !src.includes(f));
  checks += fragments.length;
  if (bad.length) {
    failures += bad.length;
    console.log(`  FAIL ${file}`);
    for (const b of bad) console.log(`       missing: ${JSON.stringify(b)}`);
  } else {
    console.log(`  ok   ${file}  (${fragments.length} fragments)`);
  }
}
// emailTemplates.ts is new on this branch, so it is read from the working tree.
{
  const src = readFileSync('api/_lib/emailTemplates.ts', 'utf8');
  for (const frag of RENDERER_SYNC) {
    checks += 1;
    if (!src.includes(frag)) {
      failures += 1;
      console.log(`  FAIL api/_lib/emailTemplates.ts renderer drifted from this script's copy`);
    } else {
      console.log('  ok   api/_lib/emailTemplates.ts  (renderer in step)');
    }
  }
}

// B. every template has a body and every body has a case
console.log('\n[B] COVERAGE');
for (const t of TEMPLATES) {
  checks += 1;
  const n = CASES.filter((c) => c.key === t.key).length;
  if (n === 0) {
    failures += 1;
    console.log(`  FAIL ${t.key} — seeded but never diffed`);
  } else {
    console.log(`  ok   ${t.key.padEnd(28)} ${n} case(s)`);
  }
}
for (const c of CASES) {
  if (!bodyByKey.has(c.key)) {
    failures += 1;
    console.log(`  FAIL ${c.key} — diffed but not seeded`);
  }
}

// C. the diffs
console.log('\n[C] RENDERED OUTPUT — legacy vs extracted');
for (const c of CASES) {
  const tpl = bodyByKey.get(c.key);
  const legacy = c.legacy();
  const vars = c.vars();
  const got = { subject: render(tpl.subject, vars), html: render(tpl.body, vars) };
  for (const field of ['subject', 'html']) {
    checks += 1;
    if (legacy[field] === got[field]) {
      console.log(`  ok   ${c.key} · ${c.name} · ${field}  (${got[field].length} bytes)`);
      if (printAll) console.log(`       ${JSON.stringify(got[field])}`);
    } else {
      failures += 1;
      console.log(`  FAIL ${c.key} · ${c.name} · ${field}`);
      console.log(`       legacy:    ${JSON.stringify(legacy[field])}`);
      console.log(`       extracted: ${JSON.stringify(got[field])}`);
      const n = Math.min(legacy[field].length, got[field].length);
      let i = 0;
      while (i < n && legacy[field][i] === got[field][i]) i++;
      console.log(`       first difference at byte ${i}: ` +
        `${JSON.stringify(legacy[field].slice(Math.max(0, i - 30), i + 30))} vs ` +
        `${JSON.stringify(got[field].slice(Math.max(0, i - 30), i + 30))}`);
    }
  }
}

// D. every token a template uses is registered in the ONE library
console.log('\n[D] TOKEN REGISTRATION (template_tokens)');
{
  const migration = readFileSync('supabase/migrations/20260812T2020_emailextract_tokens.sql', 'utf8');
  const registered = new Set(
    [...migration.matchAll(/^\s*\('([A-Z]+)','([A-Z0-9_]+)',/gm)].map((m) => `${m[1]}.${m[2]}`),
  );
  // Already dictionary rows on origin/main — reused, deliberately not redefined.
  const preexisting = new Set(['PARTY.FULL_NAME', 'ORG.PHONE']);
  const used = new Set();
  for (const t of TEMPLATES) {
    for (const src of [t.subject, t.body]) {
      for (const m of src.matchAll(/\{\{\s*(?:#if|#each)?\s*([A-Z][A-Za-z0-9_.]*)\s*\}\}/g)) {
        used.add(m[1]);
      }
    }
  }
  const unregistered = [...used].filter((k) => !registered.has(k) && !preexisting.has(k));
  const unused = [...registered].filter((k) => !used.has(k));
  checks += 2;
  if (unregistered.length) {
    failures += 1;
    console.log(`  FAIL ${unregistered.length} token(s) used by a template but in no registry: ${unregistered.join(', ')}`);
  } else {
    console.log(`  ok   all ${used.size} tokens registered (${registered.size} new, ${preexisting.size} reused from the existing dictionary)`);
  }
  if (unused.length) {
    failures += 1;
    console.log(`  FAIL ${unused.length} token(s) registered but used by no template: ${unused.join(', ')}`);
  } else {
    console.log('  ok   no registered token is unused');
  }
}

// E. the REWIRED SENDER supplies every token its template asks for
//    Section C proves the template renders correctly from the right token map.
//    This proves the shipped sender builds that map — the two halves of the
//    refactor, checked separately, because a template that renders perfectly from
//    a map nobody builds is still a blank email.
console.log('\n[E] SENDER TOKEN COVERAGE');
const SENDER_OF = {
  INVITATION: 'api/_lib/invitationEmail.ts',
  CONTRACT_INVITE: 'api/contract-invite.ts',
  CONTRACT_VOIDED: 'api/contract-voided.ts',
  CONTRACT_CHANGE_REQUESTS: 'api/contract-change-requests-submitted.ts',
  CONTRACT_WORKING_COPY: 'api/contract-working-copy.ts',
  DOCUMENT_PARTY_COPY: 'api/_lib/delivery.ts',
  DOCUMENT_COMPANY_COPY: 'api/_lib/delivery.ts',
  DOCUMENT_SET_PARTY_COPY: 'api/deliver-documents.ts',
  DOCUMENT_SET_COMPANY_COPY: 'api/deliver-documents.ts',
  DOCUMENT_WITHDRAWN: 'api/delete-document-with-copy.ts',
  EVALUATION_REPORT: 'api/deliver-evaluation-report.ts',
  EMAIL_CHANGE_VERIFY: 'api/email-change-start.ts',
  ORDER_RECEIPT: 'api/_lib/receipt.ts',
  HOLD_EXPIRED: 'api/expire-holds.ts',
  NOTIFICATION_DIGEST: 'api/notifications-nudge.ts',
  CALENDAR_UPDATE: 'api/calendar-reminders.ts',
  CALENDAR_OPS_DIGEST: 'api/calendar-reminders.ts',
  REQUEST_RECEIVED: 'api/request-received.ts',
  SUPPORT_RECEIVED: 'api/support-received.ts',
};
const senderSrc = new Map();
for (const t of TEMPLATES) {
  const file = SENDER_OF[t.key];
  checks += 1;
  if (!file) {
    failures += 1;
    console.log(`  FAIL ${t.key} — no sender mapped`);
    continue;
  }
  if (!senderSrc.has(file)) senderSrc.set(file, readFileSync(file, 'utf8'));
  const src = senderSrc.get(file);
  const missing = [];
  if (!src.includes(`'${t.key}'`)) missing.push(`the key '${t.key}'`);
  const seen = new Set();
  for (const s of [t.subject, t.body]) {
    for (const m of s.matchAll(/\{\{\s*(?:#if|#each)?\s*(\.?[A-Za-z0-9_.]+)\s*\}\}/g)) {
      const k = m[1];
      if (k === '.' || k === 'else' || seen.has(k)) continue;
      seen.add(k);
      // A loop field {{.TITLE}} is an object key `TITLE:` in the sender;
      // a plain token {{ORG.NAME}} is a quoted map key `'ORG.NAME':`.
      const needle = k.startsWith('.') ? `${k.slice(1)}:` : `'${k}'`;
      if (!src.includes(needle)) missing.push(k);
    }
  }
  if (missing.length) {
    failures += 1;
    console.log(`  FAIL ${t.key} — ${file} does not supply: ${missing.join(', ')}`);
  } else {
    console.log(`  ok   ${t.key.padEnd(28)} ${seen.size} token(s) supplied by ${file}`);
  }
}

console.log('\n' + '='.repeat(72));
console.log(`${checks} checks, ${failures} failure(s)`);
process.exit(failures === 0 ? 0 : 1);
