# FHE-DSNR-SITE-PUBLIC HANDOFF — for ORCH

**From `FHE-DSNR-SITE-PUBLIC`, 2026-09-01. Subject: the public-site lane.**
**Upstream:** ⚠️ **no DISCO handoff.** The source is the owner's chat-thread drafts, staged in
`docs/tasks/`, relayed via `docs/design/refactor/CHAT-THREAD-ADMIN-REFACTOR-2026-08-26.md:163-168`.
**Working ledger, with every query behind every number here:** `docs/reports/FHE-DSNR-SITE-PUBLIC-LEDGER.md`.

**Three drafts were handed to me. Two became four specs. One I cannot write.**

> # 🔒 ORCH — START HERE. THE WHOLE STATE, BEFORE ANY DETAIL.
> **4 specs ready to dispatch. 1 chunk blocked. 3 owner rulings to record. 0 shapes waiting.**
>
> | | |
> |---|---|
> | ✅ **Dispatch now, in parallel** | `SITECOPY-A` · `SITECOPY-B` · `LANDINGSIGNIN` — **file-disjoint** |
> | ✅ **Dispatch after `SITECOPY-A`** | `SITESEO` — ruled keep-and-301; shares `src/lib/seo.ts` with `A` |
> | ⚠️ **Release back to `DSNR`, not to a build thread** | `ONERAIL` — gate satisfied, **spec stale** (§6) |
> | ⛔ **Cannot be specced yet** | `POLICIESANDFAQ` — **needs a `DISCO` pass**, not a paste (§0.1) |
> | 📋 **Owner's own to-do, blocking nothing** | 2 diagnostics + 1 input (§0.3 A and B) |
> | 📌 **Record these** | 3 owner rulings, §0.2 — one of them narrows `D37` |
>
> ⚠️ **THREE THINGS I GOT WRONG AND CORRECTED IN THIS FILE — do not carry the earlier versions:**
> **(a)** I said the app has no analytics. **Vercel Web Analytics is live** (§0.3). **(b)** I asked the
> owner to paste in a lost document. **Withdrawn** (§0.1). **(c)** I put MODEL·EFFORT·THINKING on a
> prompt for a standing thread. **He struck it** (§0.2, §8).
>
> 🔒 **This file is self-sufficient. §8 lists every path it points to.**

---

# 0. ⚠️ WHAT NEEDS THE OWNER, WHAT HE HAS ALREADY RULED, AND THE FOLLOW-THROUGH

## 0.1 — ⚠️ THE ONE THING STILL BLOCKING WORK

## ASK-OWNER 1 — 🔒 `TASK-POLICIESANDFAQ` DOES NOT EXIST IN THIS REPO. I CANNOT WRITE IT.

**`DSNR-ROLE.md` §2 is explicit: if the handoff leaves me guessing, say so and stop.** So I stopped.

**What I searched, 2026-09-01:** `grep -rln -i "POLICIESANDFAQ" --include="*.md" .` returns **exactly
one hit**, and it is the relay saying the draft is elsewhere:

> *"TASK-SITECOPY and TASK-LANDINGSIGNIN you have staged; TASK-POLICIESANDFAQ and COMPLIANCE-FINDINGS
> exist in this thread's outputs, **not yet staged**, and POLICIESANDFAQ carries two pending owner
> calls inside it (policy-section keep-vs-cut, Business Profile URL)."*
> — `docs/design/refactor/CHAT-THREAD-ADMIN-REFACTOR-2026-08-26.md:165-167`

⚠️ **`COMPLIANCE-FINDINGS` is not in the repo either.** No file, no report, no archive copy.

**And §2 has a second bar this trips:** the two owner calls the draft *"carries inside it"* have never
been ruled, so there are **no agreed validation criteria** for the chunk. **I cannot invent them.**

**🔒 HE ASKED WHERE HE WOULD EVEN GET IT. FAIR — AND IT CHANGES MY ANSWER.**
> *"where am i going to get the docs you are asking me to paste in for you?"* — owner, 2026-09-01

⚠️ **I was asking him to go fetch a document from a planning thread that may no longer exist. That is
not a real ask, and "paste it in" was the wrong recommendation.** **Withdrawn.**

🔒 **REVISED RECOMMENDATION: re-originate it. `POLICIESANDFAQ` needs a `DISCO` pass, not a paste.**
**The reasons the lost draft mattered were its compliance research and its two owner calls. Both are
recoverable without it:**
- **The compliance half is a DISCO job by definition** — what a California equestrian business must
  publish, measured fresh. ⚠️ **I must not invent it; that is exactly the "wrong premise wearing a
  spec's authority" `DSNR-ROLE.md` §2 forbids.**
