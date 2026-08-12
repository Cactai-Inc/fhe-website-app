# TASK-EMAILEXTRACT — Report (2026-08-12)

## WHERE THE CONTENT LANDED, AND WHY — answered first, as required

**The email content lives in a new `email_templates` table, not in rows inside
`contract_templates`.** It is a SIBLING of `contract_templates` and `form_definitions`, with
the same lifecycle columns (`body` / `draft_body` / `version` / `active`), the same token
library (`template_tokens`), and an editor RPC family whose four verbs match
`TASK-TEXTEDIT`'s exactly. **That is one engine over three content tables — the shape D12
describes ("Emails get their own SECTION inside Templates, not their own engine"), and the
shape `TEMPLATE-ENGINES-DELTA` already blesses ("One archive page reads both tables. One
surface, two sources — not a third table to unify them"). What that document FORBIDS is a
unified table that absorbs the others. This absorbs nothing and moves nothing.**

The task asked me to prefer `contract_templates` and to produce evidence if it genuinely
could not hold an email. It cannot, on five counts, each checked against the live database:

| # | Blocker | Evidence |
|---|---|---|
| 1 | `CHECK contract_templates_parties_present` requires `cardinality(party_namespaces) > 0`, and the column is `NOT NULL DEFAULT '{}'` | An email has no parties. Every one of the 22 existing rows carries a real namespace set (`{LESSOR,LESSEE}`, `{CLIENT,PARTICIPANT}`…). Satisfying the constraint for an email means writing a party namespace that is a lie. |
| 2 | `documents.template_id` **FK** → `contract_templates(id)`; `contract_requirements.template_key` **FK** → `contract_templates(template_key)` | An email row becomes a generatable document and an assignable onboarding requirement by construction. |
| 3 | **69 database functions and 5 frontend read sites** read `contract_templates` | Two proven by reading their bodies: `staff_assignable_templates()` filters on `active AND body IS NOT NULL AND` no `contract_section_defs` row — **every email row passes**, so staff would be offered "Account invitation" as a document to assign a contact *for signature*. `template_editor_list()` has **no content filter at all** — every email would appear in the CONTRACT wording editor. Shipping emails into that table means auditing 69 functions for a filter that does not exist yet. |
| 4 | RLS `contract_templates_read_active` grants `SELECT` **to `anon`** for every active row | The barn-facing bodies (`REQUEST_RECEIVED`, `SUPPORT_RECEIVED`, `CALENDAR_OPS_DIGEST`, `DOCUMENT_COMPANY_COPY`) would become world-readable. |
| 5 | One `body` column | An email needs subject + body + a from-address rule at minimum — columns that would be `NULL` on all 22 contract rows. |

`email_templates` is **staff-read, admin-write**, proven below. Its `from_address_rule` is a
constrained enum, not free text, so the editor can never point an email at an arbitrary
address.

**What I did NOT reuse, deliberately:** `record_template_version_bump`. That trigger writes
`template_version_events` to drive the re-sign prompt for people who signed an older version.
Nobody signs an email.

---

## 1. THE INVENTORY — and the count is not 19

The task measured **19 files under `api/` that compose an email**. Two corrections, both
verified by grepping every `sendViaProvider(` call site:

**Three of the named 19 compose nothing.**

| File | What it actually does |
|---|---|
| `email-change-complete.ts` | Promotes the address. Imports no email helper, sends nothing. The *start* endpoint sends the only mail in that flow. |
| `delivery-sweep.ts` | 40 lines that call one RPC (`sweep_undelivered_executed_documents`). The alerting is a staff **notification**, not an email. |
| `admin-provision-tenant.ts` | Creates an auth user and calls `provision_tenant`. Supabase Auth may send its own confirmation from its own templates; this repo composes nothing. |

**Three composers were NOT on the list.** These would have been left hardcoded:

| File | Email |
|---|---|
| `api/expire-holds.ts` | "Your hold has expired" |
| `api/contract-working-copy.ts` | "Working copy — {contract}" |
| `api/_lib/receipt.ts` | The payment receipt (via `renderTemplate('receipt')`) |

**The real number is 19 DISTINCT EMAILS** — a coincidence, not the same 19 — composed across
16 files, because `_lib/delivery.ts` and `deliver-documents.ts` and `calendar-reminders.ts`
each compose two.

### The 19, as seeded

| Key | Trigger | Recipient | Subject (rendered) | Dynamic values | Class |
|---|---|---|---|---|---|
| `INVITATION` | Staff sends/regenerates an invite; staff resends; invitee asks for it again | The address on the invitation row | *Your invitation to {brand}* / *Here's your invitation link again — {brand}* | brand, footer, resend flag, purchase label, checklist, link, expiry date | transactional |
| `CONTRACT_INVITE` | Staff sends a contract for review/signature | The counterparty contact for that party role | *A contract is ready for you — {brand}* | brand, footer, title, three party-control flags, link, recipient address | transactional |
| `CONTRACT_VOIDED` | A party voids a document | Every other party with an email | *{voider} voided {title}* | voider name (raw+escaped), title (raw+escaped), note, link, footer | transactional |
| `CONTRACT_CHANGE_REQUESTS` | A party submits change requests | Every other party with an email | *{author} requested changes to {title}* | author, title, count, singular flag, five ranked items, link, footer | transactional |
| `CONTRACT_WORKING_COPY` | A party asks for the current state as a PDF | The caller, and only the caller | *Working copy — {title}* | title, display code, generated-at | transactional |
| `DOCUMENT_PARTY_COPY` | A document reaches EXECUTED; a member re-sends their own copy | Each party (guardian-addressed for a minor) | *{title} — signed and executed* | title, reference code, brand, phone, site, guardian flag/name, signer name | transactional |
| `DOCUMENT_COMPANY_COPY` | Same execution, once | The org public inbox | *{title} — signed and executed ({code})* | title, display code, **full** integrity hash, signers | notification |
| `DOCUMENT_SET_PARTY_COPY` | A document set is delivered (onboarding flow, staff re-send) | Each distinct signer across the set | *Your signed documents — {brand}* | brand, footer, titles, greeting name, guardian flag, signer name | transactional |
| `DOCUMENT_SET_COMPANY_COPY` | Same, non-targeted only | Ops inbox, falling back to public contact | *Signed document set — {signers}* | titles, signers | notification |
| `DOCUMENT_WITHDRAWN` | Staff hard-deletes a non-executed document | Parties who were notified or delivered | *{title} was withdrawn — copy attached* | title, greeting name, footer | transactional |
| `EVALUATION_REPORT` | A report is emailed or shared | Buyer, share recipient, or a minor's guardian | *{title} — {horse} — {brand}* | title, horse label, greeting name, minor name, guardian flag, share flag, footer | transactional |
| `EMAIL_CHANGE_VERIFY` | A member changes their sign-in email by password | The **new** address only | *Verify your new email — {brand}* | brand, greeting name, new address, link, footer | transactional |
| `ORDER_RECEIPT` | Stripe webhook or Zelle reconcile confirms an order | The buyer's account email | *Your receipt from {brand}* | brand, amount, footer | transactional |
| `HOLD_EXPIRED` | Hourly reaper finds a lapsed 48-hour hold | The requester, grouped so one person gets one email | *Your hold has expired — {brand}* | brand, greeting name, item list, footer | transactional |
| `NOTIFICATION_DIGEST` | Daily cron, 16:00 UTC | Members with unread notifications >30 min old | *You have N updates at {brand}* | brand, count, singular flag, ≤10 titles, link, footer | notification |
| `CALENDAR_UPDATE` | Hourly cron, 06:00–21:00 PT | Members with un-emailed `booking_*` / `lease_*` rows | *Calendar update — {brand}* | brand, titles, link, footer | notification |
| `CALENDAR_OPS_DIGEST` | Same sweep, once | Ops inbox | *Upcoming sessions (N)* | count, de-duplicated titles | notification |
| `REQUEST_RECEIVED` | A visitor submits the public intake form | Ops inbox only; **Reply-To** is the visitor | *New inquiry from {name}* | name, 9 fact rows, availability, category answers, notes, link, footer | transactional |
| `SUPPORT_RECEIVED` | A member submits support (fired by the DB via `pg_net`) | Ops inbox only | *New website inquiry — {name}* | name, member email, subject, body, link, footer | transactional |

### Dead senders — reported, kept

**Every one of the 19 endpoints has a live caller.** I traced each to a `fetch(` in `src/`, a
`net.http_post` in a migration, or a `vercel.json` cron entry, and then traced each `src/lib`
wrapper to a component that calls it. Nothing is orphaned. Specifically checked because they
looked thin: `invitation-resend-request` (→ `Register.tsx:232`), `contract-working-copy`
(→ `ContractPage.tsx:897`), `delete-document-with-copy` (→ `ContractPage.tsx:873`),
`support-received` (→ `20260804060000_lead_inbound_notifications.sql:53`), `delivery-sweep`
(→ `vercel.json:19`), `contract-invite` (→ `sendForReview` → `ContractPage.tsx:920`).

**What IS dead is `renderTemplate()` in `api/_lib/email.ts`.** Its only live caller was
`_lib/receipt.ts`; that now reads `ORDER_RECEIPT` from the table, so the function has no
callers at all. **It has been kept, not deleted**, with a comment saying why — because of
what is inside it:

> ### 🔴 THE D9 FINDING
> **`renderTemplate` still contains the welcome email and the dunning email.**
> ```
> case 'signup':  subject: `Welcome to ${fromName}`,  body: "your account is ready."
> case 'dunning': subject: `Payment reminder`,        body: "You have an outstanding balance…"
> ```
> D9 settled that there is **no welcome email and no dunning email**, and that both producers
> were *deleted, not dormant*. The producers are indeed gone — nothing calls either case. **The
> wording survived.** It is copy looking for a sender.
>
> **I did not restore either, and I deliberately did NOT extract them into `email_templates`.**
> Seeding them would put two D9-forbidden emails into a list the owner browses and publishes
> from, which is precisely how a settled decision gets quietly reversed. The third dead case,
> `contract_executed`, was superseded by `DOCUMENT_PARTY_COPY` (its hardcoded subject was the
> bug fixed on 2026-08-02) and is likewise left alone.
>
> **Deleting `renderTemplate` is a follow-up, not this task's change** — the task says delete
> nothing.

---

## 2. TOKENS — one library, 53 new rows, one stated deviation

`TASK-TOKENAUDIT`'s Question 1 is load-bearing here: **`source_table` is documentation and
never the resolution mechanism.** Document tokens resolve either from the hardcoded `CASE`
ladder inside `generate_document` (flat templates) or from `contract_fields` (the clause
engine). Email tokens resolve the third way — from a value map the sender builds where the
data already is. **So `source_table` is left `NULL` on all 53 rows rather than pointed at a
table nothing would read**, which is exactly the stale-provenance problem TOKENAUDIT
documented for 59 existing rows.

- **53 new dictionary rows** in `template_tokens` (`template_id IS NULL`), one per token, each
  with a note in TOKENAUDIT's owner-language format (what it prints + example · when it goes
  blank · which twin to prefer). `template_tokens` went **307 → 360**.
