# TASK-DASHFEED — the dashboard clusters by what it ASKS of you, not by what it is ABOUT

**Owner, 2026-08-26.** Verbatim, because the complaint is the requirement:

> *"the dashboard is built rather poorly to be honest, its much better than the shitstain we had
> before but it still sucks major bags of dicks. Dedicated zones for duplicate data to be shown,
> useless information, meaningless values strewn about. I need to see what is going on today, this
> month, and this year, what needs attention from me, what is waiting on someone else, what are the
> real numbers for the things that matter. if i get a message from someone does it show up in my
> dashboard? a header icon with unread indicator would be great. The alert bell is useless since
> notifications surface inside the dashboard. But messages either should, or shouldnt, but not
> halfway with just a notification, if the dashboard is going to do something like tell me i have a
> message, it better damn well show me the fucking message and i can click on it to respond without
> leaving the notification. on send i can close or pin the notification. so things like the contracts
> & deals section as a dedicated place for something to be, it completely contradicts my stated goal
> of not needing to look at a specific place for a specific thing. i need to see a feed of sorts that
> paints a picture of things and these can be a full grid or zones, i dont care but nothing should be
> so unique as to have a title for the section. notifications that are shown in different areas so
> they are adjacent to relevant associated content, or shown in clusters based on whether i can take
> action or im waiting for someone else to do something, or if its a time based notification like
> telling me the day's schedule, the sales and payments that have come on, and the new bookings... we
> need to pick a direction and refactor for it."*

---

## 1. THE MEASURED COMPLAINT — every charge is true

| His charge | Measured, 2026-08-26 |
|---|---|
| *"dedicated zones for duplicate data"* | ⚠️ **17 zones across two views, and the two views restate each other.** `C3 "Money waiting"` and `B1 "Money that has not landed"` are the same fact under two names. |
| *"the alert bell is useless since notifications surface inside the dashboard"* | ⚠️ **LITERALLY THE SAME ROWS.** `my_unread_count` is `SELECT count(*) FROM notifications WHERE user_id = auth.uid() AND read_at IS NULL` — exactly what zone `N1` now renders. **The bell is a second view of one dataset, not a second dataset.** |
| *"meaningless values strewn about"* | Zone `B6` is titled ***"What the app has been doing"***. That is a title with no reader in mind. |
| *"a dedicated place for something to be… contradicts my stated goal"* | `B3 "Deals & contracts"`, `C9 "Documents & onboarding"`, `B8 "Catalog & tenant setup"` — **subjects, not asks.** |

### ⚠️ AND THE ANSWER TO HIS QUESTION: NO, AND NOBODY HAS EVER SENT ONE
> *"if i get a message from someone does it show up in my dashboard?"*

**No.** And the reason is larger than the dashboard: **every messaging table is EMPTY.**

`direct_messages` **0** · `channel_messages` **0** · `threads` **0** · `thread_posts` **0** ·
`contract_note_messages` **0**

⚠️ **Messaging is built and has never been used once.** So "does a message reach the dashboard" is
not a wiring question — **it is a question about whether messaging should exist at all**, and it must
be answered before anything surfaces it. **Building an inline reply for a system with zero messages
is building the ninth entry in `docs/ORCHESTRATOR.md` §3b.**

## 2. 🔒 THE DIRECTION — CLUSTER BY THE ASK, NOT THE SUBJECT

**This is the pick.** It is the only reading that resolves his contradiction rather than restating it,
and **it is his own sentence**: *"clusters based on whether i can take action or im waiting for
someone else to do something, or if its a time based notification."*

**A subject-titled zone forces the question "where do I look for X?" — which is the thing he says he
does not want to have to ask.** Clustering by the ask removes the question: **there are only three
places anything can be, and which one it is in is a fact about you, not about it.**

