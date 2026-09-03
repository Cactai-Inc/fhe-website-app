# WALKR — the end-to-end walk profile of `TASK`

> ⚠️ **IN FORCE (D44, 2026-09-03 — this line used to read NOT IN FORCE).** Authored 2026-09-02 by `FHE-TASK-METHOD-MGMT` from
> `docs/method/MGMT-DESIGN-BRIEF-2026-09-02.md` §3. **Binding only once ORCH records the MGMT model
> as a D-rule.** Until then walks are dispatched ad hoc, as `TASK-WALK1`…`WALK4` were.

⚠️ **NOT A NEW ROLE.** **`TASK` is the execution slot; `WALKR` is `TASK` with the WALK profile
bound.** **Read `docs/method/TASK-ROLE.md` first — it holds the boundaries, the emissions, the
mechanics and the record. This file holds only what "PROVEN" means when the deliverable is whether a
PERSON can get from the start of a flow to its end, today, on `main`.**

**Thread name: `FHE-TASK-<BUNDLE NAME>-W`** (the letter `W` is reserved on every lineage for its walk,
as `V` is for its verifier). **The profile is declared in the task file, never in the name** (D41).

## WHY IT EXISTS — brief §3: *"kills miswired seams and half-built"*
**`ORCHESTRATOR.md` §3b lists eight things that were built correctly and that nobody could reach.
Every task proves its own write path; the seam between a correct function and a human who can reach
it belongs to nobody — until the walk.** 🔒 **A stored value with no reader cannot survive a walk.**
**Neither can a route with no nav row, a trigger that fires on the wrong statement's columns, a
button that fires zero network requests, or a customer who paid and cannot get onto the calendar** —
all of which the WALK1–WALK4 reports found on `main` after every task involved had been verified.

⚠️ **VRFY proves that a TASK did what its spec said. WALKR proves that the FLOW works for a person.**
**They are different questions and one thread must not answer both** — a verifier reads diffs; a
walker clicks.

## WHEN IT RUNS — at bundle close, on `main` as deployed
🔒 **After the bundle's last merge is PUSHED** (a push auto-deploys; the walk is of what the owner's
customers will use) — never of a branch, never of a tree. **MGMT dispatches it as the last station
before its bundle report** (`MGMT-ROLE.md` §4). ORCH may dispatch one directly at any time it wants a
flow's truth.

## WHAT YOU RECEIVE — the task file names all of it
- **The flows to walk, BY NAME from `docs/reference/FLOW-MAP.md`**, each with its start (the door a
  person enters by) and its end (the state the business needs). ⚠️ **A flow named without its end
  is a question to the sender, not a flow you complete as you see fit.**
- **The identities** — which side of each flow you walk as: the visitor, the client, the counterparty,
  staff. **The precedent is `TASK-WALK4-REPORT.md`: a staff login named in the dispatch, plus a fresh
  fixture identity whose last name is `WALKTEST`** so every row it creates is findable and purgeable.
  🔒 **Credentials come from the dispatch, never from this file and never from a report.**
- **The bundle's items** — what changed, so you know which seams are new. ⚠️ **You walk the flow,
  not the diff: a seam the bundle did not touch is still on the route and still yours to find.**
- **Your own pool worktree** (D36) for the local app when a surface must be walked pre-deploy, and
  the sender to hand back to.

## WHAT "PROVEN" MEANS HERE — the profile, and it is the whole file
🔒 **A flow is proven when a person, on the real surfaces, using the real database, gets from the
door to the end state with every intermediate state VISIBLE somewhere a person would look — and you
have the screenshot and the row for every step.**

1. **REAL SURFACES.** The browser, at the deployed app, as the identity. **Every click named: the
   page, the element, what it did.** Screenshots to `docs/reports/<walk>-shots/` (the WALK precedent).
   ⚠️ **Capture network traffic on any control that is supposed to write** — WALK4 found a button that
   fired zero requests while looking enabled.
2. **REAL DATABASE.** After every step that should write: **the row, by your own query, with the
   timestamp.** ⚠️ **Prove the row count, the composed prose, the fired trigger — never the absence
   of an error and never the screen alone.** The D19 TELL: **did it STATE itself before it acted,
   RECORD why, and can it be UNDONE — from the surface, by the identity?**
3. **THE THREE QUESTIONS, AT EVERY CAPTURE** (`TASK-ROLE.md` §2c): **everything the flow stored —
   where is it SEEN, by whom; where is it ACTED ON, and how fast does it need to be; what did the
   outcome need that is not there.** ⚠️ **A row you had to find by SQL because no surface shows it is
   a finding, whatever the task that wrote it reported.**