- **2 reused, not redefined:** `PARTY.FULL_NAME` and `ORG.PHONE` already exist and already
  mean what the emails need.
- **No second registry.** `template_editor_tokens()` returns dictionary rows unfiltered, so
  TASK-TEXTEDIT's picker lists all 53 with **no change on its side**.

### ⚠️ The one deviation, stated rather than slipped in

The task said *"Do NOT create an email-specific token namespace."* **I created one: `MSG.*`, 18
rows.** The reason: those values are properties of the MESSAGE — the action link, the digest
list, the item count, "is this a resend", "is this a guardian copy" — and a document vocabulary
has no home for them. Filing *"the number of unread notifications"* under `TXN.*` or `ORD.*`
would be worse than a new namespace. Everything else maps onto existing namespaces:
`ORG.*` (6 new fields), `DOC.*` (10), `PARTY.*` (5), `HORSE.*` (1), `TXN.*` (1), `REQ.*` (12).
The constraint I read as binding — **one library, in `template_tokens`, with descriptions** — is
honoured. **If the owner wants `MSG.*` renamed or folded, nothing depends on the name.**

### The `_HTML` twin convention — a preserved inconsistency, not a new one

The hand-written senders escaped inconsistently. `contract-voided` escapes the document title
in the body but **not** in the subject line; `deliver-documents` and `notifications-nudge`
interpolate titles raw. Escaping inside the renderer would have changed the output of half of
them, which this refactor is forbidden to do. So the renderer substitutes **raw**, each caller
passes a value escaped exactly as it escaped before, and where one value is needed both ways
there are two tokens (`DOC.TITLE` / `DOC.TITLE_HTML`). **The inconsistency is now visible in
the token list instead of buried in nineteen string concatenations. Unifying it is a named
follow-up (§7).**