- **The two owner calls are answerable directly, and I have reconstructed them both** — see below.
  **Neither needs the lost file.**

### The two owner calls, reconstructed from the code so he can rule without the draft
**Call 1 — "policy-section keep-vs-cut."** The signable `supabase/contract_templates/COMPANY_POLICIES.md`
has **16 numbered sections**. The question is which of them belong on a **public** page:
`1 SCOPE & PRECEDENCE` · `2 PAYMENT METHODS` · `3 ORDERS, APPROVAL & CONTRACT FORMATION` ·
`4 SERVICE-SPECIFIC TERMS` · `5 NO MONETARY REFUNDS` · `6 RESCHEDULING NOTICE & FEES` ·
`7 LATE ARRIVAL` · `8 WEATHER & UNSAFE CONDITIONS` · `9 MOBILE SERVICES & TRAVEL` · `10 SERVICE TERMS` ·
`11 SCHEDULING ABUSE` · `12 GIFT CERTIFICATES` · `13 DISPUTE RESOLUTION` · `14 ATTORNEY'S FEES` ·
`15 AMENDMENT` · `16 GOVERNING LAW & SEVERABILITY`.
⚠️ **Several of these are things a buyer is entitled to know BEFORE paying** — §5 *all sales are
final*, §6's `$10/$20/$30/$75` fee ladder, §4's *90-day package expiry* and *30 days' notice to
cancel a membership*. **Today they are visible only after a person is already inside a signing flow.**
**That is the real question the draft was circling, and it is one he can answer in a sentence.**

**Call 2 — "Business Profile URL."** `src/lib/seo.ts:44` — `sameAs: [] as string[], // add social
profile URLs when available`. It feeds `ORG_JSONLD`. 🔒 **The ask is just: the Google Business Profile
URL, and any social profiles.** ⚠️ **It is also the thing that would let him answer the SITESEO
ranking question above** — the profile is where the local-search data lives.

### The ground, measured 2026-09-01, so nothing is wasted when the draft lands
| Fact | The measurement |
|---|---|
| **There is NO public privacy policy, terms, cancellation or refund page.** | `grep -rn -i -E "privacy\|terms of\|cancellation\|refund" src/pages/*.tsx src/components/layout/Footer.tsx` → **zero** hits. The footer has **no legal links at all** (`Footer.tsx` nav: Home, Our Community, Book a Lesson, Horse Care, Acquisition Support, Gift a Service, Member sign-in, Visit us, FAQ). |
| **Policies exist, but only as a signable contract document.** | `supabase/contract_templates/COMPANY_POLICIES.md`, surfaced at `src/pages/Release.tsx:80-83` (`slug: 'policies'`, *"Our business policies and terms"*) and `src/pages/DocsParticipantFlow.tsx:38`. **A person must be in a signing flow to read them.** |
| **The FAQ page is self-described placeholder copy.** | `src/pages/Faq.tsx:6-8`: *"a light stub for launch. Copy is placeholder … Swap answers in as the real details firm up."* **5 questions.** |
| **`/faq` emits `FAQPage` JSON-LD** — so the placeholder answers are structured data Google is invited to show. | `Faq.tsx:32-40`, `FAQ_JSONLD` |
| **`/faq` is prerendered but has NO `ROUTE_SEO` entry and is NOT in the sitemap.** | in `scripts/prerender.mjs:21`; absent from `ROUTE_SEO` (`src/lib/seo.ts:60`) and from `dist/sitemap.xml` |
| **Business Profile URL — the field it would land in exists and is empty.** | `src/lib/seo.ts:44`, `sameAs: [] as string[], // add social profile URLs when available`. It feeds `ORG_JSONLD`. **That is almost certainly the second pending call.** |

## 0.2 — 🔒 OWNER RULINGS RECEIVED IN THIS THREAD. **ORCH RECORDS THESE; THEY ARE NOT RE-LITIGATED.**

**All three landed after the first version of this handoff. Each is quoted verbatim where it applies.**

