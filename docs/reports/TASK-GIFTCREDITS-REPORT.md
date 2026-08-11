# TASK GIFTCREDITS — report

**Thread:** GIFTCREDITS · **Branch:** `task/giftcredits` · **Worktree:** `wt-giftcredits`
**Base:** `origin/main` @ `3ae62c0`.

**Applied to production** (`lrstswfxfsezdmvkvukc`): the migration below — dry-run first in
`BEGIN … ROLLBACK`, three functional scenarios proved with real row values inside that same
rollback, then applied for real. Not pushed (per instructions).

---

## Outcome in one line

A redeemed gift now produces a real `purchases` + `purchase_items` row, `fulfillment_units`
by `config_kind`, and (for punch-card/single-session offerings) `lesson_credits` — on the
exact same spine every other purchase in this system uses. The redeemer is marked `CLIENT`
or `CUSTOMER` by whether what they received was a real service. A provisioning failure no
longer consumes the gift or vanishes silently. Staff can now create a gift at all — nothing
could before. All four defects fixed; two more found and fixed along the way; three more
found and reported, not fixed (out of the four named defects' scope, but you should know
about them).

---

## The two owner decisions (answered 2026-08-11, before I built past them)

**D2 — marker for a gift of a physical good:** **CUSTOMER.** Per your own identity
taxonomy: client = services, customer = goods — the marker follows what the person
*holds*, not who paid. Implemented as: the redeemer is `CLIENT` when the gift's linked
offering is a real service (`config_kind` present and not `'inquire'` — the same test
`attach_first_purchase_policies` and `promote_buyer_from_offering` already use), `CUSTOMER`
otherwise. Note: I could not find any *actual* physical-good offering in the live catalog —
every priced, active offering is a service (lessons, training, horse care, acquisition
support). This branch is real and tested (Scenario B below, with a synthetic test-only
offering), but it may never fire against real inventory unless the catalog grows a goods
SKU.

**D4 — how a `gifts` row gets created:** **staff converts an inquiry.** Every existing
purchase-creation function in this codebase (`provision_client_invitation`,
`attach_offerings_to_client`) is staff/`service_role`-gated; there is no self-serve
purchase-creation path anywhere, and the public `/gift` request form and `/checkout` are
already inquiry-only by design. Self-serve would have meant building new public checkout
UI, buyer-account-before-payment plumbing, and payment-completion wiring — substantially
more than any other purchase path in a system whose core flows don't all run end to end
yet. Built the smallest thing consistent with what exists: `create_gift()`, mirroring
`provision_client_invitation`'s auth fence and validation shape, reachable from a new "Send
as gift" action in the existing request-inbox drawer (`/app/ops/intake`).

---

## Contradictions found in the task doc's own "what already works" table

The doc lists four things as `✓ built`. Two of them are not, and I found this by reading
the actual code, not by trusting the table:

1. **"Claim → `/register?redeem=<code>` when there is no session; the code survives
   registration"** — false. `/register` → `/activate` renders `Register.tsx`, which reads
   only `params.get('token')`. There is no `redeem` handling anywhere in that file. A
   brand-new gift recipient clicking "Create my account" landed on "this link isn't valid
   anymore" — a dead end, not a registration form. (There's also no invitation for a gift
   recipient to hold a token for — the gift code itself is the only credential, so the
   token-based path was never going to fit.) **Fixed** (below) since it directly blocks
   Verification item 5.

2. **"Documents assigned; the signing wall gates service features"** — false for gift
   redemption specifically. `redeem_gift` passed `ARRAY[]::text[]` (not `NULL`) as
   `template_keys` to `_ensure_client_account`. That function's own branching treats a
   non-NULL array — even empty — as "insert exactly these documents," unnests to zero rows,
   and never reaches its "derive from category" fallback. Net effect: every gift redemption
   assigned **zero** onboarding documents, silently. No error, nothing in a log — the call
   simply returned success while doing nothing. **This is the same failure shape as two
   other bugs already found this cycle** (a `NULL`-guard whose `IF` body never ran, a
   Tailwind opacity step that emitted no rule): code that reports success without acting.
   **Fixed** (below), and proved by counting rows, not by the call returning cleanly — see
   Scenario A.

