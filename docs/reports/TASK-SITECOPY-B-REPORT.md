# TASK-SITECOPY-B — REPORT

**Thread `FHE-TASK-SITECOPY-B` · `wt-2` · branch `task/sitecopy-b` · merge-base `0ae5855f`.**
**Ledger: `docs/reports/FHE-TASK-SITECOPY-B-LEDGER.md`.**

**CLNR: clean.** *(Census, resumability test per role, and the one thing I deliberately did not move
are in the ledger. Nothing needed fixing.)*

---

## 1. THE HEADLINE

**The five strings in which the app describes ITSELF now compose from the tenant's own property-term
shape.** For FHE they render *"the ranch"*, exactly as before; under a **plural** tenant word they
render *"the stables"* and stay grammatical — proven by rendering, not by reading.
**The pre-existing subject-verb bug on `ActivationOrderPanel.tsx:151` is fixed in the same edit:
`3 of us … HAVE been told`.**
⚠️ **THE SPEC'S HEADLINE FINDING IS FALSE. `usePropertyTerm()` did not have zero consumers — it had
16, and it already had them at the commit DSNR measured.** There is no D17 finding here.
⚠️ **AND §8 TEST 1 CANNOT PASS AS WRITTEN: five more RENDERED `the barn` strings exist, and the same
spec's §5 forbids me from touching them.** Both are §6 below.

---

## 2. CRITERION BY CRITERION AGAINST "THE TEST THIS MUST PASS"

### ⚠️ 1. `grep -rn "the barn" src/ --include="*.tsx" --include="*.ts"` — **FAILS AS WRITTEN, and the spec is why**

```
src/App.tsx:509:  <NavGroupCardsPage groupKey="settings" heading="Settings" description="Configuration for how the barn runs." />
src/components/PublicIntakeForm.tsx:266:                  which side of the barn to walk them round. */}
src/components/app/AgreedLessonPanel.tsx:71:   * agreeing is in the barn's own timezone, so the words the client reads in
src/components/app/ActivationOrderPanel.tsx:52: * it read "{reached} of us at the barn HAS been told" for every count, so any
src/lib/recordedDate.ts:36:/** Today at the barn as `YYYY-MM-DD` (`en-CA` renders ISO order natively). */
src/lib/recordedDate.ts:43:/** True when `ymd` names a day before today at the barn — i.e. this act is a
src/lib/questionSets.ts:408:    //     turnout alone." It is how the barn operates, not a preference; asking
src/lib/questionSets.ts:462:        kind: 'short_text', placeholder: 'City, or the barn it is kept at',
src/lib/admin.ts:425:      /** The slot in the barn's own words — see AgreedLessonPanel. */
src/lib/admin.ts:671: *  `YYYY-MM-DD` at the barn. Until this existed the RPC had no date parameter at
src/lib/files.ts:353: * OWNERSHIP is the ORG, not Claire's account and not the rider's: the barn took
src/lib/standingSlots.ts:25: *  time in the barn's own day; the browser doing the reading is the one that knows
src/lib/dashboard/windows.ts:17: * Sunday-start, matching `CalendarPage`'s own `startOfWeek` and the barn's week.
src/pages/app/ContractPage.tsx:819:  // party's behalf" flow so the barn can wet-sign in the office.
src/lib/ops/api-payments.ts:372: *  ⚠️ TASK-BACKDATE — `paidAt` is a bare `YYYY-MM-DD` at the barn and is the date
src/pages/app/CalendarItemPanel.tsx:154:      // No hardcoded placeholder anymore — default to the barn default (or the
src/lib/ops/api-lessons.ts:844: *  picker — barn horses and clients' own horses alike. Label prefers the barn
src/pages/app/ops/ContactsPage.tsx:607:                  placeholder="Left the barn, duplicate record, test identity…"
src/pages/app/ops/barnops/ConsumptionLogPage.tsx:210:              <FormField label="Horse" hint="Optional — attribution falls to the barn when blank.">
src/pages/app/CalendarPage.tsx:448:          D17: routed is not reachable. A weekly membership is the barn's monthly
src/pages/app/CalendarPage.tsx:452:          own Calendar, it states what they hold in the barn's own words (D25 — a
src/pages/app/MyPayments.tsx:94:     pays — those are the barn's to change, and the order's own control does it. */
src/pages/app/ops/barnops/AllocationRulesPage.tsx:102:        hint="'default' names the barn payer that absorbs uncovered remainders."
src/pages/app/ops/barnops/AllocationRulesPage.tsx:413:            emptyMessage="Without an override, attribution derives from each horse's parties; add a 'default' rule for the barn payer."
src/pages/app/ops/NewContractPage.tsx:133:    // the lease offered every horse in the barn.
src/pages/app/ops/hubs/BarnopsHubPage.tsx:88:            Inventory, consumption, and cost attribution for the barn.
```