| # | Ruling, verbatim | What it settled | Where it is built in |
|---|---|---|---|
| **R1** | *"thats correct, a person with things in their cart needs to go to the cart not the say hello contact us form page."* | **The landing shape is APPROVED.** The full-cart corner is `[cart glyph] + [Sign In]`, and the cart — not Say Hello — is the way onward. ⚠️ **He named the reason I had not.** | `TASK-LANDINGSIGNIN` TRAP 2 and test §8.3, which now **fails if the cart is not in the frame**. Handoff §5. |
| **R2** | *"either way, keep and redirect to the booking page the CTA links to."* | **`SITESEO`'s fork is closed: keep and 301.** Retire-to-404 is struck. **Target verified `/lessons`** on all three CTAs. | `TASK-SITESEO` §4, ungated. Handoff §0.2 below and §0.3. |
| **R3** | *"you dont need to specify the settings for an ORCH thread, that thread runs continuously. if you want to specify a suggested thread setting for the TASK thread ORCH will be queuing up you can do that inside of a file ORCH will read from you."* | 🔒 **Narrows `D37`.** MODEL·EFFORT·THINKING on a handed prompt applies to a **thread being launched**, not to a **standing** one. Per-TASK settings go in the file, not the prompt. | Handoff §3 and §8. ⚠️ **`ORCH`: `D37` and `DSNR-ROLE.md` §7 both still read as universal. Amending them is yours.** |

---

## ✅ R2 IN DETAIL — three indexed URLs serve a blank page. **KEEP AND REDIRECT.**
> *"either way, keep and redirect to the booking page the CTA links to."* — owner, 2026-09-01

🔒 **`TASK-SITESEO` IS UNGATED AND READY TO DISPATCH.** The fork in its §4 is resolved to
keep-and-301; the retire-to-404 alternative is struck from the spec.
**Target verified as `/lessons`** — `Landing.tsx:138` (the big central CTA), `Header.tsx:47`,
`Footer.tsx:76` all agree. **The existing redirect destination was already right; only the mechanism
was wrong.**
**His other question — are those three URLs helping our ranking?** ⚠️ **Not determinable from this
repo, and I said so rather than estimating.** No analytics, no Search Console integration, and
`seo.ts:44` `sameAs: []` means no Business Profile is even linked. **Google Search Console →
Performance, filtered by page, is the instrument, and it is his to run.** **It would not change the
build:** all three currently serve an empty `<title>` and a 29-byte `<main>`, so they cannot be
ranking on content — **a 301 strictly improves the position whatever the number says.** Written into
the spec as §4a.
**`/services` I resolved myself** (spec §4d): once the three route lists converge on `ROUTE_SEO`, its
`indexable: true` puts it in the prerender list and the sitemap automatically. **No owner call.**

## 0.3 — 🔒 THE SITESEO FOLLOW-THROUGH: WHAT HAS TO HAPPEN, AND WHO DOES IT
*(Owner asked for this written up, 2026-09-01. Full detail in
`docs/tasks/TASK-SITESEO-three-indexed-urls-prerender-a-blank-page.md` §4a–§4d and §8.)*

### ⚠️ FIRST, A CORRECTION TO WHAT I TOLD HIM
**I said there was "no analytics" in the app. That was wrong, and it changes what he should do.**
**Vercel Web Analytics IS live** — `src/main.tsx:6` imports `@vercel/analytics/react`, `:16` renders
`<Analytics />` on every page, `package.json:24` `^2.0.1`. 🔒 **So half his question is already
answerable from a dashboard he owns.** The Search Console half stands as stated.

### A — TWO THINGS ONLY THE OWNER CAN DO. ⚠️ NEITHER BLOCKS THE BUILD.
| # | Action | What it answers | Why it is his |
|---|---|---|---|
| **A1** | **Vercel dashboard → Web Analytics → Top Pages.** Look for `/ride`, `/shop`, `/membership`. | **Does anyone actually land on these URLs?** | The data is already being collected; it just is not in the repo. **~2 minutes.** |
| **A2** | **Google Search Console → Performance → filter by page**, one pass per URL. Impressions, clicks, average position. | **Does Google show them, and where?** | ⚠️ **No `google-site-verification` tag exists in `index.html`, so we cannot even confirm the property is verified.** If it is not, verifying it is step zero — and it is a prerequisite for ever answering an SEO question about this site. |

🔒 **Both are DIAGNOSTIC, not gating.** **The build is correct whatever they say**, because all three
URLs currently serve an empty `<title>` and a 29-byte `<main>` — they cannot be ranking on content, so
a `301` to `/lessons` strictly improves the position either way. **That is why his "either way" was
the right call.**
⚠️ **What the numbers WOULD change is priority, not design** — if A1 shows real traffic, `SITESEO`
moves up the queue; if it shows none, it is still worth doing but it can wait behind the copy chunks.

### B — ONE THING HE CAN HAND OVER THAT SHIPS INSIDE THE BUILD
| # | Ask | Where it lands |
|---|---|---|
| **B1** | **The Google Business Profile URL, plus any social profiles.** | `src/lib/seo.ts:44`, `sameAs: []` — today **empty**. It feeds `ORG_JSONLD`, the `LocalBusiness` structured data. **One line.** |