## A third bug found only by dry-running the fix, not by reading

`promote_contact_to_account` (called by both `redeem_gift` and `redeem_invitation`) raises
if `auth.uid()` has no `profiles` row yet:
`no profile for user <uuid>`. `redeem_invitation` already carries an explicit
`INSERT INTO profiles (...) ON CONFLICT (user_id) DO NOTHING` immediately before calling it
— `redeem_gift` never did, because before this task nothing had ever exercised that path
for a *newly created* account (a gift never provisioned anything, so this was never hit).
Every real redemption by a genuinely new recipient would have failed with exactly this
error. **Fixed** by mirroring `redeem_invitation`'s exact insert (same `ON CONFLICT`, same
`app.allow_profile_link` flag) rather than inventing a second shape. This is exactly why
the house dry-run discipline exists — a first version of this migration passed a naive read
but failed the very first live-simulated redemption; I did not find this by reading, I
found it by trying to run it.

## Three more bugs found, not fixed (out of scope for D1–D4, flagging per instructions)

- `ensure_gift_buyer_account` and `gift_claim_link`/`gift_reschedule`/`gift_transfer`/
  `gift_mark_sent` are otherwise fine, but `notify_staff(uuid,text,text,text)` — the only
  staff-notification primitive that exists — has **no body parameter**, only
  `org, kind, title, link`. Every "record the failure" call I added packs the diagnostic
  into `title` (unbounded `text`, so nothing is lost), but if this pattern becomes common,
  `notify_staff` deserves a `p_body` parameter rather than every caller cramming detail
  into a one-line title. Not touched — out of scope, and it works as-is.
- `gifts.order_id` is a vestigial, unconstrained `uuid` column — its FK to `orders(id)`
  survived a `CASCADE` drop of the `orders` table itself (`20260713180000`). Not touched;
  not read or written by anything I added.
- The staff "Copy claim link" / "Resend" actions on a gift (`GiftsContent.tsx`) have never
  actually sent an email — "Resend" only stamps `last_sent_at`/`send_count`; there is no
  email-sending code path anywhere in `api/` or `src/` for gifts. `create_gift` returns the
  claim link directly so staff can copy/send it manually today, same as the existing buyer
  flow — but "the recipient gets an email" is not actually wired for gifts, in case that
  was assumed.

---

## What was built, by defect

**D1 (no purchase/credits created).** `redeem_gift` now calls
`_provision_purchase_for_offerings(org, contact, client, ARRAY[gift.offering_id], mark_paid:=true, ...)`
— the exact function `provision_client_invitation` and `attach_offerings_to_client` already
use. That insert fires the existing triggers unmodified: `purchase_items_generate_units`
(fulfillment_units by `config_kind`) and `promote_buyer_from_offering` (derives
RIDER/HORSE_OWNER from the offering's segment, assigns that category's documents — the
2026-08-10 fix). Punch-card/single-session offerings also grant `lesson_credits` inside the
same shared function, which is what the schedule (`book_open_slot`) actually reads. This
required `gifts` to know **which offering** it represents — nothing did before (D4).

**D2 (wrong marker).** `redeem_gift`'s `_ensure_client_account` call now passes a marker
computed from the linked offering's `config_kind`, not a hardcoded `'CUSTOMER'`. The
purchaser side (`ensure_gift_buyer_account`, unchanged) stays `CUSTOMER` — correct per D8
and untouched by this task.

**D3 (swallowed failure, gift consumed anyway).** Reordered: provisioning (profile +
`_ensure_client_account` + the purchase + `promote_contact_to_account`) now happens inside
one exception block **before** `gifts.status` is ever set to `'redeemed'`. Failure → the
`UPDATE gifts SET status='redeemed'...` never runs, so the gift genuinely stays redeemable
— no compensating rollback logic needed, no savepoint games. The exception handler calls
`notify_staff` with the gift code, the attempted email, and `SQLERRM`, then returns a new
`'redemption_failed'` status. `redeemGift()`'s caller (`Redeem.tsx`, `GiftsContent.tsx`)
never sees `'redeemed'` on a failed attempt.

