# TASK FUNNELDOORS — two built, live, working funnels have no door

**FLOWTRACE §12's finding, re-verified on main 2026-08-15:** the self-onboarding funnels are
**built, merged, routed and live** — and **zero links anywhere lead to them.** BUILD_TRACKER
records the kiosk as never started, which is why the owner believed it was forgotten. It is not
forgotten; it is unreachable.

# WHAT WAS MEASURED (main, 2026-08-15)

```
/sign/:path   → SignStart      routed at App.tsx:170   (guest | rider | horse | rider+horse)
/release      → Release        routed at App.tsx:200   (visit-day kiosk release)
```
**Inbound links found in the entire codebase: ONE** — `Release.tsx:235` linking to `/release`,
i.e. the page linking to itself. Nothing in the marketing site, the nav, the header, the footer,
or any staff surface points at either funnel. **A visitor can only arrive by typing the URL.**

**They work.** FLOWTRACE established the visit-day release kiosk has already taken **7 real
visitors and 28 executed documents** — real people, real signatures, through a door only staff
knew existed. Six of those seven sat unworked for up to 30 days because nothing surfaced them.

# THE BUILD — doors, and a way to see who came through

## F1 — put the doors in
- **`/release` (visit-day kiosk):** the surface a visitor signs on arrival. It needs a
  deliberate, staff-reachable entry — a launcher from a staff surface (the Dashboard's
  needs-attention area or Calendar, where staff already are) that opens it for a walk-in.
  **Ask what it should NOT be: it must not be a public marketing link** — it is an on-property
  surface. State where you put it and why.
- **`/sign/:path` (self-onboarding):** these are the public funnels. They need real entry points
  from the marketing site — the natural homes are the lessons/horse/acquisition funnels and the
  footer. **Do not invent a new marketing page**; add links where an interested visitor already
  is. Match the site's existing link idiom (`link-underline`, `btn-*`), do not mint new styles.
- **Both:** every new link is a real `<Link>`/route that resolves — grep your own additions and
  prove each target renders.

## F2 — arrivals surface where staff work
- Someone who signs through either funnel must **appear in the staff needs-attention flow**, the
  same way an inbound lead does (INBOUNDALERT built that spine — reuse it, do not rebuild).
  The 7-visitors-unworked-for-30-days outcome is the thing this prevents.
- **A notification per arrival, provable** — one row per attempt (`request_alert_sends` is the
  model; see the fire-and-forget lesson in `orchestration/lessons/LESSONS.md`).

## F3 — correct the record
- **`docs/archive/BUILD_TRACKER.md` says the kiosk was never started. That is false and it is why this
  went unnoticed for a month.** Correct the entry to reflect what actually exists, and note the
  commerce half (kiosk purchase) that genuinely is not built, so the tracker stops lying in
  both directions.

# TRAPS
- **Do not build a second self-onboarding flow.** These exist and work. This task adds doors and
  visibility; if you find yourself writing a form, stop and re-read.
- The provisioning spine (`provision_client_invitation` family) is what these funnels feed —
  do not add a parallel account-creation path. One spine (D5, CLAUDE.md).
- **Records absorbed Lessons/Documents/Files/Deals as tabs (2026-08-15)** and the Review nav
  group was removed — rebase and look before touching nav or records surfaces.
- **Do not touch** `ContractPage.tsx`, `ClauseDocument.tsx`, `AddElementModal.tsx`,
  `PartyControlsCard.tsx` (concurrent thread owns them) or the booking-queue surfaces
  (`TASK-REVIEWQ`). Report diffs you need there; the orchestrator applies them.
- Standing rules: nothing deleted, executed documents are evidence, `assertWrote()` on writes,
  no BEGIN/COMMIT inside migrations.

# THE TEST THIS MUST PASS
1. From a cold start with no typed URLs, a visitor can reach `/sign/*` by clicking, and staff
   can reach `/release` by clicking. Name the exact click path for each.
2. A signature through either funnel produces a staff-visible item in an existing
   needs-attention surface, proven by query.
3. A notification row exists per arrival attempt, with its outcome.
4. BUILD_TRACKER's kiosk entries match reality in both directions.
5. Every render claim marked NOT VERIFIED with a numbered owner checklist.

Report to `docs/reports/TASK-FUNNELDOORS-REPORT.md`. Do not push; the orchestrator merges.
