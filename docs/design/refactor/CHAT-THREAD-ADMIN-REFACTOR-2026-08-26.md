# CHAT-THREAD-ADMIN-REFACTOR-2026-08-26 — planning-thread relay to ORCH4

From the planning thread, sessions 2026-08-24 through 08-26. This answers your four asks, rules
or routes your four blockers, and carries the owner rulings produced here since the refactor
bundle was written. It travels with ADMIN-IA-REVISION.md, which belongs in docs/design/refactor/
beside the four docs it revises. You asked for full transcript over summary; the transcript is
enormous and mostly site copy and compliance, so this is the middle form — rulings carried
faithfully, with the owner's own correction quoted where the correction is the ruling. If you
want the raw transcript anyway, the owner can export it to a Doc.

## Rulings from these sessions, not yet D-rules

Owner-ruled unless marked otherwise. Dedupe against CLAUDE.md yourself; some of the later items
may already be D-rules from prior threads.

1. The nav menu stays. Horses, Documents, Deals, Money, Boarding, Barn Ops, Employees remain
   their own pages, unchanged from ADMIN-IA.md §5 — that list is the menu. Dashboard,
   Calendar+People, and Community sit outside it with their own dedicated access. Owner's words:
   "She still needs those pages, they are the nav menu, the other three surfaces get a novel way
   to access them. That's the split." The access mechanism is deliberately undesigned — see
   blockers.
2. Dashboard is the sorted front door, not a competing stop. Every row deep-links into the
   calendar item or person record it concerns.
3. Calendar and People are one page — calendar as a dedicated view on top, the people list below
   it in the same scroll. Not two rail rows, not two tabs.
4. Hard split: the calendar side owns doing the lesson (today's plan, mark done, write up
   after); the person side owns managing the relationship (scheduled items, payment status,
   documents, history). Each links to the other; neither duplicates the other's fields. A
   create-booking button on the person page that hands off into the calendar's own create flow
   is explicitly allowed — same cross-link mechanism, other direction.
5. No standalone Lessons surface. Lesson plans and notes are their own page, opened from the
   calendar for the day's lessons or from a rider's person page for that rider's history. The
   Sessions/Plans tabs from ADMIN-IA.md §5's Lessons consolidation retire. Credits and Packages
   placement was not discussed and is open.
6. Calendar item title: person's name only on mobile; name plus type on larger views ("Melissa"
   / "Melissa — Riding Lesson"). Inside the opened item the name is a link to the person page.
7. Both the booking item and the lesson-content page open as full-size modals on mobile and
   desktop — never side panels. Owner rationale, carried because it generalizes: the panel is
   cramped even on desktop and forces the person to leave the center of the page where they
   already are when they picked the time slot.
8. Lock behavior on saved booking fields (title, assigned person) is deliberately unresolved.
   Owner pulled it from the spec pending a real answer on what "saved" triggers the lock. Do not
   spec it, do not build it, do not infer it.
9. Community authoring gains a review state between draft and published. The owner's correction
   is the ruling, quoted because my first pass flattened it: "The discussion I proposed was
   supposed to be opening the door to the review surface needed if we're collaborating rather
   than authoring and saving as draft or publishing, it's the middle ground that hasn't been
   mentioned until I brought it up." content_posts carries draft / review / published; review is
   for the case where the person preparing a piece is not the one who publishes it. No AI
   anywhere in the tool — AI-assisted content is prepared externally and pasted in manually.
   ADMIN-IA.md §4's "No AI anywhere in this path" stands.
10. Moderation stays a separate surface, outside Claire's daily Community view. Owner has it on
    his side; adding it to her view is a later call.
11. The D19 bar, ruled — closes OWNER-DECISIONS-PENDING-2026-08-20 §1. Tiered is concurred,
    but the tier is set per action by reversibility, not by category, and all four flags is
    never the default. Confirmation and reversibility are substitutes: an action whose effects
    can all be undone ships with undo and no confirmation — marking an order paid that can be
    unmarked just happens. The warning belongs to the irreversible side effect, not to the
    action: an email cannot be unsent, so an action that fires one warns of that specific
    impact; a dashboard notification can be removed, so if undoing the action removes it too,
    no warning — undo cascades to removable side effects, which is what makes them removable.
    Engineered control beats confirmation: a contract link that can be deactivated after
    sending removes the need to ask before sending. Upstream gating beats downstream alerts:
    where an incorrect action can be made unavailable by gating it against the upstream state
    that would make it wrong, gate it instead of warning about it. Ledger writes are logs, not
    value-moving actions — the four write-only ledgers take no D19 flags themselves; the
    read-back corollary stands on its own. Owner's close, carried whole: there is no blanket
    approach; each value-moving action is scored case by case in its wave spec.
12. Standing member-facing and platform rulings to dedupe against CLAUDE.md: FHE is
    jumper-only, never hunter or hunter/jumper; FHE is a program operating out of Carmel Creek
    Ranch, not a barn; the brand tagline and Landing hero h1 are owner-confirmed and never
    touched; members never see the word "Client"; identity is three platform roles with
    sub-designations computed from facts at read time, gating inside actions rather than
    pre-shaped account states; two visual registers, unboxed for inhabited surfaces and
    contained for operated ones, declared per surface and never mixed on a page.

## Your four asks

Rulings: above.

