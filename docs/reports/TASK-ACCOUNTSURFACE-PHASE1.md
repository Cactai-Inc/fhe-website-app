# TASK-ACCOUNTSURFACE — Phase 1 report (assessment only, no code)

Worktree: `/Users/Cactai/Desktop/fhe-worktree-accountsurface`, branch `task/accountsurface`,
off `origin/main` at `b8b078a`. PLUSPASS confirmed merged into main (`80849b0` is an
ancestor of `b8b078a`) — its "+ Horse" control is already live in `AccountHub.tsx`'s
inline `StableSection` (`AccountHub.tsx:106`). Everything below is built on that.

Every claim below is something I read directly in this worktree. Where I infer behavior
rather than having traced it end-to-end (e.g. RLS/RPC internals), I say so.

---

## 1. §3 — the duplication assessment

### 1a. Current state of the six subjects

| Subject | Nav page | Account panel | Relationship |
|---|---|---|---|
| **Documents** | `Documents.tsx`, 288 lines | `DocumentsPanel` in `AccountPanels.tsx`, ~126 lines (58 lines of `DocumentsPanel` + the 68-line `PaperViewer` it alone uses) | **Diverged.** Confirmed: `Documents.tsx` imports nothing from `AccountPanels.tsx`, and nothing in `AccountPanels.tsx` is imported by `Documents.tsx` — zero shared code. |
| **My Stable** | *(none yet — this task adds it)* | `StableSection`, inline in `AccountHub.tsx`, 118 lines (64–181) | **Single implementation.** Only the panel exists today. |
| **My Posts** | `MyPosts.tsx`, 208 lines | *(none)* | Single implementation (page only). |
| **My Lessons** | `MyLessons.tsx`, 268 lines | *(none)* | Single implementation (page only). |
| **Orders** | `Orders.tsx`, 147 lines | *(none)* | Single implementation (page only). |
| **Gifts** | `Gifts.tsx`, 190 lines | *(none)* | Single implementation (page only). |

Only **Documents** is an actual pair of implementations today. The other four rows that
need to gain panels start from a single source of truth — there's nothing to reconcile,
only to extract.

### 1b. How far apart the Documents pair actually is

Not cosmetically apart — **functionally** apart. `DocumentsPanel` is missing capability
that `Documents.tsx` has:

- **No signing.** `Documents.tsx` renders `SelfSignRow`: a typed-legal-name e-sign flow
  wired to `signMyDocument()`, plus a deep link to `/app/contracts/:id` for
  contract-workflow documents. `DocumentsPanel` has no sign path at all — it is
  read/view-only (`PaperViewer`, a pagination viewer with a PDF-download button).
- **No "email me a copy."** `Documents.tsx` has `EmailMeACopyButton`
  (send/resend via `emailMyDocumentCopy()`, label driven by
  `executed_email_sent_at`). Not present in the panel.
- **No pending/assigned visibility.** `Documents.tsx` calls **two** sources —
  `myDocuments()` (the `my_documents` RPC, which returns `'pending' | 'assigned' |
  'executed'` rows, including documents assigned but **not yet generated**, shown as
  "Awaiting your signature — you'll be prompted at sign-in") **and**
  `listMySignableDocuments()`. `DocumentsPanel` calls only the latter. A member with an
  assigned-but-ungenerated document sees it on `/app/documents` and sees **nothing** for
  it on the Account page today.
- **No supersede history.** `Documents.tsx` shows a "Superseded — kept as a record…"
  badge; the panel has no concept of it.

This is a real pre-existing gap, independent of this task: a member who only ever opens
the Account page cannot sign anything and cannot see documents awaiting generation. It
predates this task and isn't something Phase 2 introduces — the rule change just forces
someone to look at it, because the fix is the same shape as the rule's fix (one component
instead of two).

### 1c. Is "one shared component per subject" the right shape?

**Yes, but the four single-implementation subjects and the one diverged pair cost
differently — do not treat them as the same size of work.**

