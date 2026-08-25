# THE METHOD — how a change order goes from a sentence to shipped code

**Owner, 2026-08-25.** Written down because the missing step is the one that keeps costing us.

> *"we need to talk through everything first, then review the list of changes (the change order
> list) and as we review the requests we discuss questions and iron out details or ambiguities, but
> there is one step that isnt accounted for yet and its the one that keeps biting us in the ass …
> that is the fact finding step."*

---

## THE FOUR PHASES

### 1. CAPTURE
Record the request **verbatim**. The owner's own words are the requirement; a paraphrase is already
an interpretation. Nothing is assessed, argued with, or scoped yet.

⚠️ **STAY QUIET WHILE CAPTURING (owner, 2026-08-25).**
> *"while we are in this change request collection step it doesnt help me to see the things you are
> responding with. if there is a real reason for you to respond its because you want to provoke me
> to do something alongside what ive just sent you."*

Reporting what was found, built or verified belongs in **REVIEW** and **IMPLEMENT**, not here — it
interrupts the owner mid-thought and makes him read a status update he did not ask for. During
capture there is exactly **one** reason to speak: **a question that widens the capture while he is
already thinking about that area.** Two shapes of it, in his words:

- **"Are there other items on that modal that need the same function?"** — he asks for one control;
  ask whether its siblings need it, and collect them all in one pass instead of six.
- **"Let's evaluate if we should be using a modal at all here."** — he describes a preference;
  ask whether the underlying choice is the thing to settle.

Everything else waits. **Silence is the correct output for a captured request that raises no
widening question.**

### ⚠️⚠️ WIDENING vs CLARIFYING — the distinction I got wrong (owner, 2026-08-25)

> *"you are breaking the rules with these questions and ill tell you why … these dont pertain to
> digging deeper into the ui or considering the impact on other surfaces im currently looking at,
> these are clarifying questions, they take me down the rabbit hole in the wrong way, they ruin my
> focus and my flow state so now im not thinking about finding problems and coming up with
> solutions, im articulating specs and details, its hard to climb back out of this mental space to
> the leve above it where im scanning for issues to resolve and chaining together the solutions so
> they deliver unification and standardization."*

**The test is not "is this a good question." It is WHICH ALTITUDE the question puts him at.**

| | Asks him to | Effect |
|---|---|---|
| ✅ **WIDENING** | look **across** — other surfaces, sibling controls, whether the pattern repeats | keeps him scanning for problems and chaining solutions toward unification |
| ❌ **CLARIFYING** | look **down** — specify a detail, define a state, decide an edge case | drops him into spec-writing; **the climb back up is expensive** |

**Examples of what I asked that were wrong**, all three clarifying:
*"Is promote silent?"* · *"Does a rejected lead get an outcome?"* · *"What does the cover page show
with no submission?"* — each is a spec detail he would have reached on his own, and asking pulled
him out of the altitude where he finds problems.

⚠️ **A clarifying question is not saved by being important.** Those three were answered and the
answers were substantial — that is not the point. **They cost him the flow state, and flow state is
what produces the change orders in the first place.** Detail questions belong in **step 3**, where
he has already chosen to be in specification mode.

**When a detail is genuinely missing: go and find it (step 2), or write it down as ASK-OWNER and
raise it in review.** Never mid-capture.

### ⚠️⚠️⚠️ THE THREE HARD RULES — broken twice on 2026-08-25, minutes apart

> *"no questions, no research, no information sharing in step 1, only provoking me to look around
> relative to the request i just made, one thing at a time even if i send you 10 you respond one at a
> time. and then take all this shit you just fed me and focus on printing it into the document you
> should be keeping as a ledger so this thread is disposable"*

**1. NOTHING BUT THE PROVOCATION.** No findings. No recommendation. No evidence. No summary of what
was built. The reply during capture contains **one widening question, or nothing at all.**

**2. ONE AT A TIME.** *"even if i send you 10 you respond one at a time."* Ten captured items get
**one** question — the one worth interrupting for. The rest go in the ledger.

**3. ⚠️ EVEN WHEN HE ASKS A DIRECT QUESTION.** He asked *"what do you think about this?"* about
public account creation. I answered it — research, findings, a recommendation, and a closing question
— in the reply. **Wrong.** The answer belonged **in the ledger entry**, surfaced in step 3 where
decisions are made. *"This thread is disposable"* is the whole point: **anything that exists only in
a reply is lost.** A direct question does not suspend the phase; it becomes a `FOUND` and a
`RECOMMENDATION` line under its CR.

⚠️ **The failure mode is seductive**, which is why it happened immediately after being praised for
getting it right: the research WAS good, the findings WERE material, the recommendation WAS sound.
**None of that matters.** Delivered at the wrong time it costs him the altitude, and delivered in a
reply it is thrown away with the thread.

**The reply during step 1 is not where value is delivered. The ledger is.**

