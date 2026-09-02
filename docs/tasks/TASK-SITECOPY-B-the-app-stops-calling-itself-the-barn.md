# TASK-SITECOPY-B — the app stops calling itself "the barn", and starts using the tenant's own word

**Spec by `FHE-DSNR-SITE-PUBLIC`, 2026-09-01.**
**Thread name: `FHE-TASK-SITECOPY-B`.**
**Second half of the split of `docs/tasks/TASK-SITECOPY-jumper-only-program-not-barn.md`** (owner's
2026-08-24 chat-thread draft). ⚠️ **The four strings below were NOT in that draft — DSNR found them
on 2026-09-01 while re-running its greps. See §2.**

> ## READ THESE, BY PATH — nothing else is handed to you
> - `docs/method/TASK-ROLE.md` — the standing requirements. **Not repeated here.**
> - `docs/method/CLNR-ROLE.md` §3 — your zeroth act.
> - `docs/method/THE-RUNNING-RECORD.md` — open `docs/reports/FHE-TASK-SITECOPY-B-LEDGER.md` FIRST.
> - `CLAUDE.md` **D17** (`:365`) — reachable, or it is not done.
> - `CLAUDE.md` **D18** (`:376`) — never leave a second implementation beside a correct one.
>   ⚠️ **This task is a D18 ADOPTION: the correct mechanism already exists and has ZERO consumers.**
> - `CLAUDE.md` **D20** (`:406`) — *"a state claim in a doc is a hypothesis."* Including this spec's.
> - `src/lib/propertyTerm.ts` — **read the whole file. It is 70 lines and it is the spec for how these
>   sentences are built.**
> - `docs/design/refactor/CHAT-THREAD-ADMIN-REFACTOR-2026-08-26.md` **ruling 12** (`:104-112`) — the
>   standing ruling this applies.
> - `docs/tasks/TASK-SITECOPY-A-jumper-only-program-not-barn-in-public-marketing-copy.md` — the sibling
>   chunk. **File-disjoint from this one. Do not touch its four files.**

---

## 1. THE OWNER'S WORDS

> *"FHE is a program operating out of Carmel Creek Ranch, not a barn."*
> — owner, 2026-08-24, carried in the relay's ruling 12

And the earlier ruling that built the mechanism, quoted verbatim inside `src/lib/propertyTerm.ts:19`:

> *"FHE is a stable at a ranch, not a barn"*

**`-A` applies this rule to marketing copy, where the answer is a fixed word. This chunk applies it
where the app speaks about itself to a person who is mid-transaction — and there the answer is not a
fixed word, it is the TENANT'S word.**

## 2. WHAT WAS MEASURED — run by DSNR on 2026-09-01, `main` at `4297345a`

`grep -rn "the barn" src/ --include="*.tsx"`, filtered to strings that actually render:

| # | `file:line` | The rendered string today | Where a person sees it |
|---|---|---|---|
| 1 | `src/pages/Confirmation.tsx:148` | `"Your inquiry has been emailed to the barn."` | **public** route `/confirmation` (`src/App.tsx:216`), after any inquiry |
| 2 | `src/pages/Confirmation.tsx:149` | `"We could not email the barn just now — but your inquiry is saved and already in our queue."` | same, failure branch |
| 3 | `src/pages/Confirmation.tsx:150` | `"Sending your inquiry to the barn…"` | same, pending branch |
| 4 | `src/components/order/OrderPayment.tsx:231` | `"We accept Zelle — instant, no fees, straight from your bank app — or cash at the barn."` | `/order/:id` (`OrderDetail.tsx:152`) and `/app/onboarding` (`Onboarding.tsx:29,` rendered) |
| 5 | `src/components/app/ActivationOrderPanel.tsx:151` | `Thank you — {reached === 1 ? 'someone' : \`${reached} of us\`} at the barn has been told, …` | first-login activation, rendered from `Onboarding.tsx:1453` |

**All five are FHE describing ITSELF.** That is what makes them different from the instances `-A`
leaves alone, which describe barns in general or ask about the *client's* barn.