⚠️ **Specced as CONDITIONAL** (`TASK-SITESEO` §4c.7): if the URLs have arrived when the thread starts,
they ship; if not, `sameAs` stays empty and the thread reports it as open. 🔒 **The spec forbids
guessing one — a wrong `sameAs` tells Google this is a different business, which is worse than none.**
**B1 is also what makes A2 useful**, since the Business Profile is where local-search data lives.

### C — THE BUILD, AND IT IS BIGGER THAN THE THREE REDIRECTS
**All of this is `TASK-SITESEO`. Nothing here needs another decision.**
1. **`301`s in `vercel.json`** for `/ride`, `/shop`, `/membership` → `/lessons`, `permanent: true`.
   **There is no `redirects` key today; it is added.** The two existing `rewrites` stay.
2. **Those three leave `scripts/prerender.mjs` and the sitemap** — you do not prerender or sitemap a
   redirect. **This deletes the three blank pages.**
3. **Their `indexable` flags flip to `false`**, so step 4's convergence keeps them out by rule rather
   than by a second hardcoded exception. **The `/shop` ROUTE_SEO entry itself stays** —
   `src/pages/Shop.tsx:12` calls `seoForPath('/shop')!` with a non-null assertion.
4. 🔒 **The three route lists converge onto `ROUTE_SEO`.** `scripts/prerender.mjs:21`,
   `scripts/seo-files.mjs:14-24` and `src/lib/seo.ts` currently disagree three ways, and `indexable`
   is read by **nothing**. **After this it is the single source and the flag finally decides something.**
5. ⚠️ **`/services` gets prerendered — and this is the item I under-sold.** `vercel.json`'s catch-all
   rewrite sends any route with no prerendered directory to `dist/index.html`, **which IS the
   prerender of `/`**. So a crawler asking for **`/services`, `/contact`, `/visit`, `/gift` or
   `/questions`** is currently served **the LANDING page's HTML and the LANDING page's `<title>`**,
   and only sees the real page after running JavaScript. 🔒 **Same class of defect as the three blank
   pages, and invisible in a browser.** `/services` is `indexable: true`, so step 4 fixes it by rule.
6. **`/faq` gets a `ROUTE_SEO` entry** — it is prerendered today with **no entry at all**, so the
   convergence would otherwise drop it. **Use the title and description `src/pages/Faq.tsx`'s own
   `<Seo>` already emits. Do not write new copy and do not touch the questions.**
7. **`sameAs`** — conditional, per B1.

### D — HOW IT IS PROVEN (`TASK-SITESEO` §8)
⚠️ **Every test runs `curl` against the built site, never a browser** — a client-side redirect and a
JavaScript-swapped title are exactly the defects, so anything that executes JS proves nothing.
`curl -sI` on each of the three → **`301` + `Location: /lessons`**. `curl -s` on `/services` → the
**services** title, not the landing one. No prerendered file with an empty `<title>` or an empty
`<main>`. Every sitemap `<loc>` resolving to real content, **and none of the three redirect URLs in
it.**

### ⚠️ E — SEQUENCE
**`SITECOPY-A` must merge first** — both edit `src/lib/seo.ts`, and `SITESEO`'s own report fails if
its diff touches a `title` or `description` value.

## 0.4 — not blocking, but he should know
**The two wording rulings `TASK-SITECOPY-A/B` enforce are not D-rules.** *"FHE is jumper-only"* and
*"a program … not a barn"* live **only** at `CHAT-THREAD-ADMIN-REFACTOR-2026-08-26.md:104-112`.
`grep -n -i "jumper" CLAUDE.md` → **zero hits.** ⚠️ **Nothing stops the words coming back the next
time someone writes marketing copy.** **Promoting them is ORCH's or his call, not mine.**

---

# 1. THE CHUNKS, IN DEPENDENCY ORDER

| Thread | Spec (`docs/tasks/`) | Owns | Must merge first | Status |
|---|---|---|---|---|
| **`FHE-TASK-SITECOPY-A`** | `TASK-SITECOPY-A-jumper-only-program-not-barn-in-public-marketing-copy.md` | 10 strings in `index.html`, `src/lib/seo.ts`, `src/pages/Services.tsx`, `src/pages/About.tsx` | — | ✅ **ready** |
| **`FHE-TASK-SITECOPY-B`** | `TASK-SITECOPY-B-the-app-stops-calling-itself-the-barn.md` | 5 strings in `src/pages/Confirmation.tsx`, `src/components/order/OrderPayment.tsx`, `src/components/app/ActivationOrderPanel.tsx`, rebuilt through `usePropertyTerm()` | — | ✅ **ready** |
| **`FHE-TASK-LANDINGSIGNIN`** | `TASK-LANDINGSIGNIN-a-sign-in-path-on-the-landing-page.md` | `src/components/layout/Header.tsx`, one link | — | ✅ **ready** |
| **`FHE-TASK-SITESEO`** | `TASK-SITESEO-three-indexed-urls-prerender-a-blank-page.md` | `vercel.json` 301s, `scripts/prerender.mjs`, `scripts/seo-files.mjs`, route list + `indexable` flags in `src/lib/seo.ts` | **`SITECOPY-A`** | ✅ **ready — RULED 2026-09-01** |
| **`FHE-TASK-POLICIESANDFAQ`** | — | — | — | ⛔ **needs a `DISCO` pass first — §0.1** |

