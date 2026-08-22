# TASK-DEALAUTO follow-up — F1, F2, F3 answered

**Branch** `task/dealauto-followup` (worktree `wt-dealauto2`), off `main` @ `c0fd887` · **not pushed**
**3 migrations applied to production** · 9 source files · 1 new regression test · 1 new workflow

The owner ruled on three of the seven items flagged in `TASK-DEALAUTO-REPORT.md`. All three are
built. One of them needed a question answered first; it was asked and answered before anything
was touched.

---

## F1 — a person is sent what their email is actually on

> **Owner:** *"they only get things sent to them based on their email being actually on it."*

**Where it was.** `/api/deliver-documents` sends, per recipient, one email with `allAttachments` —
every PDF in the request, regardless of whose document it is. That was harmless for its whole
life, because a delivery set used to be documents that shared their parties: the four documents of
an onboarding run all belong to one person, so "all the PDFs" and "this person's PDFs" were the
same list. DEALAUTO made a contract's **whole signing set** one delivery — a lease both sides are
on, plus each side's own role paperwork, which the other side is not a party to — and the first
real run of it emailed the lessee the lessor's signed liability release.

**The fix.** The endpoint already built a `contact → documents` index for its targeted path. It now
builds one on the default path too, and each recipient's email carries exactly the documents they
are a party to **and** have not already been sent. Delivery rows follow the same list, so
`document_deliveries` stays an honest record of what each person actually received.

The **company file copy is unchanged** — the org inbox still gets the whole set. It is the
business's own record of the transaction, not a party copy.

An audit recipient (the targeted "admin, send yourself a copy" case) is a party to nothing and
still receives everything — that path is explicit and unaffected.

**Proof:** `test/ui/dealauto_delivery_recipient_scope.test.ts`, 5 tests, over a two-document set —
a lease both parties are on plus a release only the lessor is on. It asserts attachment **identity**
per recipient, not the number of emails: the batching was already right, so "one email each" passes
on the broken version too. **Verified to fail on the old behaviour** before being accepted —
reverting the one line gives:

```
× sends the lessee the lease only — never the lessor's own release
  expected [ 'Horse Lease Agreement.pdf', …(1) ] to deeply equal [ 'Horse Lease Agreement.pdf' ]
```

---

## F2 — LESSOR and SELLER are not the same role

> **Owner:** *"lessor/seller are not handled the same. the seller doesnt retain authority to release
> liability or grant vet auth. [the buyer] inherits that upon signature on the BOS. so the docs
> invert for a BOS vs a lease. Lessee paperwork is handled separately and doesnt gate signing nor
> required after signing."*

### The horse documents follow authority, and authority moves on a sale
A lease does not transfer ownership: the LESSOR is still the owner the morning after, so the
emergency veterinary authorization and the care liability release stay with them. A bill of sale
does transfer it: the moment it executes the SELLER can authorize nothing and release nothing, and
the BUYER holds all of it.

**A defect fell out of asking the question.** `apply_contract_execution_effects` called
`ensure_horse_documents` in its lease branch **and never in its sale branch**. Every sale this
system has written ends with a new owner on record and no veterinary authorization and no care
release on file for them. The sale branch now calls it — placed **after** the ownership transfer,
so the generator's own "address it to the owner of record" rule resolves to the buyer without being
told who that is. That ordering *is* the owner's ruling, in one line.

**Why it could not simply be added.** `ensure_horse_documents` authorizes on the calling session:
staff, or the owner, or the lessee, or an active relationship row. On a lease that always holds. On
a sale **where the seller signs last** it never does — the transfer immediately above has just made
them the former owner and deactivated their OWNER row. It would have raised `not authorized for
this horse`, and this trigger has no exception handler, so **the seller's signature would have
rolled back.** `pg_trigger_depth() > 0` is now an accepted caller: an execution trigger acting on an
instrument that has already been authorized and sealed. Same distinction, same reason, as the
delivery fix in the first report.

**Proof — the exact dangerous case.** A bill of sale, buyer signs first, **seller signs last**:

