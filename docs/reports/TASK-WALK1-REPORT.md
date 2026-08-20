# TASK-WALK1 — REPORT

**Status: STOPPED AT PHASE 0, BEFORE ANY CONTACT WITH THE LIVE SITE.**
Branch `task/walk1`, worktree `~/Downloads/claude-code-repo/wt-walk1`. Committed, not pushed.

**This is the second stop, against the updated spec** (task doc at `bfb2da0`, read in full before
continuing — §2 tooling, §3.1 identity, §3.3 money). **The blocker did not change: `.env.test`
still does not exist.** What changed is *why* that is now surprising, and it is worth reading.

---

## The three answers §7 asks for, up front

**1. The test identity — NONE WAS CREATED.**
No WALKTEST identity exists. No address was used, no signup was attempted, no email was sent.
The address the walk *would* have used, per §3.1, is `cjzigs+walk1-<yyyymmddHHMM>@icloud.com`
with last name `WALKTEST`. It was never minted because the walk never reached the site, so
**whether plus-addressing survives the signup path is still untested** — that verification is
§3.1's own requirement and it remains open.

**Rows created in production by this run: ZERO.** Nothing to purge. The browser was never pointed
at the live site: no anonymous page load, no form, no signup, no booking, no payment declaration.

**2. Does mail work? — UNANSWERED, and it stays unanswered.**
This is the question the task was built to settle, and the stop leaves it exactly where it was:
production still reads 46 `notifications` rows with `emailed_at` NULL on all 46, and 2 proven
sends ever. **WALK2 and WALK3 are still blocked on it**, because §1 makes them dependent on this
answer.

**3. The single most important finding.**

> **`.env.test` was set up but never filled in. The template exists; the file does not.**

Commit `bfb2da0` — *"chore: .env.test for browser-walk credentials — gitignored, with a template"* —
did two of the three things needed, and the third is the one that unblocks the walk:

| what `bfb2da0` did | state |
|---|---|
| added `.env.test` to `.gitignore` (now line 39) | **done** — this closed finding W1-1 from the first stop |
| added `.env.test.example`, a 6-line template | **done** |
| created the real `.env.test` with values | **NOT DONE — the file does not exist** |

Verified by direct listing of the repo root and by
`find ~/Downloads/claude-code-repo -maxdepth 3 -name ".env.test"` excluding `node_modules`:
**zero matches anywhere.** The repo root holds `.env`, `.env.db` and `.env.test.example` — and no
`.env.test`.

**The template is also incomplete as shipped**, which matters because copying it is not enough:

- `FHE_ADMIN_EMAIL` is pre-filled with an address.
- `FHE_ADMIN_PASSWORD=` is **empty**.
- `FHE_SITE_URL=https://` is a **bare scheme with no host** — the walk has no site to drive.

So even `cp .env.test.example .env.test` leaves the walk unable to sign in *and* unable to
navigate. **Two values must be typed in by hand: the admin password and the live site URL.**

§2 makes absence an unconditional stop — *"do not proceed and do not ask for it in chat"* — so
this thread neither proceeded nor asked, and the two missing values are named here rather than
requested in conversation.

---

## The walk

Not run. §A, §B, §C, §D and §E were never entered. Each is recorded below as unattempted so the
next thread inherits an accurate ledger rather than a silent gap.

| § | what it would have answered | state |
|---|---|---|
| A | anonymous visitor books a lesson, end to end | **NOT RUN** |
| B | `/sign/rider` cold — 0 `signup_attempts` ever — from link to landed session | **NOT RUN** |
| C | Book with no credits: buy in place, or deflect to catalog | **NOT RUN** |
| D | all 9 `RIDING_LESSON` offerings, website vs app, name and price | **NOT RUN** |
| D⚠ | the 4 recurring offerings: what is minted, when, expiring when, cron or not | **NOT RUN** |
| E | notifications across dashboard / admin dashboard / email | **NOT RUN** |

**Screenshots: none.** `docs/reports/walk1-shots/` was not created — an empty directory would
imply an attempt was made. Zero numbered steps were reached, so zero shots exist.

**§D's website column is worth noting as still-open even though it needs no credentials.** The
public marketing side could in principle be read anonymously. It was not, because §2's stop is
written as unconditional — *"do not proceed"* — not as *"skip the authenticated parts."* A partial
walk that quietly redefines its own gate is the thing §3.6 exists to prevent.

---

## The updated payment rules, carried forward unexercised (§3.3)

Recorded here because §3.3 was rewritten after the first stop and **none of it was testable**.
This is the next thread's checklist, not a set of results:

- **Zelle and cash only. Stripe is out** — owner: *"kill stripe mode, its not setup and we dont
  need it now."* No card is ever to be submitted.
- **Both manual options must be exercised** — one purchase paid by Zelle, one by cash.
- **If any surface offers a card option at all, do not use it and record that it was offered** —
  presenting an unconfigured payment method is itself a defect.
- **Both declarations must be left UNCONFIRMED, with their purchase ids recorded**, because WALK2
  needs unconfirmed claims waiting for it.
- **"Nothing blocks" is an acceptance test, not a permission.** After declaring payment the user
  must be able to continue, **booking included**. Anything gated on confirmation is a **defect**,
  since the real control is operational: the lesson never happens until payment is verified.

**Nothing above was observed.** Every line is untested.

---

## Every stop, with its reason (§6.9)

**STOP 1 — Phase 0, credentials gate. `.env.test` absent at repo root.** (first run)
Verified by listing the repo root and `find -maxdepth 2 -name ".env*"`: only `.env` and `.env.db`
present. §2 makes absence an unconditional stop. Reported, with the `.gitignore` gap as W1-1.

