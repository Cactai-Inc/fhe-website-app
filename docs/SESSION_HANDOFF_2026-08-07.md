# Session handoff — 2026-08-07

**Read this first if you are picking up orchestration.** It states what is true, what is
decided, what is waiting on the owner, and what to verify. `main` = `532915e`, everything
pushed, working tree clean.

---

## Process — non-negotiable, restored from the owner's original method

Drift away from these is what produced the confusion this document exists to end.

1. **The canonical repo is `/Users/Cactai/Downloads/claude-code-repo/fhe-website-app`.**
   There is no other. **Never `~/Desktop`** — an iCloud sync destroyed a clone there and
   NULLUID's four migrations plus its report survived only by hand-copying off the disk.
2. **Every prompt opens with the repo path and two CONFIRM checkpoints.** Full text in
   `docs/THREAD_REGISTRY.md`. A thread that cannot print a CONFIRM stops and says why.
3. **Every thread has an ID** — used as its label, branch (`task/<id>`), worktree
   (`wt-<id>`) and report (`TASK-<ID>-REPORT.md`). Put the ID in the prompt's first
   natural-language sentence; a `THREAD ID:` header gets discarded by the auto-titler.
4. **Never trust a self-reported "done".** Audit against the live DB/repo before merging.
   Every claim in this session that was checked, held — but three of the orchestrator's own
   claims did not (see "Mistakes" below).
5. **One task per thread. Own worktree. Stop-and-ask gates.** Migrations dry-run in
   `BEGIN … ROLLBACK` with raw output, then apply.

## Standing constraints

- **Sarah's document `704c8d2d-d179-43f9-8a4a-7ea8cb920ab9` is a LIVE NEGOTIATION** —
  read-only, never write. Verified `AWAITING_SIGNATURE` at session end.
- **`ClauseDocument.tsx` is FROZEN** — scoped exceptions only by orchestrator approval.
- **Executed documents are never swept.** Imperfect ≠ invalid. Re-signing supersedes and
  retains.
- **`signed_template_version` is evidence** of what a person actually signed. Never rewrite
  it to make a symptom disappear. Change what the gate asks of it.
- `redeem_gift` is intentionally anon-callable (`/redeem` is a public route).

---

## What shipped today

| ID | What |
|---|---|
| `WALLSYNC` | One shared satisfaction predicate; explicit re-sign = supersession; **Madeline released** |
| `ACCOUNTSURFACE` | All 10 account rows expand in place; `/app/stable` route; Documents reconciled |
| `ONEMENU` | One menu moved right, avatar dropdown absorbed into rail + drawer |
| `LEASEFORK` | Lease template forking + picker; **fixed an anon hole it had introduced** |
| `NULLUID` | 49 functions exposed by a NULL-propagating guard — **fixed at the root** |
| `SECFIX` | Three production vulnerabilities |
| `WALLRETURN`, `TIPTAP`, `LEASEMAP`, `ACCTEVAL`, `BP410`, `SIGREAD`, `PLUSPASS`, `PARTYRLS` | merged |

Plus two DB fixes applied directly by the orchestrator: the `signed_template_version = 0`
backfill (19 rows) and the NULLUID migration recovery.

### The incident that started it

Sarah reported an empty documents page. Root cause was **not** her account: four separate
copies of "is this required document satisfied?" existed, and they disagreed. The wall was
version-aware, the onboarding page was not, so members who had already signed were trapped
in a room whose only exit said "nothing to do". **3 of 4 account holders were walled; 2
were deadlocked.**

Underneath it: `contact_required_documents` has **no version column**, so bumping any
template body silently re-papered every prior signer. The 2026-08-02 contract sprint bumped
all 9 wall-gating templates. Nobody had decided anyone must re-sign — the wall was
enforcing a decision that had been correctly queued and never answered.

---

## WAITING ON THE OWNER — nothing moves until these are answered

### 1. Six template version decisions (the big one)

`pending_version_decisions()` → `ALL` / `SELECTED` / `NONE` per event, via
`resolve_version_decision()`. Visible to all three staff accounts. **All six queued
2026-07-28, still unresolved.**

| template | bump |
|---|---|
| `RELEASE_PARTICIPANT` | 2 → 3 |
| `HUMAN_EMERGENCY_MEDICAL` | 1 → 2 |
| `HORSE_EMERGENCY_VET` | 1 → 2 |
| `RELEASE_HORSE_CARE` | 1 → 2 |
| `COMPANY_POLICIES` | 0 → 1 |
| `FACILITY_RULES` | 0 → 1 |

**This is a legal-materiality judgement about the 2026-08-02 wording changes.** Until
answered, nobody is asked to re-sign anything — the system no longer decides on its own.

### 2. Lease picker labels — NOT YET DONE

`HORSE_LEASE_V2`'s title is plain "Horse Lease Agreement", so the picker shows **"Default"
and that title as two routes to the same template.** Owner said "give both the appropriate
label" but the labels themselves were never supplied. **Still outstanding.**

### 3. Contradictory insurance terms — proposal awaiting sign-off

From `TASK-LEASEMAP-REPORT.md`: `RISK_OF_LOSS` and `MED_TAIL` print **unconditionally**, so
whenever a Lessee takes on a cover the document asserts both allocations at once. And a
**blank** insurance status still prints its sentence, reading as an affirmative covenant —
live now in draft `215bac09`.

**Proposed (orchestrator, not yet approved):**
1. Add `INSURANCE_RISK.RESIDUAL_BEARER` (`LESSOR` | `LESSEE` | `SHARED`), defaulting to
   `LESSOR` so nothing changes unless deliberately elected.