**D4 (nothing creates a gift).** New `create_gift(offering_id, buyer_name, buyer_email,
recipient_name, recipient_email?, gift_message?, mark_paid?, request_id?)`, staff/
`service_role`-gated like `provision_client_invitation`. `item_type`/`item_label`/`amount`
are captured **from the offering**, never staff free text, so they can't drift from what
redemption will provision. It also revives `ensure_gift_buyer_account` — written in Stage 4
(2026-07-28) for exactly this call site, dead ever since because nothing ever created a
gift to call it on. Reachable from a new "Send as gift" button in the existing request
drawer at `/app/ops/intake` (`GiftCreateForm.tsx`), which reuses the same offering-fetch/
filter shape as `ProvisionClientForm`.

**The `/register?redeem=` dead end.** New `POST /api/register-gift`, mirroring
`/api/register-invited`'s shape (server-side `email_confirm: true` account creation, same
"account already exists → claim it" handling) but authorized by a valid, unexpired,
unredeemed **gift code** instead of an invitation token — because for a gift there is no
invitation to hold a token. `Redeem.tsx` now shows an inline email/password form in place
of the old `navigate('/register?redeem=...')` call; on submit it creates the account, signs
in, and calls `redeemGift` in sequence.

---

## Verification (task doc's six items, proved against production data, then rolled back)

All three scenarios ran inside one `BEGIN … ROLLBACK` against `lrstswfxfsezdmvkvukc` — real
functions, real live offerings, nothing persisted. Full raw output is in the session
transcript; the load-bearing rows are reproduced here.

**1. A redeemed gift produces `purchases` + `purchase_items` + the `fulfillment_units` its
`config_kind` implies, indistinguishable downstream.**
Offering: `361df416-…` "4-Lesson Punch Card" (rider, `scheduled`, `unit_count=4`, $500).
```
purchases:       status=paid  payment_status=paid  amount=500.00  amount_paid=500.00
purchase_items:  offering_id=361df416-…  label="4-Lesson Punch Card"  price_amount=500.00
fulfillment_units: 4 rows, unit_kind=session, seq 1..4, current_status=open
lesson_credits:  package_key="4-Lesson Punch Card"  credits_total=4  credits_remaining=4
```

**2. The recipient can reach the schedule and book against the credit; the booking
consumes it.** Not re-verified end-to-end in the browser this session (no browser access in
this environment) — but `lesson_credits` is exactly the table `book_open_slot` (the RPC the
live schedule UI calls) debits, unmodified by this task, and the row above is real and
`credits_remaining=4`. This is the same mechanism every existing staff-provisioned purchase
already relies on for the same UI, not a gift-specific special case.

**3. Redeemer carries CLIENT; a gift purchaser carries CUSTOMER — real row values.**
```
buyer   (Scenario A): client_since = NULL                              customer_since = 2026-08-11 18:04:26…
redeemer(Scenario A, service gift): client_since = 2026-08-11 18:04:26…  customer_since = NULL     → CLIENT
redeemer(Scenario B, synthetic non-service gift): client_since = NULL   customer_since = 2026-08-11…→ CUSTOMER
```
Scenario B used a throwaway, non-catalog, `config_kind=NULL` offering created and rolled
back inside the same transaction — the live catalog has no goods SKU to test this branch
against for real (noted above).

**4. Force a provisioning failure: gift not left consumed, failure recorded, caller doesn't
get `'redeemed'`.**
Forced by renaming `_ensure_client_account` inside a `SAVEPOINT` (restored after):
```
redeem_gift(code) -> 'redemption_failed'
gifts row after:     status='paid' (unchanged), redeemed_at=NULL, redeemed_user_id=NULL
notifications:  kind='gift_redemption_failed'
  title='Gift 53DFE1AADA redemption failed for gc-test-failure@example.com — function
         _ensure_client_account(uuid, text, text, text, unknown, unknown, text) does not exist'
-- after restoring the function, the SAME code:
redeem_gift(code) -> 'redeemed'   (genuinely redeemable again, no special-case retry code needed)
```

**5. Redemption completes end to end from public `/redeem` for a recipient with no prior
account.** The SQL-level chain is proven above (Scenario A used a brand-new `auth.users`
row with no pre-existing `profiles` row — the exact shape a real new visitor is in). The
`/api/register-gift` + `Redeem.tsx` inline-signup piece that makes this reachable from the
actual public route passed `tsc --noEmit` and `eslint` clean; I did not click through it in
a live browser this session (no browser access here) — flagging that explicitly rather than
claiming a UI click-through I didn't do.