**All five of MY strings are gone.** `ActivationOrderPanel.tsx:52` is a comment I wrote, quoting the
bug I fixed. ⚠️ **But FIVE of the remaining lines RENDER, and the spec's §5 says they are mine not to
touch. Read §6.**

### 2. `/confirmation`, all three `SendLine` states, in a real Chromium — **PASS**
Rendered, not inferred. States forced through the **real** receipt in `sessionStorage`, which is the
only thing that decides them:
```
"…EMAILS Your inquiry has been emailed to the ranch."                                  ← ok
"…EMAILS We could not email the ranch just now — but your inquiry is saved and
 already in our queue."                                                                ← fail
"…EMAILS · Sending your inquiry to the ranch… · Sending your copy…"                    ← pending
```
**None of the three pages contains "the barn" anywhere** (asserted per page, not per string).
**TRAP 3 satisfied: all three were rebuilt in one edit, on one `<SendLine>`, from one hook read.**

### 3. `/order/:id` in a real Chromium — **PASS**
```
"Payment We accept Zelle — instant, no fees, straight from your bank app — or cash at the ranch."
```
**Both em-dashes survived** — asserted explicitly; `&mdash;` entities are preserved verbatim in the
source (TRAP 5).

### ⚠️ 4. `/app/onboarding` showing the same paragraph — **THE SURFACE IS NO LONGER REACHABLE. The copy is proven; the click path is gone, and it was gone before I arrived.**
```
"Payment We accept Zelle — instant, no fees, straight from your bank app — or cash at the ranch."
   ← the payment step's own mount, rendered directly
```
**`Onboarding.tsx:2256` still mounts `OrderPayment` under `step === 'payment'`, and NOTHING sets that
step.** `grep -n "setStep(" src/pages/app/Onboarding.tsx` has no `setStep('payment')` anywhere.
The file says so itself, at `:649-653`:

> *"⚠️ `enterPayment` IS GONE, AND ONLY IT. It was the ROUTER into the payment step, and nothing
> routes there any more: payment left the wizard (CR-98 …). ⚠️ THE PAYMENT SURFACE ITSELF IS KEPT …
> (NOSTRIP)."*

**That is `TASK-SIGNBOOK` (merge `2fa1f7b9`), which the spec itself flags as having rewritten this
file the same day.** So TRAP 4's *"two surfaces"* is one live surface (`/order/:id`) and one
deliberately retired-but-kept one. ⚠️ **I did not simulate a click path that does not exist.** The
probe mounts the retired step's markup with the props `Onboarding` passes and **says in its own
output that this is the unrouted surface** — so the sentence is right the day `TASK-REQCARDS` gives
`OrderPayment` its modal home.

### 5. The activation panel, both counts — **PASS**, and the agreement bug is dead
**Reached by CLICKING the real controls** — "Notify staff this isn't correct" → note → "Send this to
staff" → `report_order_incorrect` answers, exactly as production does:
```
"Thank you — 3 of us at the ranch have been told, and it is on your order for us to work through with you."
"Thank you — someone at the ranch has been told, and it is on your order for us to work through with you."
```
⚠️ **`has` for a count above one is gone.** Asserted as a failure condition, not read by eye.

### 6. ⚠️ THE SUBSTITUTION PROOF — **PASS**, and it is the criterion that matters
`my_property_term` overridden to `{key:'STABLES', term:'stables', article:'the', plural:true,
preposition:'at'}` — **driven through the real seam** (`my_property_term` → `AuthContext` →
`BrandProvider` → `usePropertyTerm`), not by patching the component. All five, re-read off the page:
```
1  "Your inquiry has been emailed to the stables."
2  "We could not email the stables just now — but your inquiry is saved and already in our queue."
3  "Sending your inquiry to the stables…"
4  "We accept Zelle — instant, no fees, straight from your bank app — or cash at the stables."
5  "Thank you — 3 of us at the stables have been told, and it is on your order for us to work through with you."
5  "Thank you — someone at the stables has been told, and it is on your order for us to work through with you."
```
**A find-and-replace passes the singular run and fails this one. `30/30 ALL PASS` across both runs.**

