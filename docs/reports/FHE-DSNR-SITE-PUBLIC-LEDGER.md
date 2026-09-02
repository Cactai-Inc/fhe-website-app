# FHE-DSNR-SITE-PUBLIC — LEDGER

Opened and closed 2026-09-01. Role: `docs/method/DSNR-ROLE.md`. Binding: `docs/method/THE-RUNNING-RECORD.md`.
**Handoff:** `docs/reports/FHE-DSNR-SITE-PUBLIC-HANDOFF.md`.

## RESUME
**State: CLOSED.** Three drafts in, **four specs out**, one chunk refused for lack of source.
**Three owner rulings received after the first handoff and built in** — see §0.2 of the handoff:
`R1` the landing shape approved (the cart is the way onward), `R2` `SITESEO` keep-and-301 to
`/lessons`, `R3` a standing thread's prompt carries no model/effort line (**narrows `D37`**).
Everything committed with explicit paths. **Next stop is `ORCH`** — the prompt is §8 of the handoff.
**If this thread is resumed:** the only open DSNR work is (a) `TASK-POLICIESANDFAQ`, which now needs a
**`DISCO` pass** rather than the lost draft, and (b) a `TASK-ONERAIL` rebase, which is a fresh DSNR
run. ⚠️ **Three claims of mine were corrected in-thread — analytics, the paste ask, the ORCH prompt
settings — all fixed in the handoff masthead. Do not carry the earlier versions.**

## THE ASK (owner, 2026-09-01, verbatim)
> Read docs/method/DSNR-ROLE.md, then rebase and chunk TASK-SITECOPY, TASK-POLICIESANDFAQ and
> TASK-LANDINGSIGNIN from the owner's chat-thread drafts.
> Hold TASK-ONERAIL until SIGNDOOR and SIGNBOOK merge.

## WHAT SHIPPED
| File | |
|---|---|
| `docs/tasks/TASK-SITECOPY-A-jumper-only-program-not-barn-in-public-marketing-copy.md` | new |
| `docs/tasks/TASK-SITECOPY-B-the-app-stops-calling-itself-the-barn.md` | new |
| `docs/tasks/TASK-SITESEO-three-indexed-urls-prerender-a-blank-page.md` | new, **owner-gated** |
| `docs/tasks/TASK-LANDINGSIGNIN-a-sign-in-path-on-the-landing-page.md` | rebased in place |
| `docs/tasks/TASK-SITECOPY-jumper-only-program-not-barn.md` | superseded banner, **retained** |
| `docs/reports/FHE-DSNR-SITE-PUBLIC-HANDOFF.md` | new |

---

# EVERY NUMBER IN THE HANDOFF, WITH THE QUERY THAT PRODUCED IT
All run 2026-09-01 against `main` at `4297345a`, and the committed `dist/` built 2026-09-01 17:19.

## Baseline
- `git branch --show-current` → `main`; `git log --oneline -1` → `4297345a`.
- `git status --short` → clean at open.

## SIGNDOOR / SIGNBOOK merge state (the hold condition)
```
git merge-base --is-ancestor 0ac49e61 main   → 0  (merge task/signdoor)
git merge-base --is-ancestor 2fa1f7b9 main   → 0  (merge task/signbook)
git merge-base --is-ancestor 6ffbd0df main   → 0  (SIGNDOOR verification)
git merge-base --is-ancestor 424c413a main   → 0  (SIGNBOOK verification)
```
**Both merged. Gate open.** Staleness of ONERAIL measured with
`git diff --stat 0ac49e61^1 0ac49e61` → `src/pages/SignStart.tsx | 397 +++---`,
`src/pages/app/Onboarding.tsx | 258 ++++---`, `api/sign-start.ts | 227 +++---`.
`git diff --stat main task/signbook` → 36 files, incl. `Onboarding.tsx | 176 ++---`, `Visit.tsx | 84 ---`.

## `TASK-POLICIESANDFAQ` — the search that came up empty
```
grep -rln -i -E "SITECOPY|POLICIESANDFAQ|LANDINGSIGNIN|ONERAIL" --include="*.md" .
grep -rn -i "POLICIESANDFAQ" --include="*.md" .
   → docs/design/refactor/CHAT-THREAD-ADMIN-REFACTOR-2026-08-26.md:165  (the only hit)
grep -rln -i "compliance" --include="*.md" docs/   → no COMPLIANCE-FINDINGS file
find . -iname "*polic*" -o -iname "*faq*"          → src/pages/Faq.tsx,
                                                     supabase/contract_templates/COMPANY_POLICIES.md
grep -rn -i -E "privacy|terms of|cancellation|refund" src/pages/*.tsx src/components/layout/Footer.tsx
   → zero
```
**Neither the draft nor COMPLIANCE-FINDINGS is in this repo.** `DSNR-ROLE.md` §2 → stop, name it, hand
it back. **Done in handoff §0.**

