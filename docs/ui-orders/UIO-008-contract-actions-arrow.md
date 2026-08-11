# UIO-008 — the contract actions block points the wrong way and hides at the edge

**Owner confirmed:** 2026-08-10 · **Status:** READY

> "the contract actions block uses a small right arrow in its closed state. it needs to be a
> down arrow and when opened it shows an up arrow, the arrow is very close to the right side so
> its hard to notice because the text is on the left its a big gap between the two."

## Two changes

**1. The arrow says the wrong thing.** A right arrow means "go somewhere". This block expands
in place, so it must be a **down arrow closed, up arrow open** — the same vocabulary the nav
groups already use (`ChevronDown` / `ChevronUp`, `AppLayout.tsx:623`). Reuse that pair; do not
introduce a third arrow style.

**2. It is too far from its label to read as one control.** The text sits left, the arrow sits
hard against the right edge, and the gap between them breaks the association — the owner did
not notice it was there.

**Bring the arrow to the text.** Do not stretch the label. The exact spacing is yours; state
what you chose and why so one value can be adjusted rather than the whole thing re-guessed.

## Files

Whichever component renders the contract actions block. **Find it before changing anything** —
if it turns out to be `ClauseDocument.tsx`, that file is frozen under a stop-and-propose rule:
present the minimal diff and WAIT.

## Verification

Grep the built output for the chevron pair. Confirm closed shows down and open shows up.
**The spacing is an eye judgement — the owner confirms it.**