**`A` ‖ `B` ‖ `LANDINGSIGNIN` are file-disjoint and can all run at the same time.**
**`SITESEO` follows `A` — they share `src/lib/seo.ts`.**

## ⚠️ WHY THESE ARE THE CHUNKS AND NOT OTHERS

**🔒 `SITECOPY` split into two, and this is the decision I most want on the record.**
The draft was one task with two items — *hunter→jumper* and *barn→program*. **The seam is not the
word; it is the mechanism.** Item 1 and half of item 2 are **static strings in marketing copy**: a
thread swaps a word and reads the page. The other half — the four places the app calls **itself** "the
barn" to a person mid-transaction — is **not a string swap at all**. The right fix there is
`usePropertyTerm()`, the tenant-word mechanism `TASK-FACILITYTERM` built and which has **zero
consumers today** (`grep -rn "usePropertyTerm" src/` → definitions only). **That is a D18 adoption
with a hook, a plural-agreement shape and a substitution test — different risk, different proof,
different file set.** ⚠️ **One thread doing both would do the second one as a find-and-replace, put a
fifth hardcoded facility word into the app, and pass its own test.**

**`SITECOPY-A` is ONE chunk, not two, even though it applies two rules.** `index.html:19` is the one
line in the repo carrying **both** wrong words, and `index.html:18` must stay byte-identical to
`src/lib/seo.ts:63`. **Two threads would collide on two lines.**

**`SITESEO` is separated out rather than folded into `A`.** It is not copy. It touches build scripts
and host config, its artefact under test is the built `dist/` rather than a page, and it is gated on
an owner ruling `A` is not. ⚠️ **Folding it in would have blocked ten ready string edits behind a
question the owner has not been asked yet.**

**`LANDINGSIGNIN` stays exactly one chunk.** One file, one link, one gate.

---

# 2. THE CONTENTION I CAN SEE

| File | Wanted by | Resolution |
|---|---|---|
| `src/lib/seo.ts` | **`SITECOPY-A`** (10 `title`/`description` values) and **`SITESEO`** (route list, `indexable` flags) | 🔒 **Sequence: `A` merges first.** Both specs say so, and `SITESEO` §8.8 fails its own report if its diff touches a copy value. |
| `src/pages/app/Onboarding.tsx` | **nobody here** — but `SITECOPY-B` renders through it | ⚠️ **`SIGNDOOR` (`0ac49e61`) and `SIGNBOOK` (`2fa1f7b9`) both rewrote it TODAY.** `B` edits `OrderPayment.tsx` and `ActivationOrderPanel.tsx` only, and its §5 forbids opening `Onboarding.tsx`. **Flagging the adjacency, not a collision.** |
| `src/App.tsx` | ⚠️ **NOBODY — corrected.** An earlier version of this table claimed `SITESEO`. | **`R2` changed this:** the `<Navigate>` routes at `:173,179,192` now **STAY** (the host 301 catches a cold hit, the client route catches an in-app link), so `SITESEO` does not open `App.tsx` at all. **And I kept `App.tsx:509`'s *"how the barn runs"* out of `B`** — it is a prop in the router tree and cannot call a hook. **Open item in `B` §5**, not silently dropped. 🔒 **`src/App.tsx` is free.** |
| `api/request-received.ts` | **live in `wt-1`** (`task/visitmenu`, uncommitted) | **No overlap** with any chunk here. |

**Worktrees at the time of writing:** `wt-1` `task/visitmenu` (dirty), `wt-2` and `wt-3` detached.
⚠️ **I do not know what is running — `D36` says you assign them. This is a snapshot, not a claim.**

## 🔒 IT HAPPENED TWICE — CONCURRENT DSNR THREADS ON ONE UNMANAGED CHECKOUT
**`FHE-DSNR-SIGNFLOW` has now committed MY files, twice, in the space of one session:**

