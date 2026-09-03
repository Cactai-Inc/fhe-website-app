# FHE-DISCO-CR116 — HANDOFF (fact-finding done directly by ORCH in conversation, 2026-09-03)

**CR-116** (`docs/reference/CHANGE-ORDER-LEDGER.md`): activate-then-review — an activation link sets up
auth only; the account is already complete from provisioning; the person reviews/edits it, then signs
if there are docs, else proceeds straight to the right destination.

**This is fact-finding output (the DISCO profile), produced directly by ORCH at the owner's direction
("you have the data... let's proceed with that approach") rather than through a separate research
thread. No code was changed. Routed to a DSNR-profile task for chunking and spec authoring.**

---

## 1 · WHAT ALREADY EXISTS AND MATCHES THE ASK — do not rebuild this

The provisioned door is closer to the owner's description than the conversation assumed:

- **`Register.tsx`'s `redeemByKind()` already branches on docs-needed, at the front door.** It redeems
  the invitation (auth + account linkage), then reads `myOnboardingState()`: if `state.needed` (docs
  pending) → `/app/onboarding`; else → `/app` directly. **This is already "if they have docs they sign
  them, if they dont they proceed right to the appropriate destination"** — built before CR-116 was said.
- **Onboarding's `details` step is already a review/edit screen, not a blank form.** It opens on
  `step='details'` (`Onboarding.tsx:409`) for both doors. Its copy literally says *"These fill in your
  lesson paperwork — you'll review and sign it next"* (`:1476`). It prefills from **the CONTACT record
  first, the profile second** (`s.prefill` — *"the CONTACT record… is the person record and wins"*,
  `:855-857`) — i.e., whatever staff captured at provisioning (D22's source of truth) is what the person
  sees, editable, with autosave (`:1471`, TASK-FIX4).
- **The `sign` step is already gated on real content.** `currentDoc = documents.find(d => d.status !==
  'EXECUTED') ?? null` (`:977`) — nothing to sign renders no document card.
- **Submitting `details` already mirrors the name onto `profiles` and seeds `display_name`.**
  `update_my_onboarding_profile` (`20260901T2330_…sql:15-77`) writes the contact record, then mirrors
  first/last name onto `profiles` **in the same statement**, which fires `trg_seed_display_name`
  (`UPDATE OF first_name, last_name, display_name`) and seeds `display_name` correctly. This already
  answers "why didn't a thread fix the trigger" for the one path that reaches it.

**None of this needs building. A spec that treats CR-116 as greenfield will duplicate a working
mechanism (D18).**

---

## 2 · THE ACTUAL GAP — precisely scoped, and it is exactly CR-116's "no docs" branch

**The ONLY place a contact's name is ever mirrored onto `profiles` (and therefore the only place
`display_name` ever gets seeded) is `update_my_onboarding_profile`, fired by submitting the `details`
step.** `promote_contact_to_account` — the function `redeem_invitation` calls at redemption
(`20260802000001_…sql:380`, `PERFORM promote_contact_to_account(auth.uid(), v_contact)`) — only ever
writes `contact_id` and `org_id` (`:192`). It does not touch name.

**So: when `myOnboardingState().needed` is FALSE at redemption (no docs pending), `Register.tsx` routes
straight to `/app` and Onboarding — the one screen that would mirror the name — is never visited.**
The person lands on their dashboard with `profiles.first_name`, `.last_name`, and `.display_name` all
still blank, and stays that way permanently (nothing else ever writes it). The greeting they see is
built from exactly those columns: `profile?.first_name || profile?.display_name || null` —
`DashboardHome.tsx:34`, `CareHome.tsx:29`, `DealHome.tsx:37` all read it the same way. **A lead
promoted straight to a docs-free account sees a blank/undefined name on the first screen they land on.**

**This is not a separate bug from CR-116 — it IS CR-116's no-docs branch, read literally.** The owner's
description implies review always happens, and doc-signing is the thing that's conditional:
*"they see their account information and if they want to change anything they can, if not, they click
continue and if they have docs they sign them, if they dont they just proceed."* **Today's code branches
the OTHER way: review itself is gated on docs being needed, so the no-docs case skips review entirely
and lands on a dashboard with an unfixed name.**

---

## 3 · WHAT THE SPEC MUST DECIDE — for DSNR, not answered here

1. **Should `details` (the review step) always show, independent of whether docs are pending?** The
   owner's words read as yes. If so, `Register.tsx`'s routing rule changes from `needed ? onboarding :
   /app` to **always onboarding**, and Onboarding's own step machinery decides whether `sign` (and
   anything after it) is reachable — `wizardSteps()` already conditionally includes steps; extending
   that pattern to skip straight from `details` to `done` when there is nothing to sign is the same
   idiom the file already uses for `horse`/`shop`/`slots` (`:318-350`).
