# TASK NAVHOVER — the admin nav hover flickers and snaps

**Assignment for `UIREVIEW`.** Diagnose, confirm with the owner, then write change orders.
`UIREVIEW` does not implement — `UIBUILD` does, from the orders.

Owner, 2026-08-10:

> we need to investigate the admin nav menu on desktop to find out why the cursorover and
> hover states flicker and why they react so quickly to the cursor instead of easing in and
> out as the cursor move over them.

**Two complaints, and they may have two different causes.** Keep them separate:

- **the flicker** — something visibly jitters or double-renders on hover
- **the snap** — the state change has no perceptible ease

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

## F3 — "Reacts too quickly" is the Tailwind default: 150ms

Every nav row uses bare `transition-colors` with **no `duration-*` class**. Tailwind's default
is **150ms**, `cubic-bezier(0.4, 0, 0.2, 1)`.

So there IS an ease — it is simply short enough to read as instantaneous under a moving
cursor. Confirmed at `:436`, `:467`, `:492`, `:512`, `:633`, `:1269`.

**The owner has not given a duration. Do not invent one** — see the OPEN QUESTIONS.

## F4 — CHECK THIS FIRST. It costs one question and could explain everything.

`src/index.css:94–104`:

```css
@media (prefers-reduced-motion: reduce) {
  ... transition-duration: 0.001ms !important;
}
```

**If "Reduce motion" is enabled in the owner's macOS accessibility settings, every transition
in the entire app is neutralised to 0.001ms** — which is precisely "reacts instantly instead
of easing", and the abrupt neutralisation can itself read as a flicker.

**ASK HIM BEFORE ANALYSING FURTHER:** System Settings → Accessibility → Display → Reduce
motion. If it is on, F3 is not the cause and the real question becomes what this app should
do for reduced-motion users — a different conversation entirely.

## F5 — The staff rail declares its width transition TWICE

`:1239` the `<aside>` and `:1249` the `<nav>` inside it **both** carry
`transition-[width] duration-100 ease-out ${staffRailWidthClass}`.

The comment at `:828` explains the split was deliberate — the `<aside>` reserves page width
while the rail animates, which fixed a page-resize bug. **Do not undo it without reading that
comment.** But two elements animating the same property in a parent/child pair is worth ruling
in or out as a jitter source **during collapse/expand**. It should not affect a stationary
hover — confirm that rather than assuming it.

## F6 — Which nav is "the admin nav"?

There are three surfaces and the owner said **admin, desktop**:

| surface | line | notes |
|---|---|---|
| **staff rail** | 1249 | **this is almost certainly the one** — `w-60 xl:w-64` pinned, `w-14` collapsed |
| client rail | 779 | `w-60`, no collapse |
| mobile drawer | 1369 | not desktop |

**Confirm with him which he is on** — the staff rail has the collapse behaviour and the extra
width transitions, so the answer changes what F5 is worth.

---

# WHAT TO DO

1. **Ask the reduced-motion question (F4) before anything else.** One question, and it may
   close the whole task.
2. **Confirm which nav (F6)** and get a screen recording if he can — a flicker does not appear
   in a still, and F2 predicts a specific signature: **the icon changes colour before the row
   finishes.** Watching for that confirms or kills the leading hypothesis in seconds.
3. **Diagnose from evidence, not from plausible code paths.** The contract reload bug took
   three attempts; two were confident diagnoses from reading likely culprits, and what found
   it was enumerating every call site. C1 above is a second instance of the same mistake.
   **Reproduce it, then explain it.**
4. **Then MODE C:** list what you found, numbered, with confidence markers, and **stop for his
   confirmation before proposing fixes.**
5. **Then write change orders** into `docs/ui-orders/`. One order per change.

---

# OPEN QUESTIONS — ASK, DO NOT GUESS

1. **Is macOS "Reduce motion" on?** F4. Ask first.
2. **Which nav — the staff/admin rail, or the client rail?** F6.
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