2. Gate `RISK_OF_LOSS` and `MED_TAIL` variants on it, so the document states one allocation.
3. A blank status **suppresses its sentence entirely** rather than printing a headless
   covenant.

This is legal wording. **Do not build it without the owner's sign-off on the three variants.**

### 4. Google sign-in — owner's answers recorded

- **Password survives linking: YES.** Owner's reasoning: removing it would also require
  removing the email address, otherwise there is an orphaned access method. Two genuinely
  different login options stay active until the member removes one.
- **Manual identity linking is enabled in Supabase Auth: YES** (owner confirmed).
- Still unproven in this project: **cross-email linking**. Every identity in production has
  an identity email equal to its account email. `TASK-GOOGLEAUTH` makes proving this step 1.

---

## UVT — what to actually test

Nothing below has been clicked in a browser by anyone. Both UI threads flagged this
honestly — no Supabase credentials existed in their worktrees.

### Access / the incident (highest value)

1. **Sarah** signs in → lands on the **community feed**, not "nothing to do". Documents page
   lists 8 documents. Her lease `704c8d2d` opens.
2. **Madeline** signs in → **not walled**, reaches the app normally.
3. **Mary** signs in → **still walled**, onboarding lists **6** documents, and she can
   actually sign them and get out.
4. No member is shown a document to sign that they cannot then complete.

### Navigation / account

5. One menu, on the right. Avatar dropdown is gone; its contents are in the rail/drawer.
6. Every nav item opens its **own page**; every Account row **expands in place**. No
   exceptions.
7. `/app/stable` is its own page — "My Stable" and "Account" are no longer the same
   destination. Old `?section=stable` links still land somewhere sensible.
8. All ten rows read "My …"; **Account itself stays plain "Account"**.
9. Documents page still offers signing, email-a-copy, the supersede badge, and PaperViewer
   reading — from **both** the page and the account panel.

### Layout

10. Account page usable at **390px** with heavy panels expanded.
11. Header in **landscape** shows the full name and fills the width.
12. Contract editing page — the subheader must **not** slide under the header.
13. Sign-out is reachable on a real iOS device (safe-area).

### Security (verify these stay closed)

14. `platform_tenant_detail` as anon → **401**, not your admin dossier.
15. `set_org_module` as anon → permission denied.
16. Gift redemption from the public `/redeem` route **still works** (`redeem_gift` must stay
    anon-callable).

---

## Mistakes made this session — recorded so they are not repeated

The orchestrator's own errors, all caught and corrected:

1. **Specced `TASK-GOOGLEAUTH` twice without reading the codebase** — invented a
   request/notify-staff flow, then a duplicate-account flow, when `linkIdentity`,
   `listLinkedProviders` and `startGoogleChange` were already built. The owner's
   duplicate-account proposal was a sound response to a constraint that did not exist,
   because the orchestrator had asserted one.
2. **Prescribed the Bug B fix backwards** — said the wall was the correct half. It was not.
   Corrected only because the owner said he had never sent a re-sign request.
3. **A merge test reported "clean" for two branches that did not exist in that clone** — the
   check grepped for "conflict", so a ref-not-found error read as success.
4. **Reported 0 pending version decisions** — had queried as a test identity
   (`cjzigs@icloud.com`, role `USER`) rather than a real staff account.
5. **Prompts never named the repo path**, which is why threads found the `~/Desktop` clone.

The pattern in all five: **asserting before verifying.** Query first.

---

## IN FLIGHT — the incoming orchestrator's first job

Three threads were dispatched by the owner at the end of this session. **Audit each report
against the live DB/repo before merging. Do not accept a self-reported "done".**

| ID | What | Prereqs | Watch for |
|---|---|---|---|
| **SECFIX2** | Two holes **open in production** — `ensure_gift_buyer_account` anon-callable and reaching the locked `_ensure_client_account`; `member_directory` `security_invoker = off` | none | Re-check `has_*_privilege()` yourself. Confirm `redeem_gift` is still anon-callable and gift redemption works — a lockout is worse than the exposure. |
| **LEASEGATE** | Phase 1 analysis only, **hard stop** for owner review | LEASEFORK + TIPTAP ✓ | It must NOT have written a migration. `HORSE_LEASE_V2`/`_FULL`/`_SIMPLE` byte-identical **by checksum**. |
| **LEASESIMPLE** | Keep/cut worksheet; makes **no** content decisions | LEASEFORK ✓ | It must have changed no template at all. |

All three were dispatched **with** the mandatory preamble.

### Verify-before-merge checklist that caught real problems this session

- Test-merge with `git merge-tree`, but check the **exit code**, not just the word
  "conflict" — a ref-not-found error otherwise reads as success.
- Run `typecheck`, `typecheck:api` and `build` **on the merged result**, not on the branch.
  Two integration defects were found only this way.
- Query production as a **real staff account**, never a test identity — `cjzigs@icloud.com`
  is role `USER` and silently returns empty staff results.
- After any merge, grep for cross-thread hand-offs the threads flagged but could not
  resolve themselves.

### NULLUID's own recommended follow-ups (not yet tasked)

1. **Audit the no-guard family** — anon-callable definers with *no* guard at all. NULLUID
   ranked this above anything left in its own area; its searches all keyed on a guard
   existing.
2. `profiles_role_guard`'s `auth.uid() IS NULL → RETURN NEW` — latent.
3. **`test:db` is broken on `main` — 55 of 64 files failing, so that suite is currently
   protecting nothing.**
