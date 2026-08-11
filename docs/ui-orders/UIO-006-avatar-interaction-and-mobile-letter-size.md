# UIO-006 — the avatar reads as a button, and its letter grows on mobile

**Owner confirmed:** 2026-08-10 · **Status:** READY

Follows UIO-002. Three defects the owner found once it shipped.

## 1. The open state and the pressed state are the SAME. The click is invisible.

> Owner: *"part of the issue is that the selected state remains when the menu is open which
> doesnt look like a click"*

`app-header.css:258` gives `button.oh-avatar:active` **and**
`button.oh-avatar[aria-expanded='true']` the identical treatment — the 0% veil, full brand
green. So by the time the menu is open, the mark already looks pressed. **Pressing it again to
close produces no visible change at all**, because it was already in the pressed state.

**Fix: the open state must be visually distinct from the pressed state.** Pressing has to
register as a transition regardless of which state the mark is in. **The exact treatment for
"open" is a design choice — bring the owner a rendered comparison rather than picking one.**
Whatever it is, pressing from open must look like something happened.

## 2. There is NO hover state, and a narrow desktop window has a cursor

The filled mark shows below 1024px. Plenty of desktop windows are narrower than that, and they
have a pointer.

This is a settled principle in this codebase — recorded as `B1`, *"Hover works in a narrow
window with a cursor (capability, not width)"* — and the nav rows already implement it with
`[@media(hover:hover)]`. **The avatar was built with `:active` only and never got the hover
half.** That is a gap in UIO-002, not a thread error.

**Fix:** add a hover state gated on `[@media(hover:hover)]`, sitting between rest and pressed
in intensity. Touch devices are unaffected — they have no hover and go straight to `:active`.

## 3. The AVATAR's letter is too small on mobile. The logo mark is fine.

> Owner: *"the size of the letter is good on desktop. on mobile its small and so is the logo
> letters"* — then, refining it: *"the logo can stay as is the fill effect on the button is
> what causes the smaller letter look off."*

**Only `.oh-avatar` changes. `.oh-mono` is correct as it stands.**

**The reason matters and should survive in the CSS comment:** the avatar carries **reversed
type** — cream on a solid green fill — while the logo mark is dark type on transparent.
Reversed type reads optically smaller at the same point size, so the avatar needs more weight
than its neighbour to look like its equal. On desktop it already has it (20px against 17px).
On mobile the shared rule flattens both to one number and the avatar loses that advantage
**precisely where the fill exists.**

```css
/* today — one shared size, so the avatar cannot differ */
@media (max-width: 600px) { .oh-mono, .oh-avatar { width: 38px; height: 38px; font-size: 16px } }
@media (max-width: 400px) { .oh-mono, .oh-avatar { width: 36px; height: 36px; font-size: 15px } }
```

**Split the declaration** so the sizes stay shared and the font sizes do not:

| breakpoint | mark | `.oh-mono` | `.oh-avatar` |
|---|---|---|---|
| default | 42px | 17px — unchanged | 20px — unchanged |
| `max-width: 600px` | 38px | **16px — UNCHANGED** | **19px** |
| `max-width: 400px` | 36px | **15px — UNCHANGED** | **18px** |

**Reasoning, so one dial can be turned rather than the set re-guessed:** the avatar keeps
roughly the ~48%-of-mark ratio it has on desktop, where the owner says it is right. The mark
widths do not change — the complaint is the letter, not the circle.

**Leave the landscape-phone block alone** unless it looks wrong — a genuinely constrained case
(~390px tall), inherited from hard-won work. If the avatar looks undersized there too, raise
it by the same proportion and say so.

## Files

- `src/components/app/app-header.css`

## Do NOT

- Do not change the desktop sizes. The owner said they are right.
- **Do not change `.oh-mono` at any breakpoint.** The owner corrected this explicitly — the
  logo mark stays as it is.
- Do not change the mark widths — the complaint is the letter, not the circle.
- Do not give the desktop `span.oh-avatar` a fill or a hover fill. It stays inert.
- Do not touch `--cs-hdr-h`.

## Verification

Grep `dist/assets/*.css` for the emitted `font-size` in each media block, and for the hover
rule inside its `(hover: hover)` query. **Minified CSS keeps the space after the colon AND
rewrites `rgba()` to 8-digit hex** — grep the property and read what follows.

State the three states' rendered fills and their contrast against the cream letter.
**None of this proves a render** — the owner confirms by eye.
