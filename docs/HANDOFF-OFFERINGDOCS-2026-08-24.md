# HANDOFF — OFFERINGDOCS / INTAKE thread, 2026-08-24

**Written to survive a context compaction.** Everything this thread ruled, built, found, broke,
repaired and left undone. Nothing here needs the conversation to make sense.

**State at close:** all work is **merged to `main` and pushed** — `main` = `70d577fe`.
23 commits, **22 migrations applied to production**. `typecheck 0 · typecheck:api 0 · lint 0
errors · full build clean`. Branch `task/dealparty` still exists at `71993bb2` (fully merged, safe
to delete).

---

## 0. HOW THIS THREAD STARTED

It began as `TASK-PAMELA` (a Save button on the provisioning form, and the horse fields a contract
needs). That work was completed, audited by ORCH4 and merged as `bc244e13` **before** this
thread's own work began — see `docs/reports/TASK-PAMELA-REPORT.md`. The ORCH4 audit found two real
misses in that report, both since fixed:

- `f298fec1` — the save path left `UPDATE requests SET status='invited'` **ungated on `p_send`**,
  so a SAVE still flipped the lead to invited and dropped them out of `dash_people_waiting()`.
  The report claimed otherwise; that was true of the UI and false of the RPC.
- `3b46419f` — a "Barn name" grep was **scoped to the contract path** instead of repo-wide. Four
  occurrences exist; one was live in `HorseRecordsPage`.

**Lesson carried forward: grep repo-wide before claiming a count, and check the RPC as well as the
UI before claiming a behaviour.**

Everything after that grew out of one question the owner asked about that work — *"why does a deal
party get four required documents?"* — which unwound the whole category model.

---

## 1. THE MODEL — owner rulings, 2026-08-24

These supersede the previous category/tag behaviour. Cite this section.

1. **The account is the spine.** No tag is required for an account to exist. A person can exist as
   a record with nothing attached.
2. **Tags DESCRIBE; they never obligate — and staff never tick one.** Tags are derived, from a
   purchase, a file, a record (a horse), or a contract.
   > *"those tags are auto set by the purchase, the existence of a file, or the existence of a
   > record. so in the case that a person is added, i dont check any boxes for their tagging they
   > just exist as an account."*
3. **`DEAL_PARTY` is a derived tag** — from holding a contract role, never picked. Admissible
   under D31 for D31's own reason: it is derived, not chosen at account creation.
4. **The onboarding paperwork comes from the OFFERING, not the tag.**
   > *"the tagging is just for us to know what type of services or relationship they have with us
   > and it helps inform the onboarding which is a mistake. the onboarding should be informed by
   > the offerings not a tag."*
5. **A PURCHASE obligates; a tag only proposes.** Documents come from the **service** bought, or
   from the **door** the person came in by (`/sign/<path>`).
6. **Documents arrive when the ORDER OPENS**, not when a line hits a cart.
   > *"if implemented literally it means they select something from the catalog and instantly get
   > routed to a set of docs. The docs should just appear as a task when the order is placed...
   > once we approve the request and their offering is scheduled the docs get triggered."*
7. **An offering supersedes the contract in ordering.** Offering documents are signed *before* the
   contract and emailed as their own set; contract-role documents come *after* execution and go
   out with the contract as one email.
8. **WHEN a document is due is a property of the ASSIGNMENT, not the template**:
   `AT_LOGIN` · `WITH_CONTRACT` · `WHEN_READY`. The third is new — surfaced at every sign-in,
   dismissable, never blocking.
9. **LESSOR and SELLER owe nothing by default.**
   > *"they only get those documents if i want them to get them, not by default."*
10. **GUEST is decided by the VISIT, not by a tag.** A visitor has no purchase, no horse, no
    contract and no file, so nothing can derive the tag for them — which means the tag cannot be
    what requires their documents. `/sign/guest` assigns the visitor set directly.
11. **Every account holder gets the community feed.** Restores D8 — community access is gated by
    ACCOUNT, never by having bought something.