Globalization: no spec exists in this thread. The 885-arbitrary-values note has nothing newer
behind it. Proposed disposition: standard-setting folds into the design lane's first artifact
(it has to pick tokens and primitives to spec pages against anyway — that output is the
standard), and application across the app sequences after flow integrity, per your v1-signal
ordering, which the owner's stop-gap framing endorses.

Admin final shape: ADMIN-IA-REVISION.md supersedes ADMIN-IA.md §1's zone-model framing for
Claire's surface and the §5 Lessons disposition. It is display-level — what Claire sees and
where — and is compatible with the inverted obligation model; it says nothing about how
documents become required. The stale surface is ADMIN-IA.md §5's People/Documents dispositions,
per your read. Your re-grounding proceeds with the revision as input. Your correction discipline
also applies to the bundle's own claims — the Admin.tsx / OwnerDashboard.tsx errors ORCH3 found
were mine, and §7's verify-don't-inherit rule was written for exactly that reason; apply it to
the documents that state it.

Account shapes: this thread does not hold TASK-HOMESHAPES's other half. Nearest sources: the
rulings in item 11 above, and docs/design/DASHBOARDS-GROUND-UP-PLAN.md, which you list as
unread. Reconciliation guidance rather than a document-level answer, since I have not read
HOMESHAPES either: there is one composable zone framework with two consumers, the admin
dashboard and the member home — reconcile the two documents under that frame rather than
letting either claim the framework as its own. Which member shapes get built inside the
stop-gap is scoped by the v1-signal test, not by either document's ambitions.

## The four blockers

Mobile nav: structurally ruled by items 1–3. What remains is mechanism only — persistent
buttons, a tab bar, something else — and that is the design lane's first artifact, reconciling
ADMIN-IA.md §2's chrome (brand-mark-to-dashboard, avatar menu, single create FAB) as prior art,
not gospel.

Primitive kit: confirmed, with an authorship amendment — the first design artifact (primitive
set, mobile-nav mechanism, visual register) is authored in the planning thread by owner
direction, not allocated out; you consume it and attach build handoffs as planned. Wave zero
builds exactly the set it defines; the kit grows per wave; nothing speculative. Visual
direction rides with it, from the owner: honor the brand but deviate comfortably from the
current build's register — today's app reads dark, heavy, and drab; the baseline is
lightweight, mobile-first minimalism, judged impartially to the current build's choices. It
arrives as something the owner can see, not text alone.

D19: ruled — ruling 11 above sets the bar and closes OWNER-DECISIONS-PENDING-2026-08-20 §1.
Update CLAUDE.md's D19 entry with the application standard so nothing still reads as awaiting
sign-off.

Obligation re-grounding: yours, as you proposed. ADMIN-IA-REVISION.md is an input to it, not a
casualty of it.

## Lanes and handoff protocol

Two lanes, endorsed here and reflected in the owner's instruction: design and architecture as
one artifact per wave on Fable; authoring as one vertical-slice thread per wave, DB, code, and
reach together, model chosen per wave and stated in one line in the wave spec. The first design
artifact is authored in the planning thread (see blockers); per-wave design artifacts after it
run in your allocation as proposed. Your caveat
carries: the Fable lane gets goal-and-constraints prompts, the build lane gets prescriptive
specs with traps enumerated — never template one from the other.

At each design-to-build handoff, you attach the wave's verification list and the standing traps
below; the planning thread reviews the wave-one design brief before the first build handoff,
then per-wave review only where a wave touches an owner-ruled surface. Owner relay remains the
only authority path; the build thread does not re-litigate anything in this document.

## Standing traps for every build handoff

- Zero-row UPDATE reported as success is a systemic defect in this codebase, not a per-surface
  quirk. Every write is verified by read-back in the flow that made it.
- Any input writing to a vocabulary-backed column is a bound selection menu writing codes —
  never display labels, never free text.
- The document editor renders active clauses only, exactly what a merged document would show —
  no meta-annotations on the document surface.
- admin@cactai.io is platform-tier and invisible inside FHE's tenant surface; checked at every
  verification pass.
- Member-facing wording: never "Client"; D25 governs offering wording.
- Handoff claims are verified, not inherited — your line-135 finding is the model. Reach is
  proven by click, not by typecheck and not by psql.

## Sequencing guidance, not wave specs

Wave specs are yours after re-grounding. From here: flow integrity before globalization,
endorsed; the three-door shell early, since everything else mounts into it; the community
review state lands before any authoring workflow starts, and the feed deferral is endorsed.
TASK-ONERAIL (docs/tasks/) runs before or parallel to your re-grounding — it settles the
line-135 question and verifies the three entry paths converge on one first-login rail; its
traces are input to the People/Documents re-spec.
The public-site lane is independent of all of this and runs as its own vertical slices:
TASK-SITECOPY and TASK-LANDINGSIGNIN you have staged; TASK-POLICIESANDFAQ and
COMPLIANCE-FINDINGS exist in this thread's outputs, not yet staged, and POLICIESANDFAQ carries
two pending owner calls inside it (policy-section keep-vs-cut, Business Profile URL).

## What comes back to the planning thread

Confirmation of which rulings above you absorbed into CLAUDE.md as D-rules and their numbers;
the re-grounded refactor doc list once your pass completes; the wave-one design brief before
build handoff. Everything else runs in your lanes.
