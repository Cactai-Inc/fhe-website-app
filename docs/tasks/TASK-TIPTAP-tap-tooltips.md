# TASK TIPTAP — explanations must work on tap

Every tooltip in the contract renderer uses the native `title` attribute. **iOS Safari
does not show `title` on tap.** So every explanation of why a field cannot be edited is
visible on desktop and invisible on a phone.

The owner's clients read and sign on phones. The explanations are missing exactly where
they are needed.

---

## Why this matters more than it looks

The design depends on it. A field the viewer cannot fill is **not greyed out** — it shows
short text in the sentence (*"Not Eligible"*, or a value someone else set) and the reason
lives behind a tap. If the tap does nothing, the reader sees an unexplained state in a
contract they are being asked to sign, with no way to find out why.

Shipped `title=` tooltips affected (confirm the full list yourself):

- `OwnedField` — *"This item is set by the Lessor."* (merged today, TASK-CHECKBOXTIP)
- Imported-record tokens — *"Changes to this information must be made on …"*
- The required-field asterisk — *"Needs an answer before signing"*
- Others at `ClauseDocument.tsx` ~124, ~135, ~214, ~252, ~262, ~999

---

## What to build

One shared component. Every explanation in the renderer goes through it.

### Behaviour

- **Tap opens it. Tap anywhere else closes it.** This is the requirement the whole task
  exists for — verify on a real iPhone, not an emulator, if at all possible.
- **Hover still works on desktop**, without a click.
- **Keyboard reachable**, dismissible with Escape.
- **Never traps the underlying control.** If the element is genuinely editable, a tap must
  still edit it. The tooltip trigger belongs only to elements the viewer *cannot* act on.
- **Stays on screen.** These sit inline in prose on a 390px viewport; the bubble must flip
  or clamp rather than overflow. This is the most likely thing to get wrong.
- Only one open at a time.

### Discoverability

A reader has no reason to suspect that tapping grey text explains anything. Give it a
quiet, consistent affordance — a dotted underline, a small marker — applied wherever an
explanation exists and **nowhere else**, so it reliably means "tap me for the reason."

Do not use a modal, a toast, or anything that moves the page. The reader is mid-sentence.

### Accessibility

Keep the `aria-label` behaviour that exists today; a screen reader must not lose the
explanation. `title` may be retained as a desktop fallback but is **not** the mechanism.

---

## Freeze exception

`ClauseDocument.tsx` is FROZEN to all threads. **This task is a scoped exception, approved
by the orchestrator**, limited to:

1. introducing the shared component, and
2. converting existing `title=` explanations to it.

Change nothing else in that file. No layout, no gating, no field logic. If the conversion
appears to require touching anything beyond the tooltip call sites, **stop and report**.

`ContractCascade.tsx` may also carry explanation tooltips — check, and convert them the
same way if so.

---

## Verification

The failure mode is silent: a tooltip that never opens looks identical to one with nothing
to say.

1. **On a real iPhone** (or the closest available): tap a non-editable field, confirm the
   explanation appears; tap elsewhere, confirm it closes.
2. **On desktop**: hover still works, and a click on an *editable* field still edits it
   rather than opening a tooltip.
3. **At 390px**: an explanation on a field at the right edge of the screen stays fully
   visible.
4. Every converted call site still shows the same text it showed before.
5. Screen-reader output unchanged.
6. Typecheck and lint clean.

State plainly which of these you could and could not verify — the previous three threads
in this area all lacked a browser and said so, which was the right call.

## Constraints

- Own git worktree off `origin/main`.
- Sarah's document `704c8d2d-…` is a live negotiation — read-only, never write.

## Reporting

`docs/reports/TASK-TIPTAP-REPORT.md`. Include the complete list of call sites you
converted, and any you deliberately left alone with the reason.
