# UIO-018 — the subheader gets the same gold underline as the nav

**Status:** READY — but see INTERPRETATION below
**Owner request:** *"underline for subheader"* — asked for earlier, **never landed**, and
re-listed by the owner on 2026-08-10 under "things not landed yet, but requested".

## INTERPRETATION — stated so it can be corrected in one line

The owner earlier asked, in the same breath: *"what is the change being made to the mouseover
state of the desktop nav buttons? and what is the change being made to the mouseover state of
the desktop **section header text**?"* — and then specified the nav's new state as *"a gold
underline under the text, only under the text."*

**This order reads "underline for subheader" as: the subheader's interactive text takes the
same gold underline hover treatment that UIO-013 gives the nav.** One hover language across
both surfaces, not two.

If that is not what he meant, this order is wrong and the orchestrator reissues it. **Do not
resolve it differently yourself.**

## Sequencing — this order depends on UIO-013

UIO-013 defines the gold underline: weight, colour, offset, and that it sits **under the text
only**. **Implement UIO-013 first and reuse its exact declaration.** Two hand-tuned underlines
that nearly match is a worse outcome than either one alone.

If UIO-013 has not been implemented when you reach this order, **stop and say so** rather than
inventing the underline here.

## The change

`src/components/app/ContractSubheader.tsx` — the shared button class at lines 72-75 currently
hovers as `hover:bg-green-800/5` (line 240). Replace that hover treatment with UIO-013's gold
underline on the text.

**Desktop only** (`md:` and above), for the same reason as UIO-015: the mobile controls are
full-width touch targets and have no hover state worth speaking of.

## Files
- `src/components/app/ContractSubheader.tsx`

## Do NOT
- Do not change the **selected/active** state — line 239's
  `border-gold-400 bg-gold-50 text-gold-900 shadow-inner` is the owner's *"light gold selected
  state"* and it is already correct. **Only the hover changes.**
- Do not underline the party chip (line 272) or the count pill (line 249) — they are not
  interactive.
- Do not touch the drawer or its resize handle.
- Do not apply this to mobile.

## Verification
Grep the built CSS for the underline rule. Confirm the **selected** state still emits its gold
fill unchanged — a hover rewrite that quietly alters the active state is exactly the kind of
unrequested visual change that has cost this project the most.
