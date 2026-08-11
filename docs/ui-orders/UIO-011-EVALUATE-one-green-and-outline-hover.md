# UIO-011 — EVALUATION, not an implementation. Build the comparison, change nothing.

**Owner, 2026-08-10, thinking aloud — two questions he explicitly wants to see rather than
decide on paper:**

> "im curious if we should change the hover state to an outline instead of a fill, it looks
> weird with two buttons filled even with the difference in intensity."

> "the intensity of the selected state for the desktop nav buttons differs from the avatar
> button clicked state, and the overall intensity of the page names and company name and logo
> letters and avatar letter. It might look nice to have them all match... should we try it for
> everything or maybe just try it for large green text in the content area?"

**DO NOT SHIP ANY OF THIS.** Build a page under `docs/reference/`, run it, and let him look.
This is the method that settled the nav colour after numbers failed — *"I can't do anything
with numbers."*

## Question A — outline hover instead of fill

**His complaint is real and structural.** Today hover and selected are the *same kind* of thing
at different strengths — `bg-navfill/64` against `bg-navfill/80`. Two filled rows adjacent
compete, and 64 vs 80 is a narrow gap to carry the whole distinction.

An outline hover separates them **by kind rather than by intensity**: "you are pointing at
this" and "you are on this" stop being the same signal at two volumes. That is more robust than
tuning alpha, and alpha tuning is where this project has already spent real time.

**Render:** a nav column, several rows, one selected, with the cursor state on a neighbour —
fill-hover as it is now, and outline-hover beside it. Same screenshot, both treatments.

## Question B — one green everywhere, or only large content text

**Contrast, computed — this is safe either way, so it is purely an aesthetic call:**

| ink | on page `#faf8f4` | on nav `#fdfcfa` | on header `#f5f0e8` |
|---|---|---|---|
| `green-800 #143321` — today | 12.98 | 13.43 | 12.14 |
| nav-selected `#31523f` — proposed | **8.22** | **8.50** | **7.68** |

Both clear every floor. The proposed green is **2.7× lighter** than brand green.

**The orchestrator's recommendation: try it on large green text in the content area FIRST, not
on everything.** Two reasons:

- **The logo letters are a brand mark, not UI chrome.** Changing their green is a brand
  decision that happens to look like a harmonisation. It should be made deliberately and on its
  own, not as a side effect of matching a nav state.
- **The nav-selected green is a rendered composite** — `navfill` at 80% over a near-white panel
  — designed to be read as a *surface*. Ink and surface have different jobs, and a value tuned
  for one is not automatically right for the other. Large display text is where it is most
  likely to work and least likely to cost legibility.

**Render three columns**, same page content each time:
1. today — brand green everywhere
2. large content text only in `#31523f`, everything else unchanged
3. everything in `#31523f` — page names, company name, logo letters, avatar letter

**Include the logo mark and the avatar in columns 2 and 3** so he can see exactly what changing
the brand mark looks like beside not changing it.

## Carry the badge into this

`UIO-010` closed with **no change** — the owner wanted the badge number to match the nav
surface and it cannot: a cream digit on `gold-500` is 2.23:1 against a 4.5 floor. **That ruled
out the number; it did not resolve what he noticed about the badge.**

Owner: *"its not the best option its the legally acceptable one."*

**Include the badge in every column of this evaluation.** It is the one element whose fix must
come from somewhere other than itself — the gold, the size, the shape, the position — and this
is the only pass where those are in scope.

## Files

`docs/reference/` only. **Nothing in `src/`.**

## Reporting

Tell him what you built and where to run it. **Recommend nothing beyond what is written here** —
he asked to see it, not to be argued into an answer.
