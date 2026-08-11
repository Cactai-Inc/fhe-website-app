# UIO-012 — the community pages get a group, Dashboard moves, and the heading hover is invisible

**Owner confirmed:** 2026-08-10 · **Status:** PARTLY BLOCKED — item 2 needs an answer first.

> "the section headers that can be clicked to collapse, there isnt one for the community app
> pages (the first 5), the dashboard and inbound are largely serving the same purpose so we
> should merge those and move dashboard into management and drop it from the community pages.
> then give the community pages their own header 'app pages' is fine. and then the text on
> mouseover is very light its hard to read, it should be darker than the resting state?"

---

## 1. The community pages get a collapsible group — READY

The first five items sit above `MANAGEMENT` with no heading, so they are the only group in the
nav that cannot be collapsed. **Give them one, labelled `App pages`**, using the identical
component and behaviour as `Management` and `People` — same chevron, same toggle, same
persistence.

## 2. Merge Dashboard and Inbound, move it to Management — BLOCKED, ASK FIRST

The owner: *"the dashboard and inbound are largely serving the same purpose so we should merge
those and move dashboard into management and drop it from the community pages."*

**Two readings, and they are very different jobs:**

- **Nav consolidation.** One entry under Management pointing at one of the existing pages; the
  other route stays reachable but unlisted. Small, reversible.
- **Page merge.** The two pages actually become one — their content combined into a single
  surface. Substantial, and it decides what happens to the two badge counts currently on
  Dashboard (7) and Inbound (7).

**ASK WHICH. DO NOT PICK.** If it is the page merge, that is its own task and this order carries
only the nav half.

**Either way, note:** removal here means removed from view, not deleted — the standing rule from
commit `86a2c33`. Keep the route building and one boolean from returning.

## 3. The heading hover is invisible. Measured — READY

`AppLayout.tsx:1295` — the group heading button:

```
${NAV_HEADING} ... hover:text-cream-100
```

where `NAV_HEADING = 'text-green-900/55'` (`:75`). Against the near-white panel `#fdfcfa`:

| state | renders | contrast | |
|---|---|---|---|
| rest | `#79847e` | **3.78** | already below the 4.5 floor |
| **hover** | `#f5f0e8` | **1.11** | **effectively invisible** |

**Nobody chose this.** It was written when the nav panel was GREEN, where cream-on-green reads
fine. When the panel became near-white the ROW hover was updated — it gained `bg-navfill/64`,
so its cream text sits on a dark fill at 4.55:1. **The heading hover never got that update:**
it kept the cream text and has no fill at all. Same family as trap T5 — a leftover from the
green-panel era.

**Fix: hover goes DARKER, not lighter.** The owner's instinct is correct — on a light panel,
emphasis is darker.

```
green-900 full  #0d2118   16.41
green-800       #143321   13.43
green-900/80    #3d4d45    8.73
```

**Use `green-900` at full strength on hover.** A heading is 10px uppercase semibold — small,
tracked text needs the headroom, and the jump from a quiet rest state to a definite hover is
the point.

**Also raise the REST state.** At 3.78 it fails the floor before anyone hovers. Take
`NAV_HEADING` to **`text-green-900/70`** — still visibly quieter than the row labels, above the
floor. **State the rendered contrast you land on.**

**Do not add a fill to the heading.** It is a label, not a row; the rows own the fill language.

## Files

- `src/components/app/AppLayout.tsx`

## Do NOT

- Do not change the row hover or selected states. They are correct and the owner said so.
- Do not delete the Dashboard route. Hidden, not deleted.
- Do not restyle the chevron — UIO-008 is not about this one, and this one already points the
  right way.

## Verification

Grep `dist/assets/*.css` for the emitted heading colours at rest and hover. State both rendered
contrasts against `#fdfcfa`.

Confirm the new group collapses and persists exactly as `Management` does, and that its state
survives a reload if the others do.
