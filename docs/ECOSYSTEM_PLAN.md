> **STATUS (2026-07-27):** Stages 0–2 are **DONE and live on prod** (`a726e4a`,
> `1c01b32`) — `derive_affiliations` + `apply_affiliations` are the sole group writer;
> live state RIDER 9 · HORSE_OWNER 2. **Stage 3 is owner-blocked** (moving signed docs
> between the owner's own test identities). **Stages 4–6 not started.**
> Note: the plan text proposes a `promote_contact_to_account` RPC; what actually
> shipped is `_ensure_client_account` + `derive_affiliations`/`apply_affiliations`.

# FHE Ecosystem Plan — make the website + app work coherently

This plan is built from your corrections and from facts verified against the live
DB/code (not assumptions). It fixes the ROOT CAUSE, not the labels: the identity ↔
document ↔ account ↔ promotion pathway is incoherent, and the taxonomy cleanup
rides along on top of a corrected mechanism.

## The corrected identity model (your rules, as invariants)

- **Two anchors, one person lives in exactly one at a time:**
  - **`contacts`** = the **faceless external** record. No login. A vendor, or a
    tracked website visitor correlated by a unique id who hasn't closed the loop.
    Holds an id + accumulated interaction history to learn from.
  - **account (`profiles` ↔ `auth.users`)** = anyone who participates: **guest,
    rider, horse owner.** They log in, see + contribute to community.
- **Promotion moves a person contact → account** and carries their history; the
  record then lives on the account side. **No dual-association, no duplicated data.**
  An account-keyed action never needs the contacts/client table.
- **Account is REQUIRED to:** own a horse; be a party to a contract. Contract
  parties are therefore always a horse owner or a rider (all current contracts are
  horse transactions; seller/lessor = horse owner, possibly also rider).
- **Affiliation groups** (stack, bump up/down) apply to account holders:
  `RIDER`, `HORSE_OWNER` (+ `PARENT_GUARDIAN` of a rider). **Guest = an account
  holder with no affiliation group** (farm visitor, gift-cert buyer) — still
  community-visible, just not rider/owner.
- **Purchaser wording** (OPEN — your call, plan supports any): `client` for all /
  `client`+`customer` split / `guest`+`customer`. The DB will store a neutral
  promotion marker; the WORD is a display concern we set once.

## The root cause (verified in code)

1. **Documents have NO account link.** `documents`, `signatures`,
   `document_parties` carry only `contact_id` — **no `user_id`** (confirmed). A
   signed rider release is tied to a faceless contact, not an account.
2. **No single promotion pathway.** FIVE functions independently write
   `contact_roles` (`sign_release`, `_ensure_client_account`, `admin_create_client`,
   `default_guest_on_client_role`, `update_my_onboarding_profile`). Account
   creation is scattered across `redeem_invitation`, `provision_tenant`, etc. The
   category state a person ends up in is not *derived* from a source of truth — it's
   written five ways that never reconcile. **This is why the invite path has been
   an endless patch.**
3. **Consequence:** kiosk signers become contact+roles+client with no account;
   invite-path users get an account but the categories come from a different writer;
   the two never agree, and nothing derives "signed the rider doc-set + has an
   account ⇒ Rider member."

## The fix — one coherent pathway (mechanism first)

### F1. Link documents to accounts
Add an account association so a signed document is anchored to the account when one
exists (or becomes linked at promotion). Concretely: when a contact is promoted to
an account, their documents/parties/signatures resolve to that account; new signing
by an account holder records the account. (No user_id column churn on signatures if
we resolve via `profiles.contact_id` — but we make the linkage explicit and queryable.)

### F2. ONE account-creation spine + ONE category-derivation
- Collapse account creation to a single path (extend the Phase-3 `_ensure_client_account`
  spine to be THE way an account+identity is created/promoted; `redeem_invitation`,
  gift redeem, kiosk-conversion all call it — this is already partly done).
- Replace the five independent `contact_roles` writers with **one derive function**:
  `derive_affiliations(account)` computes RIDER/HORSE_OWNER/etc. **from the executed
  document sets + horse ownership + explicit staff grants**, and is the ONLY writer.
  Everything else calls it. Category becomes a *derived, reconciled* fact, not five
  parallel writes.

### F3. Promotion pathway that honors docs + account
A single `promote_contact_to_account(contact, …)` that: creates the account (F2),
re-anchors the contact's documents/history to the account (F1), runs
`derive_affiliations` (F2), and dissolves the faceless contact record into the
account (no dual-association). Kiosk, invite, gift-redeem, and self-signup all
funnel through it.

### F4. Taxonomy cleanup (rides along, now that the mechanism is right)
- `contact_roles` → **`groups`** (affiliations only: RIDER/HORSE_OWNER/PARENT_GUARDIAN),
  written ONLY by `derive_affiliations`. GUEST leaves it (guest = account, no group).
- **Guest** modeled as "account holder with zero groups" (+ a `contact_type` on the
  faceless side for external kinds: VENDOR, TRACKED_VISITOR, WEB_SUBMITTER).
- CLIENT/PARTICIPANT/GUARDIAN leave `contact_roles`: CLIENT → the client marker;
  PARTICIPANT/GUARDIAN stay per-document on `document_parties` (already there).
- Drop `members.tier` (dead). `role` reserved for internal users (`profiles.role`).
- `category_document_requirements`: split group-driven onboarding docs (by group)
  from contract doc-roles (Buyer/Lessee/Seller — belong to the contract engine).

### F5. Table disposition (evidence-based — NOT killing wired tables)
- **Keep + wire** the "empty" tables — they're empty because flows haven't reached
  them, and each is still code-referenced: `horse_parties` (4 db fns + 5 FE),
  `lease_participants` (5 fns), `document_party_archives` (2 fns),
  `content_acknowledgments` (1 fn). Reconcile `horse_parties` vs `horse_relationships`
  (two tables, same idea — pick one, migrate, retire the other) — but only after
  confirming which the live flows use.
- **Merge** `staff_profiles` (2 rows) into `profiles` (title/pay_type/active).

## Execution — staged, verify each step against prod (rolled-back dry-run → apply)

Ordered so nothing breaks the live gate mid-flight; each stage is independently
verifiable and committed.

1. **Stage 0 — instrument + prove.** Write read-only reconciliation queries that
   show, per person: contact vs account, which doc-sets executed, current
   contact_roles, current groups-if-derived. Establishes the before-state truth.
2. **Stage 1 — derive_affiliations (additive, no rename).** Build the single
   derivation fn; run it read-only; diff its output vs the current contact_roles.
   Prove it reproduces correct state before it becomes authoritative.
3. **Stage 2 — one promotion spine.** Route all account creation/promotion through
   `promote_contact_to_account`; make `derive_affiliations` the sole category writer;
   retire the other four writers (keep behavior identical, verified).
4. **Stage 3 — document↔account linkage.** Re-anchor docs to accounts on promotion;
   backfill existing signed docs to their accounts where an account exists.
5. **Stage 4 — taxonomy rename.** contact_roles → groups; contact_type on the
   faceless side; drop members.tier; split category_document_requirements. Behavior
   preserved (the mechanism from stages 1–3 already made state coherent).
6. **Stage 5 — table reconcile.** horse_parties ↔ horse_relationships;
   staff_profiles → profiles. Only after confirming live-flow usage.
7. **Stage 6 — FE sweep + surfaces.** Update FE identifiers, promotion UI, and the
   admin views to show the coherent model (account · groups · client/customer · doc
   status), then re-verify the whole invite→sign→promote→community path E2E.

Every stage: dry-run in a rolled-back txn against prod, apply, verify with the
Stage-0 reconciliation queries, commit. The invite-path E2E (the thing that's been
broken) is the acceptance test for stages 2–4.

## The two words still to set (display only — does not block the build)
- Affiliation table name: `groups` (recommended — matches your canonical word).
- Purchaser word: I'll store a neutral marker and default the DISPLAY to `client`
  everywhere, with `customer` reserved for the gift-cert/product-only case, so we
  can flip the label later without a schema change. If you want the hard split now,
  say so; otherwise this is a one-line display decision we revisit anytime.

## What this fixes (the acceptance criteria)
- A kiosk signer and an invite user reach the SAME coherent state (account + derived
  groups + docs anchored to the account).
- Category is derived + reconciled, never written five conflicting ways.
- The invite path stops needing patches because the model underneath is finally
  coherent.
- Community access, onboarding docs, and nav gating all read from one source
  (groups), so they can't disagree.
