# PROGRESSION-PLAN — lesson plans without authoring, progress without prose

For Claire's review before implementation. Nothing here requires AI: the curriculum is data,
plan composition is selection from it, progress is status marking, milestones are flags on
marker skills. It is deliberately built so the rebuild can port it whole (curriculum tables and
progress records are model-independent). Owner-editable per D13/D21 — the curriculum ships with
an editor (Field-options idiom), so Claire can rename, reorder, add, and retire skills without
a developer.

## 1. The model

- SKILL: the atomic teachable unit. Fields: name, category, level, description (one line, in
  Claire's words), prerequisites (other skills), milestone flag.
- CATEGORY: flatwork, jumping, horsemanship (ground/care/tack), and seat & position.
- LEVEL: Foundation, Developing, Intermediate, Advanced (display bands, not gates — the
  prerequisite graph is what actually orders learning).
- RIDER PROGRESS: per rider per skill, one status — introduced → developing → proficient —
  with the session it changed in and who marked it. Append-only history, current state
  derivable.
- FRONTIER: computed, never stored — the skills whose prerequisites are all proficient and
  which aren't yet proficient themselves. This is "what this rider works on next."
- MILESTONE: a skill flagged as one. Reaching proficient on it is the celebration moment and
  the progress-report headline. No separate milestone machinery. **See §5 for the major
  milestones the owner named directly — these are the ones that actually matter, distinct from
  the finer-grained milestone flags scattered through the draft curriculum in §2.**
- LESSON PLAN: rider(s) + a small set of skills (defaults proposed from each rider's frontier,
  trainer adjusts) + optional free note. Composed in seconds, never written from scratch.
  **Substantially expanded 2026-08-24 — see §4a. This is now a full-page surface with
  bidirectional pre-lesson notes, not a lightweight composer.**
- SESSION WRITE-UP: the existing completion flow gains skill chips — tap to mark
  introduced/developing/proficient for what was actually worked. The write-up feeds progress;
  progress feeds the next plan's proposal. The loop closes without prose. **Owner, 2026-08-24:
  this is the "activity report" — a full page or full-size modal, kept structurally SEPARATE
  from the calendar item's own booking/edit surface. See ADMIN-PAGE-SPECS.md's Calendar section
  for the full reasoning; don't fold this back into a tab on the booking panel.**

## 2. Draft curriculum (for Claire to correct — this is a starting map, not the truth)

Foundation
- Horsemanship: leading and tying; grooming routine; hoof picking; haltering; tacking up
  (MILESTONE: tacks up unassisted); mounting and dismounting; arena etiquette and safety.
- Seat & position: balanced seat at halt and walk; correct rein hold; eyes up, heels down.
- Flatwork: walk-halt transitions; steering at walk (circles, changes of direction); posting
  trot mechanics (MILESTONE: maintains posting trot); correct diagonals
  (MILESTONE: recognizes and corrects diagonals unprompted).

Developing
- Seat & position: two-point at walk and trot; independent hands; riding without stirrups at
  walk/trot.
- Flatwork: sitting trot; trot-halt and trot-walk transitions; 20 m circles and serpentines;
  canter departure and seat (MILESTONE: first intentional canter); correct leads
  (MILESTONE: identifies and corrects leads); halts square.
- Jumping: ground poles at walk/trot; trot poles with rhythm; first crossrail
  (MILESTONE: first fence); two-point over poles.

Intermediate
- Flatwork: canter circles both leads; simple changes through trot; lengthen and shorten
  stride at trot; leg-yield basics; counter-bend and bend control.
- Jumping: crossrail courses with lines (MILESTONE: first course); verticals; related
  distances and striding; small oxers; gymnastic grids.
- Horsemanship: bandaging/boots; basic lameness awareness; warm-up and cool-down ownership.

Advanced
- Flatwork: collection and extension at trot and canter; flying changes
  (MILESTONE: first flying change); counter-canter.
- Jumping: coursework at height with striding decisions; equitation position over fences;
  related lines off both leads; first show round (MILESTONE, if showing is in scope).

## 3. What it powers immediately

The Plans tab proposes a plan per rider from the frontier. The Notes loop zone shows sessions
missing write-ups AND riders whose proficiency hasn't moved in N sessions. Milestones surface
on the dashboard and are the natural community-feed celebration post (published with consent —
manual for now; the rebuild's generative layer can draft the words later, which is exactly the
AI seam left open, not built).

## 4a. The Lesson Plan surface (owner, 2026-08-24 — full spec)

> "the lesson plan is a full page of it for selecting what will be the focus, adding notes for
> before the lesson so the rider can read them, and the rider has space to write notes too for
> claire to read ahead of a lesson."

A full page, reachable from a calendar item once created (not a field inside the booking panel).
Three parts:
1. **Focus** — skills proposed from the rider's frontier (§1), Claire adjusts/confirms.
2. **Claire's pre-lesson note** — visible to the rider ahead of time.
3. **Rider's pre-lesson note** — a space the rider writes in, Claire reads before the lesson
   starts. This direction (rider → Claire) did not exist in the original draft of this document
   and is a real addition, not an implementation detail — build it as a first-class field, not an
   afterthought on the notes UI.

## 4b. The Session Write-Up / Activity Report (owner, 2026-08-24 — confirmed as its own surface)

Post-lesson, Claire records what was actually done, adds notes, and marks skills
introduced/developing/proficient via the chip mechanic in §1. **Kept as a separate full
page/full-size-modal surface from the calendar's booking/edit UI** — see
ADMIN-PAGE-SPECS.md's Calendar section for why (two distinct concerns: scheduling the thing vs.
recording what happened at it, never combined into one panel).