| Its commit | What of mine it swallowed |
|---|---|
| `9652d1b8` *"DSNR-SIGNFLOW: retract three wrong claims…"* | **103 lines of `docs/tasks/TASK-SITESEO-…md`** — the whole keep-and-301 ruling |
| `609895fc` *"DSNR-SIGNFLOW: handoff opens with the inroads hold…"* | **`FHE-DSNR-SITE-PUBLIC-HANDOFF.md` AND `-LEDGER.md`** — the masthead, the three rulings, this section |

**Both times:** that thread committed while my edits sat unstaged in the same working tree, and its
`git add` took them. **Once I hit `.git/index.lock` held by its process mid-commit.**

🔒 **NO CONTENT WAS LOST. `main` is correct and the tree is clean — verified by grepping for every
section marker after each event.** ⚠️ **What IS lost is the commit messages explaining these
changes, and `git blame` on the `SITESEO` ruling and on this handoff now points at `SIGNFLOW`.**

### ⚠️ THIS IS A PATTERN, NOT TWO ACCIDENTS — and it is ORCH's to fix
1. 🔒 **`D36` assigns worktrees to BUILD threads. Spec-authoring threads are sharing the canonical
   checkout with no assignment and no lock**, and there are at least two of us live right now.
   **The obvious extension: `DSNR` threads get an assigned worktree too, or ORCH serialises them.**
2. ⚠️ **`git add -A` / `git commit -a` are unsafe in this checkout, for every role.**
   **`DSNR-ROLE.md` §6 already says stage explicit paths — this is exactly what that rule prevents,
   and `SIGNFLOW` is evidently not honouring it.** **I violated it once myself (`git add -A docs/`)
   before catching it; every commit of mine since names its paths, and it happened anyway — because
   the other thread's `add` is the one that does the damage.**
3. **Worth a D-rule, on the evidence of two events in one session.** ⚠️ **Mine to report, yours to
   write.**

---

# 3. MODEL AND EFFORT — a recommendation, yours to decide

| Thread | Recommendation | Why |
|---|---|---|
| `SITECOPY-A` | **Sonnet · effort HIGH · thinking OFF** | Ten string swaps. **The risk is not capability, it is discipline** — over-sweeping past the do-not-touch list, or reporting a browser pass on a page that renders blank. The spec carries both traps explicitly. |
| `SITECOPY-B` | **Opus · effort HIGH · thinking ON** | First consumer of a mechanism, a grammar shape (`plural`, subject-verb `agree()`), a plural-substitution proof, and one pre-existing agreement bug to fix in the same clause. **Judgement, not typing.** |
| `LANDINGSIGNIN` | **Opus · effort HIGH · thinking ON** | Small diff, real judgement: a layout stack inside a header with a **measured 940px fit floor**, plus the trap the original draft got wrong. |
| `SITESEO` | **Opus · effort HIGH · thinking ON** | Build scripts, three route lists to converge, and a host-level redirect that a `git revert` does not undo. |

---

# 4. 🔒 WHAT I DECIDED THAT THE DRAFTS DID NOT

1. **Split `SITECOPY` into `A` and `B`.** §1 above.
2. **`SITECOPY-B` converges on `usePropertyTerm()` rather than hardcoding "ranch".** The draft never
   contemplated it; the mechanism (`src/lib/propertyTerm.ts`, `BrandProvider.tsx:139`) was built by
   `TASK-FACILITYTERM` and never adopted. **Rendered output for FHE is identical either way; the
   difference only appears when a second tenant exists — which is when a hardcoded word gets
   expensive.**
3. **Four `barn` instances the 2026-08-24 draft declared did not exist are now in scope.** Its line
   *"No other public-copy instance of `barn` found in an identity-claiming context"* is **false as of
   today**: `Confirmation.tsx:148-150`, `OrderPayment.tsx:231`, `ActivationOrderPanel.tsx:151`.
   **I do not know whether it was false when written or has drifted since; I re-ran the grep and
   these are there now.**
4. **🔒 I overruled the draft's central mechanism for `LANDINGSIGNIN`.** It says to gate the new link
   on `overDark` because *"Header.tsx already knows when it's rendering on landing."* **It does not.**
   `Header.tsx:73` initialises `overDark` from `location.pathname === '/'`, then `:84-121` **overwrites
   it on every scroll and resize on every route**, by sampling `[data-header-tone="dark"]` elements.
   **`src/pages/Story.tsx:223` and `:512` carry that attribute** — so scrolling `/story` would make
   Sign In appear on a page that already has one. ⚠️ **The spec now gates on `location.pathname`
   directly and makes the scroll-regression an explicit numbered test, because "load the other pages
   and look" would not have caught it.**