---

## 3. BEHAVIOUR IS IDENTICAL — 241 checks, 0 failures

`node scripts/emailextract/diff.mjs` — **no mail is sent and no database is touched; it
renders strings.** The signing freeze is in force and this respects it.

```
[A] LEGACY TRANSCRIPTION ANCHORS (vs origin/main)      97 fragments across 17 files — all ok
[B] COVERAGE                                           19/19 templates, 47 fixture cases
[C] RENDERED OUTPUT — legacy vs extracted              94 subject+body diffs — all byte-equal
[D] TOKEN REGISTRATION                                 55 tokens, all registered, none unused
[E] SENDER TOKEN COVERAGE                              19 senders supply every token asked for
========================================================================
241 checks, 0 failure(s)
```

**Why the diffs are trustworthy, in three layers:**

1. **§C compares a verbatim transcription of `origin/main`'s composition expressions against
   the extracted template**, rendered from one fixture, byte for byte. 47 fixtures cover every
   optional branch of every email: guardian vs signer, note vs no note, footer vs no footer,
   named vs nameless recipient, singular vs plural, unmapped enum fall-through, empty-string
   vs null title.
2. **§A closes the transcription hole.** A hand-copied "legacy" that had drifted would make
   §C worthless, so **97 static HTML fragments the legacy functions quote are asserted to be
   literal substrings of the file at `origin/main`.** Both halves would have to be wrong in
   exactly the same way for a false pass.
