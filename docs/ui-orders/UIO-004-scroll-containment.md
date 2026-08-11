# UIO-004 — contain every scroll container instead of harnessing the body

**Status:** READY

## Why

A previous attempt at this landed `overflow-x: clip` on `html`, which broke scroll anchoring
and **made contract authoring unusable**. Typecheck, lint and build all passed. Reverted at
`259d0e9`. See trap T3 — root-level CSS is a different risk class.

**The principled fix is the opposite:** contain each scroll container so it stops chaining its
overscroll to the body, rather than restraining the body.

## What it must become

Add **`overscroll-contain`** to every `overflow-y-auto` scroll container. 35 sites across 21
files, already identified on `task/uireview` at `ee9a261`:

```
- <div className="overflow-y-auto p-2">
+ <div className="overflow-y-auto overscroll-contain p-2">
```

**Cherry-pick `ee9a261` rather than re-deriving it** — it is mechanical, complete and already
reviewed. Resolve conflicts against what UIO-001 and UIO-002 changed.

## Files

The 21 files in `ee9a261`. Modals, panels, page shells, the ops queues.

## Do NOT

- **Nothing lands on `html` or `body`.** That is what this order exists to avoid.
- Do not add `overscroll-contain` to a container that is not scrollable — it does nothing and
  it obscures which containers actually scroll.

## Verification

Grep the built CSS for `overscroll-behavior`. Confirm `html` and `body` are untouched by
diffing `src/index.css` — it should be unchanged by this order.

**This one genuinely needs a browser check on a phone**: overscroll chaining is the symptom and
it does not appear in a static render. Say plainly that you could not confirm it if you did not.