### 2. ⚠️ FACT-FINDING — the step that was missing
**Before any question is asked and before any code is written**, go and look. Trace:

- **The UI as it stands** — the actual component, its actual classes, the actual copy on screen.
- **The page code relative to its neighbours** — what else does this, or nearly this.
- **The DB interactions in both directions** — what feeds this surface, and what this surface feeds.

And come back with four kinds of finding:

| Finding | Why it matters | Example already caught |
|---|---|---|
| **A duplicate surface** | we are about to fix one of two things that do the same job | the client page vs the lead modal (§16) |
| **A reusable element** | it exists; use it, and **globalize it as part of this change** | `AddHorseModal`'s shell is the modal idiom (§0.1) |
| **A layout or format we already like** | same — adopt it, then globalize it | the row-list: name · meta · X (§18.3) |
| **Wiring** | *"something not working because it wasnt wired properly"*, plus upstream/downstream impact, plus **DB standardisation we can do alongside** | `mine_role: 'staff'` returned and never read (§13) |

**The test for whether fact-finding actually happened:** the review discussion contains questions
that could only have come from reading the code. *"Should this be filtered or ordered?"* is a
fact-finding question. *"What do you want here?"* is not.

### 3. REVIEW
Walk the change-order list. Discuss the questions fact-finding raised, resolve ambiguity, and
record the ruling **under the requirement it belongs to** — not in a separate list.

### 4. IMPLEMENT
Build it, verify it against production, and say plainly what was built, what was not, and why.

---

## WHY THE MISSING STEP KEPT BITING

Without it, a change order is answered from the shape of the request rather than the shape of the
system, which produces three failures this repo has hit repeatedly:

1. **Building a second thing that already exists.** Two surfaces for one job — the pattern behind
   §16, `PaperworkEditor`, and the two PDF renderers that had silently drifted.
2. **Asking the owner a question the code already answers.** Every one of those is a question he
   should never have seen.
3. **Fixing a symptom whose cause is upstream.** *"Reserved"* looked like a label bug; the read had
   been returning `mine_role: 'staff'` all along and the UI never asked.

⚠️ **It also protects against the opposite error: assuming something is missing because it is not
visible.** Two of three horse-claim capabilities turned out to be already built (§12); the standing
weekly machinery is built and in the wrong place (§8.6); `completed` and `no_show` were already in
the schema (§4). **Fact-finding is as often "this exists" as "this is absent".**

---

## THE GLOBALIZATION PASS COMES AFTER — so feed it now

The owner is front-loading UI/UX decisions *"to get as much of the ui and ux in the right standing
ahead of the final evaluation pass … so there is less guess work and less ambiguous questions."*

**So every fact-finding pass should leave a note for the globalization refactor.** Findings so far,
measured not guessed:

### Modal and overlay shells — **33 hand-rolled, 7 using the shared kit**
`src/components/ops/kit/Modal.tsx` exists and **7 files use it. 33 files hand-roll
`fixed inset-0`.** Fourteen distinct overlay class strings are in play, including:
- **six scrim colours** — `black/30`, `black/40`, `green-950/40`, `green-950/50`, `green-950/60`,
  `green-900/40`, `green-900/50`
- **three z-index tiers** — `z-50`, `z-[60]`, `z-[80]`
- **three alignment strategies** — `justify-end` (6 files, the right-hand drawer), `items-center`,
  `items-start`

**This is the single biggest globalization target found so far**, and §0.1 already needs to touch it.

### Buttons — **48 files hand-roll the dark-green pill**
`.btn-primary` exists and is used in 112 files; **48 files hand-roll `bg-green-800 text-white`
instead, and 29 files do BOTH** — the same button, two ways, in one file.

### Empty states — **`kit/EmptyState` exists; 32 hand-rolled empties**
Ten files reference the kit; there are 32 inline *"None."* / *"No … yet"* / *"Nothing …"* strings.

### Corner radius — **no agreed scale**
`rounded-lg` 373 · `rounded-full` 171 · `rounded-xl` 133 · `rounded-2xl` 25 · `rounded-md` 21 ·
`rounded-sm` 8. ⚠️ Meanwhile **`.form-input` and `.btn-primary` carry NO radius at all**, which is
why the owner's *"rounded corners on the outside with sharp corners on the elements inside looks
weird"* (§18) is a system-wide inconsistency, not one panel's mistake.

### The row list — **the same pattern, six times**
`name · meta · action`, bottom-hairline `border-green-800/[0.06]`, appears in
`ContactDossierModal`, `ProvisionClientForm`, `Messages`, `Admin`, `ContactsPage`,
`TenantDetailPage`. Two of those are from this week. **It wants to be one component**, and it is
now the shape the owner has asked for twice (offerings, paperwork).

---

## THE ONE RULE

**Fact-finding is not optional and it is not a summary of what was asked.** It is the pass that
turns *"why is this shown to me"* into *"the member's shop already gates this correctly and only
the staff form asks nicely"* — which is a different, and much cheaper, change order.