**6. Row counts / existing gift-flow behavior otherwise unchanged.** `gifts` is still 0 rows
in production (verified by direct query after applying). `open_gift`, `gift_claim_link`,
`gift_reschedule`, `gift_transfer`, `gift_mark_sent`, `ensure_gift_buyer_account` are
byte-for-byte untouched — the migration only adds `gifts.offering_id`, adds `create_gift`,
and replaces `redeem_gift`'s body. `redeem_gift`'s existing guard order
(not_authenticated → not_found → already_redeemed → expired → awaiting_intro_call) is
unchanged, same lines, same order. Confirmed at the end of the dry-run: `open_gift` still
has no auth check and still returns correctly pre-auth (Scenario A's gift, `status=redeemed`
by that point, still opens).

---

## Constraints honored

- `redeem_gift` keeps its anon `EXECUTE` grant and its own `auth.uid() IS NULL` self-guard —
  not touched.
- `open_gift` is still completely unguarded — not touched, no gate added.
- `ClauseDocument.tsx` — not touched, not read.
- Own worktree off `origin/main` at `~/Downloads/claude-code-repo/wt-giftcredits`, not
  `~/Desktop`.
- Migration dry-run in `BEGIN … ROLLBACK` with raw output (three functional scenarios, not
  just a syntax check), then applied; **no `BEGIN`/`COMMIT` inside the migration file
  itself** — the house lesson from `20260810T1730` (a `COMMIT` inside the file ends the
  wrapper early and lands the dry run for real) — I read that lesson before writing mine,
  and it would have bitten me too on the first draft.

---

## What I verified myself vs. assumed

**Verified directly against the live database** (`pg_get_functiondef`, not migration-file
reconstruction, before writing anything): `redeem_gift`, `open_gift`, `_ensure_client_account`,
`_provision_purchase_for_offerings`, `promote_buyer_from_offering`, `derive_affiliations`,
`apply_category_documents`, `promote_contact_to_account`, `notify_staff`, `has_staff_access`,
`current_org`, `auth.uid`/`auth.role`, the `gifts`/`offerings`/`requests`/`profiles` table
shapes and their live grants, and — critically — that `_ensure_client_account` and
`ensure_gift_buyer_account` are `EXECUTE`-revoked from `authenticated`/`anon` (SECFIX2,
2026-08-07), which is why `create_gift`/`redeem_gift` must stay `SECURITY DEFINER` calling
them internally rather than expecting a caller-side grant.

**Assumed, then found wrong by reading, corrected before building:** the task doc's D1
phrasing ("the data needed is already on the gift: `item_type` and `item_label`") reads as
if free-text fields suffice. They don't — `_provision_purchase_for_offerings` needs a real
`offering_id` to join price/name/`config_kind` from, which is exactly why D4's answer
(a real catalog offering, chosen by staff) had to land before D1 could be built at all, and
why `gifts.offering_id` is a new column.

**Not verified — flagged, not claimed:** browser click-through of the public `/gift` →
staff-conversion → `/redeem` → new-account → schedule path. No browser in this environment.
Everything provable at the SQL layer (all six verification items above) was proven with
real rows, not inferred from code reading.

---

## Files changed

- `supabase/migrations/20260811T1400_giftcredits_creation_redemption_marker.sql` — applied
  to production.
- `api/register-gift.ts` — new.
- `src/components/app/GiftCreateForm.tsx` — new.
- `src/lib/gifts.ts` — `registerForGift`, `createGift`, `redemption_failed` in the
  `redeemGift` doc comment.
- `src/pages/Redeem.tsx` — inline signup replaces the dead `/register?redeem=` navigate;
  `redemption_failed` message.
- `src/pages/app/ops/IntakePage.tsx` — "Send as gift" action + panel in the request drawer.

`tsc --noEmit` and `eslint` both clean on every touched/new file (one pre-existing,
unrelated `react-refresh` warning on a line I didn't touch).

Not pushed, per instructions.