12. **The evaluation lesson is the first purchase.** Gold-outlined, gated first; everything else
    greyed but readable until it is added. Reverses the July decision that folded it into a
    Single Lesson.

---

## 2. WHAT SHIPPED

### 2.1 The paperwork model
- **`service_type_document_requirements`** — 48 rows across 12 service types, owner-editable.
  Seeded faithfully from what the app assigned before, plus **three rules that had been hardcoded
  in function bodies** (`RELEASE_HORSE_EXERCISE`, `RELEASE_JUMPER_ADDENDUM`,
  `EVALUATION_LIABILITY_WAIVER`).
- **`sign_path_document_requirements`** — each self-service door carries its own set.
- **`apply_offering_documents(contact, disposition)`** is the writer;
  `trg_documents_when_order_opens` fires it on the `draft → open` purchase transition — the same
  seam where credits already mint (D23).
- **Two edges from tag to obligation were cut, not one.** Removing `derive_affiliations`' ticked-box
  branch left a ticked RIDER still assigning four documents, because `_ensure_client_account`
  called `apply_category_documents` **directly**, on a path that never goes through
  `derive_affiliations`. Both are gone. `apply_category_documents` survives, callable, with no
  caller that turns a category into paperwork.
- **`contact_required_documents.disposition`** added and backfilled behaviour-preserving.
  `contact_document_wall_state` reads the assignment instead of `contract_templates.wall_gating`.

### 2.2 Onboarding and intake
- **The onboarding flow could not surface without documents.** `my_onboarding_state` set `needed`
  only inside the loop over required documents — so a member with nothing to sign never saw the
  intake form and we never learned their phone, DOB or emergency contact. Since OFFERINGDOCS,
  having no documents is the *normal* state. Now it surfaces on an incomplete profile.