## SITECOPY — the strings
```
grep -rn -i "hunter" index.html src/ --include="*.ts" --include="*.tsx" --include="*.html"
grep -rn -i "barn"   index.html src/ --include="*.ts" --include="*.tsx" --include="*.html"
grep -n "the barn"   src/pages/Confirmation.tsx src/components/order/OrderPayment.tsx
```
Rendered `hunter`: `index.html:18,19`; `seo.ts:63,73,98,142,160`; `Services.tsx:34,63`; `About.tsx:76`.
Rendered `barn` (self-referential): `Confirmation.tsx:148,149,150`; `OrderPayment.tsx:231`;
`ActivationOrderPanel.tsx:151`; `App.tsx:509`.
Generic / data-layer / fixtures / comments, left alone: `About.tsx:88`, `Checkout.tsx:258`,
`serviceCatalog.ts:62`, `inquiry.ts:29,75`, `acquisition.ts:48`, `intakeCategoryFields.ts:26`,
`seed.ts:76,195`, `portalFixtures.ts:31`, and comment-only hits in `PublicIntakeForm.tsx`,
`CalendarPage.tsx`, `MyPayments.tsx`.
⚠️ **The 2026-08-24 draft's claim of "no other identity-claiming `barn`" is false against this grep.**

## The `propertyTerm` mechanism (`SITECOPY-B`'s incumbent)
```
grep -rn "propertyTerm|PropertyTerm|my_property_term" src/   → definitions only:
   src/lib/propertyTerm.ts, src/contexts/AuthContext.tsx, src/contexts/BrandProvider.tsx
grep -rn "usePropertyTerm|withPreposition|withArticle" src/  → ZERO consumers
```
`BrandProvider.tsx:139-141` exports `usePropertyTerm()`, `?? DEFAULT_PROPERTY_TERM` — cannot throw.
`src/App.tsx:151-153` — `AuthProvider` → `BrandProvider` → `CartProvider` → all routes, so
`/confirmation` and `/app/*` are both inside it.
`src/lib/propertyTerm.ts:28-34` — FHE's default is `ranch`, resolved synchronously.
**`TASK-FACILITYTERM` built it; nothing ever adopted it. D17 finding, carried into `B` §2.**

## SITESEO — the blank prerenders
```
grep -n 'path="/' src/App.tsx   → :173 /shop→/lessons, :179 /ride→/lessons, :192 /membership→/lessons
for each dist/<route>/index.html: grep -o '<title data-rh="true">[^<]*</title>'  +  <main> byte count
```
| route | title | `<main>` bytes |
|---|---|---|
| `/` | *"…Hunter/Jumper Lessons…"* | 0 (Landing renders bare, by design) |
| `/about` | real | 9,914 |
| `/story` | real | 14,500 |
| `/lessons` `/horse` `/acquisition` `/faq` | real | 3,645 / 2,831 / 2,928 / 2,722 |
| **`/shop` `/ride` `/membership`** | ⚠️ **empty** | ⚠️ **29 each** |

`dist/sitemap.xml` `<loc>` list contains `/shop`, `/ride`, `/membership`; **omits `/services` and
`/faq`.** `scripts/prerender.mjs:21` `ROUTES` omits `/services`, includes `/membership` and `/faq`.
`scripts/seo-files.mjs:14-24` hardcodes a **third** list; its `/membership` priority is `0.8` vs
`seo.ts`'s `0.3`. `grep -rn "indexable" src/ scripts/` → the interface and the literals, **no reader**.

**`index.html`'s static tags are dev-only:** `scripts/prerender.mjs:47-50` strips `<title>` and
`<meta name="description">` from the template before injecting Helmet's; `dist/index.html` is itself
the prerender of `/` and carries exactly one title, `<title data-rh="true">`.

## Reach of the public routes
```
grep -rn 'to="/about"|to="/services"' src/ --include="*.tsx"
```
`/about` ← `Confirmation.tsx:206` **only**. `/services` ← `Checkout.tsx:121`, `NotFound.tsx:24`,
`About.tsx:206`, `Account.tsx:114`. **Neither is in the header nav or the footer nav.**
`/ride`, `/shop` ← **nothing**.

## LANDINGSIGNIN
⚠️ `src/components/Header.tsx` **does not exist** — `find src -name "Header*.tsx"` →
`src/components/layout/Header.tsx` (418 lines). Same move for `Footer.tsx`.
Verified: `:54` `useLocation()`, `:55` `useCart()`, `:73` `overDark` init, `:258` right cluster,
`:334` `itemCount === 0`, `:342` `min-[940px]`, `:348` `Say Hello`, `:406-411` mobile `Sign In`,
`:316-318` the 2026-08-16 ruling, `:325-333` the 2026-08-17 ruling.
`Footer.tsx:90-94` → `to={user ? '/app' : '/login'}`, label `Member sign-in` (**not** `Sign In`).
`Landing.tsx:7` imports Header; `:9-23` "renders bare"; `:31-35` `qs-no-scroll`.
`grep -c "site-footer" dist/index.html` → **0** (vs present in `dist/ride/index.html`).