### The mechanism that already exists, and has never been used
| Fact | The measurement |
|---|---|
| `usePropertyTerm()` is exported and public-safe | `src/contexts/BrandProvider.tsx:139-141` |
| `BrandProvider` wraps the **entire** route tree | `src/App.tsx:151-153` — `AuthProvider` → `BrandProvider` → `CartProvider` → all routes. **Both `/confirmation` and `/app/*` are inside it.** |
| It resolves synchronously to FHE's real word before any fetch | `src/lib/propertyTerm.ts:28-34` — `DEFAULT_PROPERTY_TERM = { key:'RANCH', term:'ranch', article:'the', plural:false, preposition:'at' }` |
| The sentence builders exist | `withArticle()` → *"the ranch"*; `withPreposition()` → *"at the ranch"*; `agree()` for subject-verb — `src/lib/propertyTerm.ts:49-75` |
| ⚠️ **Consumers today: ZERO** | `grep -rn "usePropertyTerm\|withPreposition\|withArticle" src/` returns only the definitions in `propertyTerm.ts` and `BrandProvider.tsx`. **Nothing renders it.** |

⚠️ **So this is a D17 finding as much as a copy fix: `TASK-FACILITYTERM` built the whole mechanism and
no surface ever adopted it. You are its first consumer. Say so in your report.**

## 3. THE INCUMBENT, NAMED (D18) — CONVERGENCE onto `propertyTerm`, NOT a hardcoded word

🔒 **Do NOT replace `barn` with the literal `ranch`.** That is the trap this whole chunk exists to
avoid: it would put a fifth hardcoded facility word into the app **beside** a built, correct,
tenant-driven mechanism — the exact shape D18 forbids. **Every one of the five strings is rebuilt
through `usePropertyTerm()` and the helpers in `src/lib/propertyTerm.ts`.**

**For FHE the rendered output is identical either way — "the ranch". The difference is invisible
until a second tenant exists, which is precisely when a hardcoded word becomes expensive.**

## 4. THE TRAPS

**TRAP 1 — ⚠️ `propertyTerm` IS A SHAPE, NOT A STRING.** `src/lib/propertyTerm.ts:5-8` states it:
`stables` and `grounds` are **plural in form** — *"the stables ARE closed"*. **Never interpolate
`t.term` bare into a sentence.** Use `withArticle(t)` / `withPreposition(t)` / `agree(t, …)`. The
file's own instruction: *"Where a sentence can't survive the substitution cleanly, rewrite the
sentence rather than special-case it."*

**TRAP 2 — ⚠️ #5 ALREADY HAS A SUBJECT-VERB BUG, ON THE LINE YOU ARE EDITING.**
`ActivationOrderPanel.tsx:151` renders `{reached} of us at the barn **has** been told`. For
`reached === 1` it says *"someone … has"* ✅; for `reached > 1` it says *"3 of us … has"* ❌. **You are
rewriting this clause anyway — fix the agreement in the same edit.** Two verbs now vary
independently (the count, and the property term if it is plural); `agree()` handles the second.
⚠️ **Do not fix the count-agreement by special-casing — build the sentence so both are correct.**

**TRAP 3 — the pending/ok/fail trio must stay parallel.** `Confirmation.tsx:148-150` are three props
on one `<SendLine>`. Rebuild all three or none; a person who watches it go pending → ok must not see
the noun change mid-flight.

**TRAP 4 — `OrderPayment.tsx` renders on TWO surfaces.** `/order/:id` and `/app/onboarding`. Both must
be checked. ⚠️ **`src/pages/app/Onboarding.tsx` was rewritten twice today** — by `TASK-SIGNDOOR`
(merge `0ac49e61`) and `TASK-SIGNBOOK` (merge `2fa1f7b9`). **Re-read it before you assume how
`OrderPayment` is mounted there; do not edit it.**

**TRAP 5 — `&mdash;` in `OrderPayment.tsx:231`.** The line uses HTML entities inside JSX. Preserve
them exactly; do not "normalise" to literal em-dashes as a drive-by.

**TRAP 6 — the hook must not be called conditionally.** If any of these strings sits inside a branch
or a nested render helper, hoist `const t = usePropertyTerm()` to the component body.
⚠️ **See the standing trap in memory: a component defined INSIDE another component remounts on every
keystroke.** Do not create a small `<PropertyWord>` component inline to solve this.

**TRAP 7 — SSR / prerender safety.** `/confirmation` is not prerendered
(`scripts/prerender.mjs:21` does not list it) so this is low-risk, **but `usePropertyTerm()` returns
`DEFAULT_PROPERTY_TERM` when there is no provider** (`BrandProvider.tsx:141`, `?? DEFAULT_PROPERTY_TERM`)
— it cannot throw. **Confirm that in your ledger rather than assuming it.**

## 5. OUT OF SCOPE, EXPLICITLY

- **Everything in `-A`** — `index.html`, `src/lib/seo.ts`, `src/pages/Services.tsx`,
  `src/pages/About.tsx`. **File-disjoint. Do not open them.**
