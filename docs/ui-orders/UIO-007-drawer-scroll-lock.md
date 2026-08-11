# UIO-007 — closing the drawer over a contract reloads the page and loses your place

**Owner confirmed:** 2026-08-10 · **Status:** READY
**Run UIO-004 first, or with it — the fix depends on it.**

## What he reported

> "if you are viewing a contract and open the avatar menu and then click out of it by clicking
> the avatar button or the content area the page reloads and scrolls, it shouldnt reload and
> the scroll should be to the point the user was at if it absolutely must reload and right now
> i was on section 13 and it scrolled to section 3 after reload. **I strongly prefer no
> reload.**"

## The cause — and it is the workaround this project has already been burned by

`AppLayout.tsx:965–979`. Opening the drawer freezes the page and closing it restores the
position by hand:

```js
const y = window.scrollY;
body.style.position = 'fixed';
body.style.top = `-${y}px`;
// on close:
window.scrollTo(0, y);
```

**This is "restore scroll position after a teardown" — the exact pattern the handoff names as a
workaround rather than a fix** (S3: *"Restoring scroll position after a teardown was a
workaround; not tearing down was the fix. The owner spotted this immediately."*). It is the
same shape a second time, in a different file.

**Why it lands on the wrong section.** `window.scrollY` is captured from the window, but the
app scrolls inside `overflow-y-auto` containers — the rails are `sticky` with their own
scrollers, and page content sits in its own. Freezing `body` and restoring the *window's*
offset restores a scroller that is not the one the contract was scrolled in. Section 13 →
section 3 is that mismatch, not a rounding error.

**`type="button"` is present on the avatar** (`AppHeader.tsx:89`), so this is **not** a form
submit. What reads as a "reload" is the page being frozen, unfrozen and jumped.

## What it must become

**Do not fix the restore. Remove the need for it.**

The body lock exists to stop the drawer's scroll chaining to the page behind it.
**`overscroll-contain` on the drawer does that without freezing anything** — which is UIO-004's
whole subject.

1. **Give the drawer `overscroll-contain`** (UIO-004 covers the sweep; the drawer at
   `AppLayout.tsx:1392` is the one that matters here).
2. **Delete the `position: fixed` body lock and its `window.scrollTo` restore.**
3. **Nothing replaces them.** No scroll capture, no restore, no `scrollTo` anywhere in the
   drawer path. If the page never moves, there is nothing to put back.

## The iOS caveat — read before deleting

The comment above that effect says `position: fixed` was chosen because **iOS Safari ignores
`overflow: hidden` on `body`**. That is true and it is why the lock exists.

**It does not apply here.** `overscroll-behavior` is supported on iOS Safari and works by
containing the *drawer's* chain rather than restraining the body. **Verify it on a real iPhone
before reporting done** — if scroll still chains to the page behind the open drawer on iOS,
STOP and report rather than reinstating the lock.

## Files

- `src/components/app/AppLayout.tsx`

## Do NOT

- **Nothing lands on `html` or `body`.** An `overflow-x: clip` on `html` broke scroll anchoring
  and made contract authoring unusable; typecheck, lint and build all passed. Trap T3.
- Do not add a scroll-restore anywhere. That is the bug, not the fix.
- Do not touch `ClauseDocument.tsx` — frozen, stop-and-propose.

## Verification

**The owner's exact case, on a phone:** open a contract, scroll to a late section, open the
avatar menu, close it by tapping the avatar and again by tapping the content area.
**The page must not move on either.**

Then confirm the drawer still scrolls internally and does not chain to the page behind it —
**on iOS specifically**, which is the whole reason the lock was written.

Grep the built CSS for `overscroll-behavior`, and confirm `position: fixed` no longer appears
in the drawer path. Say plainly which of these you verified in a browser and which you did not.