### 7. `grep -rn "usePropertyTerm" src/` returns consumers — **PASS, but see §6: it always did**
```
$ grep -rl "usePropertyTerm" src/ | wc -l
17                       # 16 consumers + the definition. THREE of them are now mine:
src/pages/Confirmation.tsx
src/components/order/OrderPayment.tsx
src/components/app/ActivationOrderPanel.tsx
```

### 8. Gates — **PASS**
| | |
|---|---|
| `npm run typecheck` | **0**, exit 0 |
| `npm run typecheck:api` | **0**, exit 0 |
| `npm run lint` | **45 problems, 0 errors** |
| `npm run build` | **exit 0** |
| ⚠️ the lint baseline | **45 on `origin/main`, measured by stashing `src/` and re-running — not 46.** `BOARD.md` says 46 and is one step stale |
| my three `src/` files | **zero eslint output**, no hook-order warning |

### 9. Nothing forbidden was touched — **PASS**
```
$ git diff --name-only 0ae5855f          # the merge-base
docs/reports/FHE-TASK-SITECOPY-B-LEDGER.md
src/components/app/ActivationOrderPanel.tsx
src/components/order/OrderPayment.tsx
src/pages/Confirmation.tsx
test/browser/probe-sitecopy-b.mjs
test/browser/sitecopy-b.html
test/browser/sitecopy-b.tsx
```
**`src/pages/app/Onboarding.tsx`, `src/App.tsx` and all four `-A` files are absent.** I read
`Onboarding.tsx` and `App.tsx`; I edited neither.
⚠️ **`git diff --name-only origin/main` is now MISLEADING and I nearly reported it: `origin/main`
moved to `d6eb5691` mid-task (ORCH's CR-106/107 ledger entries), so that form also lists
`docs/reference/CHANGE-ORDER-LEDGER.md` — which is ORCH's newer content, not my change. Diff against
the merge-base.** `git diff --stat 0ae5855f d6eb5691 -- src/ test/` is **empty**: no code conflict.

---

## 3. THE REACH — what a person clicks

| String | The click path | Only way? |
|---|---|---|
| #1–#3 | public inquiry → `/checkout` → submit → **`/confirmation`** — `src/App.tsx:214` *(spec said `:216`)*. No auth | **Yes** |
| #4 | `/order/:id` → `OrderDetail.tsx:152` → `OrderPayment`. Gated on `status ∈ {draft, awaiting_payment}` (`OrderDetail.tsx:67`) | **Yes, today** |
| #4b | ⚠️ **NOTHING.** `Onboarding.tsx:2256` is behind `step === 'payment'` and no code sets it (`:649-653`). Kept under NOSTRIP for `TASK-REQCARDS` | **Unreachable, by design** |
| #5 | `/app/onboarding` → order step → *"Notify staff this isn't correct"* → *"Send this to staff"* → `ActivationOrderPanel.tsx:151`, mounted at `Onboarding.tsx:1453`. **First login only** | **Yes** |

## 3b. §2c's THREE QUESTIONS

**This task CAPTURES NOTHING.** No column, no jsonb key, no row, no email. All five strings are
*descriptions of* acts committed elsewhere, so questions 1 and 2 have no subject.
3. **What else does the outcome need that nobody asked for?** — **the five rendered `the barn` strings
   in §6b.** They are the same class of sentence as mine (FHE describing itself) and §5 forbids me
   from fixing them. **Presented here, before this is called done, rather than found afterwards.**

## 4. THE TELL, AND HOW IT IS UNDONE (D19)
**No D19 flags, stated explicitly rather than omitted.** Nothing here moves money, credits, documents
or state. **The tell is the rendered sentence. The undo is `git revert`.**

---

## 5. WHAT I DECIDED THAT THE SPEC DID NOT

1. 🔒 **`agree()` is NOT used on the activation sentence, and using it would have been a bug.**
   TRAP 2 says *"two verbs now vary independently (the count, and the property term if it is
   plural); `agree()` handles the second."* **There is no second verb.** In *"3 of us at the stables
   have been told"*, `at the stables` is a **prepositional phrase**; the subject is *"3 of us"*, and
   an English verb never agrees with the object of a preposition. `agree(propertyTerm,'has','have')`
   would render **"someone at the stables have been told"** — it compiles, it looks like the spec's
   instruction, and it is wrong for every plural tenant. ⚠️ **The spec's §8 TEST 5 is right; TRAP 2's
   explanation of the mechanism is not.** I built to the test.
