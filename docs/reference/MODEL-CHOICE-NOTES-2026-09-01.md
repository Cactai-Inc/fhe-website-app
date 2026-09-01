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
