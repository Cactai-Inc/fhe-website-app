# TASK NAVHOVER — the admin nav hover flickers and snaps

**Assignment for `UIREVIEW`.** Diagnose, confirm with the owner, then write change orders.

**STATUS 2026-08-10 — F2 IS CONFIRMED FROM THE OWNER'S OWN RECORDING. The diagnosis is done.**
Reduced motion is OFF; it happens on BOTH navs, worst expanded; F5 is eliminated. **Read F0
first — the cause is established from frame evidence, so this task is now about the FIX and
its values, not about finding the bug.**
`UIREVIEW` does not implement — `UIBUILD` does, from the orders.

Owner, 2026-08-10:

> we need to investigate the admin nav menu on desktop to find out why the cursorover and
> hover states flicker and why they react so quickly to the cursor instead of easing in and
> out as the cursor move over them.

**Two complaints, and they may have two different causes.** Keep them separate:

- **the flicker** — something visibly jitters or double-renders on hover
- **the snap** — the state change has no perceptible ease

---

# F0 — CONFIRMED CAUSE, from the owner's screen recording. DO NOT RE-DIAGNOSE.

**Evidence: `docs/reference/navhover-frames/`** — read its README, then look at
`leads-hover-in-30fps.png`. Frames were extracted from the owner's recording with
AVFoundation (there is no ffmpeg on this machine; the extractors are in that folder).

Hovering **Leads** in the expanded staff rail, at 30fps:

| frame | background | icon | label |
|---|---|---|---|
| 19.350s | white | green, visible | dark green |
| **19.383s** | still near-white | **GONE — invisible** | still dark |
| 19.417s | pale sage | faintly back | washing out |
| 19.450s | mid sage | white, visible | white |
| 19.483s+ | settled green | white | white |

**The icon disappears completely for about one frame at the start of every hover.** It snaps
to `cream-25` (near-white) with no transition, while its background is still near-white and
only ~30ms into a 150ms ease. **White on white.** The green fill then arrives behind it and
the icon reappears. That drop-out IS the flicker.

**It is worse than F2 predicted.** F2 said the icon would desync from the row. It does not
merely desync — **it vanishes.** And the label and icon are out of sync with each other too:
at 19.383s the icon is gone while the label is still dark; at 19.417s the label has washed
out while the icon has returned. **Three elements, two transition rates, one of them zero.**

Visible transition runs ~19.383 → ~19.483 — about **100ms**, consistent with F3's 150ms
default.

**So there is one root cause for BOTH complaints**, and they are not independent:
the icon has no transition (the flicker) and the row's transition is Tailwind's short default
(the snap).

---

# FINDINGS ALREADY ESTABLISHED — verified 2026-08-10, do not re-derive

## F1 — C1's old diagnosis is STALE. There is no blur in the nav any more.

`docs/reference/OPEN-CHANGE-REQUESTS-2026-08-08.md` records C1 as *"Selection flickers …
Likely inherent: a `backdrop-blur` panel re-composites its backdrop whenever a child
changes. May be unfixable while the panel uses blur at all."*

**That diagnosis was made against the glass nav, which no longer exists.** `NAV_PANEL` is now
`bg-cream-25` — a solid near-white fill. Grepped 2026-08-10: **no `backdrop-blur` remains
anywhere in `AppLayout.tsx`.** The only survivors are modal scrims, the public marketing
header, and `FeedVideo`.

**Do not carry the blur explanation forward.** It has already been wrong once, and the
conditions that produced it are gone.

## F2 — THE ICON HAS NO TRANSITION. The row eases and the icon snaps. (top flicker candidate)

`AppLayout.tsx:436` — the row carries the transition:

```
group relative flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13.5px]
font-sans transition-colors focus-ring
```

`AppLayout.tsx:444` — the icon inside it does not:

```tsx
<Icon size={17} aria-hidden="true" className={isActive ? NAV_ICON_ACTIVE : NAV_ICON_IDLE} />
```

where `NAV_ICON_IDLE` (`:70`) is:

```
text-green-800/70 [@media(hover:hover)]:group-hover:text-cream-25
```

**`transition` is not inherited in CSS.** The parent's `transition-colors` does not apply to
the child `<svg>`. So on one hover:

- the row's **background and label** ease over the default duration
- the **icon colour changes instantly**

Two elements inside one hover target changing at different rates is exactly what reads as a
flicker. This is also a known repeat: a previous session shipped a selected row whose text
moved to a new palette **while its icon did not**.

**Same defect, two more places:**

- `:1270` — the "Add New" `Plus` icon: `` className={`shrink-0 ${NAV_ICON_IDLE}`} `` — no transition
- `:1295` — the group-heading button (`Management`, `People`, …): `hover:text-cream-100`
  with **no `transition-colors` at all** on the element

**Sweep for the whole family rather than fixing the three named here.** `NAV_ICON_IDLE` is
applied at every icon site in the file, and the client rail shows the same symptom — so
enumerate every element that changes colour on hover and check each one carries its own
transition. Fixing only the rows the owner happened to hover over is how this recurs.

## F3 — "Reacts too quickly" is the Tailwind default: 150ms

Every nav row uses bare `transition-colors` with **no `duration-*` class**. Tailwind's default
is **150ms**, `cubic-bezier(0.4, 0, 0.2, 1)`.

So there IS an ease — it is simply short enough to read as instantaneous under a moving
cursor. Confirmed at `:436`, `:467`, `:492`, `:512`, `:633`, `:1269`.

**The owner has not given a duration. Do not invent one** — see the OPEN QUESTIONS.

## F4 — RULED OUT 2026-08-10. Reduce motion is OFF. (kept so nobody re-tests it)

`src/index.css:94–104`:

```css
@media (prefers-reduced-motion: reduce) {
  ... transition-duration: 0.001ms !important;
}
```

**If "Reduce motion" is enabled in the owner's macOS accessibility settings, every transition
in the entire app is neutralised to 0.001ms** — which is precisely "reacts instantly instead
of easing", and the abrupt neutralisation can itself read as a flicker.

**ASKED AND ANSWERED — the owner confirmed 2026-08-10 that Reduce motion is NOT enabled.**

So the reduced-motion block is not firing, every transition is running at its declared
duration, and **F2 and F3 are the live explanations.** Do not re-test this.

**F2 is now the leading hypothesis for the flicker** and it predicts a specific, watchable
signature — the icon finishes changing colour before the row does.

## F5 — ELIMINATED 2026-08-10. Not the cause. (kept so nobody re-opens it)

**The owner confirms the flicker happens on BOTH navs.** The client rail (`:779`) has no
collapse and carries **no width transition at all** — so a duplicated `transition-[width]`
cannot explain a symptom that appears there too.

Whatever is wrong is in something **both** rails share: the row/icon classes of F2 and F3.
The detail below is retained only so the deliberate `<aside>`/`<nav>` split is not "tidied"
by someone who mistakes it for redundancy.

### (retained, not a suspect) The staff rail declares its width transition twice

`:1239` the `<aside>` and `:1249` the `<nav>` inside it **both** carry
`transition-[width] duration-100 ease-out ${staffRailWidthClass}`.

The comment at `:828` explains the split was deliberate — the `<aside>` reserves page width
while the rail animates, which fixed a page-resize bug. **Do not undo it without reading that
comment.** But two elements animating the same property in a parent/child pair is worth ruling
in or out as a jitter source **during collapse/expand**. It should not affect a stationary
hover — confirm that rather than assuming it.

## F6 — ANSWERED 2026-08-10: BOTH navs, worst on the EXPANDED menu

> owner: "it happens on both, but its most noticable on the expanded menu"

**Both** = the staff rail (`:1249`) and the client rail (`:779`). Not the mobile drawer
(`:1369`) — that is not desktop. This is what eliminates F5.

**"Most noticeable expanded" is a prediction F2 makes, and it landing is strong evidence.**

Count what changes on one hover in each state:

| state | background | label | icon |
|---|---|---|---|
| **expanded** (`w-60`, labels shown) | eases — row has `transition-colors` | eases — inherits the row's colour change | **snaps — no transition** |
| **collapsed** (`w-14`, icons only) | eases | *not rendered* | **snaps** |

The label is rendered only when open (`:449`, `{open && <span className="flex-1">{label}</span>}`)
and its colour comes from the row, which transitions. **So expanded, the icon desyncs against
a moving reference sitting directly beside it. Collapsed, there is nothing to compare it to.**

Same defect in both states; expanded just makes it legible. **If a fix removes the expanded
symptom but leaves the collapsed one, it is incomplete.**

---

# WHAT TO DO

~~1. Ask the reduced-motion question~~ · ~~2. Confirm which nav~~ · ~~3. Diagnose~~ —
**ALL DONE. See F0.** The cause is established from frame evidence. Do not spend the thread
re-finding it.

**What remains:**

1. **Verify F0 against the code yourself** — it is a one-file read, and you should not take a
   diagnosis on trust any more than the owner should. Confirm the icon element carries no
   transition and that its hover colour is `cream-25`.
2. **Enumerate the whole family.** `NAV_ICON_IDLE` is applied at every icon site in
   `AppLayout.tsx`, and the client rail shows the same symptom. **List every element that
   changes colour on hover and whether it carries its own transition.** Fixing the three sites
   named in F2 leaves the rest broken.
3. **Get the two values from the owner** — see OPEN QUESTIONS 3 and 4. **Show him a
   comparison; do not pick.**
4. **Then write change orders** into `docs/ui-orders/`. Expect at least two: one for the
   missing transitions, one for the duration/curve. One order per change.

**A note on the fix, not an instruction — the owner decides.** Adding `transition-colors` to
the icon is the obvious move, but it makes the icon fade *through* invisibility rather than
snap through it, which may still read badly against a near-white panel. An alternative is to
stop routing the icon to near-white at all and give it a colour that stays legible at every
point in the blend. **Put both to him rather than assuming the first.**

---

# OPEN QUESTIONS — ASK, DO NOT GUESS

1. ~~**Is macOS "Reduce motion" on?**~~ **ANSWERED 2026-08-10 — NO.** F2/F3 stand.
2. ~~**Which nav?**~~ **ANSWERED — both, worst on the expanded menu.** F6.
3. **What duration does he want?** F3 shows the current value is 150ms. "Slower" is a
   direction, not a number. **Show him a comparison rather than picking one** — you may build
   a standalone page under `docs/reference/` and run it. A previous session shipped eight
   visual changes he rejected, including a colour he had already turned down.
4. **Should the ease curve change too, or only the duration?** Currently Tailwind's default
   `cubic-bezier(0.4, 0, 0.2, 1)`.

---

# CONSTRAINTS

- **`UIREVIEW` writes no code.** `src/` is read-only to you. Output is change orders.
- **`AppLayout.tsx` belongs to `UIBUILD`.** Report; do not apply.
- Any fix must be grepped out of `dist/assets/*.css` by `UIBUILD` — **an arbitrary Tailwind
  value can silently emit nothing while typecheck, lint and build all pass.** `bg-navfill/64`
  produced no rule at all until `opacity: { 64: '0.64' }` was declared in the config.
- The full UI state, colour maths and trap list are in
  **`docs/reference/UI-STATE-2026-08-09.md`** — read it if you have not already.
