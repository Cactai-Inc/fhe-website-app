# TASK REQTRIGGER — report

**Branch:** `task/reqtrigger` · **Worktree:** `wt-reqtrigger` · **Base:** `origin/main` @ `0567935`
**Applied to production** (`lrstswfxfsezdmvkvukc`): dry-run first, raw output below.
**Committed:** `ab283cb` on `task/reqtrigger`. Not pushed.

---

## Outcome in one line

`requests_capture_contact_trg` now actually links new requests to their matching contact.
LEADCLEAN's diagnosis was correct and its repair worked as designed; applied verbatim,
verified live, no other instance of the pattern exists anywhere else in the schema.

---

## 1. The defect, confirmed

```
tgname                        | timing | def
requests_capture_contact_trg  | AFTER  | AFTER INSERT ON requests FOR EACH ROW EXECUTE FUNCTION requests_capture_contact()
requests_normalise_phone_trg  | BEFORE | BEFORE INSERT OR UPDATE OF contact_phone ... normalise_phone_columns('contact_phone')
```

`requests_capture_contact()`'s last statement before the fix: `NEW.contact_id := v_contact;`
— discarded, because the trigger is `AFTER`. Its own comment (`ITEM 2: keep the link. Both
paths … persist the id.`) was wrong; verified against the running function body via
`pg_get_functiondef`, not assumed from the migration source.

Live evidence, checked before touching anything:

```
post_2026-08-02 | total | linked | unlinked
f               |     9 |      9 |        0
t               |     4 |      2 |        2   -- Kit Garcin (excluded on purpose) + Kylie Pinion
```

