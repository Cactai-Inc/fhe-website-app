/* POST /api/sign-start — public self-onboarding entry for the /sign/* pages
 * (TASK C, rewired by TASK ONBOARD §2/§3, slimmed by TASK-SIGNDOOR).
 *
 * ⚠️ SIGNDOOR — THE FOUR FUNNEL DOORS TAKE AN EMAIL ADDRESS AND NOTHING ELSE.
 * Owner, 2026-09-01: *"the purpose of this page is purely to capture the initial
 * information for the setup of an account, it was supposed to only ask for their
 * email address."* Everything this endpoint used to accept from a funnel — name,
 * phone, address, the FIX1 minor block — is now asked on the FIRST PAGE AFTER
 * AUTH (src/pages/app/Onboarding.tsx, the `details` step), where the account is
 * provably the guardian's because the address has been verified by clicking the
 * emailed link. Nothing was invented to move it: that form and its RPC spine
 * (update_my_onboarding_profile -> attach_minor_to_guardian) were already there.
 *
 * ⚠️ `deal` IS DELIBERATELY UNCHANGED (SIGNDOOR §5.4). It is not a funnel: it
 * claims a contract that already exists, the address prints on that contract
 * (D22), and its field set serves a different purpose. Every line of its branch
 * below — fill_claimant_details, correct_claimant_name_from_signup,
 * invite_contract_counterparty — is exactly what it was.
 *
 * Body, funnels: { path: 'guest'|'rider'|'horse'|'rider+horse', email, confirmEmail }
 * Body, deal:    { path: 'deal', email, confirmEmail, firstName, lastName, phone,
 *                  addressLine1, addressLine2, city, state, postalCode }
 * -> 200 { ok, status, attemptId } — `status` is the REAL send outcome
 *    ('sent' | 'send_failed' | 'rate_limited' | 'unavailable'), because the owner
 *    asked for "a screen that renders the actual email sending state with outcome"
 *    rather than an optimistic "check your email".
 * -> 400 on a malformed body.
 *
 * ANTI-ENUMERATION STILL HOLDS, and it is worth being precise about why. The
 * property that matters is that the response must not reveal whether an address
 * is already known to us — and it does not: a brand-new address and a returning
 * one both provision (the repeat is the resume path) and both report the same
 * `status`. What the response now reveals is whether OUR OWN send succeeded, which
 * is a fact about us, not about them. `rate_limited` is keyed on the requester
 * (sha256 of ip + user agent), never on the email, so it is not an oracle either.
 *
 * Flow:
 *  1. Validate + map path -> standing categories.
 *  2. Rate limit via sign_start_register_attempt (requester_hash =
 *     sha256(ip + user agent), NEVER the email) — 10 allowed provisions/hour
 *     per requester; beyond that, no provisioning, and the caller is told so.
 *  3. Provision through the canonical spine (service-role): the same
 *     provision_client_invitation RPC admin-send-invitation.ts uses, now carrying
 *     the name AND phone the person just typed (§2). A repeat email is the resume
 *     path — same contact, fresh token, requirements preserved.
 *  4. Send the SAME activation email the manual admin flow sends (shared
 *     _lib/invitationEmail.ts helper — one template, one sender).
 *  5. Record the attempt and its outcome (signup_attempts). That row is what
 *     /api/signup-help escalates from, and it is why "created but never emailed"
 *     is now a queryable fact instead of a lost 200.
 *
 * PARTYEMAIL §2 / D22 §0 — THE ADDRESS, ON THE PATH THAT PRINTS ONE. Owner,
 * revised 2026-08-20: "full name and email and phone number are the minimum
 * required set, if they have a contract they need to give us an address."
 * `.ADDRESS` is one of the five party tokens a contract prints, so `deal` still
 * REQUIRES a complete address here — enforced server-side, because the browser is
 * not the authority on what a request must contain. The funnels no longer supply
 * one at all; the post-auth details form collects it before any document merges.
 *
 * FIX1 §A/§B, AND WHERE THEY LIVE NOW. The minor question and the
 * self-correcting-name rule were both put HERE because the door was where the
 * name was captured. The name is no longer captured here on a funnel, so neither
 * is: `attach_minor_to_guardian()` is called from update_my_onboarding_profile
 * (the same RPC, the same single engine — 20260831T0910, D18), and the
 * "correction" case disappears with the field, because a person who mistypes
 * nothing cannot mistype their name. ⚠️ `correct_claimant_name_from_signup()` is
 * NOT retired: the `deal` branch still calls it, unchanged (20260831T0920).
 *
 * `nameApplied` stays in the response and is simply always false for a funnel.
 * The response shape must not vary — see the anti-enumeration note above.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createHash } from 'node:crypto';
import { getSupabaseAdmin } from './_lib/supabaseAdmin.js';
import { sendInvitationEmail, recordInvitationDelivery } from './_lib/invitationEmail.js';
import { resolveTenantEmailIdentity, sendViaProvider } from './_lib/email.js';
import { renderEmailTemplate } from './_lib/emailTemplates.js';
import { accountStateForEmail, sendSignInEmail, greetingNameForContact } from './_lib/accountDoor.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const PATH_CATEGORIES: Record<string, string[]> = {
  guest: ['GUEST'],
  rider: ['RIDER'],
  horse: ['HORSE_OWNER'],
  'rider+horse': ['RIDER', 'HORSE_OWNER'],
};

/** ONBOARD §1b — `deal` is the fifth chooser option and does NOT provision a new
 *  client. It CLAIMS an existing contract: the visitor's email is matched against
 *  document parties who have no account yet, and a match mints the same CONTRACT
 *  invitation staff issue from the contract page, so activation creates the
 *  account and lands them on their document in one flow. */
