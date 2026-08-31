# TASK-FIX1 — the front door, the signature engine, and Evan's four documents

⚠️ **THIS IS A BUILD TASK.** You change code, apply migrations, and prove each one. **Report to
`docs/reports/TASK-FIX1-REPORT.md`.**

**Source of truth: `docs/reports/TASK-AR7-REPORT.md` on branch `task/ar7`.** ⚠️ **Read it first.** It
solved the incident to the microsecond and its 13 findings are the specification. **This file is the
scope, the rulings and the traps — not a replacement for that report.**

---

## 1. WHAT HAPPENED — established, not theorised

**Evan LaBuzetta's contact record was named "Aubrey LaBuzetta" from 20:37:59 until
20:45:41.219249.** All four of his signatures fall inside that window:

```
20:38:03  signup_attempts: "Aubrey LaBuzetta"  ← creates the contact
20:39:52  signup_attempts: "Evan LaBuzetta"    ← the correction, SILENTLY DISCARDED
20:42:15  SIGNED COMPANY_POLICIES        as "Aubrey LaBuzetta"
20:43:35  SIGNED FACILITY_RULES          as "Aubrey LaBuzetta"
20:44:22  SIGNED RELEASE_PARTICIPANT     as "Aubrey LaBuzetta"
20:45:09  SIGNED HUMAN_EMERGENCY_MEDICAL as "Aubrey LaBuzetta"
20:45:41  contact renamed Aubrey -> Evan       ← by Evan, from his own IP, after signing
```

⚠️ **THE SIGNER DID NOTHING WRONG.** `profiles.first_name` follows `contacts.first_name` through
`sync_profile_name_from_contact_trg`, so `Onboarding.tsx:1412` printed *"Type your name exactly as
printed — **Aubrey LaBuzetta** — to sign"* and its exact gate demanded that string. **He typed what
the app instructed. The wall held. The name check held. Both were fed a wrong fact.**

⚠️ **THE BLAST RADIUS IS 4 OF 71, ALL HIS. Measured against each contact as it stood at signing
time, all 71 match.** This is one family, not a general repair. **Do not go looking for more.**

## 2. THE FIXES — in dependency order

### FIX A — `/sign/*` asks the minor question where the NAME is captured
⚠️ **`SignStart.tsx` contains ZERO occurrences of `minor`, `guardian`, `dependent` or `child`.**
Verified. The checkbox the owner remembers is real but lives in **`Onboarding.tsx`** — *after* the
email, the click and the first login. **By then the wrong person already exists.**

**Owner ruling, 2026-08-31 — which paths get it:**
> *"sign/rider and sign/guest … are the only places a minor is applicable. the other two cannot be a
> minor, one is a horse owner for horse care services and the other is horse owner for deal party,
> both require a person to be 18+ to be horse owner."*

