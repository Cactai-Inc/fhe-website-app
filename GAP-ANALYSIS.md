# Gap Analysis — COMPLETE-ENUMERATION.md vs the repo (2026-07-10)

Statuses verified against the current preview/main tip. Legend:
✅ done/verified · 🔧 fixed since the enumeration was written · ❌ real gap ·
⚠️ enumeration is WRONG or superseded by owner direction (review with that in mind) ·
🔵 needs live/device testing (code present, behavior unverified) · ⛔ blocked

## A. App shape & navigation
- A1 ✅ Two surfaces (Main + Account); 11 old pages deleted with routes
- A2 ✅ superseded pages removed
- A3 ✅ rider = avatar menu only (showRail = isStaff)
- A4 ✅ staff desktop rail
- A5/A6 🔧 rail heading now role-split: "Servicing" (instructor) / "Management" (admin) / "Platform" (super admin)
- A7/A8 ✅ roles + isAdmin/isStaff/isTrainer/isSuperAdmin live
- A9 ✅ constraint honored — role changes admin-only (UI gate + DB role-guard trigger)
- A10–A13 ✅ logo→Main, borderless +, calendar, avatar badge
- A14 🔧 FIXED after enumeration: super admin sees Platform set ONLY; admin sees grouped Management; instructor Servicing + admin-granted extras
- A15 ✅ sign out in menu + Account

## B. Community feed
- B1–B12 ✅ views + per-view sorts as specced
- B13/B15 🔧 unseen badges now real (seed badges removed) AND posts mark seen on scroll — badges drain
- B14 ✅ All has no badge
- B16–B20 ✅ adaptive layouts (roster/grid/reading list/cards/masonry)
- B21 ✅ federation live; Resources also unions shared vendors
- B22 ✅ seed fallback exists; SEED_ENABLED now FALSE
- B23 🔵 needs eyeball pass
- B24 🔧 directory RPC widened (email/mobile/whatsapp + per-channel allow flags, hide-from-community enforced server-side)

## C. Create ("+") modal
- C1–C3 🔧 full per-type forms built (was minimal) — being reworked again THIS chunk for admin adaptation
- C4/C5 ✅ one media; discussions media-free
- C6 ❌ event invite-scope chooser (everyone vs specific people) — not built
- C7–C9 ✅ wired (feedPostCreate/createThread/proposeEvent)
- C10 ❌→🔨 create menu does not adapt per user type — THIS chunk adds the admin version
- ⚠️ NOTE: enumeration omits the operator controls (visibility / post-as-company / schedule) that exist and are owner-required

## D. For Sale / marketplace
- D1/D9 ❌ CONFIRMED: "free" is still a listing TYPE in CreateModal — must become a PRICE STATE of gear. Fixed THIS chunk.
- D2/D3/D4 ⚠️ ENUMERATION WRONG AS WRITTEN: owner directed the record-backed horse listing (spec H.9) — built: horse listings select from the member's listable records (no free-text path), with sale/lease intent driving server-enforced eligibility. The enum's "remove horse path / no sale-vs-lease field" describes the UI thread's lane, not the shipped record-backed implementation. Review knowing the shipped version is record-backed.
- D5/D6 ✅ listings pull descriptive fields only (name/breed/height/age/color/foaled)
- D7/K11 ✅ enforced server-side (can_list_horse + feed_post_create guard)
- D8 ✅ square grid

## E. Calendar
- E1 ❌ modal still compact (sm:max-w-md) — LARGE modal pending
- E2 🔧 real month grid built (dots per day, prev/next, tap-day panel)
- E3 ❌ week / day view toggles missing (list exists as the day panel, not a switchable mode)
- E4 🔧 list is no longer the whole calendar, but the four-mode switcher is pending
- E5 ✅ aggregates lessons/events/payments (+ role-aware: staff see whole barn)
- E6 🔧 selected day renders as a large serif date header
- E7 ✅ live sources; E8 🔧 payments wired (billing schedules); expirations/confirmations have no member-readable source yet — noted, not seed-faked
- E9 ✅; E10/E11 ⚠️ moot while SEED_ENABLED=false (seed data flaws remain in seed.ts if ever re-enabled)