2. **Subject and verb are chosen in ONE decision**, in a module-scope `toldSentence()`
   (`ActivationOrderPanel.tsx:52-68`) — one destructuring, so the two cannot drift. Not two ternaries
   (which is the special-casing TRAP 2 forbids), and **not a nested component** (TRAP 6, and the
   standing keystroke trap).
3. **`SendLine` was left alone.** It is already module-scope and takes finished sentences; the hook is
   hoisted into `Confirmation()` instead. **Reading the term inside `SendLine` would have put a hook
   in a component rendered from three prop positions for no gain.**
4. **The probe is a new harness entry, not an edit to `onboarding-flow.tsx`.** That file belongs to
   SIGNBOOK's lineage and `wt-3`/`wt-1` are live. **Two threads in one file is how last-push-wins
   happens.**
5. **I did not fake the `/app/onboarding` click path** (§2.4). The alternative was to report "rendered
   on both surfaces", which is the exact D17 failure this repo keeps paying for.

---

## 6. ⚠️ WHERE THE SPEC WAS WRONG

### 6a. 🔒 "Consumers today: ZERO" is FALSE, and was false when it was measured
The spec's §2 asks me to report a D17 finding that `TASK-FACILITYTERM` shipped a mechanism nothing
ever used, and calls this task *"its first consumer"*.

```
$ git grep -l "usePropertyTerm" 4297345a -- src/ | wc -l     # DSNR's OWN measured commit
17
$ grep -rl "usePropertyTerm" src/ | wc -l                    # main today
17
```
**Sixteen consumer files + the definition, unchanged since before DSNR measured:**
`PublicIntakeForm` · `HorseIntakeForm` · `AppOverviewModal` · `SessionFields` · `CreateModal` ·
`CommunityFeed` · `NotFound` · `HorsePage` · `Visit` · `Schedule` · `ContractPage` · `HorsesPage` ·
`Onboarding` · `AdminBrandingPage` · `LessonPackagesPage` · `SchedulePage`.
⚠️ **`ContractPage.tsx:1830` already renders `withArticleCapitalized(propertyTerm)` beside
`agree(propertyTerm,'has','have')`** — the exact idiom the spec says nobody has ever used.
🔒 **THERE IS NO D17 FINDING TO CARRY INTO THE REPORT. This is an ordinary adoption of a
well-adopted mechanism, which is a smaller and safer thing than the spec believed.** *(The likely
cause: the grep was run with a filter that excluded them. It was not re-run against reality.)*

### 6b. ⚠️ FIVE MORE **RENDERED** `the barn` STRINGS EXIST — §8.1 and §5 CONTRADICT EACH OTHER
§5 states every remaining `barn` outside the five is *"inside a code comment, not rendered. Verified
2026-09-01."* **It is not.** Five render, and all five are FHE describing itself:

| `file:line` | Rendered | Surface |
|---|---|---|
| `ops/barnops/ConsumptionLogPage.tsx:210` | `hint="Optional — attribution falls to the barn when blank."` | staff, `mod.barnops` |
| `ops/barnops/AllocationRulesPage.tsx:102` | `hint="'default' names the barn payer that absorbs uncovered remainders."` | staff, `mod.barnops` |
| `ops/barnops/AllocationRulesPage.tsx:413` | `emptyMessage="… add a 'default' rule for the barn payer."` | staff, `mod.barnops` |
| `ops/hubs/BarnopsHubPage.tsx:88` | `Inventory, consumption, and cost attribution for the barn.` | staff, `mod.barnops` |
| `ops/ContactsPage.tsx:607` | `placeholder="Left the barn, duplicate record, test identity…"` | staff, Records |

