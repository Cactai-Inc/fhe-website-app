# TASK-GIFTPATH — report

**Branch `task/giftpath`, off `main` = `4977ac1`. Committed (`a9ef588`), NOT pushed.**
Built 2026-08-17, Sonnet 5, thinking on, medium effort. One thread, no subagents.
`CAREPATH` had already merged to `main` (`1de6599`), so the run condition was satisfied.

- **Typecheck** (app + api): clean, 0 errors.
- **Lint:** 0 errors, 40 warnings — identical to `main`'s pre-existing count, none in a
  touched file.
- **`npm run build`** (vite build + prerender + seo-files): clean. `/horse` and
  `/acquisition` prerendered HTML both contain the new gift-link text; `/gift` is
  `noindex` and is correctly excluded from the static prerender list, as before.
- **`test/db` (PGlite): `46 failed | 25 passed (71)`, `203 failed | 453 passed | 107
  skipped (763)`** — byte-identical file/test counts on this branch and on a fresh
  `main` checkout. §5 below names the specific failing files and confirms none relate
  to this change (a stale seed fixture referencing dropped `offering_tiers`, and an
  unrelated `business_identity`/`config_values` seeding gap — both pre-existing).
- **One migration**, dry-run inside `BEGIN … ROLLBACK`, applied to prod, verified with
  a query, then a second live RPC-level dry-run (`BEGIN … ROLLBACK`) proving the new
  path end-to-end. §4.

---

## 0. THE OWNER QUESTION — asked before building P2, as instructed

| # | question | answer | what it changed |
|---|---|---|---|
| 1 | Which fields beyond buyer/recipient name+email+message does the gift form need? | **Both candidates: phone (required — "the entire purpose is a conversation") and occasion/timing (optional, softer than a delivery date)** | Added `buyerPhone` (required, same posture as name/email) and `occasion` (optional, free text) to `Gift.tsx`. "What they have in mind" was already covered by the existing item dropdown and was not asked again. |

---

## 1. Verification of the doc's own measurements

| doc says | verified? | detail |
|---|---|---|
| `/gift` (`Gift.tsx`) is already a contact form, not a checkout | ✅ | Confirmed by reading the file before touching it. `requestGift` never called `create_gift` or any payment path. |
| Exactly ONE inbound link exists, `Lessons.tsx:255` → `/gift?item=lessons` | ✅ | Confirmed by grep across `src/`. |
| Prod holds ZERO gift enquiries (`requests where notes like 'GIFT%'`) | ✅ | Re-verified live: `select count(*) from requests where notes ilike 'GIFT%' or category='gift'` → `0`. Also `select status, count(*) from gifts group by status` → 0 rows. Still true at write time. |
| `Checkout.tsx` is untouched by this task | ⚠️ **header comment only** | No purchase logic touched — only a doc-comment addition recording the ruling (P4, explicitly requested). |

---

## 2. THE ROOT CAUSE, precisely (P3)

`requestGift()` (`src/lib/gifts.ts`) inserted into `requests` **directly**:

```ts
const { error } = await supabase.from('requests').insert({ contact_name: ..., notes: ... });
```

This bypassed `submit_public_request` — the one SECURITY DEFINER RPC every other public
intake path (`Contact`, `InquiryForm`/checkout, kiosk) shares — entirely. Two
consequences, both silent:

1. **No staff alert of any kind.** `submit_public_request` is what calls
   `notify_staff(...)` (the in-app dashboard notification) and returns the
   `request_id` that `submitRequest()` (`src/lib/api.ts`) uses to dispatch
   `/api/request-received` (staff email) and `/api/inquiry-confirmation` (buyer
   email). A raw `.insert()` gets none of that — not fire-and-forget, just **never
   fired**.
2. **No `request_alert_sends` row**, so "did the team hear about this gift enquiry?"
   had no answer anywhere, for any of the zero gift enquiries received so far.

This is the same shape as the defect `orchestration/lessons/LESSONS.md` already
documents ("FIRE-AND-FORGET PLUS BEST-EFFORT-200") — real leads reaching `requests`
with the owner never told — except the gift path didn't even get as far as
fire-and-forget; it never called the alert machinery at all.

**The fix reuses, not rebuilds.** `requestGift()` now calls `submitRequest()`
directly — the exact function `InquiryForm.tsx` already uses — with `category:
'gift'`, `channel: 'gift'`, zero `request_selections` (so `submit_public_request`'s
`v_lines > 0` branch never fires and no draft purchase opens — this is what keeps
"do not build a gift checkout" true structurally, not just by convention), and the
recipient/message/occasion data in `details` (jsonb), which both the staff and buyer
emails already render generically.

---

## 3. What was built

### P1 — reachable from everywhere a gift makes sense

- `/horse` (`BookHorse.tsx`) and `/acquisition` (`BookSupport.tsx`) each gained a
  "Gift our services to the horse lover in your life" link (owner's wording,
  verbatim) next to the primary Continue button, shown only on the selection step —
  the same posture `Lessons.tsx`'s existing "Buy as a gift" link already has. Each
  carries the item preset (`?item=horse`, `?item=acquisition`).