## F. Account — You
- F1–F11 ✅ contact prefs live-wired (load + autosave; hide flags server-enforced); socials separate; notifications incl. payment-reminder toggle
- F5 ✅ no "Phone" label
- F12 ⚠️ PARTIAL: password set exists inside email-change; standalone change-password row is a stub
- F13 🔧 email-change backend fully built (tokens, MX Google detection, atomic promotion) — 🔵 needs a live email round-trip test
- F14 ❌ "switch to Sign in with Google" standalone flow not built (linkIdentity plumbing exists in the email-change google path)
- F15/F16 ❌ My posts manage view (edit/delete own posts) — row exists, page doesn't
- F17/F18 ✅; F19 🔵 documents panel reads seed-shaped source — real signed-docs source pending
- ⚠️ CORRECTION: "Good afternoon, Claire" hardcode + SEED_ACCOUNT rows purged; real profile/membership/billing render

## G. Email-change machine — G1–G9 🔧 all built server-side (see F13); 🔵 end-to-end test pending

## H. Billing & orders
- H1 🔧 next payment real (billing schedules); history = MyBalance
- H2/H3 ⚠️ membership "monthly/annual/pay-as-you-go" — memberships table has no such tiers yet; billing schedules cover monthly/weekly; PAYG is implicit. Needs product decision, not just UI.
- H4 ✅ orders page; H5 ✅ Zelle; H6/H7 ❌ payment-method update / responsibility-transfer endpoints not built
- H8–H11 🔵 Gifts panel actions are UI seams — backend endpoints not built (enumeration overstates DONE)

## I. Help — I1 ✅ wired to /app/support THIS chunk-prior; I2 ✅

## J. My Stable
- J1–J8 ✅ (horses now the REAL records via my_stable_* RPCs — richer than the enum's placeholder framing)
- J9–J15 ❌ CONFIRMED: item form is name+detail only — category list / conditional size / where-bought / price-paid / notes not built
- K9 🔧 AddHorseModal replaced by the standardized HorseIntakeForm (records intake) — SUPERSEDED as predicted

## K. Horse records boundary — K1–K8 ✅ honored; K3/K4 🔧 DONE (corrected migration applied); K10 ✅ (4 paths incl. staff add); K12 ✅

## L. Mobile — L1–L8 🔵 all need device passes (single-scroll shell + capped menus shipped; L4 pinned next-ride strip ❌ not built — DashboardPanel covers "coming up" instead: ⚠️ review intent)

## M. Theme — M1–M6 ✅/🔵 (uses repo tokens; eyeball pass advised)

## N. Seed
- N1/N2 ⚠️ moot in prod (SEED_ENABLED=false); flaws persist inside seed.ts if re-enabled
- N3 🔵; N4/N5 ✅; N6 ✅ authored, NOT applied (deliberate)

## O. Backend confirmations — O1–O7 ✅ ALL done (role RLS+guard, current_org exposed, directory widened, federation live, calendar payments, adminSetRole, stable contract reconciled)

## P. Process — P1–P4 ✅; P5 ⛔ purchase/sale template still blocked on owner reference doc

## Roll-up of REAL remaining gaps (Claude-lane + CC merged)
1. Calendar: LARGE modal + week/day/list mode switcher (E1/E3/E4)
2. Create: Free→price-state (D1/D9 — this chunk), admin-adapted menu (C10 — this chunk), event invite-scope (C6)
3. Stable item form fields (J9–J15)
4. My posts manage view (F15/F16)
5. Password standalone + switch-to-Google (F12/F14)
6. Gifts/payment-method backend endpoints (H6/H7, H8–H11 backends)
7. Membership tier model decision (H2/H3)
8. Documents panel real source (F19)
9. Mobile device pass (L*)
10. Purchase/sale template (P5 — blocked on you)
