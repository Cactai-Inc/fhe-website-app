# UI change orders

**The queue between `UIREVIEW` (writes them) and `UIBUILD` (implements them).**

One file per order: `UIO-<NNN>-<slug>.md`, three digits, sequential. Highest number here
is the last one written — check before creating a new one.

`Status: READY`   — UIBUILD may implement it
`Status: BLOCKED` — a value the owner has not supplied is missing. UIBUILD SKIPS these
                    and does NOT fill the value in.
`Status: DONE`    — implemented; the commit is named in the order.

The shape is specified in `docs/tasks/TASK-UIREVIEW-screenshot-evaluation-loop.md` PART 2.
UIBUILD reads nothing but the order, so anything missing from it becomes a guess.