🔒 **I DID NOT FIX THEM, AND THE SPEC IS WHY:** §5 — *"Any other surface's facility wording. This is
four files. A general adoption sweep is a different task and is not authorised here."*
**So §8's test 1 (*"Zero rendered `the barn` outside the documented exclusion"*) is unpassable under
§5 of the same document.** ⚠️ **This is not mine to resolve — it needs DSNR, and it carries a real
product question the other four do not: the module is NAMED "Barn Ops" (`mod.barnops`,
`pageRegistry.ts:115` → `'Barn Ops & Inventory'`, `AppLayout.tsx:639` → `'Barn Ops'`).** Renaming the
copy without the module is half a job; renaming the module is a nav + registry + vocabulary change,
not a copy edit.

### 6c. Smaller premise drift (all verified, none blocking)
- `/confirmation` is `src/App.tsx:**214**`, not `:216`.
- `OrderPayment` is mounted at `Onboarding.tsx:**2256**`; the spec's `:29` is the **import**.
- Everything else in §2 verified exactly, including the two that mattered most: **`BrandProvider`
  wraps the whole route tree** (`App.tsx:149-150`) and **`usePropertyTerm()` cannot throw outside a
  provider** (`BrandProvider.tsx:139-141`, `?? DEFAULT_PROPERTY_TERM`) — TRAP 7 confirmed by reading
  it, not assumed.

---

## 7. FLAGGED, NOT FIXED — one line each
- **`src/App.tsx:509`** — `description="Configuration for how the barn runs."` **Excluded by spec §5:
  it is a prop in the router tree, so it cannot call a hook; the fix is `NavGroupCardsPage` deriving
  its own description. OPEN ITEM, as instructed.**
- **The five rendered strings in §6b** — need a DSNR call, and the `mod.barnops` module name with them.
- **`Onboarding.tsx:106-108` and `:621` are STALE**: they claim the payment step is *"identical on the
  provisioned one"* and *"the provisioned door still ends at payment"*, contradicting `:649-653` and
  the code. Not my file.
- **`BrandProvider.tsx:141`'s comment** says `usePropertyTerm` falls back to *"the neutral FACILITY
  default"*; it actually falls back to `DEFAULT_PROPERTY_TERM`, which is **RANCH**. Not my file (spec §5).

---

## 8. THE OWNER'S RENDER CHECKLIST — **on the phone**
⚠️ **The probe proves composition and reach in Chromium. It cannot prove your real tenant row, RLS, or
how it looks on your device.** Six items:
1. **`/confirmation`** — submit any inquiry from the public site. The Emails block must read
   **"Your inquiry has been emailed to the ranch."** ⚠️ Not "the barn".
2. **Same screen, the pending flicker** — on a slow connection the line reads **"Sending your inquiry
   to the ranch…"** before it settles. If you catch it, the noun must not change as it settles.
3. **`/order/:id`** — open any unpaid order. The Payment paragraph reads **"… or cash at the ranch."**
   with both long dashes intact.
4. **First-login activation** — on a test account with an order, tap **"Notify staff this isn't
   correct"** → **"Send this to staff"**. It must read **"someone at the ranch has been told"** (one
   recipient) or **"N of us at the ranch have been told"**. ⚠️ **"has" with a number above one is the
   bug this task fixed — if you see it, say so.**
5. **Settings nav card** still reads *"Configuration for how the barn runs."* — **expected**, it is
   the documented exclusion (§7).
6. **Ops → Barn Ops** still says *"the barn"* in four places — **expected**, §6b. **Tell ORCH whether
   you want that word changed, and whether the module keeps the name "Barn Ops".**

---

## 9. TEARDOWN
See the ledger's final entry for the census.

## 10. COMMITS ON `task/sitecopy-b`
```
fb5c4072  ledger: SITECOPY-B opens, wt-2 claimed at 0ae5855f
5875ead5  the app uses the tenant's own word for its property, not 'the barn'
<ledger>  ledger: CLNR clean, spec's zero-consumers premise falsified
4f01c7c6  probe: the five sentences rendered in Chromium, singular AND plural
<lint>    probe harness: silence the react-refresh warning (lint back to 45)
```
**NOT PUSHED. ORCH merges.**
