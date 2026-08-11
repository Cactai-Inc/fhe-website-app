# UIO-012 — the community pages get a group, Dashboard moves, and the heading hover is invisible

**Owner confirmed:** 2026-08-10 · **Status:** READY — item 2 answered; one badge question inside it.

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

## 2. Inbound goes away. Dashboard moves to where it always belonged — ANSWERED, READY

> Owner, 2026-08-10: *"one nav entry under management and it uses the dashboard layout and the
> leads are shown as dashboard entries."* … *"inbound goes away. its my mangament dashboard
> which right now is showing up in the community app section."*

**Frame it as he does — this is not two things being merged.** The Dashboard **is** his
management dashboard and has been filed in the wrong group. Inbound was a second surface doing
part of the same job. So: **remove the duplicate, move the original to where it belongs.**

That framing decides the ambiguous cases. When Inbound's behaviour and the Dashboard's differ,
**the Dashboard is not compromising with a peer — it is absorbing a surface that should not
have existed separately.**

- **One nav entry, under `MANAGEMENT`.**
- **The Dashboard layout wins.** Inbound's table view does not survive.
- **The leads render as dashboard entries** inside that layout — the booking requests and
  support items become entries, not a separate list page.
- **Dashboard leaves the community group** (see item 1 — the group it leaves is `App pages`).

### THE BADGE — the two counts are DIFFERENT SOURCES. Verified.

They both read 7 today and that is a coincidence:

| | source | what it counts |
|---|---|---|
| Dashboard | `myUnreadCount()` (`:81`) | unread **notifications** |
| Inbound | `inboundOpenCount()` (`:95`) | open **requests + support** |

One is *addressed to you*; the other is *waiting to be picked up*. **The merged entry cannot
carry both badges, so this needs a decision the two-entry version never required.**

**Because Inbound goes away entirely, its count has nowhere else to live.** If the Dashboard
badge does not absorb it, **open leads lose their only at-a-glance signal** — they would be
visible as entries in the body but invisible from the nav, which is a regression against
today.

**So the badge sums both sources.** `myUnreadCount()` + `inboundOpenCount()`.

**Confirm with the owner before shipping** — it is one line either way and he may prefer the
badge to stay a purely personal signal. But do not simply drop the inbound count: that is the
one option that loses information the nav currently carries.

### CORRECTED 2026-08-10 — the orchestrator misread the merge direction

The orchestrator saw `IntakePage.tsx` at 870 lines against `DashboardHome.tsx` at 46 and
concluded Inbound was the substantial surface that ought to absorb the Dashboard. **That was
wrong — it read line count as purpose.**

> Owner: *"I said dashboard is retained and moved. inbound is merged to show up as entries on
> the dashboard and the inbound page is removed we dont need a dedicated page just for alerts,
> the entry lives in leads as a contact record, it gets promoted or it stays there until its
> promoted or deleted… the inbound served only one purpose and that is to alert me to a form
> submission."*

**Inbound's purpose is narrow: tell him a form arrived.** The lead itself belongs in **Leads, as
a contact record**, where it is promoted or waits until promoted or deleted. Later, the campaign
pipeline will move leads through stages the way clients move now.

**So the direction is as originally stated. Dashboard is retained and moved; Inbound is
dissolved.** Its alerts become dashboard entries; its lead data belongs in Leads.

**The nav/content split still stands** — 870 lines of staff tooling is not a nav-menu change,
and `IntakePage.tsx` is not in this order's Files list. Do the nav half here; the content merge
is its own order.

### Removal means hidden, not deleted

The standing rule from commit `86a2c33`: whichever route stops being listed keeps building and
stays one boolean from returning. **Do not delete either page.**

## 2b. A divider below "Add New" — READY

> Owner: *"worth adding to the dashboard nav is an outline below the add new button so its
> clearly separated as not part of the community app pages."*

**"Add New" is a control, not a page**, but it currently sits flush above the page list with
nothing marking the difference. It reads as the first item in the group.

**Use the existing divider language — do not invent a treatment.** `NAV_DIVIDER`
(`AppLayout.tsx:76`, `border-green-900/12`) is already used three ways in this file:

```
:755   NavFooter          mt-2 pt-3 pb-2 border-t
:1302  collapsed group    my-1 border-t          role="separator"
:1426  mobile section     mt-2 border-t pt-2
```

Follow `:1302`'s shape — `border-t` with `role="separator"` — with spacing that matches the
rail's rhythm rather than a new value.

**It also does a second job.** Once the `App pages` heading exists (item 1), the divider is
what keeps "Add New" outside that group rather than reading as its first entry.

**Applies to both rails**, client and staff, wherever the create control sits above the list.

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
- Do not delete either route. Hidden behind a boolean, not deleted.
- Do not keep Inbound's table layout. The Dashboard layout wins — the owner said so.
- Do not restyle the chevron — UIO-008 is not about this one, and this one already points the
  right way.

## Verification

Grep `dist/assets/*.css` for the emitted heading colours at rest and hover. State both rendered
contrasts against `#fdfcfa`.

Confirm the new group collapses and persists exactly as `Management` does, and that its state
survives a reload if the others do.