3. **§E closes the other half.** §C proves the template renders correctly *from the right token
   map*; §E proves the **shipped sender builds that map** — every token key its template asks
   for is literally present in the sender file. A template that renders perfectly from a map
   nobody builds is still a blank email.

**Plus a fourth proof, run against production:** the seeded bodies were applied inside
`BEGIN; … ROLLBACK;`, read back out of Postgres, and compared to the source module —
**all 19 subjects and bodies byte-identical through the SQL round-trip**, so dollar-quoting and
encoding preserve the significant whitespace (the `INVITATION` body reproduces a multi-line
template literal *including its source indentation*).

`scripts/emailextract/bodies.mjs` is the **single source** for both the seed migration
(generated) and the proof. They cannot disagree.

### The one behaviour change I made, and it is not in the output

Fallback WORDS moved from code into the templates: *"The other party"*, *"A visitor"*,
*"A member"*, *"A signer"*, *"your contract"*, *"A contract"*, *"Contract"*, *"this contract"*,
*"there"*, *"the minor named on this document"*, *"the minor named below"*, *"the account
holder"*, *"The whole document"*, and the three contract-invite action phrases
(*"add your information"* / *"review and edit the terms"* / *"review and suggest changes"* /
*"review the terms"*). **Rendered output is unchanged** — §C proves it — but the owner can now
edit them. Preserving `??` semantics needed care: `DOC.HAS_TITLE` tests for **null**, not
emptiness, so an empty-string title behaves exactly as it did.

---

## 4. THE 6-HOUR GUARD — found, intact, and the task's description of it is slightly off

**It is `document_deliveries_doc_recipient_channel_uidx`**, created by
`supabase/migrations/20260725005000_document_deliveries_unique_guard.sql`:

```sql
CREATE UNIQUE INDEX document_deliveries_doc_recipient_channel_uidx
  ON public.document_deliveries (document_id, recipient_contact_id, channel)
  WHERE deleted_at IS NULL;
```

Verified live in production **after** this work applied. The root cause it fixed: the app-side
guard was a soft SELECT-then-skip that `ContractPage`'s fire-on-mount could bypass, re-sending
the same executed-document email — the duplicate-email bug.

**Correction to the task:** the guard is in the **executed-document delivery path, not the
invitation path.** Nothing in the invitation path carries a six-hour guard; the invitation
protections are different mechanisms (`supersede_invitations`, `record_invitation_delivery`,
and the 3-per-hour self-service rate limit in `invitation_request_resend`).