## 5. The major milestones (owner, 2026-08-24 — this replaces the draft milestone list in §2 as
## the ones that actually matter; §2's finer-grained MILESTONE flags stay as supporting detail)

> "she can mark things as proficient so the rider metriculates through the program and we can
> generate milestones when the rider is proficient in something and when they unlock things, the
> major unlocks are walk (off lead), trot, canter, jumping, riding with a group. walk, trot,
> canter, jump are sequential, group riding is its own milestone that happens when claire feels
> they are ready and she invites them to join a group riding lesson."

Five major milestones, not the same shape:

1. **Walk (off lead)**
2. **Trot**
3. **Canter**
4. **Jumping**

These four are **sequential** — each is a real gate on the next, computed the same way §1's
FRONTIER already works (proficiency-driven, not manually toggled).

5. **Group riding** — **not** part of the sequential chain and **not** frontier-computed. This
   milestone is reached only when **Claire judges readiness and actively invites the rider into
   a group riding lesson.** It needs its own mechanism distinct from the other four: a human
   decision + an invitation action, not a proficiency threshold crossing on its own. Do not model
   it as a skill with prerequisites that happens to unlock automatically — it is structurally
   different, and treating it as data-driven like the other four would misrepresent what actually
   triggers it.

**Implementation note, not yet owner-confirmed:** whether these five map onto existing §2 skill
rows (e.g., is "Walk (off lead)" the same node as "balanced seat at halt and walk," or a new
top-level milestone node with its own criteria) is unresolved — check with Claire during her
curriculum review (§6) rather than assuming a mapping.

## 6. Claire's review checklist

Correct the skill list and names into her vocabulary; confirm the prerequisite order matches
how she actually teaches; flag anything taught concurrently rather than sequentially (the graph
allows parallel branches); pick the milestone set she'd celebrate publicly (**start from §5's
five major milestones, named directly by the owner — the §2 draft list is secondary detail, not
the headline set**); decide whether horse-side training progression (a parallel curriculum for
horses in training) ships in v1 or waits — the model supports it unchanged, the seed content
above is rider-only; confirm how §5's five milestones map onto the §2 skill graph.
