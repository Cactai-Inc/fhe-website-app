# TASK-WALK1 — REPORT

**Status: STOPPED AT PHASE 0, BEFORE ANY CONTACT WITH THE LIVE SITE.**
Branch `task/walk1`, worktree `~/Downloads/claude-code-repo/wt-walk1`. Committed, not pushed.

**This is the third stop, against the spec at `c815e73`** (read in full: §2 tooling + the new
AUTHENTICATION subsection, §3.1 identity, §3.3 money). **The blocker has never changed:
`.env.test` does not exist.** Three commits have now built scaffolding around that file without
creating it. That pattern is the finding.

---

## The three answers §7 asks for, up front

**1. The test identity — NONE WAS CREATED.**
No WALKTEST identity exists. No address was used, no signup was attempted, no email was sent.
The address the walk *would* have used, per §3.1, is `cjzigs+walk1-<yyyymmddHHMM>@icloud.com`
with last name `WALKTEST`. It was never minted because the walk never reached the site, so
**whether plus-addressing survives the signup path is still untested** — §3.1's own verification
requirement, still open.

**Rows created in production by this run: ZERO.** Nothing to purge. The browser was never pointed
at the live site: no anonymous page load, no form, no signup, no booking, no payment declaration.
**Google's OAuth was never touched** — no login of any kind was attempted.

**2. Does mail work? — UNANSWERED, and it stays unanswered.**
The question the task was built to settle is exactly where it started: production still reads 46
`notifications` rows with `emailed_at` NULL on all 46, and 2 proven sends ever. **WALK2 and WALK3
remain blocked on it**, because §1 makes them dependent on this answer.

**3. The single most important finding.**

> **Three commits have specified `.env.test` in growing detail. None has created it.**

| commit | what it added | did `.env.test` appear? |
|---|---|---|
| `bfb2da0` | `.gitignore` entry (line 39) + a 6-line template | **no** |
| `617f742` / `a5eae0c` | the money ruling — Stripe out, Zelle and cash | **no** |
| `c815e73` | the AUTHENTICATION subsection + `FHE_STORAGE_STATE` in the template | **no** |

Verified again this run, across the whole `claude-code-repo` tree and not just the repo root:
**no `.env.test` exists anywhere.** The root holds `.env`, `.env.db` and `.env.test.example`.

The spec around the file is now excellent and essentially complete — the auth path is decided, MFA
is pre-verified as unenrolled, a storage-state fallback is defined, the money rules are settled.
**Every one of those refinements is unreachable until one file is written by hand.** §2 makes
absence an unconditional stop and forbids asking for the file in chat, so this thread neither
proceeded nor asked.

**The template's four keys, and what each still needs:**

| key | state as shipped in `.env.test.example` |
|---|---|
| `FHE_SITE_URL` | **`https://` — bare scheme, no host.** Must be typed in. |
| `FHE_ADMIN_EMAIL` | pre-filled — fine as-is |
| `FHE_ADMIN_PASSWORD` | **empty.** The template says to set one via the site's `/forgot-password` flow first. |
| `FHE_STORAGE_STATE` | **empty.** The alternative to the password, not an addition. |

So `cp .env.test.example .env.test` still produces a file that cannot drive anything. **At minimum
one host and one of {password, storage-state path} must be typed in.**

---

## ⚠️ The cheapest unblock: one line runs most of the walk

**The new §2 states it outright:** *"Test accounts you create yourself set their own password at
activation — they never involve Google, so the client-side half of the walk is unaffected either
way."*

That has a consequence worth acting on. **§A, §B and §D's website column need no staff
credentials at all** — they are an anonymous visitor, a cold `/sign/rider` link, and a
self-activated WALKTEST account that sets its own password. The *only* thing they need from
`.env.test` is a site to point at.

> **`FHE_SITE_URL=https://<host>` alone — password still blank — unblocks §A, §B, §D-website,
> and the client-side half of §E, including the email question this entire walk exists to answer.**

The admin password or storage state is needed only for the **admin dashboard** half of §E, and for
whatever in §C requires staff. **If supplying a password is the slow step, supply the URL first and
let the walk return the email answer** — that is the finding §1 says reshapes WALK2 and WALK3.

This thread did not infer the host from the admin email domain or from anything in `src/`. §2's
stop is unconditional, and guessing a production URL to point a browser at is precisely what that
rule exists to prevent.

---

## The walk

Not run. §A, §B, §C, §D and §E were never entered. Recorded as unattempted so the next thread
inherits an accurate ledger rather than a silent gap.

