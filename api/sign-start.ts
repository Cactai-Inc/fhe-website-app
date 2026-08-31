/* POST /api/sign-start — public self-onboarding entry for the /sign/* pages
 * (TASK C, rewired by TASK ONBOARD §2/§3).
 *
 * Body: { path: 'guest'|'rider'|'horse'|'rider+horse'|'deal', firstName, lastName,
 *         phone, email, confirmEmail,
 *         addressLine1, addressLine2, city, state, postalCode }
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
 * PARTYEMAIL §2 — THE ADDRESS, AND IT IS ASKED PER PATH. D22 §0 (owner, revised
 * 2026-08-20): "full name and email and phone number are the minimum required set,
 * if they have a contract they need to give us an address."
 *
 * So the address is REQUIRED on `deal` and optional on the other four. `.ADDRESS`
 * is one of the five party tokens a contract prints and nothing else populated it
 * for a self-service signer — but only the deal path has a contract behind it, and
 * a lessons signup is not made to produce a street address before we will talk.
 *
 * The rule is enforced HERE as well as in the form: the browser is not the
 * authority on what a request must contain.
 *
 * Whatever is supplied is written through the SAME helper, fill_claimant_details —
 * blanks only, so a public form never overwrites what staff hold. The deal branch
 * already called it; the provisioning branch now calls it too, using the contact_id
 * provision_client_invitation returns. One writer, whichever door they came in.
 *
 * FIX1 §A — THE MINOR ARRIVES WITH THE NAME. AR7 F1: this door captured one name
 * and every word around it said it was the rider's, so a parent enrolling a child
 * created an account in the child's name. Body now carries isForMinor +
 * minorFirstName/minorLastName/minorDob on the three paths where a rider may be a
 * minor. The rule is re-decided HERE from MINOR_PATHS — the browser is not the
 * authority on which paths may carry a child, exactly as it is not the authority
 * on which paths require an address.
 *
 * The minor is attached through attach_minor_to_guardian(), which IS the block
 * lifted out of update_my_onboarding_profile (20260831T0910) — guardian is the
 * account holder, minor is the non-signing PARTICIPANT, linked by
 * contacts.guardian_contact_id. There is no second minor concept at the door.
 *
 * FIX1 §B — A RESUBMISSION MAY CORRECT ITS OWN NAME. AR7 F2: fill_claimant_details
 * writes blanks only, so a visitor who spotted their own mistake and resubmitted
 * 109 seconds later was told the send succeeded while the correction was thrown
 * away. That rule is untouched — it is what stops a public form overwriting staff
 * data. correct_claimant_name_from_signup() runs BESIDE it and applies the name
 * only when it can prove the same requester is correcting their own prior
 * submission, nothing has been signed, and no human has set the name in-app
 * (20260831T0920). The response carries `nameApplied` so the send-state screen
 * can say so — echoing the visitor's OWN input, which discloses nothing about
 * whether we already knew the address.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createHash } from 'node:crypto';
import { getSupabaseAdmin } from './_lib/supabaseAdmin.js';
import { sendInvitationEmail, recordInvitationDelivery } from './_lib/invitationEmail.js';
import { resolveTenantEmailIdentity, sendViaProvider } from './_lib/email.js';
import { renderEmailTemplate } from './_lib/emailTemplates.js';

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

/** FIX1 §A — which paths may carry a minor. Owner ruling 2026-08-31: a rider may
 *  be a minor, a horse owner may not ("both require a person to be 18+ to be
 *  horse owner"). `rider+horse` is a rider path, so it asks; `horse` and `deal`
 *  are the horse owner and do not. Mirrors PATH_ALLOWS_MINOR in SignStart.tsx —
 *  and is the authoritative copy, because the browser does not decide this. */
const MINOR_PATHS = new Set(['guest', 'rider', 'rider+horse']);

/** Under 18 today. The same test sign_release applies to a kiosk minor release:
 *  an "18-year-old minor" is a data error, and recording one would put an adult
 *  in the non-signing PARTICIPANT slot where nobody would ever ask them to sign
 *  for themselves. */
