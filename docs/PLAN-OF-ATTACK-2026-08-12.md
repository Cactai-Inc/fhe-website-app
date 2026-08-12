# PLAN OF ATTACK — everything unresolved, in order

**Written 2026-08-12 at `main` = e6add83.** Supersedes every earlier queue list.
**Deliberately excluded (the owner knows them well enough):** BOOKFLOW · INVITELINK ·
PARTYJOURNEY · the Kit Garcin acceptance test.

**The order is not arbitrary.** Items 1–4 are things only the owner can do or that block him
right now. 5–7 make everything after them cheaper or are live customer-facing bugs. 8–14 are the
programme that removes the developer from the loop (**D13**). 15–19 are consolidation. 20–24 are
debt.

---

## THE OWNER'S OWN, AND THINGS BLOCKED ON HIM

**1. Rule: can structure be authored while a contract is `in_review`?**
`ADDITEM` shipped the repair, but **both live leases are `in_review`, so the owner cannot use
Add Item on either without reopening one for editing.** If the answer is "review is exactly when
I add a clause", five RPCs widen in one migration. **This blocks the feature that was just
fixed.**

**2. Walk the Review section and rule on the duplicates.**
`REVIEWNAV` shipped the A/B/C nav; `DUPECENSUS` found **21 duplicate groups**. Every
consolidation below waits on these rulings. Its report ends with the walkthrough order.

**3. Delete the two Beaumont documents from the integrity panel.**
Owner-run by his own choice. They are unsignable until it happens.

**4. Supabase custom domain / TLS.**
`https://fhequestrian.com` has no TLS listener. Also unblocks OAuth consent-screen branding.
Dashboard work, not a thread's.

---

## LIVE BUGS AND FORCE MULTIPLIERS

**5. `TESTDB` — fix the test harness.**
**55 of 64 DB test files fail.** Every database claim this session was hand-verified because of
it. Everything after this is cheaper and safer to trust.

**6. `COUNTFIX` — the five surfaces that disagree about a number.**
From DUPECENSUS Tier 1: inbound work reads **5 / 5 / 12**; "documents attached" is **wrong for
every horse in production**; Lessons shows **318** where **39** exist; a member's document count
is **13** on one page and **5** on another; and the public catalog shows **27 / 24 / 0** — **zero
on `/acquisition`, which is customer-facing.**

**7. `BOOKWRITE` — fix what a booking records.**
**0 of 319 bookings carry a `purchase_id`, `credit_id` or `contract_id`. 0 have an instructor.
0 have a horse. 17 of 39 real bookings have no offering.** This is the root of the order-summary
mess, and the obligations ledger has never once been consumed.

---

## THE D13 PROGRAMME — remove the developer from the loop

**8. `TOKENAUDIT` — describe all 307 tokens.**
**214 have no description.** **59 point at tables that no longer exist.** Duplicate wiring
confirmed. First question: is `source_table` how tokens resolve, or documentation?

**9. `TEXTEDIT` — edit template wording in the UI.**
The biggest D13 violation: **16 migrations have edited lease wording by hand-writing SQL.**
Draft → publish → version, plus the token picker.

**10. `EMAILEXTRACT` — get emails out of the code.**
Every correspondence email is hardcoded in `api/`. They must be extracted before anything can
edit them.

**11. `FORMENGINE` — the form builder.**
Capture and render as **one list, two views**. Unblocks articles and guides — **there is not one
authored written post in the system.** Cheapest of the two engines: the 23 form definitions are
read by nothing.

**12. `DOCENGINE` — the document builder.**
Editor over the existing `contract_*` tables. Signature block lives here and only here.

**13. `CATALOGEDIT` — the catalog and price book.**
`service_types` has never had an editor. Repoint the effective-dated price table at `offerings`,
retire `products`. Per-product image, **no placeholder**.

**14. `NAVCONFIG` — the nav becomes data.**
Under D13, ordering your own menu should not require a developer. Belongs with the re-bucketing
pass, not before it.

---

## CONSOLIDATION — after item 2's rulings

**15. `RECORDS` — Leads · Clients · Partners · Vendors · Horses on one page.**
Splits `DIRECTORY` into `VENDOR` and `PARTNER` (zero rows, free). Team excluded.

**16. `HORSEONE` — three horse surfaces become one.**
**HELD** until item 2. The component-vs-URL choice is provisional.

**17. `OPSHOME` — the two staff landing pages.**
InstructorHome shows **availability slots as lessons** (11 rows where 2 are real), every row
named "Client", and a status chip that always says Scheduled. Plus ADMINSWEEP's held nav diff.

**18. `VIEWERONE` — retire the ops document viewer.**
It offers a sign box the server refuses. Port `DeliveryPanel` onto the one authoring page, flip
the routing line, retire the viewer.

**19. `TEMPLATEFILL` — the empty and flat templates.**
`FACILITY_LICENSE` and `INDEPENDENT_CONTRACTOR` are active and compose nothing. Then the 14 flat
templates, one at a time.

---

## DEBT

**20. `GUARDREST` — the security family.**
29 bare definer guards · the MANAGER/EMPLOYEE RLS gap (goes live the day `mod.employees` gets a
user) · no trigger provisions `profiles` at signup · `anon` holds EXECUTE on three composition
RPCs.

**21. `REQTRIGGER` — `requests_capture_contact` has never linked a request.**
`NEW.contact_id := v_contact` in an **AFTER** trigger does nothing. Every request since
2026-08-02 has a NULL `contact_id`. Two one-off backfills have papered over it.

**22. `MINW0` — 28 horizontal-overflow drivers.**
19 are flex children missing `min-w-0`. FRAMESCROLL found and ranked them; none is fixed.

**23. `UIRECON` — the unmerged `origin/task/uireview` branch.**
Its own reconciliation claims 33 files with no counterpart on main, including
`overscroll-behavior: contain` across 40 scroll containers. **Dated 2026-08-09 — re-verify
against today's main, never merge blind.**

**24. `GLOBALIZATION` — the shared-frame sweep.**
`PageHeader` 1/80 · `PageLayout` 9/80 · **63 of 80 pages hand-roll their own `<h1>`** · **885
arbitrary Tailwind values across 105 files**, each one a place a rule can silently fail to emit.
**Owner ruled: after the spot checks.** The 885-value audit can run early — it finds live bugs,
not tidiness.

---

# SMALL RULINGS OUTSTANDING

- Should a member's "remove" hard-delete the file bytes? (`UPLOADS`)
- ADMINSWEEP **X-2** `/app/ops/horses` · **X-3** `/app/ops/availability` · **X-4** which two
  horse surfaces go
- TITLESWEEP applied the eyebrow pattern to **Orders**, which was not named — keep or revert
- `HORSE_LEASE_STANDARD` is inactive but still titled "— Standard", identical to the live one
- `PageCreateButton`'s five callers — keep the noun ("+ Horse") or standardise
- `{{ORD.UUID}}` resolves to `documents.id` — wrong mapping or wrong name
