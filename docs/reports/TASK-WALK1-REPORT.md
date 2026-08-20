# TASK-WALK1 — REPORT

**Status: STOPPED AT PHASE 0, BEFORE ANY CONTACT WITH THE LIVE SITE.**
Branch `task/walk1`, worktree `~/Downloads/claude-code-repo/wt-walk1`. Committed, not pushed.

---

## The three answers §7 asks for, up front

**1. The test identity — NONE WAS CREATED.**
No WALKTEST identity exists. No address was used, no signup was attempted, no email was sent.
The address the walk *would* have used, per §3.1, is `cjzigs+walk1-<yyyymmddHHMM>@icloud.com`
with last name `WALKTEST`. It was never minted because the walk never reached the site.

**Rows created in production by this run: ZERO.** Nothing to purge. The browser was never
pointed at the live site; no anonymous page load, no form, no signup, no booking, no payment.

**2. Does mail work? — UNANSWERED, and it stays unanswered.**
This is the question the task was built to settle, and the stop leaves it exactly where it was:
production still reads 46 `notifications` rows with `emailed_at` NULL on all 46, and 2 proven
sends ever. **WALK2 and WALK3 are still blocked on it**, because §1 makes them dependent on
this answer.

**3. The single most important finding.**

> **`.env.test` does not exist, and `.gitignore` has no entry for it.**

Two separate facts, and the second is the dangerous one.

- `.env.test` is **absent from the repo root.** §2 makes this an explicit, unconditional stop:
  *"If `.env.test` is absent, STOP and report — do not proceed and do not ask for it in chat."*
- `.gitignore` covers `.env` (line 23) and `.env.db` (line 31). **It does not cover `.env.test`.**
  The task doc describes the file as *"owner-supplied, gitignored — same pattern as `.env.db`"*.
  That is not true today. If the owner drops `.env.test` in at the repo root right now, it lands
  **tracked and committable**, and a live-site credential is one `git add -A` away from the
  branch — and from Vercel's build context on push.
- Nothing anywhere in the repo references `.env.test` except the task doc itself. Its expected
  contents were never written down. Grep across `*.md`, `*.ts`, `*.tsx`, `*.js`, `*.json`
  (excluding `node_modules`) returns exactly two hits, both in
  `docs/tasks/TASK-WALK1-visitor-to-booked-lesson-on-the-live-site.md`.

**Do this before relaunching WALK1: add `.env.test` to `.gitignore` first, then create the file.**
In that order. The reverse order is how a credential gets committed.

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
written as unconditional — *"do not proceed"* — not as *"skip the authenticated parts."* A
partial walk that quietly redefines its own gate is the thing §3.6 exists to prevent.

---

## Every stop, with its reason (§6.9)

**STOP 1 — Phase 0, credentials gate. `.env.test` absent at repo root.**
Verified by direct listing of the repo root and a `find -maxdepth 2 -name ".env*"`: only `.env`
and `.env.db` are present. §2 makes absence an unconditional stop with an explicit prohibition on
asking for the file in chat, so this thread neither proceeded nor asked. The walk ends here.

That is the only stop, because the walk never got far enough to encounter a second decision.
Notably it never reached §3.3 (the Stripe live-or-test-mode question), which remains an open,
undecided gate for whoever runs this next.

---

## Phase 0 — what was installed, and where (§2 requires this stated exactly)

Phase 0 tooling was completed. It touches no production system and is a prerequisite the next
run would otherwise have to repeat, so it was finished rather than abandoned.

**Confirmed first — the task doc's claim held:** no Playwright, Puppeteer, Cypress or Selenium
in `package.json`, and none in `node_modules/.bin`.

**Installed: Playwright 1.62.1 + Chromium (Chrome for Testing 151.0.7922.34).**

- Location: **`wt-walk1/walk1-tooling/`** — a worktree-local directory with its own
  `package.json`, installed via `npm install --no-save playwright`.
- **The repo's `package.json` is untouched.** Verified: `git status --short` in the worktree is
  clean, no modification to `package.json` or `package-lock.json`. Nothing can deploy to Vercel
  from this.
- `walk1-tooling/` contains a `.gitignore` holding a single `*`, so the directory ignores
  itself and its contents entirely. **The tooling cannot be committed even by accident.**
- Chromium binaries live in Playwright's shared user cache,
  `~/Library/Caches/ms-playwright/chromium-1234`, not inside the repo.

**The harness was smoke-tested and works.** A headless Chromium launched, rendered content, and
returned queried text (`SMOKE_OK`), then closed. The test rendered a local string — **it did not
navigate to the live site or any network origin.** So the next run starts with a proven browser,
not an unverified download.

---

## Flagged, not fixed

Per §5, this walk changes no application code. It changed no configuration either — including the
`.gitignore` gap below, which is left for the owner to close deliberately.

| # | finding | why it matters |
|---|---|---|
| W1-1 | **`.gitignore` has no `.env.test` entry**, though the task doc states the file is gitignored | A live-site credential placed at the repo root today is tracked and committable. **Fix before creating the file, not after.** |
| W1-2 | **`.env.test` was never provisioned** | WALK1 cannot run. WALK2 and WALK3 are specced downstream of WALK1's email answer, so all three are blocked by one missing file. |
| W1-3 | **The required contents of `.env.test` are undocumented** | Only the task doc mentions it; no loader, script, or doc reads it. The owner has no stated shape to fill in, and this thread is barred from asking. Worth writing the key list down once, in the task doc, so the next attempt cannot stall the same way. |
| W1-4 | **§3.3's Stripe live-or-test question is still undecided** | It is a gate the next run *will* hit if it reaches a purchase. Deciding it before relaunch removes a second stop. |
| W1-5 | **Stray long-running `vitest run test/db --maxWorkers=2` (PID 50025, started 16:21)** | Sitting at 0.0% CPU for hours; it belongs to another thread, so this one did not kill it. Flagged for the orchestrator. |

---

## Teardown

**Browser processes: none left running.** The Playwright smoke test closed its browser; a census
found no `chromium`, `headless_shell` or Playwright processes owned by this thread. The Google
Chrome processes present are the owner's own everyday browser and were not touched.

**Dev processes started by this thread: none.** No dev server, no vitest, no DB session was
started. `.env.db` was never used to open a connection — and under §3.8 this thread does not
query the database to explain behaviour in any case.

**Process census at teardown:**

| process | owner | disposition |
|---|---|---|
| Playwright / Chromium / headless_shell | — | **none running**; smoke test closed cleanly |
| `npm exec vitest run test/db --maxWorkers=2` (PID 50025) | another thread, from 16:21 | **left running**, flagged as W1-5 |
| Google Chrome (PIDs 2192 and helpers) | the owner | **left running**, not this thread's |
| `claude` CLI sessions (PIDs 940, 1067, 47509, 49535) | parallel orchestration threads | **left running** |

**Credential hygiene note.** No credential appears in this report, in the commit, or in any
screenshot — there are no screenshots. One handling slip is worth recording plainly: an early
key-name inspection of `.env.db` printed that file's line to the terminal, and because the file
holds a bare connection URL rather than `KEY=value` pairs, the line was the connection string
itself. It went to this session's terminal only; it is not in this report, not in the commit, and
not in any file this run wrote. The value is unchanged and no action is required, but the owner
should know it surfaced in the transcript.

---

## What the next thread needs, in order

1. Add `.env.test` to `.gitignore`.
2. Create `.env.test` at the repo root with the live-site login the walk should drive.
3. Decide §3.3: is Stripe in live or test mode.
4. Relaunch in this same worktree — **Phase 0 is already done and proven**, so it starts at §A.
