# MODEL CHOICE — what ORCH6 established, 2026-09-01

**Checked against the current API reference, not from memory.** ⚠️ **The owner asked how effort
compares across tiers before spending a Fable thread; this is the answer, so nobody re-derives it.**

## THE HEADLINE: A MORE CAPABLE MODEL NEEDS LESS EFFORT, NOT THE SAME
🔒 **Fable 5 at `low`/`medium` often exceeds prior models at `xhigh` or even `max`.** **So a job
run at Opus·MAX maps to roughly Fable·`high`, sometimes `medium`.** ⚠️ **Do NOT carry an effort
setting across a model change — re-sweep it.**
**The same holds one tier down: Claude Opus 5 is unusually strong at `low` and `medium`, so
effort defaults inherited from an older Opus are usually too high.**

## ⚠️ BUT LOWER EFFORT DOES NOT MEAN CHEAPER
| | Input / Output per MTok |
|---|---|
| **Fable 5** | ⚠️ **$10 / $50** |
| **Opus 5** | **$5 / $25** |
**Double the price, longer turns** *(single requests of many minutes are normal)*, **and the owner
measures more tokens per action.** 🔒 **Under his hard usage cap, Fable is for ONE hard thing, not
a default.**

## TWO FABLE-SPECIFIC FACTS THAT CHANGE HOW WE'D SPEC FOR IT
1. ⚠️ **Thinking is always on.** `{"type":"disabled"}` returns a 400 and `budget_tokens` is gone —
   **`effort` is the only depth control.**
2. 🔒 ⚠️ **PROMPTS WRITTEN FOR PRIOR MODELS ARE OFTEN TOO PRESCRIPTIVE FOR FABLE AND REDUCE OUTPUT
   QUALITY.** **Our TASK specs are extremely prescriptive** — trap lists, numbered criteria,
   step-by-step tests — **which is tuned for Opus and may work against Fable.** **A fair trial
   needs a spec written the other way: the goal, the constraints, the definition of proven, and no
   choreography.**

## WHERE TO SPEND IT
**`DSNR` on a genuinely tangled subject — chunking under uncertainty is the shape it is best at.**
⚠️ **NOT on a build whose spec is already written out; that is exactly where Opus at `high` is
already enough.**

## UNCONFIRMED
**The owner mentioned a "Fable 5.1" release. The reference available on 2026-09-01 does not list
it** — the guidance above is for the Fable family and should carry.

## 2026-09-03 — Fable 5.1 for SHAPE-BEFORE-FIX work (owner ruling)
> *"consider using Fable 5.1 for complex tasks from the list, dont use it just to use it, but we
> should probably be giving it a try anywhere it will genuinely resolve issues that are challenging
> due to the complexity of the convoluted heap… especially the challenges that are causing half built
> solutions and fixes being implemented at face value on the surface of something that truly needs a
> fresh look at its shape and structure before deciding if it needs a fix or a refactor."*

**The rule ORCH applies:** the tier follows the QUESTION the task must answer.
| The task must answer | Tier |
|---|---|
| "what is the right SHAPE here, and is this a fix or a refactor?" — overlapping subsystems, a seam three threads already got wrong, a design that must converge incumbents (D18) | **Fable 5.1 · HIGH** (no thinking line) — DSNR-profile specs on convoluted ground, RECONCILE-class passes, WALKR flow walks, the MGMT threads themselves |
| "build exactly this, with judgment inside a locked shape" | Opus · HIGH · thinking ON |
| "apply this idiom N times without drifting" | Sonnet · MEDIUM/HIGH · thinking ON |
**Not a default:** a Fable spec task is chosen because the ground is convoluted, not because the
change is large. A large but well-shaped change stays Opus. ⚠️ Prescriptive spec style may work
against Fable (2026-09-01 note above): give it the outcome, the incumbents, the rulings and the
traps, and let it draw the route.

**Applied 2026-09-03 to the queue:** SUPPLIES design (CR-109/112 — three overlapping subsystems,
ledger model) · INROADS (auth-state branching, three failed removal proposals) · FUNNELDEBT (funnel
seams F1–F4 + guardian) · MODULES access point + admin refactor (CR-110) · CR-106 analytics/SEO
architecture · the DASHBOARDS revisit (CR-107) → all Fable-tier DSNR-profile tasks. SIGNFLOW-G/H,
BANNEDWORDS, SITEPOLICY research → unchanged (Sonnet/Opus).

## 2026-09-03 (later) — D45: Fable is never a default (owner)
> *"i told ORCH-7 its an option but now all of them are running on it and its hammering my usage allowance, were at 50% and we only used 20% of the working hours."* … *"we have used 30% of the fable allowance for the week and its only been 9 hours since it reset. were going to run out"*
Seven Fable threads were up (four MGMT + three DSNR). **Rule now: MGMT · DSNR · VRFY · WALKR · builds default to Opus · HIGH · thinking ON; Sonnet · MEDIUM · ON for idiom sweeps; Fable · HIGH only when the owner names the thread, one at a time.** ORCH brings the candidate and the reason. Running threads keep their model; a barely-started Fable thread is stopped and re-spawned on Opus from its own ledger.

## 2026-09-03 (final wording of D45) — the spawning thread decides; no tier is dictated
> *"we need to not dictate a model tier, we need to let the authoring thread that is spawning the new one evaluate the work and decide, if fable is required then so be it but if we run out of usage we are sitting with no way to work."*
Supersedes the "Opus default" wording above. Every prompt header still names model · effort · thinking (owner requirement), chosen by the thread that wrote it for that work, with a one-line reason. The Fable allowance is the shared constraint every chooser weighs.