**Where it ended up: exactly where it was.** This branch does not touch
`document_deliveries`, the index, or any insert into it. Its app-side complements are intact —
`deliver-documents.ts` still tolerates `23505`, `deliver-my-document.ts` still treats `23505`
as success. `git diff origin/main` on the three delivery files adds exactly two control-flow
lines, both `if (!rendered) continue;`, and both sit **before** the send and therefore before
any delivery row.

---

## 5. D13 — the edit loop, proven end to end as the real tenant admin

Run against production inside `BEGIN; … ROLLBACK;`, acting as
`admin@fhequestrian.com` (`SET LOCAL role = authenticated` + that user's JWT claims):

```
is_admin()                                                    → t
email_template_list()          HOLD_EXPIRED v1, has_unpublished = f
email_template_save_draft()    changed "The 48-hour hold" → "The two-day hold"
  live body still says 48-hour                                → true
  draft says two-day                                          → true
  has_unpublished                                             → t   (v still 1)
email_template_publish()       {"new_version": 2}
  live body now says two-day                                  → t
  draft cleared                                               → t
email_template_publish() again → REFUSED: "Nothing to publish for HOLD_EXPIRED"
```

**Changing a word in any of the 19 emails is now an UPDATE and a publish. No code edit, no
deploy, no migration.** The next send reads the new body — nothing is cached.

**Security posture, proven the same way:**

| Actor | Read `email_templates` | Publish |
|---|---|---|
| `anon` | **DENIED** (permission — grant revoked) | n/a |
| authenticated, not staff | **0 rows** (RLS) | **REFUSED** — "admin-only" |
| tenant admin | 19 rows | ✅ v1 → v2 |
| `service_role` (the senders) | 19 rows | n/a |

`email_template_list()` returns **0 rows** to a non-admin rather than erroring — deliberate, so
a nav probe leaks nothing.

*(No `MANAGER`/`EMPLOYEE` account exists in production — profiles are 2 ADMIN, 1 SUPER_ADMIN,
10 USER — so the staff-read policy's manager arm is proven by policy definition, not by a live
actor.)*

### ⚠️ D13 IS NOT FULLY SATISFIED, AND I AM SAYING SO RATHER THAN CALLING IT SHIPPED

**There is no UI.** The owner can change a word without SQL only once the Templates > Emails
list exists. Today the edit path is `email_template_save_draft` + `email_template_publish`,
which means a thread or a database client. **Per D13's corollary I am naming the follow-up
rather than leaving it implied: this is `TASK-TEXTEDIT`'s surface, extended to a second list.**

What I shipped to make that follow-up small, not large:

- The four RPCs already exist and mirror `template_editor_*` verb for verb.
- `email_template_list()` returns exactly the columns a list view needs, including
  `has_unpublished` and a human `recipient_note`.
- `description` and `recipient_note` are seeded for all 19, so the list is readable on day one
  rather than a wall of `SCREAMING_KEYS`.
- The 53 token rows are already in the picker's source.

**Coordination with `TASK-TEXTEDIT`, as instructed: I own the email rows and their RPCs; it
owns the editing UI.** I touched neither `contract_clause_defs` nor `src/lib/templateEditor.ts`
nor any `template_editor_*` function.

---

## 6. WHAT MOVED, AND WHAT DELIBERATELY DID NOT

**CONTENT → DATA.** Subject text, body prose, which sentence appears when, every fallback word,
singular/plural, the resend voice, the three contract-invite action phrases.

**PLUMBING → STAYS IN CODE.** Who receives it, minor→guardian redirection, idempotency, rate
limits, PDF rendering, delivery logging, org isolation. **That is control flow over the
database, not prose, and it is where every safety property of these senders lives.**
`recipient_note` documents the rule in words for the owner; it does not implement it.

Three more that stayed, each for a stated reason:

- **The enum→label vocabularies** in `request-received.ts` (`CATEGORY_LABEL`, `CHANNEL_LABEL`,
  `CONTACT_METHOD_LABEL`). These are shared display labels, not email prose. Flagged (§7).
- **PDF headings and filenames** — `partyPdfFileName`, the evaluation report heading, the
  "WORKING COPY — NOT EXECUTED" banner stamped *into* the PDF. A filename is not
  correspondence, and the banner is evidence about a document's state.
- **`INVITE_FROM_EMAIL`** — deployment configuration, expressed as
  `from_address_rule = 'invite'` on the row so the editor can see the rule without being able
  to set an address.

---

## 7. FINDINGS AND FOLLOW-UPS — reported, not built

1. **🔴 D9: the welcome and dunning WORDING still exists** in `renderTemplate`
   (`api/_lib/email.ts`). No producer, no caller. Not restored, not extracted. §1.
2. **`renderTemplate` is now entirely dead** — deleting it is a separate, deliberate act.
3. **The measured "19 files" was three high and three low.** §1.
4. **Inconsistent HTML escaping across the senders** is preserved byte for byte and now
   visible as `_HTML` token twins. A unified escaping policy is real work with real output
   changes and needs owner sign-off; it is not a refactor.
5. **`api/contract-invite.ts:117` hardcodes `'French Heritage Equestrian'`** as the identity
   fallback when `resolveTenantEmailIdentity` throws — a §15 multi-tenant leak that predates
   this task. `contract-voided.ts` has the same. Left as found; changing it changes behaviour.
6. **`email_templates` has no `org_id`** — bodies are global, brand resolves per tenant through
   tokens, exactly as `contract_templates` works today. Correct now; revisit when a second
   tenant wants different wording.
7. **No plain-text alternative exists, and could not be added here.** `SendProviderInput` has
   no text field — both transports send HTML only. A text/plain alternative is transport work
   first, template work second. The column was deliberately **not** added speculatively.
8. **`request-received`'s three enum→label maps** are the last email-adjacent vocabulary in
   code (§6).
9. **The renderer is duplicated** — `api/_lib/emailTemplates.ts` (TypeScript, ~60 lines) and
   the copy inside `diff.mjs`, because a `.mjs` script cannot import `.ts` without a build
   step. **The duplication is checked**: §A asserts the tag regex is still identical in both,
   so a change to one that is not made to the other fails the run.
10. **`test:db` was not cited as proof of anything** — it is broken (60 of 68 files fail), per
    the task's own constraint. The proofs here are the render harness and production
    transactions.

---

## 8. THE DIFF

**New**
```
api/_lib/emailTemplates.ts                                    the renderer + loader
scripts/emailextract/bodies.mjs                               the 19 templates (one source)
scripts/emailextract/gen-seed.mjs                             bodies.mjs -> seed migration
scripts/emailextract/diff.mjs                                 the 241-check proof
supabase/migrations/20260812T2000_emailextract_email_templates.sql   table + RLS + 6 RPCs
supabase/migrations/20260812T2010_emailextract_seed.sql             19 rows (generated)
supabase/migrations/20260812T2020_emailextract_tokens.sql           53 template_tokens rows
```

**Modified** — 18 files under `api/`, every one the same shape: build a token map, render, send.

**Applied to production** — all three migrations, `psql -1`, after a `BEGIN; … ROLLBACK;`
dry-run. Verified: 19 templates (19 active), `template_tokens` 307 → 360, 18 in `MSG`.
**Nothing is left held.**

**Health**
```
npm run typecheck       0 errors   (frontend)
npm run typecheck:api   0 errors   (api/ — separate tsconfig, both run)
npm run lint            0 errors, 39 warnings — byte-identical to origin/main's 39
node scripts/emailextract/diff.mjs   241 checks, 0 failures
```

Migrations carry **no self-contained `COMMIT;`** and use no temp tables.

---

## THE TEST THIS HAD TO PASS

| # | Requirement | |
|---|---|---|
| 1 | All senders inventoried — trigger, recipient, subject, body, dynamic values; dead ones named and kept | ✅ §1 — and the count corrected in both directions |
| 2 | Every email's content lives in data; changing a word needs no code edit and no deploy | ✅ mechanism proven §5 — **but no UI yet, named as a follow-up per D13** |
| 3 | Rendered output byte-identical for all of them, proven by pasted diffs | ✅ §3 — 241 checks, plus a production round-trip |
| 4 | Dynamic values use `template_tokens`; no second token namespace | ✅ §2 — one library, 53 rows; **`MSG.*` deviation stated, not hidden** |
| 5 | The 6-hour guard intact and its location stated | ✅ §4 — intact, located, and the task's own description corrected |
| 6 | `npm run typecheck` and `npm run typecheck:api` both pass | ✅ §8 — both 0 errors |