**My Stable, My Posts, Orders, Gifts — natural, mechanical, low-to-moderate cost.**
Each nav page is already self-contained: its own hooks, its own local state, its own
modals (`ManagePaymentModal` in Orders, `GiftDetail` in Gifts, inline `PostRow` editing
in My Posts). None of them reach into route params beyond what a plain component
prop/hook already provides. The only page-specific matter is the **header furniture**,
and it isn't even consistent between the four today:
  - `MyPosts.tsx` hand-rolls an explicit "← Account" back button plus a header row that
    also hosts its `PageCreateButton`.
  - `Orders.tsx`, `Gifts.tsx`, `MyLessons.tsx` use a plainer `eyebrow` + `heading-section`
    pair, no back button, no create button (correctly — PLUSPASS never gave Orders/Gifts
    a create control, since neither is user-creatable).
  - There is **no shared `PageHeader` component** anywhere in the codebase — every page
    hand-rolls its own `eyebrow`/`h1` markup. "The app's page header model" is a styling
    convention (gold eyebrow class + serif heading + optional description), not an
    existing component to reuse.

  The extraction is: pull each page's body (minus its header/back-button) into a
  `<XxxContent />`, have the route wrap it in a page header, have the Account panel
  render it bare inside the existing `lg:col-span-2` slot. All four already sit under the
  same `<AppLayout>` route tree as `AccountHub` (confirmed in `App.tsx`), so context
  providers they depend on — e.g. My Posts' `useCreateModalTrigger()` /
  `CreateModalTriggerContext`, wired by PLUSPASS — are already in scope for both surfaces.
  No provider-boundary problem.