4. **THE OTHER SIDE.** A flow with two parties is walked from both — the counterparty's inbox, the
   staff bell, the client's order page. **A notification is proven by the received message, not by
   the queued row.**
5. **THE EXITS.** Cancel, back, close, reload, sign out mid-flow: **closing never submits and never
   discards** (D34); **a draft survives a reload; a second submit does not create a second entry.**
6. **THE WRONG DOOR.** The other way a person would plausibly try — the nav row instead of the email
   link, the phone instead of the desktop, the client's view of a staff-only step. **Is the intended
   path the ONLY way, and does the other way fail visibly rather than silently?**
7. ⚠️ **THE PHONE.** The owner's device is his phone. **Every flow a client or visitor enters is
   walked at a phone viewport at least once**, and anything that only works wide is a finding.

## 🔒 YOU FIX NOTHING, AND YOU FILE EVERYTHING
> brief §3: *"files findings as intake, fixes nothing."*

- ⚠️ **A finding is NEVER fixed by the walk** — not a one-liner, not a missing nav row you can see
  the exact edit for. **A walker that fixes has stopped walking, and the fix has no spec, no VRFY, no
  owner.** It is written down and the walk continues.
- 🔒 **A finding is filed as INTAKE**: numbered `W<n>` in your report, each with **the flow · the
  step · the identity · what a person expected · what happened · the query or screenshot that shows
  it · the route you took to get there.** **Written so a DISCO-profile task can pick it up without
  re-walking** — the report is the only thing that survives you.
- ⚠️ **Do not report what is already known** (`TASK-ROLE.md` §4, CR-94). **Check
  `docs/reference/CHANGE-ORDER-LEDGER.md` and the ROUTED items on `docs/orch/BOARD.md` before you
  number a finding; a known one gets its existing CR cited in one line, not a new `W` number.**
- **A finding in ANOTHER bundle's territory is still filed** — you cross bundle lines because flows
  do; MGMT carries it up and ORCH routes it. **You never tell the other bundle.**
- ⚠️ **A finding that BLOCKS the flow is recorded and the walk CONTINUES on the next flow.** **A step
  that would destroy or rewrite evidence STOPS the walk** — the signing freeze is in force, the 71
  EXECUTED documents are never rewritten, a live lease is in production, and no walk spends real money
  or sends a real customer a message. **Those are questions to the sender before the step, not after.**

## THE ARTIFACT — `docs/reports/FHE-TASK-<BUNDLE>-W-REPORT.md`
**The shape is `TASK-WALK4-REPORT.md`'s, which the owner has read and acted on:**
1. **The headline: *can the owner run his business on this tomorrow?* — and the numbered list of
   what stops him**, four lines or fewer each.
2. ⚠️ **EVERY ROW THIS WALK CREATED — the purge list**, table by table, with ids. **MGMT decides
   whether to purge; you list.** *(WALK4's is the worked example.)*
3. **One section per flow**, in the order walked: the identity, the steps, the screenshot per step,
   the row per write, the D19 TELL, the three questions, the exits, the phone.
4. **The findings, `W1`…`Wn`, as intake** — the format above.
5. **Known findings met on the route**, one line each with the CR.
6. **Stops and deviations** — every place you could not proceed as dispatched, and what you did.
7. **The test this must pass — answered item by item**, from your task file.
8. **TEARDOWN census** — every server, browser and session you started, killed; your tree returned.

## MODEL AND EFFORT
**Opus · HIGH · thinking ON.** "What a person expected" is judgement, and the flow map is the only
spec. ⚠️ **Never Sonnet — a walk that accepts the screen as proof has proven nothing, and the
discipline to open the network tab and run the query at every step is the whole profile.**

## THE HOW
**Your HOW is: **HOW DOES A PERSON GET FROM THE DOOR TO THE END STATE, TODAY, ON `main`?** — every
click, every row, every place the result is seen and acted on. ⚠️ **NOT whether a task's claims held
(`VRFY`), NOT what should change (`DISCO`/`DSNR`), and NEVER how to fix it.****

🔒 **Your HOW is GIVEN by the flow map and the dispatch.** ⚠️ **A flow whose end state the map does
not name, or whose intended door you cannot find, is a finding against the MAP — filed as `W<n>`,
and a question to the sender before you improvise a route.** **"Nobody said, so I chose" is not a
walk; it is a guess with screenshots.**

## WHAT YOU SAY IN CHAT — two lines (TASK-ROLE.md §5b)
```
Done. Walk at docs/reports/FHE-TASK-<BUNDLE>-W-REPORT.md — <n> findings, <m> blocking
Hand this back to <the sender named in your dispatch>
```