Kylie Pinion (`8f0dc795-…`, created 2026-08-12 14:47, after LEADCLEAN's backfill) is the
**third** unlinked row the task doc predicted. It is left NULL, per the "do not backfill"
instruction — see §4.

## 2. The repair — applied as specified

```sql
UPDATE requests SET contact_id = v_contact
 WHERE id = NEW.id AND contact_id IS NULL;
```

replacing the discarded `NEW` assignment, trigger kept `AFTER`. File:
`supabase/migrations/20260812T1750_reqtrigger_persist_contact_link.sql`. Nothing else in the
function changed — same matching query, same contact-creation branch, same comments except
the one describing the fixed line.

**Both warnings in the brief verified true, independently, before applying:**

- **Timing.** Confirmed via `pg_trigger`/`tgtype` above — the function itself never declared
  `AFTER`/`BEFORE`; that's a property of the `CREATE TRIGGER` statement, untouched by this
  migration.
- **Name ordering hazard.** `requests_capture_contact_trg` sorts before
  `requests_normalise_phone_trg` (`'c' < 'n'`). Confirmed empirically, not just by string
  comparison: inserted a request with unnormalised phone `555.987.6543`, `org_id` only (no
  matching contact, so the function's `INSERT INTO contacts` branch runs and copies
  `NEW.contact_phone` into the new contact). Result — both the request row and the new
  contact ended up with `(555) 987-6543`, proving `requests_normalise_phone_trg` (`BEFORE`)
  ran and normalised the column before `requests_capture_contact` (`AFTER`) read it. Had the
  trigger been moved to `BEFORE`, its name would put it ahead of the phone-normaliser and it
  would have captured the raw string.
- **No re-entrancy.** The `UPDATE` touches only `contact_id`. `requests_normalise_phone_trg`
  is `... OR UPDATE OF contact_phone` — it does not fire on this UPDATE. Confirmed by the
  trigger definition, not inferred.

## 3. Sweep — is the pattern anywhere else?

Every `AFTER` (row-level, non-`INSTEAD OF`) trigger in `public` — 57 triggers, 28 distinct
functions — pulled via `pg_get_functiondef` and grepped for `NEW.<col> :=` and
`NEW.<col> = <expr>` assignment forms (not comparisons).

**Result: `requests_capture_contact` was the only hit.** No second instance exists today.
The rest of the `AFTER` population is dominated by `audit_row_change` (generic audit, reads
`NEW`/`OLD`, never assigns to `NEW`) and functions doing real work through explicit
`UPDATE`/`INSERT` against other tables — none of them mutate `NEW` post-hoc.

## 4. Kit Garcin — untouched, proven

Baseline captured before the migration ran, full row hash:

```
row_hash: 4316cc2d3285f511c2a8479023ce4f89
id=609d45cf-…  status=new  contact_id=NULL  created_at=2026-08-09 17:53:06.621926+00
```

Same query after the migration was applied to production: **identical hash,
`4316cc2d3285f511c2a8479023ce4f89`.** Expected — the fix only runs on `INSERT`, and her row's
insert happened three days before this migration existed; editing the function body cannot
retroactively re-fire a past trigger invocation. `contact_id` is still `NULL`.

No backfill was run. Re-checked all four post-2026-08-02 rows immediately after applying:
Marissa and Emmy remain linked (LEADCLEAN's prior backfill, unchanged by this migration);
Kit Garcin and Kylie Pinion remain `NULL`. This migration changes only what happens on the
**next** insert.

## 5. Live proof the fix works

Inserted a real (non-transactional) request matching an existing, unambiguous contact —
`admin@cactai.io` / "CACTAI INC." (`TEAM` contact, pre-existing, unrelated to this task) —
then re-selected the row in a separate statement:

```
id=961394af-…  contact_email=admin@cactai.io  contact_id=8795c065-d153-44cc-8a81-758b94d2f5ce
```

Linked correctly. **Deleted this proof row immediately after** (`DELETE ... RETURNING id` →
1 row) — it was synthetic verification data I created and removed in the same session, not
an existing record, so it is not covered by the "nothing is purged" rule for real accounts.

**A methodology note worth keeping:** the first attempt at this proof used `INSERT ...
RETURNING contact_id` and showed `NULL`, which looked like the fix had failed. It hadn't —
`RETURNING` on the `INSERT` statement reflects the row as of that statement, before the
`AFTER` trigger's separate `UPDATE` lands. A second, independent `SELECT` after the insert
is required to observe an `AFTER` trigger's side effects. Re-ran and confirmed linkage that
way for every case below.

## 6. Test items from the brief

1. **New request with a matching contact → `contact_id` populated.** Proven live in §5, and
   in dry-run against a different contact (`audreyslater702@gmail.com` → matched existing
   contact `7a603cc1-…`).
2. **Ambiguous or absent match → NULL, not wrongly linked.** Verified, with a correction to
   the brief's framing: **`requests_capture_contact` has no branch that produces `NULL` for
   an ambiguous match** — it was never in scope of this fix and I did not add one. When
   `contact_email` resolves (which it always will; `requests_email_format` CHECK forbids a
   blank/invalid email at the row level, so "absent" isn't reachable via a valid insert
   either), the function picks the oldest-created matching contact
   (`ORDER BY created_at LIMIT 1`) or creates one — same as before this migration. Tested
   against a real duplicate in prod (`hello@fhequestrian.com`, 2 live contacts): the request
   linked to the older of the two, matching `(array_agg(id ORDER BY created_at))[1]`. This is
   **pre-existing, unchanged matching behavior** — my fix only changes whether the resolved
   value gets *persisted*, per the "change nothing else" constraint. Flagging the gap between
   the brief's wording and the code rather than inventing an ambiguity branch that wasn't
   asked for.
3. **`contact_phone` normalised exactly as before.** Proven in §2 — new contact created from
   an unnormalised phone got the normalised value.
4. **Kit Garcin byte-identical before/after.** Proven in §4 via full-row MD5.
5. **No existing row backfilled.** Proven in §4 — all four post-2026-08-02 rows re-checked
   post-apply; only pre-existing links present, both NULLs (Kit Garcin, Kylie Pinion) intact.
6. **Other `AFTER`-assigns-to-`NEW` instances reported.** §3 — none found.

## 7. Verified with my own eyes vs. assumed

**Verified by running it, against production or a `BEGIN…ROLLBACK` dry-run of the exact
committed migration file:**
- Trigger timing and name-ordering, both by direct `pg_trigger` query.
- The defect itself, by dumping the live function body.
- The phone-normalisation ordering claim, empirically (not just from name comparison).
- Zero other `AFTER`+`NEW`-assignment functions, by scanning all 28 distinct functions.
- Kit Garcin's full-row hash, before and after, on production.
- Linkage on match (existing contact, dry-run and live), on ambiguous match (dry-run,
  real duplicate data), and non-backfill of the two pre-existing NULLs (production).
- Migration committed on `task/reqtrigger` (`ab283cb`), not pushed.

**Assumed, not verified:**
- No application code path reads `requests.contact_id` expecting the old (broken) semantics
  — I did not grep the frontend/API for consumers. The column exists specifically so
  provisioning can follow a real FK (per the function's own comment), and this fix only makes
  it start actually being populated going forward; I did not audit every reader.
- Whether Kylie Pinion and any future NULL rows should eventually be resolved by a future
  LEADCLEAN-style backfill is explicitly out of scope here — not attempted, per instruction.