5. **I closed the draft's one open call, against its own suggestion.** It flagged as *"overridable"*
   whether Sign In should share Say Hello's `itemCount === 0` condition. **It is not overridable** —
   sharing it would leave a landing visitor with a full cart at **zero** entry points, which is the
   exact defect the task exists to close.
6. **I raised `TASK-SITESEO`, which nobody asked for.** It was found while rebasing, and **two of
   `SITECOPY`'s own edits are inert because of it.** ⚠️ **I did not absorb it into `A` and I did not
   choose its fix** — the fork is the owner's.
7. **I excluded `src/App.tsx:509` from `B`, deliberately**, and recorded it in `B` §5 rather than
   dropping it quietly. Different mechanism, and `App.tsx` is a contended file.
8. **I kept the `/ride` and `/shop` copy edits in `A` even though they render nothing**, and told the
   thread to report them as `MADE — NOT BROWSER-VERIFIABLE`. **The strings must already be right if
   `SITESEO` ever revives those routes.**

---

# 5. 🔒 THE SHAPE — ASKED, AND RULED. THE GATE IS CLOSED.

> ## OWNER, 2026-09-01, on the full-cart landing frame — VERBATIM:
> > *"thats correct, a person with things in their cart needs to go to the cart not the say hello
> > contact us form page."*
>
> 🔒 **APPROVED AS SPECCED. Nothing in `LANDINGSIGNIN` is waiting on him.** **The ruling is built into
> the spec at TRAP 2 and into its §8.3 test, which now fails if the cart glyph is not in the frame.**
> **ORCH: dispatch it.**

**The shape he ruled on, kept below as the record.**

🔒 **`LANDINGSIGNIN` changes the shape of the front door** — the first thing a new visitor sees, and
the one surface the owner has ruled on twice (2026-08-16, Sign In leaves the header; 2026-08-17, Say
Hello stands down for the cart). **The spec adds a second element to that corner.**

**The four states, so he can rule from words rather than waiting for a build:**

| State | Right corner shows |
|---|---|
| `/`, ≥940px, empty cart | **Say Hello** (gold outline button) · **Sign In** (small underlined link) beneath it |
| `/`, ≥940px, cart has items | ⚠️ **Sign In alone** — Say Hello has stood down |
| `/`, <940px | hamburger only — **unchanged**, Sign In is inside the menu |
| every other page | **unchanged** — no Sign In in the header; `Member sign-in` in the footer |

**Empty case:** none — the link is unconditional on `/`. **Error case:** none — it is a link.

⚠️ **What I put to him: at ≥940px with a full cart, the landing page's header corner loses the gold
Say Hello button and keeps a small underlined "Sign In".** 🔒 **He ruled it correct, and named the
reason I had not: the CART is the affordance that matters in that state — a person mid-selection
needs the inquiry they are already building, not a contact form.**
**Verified in code after his ruling:** `Header.tsx:156-171` gates `cart()` on `itemCount > 0` alone —
no breakpoint, no route test — linking to `/checkout`, rendered in the right cluster at `:314`.
**So the full-cart landing corner is `[cart glyph] + [Sign In]`, and both are reachable.**

---

# 6. `TASK-ONERAIL` — 🔒 THE HOLD CONDITION IS ALREADY SATISFIED

**The instruction was: hold `TASK-ONERAIL` until `SIGNDOOR` and `SIGNBOOK` merge. Both merged today.**

| Commit | | |
|---|---|---|
| `0ac49e61` | *"merge task/signdoor: the door asks for the email and nothing else"* | **ancestor of `main`** ✅ |
| `2fa1f7b9` | *"merge task/signbook: the wizard ends in a booking request…"* | **ancestor of `main`** ✅ |

Verified with `git merge-base --is-ancestor <sha> main` on each, 2026-09-01. **The gate is open.**

⚠️ **But do not dispatch the existing spec as it stands.** `docs/tasks/TASK-ONERAIL-three-entry-paths-one-first-login-rail.md`
traces three entry paths end to end, and **both merges rewrote the files it traces, today**:
`SIGNDOOR` changed `src/pages/SignStart.tsx` (**-397/+ lines**), `src/pages/app/Onboarding.tsx`
(**+258**) and `api/sign-start.ts`; `SIGNBOOK` changed `Onboarding.tsx` again (**-176**) and cut
`src/pages/Visit.tsx`. **Its "path C, contract link email" trace is describing a door that was
replaced this morning.**

🔒 **My recommendation: release it, but route it back through DSNR for a rebase first.** ⚠️ **It is a
proper pass — three end-to-end traces re-verified against the live DB and the new code — not an
appendix to a copy task, so I did not rush it into this thread.** **I have not touched the file.**
**Say the word and it gets its own DSNR run.**