```
D1: ownership moved                     owner_now = Walk1 (the buyer)
D2: the documents on this sale          HORSE_BILL_OF_SALE   → Walk1 BUYER   seq 1  EXECUTED
                                        HORSE_EMERGENCY_VET  → Walk1 BUYER   seq 2  locked
                                        RELEASE_HORSE_CARE   → Walk1 BUYER   seq 3  locked
                                        RELEASE_GENERAL      → Walk1 BUYER   seq 4  locked
```

Nothing addressed to the seller. Before this change: no signature at all, or none of these three
documents.

`contract_role_documents` now states it: LESSOR and BUYER carry the two horse documents, SELLER
carries neither. They are generated by `ensure_horse_documents`, not the role-bundle generator —
`owned_by` says so, and the generator skips what it does not own. That marker was gated on
`v_is_lease`, so on a sale it read `unassigned` and **the bundle generator would have made a second,
differently-shaped copy of each.** Keyed on the template now.

### The lessee owes nothing by virtue of being the lessee
`contract_role_documents` asked the LESSEE for COMPANY_POLICIES + FACILITY_RULES — which *is* the
onboarding wall, already collected from every client before any of this. Retired (not deleted:
`active = false` with the reason recorded on the row).

### The signing gate — asked, then removed entirely
"doesnt gate signing" could have meant the whole `onboarding_documents` blocker, only the client
side, or nothing at all. That is a legal-paperwork gate and being wrong in the permissive direction
is the bad direction, so it was **asked** rather than assumed. **Answer: off entirely.**

Removed: one of six blockers in `contract_lock_blockers`, which refused to lock or sign **any**
contract while **any** individual signer still owed a gating onboarding document.

Kept: all five others — open change requests, empty required fields, a signer with no full name, a
`LESSEE.PARTY_TYPE` that contradicts the party record, an unconfirmed horse section.

Untouched: the wall itself. `contact_document_wall_state` still computes it, `/app/onboarding`
still presents it, everything else that reads it still reads it.

```
E0: Walk3 still owes 4 onboarding documents (the wall is untouched)   gating = 4
E1: the same lease's blockers now                ["required_fields", "horse_unconfirmed"]
```

**The UI mirrored this guard independently and had to move with it.** `ContractPage` calls
`myWallState()` itself and hides the signing box on its own answer. Removing only the server check
would have left a contract the database accepts and the page still refuses to offer — the same
disagreement the mirroring existed to prevent, pointing the other way. Retired behind
`CONTRACT_ONBOARDING_GATE_RETIRED`; the banner JSX is unchanged.

⚠️ **Stated plainly, because it is the cost of the ruling:** a lease or sale can now be executed by
someone who has not signed a participant liability release.

---

## F3 — there is no scheduler, so here is one

> **Owner:** *"there are no crons setup on vercel and i dont know how to do that."*

**Confirmed, and it is worse than the delivery sweep.** `vercel.json` has declared five cron jobs
since they were written. Production evidence that none has ever run:

```
held_docs | oldest                        | newest
       10 | 2026-08-20 16:48:43-07        | 2026-08-22 02:34:11-07
```

Ten executed documents with `delivery_held_at` set and `executed_email_sent_at` NULL, the oldest
sitting there for ~46 hours. `/api/delivery-sweep` runs hourly and exists to release exactly those
— so that is ~46 consecutive missed runs. The same silence covers **everything time-based in the
product**: nothing expires, no calendar reminder is sent, no monthly allotment is minted, no
notification is nudged.

The endpoints are fine. All five are live and correctly return `401` unauthenticated. Only the
thing that calls them was missing. The likeliest reason Vercel ignores the block is the plan —
Hobby allows 2 cron jobs at daily frequency and this asks for 5 at hourly — and that is not
something a repository can fix.

**`.github/workflows/scheduled-jobs.yml`** is the replacement. This repository is public, so
scheduled GitHub Actions are free and unmetered. The schedules are copied from `vercel.json`
unchanged (both platforms use UTC, so nothing shifts). It fails loudly on any non-2xx — a scheduler
that fails silently is what produced the backlog above. It also carries a `workflow_dispatch` with
an endpoint picker, so **`delivery-sweep` can be run by hand right now to flush the ten stuck
documents.**