| Cluster | What is in it | The test |
|---|---|---|
| ⚠️ **YOURS** | you can act **now**, without anyone else | *"If I do nothing, does this stay undone?"* |
| ⚠️ **THEIRS** | waiting on somebody else | *"Is the next move someone else's?"* |
| ⚠️ **TODAY** | time-based and informational — the day's schedule, payments that landed, new bookings | *"Is this news rather than a task?"* |

**A thing MOVES between clusters as its state changes; it does not live anywhere.** A lease out for
signature sits in **THEIRS**; the moment it comes back it is in **YOURS**. ⚠️ **THIS ALREADY HAS A
WORKING PRECEDENT** — `TASK-CONTRACTOPTIONS` made the Deals & Contracts zone earn its row only when
the deal wants something the document is not already saying, using `deal_completion_state`. **That is
this rule applied to one zone. This task applies it to all of them.**

**THE NUMBERS ARE NOT A ZONE.** *"today, this month, and this year… the real numbers for the things
that matter"* is **one always-present strip**, not a card competing with the clusters. ⚠️ **A number
that cannot finish the sentence "…so I should ___" does not go on it.**

## 3. 🔒 THE HALF-MEASURE RULE — HIS SHARPEST POINT, AND IT GENERALISES

> *"if the dashboard is going to do something like tell me i have a message, it better damn well show
> me the fucking message and i can click on it to respond without leaving the notification."*

⚠️ **THIS IS NOT ABOUT MESSAGES. IT IS THE ACCEPTANCE TEST FOR EVERY ITEM ON THE BOARD:**
**an item that ANNOUNCES a thing must CARRY that thing and the act it invites.** A row that says
"you have X" and then sends you somewhere else to deal with X has spent the reader's attention and
given nothing back.

**So every YOURS item is a complete unit of work**: the content, the control, and — his words —
**on send, close or pin.** ⚠️ **`CR-74` already ruled this** (*"a modal CAN be the work"*); this
extends it from modals to the board itself. **Build it as one pattern, not two.**

**Pin is a real requirement, not a nicety:** it is how something stays visible after it stops
qualifying for a cluster.

## 4. 🔒 THE BELL RETIRES

It counts the rows the board already shows. ⚠️ **Two counters over one dataset is how a person learns
to trust neither.** The header icon he asked for is for **messages**, which the board does *not*
carry — **a header indicator is for what is NOT on the page.**

⚠️ **BUT IT IS BLOCKED ON §1'S FINDING.** With zero messages ever sent, **do not build a message
indicator before the owner rules on whether messaging survives at all.** Ask; do not assume.

## 5. WHAT TO BUILD

1. **Retire the two VIEWS.** Trainer/business is a second axis on top of clusters and it is where the
   duplication comes from. ⚠️ **Confirm with the owner** — the toggle was iterated with him twice
   (`HANDOFF-ORCH4`), so it is a deliberate thing being undone.
2. **One registry, three clusters**, each item declaring its cluster from its own state — not a
   hardcoded home. `src/lib/dashboard/registry.ts` is the right spine; **the zone LIST changes, the
   mechanism does not.**
3. **Kill the section titles.** A cluster has a heading. An item carries its own subject.
4. **The numbers strip** — today / month / year, and nothing that fails the "…so I should ___" test.
5. **Every YOURS item carries its act inline**, with close-or-pin.
6. **Retire the bell.**

## 6. ⚠️ OPEN, AND THE OWNER'S TO ANSWER

1. ⚠️ **Does messaging survive?** Zero rows, five tables. **Surface it, or retire it — the one thing
   it cannot stay is half-built**, which is the state he is objecting to.
2. **Do the two views go?** §5.1.
3. **Which numbers matter?** *"the real numbers for the things that matter"* names a test, not a list.
   ⚠️ **Do not guess this** — a wrong number on an always-visible strip is worse than no strip.

## THE REACH
`/app/dashboard`, the surface he already lands on. **No new route. Nothing moves.**

## THE TELL
Nothing on the board has a subject for a title. A lease awaiting signature appears **once**, under
**THEIRS**; when it comes back it appears **once**, under **YOURS** — and it can be signed from there.