⚠️ **THERE ARE FIVE PATHS, NOT FOUR — and the fifth changes the answer.** `PATH_SEGMENTS` declares
`guest · rider · horse · rider+horse · deal`. **`rider+horse` is a rider path** *("let's get you and
your horse set up for riding lessons")*, so **the minor question applies to `guest`, `rider` AND
`rider+horse`.** ⚠️ **The owner said "the other two" believing there were four. Apply his RULE — a
rider may be a minor, a horse owner may not — not his count.** **Say in your report that you did.**

**When ticked, the guardian is the account holder and the minor is the participant** — the shape
`Onboarding.tsx` already implements and `my_onboarding_state` already returns. ⚠️ **Reuse that spine.
Do not invent a second minor concept at the door.**

⚠️ **D22 §0 IS A RECORDED REFUSAL:** the per-path field set is a deliberate constant in the page —
*"i did not intend to invite this type of question and answer set into my life."* **Do NOT back
`/sign/*` with `form_definitions`.** Add the question the same way `PATH_REQUIRES_ADDRESS` varies the
page: a constant beside its siblings.

### FIX B — a resubmission must not be silently discarded
`fill_claimant_details` fills **blanks only**, so Evan's correction 109 seconds later was dropped and
he was told the send succeeded. ⚠️ **Two acceptable answers — choose ONE and justify it:** the later
submission **updates** the name, or the person is **told plainly** it was not applied and how to fix
it. **Silence is the one unacceptable outcome.**

### FIX C — `record_signature` gets the check that already exists next door
⚠️ **`sign_release` ALREADY enforces `lower(v_typed) <> lower(v_name)` server-side.** `record_signature`
does neither that nor attribution, and **every caller passes NULL for ip/ua** — which is why this
incident looked unsolvable until someone read `audit_logs`.

- **Copy `sign_release`'s comparison. Case-insensitive, via `lower()`.**
  ⚠️ **A case-sensitive rule would refuse 4 of 71 LEGITIMATE executed signatures** — `"Brian olenik"`
  and three `"Elisheva fiszer"`. **Verified. Do not break them.**
- **Capture IP and user-agent** — `record_signature` already accepts both parameters.
- ⚠️ **Three code comments assert a server guarantee that does not exist**, including
  `Onboarding.tsx:773`. **Once the check is real, they become true — but find and correct any that
  still overstate it.**

⚠️ **This would NOT have caught Evan's case** — the record genuinely said Aubrey. **It is defence in
depth, not the fix. Do not present it as the fix.**

### FIX D — retire the unchecked signing box in `DocumentsContent`
⚠️ **AR7 EXONERATED THIS FILE and the orchestrator's original premise was wrong.** All 49
`contact_required_documents` rows are `AT_LOGIN`, so the wall makes `/app/onboarding` the only
reachable route while anyone owes paperwork. **Its box has never signed anything.** It is a post-wall
library, not a second corridor.

**So: retire the inline signing box behind a flag (D32 — never delete), and KEEP the page** for
reading, PDF download, email-a-copy and the contract deep-link. ⚠️ **Those four capabilities exist
ONLY here** — `Onboarding.tsx` has none of them. **Losing them is a regression.**

### FIX E — Evan's four documents: SUPERSEDE
**Owner ruling, 2026-08-31.** He asked whether the originals could be edited in place instead.
⚠️ **They cannot, and the reason is load-bearing:** `block_signed_signature_update` raises on any
change to `typed_name`, `signed_at` or `ip_address` once `signed_at` is set — *"use void-and-reissue,
not a direct update."* **That trigger is why executed documents are trustworthy. Do not weaken it,
do not bypass it, do not disable it for four rows.**

- **Re-issue all four**, not only the ones that look wrong. The participant release and the emergency
  medical authorisation are the two that matter legally.
- **The prior four are marked `superseded`, never voided, and RETAINED** (D32).
- ⚠️ **Each superseded document carries a STATED REASON: an application defect, not a signer error.**
  The owner's concern is *"two docs in the system which is ripe for accidentally surfacing the wrong
  one or both."* **Prove in your report that the superseded four cannot surface as current** —
  name the query or guard that excludes them.
- ⚠️ **Rehearse in `BEGIN; … ROLLBACK;` first.** These are executed legal documents belonging to a
  real family.

## 3. OUT OF SCOPE

- The nav sections, Records, Modules/Settings — **`TASK-FIX2` and later.**
- The calendar and the recurring-plan placement — **`TASK-FIX3`.**
- ⚠️ **Madeline Do's orders and any backdating — RULED, and NOT YOURS.** The owner will supply
  timestamps after the fixes land. **Touch no purchase.**
- ⚠️ **Unifying the three initiations end-to-end.** AR7 shows there is already ONE corridor. **Fix
  the door; do not restructure the corridor.**

## 4. CONSTRAINTS

- **Worktree `wt-fix1`, branch `task/fix1`**, from `origin/main`.
  ⚠️ **Copy `.env.db` and `.env` in explicitly** — both gitignored.
- **Migrations:** `BEGIN; … ROLLBACK;` → apply → verify with a query → commit. No self-contained
  `COMMIT;`.
- ⚠️ **A LIVE LEASE IS IN PRODUCTION** — Pamela Godde, `7adcd08f-fd5d-40f9-b726-634074266d7c`.
  **Do not touch it.**
- ⚠️ **`test:db` is 51 files red on `main`** — documented baseline, **nothing may cite it as proof**.
  Lint baseline **48 warnings**. Verify against production with `psql`.
- **The shimmed browser harness** (`test/browser/README.md`) is the honest way to prove a render.
  ⚠️ **Do NOT use the production-login probe.**
- **COMMIT AS YOU GO. DO NOT PUSH.** ⚠️ **TEARDOWN: kill every process you start and paste a census.**

## 5. THE TEST THIS MUST PASS

**Prove each. `ORCHESTRATOR.md` §3 is a table of changes that reported success and did nothing —
never offer the absence of an error as evidence.**

1. `guest`, `rider` and `rider+horse` show the minor question; **`horse` and `deal` do not.**
2. Ticking it produces guardian-as-account-holder + minor-as-participant, **through the existing
   spine** — name the function.
3. A second submission from the same email either updates the name or says it did not. **Paste both
   states.**
4. ⚠️ `record_signature` **refuses** a mismatched name — in `BEGIN; … ROLLBACK;`, paste the exception.
5. ⚠️ It **accepts** `"brian olenik"` against `Brian Olenik`. **Paste the success.**
6. IP and user-agent are stored on a new signature. **Paste the row, not the return value.**
7. `DocumentsContent` no longer offers signing; **reading, PDF, email-a-copy and the contract
   deep-link all still work.**
8. Evan's four re-issued, the prior four `superseded` with a reason, **and a query proving the
   superseded set cannot render as current.**
9. `npm run typecheck`, `typecheck:api`, and lint at the 48-warning baseline.
10. **Renders are NOT VERIFIED by you** — end with a numbered checklist the owner runs.