**Two settings, one time, both required:**

1. `openssl rand -hex 32`
2. **Vercel** → project → Settings → Environment Variables → `CRON_SECRET` = that value
   (Production), **then redeploy** so the running functions can see it.
3. **GitHub** → repo → Settings → Secrets and variables → Actions → New repository secret →
   `CRON_SECRET` = the same value.

`vercel.json`'s `crons` block is deliberately left in place. If the plan is ever upgraded the two
would double-fire — harmless, since all five endpoints are idempotent, but pointless; delete one
side at that point.

### And a hole that had to be closed on the way past
All five endpoints authorized on `isVercelCron || isManualRun`, where `isVercelCron` is nothing more
than *"the request carried an `x-vercel-cron` header."* A header is something any caller can send,
this site is public, and these endpoints mint credits, expire holds and send email. Five
byte-identical copies of the rule, which is how it survived in all five at once.

Converged onto `api/_lib/cronAuth.ts`: **if `CRON_SECRET` is configured it is required** — a
matching bearer, and the header alone will not do. If it is not configured, behaviour is exactly
what it was, so this cannot take the scheduler down in the window between deploying and setting the
variable. Compatible with both schedulers: Vercel sends `Authorization: Bearer $CRON_SECRET` on its
own cron invocations whenever the secret is set, and so does the workflow.

---

## Verification

| check | result |
|---|---|
| `tsc` app / api | **0 / 0** |
| eslint | **46 warnings, 0 errors** — identical to `main` |
| `test/db` + `test/ui` | **718 passed / 199 failed**, vs main's **713 / 199** — identical file-for-file, plus the one added file (its 5 tests are the whole difference) |
| bill of sale, seller signing last | proven in a rolled-back transaction (probe D) |
| onboarding gate off, wall intact | proven in a rolled-back transaction (probe E) |
| lease end-to-end, no regression | proven in a rolled-back transaction (probe F) |
| F1 attachment scoping | 5 tests, **verified failing on the old behaviour first** |

A note on that diff, because the first run of it was wrong and the reason is worth writing down:
four UI files "failed on the branch and passed on main." Neither was a regression. A fresh worktree
has no `.env` and no `dist/` — one set of tests instantiates the Supabase client at import and the
other reads the built CSS out of `dist/assets`. Copying the (placeholder) `.env` in and running
`npm run build:client` made the two runs agree exactly. **A test-suite diff between a fresh worktree
and a long-lived one is not a code comparison until the untracked build inputs match**, and the
failure looks exactly like a real regression until you read the error.

**Probe F is worth reading as the shape of the whole thing.** A lease between Walk1 (lessee) and
Walk2 (an individual lessor who owns the horse). The set generates as lease → vet auth → care
release → visitor release, **all four of the follow-on documents addressed to Walk2 and none to the
lessee**, and the whole thing goes out in **one** `net.http_post`. That post carried **seven**
documents, not four: the anchored selection also swept up Walk2's own three documents that have
been stuck in the hold since 2026-08-21 — which is the batching working, and precisely why F1 had to
be fixed in the same breath.

---

## What is still open from the first report

F4 (pg_net's 15s timeout is now routinely exceeded — succeeds, but records a false timeout),
F5 (hold rule (a) is far too broad and was deliberately left alone), F6 (`create_deal` left callable
and unreachable), F7 (already fixed — the horse documents were unsignable). Unchanged from
`TASK-DEALAUTO-REPORT.md`.

**F3 makes F5 much less dangerous**: the sweep is the backstop for every open-ended hold, and for
the first time it will actually run.

## Teardown

No dev server, no browser, no vitest left running; process census clean at report time. `.env.db` /
`.env.test` copied into the worktree, gitignored, not propagated. No production data was created by
this follow-up — every proof ran inside `BEGIN … ROLLBACK`.