- **One mobile number.** `phone` relabelled everywhere (21 rows had it, `mobile` had 2 — one a
  duplicate, one Pamela's only number with `phone` empty, so her contract tokens printed blank).
  `mobile`/`mobile_ext`/`phone_ext` left the editor, columns retained.
- **New:** `contacts.text_only_phone`, plus `preferred_contact` finally asked for.
- **Signing ends at a shop** with the evaluation lesson gated first; booking skipped on the first
  pass; recoverable afterwards from a self-hiding dashboard card driven by
  `my_first_lesson_state()`.

### 2.3 Email
- **Every email was unstyled** — `email_templates.body` holds a *fragment*, and `renderEmail`
  handed it to the provider as the whole document. All 22 were bare. A branded shell now wraps
  them in `renderEmail`, the one place they all pass through. Content unchanged.
- **Asking for documents now tells the person**: `/api/documents-requested` sends immediately
  (dashboard notification + email). Previously the email rode `NOTIFICATION_DIGEST`, a daily cron
  that **has never actually run on this project**.

### 2.4 Documents and PDFs
- **An adult's liability release was naming them as a minor.** Fixed — see §3.
- **Orphaned headings**: 9 across four documents, now 0, with no document gaining a page.
- **The signature block is never alone on a page** — it and the closing text lay out as one unit.
- **Margins 0.75" → 0.64"**, as asked. *Honest note: once the keep-group rule is in, the margin
  reduction does not save Company Policies its page. The document is the same length, laid out
  correctly instead of accidentally.*
- **Unsigned documents no longer show `{{SIG.*}}`** — the date renders as today's date, the
  signature as empty space.
- **PDF filenames carry the person and the tenant again.** They never had it on the SET path,
  which is what a new member actually receives.

### 2.5 Community
- **`my_purchase_categories` never read `groups`** — so a rider who had signed everything and not
  yet purchased got `has_feed: false`, and `Home` redirected them to the dashboard. Both symptoms
  the owner reported were that one redirect.
- **Then the guard was removed entirely** — every account holder gets feed + community.

---

## 3. DEFECTS FOUND — cause, evidence, fix

| # | Defect | Root cause | Status |
|---|---|---|---|
| 1 | Adult's release printed a **MINOR PARTICIPANT** block with their real DOB, certifying them as their own guardian | `v_has_minor` = "a PARTICIPANT party exists", but both generators add `coalesce(v_minor, v_contact)` — the person themselves when there is no minor. **Regression dated 2026-07-29**, when a fix to one function silently invalidated a predicate in another | **Fixed.** Predicate now asks "is the participant someone *else*?" Covers all five templates carrying the marker |
| 2 | `attach_first_purchase_policies` assigned a hardcoded COMPANY_POLICIES to a **draft cart** | A trigger on `purchase_items` INSERT, bypassing the requirements table entirely | **Retired** (trigger removed, function kept) |
| 3 | `RELEASE_HORSE_EXERCISE` seeded as a live requirement | **Soft-deleted 2026-07-05.** An obligation nobody could satisfy and no surface could show | **Fixed**, and both requirement tables now refuse a template with no active version |
| 4 | `request_documents_from_contact` accepted an unknown template | No guard | **Fixed** |
| 5 | Onboarding invisible to anyone with no documents | `needed` set only in the document loop | **Fixed** |
| 6 | Community feed unreachable | `my_purchase_categories` read purchases + `contacts.tags`, never `groups` | **Fixed**, then the guard was removed entirely |
| 7 | `MEDIA_RELEASE` still named in two function bodies | Retired as a standalone doc; the key lived on in a hardcoded ordering array | **Fixed** — the onboarding running order is now a column |
| 8 | `/sign/*` confirm-email never validated | `emailsMatch` was computed and **not used in the submit guard** | **Fixed** |
| 9 | `/app/care` and `/app/deal` orphaned since 2026-08-12 | Reachable only by a redirect no account has ever satisfied; linked from nowhere | **Named**, absorbed into the HOMESHAPES plan |

### ⚠️ 3.1 A REGRESSION THIS THREAD CAUSED — read this one

Migration `20260824T1220` removed `_ensure_client_account`'s `apply_category_documents` call —
correctly. Its replacement (`api/sign-start.ts` calling `apply_sign_path_documents`) **was in
unpushed code while production ran `main`.** For roughly four hours, **every `/sign/*` signup got
an account with zero documents and zero tags.** Caught by the owner testing `/sign/rider`.

Fixed by making the database self-sufficient (`_sign_path_for_categories` resolves the door from
the category set the deployed endpoint sends) rather than merely shipping the code, and the one
affected account was repaired by a narrow idempotent backfill.

**NEVER APPLY A MIGRATION THAT DEPENDS ON CODE WHICH HAS NOT SHIPPED.**

---

## 4. TRAPS HIT — worth carrying into any future thread

1. **`CREATE OR REPLACE` with a new defaulted argument OVERLOADS, it does not replace.** Hit
   twice on `apply_offering_documents`. Two functions answer to one name and a call becomes
   ambiguous. Drop the old signature explicitly.
2. **A migration file containing its own `BEGIN;…COMMIT;` cannot be wrapped in a dry-run
   transaction** — the inner COMMIT closes the outer one and it applies for real. This happened
   with `20260824T1100`/`1110`.
3. **`contact_required_documents` reads return ZERO rows under RLS even for an admin.** The rows
   exist; `RESET ROLE` to see them. Nearly reported working document assignment as broken.
4. **`typecheck` and `lint` do not catch an invalid Tailwind utility inside `@apply`** — only
   `npm run build` does. `text-secondary/60` is not a real class here. **Run the build for
   anything touching `index.css`.**
5. **One flag carrying two meanings is this codebase's signature defect.** Three instances in one
   day: `wall_gating` (template vs assignment), `has_feed` (see the community vs have a
   purpose-built home), `v_has_minor` (a PARTICIPANT exists vs the participant is someone else).
   Each worked until the two meanings diverged. **A standing sweep for this pattern is
   recommended and not yet done.**
6. **Verification style:** the PDF layout fixes were verified by *replaying the layout arithmetic*,
   not by reading text back out of a rendered PDF (pdf-lib cannot extract text). Same maths,
   different code — a strong check, not a proof.

---

## 5. OUTSTANDING WORK

### 5.1 Committed but unbuilt — `TASK-HOMESHAPES`
Spec: `docs/tasks/TASK-HOMESHAPES-four-account-types-one-composable-home.md`.

Four account shapes on **one composable dashboard of zones**, not four pages — a person is several
of these at once, and four homes force a question with no correct answer. Audit result:

- **Riders** — every bullet already has a live read. Surfacing job.
- **Deal parties** — every bullet already has a live read. Surfacing job.
- **Horse owners** — covered except one: **nothing returns a horse's upcoming appointments.**
  `bookings` + `fulfillment_units` carry it; a read must be written.
- **Parents** — **the real gap.** Eight functions mention `guardian_contact_id`; not one reads a
  dependent's activity. Every member read is scoped to `current_contact_id()` with no
  dependent-scoped variant. A parent can see their own lessons and nothing about the child they
  are paying for.

**Open decisions for the parent shape — ONE REMAINS.**
- ~~who may see what~~ **SETTLED, owner 2026-08-24: "we dont have adult dependents."** A dependent
  IS a minor, so the `guardian_contact_id` link alone is sufficient authority — no age test, no
  permission layer. Verified in production: exactly one dependent exists (Gabriella Olenik, DOB
  2013), and she is a minor. Preserve C10: `is_minor_contact` keeps a minor from being emailed
  directly, so a parent zone must read the child's activity without becoming a second path that
  mails the child. D8's linked-accounts item is a different feature (adults sharing a record).
- ~~whether a parent authors notes~~ **SETTLED, owner 2026-08-24: parents CONTRIBUTE, and entries
  are stamped with who wrote them.** The stamping already exists — `booking_notes` carries
  `author_user_id`, `author_role`, `author_name`. The gap is the vocabulary:
  `booking_notes_author_role_check` admits `rider · instructor · staff · admin` and has **no
  guardian role**. Build = widen the CHECK, let a guardian write on a dependent's booking, and
  render three names (parent as guardian, child as rider, Claire as instructor).
  ⚠️ *"contribute to everything their dependent has access to or does"* is broader than notes —
  booking, documents and purchases are in scope by that sentence. Scope it deliberately.

**AND A SEPARATE RULING, same message — THE TRAINER IS ALWAYS CLAIRE.** *"there is no need to
select a trainer when a lesson or any other service is scheduled."* Verified: two tenant staff
identities exist (Claire and CJ, both Owner; the third is the platform owner, D1a), and **527
bookings have no instructor at all** vs 11 Claire and 1 CJ — the selector is already skipped more
than used, losing attribution each time. **Default the field, do not remove it** (it is the
attribution and D7 reads it); remove the CONTROL from seven files. Do NOT hardcode her user id —
that is the MEDIA_RELEASE class; it belongs in tenant settings. The 527 unattributed bookings are
a separate call: backfilling asserts she taught lessons nobody recorded.

### 5.2 ⚠️ CORRECTED — "sharing captured content" is NOT a new product

**Owner, 2026-08-24, correcting an earlier assumption in the HOMESHAPES spec:**

> *"the community feed is the sharing location, the path exists thats why there is content in
> there, capture is a reference to them filming their child with their phone then posting it to
> the feed we arent involved in capture we dont do photo editing we just let them post pictures
> and videos with constraints and compression built into the controls for that surface so things
> run smoothly, look professional, and dont get out of control in storage costs."*

**So the sharing path EXISTS and works.** We are not involved in capture, and we do no editing.
The work is **constraints and compression on the posting control**, for three stated reasons:
run smoothly · look professional · storage costs stay controlled.

**What exists today, verified:**
- `src/components/app/CreateModal.tsx` is the composer — `accept="image/*,video/*"`, uploading via
  `uploadFeedMedia`.
- It **already converts non-mp4 video to mp4 in-browser** before upload (line ~130).
- Bucket `feed-media` is **public**, with `file_size_limit = 26214400` (25 MiB).

**What is missing:**
- **No `allowed_mime_types` on the bucket** — the storage layer accepts anything. `accept=` in the
  browser is a hint, not a control.
- **No image compression or resize.** A modern phone photo is 4–12 MB and 4000px wide; it is
  uploaded, stored and served at full size to every reader. This is the storage-cost item.
- **No dimension cap** and no thumbnail/derivative — the feed serves originals.
- **No video duration or resolution cap** — only the 25 MiB ceiling and the container conversion.
- **Every other bucket has NO size limit at all** (`horse-photos`, `profile-images`, and nine more).

**Recommended build:**
1. **Client-side image compression before upload** — canvas resize to a max long edge (~2000px)
   and re-encode (WebP with JPEG fallback, quality ~0.82). Typically 10–20× smaller with no
   visible loss at feed size. This is the single biggest cost lever.
2. **Video constraints** — cap duration (60–90s) and long edge (1080p), reject beyond it with a
   clear message rather than a silent failure. Keep the existing mp4 conversion.
3. **Bucket `allowed_mime_types`** on `feed-media`, and a size limit on every bucket that has
   none — the browser `accept` attribute is not a security control.
4. **A displayed derivative** — store a feed-sized image alongside the original so the timeline
   never serves a 12 MB file into a scroll.
5. **State the limits in the control** before someone picks a file, not after the upload fails.

### 5.3 Smaller items, all named and none started
- **The automatic order-approval path raises the dashboard notification but sends no email** — a
  database trigger has no mail transport. Wiring it means the staff action that opens the order
  calls `/api/documents-requested` after it succeeds.
- **The minor-variant document redesign.** Owner: for a real minor the signature block should
  carry the **parent's** details labelled *Guardian*, and the minor section should name them a
  **dependent**. The block as written serves neither an adult nor a minor properly. The CUT
  mechanism already supports a `GUARDIAN` variant on the same condition — no new machinery needed,
  only the wording, which is the owner's to direct.
- **`lookup_options` has no editor anywhere.** Its three vocabularies (33 rows) can only be
  changed by SQL, and the `lookup_suggestions` review queue has no page. **A standing D13 gap.**
- **BUYER's four role-documents are still automatic** — the owner named the lessor and the seller,
  not the acquiring side. Deliberate; confirm if it should change.
- **Re-saving a draft does not update an existing purchase's payment status** — the duplicate-order
  guard reuses the purchase without re-applying `p_mark_paid`. Pre-existing.
- **The owner's four executed test documents still carry the minor block**, because they were
  signed before the fix and a signed document is evidence (D32). New ones are correct. Correcting
  them means a superseding version and a re-sign — the owner's call.

---

## 6. HOW TO WORK IN THIS REPO — the parts that bit

- **Worktrees.** A pre-commit hook refuses code commits in the canonical checkout
  (`fhe-website-app`). Work in `../wt-<name>`. The hook has a documented escape hatch,
  `FHE_ALLOW_CODE=1`, **for the orchestrator's own merge commits only**.
- **A fresh worktree has no `node_modules` and no `.env`.** Symlink
  `../fhe-website-app/node_modules` and copy `.env` / `.env.db` in; **delete the symlink before
  committing**.
- **Migrations**: dry-run in `BEGIN; … ROLLBACK;`, apply, verify with a query, commit — with the
  caveat in §4.2.
- **Testing an RPC as a real user:** `SET ROLE authenticated;` +
  `SET request.jwt.claim.sub = '<user_id>';`. Note `SET LOCAL` inside a `psql` heredoc behaves
  differently from `SET` — several checks in this thread returned misleading results until that
  was corrected.
- **Deploying:** production builds from `main`. Pushing a branch gives a preview only. This is
  what made §3.1 possible.