| § | what it would have answered | state | needs staff creds? |
|---|---|---|---|
| A | anonymous visitor books a lesson, end to end | **NOT RUN** | **no — URL only** |
| B | `/sign/rider` cold — 0 `signup_attempts` ever — from link to landed session | **NOT RUN** | **no — URL only** |
| C | Book with no credits: buy in place, or deflect to catalog | **NOT RUN** | partly |
| D | all 9 `RIDING_LESSON` offerings, website vs app, name and price | **NOT RUN** | website column: **no** |
| D⚠ | the 4 recurring offerings: what is minted, when, expiring when, cron or not | **NOT RUN** | partly |
| E | notifications across dashboard / admin dashboard / email | **NOT RUN** | admin half only |

**Screenshots: none.** `docs/reports/walk1-shots/` was not created — an empty directory would
imply an attempt was made. Zero numbered steps were reached, so zero shots exist.

---

## Authentication — the plan, unexercised (§2 AUTHENTICATION)

Carried forward as the next thread's instructions, since none of it was reachable:

- **Never drive Google's OAuth screens.** Google blocks automated browsers and a failed attempt can
  lock or challenge a real account. This thread attempted no login at all.
- **Primary path:** click *"Sign in with email and password"*, then submit with `FHE_ADMIN_PASSWORD`.
- **Alternative:** if `FHE_STORAGE_STATE` is set, load that Playwright `storageState` JSON and skip
  the login form entirely. If the session is dead, **STOP** — do not fall back to Google.
- **No MFA is enrolled** on either staff account, so the TOTP step is conditional and should not
  fire. **If a verification-code screen appears anyway, STOP and report** — something changed.

---

## The payment rules, carried forward unexercised (§3.3)

Recorded because §3.3 was rewritten and **none of it was testable**. Next thread's checklist:

- **Zelle and cash only. Stripe is out** — owner: *"kill stripe mode, its not setup and we dont
  need it now."* No card is ever to be submitted.
- **Both manual options must be exercised** — one purchase paid by Zelle, one by cash.
- **If any surface offers a card option at all, do not use it and record that it was offered** —
  presenting an unconfigured payment method is itself a defect.
- **Both declarations left UNCONFIRMED, with purchase ids recorded**, because WALK2 needs
  unconfirmed claims waiting for it.
- **"Nothing blocks" is an acceptance test, not a permission.** After declaring payment the user
  must continue, **booking included**. Anything gated on confirmation is a **defect**, since the
  real control is operational: the lesson never happens until payment is verified.

**Nothing above was observed.** Every line is untested. In particular, **no payment surface was
seen, so "was a card option offered at all" is open, not answered in the negative.**

---

## Every stop, with its reason (§6.9)

**STOP 1 — Phase 0 credentials gate. `.env.test` absent.**
Verified by listing the repo root. Reported, with the missing `.gitignore` entry as W1-1.

**STOP 2 — Phase 0 credentials gate. `.env.test` still absent** after `bfb2da0`.
That commit landed the gitignore entry and a template, not the file. Re-verified across the whole
`claude-code-repo` tree.

**STOP 3 — Phase 0 credentials gate. `.env.test` still absent** after `c815e73`.
That commit landed the authentication strategy and a `FHE_STORAGE_STATE` option in the template,
not the file. Re-verified across the whole tree. Same rule, same stop.

**No run reached a second decision point.** No login screen, no payment surface, no MFA prompt was
ever seen — none of those questions is answered in the negative, they are simply unreached.

---

## Phase 0 — what was installed, and where (§2 requires this stated exactly)

Phase 0 tooling is **complete, and re-verified intact after merging `c815e73`**. It touches no
production system and is a prerequisite the next run would otherwise repeat.

**Confirmed first — the task doc's claim held:** no Playwright, Puppeteer, Cypress or Selenium in
`package.json`, and none in `node_modules/.bin`.

**Installed: Playwright 1.62.1 + Chromium (Chrome for Testing 151.0.7922.34).**

- Location: **`wt-walk1/walk1-tooling/`** — worktree-local, its own `package.json`, installed via
  `npm install --no-save playwright`.
- **The repo's `package.json` is untouched.** Re-verified after this merge: `git status --short`
  clean, no change to `package.json` or `package-lock.json`. Nothing can deploy to Vercel from it.
- `walk1-tooling/` contains a `.gitignore` holding a single `*`, so it ignores itself entirely.
  **The tooling cannot be committed even by accident.**