---

# 7. WHAT I DID NOT DO
- ⚠️ **I did not author `TASK-POLICIESANDFAQ`**, or guess at the two owner calls inside it. §0.1.
- **I did not spawn a subagent** (`CLAUDE.md`, `DSNR-ROLE.md` §6). Every measurement here is mine.
- **I wrote nothing to production and read nothing from it.** All measurements are against the repo
  at `main` `4297345a` and the committed `dist/` built 2026-09-01 17:19.
- **I deleted nothing.** The 2026-08-24 `SITECOPY` draft is retained with a superseded banner.

---

# 8. 🔒 THE PROMPT — this goes to ORCH

> ⚠️ **PROCESS CORRECTION, owner 2026-09-01, recorded here because it narrows a 🔒 rule:**
> > *"you dont need to specify the settings for an ORCH thread, that thread runs continuously. if you
> > want to specify a suggested thread setting for the TASK thread ORCH will be queuing up you can do
> > that inside of a file ORCH will read from you."*
>
> **`D37` and `DSNR-ROLE.md` §7 say every prompt any role hands the owner states MODEL · EFFORT ·
> THINKING. He has narrowed that: it does NOT apply to a STANDING thread.** **A prompt to `ORCH` is a
> label for a thread that is already running at its own settings, not a launch.**
> 🔒 **Per-TASK settings live in §3 of this file and at the head of each spec.**
> **ORCH: this is yours to record wherever `D37` lives.**

```
FHE-ORCH-SITE-PUBLIC

cd /Users/cactai/Downloads/claude-code-repo/fhe-website-app
Read docs/reports/FHE-DSNR-SITE-PUBLIC-HANDOFF.md and sequence the public-site lane.
```

## 🔒 EVERYTHING ORCH NEEDS IS REACHABLE FROM THAT ONE PATH. THE CHAIN, EXPLICITLY:

**This file carries, in full:** the whole state at a glance (masthead) · the one blocker and why a
paste will not fix it (§0.1) · **the three owner rulings to record, verbatim, including the one that
narrows `D37`** (§0.2) · the `SITESEO` follow-through — two owner diagnostics, one owner input, the
seven-item build list and the curl-only proof (§0.3) · the chunks and their order (§1) · the
contention **and the concurrent-commit incident on `main`** (§2) · model and effort per TASK thread
(§3) · what I decided that the drafts did not (§4) · the ruled landing shape (§5) · the `ONERAIL`
gate status and why it goes back to `DSNR` (§6) · what I did not do (§7).
🔒 **Nothing in the owner's conversation with me is missing from this file.**

**And these are the files it points to. ORCH does not need anything else, and no context travels in a
prompt:**
| Path | What it is |
|---|---|
| `docs/tasks/TASK-SITECOPY-A-jumper-only-program-not-barn-in-public-marketing-copy.md` | ready |
| `docs/tasks/TASK-SITECOPY-B-the-app-stops-calling-itself-the-barn.md` | ready |
| `docs/tasks/TASK-LANDINGSIGNIN-a-sign-in-path-on-the-landing-page.md` | ready — shape ruled |
| `docs/tasks/TASK-SITESEO-three-indexed-urls-prerender-a-blank-page.md` | ready — **ruled keep-and-301**; §4a–§4d is the writeup, §8 the proof |
| `docs/tasks/TASK-ONERAIL-three-entry-paths-one-first-login-rail.md` | gate open, **spec stale — see §6** |
| `docs/tasks/TASK-SITECOPY-jumper-only-program-not-barn.md` | ⚠️ superseded, retained for provenance. **Do not build from it.** |
| `docs/reports/FHE-DSNR-SITE-PUBLIC-LEDGER.md` | every query behind every number in this file |

## 🔒 THE STATE, IN ONE LINE EACH
- ✅ **`SITECOPY-A` · `SITECOPY-B` · `LANDINGSIGNIN`** — ready, file-disjoint, **run in parallel**.
- ✅ **`SITESEO`** — ready and ruled. **Sequences after `SITECOPY-A`** (shared `src/lib/seo.ts`).
- ⚠️ **`ONERAIL`** — hold condition satisfied (`0ac49e61`, `2fa1f7b9` both in `main`), but both
  merges rewrote the files its traces describe. **Release it back to `DSNR` for a rebase, not
  straight to a build thread.**
- ⛔ **`POLICIESANDFAQ`** — **needs a `DISCO` pass**, not a paste. §0.1.
- 📋 **Owner diagnostics `A1`/`A2` and input `B1`** — §0.3. **None of them block anything.**