const DEAL_PATH = 'deal';

/** FIX1 §A — WHICH DOORS MAY CARRY A MINOR IS STILL RE-DECIDED SERVER-SIDE, and
 *  it still is not the browser's call. It simply is not decided HERE any more:
 *  the question moved to the post-auth details form, so the authoritative copy is
 *  `_sign_path_allows_minor(text)` in the database (20260901T1120), which
 *  `update_my_onboarding_profile` consults before it attaches anybody's child.
 *  Named here so the next reader of this file finds where the rule went. */

function sha256(s: string): string {
  return createHash('sha256').update(s).digest('hex');
}

/** provision_client_invitation() jsonb result (subset used here). */
interface ProvisionResult {
  token: string;
  invitation_id: string;
  contact_id: string;
}

/** What the send-state screen renders. */
type SendStatus = 'sent' | 'send_failed' | 'rate_limited' | 'unavailable';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method not allowed' });

  let body: Record<string, unknown>;
  try {
    body = (typeof req.body === 'string' ? JSON.parse(req.body) : req.body) ?? {};
  } catch {
    return res.status(400).json({ error: 'invalid JSON body' });
  }

  // The URL path segment carries a literal '+' (e.g. rider+horse); a caller
  // that percent-encoded it (rider%2Bhorse) arrives here already decoded by
  // the framework, so both forms normalize to the same lookup key.
  const path = ((body.path as string) || '').trim().toLowerCase();
  const isDeal = path === DEAL_PATH;
  const categories = PATH_CATEGORIES[path];
  if (!categories && !isDeal) return res.status(400).json({ error: 'unknown path' });

  const email = ((body.email as string) || '').trim().toLowerCase();
  const confirmEmail = ((body.confirmEmail as string) || '').trim().toLowerCase();
  if (!email || !confirmEmail || email !== confirmEmail) {
    return res.status(400).json({ error: 'email and confirmation must match' });
  }
  if (!EMAIL_RE.test(email)) return res.status(400).json({ error: 'invalid email' });

  /* ⚠️ SIGNDOOR — EVERY FIELD BELOW THIS LINE IS READ ONLY ON `deal`. A funnel
     body is { path, email, confirmEmail } and nothing more; if a stale client (a
     cached bundle mid-deploy, say) still POSTs a name, it is read into these
     constants and then never used, which is the quiet, correct outcome — the old
     door's data is not honoured by a slim endpoint, and it is not rejected
     either, because refusing would turn a deploy into an outage for anyone
     holding the page. */
  const firstName = isDeal ? ((body.firstName as string) || '').trim() : '';
  const lastName = isDeal ? ((body.lastName as string) || '').trim() : '';
  const phone = isDeal ? ((body.phone as string) || '').trim() : '';
  // D22 §0 — the deal path prints a party block, so it still demands the set.
  if (isDeal) {
    if (!firstName || !lastName) return res.status(400).json({ error: 'name required' });
    if (!phone) return res.status(400).json({ error: 'phone required' });
  }

  // PARTYEMAIL §2 — the fourth value, on the one path that prints it. Apt/suite is
  // genuinely optional; the other four components are what compose_address needs to
  // produce a usable address, which is why a PARTIAL address is refused. "Optional"
  // means leave it blank, not "a street with no city will do" — a fragment would be
  // composed into the contract exactly as typed.
  const addressLine1 = isDeal ? ((body.addressLine1 as string) || '').trim() : '';
  const addressLine2 = isDeal ? ((body.addressLine2 as string) || '').trim() : '';
  const city = isDeal ? ((body.city as string) || '').trim() : '';
  const stateV = isDeal ? ((body.state as string) || '').trim() : '';
  const postalCode = isDeal ? ((body.postalCode as string) || '').trim() : '';

  const addressComplete = Boolean(addressLine1 && city && stateV && postalCode);
  // addressLine2 counts as "started" though it is never required: verified on prod,
  // compose_address(NULL,'Apt 3',NULL,NULL,NULL) returns 'Apt 3', so a lone apartment
  // line would print on the contract as the party's whole address.
  const addressStarted = Boolean(addressLine1 || addressLine2 || city || stateV || postalCode);
  // Only the path with a contract behind it demands one.
  if (isDeal && !addressComplete) {
    return res.status(400).json({ error: 'address required' });
  }
  if (addressStarted && !addressComplete) {
    return res.status(400).json({ error: 'incomplete address' });
  }

  /** The one write path for what the visitor typed: blanks only, never an
   *  overwrite of the record staff maintain. contacts.address_composed is a
   *  GENERATED column and is never among these — it recomputes from the parts.
   *  ⚠️ `deal` only now: a funnel supplies nothing to fill. */
  const claimantDetails = {
    p_first_name: firstName || null,
    p_last_name: lastName || null,
    p_phone: phone || null,
    p_address_line1: addressLine1 || null,
    p_address_line2: addressLine2 || null,
    p_city: city || null,
    p_state: stateV || null,
    p_postal_code: postalCode || null,
  };

  try {
    const db = getSupabaseAdmin();

    // Single-tenant resolution — the same fallback request-received.ts uses:
    // a service-role call has no current_org(), and this endpoint has no
    // staff profile to stamp an org from.
    const { data: orgs } = await db.from('organizations').select('id').limit(2);
    const orgId = (orgs && orgs.length === 1) ? (orgs[0].id as string) : null;

    // Rate limit — keyed on the requester, never the email.
    const forwardedFor = (req.headers['x-forwarded-for'] as string | undefined) || '';
    const ip = forwardedFor.split(',')[0].trim() || req.socket?.remoteAddress || 'unknown';
    const userAgent = (req.headers['user-agent'] as string | undefined) || '';
    const requesterHash = sha256(`${ip}|${userAgent}`);

    const { data: attempt, error: attemptErr } = await db.rpc('sign_start_register_attempt', {
      p_hash: requesterHash,
      p_org: orgId,
    });
    if (attemptErr) throw attemptErr;
    const allowed = Boolean((attempt as { allowed?: boolean } | null)?.allowed);

    // `status` is what the VISITOR is told. `emailSent` is what actually happened.
    // They diverge in exactly one place — a `deal` attempt that matched no
    // contract — and keeping them as separate variables is what stops the
    // deliberately neutral answer from also lying to the people who run the place.
    let status: SendStatus = allowed ? 'unavailable' : 'rate_limited';
    let emailSent = false;
    let invitationId: string | null = null;
    let sendError: string | null = null;
    let messageId: string | null = null;
    // FIX1 §B — did the resubmission actually correct the record? Reported to the
    // caller so the send-state screen can say so instead of staying silent.
    let nameApplied = false;

    if (allowed && isDeal) {
      // ── §1b: claim, don't provision ───────────────────────────────────────
      // The response below is IDENTICAL whether or not a contract was found, and
      // this branch is the reason that matters: answering differently would turn
      // a public form into an oracle for "does this person have a contract with
      // you". The person who legitimately gets no email is served by the "I never
      // received it" link on the next screen, which reaches a human — that escape
      // hatch is what makes a deliberately uninformative response humane.
      const { data: match, error: matchErr } = await db.rpc('find_claimable_contract', {
        p_email: email,
      });
      if (matchErr) throw matchErr;
      const claim = (Array.isArray(match) ? match[0] : match) as {
        found?: boolean; document_id?: string; contact_id?: string; org_id?: string; title?: string;
      } | null;

      if (claim?.found && claim.document_id && claim.contact_id) {
        // What they typed goes on the contact the contract already points at —
        // blanks only, so a self-service form never overwrites staff's record.
        await db.rpc('fill_claimant_details', {
          p_contact_id: claim.contact_id, ...claimantDetails,
        });
        // FIX1 §B — and if this is the same requester correcting a name they
        // themselves submitted before, it lands. Same guards, same door.
        const { data: dealFixed } = await db.rpc('correct_claimant_name_from_signup', {
          p_contact_id: claim.contact_id,
          p_first_name: firstName,
          p_last_name: lastName,
          p_requester_hash: requesterHash,
        });
        nameApplied = Boolean(dealFixed);

        // The SAME invitation staff mint from the contract page. Activation
        // redeems it through redeem_contract_invitation, which promotes the
        // contact to an account and lands them on the document — one flow, and
        // not a second claim mechanism.
        const { data: inv, error: invErr } = await db.rpc('invite_contract_counterparty', {
          p_document_id: claim.document_id,
          p_contact_id: claim.contact_id,
          p_email: email,
        });
        if (invErr) throw invErr;
        const token = (inv as { token: string; invitation_id: string }).token;
        invitationId = (inv as { invitation_id: string }).invitation_id;

        const origin = req.headers.origin || `https://${req.headers.host}`;
        const link = `${origin}/activate?token=${token}&kind=contract`;
        const identity = await resolveTenantEmailIdentity(db, claim.org_id ?? orgId ?? '');
        const rendered = await renderEmailTemplate(db, 'CONTRACT_INVITE', {
          'ORG.BRAND_NAME': identity.fromName,
          'ORG.FOOTER': identity.footer,
          'DOC.HAS_TITLE': claim.title ? '1' : '',
          'DOC.TITLE': claim.title ?? '',
          // The claimant has not seen their controls yet, so the email makes no
          // promise about what they may edit — it only gets them to the document.
          'DOC.PARTY_NEEDS_INFO': '',
          'DOC.PARTY_CAN_EDIT_DEAL': '',
          'DOC.PARTY_CAN_SUGGEST': '',
          'MSG.LINK': link,
          'MSG.RECIPIENT_EMAIL': email,
        });
        const sent = rendered
          ? await sendViaProvider({
              to: email,
              fromName: identity.fromName,
              fromEmail: identity.fromEmail,
              subject: rendered.subject,
              html: rendered.html,
            })
          : { ok: false as const, messageId: null, error: 'the CONTRACT_INVITE email template is missing or deactivated' };
        await recordInvitationDelivery(db, invitationId, {
          ok: sent.ok, messageId: sent.messageId ?? null,
          ...(sent.ok ? {} : { error: sent.error ?? 'the email transport rejected the send' }),
        });
        emailSent = sent.ok;
        status = sent.ok ? 'sent' : 'send_failed';
        sendError = sent.ok ? null : (sent.error ?? 'the email transport rejected the send');
        messageId = sent.messageId ?? null;
      } else {
        // No claimable contract. The VISITOR is told the same thing a match is
        // told (see above). The attempt row is told the truth, so staff reading
        // it — or handling the support alert this person is about to raise — see
        // that a deal claim matched nothing rather than that an email bounced.
        status = 'sent';
        emailSent = false;
        sendError = 'no claimable contract matched this address — nothing was sent';
      }
    } else if (allowed && orgId && (await accountStateForEmail(db, email)).state === 'active') {
      /* ⚠️ THEY ALREADY HAVE AN ACCOUNT. Owner, 2026-09-01, after his own test was
         REJECTED at the password step: *"the input of the email address should
         trigger an email to them that says click here to sign into your account.
         and the link takes them to the login page since they already have an
         active account with auth set up."*

         So: no provisioning, no invitation, no activation link. Minting a claim
         token for somebody who already holds the credential is precisely what
         produced that rejection — `register-invited` then had to decide between
         an invitation and an account, and it decided wrong.

         ⚠️ THE RESPONSE IS UNCHANGED. `status` still reports our send outcome and
         nothing about them, so this branch is not an enumeration oracle; the
         attempt row below records which door was taken, for staff, not for the
         browser. */
      const facts = await accountStateForEmail(db, email);
      const origin = req.headers.origin || `https://${req.headers.host}`;
      const sent = await sendSignInEmail(db, {
        orgId,
        to: email,
        origin,
        greetingName: await greetingNameForContact(db, facts.contactId),
      });
      emailSent = sent.ok;
      status = sent.ok ? 'sent' : 'send_failed';
      sendError = sent.ok ? null : (sent.error ?? 'the email transport rejected the send');
      messageId = sent.messageId;
    } else if (allowed && orgId) {
      /* ⚠️ SIGNDOOR — PROVISIONED NAMELESS, ON PURPOSE. `provision_client_invitation`
         has always accepted a null name (`v_fn := nullif(trim(coalesce(p_first_name,
         '')), '')`), and `_ensure_client_account` inserts the contact with
         first_name NULL rather than a placeholder — verified on production. That
         NULL is load-bearing twice over: the invitation email carries no name token
         at all (the INVITATION template merges ORG.BRAND_NAME, MSG.LINK,
         MSG.EXPIRES_ON and nothing personal), and `needsName` on the post-auth
         details form is exactly "the contact has no name", so leaving it blank is
         what MAKES the first page after auth ask for it. */
      const { data, error: rpcErr } = await db.rpc('provision_client_invitation', {
        p_email: email,
        p_first_name: null,
        p_last_name: null,
        p_phone: null,
        p_categories: categories,
        p_offering_ids: [],
        p_template_keys: null,
        p_mark_paid: false,
        p_payment_method: null,
        p_notes: null,
        p_request_id: null,
        p_org_id: orgId,
        p_partial_amount: 0,
      });
      if (rpcErr) throw rpcErr;
      const out = (Array.isArray(data) ? data[0] : data) as ProvisionResult;
      invitationId = out.invitation_id;

      // provision_client_invitation carries name and phone, but has no address
      // parameter — widening the canonical spine for one field would change every
      // caller. The same helper the deal branch uses writes it onto the contact it
      // just returned, so the address lands whichever path was taken.
      if (out.contact_id) {
        /* ⚠️ SIGNDOOR — fill_claimant_details, correct_claimant_name_from_signup
           and attach_minor_to_guardian ALL STOOD HERE, and all three are now
           reached from the post-auth details form instead, because that is where
           the values they write are now typed. None of the three RPCs changed and
           none was retired — `deal` above still calls the first two, and
           update_my_onboarding_profile still calls the third. This is a call site
           moving, not an engine being replaced (D18). */
        /* ⚠️ OFFERINGDOCS 2026-08-24 — THE DOOR ASSIGNS THE PAPERWORK NOW.
           `p_categories` above is still sent and still recorded, but a category
           no longer writes a single document: `_ensure_client_account` stopped
           calling `apply_category_documents`, because a tag describing somebody
           is not why they owe anything. Each self-service door carries its own
           set in `sign_path_document_requirements` — owner-editable, seeded with
           exactly what each path assigned via its category before.

           This is also where GUEST is answered. A visitor has no purchase, no
           horse, no contract and no file, so nothing can DERIVE the tag for them
           — which means the tag cannot be what requires their documents. The
           VISIT is the trigger: /sign/guest assigns the visitor set here, and
           GUEST stays derived from the executed release exactly as before. */
        const { error: docErr } = await db.rpc('apply_sign_path_documents', {
          p_contact_id: out.contact_id, p_path: path,
        });
        // Never blocks the invitation — but never silent either: a visitor who
        // arrives owing nothing because this failed is an ops problem.
        if (docErr) console.error('sign-start: path documents not assigned', path, docErr);
      }

      const origin = req.headers.origin || `https://${req.headers.host}`;
      const registerUrl = `${origin}/activate?token=${out.token}`;
      const sent = await sendInvitationEmail(db, { orgId, to: email, registerUrl });
      await recordInvitationDelivery(db, out.invitation_id, sent);
      emailSent = sent.ok;
      status = sent.ok ? 'sent' : 'send_failed';
      sendError = sent.ok ? null : (sent.error ?? 'the email transport rejected the send');
      messageId = sent.messageId;
    }

    // §3: one row per attempt, whatever happened. This is what the "I never
    // received it" link escalates from, and what turns "an account exists but
    // nobody was ever emailed" into something staff can find.
    let attemptId: string | null = null;
    try {
      const { data: rec } = await db.rpc('record_signup_attempt', {
        p_org: orgId,
        p_email: email,
        // Null on a funnel: the row records what was actually submitted, and a
        // blank here is the truth rather than a gap. Staff reading the signup
        // trail see the email and the door, which is now all a funnel carries.
        p_first_name: firstName || null,
        p_last_name: lastName || null,
        p_phone: phone || null,
        p_path: path,
        p_categories: categories ?? null,
        p_invitation_id: invitationId,
        p_email_ok: emailSent,
        p_email_error: sendError,
        p_message_id: messageId,
        p_rate_limited: !allowed,
        p_requester_hash: requesterHash,
      });
      attemptId = (rec as string | null) ?? null;
    } catch (recErr) {
      // Recording must never turn a successful signup into a failed request —
      // but it must not vanish either.
      console.error('sign-start: could not record the attempt', recErr);
    }

    /* FIX1 §B — `nameApplied` is safe to return. It is true only when the name
       the visitor JUST TYPED was written, so the screen echoes their own input
       back; it never reveals what we held before, and it never reveals whether
       the address was already known to us. Anti-enumeration is intact.
       ⚠️ SIGNDOOR: on a funnel it is now ALWAYS false, and the key stays in the
       payload regardless. A response whose SHAPE varied would be exactly the
       oracle the header above spends twelve lines refusing to be. */
    return res.status(200).json({ ok: true, status, attemptId, nameApplied });
  } catch (err) {
    console.error('sign-start error', err);
    return res.status(500).json({ error: 'could not process your request' });
  }
}