function isUnder18(dob: Date): boolean {
  const eighteenth = new Date(dob.getFullYear() + 18, dob.getMonth(), dob.getDate());
  return eighteenth > new Date();
}

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

  const firstName = ((body.firstName as string) || '').trim();
  const lastName = ((body.lastName as string) || '').trim();
  const phone = ((body.phone as string) || '').trim();
  // §2: the owner overrode the old email-only capture. All four are required by
  // the form; the server enforces the three it can check cheaply.
  if (!firstName || !lastName) return res.status(400).json({ error: 'name required' });
  if (!phone) return res.status(400).json({ error: 'phone required' });

  // PARTYEMAIL §2 — the fourth value. Apt/suite is genuinely optional everywhere;
  // the other four components are what compose_address needs to produce a usable
  // address, which is why a PARTIAL address is refused on every path. "Optional"
  // means leave it blank, not "a street with no city will do" — a fragment would be
  // composed into the contract exactly as typed.
  const addressLine1 = ((body.addressLine1 as string) || '').trim();
  const addressLine2 = ((body.addressLine2 as string) || '').trim();
  const city = ((body.city as string) || '').trim();
  const stateV = ((body.state as string) || '').trim();
  const postalCode = ((body.postalCode as string) || '').trim();
  // FIX1 §A — the minor, on the paths that may have one. `isForMinor` is only
  // ever honoured where MINOR_PATHS says it can be; a request that asserts it on
  // /sign/horse or /sign/deal is not an error, it is simply not a minor path and
  // the flag is dropped.
  const minorFirstName = ((body.minorFirstName as string) || '').trim();
  const minorLastName = ((body.minorLastName as string) || '').trim();
  const minorDobRaw = ((body.minorDob as string) || '').trim();
  const isForMinor = Boolean(body.isForMinor) && MINOR_PATHS.has(path);
  let minorDob: Date | null = null;
  if (isForMinor) {
    if (!minorFirstName || !minorLastName) {
      return res.status(400).json({ error: "the rider's name is required" });
    }
    minorDob = minorDobRaw ? new Date(`${minorDobRaw}T00:00:00Z`) : null;
    if (!minorDob || Number.isNaN(minorDob.getTime())) {
      return res.status(400).json({ error: "the rider's date of birth is required" });
    }
    if (!isUnder18(minorDob)) {
      return res.status(400).json({ error: 'the named rider is 18 or older; they sign up in their own name' });
    }
  }

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
   *  GENERATED column and is never among these — it recomputes from the parts. */
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
    } else if (allowed && orgId) {
      const { data, error: rpcErr } = await db.rpc('provision_client_invitation', {
        p_email: email,
        p_first_name: firstName || null,
        p_last_name: lastName || null,
        p_phone: phone || null,
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
        await db.rpc('fill_claimant_details', {
          p_contact_id: out.contact_id, ...claimantDetails,
        });

        /* FIX1 §B — THE CORRECTION LANDS. fill_claimant_details above is
           unchanged and still blanks-only; this runs beside it and applies the
           name only when the database can prove all four guards (same
           requester_hash, nothing signed, no human has set the name in-app, and
           it actually differs). Everything else keeps today's absolute
           protection. AR7 F2 is the whole reason this line exists. */
        const { data: fixed, error: fixErr } = await db.rpc('correct_claimant_name_from_signup', {
          p_contact_id: out.contact_id,
          p_first_name: firstName,
          p_last_name: lastName,
          p_requester_hash: requesterHash,
        });
        if (fixErr) console.error('sign-start: name correction failed', fixErr);
        nameApplied = Boolean(fixed);

        /* FIX1 §A — THE MINOR, ATTACHED AT THE DOOR. Same spine Onboarding.tsx
           uses: guardian_contact_id on the child's contact. my_onboarding_state()
           reads it straight back, so the guardian reaches the corridor with the
           question already answered, and generate_my_onboarding_documents() puts
           the child in the PARTICIPANT slot and the guardian in CLIENT.
           Never blocks the invitation — but never silent either, for the same
           reason apply_sign_path_documents below is not. */
        if (isForMinor) {
          const { error: minorErr } = await db.rpc('attach_minor_to_guardian', {
            p_guardian_contact_id: out.contact_id,
            p_first_name: minorFirstName,
            p_last_name: minorLastName,
            p_dob: minorDobRaw || null,
          });
          if (minorErr) console.error('sign-start: minor not attached', path, minorErr);
        }
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
       the address was already known to us. Anti-enumeration is intact. */
    return res.status(200).json({ ok: true, status, attemptId, nameApplied });
  } catch (err) {
    console.error('sign-start error', err);
    return res.status(500).json({ error: 'could not process your request' });
  }
}