**STOP 2 — Phase 0, credentials gate, again. `.env.test` still absent.** (this run)
The spec was updated and `bfb2da0` landed the gitignore entry and a template, but not the file.
Re-verified across the whole `claude-code-repo` tree, not just the repo root: **no `.env.test`
exists.** Same rule, same stop. The walk ends here.

**Neither run reached a second decision point.** In particular §3.3 was never met, so no payment
surface was seen and no card option was either used or observed — the "was a card offered at all"
question is open, not answered in the negative.

---

## Phase 0 — what was installed, and where (§2 requires this stated exactly)

Phase 0 tooling is **complete and verified still intact after merging `bfb2da0`**. It touches no
production system and is a prerequisite the next run would otherwise repeat, so it was finished
rather than abandoned.

**Confirmed first — the task doc's claim held:** no Playwright, Puppeteer, Cypress or Selenium in
`package.json`, and none in `node_modules/.bin`.

**Installed: Playwright 1.62.1 + Chromium (Chrome for Testing 151.0.7922.34).**

- Location: **`wt-walk1/walk1-tooling/`** — a worktree-local directory with its own `package.json`,
  installed via `npm install --no-save playwright`.
- **The repo's `package.json` is untouched.** Verified again after the merge: `git status --short`
  in the worktree is clean, no modification to `package.json` or `package-lock.json`. Nothing can
  deploy to Vercel from this.
- `walk1-tooling/` contains a `.gitignore` holding a single `*`, so the directory ignores itself
  and its contents entirely. **The tooling cannot be committed even by accident.**
- Chromium binaries live in Playwright's shared user cache,
  `~/Library/Caches/ms-playwright/chromium-1234`, not inside the repo.

**The harness was smoke-tested and works.** A headless Chromium launched, rendered content, and
returned queried text (`SMOKE_OK`), then closed. The test rendered a local string — **it did not
navigate to the live site or any network origin.** So the next run starts with a proven browser,
not an unverified download.

---

## Flagged, not fixed

Per §5, this walk changes no application code. It changed no configuration either — including the
empty template values below, which are the owner's to supply and must not be guessed at.

| # | finding | state | why it matters |
|---|---|---|---|
| W1-1 | `.gitignore` had no `.env.test` entry | **CLOSED by `bfb2da0`** — now line 39 | was: a live-site credential at the repo root would have been tracked and committable |
| W1-2 | **`.env.test` does not exist**; only `.env.test.example` does | **OPEN — this is the blocker** | WALK1 cannot run. WALK2 and WALK3 are specced downstream of WALK1's email answer, so all three walks are blocked by one missing file. |
| W1-3 | **The template ships with `FHE_ADMIN_PASSWORD=` empty and `FHE_SITE_URL=https://` hostless** | **OPEN** | Copying the template is not sufficient — two values must be typed in by hand, or the next run stops a third time at the same gate with a file that technically exists. |
| W1-4 | Stripe live-or-test mode undecided | **CLOSED by owner ruling** — Stripe is out, Zelle and cash only | removes a gate the next run would otherwise have hit at first purchase |
| W1-5 | Stray long-running `vitest run test/db --maxWorkers=2` (PID 50025, started 16:21) | **OPEN** | still at 0.0% CPU hours later; it belongs to another thread, so this one did not kill it. Flagged for the orchestrator. |

---

## Teardown

**Browser processes: none left running.** The Playwright smoke test closed its browser; a census
found no `chromium`, `headless_shell` or Playwright processes owned by this thread. The Google
Chrome processes present are the owner's own everyday browser and were not touched.

**Dev processes started by this thread: none.** No dev server, no vitest, no DB session was
started. `.env.db` was never used to open a connection — and under §3.8 this thread does not query
the database to explain behaviour in any case.

**Process census at teardown:**

| process | owner | disposition |
|---|---|---|
| Playwright / Chromium / headless_shell | — | **none running**; smoke test closed cleanly |
| `npm exec vitest run test/db --maxWorkers=2` (PID 50025) | another thread, from 16:21 | **left running**, flagged as W1-5 |
| Google Chrome (PIDs 2192 and helpers) | the owner | **left running**, not this thread's |
| `claude` CLI sessions (PIDs 940, 1067, 47509, 49535) | parallel orchestration threads | **left running** |

**Credential hygiene.** No credential appears in this report, in any commit, or in any screenshot
— there are no screenshots. `FHE_ADMIN_PASSWORD` and `FHE_SITE_URL` are named as *keys needing
values*; no value for either was read, guessed, or written anywhere. One handling slip from the
first run is recorded plainly: an early key-name inspection of `.env.db` printed that file's line
to the terminal, and because the file holds a bare connection URL rather than `KEY=value` pairs,
the line was the connection string itself. It went to that session's terminal only; it is not in
this report, not in any commit, and not in any file this run wrote. No action is required, but the
owner should know it surfaced.

---

## What the next thread needs — one item

**Create `.env.test` at the repo root with all three values filled in.** It is already gitignored,
so it cannot be committed.

```
cp .env.test.example .env.test
```

…then **type in the two blanks**: `FHE_ADMIN_PASSWORD` and the host on `FHE_SITE_URL`.
The copy alone is not enough — see W1-3.

Everything else is ready:

- Phase 0 is **done and proven** — a relaunch starts at §A, not at tooling.
- §3.3 money is **fully decided** — Zelle and cash, both exercised, both left unconfirmed, Stripe out.
- §3.1 identity is **fully specified** — `cjzigs+walk1-<yyyymmddHHMM>@icloud.com`, last name `WALKTEST`.