### 🔒 THE OVERRULE, with its proof
`Header.tsx:84-121` re-measures `overDark` on **scroll and resize, on every route**, via
`document.querySelectorAll('[data-header-tone="dark"]')` (`:97`), `setOverDark(dark)` (`:104`),
deps `[location.pathname]` (`:121`).
```
grep -rn 'data-header-tone' src/ --include="*.tsx"
   → src/pages/Landing.tsx:63, src/pages/Story.tsx:223, src/pages/Story.tsx:512
```
**`/story` has two dark sections.** Gating the new link on `overDark`, as the draft instructed, would
show Sign In on `/story` once either scrolls under the header. **Spec now gates on
`location.pathname === '/'` and makes the scroll case a numbered test.**

## Contention snapshot
`git worktree list` → `wt-1` `task/visitmenu` (dirty: `api/request-received.ts`), `wt-2` and `wt-3`
detached. **No overlap with any chunk.** ⚠️ **A snapshot, not a claim — D36, ORCH owns this state.**

## D-rule dedupe
`grep -n -i "jumper|not a barn|Carmel Creek" CLAUDE.md` → **zero hits**. The two wording rulings are
not D-rules; they exist only at `CHAT-THREAD-ADMIN-REFACTOR-2026-08-26.md:104-112`. **Raised as
ASK-OWNER 3.**

---

## THE THREE RULINGS, AND WHAT EACH CHANGED IN A FILE
| | Ruling | Files changed |
|---|---|---|
| `R1` | the full-cart landing corner is correct; the cart is the way onward | `TASK-LANDINGSIGNIN` TRAP 2 + test §8.3 (now fails if the cart is absent from the frame); handoff §5 |
| `R2` | keep `/ride` `/shop` `/membership`, 301 to the CTA's booking page | `TASK-SITESEO` §4 rewritten, Option B struck, gate removed; handoff §0.2/§0.3 |
| `R3` | no model/effort line on a standing thread's prompt | handoff §3 + §8 |

**`R2` target verified before it was written in:** `Landing.tsx:138`, `Header.tsx:47`, `Footer.tsx:76`
all → `/lessons`. **`R1` rationale verified:** `Header.tsx:156-171`, `cart()` gates on `itemCount > 0`
alone — no breakpoint, no route test — so it is present on landing at every width.

## THREE CLAIMS OF MINE THAT WERE WRONG, AND THE CORRECTION
1. ⚠️ **"there is no analytics or Search Console integration."** **FALSE.** `src/main.tsx:6,16` —
   `@vercel/analytics/react`, `<Analytics />` rendered on every page, `package.json:24` `^2.0.1`.
   **Vercel Web Analytics answers "does anyone land on these URLs" today.** Only the search-position
   half needs GSC. Corrected in `TASK-SITESEO` §4a and handoff §0.3.
2. ⚠️ **I asked the owner to paste in a document from a planning thread that may not exist.**
   **Withdrawn** — `POLICIESANDFAQ` needs a `DISCO` pass. The two owner calls inside it were
   reconstructed from `COMPANY_POLICIES.md`'s 16 sections and `seo.ts:44`.
3. ⚠️ **I put MODEL · EFFORT · THINKING on a prompt for `ORCH`.** He struck it — `R3`.

## LATE FINDING — the SPA fallback serves the landing page to crawlers
`vercel.json`'s catch-all rewrite is `{"source": "/((?!api/).*)", "destination": "/index.html"}`.
Vercel checks the filesystem first, so prerendered directories win — but **any public route with no
prerendered directory falls through to `dist/index.html`, which IS the prerender of `/`.**
`dist/services/` does not exist. **So `/services`, `/contact`, `/visit`, `/gift` and `/questions` all
serve the LANDING page's markup and `<title>` as initial HTML.** Same class as the three blank pages,
invisible in a browser — which is why `TASK-SITESEO` §8 is `curl`-only. Written into that spec as
§2.4, and it is why `/services` gets prerendered rather than merely re-flagged.

## ⚠️ INCIDENT — a concurrent thread committed my file
`9652d1b8`, authored by `FHE-DSNR-SIGNFLOW`, contains 103 lines of `TASK-SITESEO-…md`. That thread
committed while my edits were unstaged in the same working tree and its `git add` swept them in.
**No content lost; `main` correct.** ⚠️ **But `git blame` on the SITESEO ruling points at the wrong
thread.** **Root cause on my side: I used `git add -A docs/` once, against `DSNR-ROLE.md` §6's
stage-explicit-paths rule. Every later commit names its paths.** Carried to ORCH in handoff §2.

# TEARDOWN
Read-only against production throughout — **no DB connection was opened, nothing was written to
prod.** No subagents spawned. No worktree entered. Nothing deleted. Nothing pushed.
**Process census:** no background jobs, servers, watchers or builds were started by this thread; the
only writes were the six files listed above, staged by explicit path and committed.