2. **Or should the fix be narrower: make `promote_contact_to_account` mirror the name (and seed
   `display_name`) the same way `update_my_onboarding_profile` does, so the no-review branch is no
   longer also the no-name branch — leaving the "always show review" question separate?** This is the
   smaller, lower-risk fix and could ship independently of question 1. **D18 says converge on the
   existing rule rather than write a second copy of it** — the seeding logic in
   `update_my_onboarding_profile` (`20260901T2330_…sql:66-77`) is exactly what `promote_contact_to_account`
   is missing; the spec should reuse it (a shared helper, or the same CASE-fill-when-blank block), not
   reinvent it.
3. **Both may be needed together**: fixing the mirror closes the data gap regardless of routing; making
   review unconditional is the UX change the owner actually described. **DSNR should propose which is
   CR-116's scope and which (if either) is a separate follow-up**, per the owner's own words versus what
   is strictly required to stop the blank-name symptom.
4. **What "the appropriate destination" means today vs. what it should mean.** Currently it is always
   `/app` (flat dashboard) when no docs are pending. Whether that needs to route per offering/account
   type is not evidenced either way here — not measured, flag for DSNR to check against `myOnboardingState()`'s
   other fields or the purchase/order the person redeemed against.
5. **Whether the OAuth leg (`RegisterComplete.tsx`) needs the same treatment.** It redeems via a
   different code path (stash + `redeemInvitation` after Google sign-in) and was not traced in this
   pass — same `promote_contact_to_account` call likely applies (worth one grep, not re-derived here).

---

## 4 · EVIDENCE INDEX — file:line, so the DSNR task does not re-read cold

| Fact | Where |
|---|---|
| Front-door routing rule (needed → onboarding, else `/app`) | `src/pages/Register.tsx` `redeemByKind()`, :36-50 |
| `myOnboardingState().needed` semantics | `src/lib/api.ts:342-344` |
| Onboarding starts on `details` | `src/pages/app/Onboarding.tsx:409` |
| `wizardSteps()` — the conditional-step idiom to extend | `src/pages/app/Onboarding.tsx:318-350` |
| `details` step copy + prefill (contact wins over profile) | `src/pages/app/Onboarding.tsx:846-866`, `:1465-1477` |
| `sign` step's empty-state gate | `src/pages/app/Onboarding.tsx:977` |
| `saveDetails` → `updateMyOnboardingProfile` | `src/pages/app/Onboarding.tsx:1031, 1091` |
| `update_my_onboarding_profile` — the mirror + seed, the reusable idiom | `supabase/migrations/20260901T2330_the_display_name_is_seeded_from_the_name_they_give_us.sql:15-77` |
| `redeem_invitation` calls `promote_contact_to_account` | `supabase/migrations/20260802000001_lead_trust_notifications_part2.sql:380` |
| `promote_contact_to_account` — the gap, only writes `contact_id`/`org_id` | same file, `:192-193` |
| `trg_seed_display_name` trigger definition + firing columns | `supabase/migrations/20260901T2330_…sql:141-160` |
| Dashboard greeting reads `first_name || display_name` | `src/pages/app/DashboardHome.tsx:34`, `CareHome.tsx:29`, `DealHome.tsx:37` |

---

## 5 · WHAT THIS IS NOT

- **Not a GRANTS-bundle item.** GRANTS' ownership is ACLs only, never a body; this is entirely a body
  question (both functions involved are already correctly scoped for `anon`/`authenticated`).
- **Not yet a spec.** No THE TEST, no THE REACH, no chunking. That is DSNR's to author from this.
- **Not blocked on anything running.** No live bundle touches `promote_contact_to_account`,
  `update_my_onboarding_profile`, `Register.tsx`, or `Onboarding.tsx`'s routing logic as of this pass —
  worth a fresh `git worktree list` / branch-diff check at dispatch time (D35/D36), not assumed here.

## THE PROMPT — for a DSNR-profile task

**Fable 5.1 · effort HIGH** (the routing-vs-mirror scope call in §3 is a shape question on ground three
functions already touch, per `MODEL-CHOICE-NOTES-2026-09-01.md`'s SHAPE-BEFORE-FIX rule)

```
FHE-TASK-CR116-A

Read /Users/cactai/Downloads/claude-code-repo/fhe-website-app/docs/reports/FHE-DISCO-CR116-HANDOFF.md
and docs/reference/CHANGE-ORDER-LEDGER.md CR-116, and author the build spec(s).
Worktree: <assign> · hand back to FHE-ORCH
```