**Documents — the same target shape, but this is a reconciliation, not an extraction.**
Getting to one component means picking `Documents.tsx`'s capability set as the baseline
(it's the superset) and building the panel-friendly presentation on top of it — not
"move code," but genuinely closing a functionality gap while also making it render
acceptably inside an accordion row. This is real design/dev work and should be sized as
such, separately from the other three.

**Is it ever forced/wrong?** No — I found no subject where a shared component would be
contorted to fit both surfaces. The nearest thing to a counter-argument is Documents'
`isContractDoc` branch, which **deliberately bounces out** to `/app/contracts/:id` rather
than handling contract-workflow signing inline. That's not evidence against the shared
component; it's the existing page's own precedent for "expand in place, but hand off the
one genuinely heavy sub-flow to its own surface" — the same technique this task can lean
on for My Lessons if needed (see §3 below).

### 1d. What the Account page weighs once four more panels expand into it

Less than it looks. `AccountHub.tsx` uses a **single-value** `Section` type
(`'profile' | 'stable' | 'saved' | 'documents' | null`, `AccountHub.tsx:31`) and a
`toggle()` that closes whichever panel is open before opening another
(`AccountHub.tsx:195`). This is a strict accordion — **only one panel is ever mounted at
a time.** Adding `'posts' | 'lessons' | 'orders' | 'gifts'` to that union is a small,
low-risk change; it does not turn into four more panels' worth of simultaneous network
calls or DOM weight. The real question is not "how heavy is the hub" but "how heavy is
the single heaviest panel when it's the one open" — which is §1e / item 3 below.

One existing precedent worth citing directly: `StableSection`'s "+ Horse" already opens
`HorseIntakeForm` — a **1,000-line** shared form component — as an overlay modal
triggered straight from the open accordion row. The account page already tolerates
significant nested interactive complexity hanging off an open panel today; that this
form is a modal-overlay rather than literally inline doesn't change that the surface
already exists in production carrying real weight.

**Recommendation:** one shared content component per subject, rendered bare by the
Account panel and wrapped in a page header by the route, for all five rows. Cost is low
for My Stable/My Posts/Orders/Gifts (extraction), materially higher for Documents
(reconciliation of a real capability gap). Not forced anywhere.

---

## 2. The Profile-label question — presented, not decided

> Does "Profile & preferences" become "My Profile & Preferences", or is it exempt as the
> account's own primary row?

Both readings are defensible from what's in the code today:

- **For "exempt":** every other row names a *category of content* the account holder
  owns (posts, lessons, documents, stable, orders, gifts) — things that could
  plausibly also exist at a company/app level, which is exactly the collision §4 is
  guarding against. "Profile & preferences" is different in kind: it's the row *for the
  account itself*, not a collection of the account's stuff. There's no company-level or
  app-level "Profile" to collide with — it's already unambiguous. Prefixing it "My" would
  make it the only row where "My" reads as redundant rather than disambiguating
  ("my profile" vs. whose else's?).
- **For "My Profile & Preferences":** consistency. The rule as stated is "personal
  content is prefixed My throughout" — no carve-out is written into it. If a future
  reader has to remember one exception to a rule meant to prevent exactly this kind of
  ad hoc inconsistency, that's friction the rule was supposed to remove. And the owner's
  own worry ("app settings vs account settings") suggests "Preferences" alone is exactly
  the kind of word that could collide with a future app-level settings surface — the
  "My" prefix would inoculate it the same way it does the others.

I'm not picking one — flagging it back per the task's own instruction ("Ask; do not
decide").

---

## 3. Is MyLessons or Documents too heavy to expand inline?

**My evidence-based read: no, neither is disqualifying, but both need a specific design
decision made in Phase 2, not assumed.**

**MyLessons.tsx (268 lines)** is the heaviest of the four single-implementation
subjects: it's gated by `ModuleGate('mod.lessons')`, fires **three** independent network
calls on mount (`myLessonsOverview`, `myLessonSessions`, `myLessonReports`), and nests
further interactive components per item — `SessionNotesView` per upcoming session, and
`ReportCard` with its own note-composing mutation (`addMyLessonNote`) per report — plus
a "buy more" catalog upsell block at the bottom. This is the one subject where "expand in
place" has a real, non-cosmetic cost: opening this row means three round trips and a
noticeably taller panel than My Stable's today.

It is not architecturally blocked, though — nothing in it depends on being a full page
(no route params beyond none, no full-viewport assumptions in its markup). The Account
page's accordion (§1d) means it's never competing with another open panel for the same
screen. And I found a **pre-existing gap** while reading it: the Account page's "My
lessons" row (`AccountHub.tsx:211`) has **no `lessonsOn` gate at all** — it always
renders, unlike the nav rail's own `{lessonsOn && <RailLink .../>}` (`AppLayout.tsx:498`).
On a tenant with the lessons module off, the Account row currently promises a
destination that just shows the module's lock screen. Since this task is touching this
exact row to make it expand instead of navigate, whoever builds Phase 2 should decide
whether the expanded panel likewise gates on `lessonsOn` (my inclination, for parity with
the nav) — flagging it here since it's adjacent, not fixing it.

**Documents (288 lines on the page side)** is heavy for a different reason: expanding it
in place means finishing the reconciliation in §1b, which nets *more* UI inline than
exists there today (a real sign form, an email-copy button, a supersede badge) — not
because expanding is architecturally wrong, but because closing the capability gap is
inherently more UI than what `DocumentsPanel` ships now. The existing `isContractDoc`
branch's deep-link-out for contract-workflow signing (rather than handling that specific
sub-flow inline) is a directly applicable precedent if the reconciled component turns out
too tall for a panel row — it already draws that exact line today, on the page.

**Bottom line:** I would not block either on "too heavy." I'd flag both as needing one
explicit Phase 2 design call each (MyLessons: gate on `lessonsOn`, and consider whether
`SessionNotesView`/`ReportCard` need any inline-specific trimming; Documents: confirm the
reconciled component's rendered height in a panel row is acceptable, using the existing
deep-link-out technique if not) — rather than silently deciding it during the build.

---

## 4. Things that make the rule awkward — flagged now

- **The nav rail's own labels aren't internally consistent yet**, independent of this
  task's four-row fix:
  - The avatar-menu quick-access list (`PRESENCE_LINKS`, `AppLayout.tsx:137-143`) labels
    the Stable link **"Stable"**. The canonical rail/mobile-drawer list
    (`ClientNavItems`, `AppLayout.tsx:505`) hardcodes the same destination as
    **"My Stable"**. Two different labels for one destination, in two different nav
    surfaces, today — before this task touches anything.
  - The canonical rail labels the lessons destination **"Lessons"**
    (`AppLayout.tsx:498`, `<RailLink to="/app/lessons" label="Lessons" .../>`), with no
    "My" prefix — sitting in the same list as "My Posts" and "My Stable", which do have
    it. This is precisely the ambiguity the owner is worried about in the §4 preamble:
    there is a **separate, public, top-level `/lessons` route** (`App.tsx:149`, the
    marketing lessons-program page) distinct from the member's personal `/app/lessons`
    (credits/schedule). The in-app rail calling the personal one just "Lessons" is the
    exact collision pattern the "My" rule exists to prevent, and it isn't listed in the
    task's own label table. I'd fold "My Lessons" into the nav-rail relabeling while §4
    is being done, since it's the same mechanical change and leaving it out means the
    rail and the Account row still won't agree after Phase 2 (the row is being renamed to
    "My Lessons" per the task table; the rail item feeding the same destination would
    still say "Lessons").
  - Document title (`useDocumentTitle('My Lessons')`) and the page's own on-screen eyebrow
    (`<p className="eyebrow mb-2">My lessons</p>`, lowercase) already disagree in casing
    with each other too — another small pre-existing inconsistency the relabel pass
    would sweep up for free.
- **Orders' own list item navigates further**, to `/order/:id` (outside `/app`,
  `Orders.tsx:49`) — a per-order detail page. That's a drill-down *within* the Orders
  subject, not a second top-level surface, so I don't think it's in scope for this rule
  (the rule is about nav-vs-account, not about a page's own internal navigation), but
  it means "Orders expands in place" doesn't make the whole subject click-free — noting
  it so it isn't discovered as a surprise in Phase 2 review.
- **`/app/account?section=stable` link count:** exactly two call sites point at it today
  (`AppLayout.tsx:140` in `PRESENCE_LINKS`, `AppLayout.tsx:505` in `ClientNavItems`),
  confirming the task's own count. (The task doc cites `:139`/`:504` — a one-line drift
  from small unrelated edits since the doc was written; same two call sites, no third
  found anywhere else in the file.)
