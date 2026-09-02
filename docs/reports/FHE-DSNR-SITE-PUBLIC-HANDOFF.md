# FHE-DSNR-SITE-PUBLIC HANDOFF — for ORCH

**From `FHE-DSNR-SITE-PUBLIC`, 2026-09-01. Subject: the public-site lane.**
**Upstream:** ⚠️ **no DISCO handoff.** The source is the owner's chat-thread drafts, staged in
`docs/tasks/`, relayed via `docs/design/refactor/CHAT-THREAD-ADMIN-REFACTOR-2026-08-26.md:163-168`.
**Working ledger, with every query behind every number here:** `docs/reports/FHE-DSNR-SITE-PUBLIC-LEDGER.md`.

**Three drafts were handed to me. Two became four specs. One I cannot write.**

---

# 0. ⚠️ ASK-OWNER — MOST BLOCKING FIRST

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

## ✅ RULED — three indexed URLs serve a blank page. **KEEP AND REDIRECT.**
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

## ASK-OWNER 3 — not blocking, but he should know
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
| **`FHE-TASK-POLICIESANDFAQ`** | — | — | — | ⛔ **needs a `DISCO` pass first — ASK-OWNER 1** |

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
| `src/App.tsx` | **`SITESEO`** only | I deliberately kept `App.tsx:509`'s *"how the barn runs"* **out of `B`** — it is a prop in the router tree and cannot call a hook. **Recorded as an open item in `B` §5**, not silently dropped. |
| `api/request-received.ts` | **live in `wt-1`** (`task/visitmenu`, uncommitted) | **No overlap** with any chunk here. |

**Worktrees at the time of writing:** `wt-1` `task/visitmenu` (dirty), `wt-2` and `wt-3` detached.
⚠️ **I do not know what is running — `D36` says you assign them. This is a snapshot, not a claim.**

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
- ⚠️ **I did not author `TASK-POLICIESANDFAQ`**, or guess at the two owner calls inside it. §0.
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
> 🔒 **Per-TASK settings belong in this file — §3 above, and now restated at the head of each spec.**
> **ORCH: this is yours to record wherever `D37` lives.**

```
FHE-ORCH-SITE-PUBLIC

cd /Users/cactai/Downloads/claude-code-repo/fhe-website-app
Read docs/reports/FHE-DSNR-SITE-PUBLIC-HANDOFF.md and sequence the public-site lane.
```

⚠️ **BEFORE ORCH FIRES ANYTHING: §0 has ONE question left for the owner.**
**ASK-OWNER 1 blocks `POLICIESANDFAQ` — and the fix is a `DISCO` thread, not a paste.**
🔒 **`SITESEO` is RULED and no longer gated — dispatch it after `SITECOPY-A`.**
🔒 **The `LANDINGSIGNIN` shape (§5) is RULED and no longer a gate.**
⚠️ **ASK-OWNER 1 is the ONLY thing still open, and its recommendation changed: `POLICIESANDFAQ` needs
a fresh `DISCO` pass, not a lost document.**
🔒 **Neither blocks `SITECOPY-A`, `SITECOPY-B` or `LANDINGSIGNIN` — those three are ready now and can
run in parallel.**
