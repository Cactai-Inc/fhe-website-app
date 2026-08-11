# SESSION STATUS — 2026-08-11

**Written for a context compaction. Supersedes `SESSION-STATUS-2026-08-10.md`.**
`main` = `a9b2042`, clean, in sync. **76 commits today.**

---

# 1. THE FOCUS

**LEADS. `LEADCLEAN` is the thread.** Owner, 2026-08-11: *"your job is… to keep us focused on
one thing at a time even when there are 10 threads running simultaneously."*

**⚠️ `wt-leadclean` does not exist — the focus thread has not been started.** Four others have.
Its prompt is in `docs/tasks/TASK-LEADCLEAN-the-dashboard-cleans-itself.md`.

**Leads is resolved when:** the 7 stale cards are gone by derivation (no staff action); the
three surfaces are one; the "and 1 more" control expands in place with a true count; Kit
Garcin's row is untouched; every count proven against SQL.

---

# 2. RUNNING

| thread | worktree | state |
|---|---|---|
| **LEADCLEAN** | **none — NOT STARTED** | **the focus** |
| UPLOADS | `wt-uploads` | started |
| ONEAUTHOR | `wt-oneauthor` | started |
| DOCQUEUE | `wt-docqueue` | started |
| MOBILEPASS | `wt-mobilepass` | started |

**Wave 2, start after Wave 1 merges** (all three touch `src/pages` broadly): ADMINSWEEP
(Opus/xhigh) · PAGEFRAME (Sonnet/high) · TITLESWEEP (Sonnet/medium).

**Held, deliberately:** INVITELINK · PARTYJOURNEY (build on INVITEWORKS' resend/regenerate,
unexercised) · BOOKFLOW (owner ranked it last).

---

# 3. SHIPPED TODAY — all merged and deployed

LEASEFIX 2o/2p + the addendum layer + the `[$|%]` share control · NOGUARD3 Phase A and B ·
CONTRACTORPHAN (parts 2–3, the NULL-guard fix, tiers 1–3 = 62 guards coalesced) · ROSTERCARD ·
INQUIRYMAIL · DASHLEADS · INVITEWORKS (resend/regenerate split, visible link log) · GOOGLEAUTH ·
DOCPACKET · FACILITYTERM · GIFTCREDITS · PURPOSEFIX · UIBUILD (UIO-013…018) · SUPERSEDE ·
HORSEDOCS · ROSTER DB layer.

**Nine threads archived and closed**; disk 4.7G → 785M. Every closed branch is recoverable at
`archive/<name>-2026-08-11`.

---

# 4. DECISIONS SETTLED TODAY — do not re-litigate

- **D1a — the platform owner is not a tenant.** In `CLAUDE.md` + `docs/reference/D1a-…md`.
  `admin@cactai.io` has `org_id` NULL **by design**; being denied by tenant surfaces is
  **correct**. Three threads reported it as breakage; all three were wrong. **Never give that
  account an org.**
- **Insurance — every question closed.** B2, C4, D3, D3a, E1 (no deductible cap), E2 (blank
  frequency = deliberately unspecified), E3 (CCC stall absorbed by `Other`), G1 (ClauseDocument
  share control approved). All in `TASK-LEASEFIX-ADDENDUM-2026-08-10.md`.
- **Files are separate, and they are not ours.** Owner: a file belongs to whoever uploaded it,
  or to the company. Closes `DOCUMENT_LIBRARY_DESIGN.md` Open Question 2 **against** its own
  recommendation. Ownership is a recorded column, never inferred from who clicked upload.
- **`+ Add new` surfaces a picker modal** — supersedes that doc's §J2, which said delete the
  button.
- **Working order: leads first, orders/payments/booking LAST.** Supersedes the earlier
  "BOOKFLOW is the launch blocker" framing.
- **Kit Garcin is the LAST test, after BOOKFLOW is proven.** One clean reserved lead; never
  spend it on an intermediate test. Throwaway identities for those.
- **GOOGLEAUTH:** manual linking IS enabled (owner verified in Supabase); the password survives.

---

# 5. STANDING RULES ADDED TODAY

- **Empty is not a finding.** Pre-launch counts are the expected state. A finding is something
  that would still be wrong once the feature works.
- **Verification policy.** No worktree gets a staff login; the owner confirms renders. Threads
  report the render as NOT VERIFIED and never simulate one.
- **Apply, don't hold.** The old stop-for-review default parked correct work for days —
  LEASEFIX and NOGUARD3 Phase B both sat built and unapplied. Threads apply their proven work.
- **Migration traps:** no self-contained `COMMIT;`; **never reuse another migration's temp
  table name** (two used `_lf` and could not run together).
- **One focus, however many threads.** `docs/ORCHESTRATOR-HANDOFF.md`, with the day's three
  concrete failures cited.

---

# 6. THE FAILURE MODE THAT KEEPS RECURRING

**Code that reports success while doing nothing.** Five instances today, five subsystems:

1. NULL guards skipping their own `IF` body — one was a **live** hole letting the platform
   owner delete a tenant document
2. `border-green-900/12` — `/12` absent from the Tailwind scale, **emitted no rule at all**;
   the sweep then found `/8` missing too, 6 more sites
3. A `REVOKE` reporting success and changing nothing — three separate historical cases
4. `redeem_gift` passing an **empty array** rather than NULL, silently skipping document
   assignment while the doc recorded it as "built ✓"
5. `.eq('status','sent')` silently deleting a capability the owner had explicitly asked for

**Therefore: prove the row count, the compiled CSS, the composed prose — never the absence of
an error.**

---

# 7. LIVE, UNFIXED

- **CONTRACTORPHAN Part 1** — 2 Beaumont documents unsignable; **the owner deletes them from
  the integrity panel himself**. Migration written, deliberately unapplied.
- **29 definer guards still bare** (62 coalesced). Non-destructive remainder.
- **No trigger provisions `profiles` at signup** — 2 of 10 auth users have none, so every fresh
  signup starts as the NULL-org caller the guard work hardens against.
- **`hello@` holds 6 live invitations, `cjzigs@` 3** — supersede stops new stacking; the
  existing pile was not swept.
- **`admin@cactai.io` still holds 1 `contacts` row** — D1 says zero.
- **`https://fhequestrian.com` has no TLS listener** (Namecheap URL forward is HTTP-only). Fix
  is a Supabase Custom Domain, which also unblocks OAuth consent-screen branding. **Owner's
  dashboard work, not a thread's.**
- **`/app/ops` is unreachable from any nav link** — open routing question, touches
  `AppLayout.tsx`.
- **`test:db` broken**, 55 of 64 files failing. Every DB claim is hand-verified because of it.

---

# 8. THE DOCUMENT PROGRAM — sequenced, not started

Discovered today: **6 of 20 active templates are clause-composed** (163/114 for the four lease
variants, which carry *identical* counts and may be duplicates — flagged for report);
**14 are flat markdown with zero clauses and no authoring UI at all.**

1. **ONEAUTHOR** — one page serves both. `ContractPage.tsx:498` already handles the
   no-structure case; only 32 contract-specific references in 2,189 lines.
2. **The picker** (in DOCQUEUE) — contract-class cards open authoring, onboarding-class cards
   assign-and-generate. Route by whether clause defs exist; never a hardcoded key list.
3. **Conversion** — flat templates become clause-composed one at a time. `HORSE_LEASE_V2` is
   the proof it works and took a dedicated thread for one template. **Not started, not scoped.**
