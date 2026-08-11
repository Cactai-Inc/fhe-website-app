# TASK DASHLEADS — the dashboard was relocated but never given the leads

**Owner, 2026-08-11:** *"the dashboard was relocated but not updated to include
notifications from inbound leads"*

This is an **unimplemented spec**, not a discovery. The owner decided this and the nav half
was done; the content half was never built.

## The decision, already made — do not redesign it

> *"one nav entry under management and it uses the dashboard layout and the leads are shown as
> dashboard entries."*
> *"inbound goes away. its my mangament dashboard which right now is showing up in the
> community app section."*
> *"yea dashboard badge absorbes the leads count and the leads live on the dashboard"*

Three things, all settled:

1. **Leads render as dashboard entries** — in the dashboard's own layout, not a list bolted on.
2. **The dashboard badge absorbs the leads count.** One badge, one number. The separate inbound
   count goes away.
3. **Inbound as a destination is gone.** It existed only to tell him a form was submitted.

## Where things are today

- Dashboard: `src/pages/app/InstructorHome.tsx` — subtitle already claims *"Lessons, clients,
  and requests you're servicing."* **It does not render requests.** The copy is ahead of the code.
- Leads: `LeadsPage`, exported from `src/pages/app/ops/ContactsPage.tsx`, routed at
  `/app/ops/leads` (`src/App.tsx:270`).
- Inbound/intake: `src/pages/app/ops/IntakePage.tsx`.
- **`requests` already holds everything** — INQUIRYMAIL proved it; the email now carries the
  full submission with no schema change. **You need no new columns.**

## What "done" means

The owner opens the dashboard and sees new inbound leads as entries, with one badge count that
includes them, without visiting a second page.

## Do NOT

- Do not delete `LeadsPage` or its route. Leads still live there until worked — the roster
  excludes LEAD deliberately. **Retire behind a boolean if anything, never delete.**
- **`AppLayout.tsx` is owned by UIBUILD and is actively being edited.** If you need a nav
  change, **report it** — it becomes a UI order. Do not edit that file.
- Do not build a notification system. The rows exist; render them.

## Constraints

Worktree `~/Downloads/claude-code-repo/wt-dashleads`, branch `task/dashleads`, off
`origin/main`. **Never `~/Desktop`.** Do not push. No staff browser session exists and you will
not be given one — prove the data and the built bundle, report the render as NOT VERIFIED.
Report to `docs/reports/TASK-DASHLEADS-REPORT.md`.