- **Nothing about the rule itself seems unworkable.** The only structural risk is
  Documents' capability gap (§1b) — not the nav/account split.

---

## What I verified directly vs. assumed

**Verified by reading the file:** every line count and code claim above (`AccountHub.tsx`,
`AccountPanels.tsx`, `Documents.tsx`, `MyPosts.tsx`, `MyLessons.tsx`, `Orders.tsx`,
`Gifts.tsx`, `AppLayout.tsx`'s nav tables and both `/app/account?section=stable` call
sites, `App.tsx`'s route table showing no `/app/stable` route exists yet, PLUSPASS's
commit diff, `HorseIntakeForm`'s microchip field and its five existing call sites,
`my_documents`/`myNavPresence` types in `lib/api.ts`).

**Assumed, not traced end-to-end:** the actual runtime behavior of `my_documents` /
`listMySignableDocuments` RPCs server-side (I read the client-side types/usage, not the
SQL) — the capability-gap claim in §1b rests on what the two client functions' return
shapes and consumers do, which is strong evidence but not a live database check. Also
assumed: that extracting My Stable/My Posts/Orders/Gifts costs what I estimate — I read
each file fully but haven't attempted the extraction, so "mechanical" is a read-time
judgment, not a rehearsed one.

---

**Stopping here per Phase 1 scope. No code changed.**