- Footer gained a "Gift a Service" entry between Acquisition Support and FAQ.
- **`Lessons.tsx` was not touched** — its link already existed and needed nothing.
  `SESSIONBOOK` (queued, not yet started — no `task/sessionbook` branch or worktree
  exists) will restructure `/lessons` later; since I made no changes there, there is
  nothing to reconcile today. Flagging for that thread to preserve the gift link when
  it rebuilds the page.
- Drive-by: `Gift.tsx`'s own SEO description still said "a membership" — a leftover
  from before `GIFT_ITEMS` dropped the membership option (D4, documented in the
  file's own header comment). Fixed to "horse care" while already in this file for
  the reason the comment names.

### P2 — owner-approved fields, no more

`buyerPhone` (required) and `occasion` (optional, "Birthday in two weeks, anytime
this month…") were added. "What they have in mind" was **not** re-asked — the
existing item dropdown already is that question.

### P3 — the enquiry provably reaches a human

- `requestGift()` routed through `submitRequest()` (§2). New DB migration
  (`20260817T1250_giftpath_gift_category_channel.sql`) widens
  `requests_category_check` and `requests_channel_check` to allow `'gift'` — the
  only way `submit_public_request` will accept the value. Dry-run in
  `BEGIN…ROLLBACK`, applied, verified against prod's live `\d requests` output.
- **Live RPC-level proof** (not just code-reading), each wrapped in its own
  `BEGIN…ROLLBACK` against prod as `SET ROLE anon` (the same role the public form
  runs as):
  - `submit_public_request(..., p_category:='gift', p_channel:='gift', ...)` →
    succeeds, `requests` row lands with `category='gift'`, `channel='gift'`, the
    `details` jsonb exactly as sent, `contact_phone` normalized.
  - `purchase_id` in the RPC's return is **`null`** — confirmed, no draft order
    opens for a gift enquiry with zero selections.
  - Two rows land in `notifications` (`kind='request_new'`, `title='New inquiry from
    Test Giftbuyer2'`, `link='/app/ops/intake'`) — **the dashboard alert provably
    fires**, mirrored to both staff/admin recipients on the tenant.
  - Both transactions rolled back; `select count(*) from requests where
    contact_email = 'giftpath-verify...'` confirms zero residue — prod's "zero gift
    enquiries" claim in §1 is still true after this report.
- `CATEGORY_LABEL`/`CHANNEL_LABEL` (`api/request-received.ts`) and
  `EXTRA_DETAIL_LABELS` (`src/lib/intakeCategoryFields.ts`) gained `'gift'` entries
  so the staff email and the `LeadWorkDrawer` detail list read as words
  ("Gift enquiry", "Recipient's name", …) instead of raw jsonb keys.
- `Gift.tsx`'s confirmation screen now reflects the **real** outcome: `staffAlerted`
  starts `null` (request saved, alert not yet reported), and once `sends` resolves,
  a `false` outcome swaps the copy to an explicit "we couldn't confirm it reached
  our team — please also call/email us" with real contact details (`BRAND`), instead
  of always showing the same optimistic message. A form-level validation error
  (invalid phone format, message too long, etc. — all enforced server-side by
  `submit_public_request`) is now surfaced to the visitor instead of being silently
  swallowed, matching `PublicIntakeForm.tsx`'s existing pattern.

⚠️ **What is NOT independently verified — the actual email send.**
`/api/request-received` and `/api/inquiry-confirmation` are Vercel serverless
functions; they cannot be invoked from `psql`, and this environment has no browser
automation available. What is proven: the RPC call these functions are triggered
from (§3 above), and that the code path is the **unmodified, already-shared**
`submitRequest()`/`postSend()` machinery `InquiryForm.tsx` uses for lessons,
horse-care, and acquisition — not new code written for gifts. What is **not**
proven from this session: a live click-through of `/gift` in a browser, submitting
the form, and confirming the two emails actually land in an inbox. **NOT VERIFIED —
owner checklist:**
1. Open `/gift?item=lessons` in a browser, submit a real test enquiry.
2. Confirm the dashboard shows a "New inquiry from …" notification (Ops → intake).
3. Confirm the staff ops-inbox email and the buyer's own confirmation email both
   arrive, and that the confirmation screen on `/gift` does NOT show the "couldn't
   confirm" fallback message.
4. Confirm `request_alert_sends` has two rows (`kind='staff'`, `kind='buyer'`) for
   that request, both `succeeded=true`.

### P4 — the ruling recorded, the redemption spine reported on

- `Checkout.tsx`'s header comment now states the ruling and why, so a future thread
  reading that file sees the reasoning before "fixing" the missing gift toggle.
- `gift_claim_link`, `redeem_gift`, `create_gift`, `open_gift`, `gift_reschedule`,
  `gift_transfer`, `gift_mark_sent` — all confirmed live in prod via
  `pg_get_function_identity_arguments`, **unmodified**, same signatures as before
  this task.
- `GiftCreateForm.tsx` (staff "Send as gift" → `create_gift`, inside
  `LeadWorkDrawer.tsx`) is the existing "staff creates the order by hand" surface
  named in the task doc. **Gap observed, not fixed (out of this task's stated
  scope):** it does not prefill recipient name/email/message from the enquiry's
  `requests.details` — staff re-type what the buyer already gave. Now that
  `requestGift()` writes clean `recipient_name` / `recipient_email` / `gift_message`
  keys (§3), that prefill would be a small, low-risk follow-up; worth naming to the
  owner as a candidate, not built here.

---

## 4. Migration

`supabase/migrations/20260817T1250_giftpath_gift_category_channel.sql` — widens two
`CHECK` constraints only, additive:

```sql
ALTER TABLE requests DROP CONSTRAINT IF EXISTS requests_category_check;
ALTER TABLE requests ADD  CONSTRAINT requests_category_check
  CHECK (category IS NULL OR category IN
    ('general','lessons','horse_care','acquisition','media','partnership','gift'));

ALTER TABLE requests DROP CONSTRAINT IF EXISTS requests_channel_check;
ALTER TABLE requests ADD  CONSTRAINT requests_channel_check
  CHECK (channel IS NULL OR channel IN ('contact','inquiry','booking','kiosk','gift'));
```

Dry-run (`BEGIN…ROLLBACK`) clean, applied, verified against prod's live `\d requests`
constraint text. `intake_requirements.channel`'s own, separate CHECK constraint
(`contact|inquiry|booking|kiosk`) was deliberately **left alone** — it configures
per-channel required-field toggles for the generic `PublicIntakeForm`/`InquiryForm`,
which `Gift.tsx` (a bespoke hand-built form) never reads.

---

## 5. `test/db` — confirming no regression

Ran the full suite from a fresh `wt-giftpath` worktree install
(`npx vitest run test/db --maxWorkers=4`), twice — once before the worktree move,
once after, both matching:

```
Test Files  46 failed | 25 passed (71)
     Tests  203 failed | 453 passed | 107 skipped (763)
```

This is the exact count the task doc and prior reports (CAREPATH, CREDITALIGN)
record as the pre-existing baseline. Specifically checked the two files whose names
are closest to this change:

- `test/db/request_inbox.test.ts` — fails at setup with
  `error: relation "offering_tiers" does not exist` (a stale seed fixture; that
  table was removed 2026-07-08 per `CLAUDE.md`). Unrelated to `requests.category`.
- `test/db/public_intake.test.ts` — fails on `intake_submissions` (a table
  `CLAUDE.md` records as **retired**) and an anon `form_definitions` read. Neither
  assertion touches `category`/`channel` values.

No test anywhere hardcodes the full allowed `category`/`channel` array as an
equality check (grepped for the literal list) — the widening is additive and
cannot break an existing assertion. `test/db/fixtures/schema_snapshot.sql` still
carries the pre-widen constraint text (it is a point-in-time dump, not
auto-regenerated per migration — true of every migration in this repo's history,
not something this task changed), but no test exercises `category='gift'` against
it, so it cannot fail from that staleness either.

`src/` unit/component tests: no existing test references `requestGift`,
`GiftPurchaseInput`, or `Gift.tsx` (grepped), so none needed updating.

---

## 6. THE TEST THIS MUST PASS — scorecard

1. **A gift enquiry can be started from lessons, horse care, and acquisition** — ✅
   code-verified (each page's Continue-row now carries the link) and build-verified
   (`dist/horse/index.html` and `dist/acquisition/index.html` both contain the exact
   link text after `npm run build`'s prerender step; `lessons/index.html` still
   contains its pre-existing "Buy as a gift" link, untouched).
2. **Submitting one creates the `requests` row AND produces a staff alert, with a
   provable per-attempt row** — ✅ for the `requests` row and the in-app dashboard
   alert (live RPC proof, §3). ⚠️ **NOT VERIFIED** for the actual `request_alert_sends`
   row and email send — see the owner checklist in §3 (requires a live browser
   submission; the two `/api/*` endpoints are unreachable from this session).
3. **The buyer's confirmation reflects what actually happened** — ✅ code path
   built and typechecked (`staffAlerted` state, §3); ⚠️ **NOT VERIFIED** live for the
   same reason as #2.
4. **Checkout is unchanged; no purchase path was touched** — ✅. `git diff main
   -- src/pages/Checkout.tsx` is a header-comment-only change. `submit_public_request`
   opens a purchase only when `request_selections` resolve to a real offering
   (§2/§3); `requestGift()` sends none.
5. **`gift_claim_link` / `redeem_gift` are reported on, not modified** — ✅ §4 of
   the previous section; confirmed via `pg_get_function_identity_arguments` against
   prod, unchanged signatures.
6. **Every DB claim is query output; NOT VERIFIED claims carry a numbered owner
   checklist** — ✅ this report's §1, §3, and §4 all cite the query or RPC call that
   produced the claim; the one thing this session could not verify (live email
   delivery) is called out in §3 with a 4-item numbered checklist.