- ⚠️ **`src/App.tsx:509`** — `description="Configuration for how the barn runs."` on the Settings
  nav-group. **DSNR found it and is deliberately leaving it out.** The string is a **prop passed in
  the router tree**, so it cannot call a hook; fixing it properly means `NavGroupCardsPage` deriving
  its own description, which is a component change on a staff surface, not a copy edit. **Record it in
  your report as an open item. Do not fix it here, and do not open `src/App.tsx`.**
- **`src/components/PublicIntakeForm.tsx`, `src/pages/app/CalendarPage.tsx`,
  `src/pages/app/MyPayments.tsx`** — every `barn` in these is inside a **code comment**, not rendered.
  Verified 2026-09-01. **Leave them.** (Rewriting comments would inflate the diff and hide the four
  real changes.)
- **`src/contexts/AuthContext.tsx`, `src/contexts/BrandProvider.tsx`, `src/lib/propertyTerm.ts`** —
  you are the mechanism's first CONSUMER. **You do not change the mechanism.** If it cannot express a
  sentence, say so and stop; that is an ASK-OWNER.
- **Any other surface's facility wording.** This is four files. A general adoption sweep is a
  different task and is not authorised here.

## 6. THE REACH — what a person clicks

| String | The click path, end to end | Is it the only way? |
|---|---|---|
| #1–#3 | any public inquiry → `/checkout` → submit → **`/confirmation`** (`src/App.tsx:216`). Public, no auth. | Yes — `/confirmation` is the single post-inquiry destination. |
| #4 | (a) `/order/:id` via `OrderDetail.tsx:152` — auth-gated, reached from the member's own orders; (b) `/app/onboarding` via `Onboarding.tsx` — first-login. | **Two paths, one component.** One edit covers both. |
| #5 | `/app/onboarding` → activation panel, `Onboarding.tsx:1453`. **First login only** — a person sees it once. | Yes. |

⚠️ **#5 is seen once per person, at first login, and never again. Prove you reached it** — a
screenshot of the rendered panel, or the probe that renders it. **"The string is changed in the
source" is not reach (D17).**

## 7. THE TELL, AND HOW IT IS UNDONE (D19)

**No D19 flags.** Nothing here moves value, writes a row, or sends anything — all five strings are
*descriptions of* actions taken elsewhere. **The tell is the rendered sentence; the undo is
`git revert`.** ⚠️ **State that explicitly in the report rather than omitting the section.**

## 8. THE TEST THIS MUST PASS

1. **`grep -rn "the barn" src/ --include="*.tsx" --include="*.ts"` returns only `src/App.tsx:509` and
   comment lines.** Paste the full output. Zero rendered `the barn` outside the documented exclusion.
2. **`/confirmation` rendered in a real browser**, all three `SendLine` states exercised (ok, fail,
   pending — force them if you must). Each reads `the ranch`, none reads `the barn`. Quote all three.
3. **`/order/:id` rendered in a real browser.** The payment paragraph reads `or cash at the ranch`,
   with the `—` dashes intact.
4. **`/app/onboarding` rendered**, showing the same `OrderPayment` paragraph — proving TRAP 4's second
   surface, not inferring it.
5. **The activation panel (#5) rendered, for `reached > 1`.** It reads `N of us at the ranch **have**
   been told`. ⚠️ **`has` is a FAIL** — TRAP 2. And rendered for `reached === 1`: `someone at the
   ranch **has** been told`.
6. **Substitution proof — the reason this is a mechanism and not a word.** With `propertyTerm`
   overridden to a **plural** term (`{key:'STABLES', term:'stables', article:'the', plural:true,
   preposition:'at'}`), all five strings still read grammatically. **Show the five rendered
   sentences under that override.** ⚠️ **This is the test that separates a real D18 adoption from a
   find-and-replace, and it is not optional.**
7. **`grep -rn "usePropertyTerm" src/` now returns consumers**, not just the definition. Paste it.
8. **`npm run build` and the typecheck both pass**, and no new hook-order or lint warning appears in
   the four touched files.
9. **`src/pages/app/Onboarding.tsx`, `src/App.tsx`, and the four `-A` files are untouched.** Prove it:
   `git diff --name-only` in the report. ⚠️ **A diff naming any of them is a failed report.**

## 9. WHERE THE REPORT GOES

`docs/reports/TASK-SITECOPY-B-REPORT.md`, plus the running ledger at
`docs/reports/FHE-TASK-SITECOPY-B-LEDGER.md`.
**Carry into the report, as their own sections:** (a) the D17 finding that `propertyTerm` shipped with
zero consumers until now, and (b) `src/App.tsx:509` as an open item with the reason it was excluded.
