# ADMIN-IA-REVISION — Claire's daily surface

Revises ADMIN-IA.md §1 (zone model) and the Lessons disposition in §5, for Claire's daily-use
experience specifically. Horses, Documents, Deals, Money, Boarding, Barn Ops, and Employees stay
exactly as ADMIN-IA.md §5 already has them — see §4. The Admin zone is untouched.

## 1. Claire's three doors

Dashboard, Calendar+People, and Community sit outside the regular nav menu, not inside it — see
§4. Dashboard is the sorted front door, not a fourth stop competing with the other two —
every row on it links straight into the calendar item or person record it's about. Calendar and
People live on one page rather than two separate rail rows: the calendar as a dedicated view at
the top, the people list below it in the same scroll. Both doors are built out fully. A
create-booking action started from the People side and handed off into the calendar's own
create flow is not the duplication §2 exists to prevent — it's the same link-to-the-other
mechanism running in the other direction.

## 2. The hard split, and what each side owns

Calendar side: doing the lesson. Today's plan, mark done, write it up after — where she prepares
for and works through what's actually happening that day.

Person side: managing the relationship. What's scheduled with this rider, payment status,
documents, full history, and — for a completed lesson — an overview of what was done.

Each links to the other rather than duplicating fields. This is a harder split than "some of the
same things from both": the calendar isn't a second place to manage payment status, and the
person page isn't a second place to build out a lesson plan.

## 3. Lessons folds away as a standalone surface

No top-level Lessons page. Lesson plans and lesson notes — the content of an individual lesson,
added and edited ahead of it and written up once it's done — live on their own page, opened from
wherever the lesson is: from Calendar for the day's lessons, from a rider's Person page for that
rider's lesson history. Calendar and Person between them cover the navigability a dedicated
Lessons page would have provided; a third door to the same rooms isn't needed. This retires the
standalone Lessons rail entry and its Sessions/Plans tabs from ADMIN-IA.md §5. Credits and
Packages, the other two tabs on that surface, weren't part of this discussion — where they land
is still open, not decided here.

## 4. Resolved — the nav menu stays, the three doors sit outside it

Horses, Documents, Deals, Money, Boarding, Barn Ops, and Employees are still needed as their own
pages, unchanged from ADMIN-IA.md §5 — that list is the nav menu. What's new is Dashboard,
Calendar+People, and Community: because she's in those constantly, they don't make her open the
menu at all — they get their own dedicated, novel access outside it. The specific mechanism
(persistent buttons, a tab bar, something else) isn't designed yet; what's settled is that it's
separate from the menu, not a fourth-through-sixth row added to it.

## 5. Calendar item — display and behavior

Title on mobile: person's name only. Larger view: name plus what it is — "Melissa," or "Melissa
— Riding Lesson." Inside the opened item, the person's name is a clickable link to their Person
page. Both the booking item and the separate lesson-content page (§3) open as a full-size modal,
not a side panel, on mobile and desktop alike — a panel pulls her attention to an edge of the
screen she wasn't looking at, where a centered full modal opens right where her attention
already is, whether she clicked a time slot or a lesson from someone's history. Lock behavior on
saved items — whether editing the title or assigned person should require an explicit unlock
once a booking is saved — came up and is deliberately left out of this spec. Good question, not
answered yet.

## 6. Community

Post and view are Claire's two primary actions on the Community feed itself. Compose adds a
third state to content_posts beyond draft and published: review. Draft is anything not yet
ready — written directly in Compose, or pasted in after being prepared elsewhere; nothing about
how a draft gets written is a distinct path in the tool, it's just text in an editor either way.
Review is the middle ground, and the piece that was missing from ADMIN-IA.md §4's draft/publish
description: when the person preparing a piece isn't the one who'll publish it, submitting it
moves it out of draft into a state Claire can see as its own thing — pending her review —
distinct from everything still being worked on and everything already live. She reviews from
there and publishes when it's ready. Moderation stays a separate surface, not merged into this —
left exactly where ADMIN-IA.md §5 already has it for now, whether she gets access to it later is
an open call for another day, not this one.
