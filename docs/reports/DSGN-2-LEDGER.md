# DSGN-2 · LEDGER

**Opened 2026-09-01 · Role:** `docs/method/DSGN-ROLE.md` · **Thread name in prompt:** `DSGN-SIGN-FLOW`
**Assignment:** prepare **CR-98** (the `/sign/*` flow) and **CR-99** (request cards) for build, from
the CHANGE-ORDER-LEDGER directly (no DISCO handoff — ORCH6 measured CR-98 itself, and the owner's
14-step flow in CR-98 is the ruled criteria).
**Standing order from the dispatch prompt:** ⚠️ **emit the STRIP spec FIRST and alone** — the
unauthorised purchase block off every `/sign/*` page — **then chunk the rest.**

---

## RESUME

**State:** ✅ **DSGN-2 IS COMPLETE.** Four specs + handoff written and committed.

**Delivered:**
- `docs/tasks/TASK-SIGNSTRIP-the-unauthorised-purchase-block-comes-off.md` *(URGENT, emitted first
  and alone, committed separately at the top of this thread)*
- `docs/tasks/TASK-SIGNDOOR-the-sign-page-asks-for-the-email-and-nothing-else.md`
- `docs/tasks/TASK-SIGNBOOK-the-wizard-ends-in-a-booking-request-not-a-payment.md`
- `docs/tasks/TASK-REQCARDS-the-request-card-is-an-action-surface-and-both-ends-press-buttons.md`
- `docs/reports/DSGN-2-HANDOFF.md` — order, contention, model picks, A1–A3 ASK-OWNER, six decisions

**Open at close:** A1 (docs-by-path vs OFFERINGDOCS) blocks SIGNBOOK dispatch; A2 (REQCARDS §9
shape) blocks REQCARDS build; both routed through ORCH. A returned build gap comes HERE
(`DSGN-ROLE.md` §1): say spec-vs-build plainly, amend, add it to THE TEST, tell ORCH in two lines.

**Additional measurements past §1** (queries inline): step 2 auth gating is BUILT —
`src/lib/emailAuthMethod.ts` (gmail→google, known non-google→password, else both; owner spec
2026-07-25), consumed by `Register.tsx:82–92`. Wizard machine: `Onboarding.tsx:90` —
`order|details|horse|shop|sign|payment|slots|done`, payment inside the wizard. Payment component:
`src/components/order/OrderPayment.tsx` (cash/zelle, `reportMyPayment`). Staff card surface:
`grep -rn "RequestCard" src/` → none; only `PaymentReviewPage.tsx` as prior art.
`attach_minor_to_guardian` lifted out of `update_my_onboarding_profile` at `20260831T0910`
(per `api/sign-start.ts` header).

---

## 1 · MEASUREMENTS — CR-98 re-verified 2026-09-01 on main @ 475f1724

| Claim | Query | Result |
|---|---|---|
| One file serves all four funnels | `sed -n '187,188p' src/App.tsx` | `/sign` → SignChoose, `/sign/:path` → SignStart ✅ |
| 1047 lines | `wc -l src/pages/SignStart.tsx` | 1047 ✅ |
| String at :662 | `grep -n "able to purchase" src/pages/SignStart.tsx` | 662, sole hit ✅ |
| Block on EVERY funnel | read 680–710 | guard is `!outcome && path !== 'deal'` — guest/rider/horse/rider+horse all render it; guest gets alternate heading "Services we offer once you're onboarded" (660–662) ✅ |
| Nowhere else | `grep -rln "able to purchase\|Services we offer once" src/` | SignStart.tsx only (CalendarPage:1240 is a different string, false positive) |
| Block's full footprint | `grep -n "catalog\|offerings\|Offering\|PATH_SEGMENTS\|fetchPublicCatalog\|Segment" src/pages/SignStart.tsx` | import :82–83 · PATH_SEGMENTS :122–130 · state :440–441 · effect :443–455 · heading :660–662 · section :680–710 · stale comment refs :29, :64 |
| `fetchPublicCatalog` other users | `grep -rln fetchPublicCatalog src/ api/` | ServiceSelector, publicCatalog.ts, BookHorse, BookRider, BookSupport, Lessons — **lib stays** |
| Spam notice + report link already exist | `grep -n "spam\|report" src/pages/SignStart.tsx` | SendStateScreen has both (:264–265, :351, escape hatch per :13) — CR-98 step 1's confirmation is ALREADY the incumbent |
| Browser tests on this page | `ls test/browser/ \| grep sign` | `sign-start.tsx/.html`, `probe-sign-minor.mjs` — strip thread must keep them green |

**Worktrees:** wt-1..wt-5 all parked at `14140564`; `git branch --no-merged main` is empty — no
visible unmerged build touches SignStart.tsx. (ORCH holds live-thread state; contention noted anyway.)

## 2 · NOTES FOR THE REMAINING CHUNKS (raw, pre-spec)

- `api/sign-start.ts` header block: full intake POST (name/phone/address/minor), provisions via
  `provision_client_invitation`, sends the admin invitation email, records `signup_attempts`;
  anti-enumeration + rate limit (10/hr per requester hash). **Email-only reduction lands here AND in
  SignStart.tsx — one seam.**
- Owner's step 2 (auth setup page, google-or-password): candidates `Register.tsx` /
  `RegisterComplete.tsx` / `Redeem.tsx` — not yet measured.
- Steps 3–9 (post-auth: min personal info by path → docs → offering → calendar → booking request →
  email bundle → overview modal): `Onboarding.tsx`, OFFERINGDOCS ruling (docs come from the
  offering), BUYANDBOOK, WALK1 (booking gated on payment confirmation) are the incumbents to measure.
- Steps 10–14 + CR-99: same seam — staff-side of CR-97's machine (`requested → approved → pending →
  scheduled`), TASK-LIFECYCLE spec (DSGN-1) is the incumbent state machine; CASHCONFIRM +
  ZELLECLOSE built the pay-cash/pay-zelle halves already.
- CR-99 is **captured, not ruled** — card style + cluster location need the owner's eyes (SHAPE, §4).
