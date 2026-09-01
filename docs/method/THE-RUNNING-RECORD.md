# THE RUNNING RECORD — every role, every thread, no exceptions

**Owner, 2026-09-01:**
> *"its crucial that everything done is always recorded with full fidelity somewhere at all times. if a
> thread dies a new one needs to be able to pick up and the loss is near 0 or 0."*

⚠️ **THIS FILE IS BINDING ON `ORCH` · `DISCO` · `DSNR` · `TASK` · `CLNR`.** Each role file points here
rather than repeating it, so there is one copy of the rule.

---


# 0. 🔒 THE OWNER AND `ORCH` ARE THE HUB. THE REPO IS THE MEDIUM. THE ROLES ARE SPOKES.

**Owner, 2026-09-01:** *"i work with you, you and i control the flow by handing things where they need
to go, DISCO is a lot of discussion, DSGN is a lot of decisions, and you and i are doing a lot of
monitoring and TASK only ever has questions or a report."*

🔒 **ROUTING IS A DECISION AND IT BELONGS TO THE PAIR — the owner and `ORCH`.** ⚠️ **The repo is not
the hub; it is what the spokes write through, so nothing is ever in flight between two threads.**
**The pair decides where a thing goes next; the files are how it gets there.**

| Spoke | Emits | ⚠️ If it is emitting anything else |
|---|---|---|
| **`DISCO`** | **discussion** — understanding, captured | it is deciding, or building. Stop it |
| **`DSNR`** | **decisions** — chunks and specs | it is discussing with the owner. That is DISCO's |
| **`TASK`** | ⚠️ **a question, or a report. NOTHING ELSE** | it is designing. Send the question up |
| **`ORCH`** + owner | **monitoring and routing** | ORCH is authoring, discovering, or fixing |

**And the distinction that makes the whole thing work:**

🔒 **INFORMATION IS HUB-AND-SPOKE.** ⚠️ **No role hands anything to another role.** **Each WRITES to a
known place and READS from known places.** **A "handoff" is a file appearing where the next role
already looks — never a message passed between two live threads, because one of them is usually
already closed.** ⚠️ **A blocked role does not wait to be told: it reads the hub and finds out.**

🔒 **AUTHORITY IS LINEAR, AND MUST STAY THAT WAY.** **One owner per artifact: `DISCO` owns capture,
`DSNR` owns specs, `ORCH` owns sequence and verification, `TASK` owns the build.** ⚠️ **Make
AUTHORITY hub-and-spoke and you get two authors of one thing — which is every failure this repo has
spent a month fixing: two nav tables, two revenue functions, two live handoff lineages.**

**The spokes, and what each writes into the hub:**
| Role | Writes | Reads |
|---|---|---|
| `DISCO` | the ledger · `DISCO-<n>-HANDOFF.md` | the repo, the database, `TASK-*-REPORT` + `-VERIFICATION` |
| `DSNR` | `docs/tasks/TASK-<ID>-*.md` · `DSGN-<n>-HANDOFF.md` | `DISCO-<n>-HANDOFF.md`, the ledger |
| `ORCH` | `TASK-<ID>-VERIFICATION.md` · `TASK-LEDGER.md` · `BOARD.md` · D-rules | `DSGN-<n>-HANDOFF.md`, task reports |
| `TASK` | `TASK-<ID>-REPORT.md` · the code | its spec, `TASK-ROLE.md`, the hub |
| `CLNR` | `CLNR-<n>-REPORT.md` | everything |

⚠️ **THEREFORE A DEAD THREAD BREAKS NOTHING.** **Nothing is in flight between two threads; it is
either written to the hub or it does not exist.**

---

# 1. THE TEST

🔒 **KILL ANY THREAD AT ANY MOMENT. A fresh thread of the same role reads the repo and continues.
The loss is one step, not one session.**

⚠️ **"I will write it up at the end" IS THE FAILURE.** A thread that dies at 80% with an unwritten
report has lost 80% of its value — the commits survive and the REASONING does not, and the reasoning
is the expensive half.

# 2. THE ARTIFACT — `docs/reports/<ROLE>-<n>-LEDGER.md`

**Opened with your FIRST action, not your last.** *(`DISCO-1-LEDGER.md` is the worked example: every
number with the query that produced it.)*

**It opens with a RESUME BLOCK, and that block is rewritten every time you update the file:**

```
## RESUME
Role / thread   TASK-BACKDATE · wt-1 · branch task/backdate
Merge-base      <sha> — and whether origin/main has moved since
DONE            the steps finished, each with the commit that carries it
IN FLIGHT       the step I am inside RIGHT NOW, and how far
NEXT            the next concrete action, specific enough to just do
DECIDED         what I decided that the spec did not, and why
BLOCKED         what I am waiting on, and who owns it
DO NOT          what I tried that does not work, so the next thread does not retry it
```

⚠️ **`DO NOT` IS THE HIGHEST-VALUE LINE AND THE ONE MOST OFTEN OMITTED.** **A dead end you found is
knowledge; if it dies with you, your successor spends the same hour finding it again.**

# 3. THE CADENCE — when to write

**Update the running record:**
- **after every commit**, and ⚠️ **commit after every unit of work that stands on its own** — not at
  the end of the task;
- ⚠️ **the moment you decide something**, not when you report it;
- **the moment you find something surprising**, in one line, before chasing it;
- **before any long or risky operation**, so a death mid-operation is recoverable;
- **before you hand off.**

⚠️ **A measurement that exists only in your context window does not exist.** **Paste the query and the
number as you run it.** A number retyped later from memory is a hypothesis wearing a fact's clothes.

# 4. WHAT GOES WHERE — one home each, never two
| | |
|---|---|
| **the request, verbatim** | `docs/reference/CHANGE-ORDER-LEDGER.md` — ⚠️ **the moment it is said** |
| **what is true about the system** | your running ledger, with the query |
| **a settled decision** | ⚠️ **`CLAUDE.md` as a D-rule.** **A decision recorded only in a reply does not exist** |
| **what a task did** | `docs/reports/TASK-<ID>-REPORT.md` |
| **whether it was actually true** | ⚠️ **`## VALIDATION` on that same report, by `ORCH`** |
| **what has shipped** | `docs/reference/TASK-LEDGER.md`, one line |
| **where a thread got to** | ⚠️ **the RESUME block, above** |
| **the role's own rules** | `docs/method/<ROLE>-ROLE.md` — ⚠️ **never state, ever** |

# 5. NON-NEGOTIABLES
- ⚠️ **COMMIT AS YOU GO.** Uncommitted work in a dead thread is lost work. **Stage explicit paths;
  never `git add docs/`.**
- ⚠️ **NEVER let two files claim to be the live version of the same thing.** **That has already cost
  this repo a bad merge to production.** Supersede in place, and say what superseded what.
- ⚠️ **A thread ending cleanly writes its last RESUME block anyway** — *"complete, nothing in flight"*
  is a valid and useful entry.
- **`CLNR` audits this.** A thread with no running record, or a resume block staler than its own last
  commit, is a finding.