- Chromium binaries live in Playwright's shared user cache,
  `~/Library/Caches/ms-playwright/chromium-1234`, not inside the repo.

**The harness was smoke-tested and works** — headless Chromium launched, rendered, returned queried
text, closed. It rendered a local string and **navigated to no network origin.** `storageState`
loading is supported by this version, so the §2 alternative path needs no further tooling.

---

## Flagged, not fixed

Per §5 this walk changes no application code, and it changed no configuration either — the empty
template values are the owner's to supply and must not be guessed at.

| # | finding | state | why it matters |
|---|---|---|---|
| W1-1 | `.gitignore` had no `.env.test` entry | **CLOSED** by `bfb2da0` (line 39) | a credential at the repo root would have been committable |
| W1-2 | **`.env.test` does not exist**; only `.env.test.example` does | **OPEN — the sole blocker, 3rd run** | WALK1 cannot run; WALK2 and WALK3 sit downstream of its email answer |
| W1-3 | **Template ships with `FHE_SITE_URL=https://` hostless, `FHE_ADMIN_PASSWORD=` and `FHE_STORAGE_STATE=` both empty** | **OPEN** | copying it is not enough — a 4th stop with a file that technically exists is the failure mode |
| W1-4 | Stripe live-or-test mode undecided | **CLOSED** by owner ruling — Stripe out | removes a gate the next run would have hit at first purchase |
| W1-5 | stray long-running `vitest run test/db` (PID 50025) | **CLOSED** — no longer running at this census | — |
| W1-6 | **`FHE_ADMIN_PASSWORD` requires the owner to run `/forgot-password` on a live staff account first** | **OPEN** | it is a prerequisite action on production, not just a value to look up — likely why it keeps slipping. The `FHE_STORAGE_STATE` route avoids it, and **`FHE_SITE_URL` alone avoids both.** |

---

## Teardown

**Browser processes: none left running.** Census found no `chromium`, `headless_shell` or
Playwright processes owned by this thread. The Google Chrome processes present are the owner's own
everyday browser and were not touched.

**Dev processes started by this thread: none.** No dev server, no vitest, no DB session. `.env.db`
was never used to open a connection — and under §3.8 this thread does not query the database to
explain behaviour in any case. No file under `src/` was opened to explain any behaviour.

**Process census at teardown:**

| process | owner | disposition |
|---|---|---|
| Playwright / Chromium / headless_shell | — | **none running**; smoke test closed cleanly |
| `npm exec vitest run test/db` (was PID 50025) | another thread | **gone** — no longer present, W1-5 closed |
| Google Chrome | the owner | **left running**, not this thread's |
| `claude` CLI sessions | parallel orchestration threads | **left running** |

**Credential hygiene.** No credential appears in this report, in any commit, or in any screenshot —
there are no screenshots. `FHE_SITE_URL`, `FHE_ADMIN_PASSWORD` and `FHE_STORAGE_STATE` are named as
*keys needing values*; no value for any of them was read, guessed, or written anywhere. One slip
from the first run is recorded plainly: an early key-name inspection of `.env.db` printed that
file's line to the terminal, and because that file holds a bare connection URL rather than
`KEY=value` pairs, the line was the connection string itself. It went to that session's terminal
only; it is not in this report, not in any commit, and not in any file this run wrote. No action is
required, but the owner should know it surfaced.

---

## What the next thread needs — one file, and the fastest version of it is one line

**Fastest path to the answer this walk exists for:**

```
printf 'FHE_SITE_URL=https://<host>\n' > .env.test
```

That alone runs §A, §B, §D-website and the client half of §E — **including whether mail sends.**

**Full path**, when the admin half is wanted too — copy the template and fill in the host plus
*one* of the two auth values:

```
cp .env.test.example .env.test
```

…then type the host into `FHE_SITE_URL`, and **either** set `FHE_ADMIN_PASSWORD` (after running
`/forgot-password` on the admin account — see W1-6) **or** point `FHE_STORAGE_STATE` at a
Playwright `storageState` JSON from a manual sign-in. It is already gitignored and cannot be
committed.

Everything else is ready:

- Phase 0 is **done and proven** — a relaunch starts at §A, not at tooling.
- §2 auth is **fully decided** — email/password primary, storage-state alternative, Google never.
- §3.3 money is **fully decided** — Zelle and cash, both exercised, both left unconfirmed, Stripe out.
- §3.1 identity is **fully specified** — `cjzigs+walk1-<yyyymmddHHMM>@icloud.com`, last name `WALKTEST`.
