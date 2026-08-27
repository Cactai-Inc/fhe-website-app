# TASK-ORIGIN — the three things he must be able to log before he reviews every account

⚠️ **THIS IS THE CRITICAL-PATH ITEM IN THE HANDOFF. BUILD IT FIRST — AHEAD OF T3.**

**Owner, 2026-08-26:**
> *"before i review every client's account i need the surfaces to be there for me to log where they
> found us, how they contacted us, and what they bought (when the system doesnt already know these
> things)…"*

And, earlier the same day:
> *"I know want to see where people come from before they hit the website, and i need a way to add
> info to every client record to indicate (from a constrained list of options) where they
> originated/how they found us… we need to see real data about these things to know whats working,
> what we can invest in to get more out of, and what isnt firing or working so we can investigate it."*

⚠️ **THE SCHEDULING FACT THAT MAKES THIS URGENT:** he is about to sit down and go through **every
client account by hand**. **If the fields do not exist when he starts, he enters everything twice.**
That is the entire reason this jumps the queue.

---

## 1. THE THREE THINGS — they are not one field

| | What he is logging | Why it is separate |
|---|---|---|
| **ORIGIN** | *where they found us* | Instagram, a friend, a sign, a Google search. **The marketing question.** |
| **CHANNEL** | *how they contacted us* | the website form, a phone call, in person at the barn, a DM. **The operations question.** |
| **PURCHASE** | *what they bought*, **when the system does not already know** | A historic sale that predates the app, or one taken in cash and never entered |

⚠️ **ORIGIN AND CHANNEL ARE NOT THE SAME QUESTION AND MUST NOT SHARE A FIELD.** "Instagram" is an
origin; "phoned us" is a channel; **the same person can be both**, and collapsing them destroys
exactly the analysis he is asking for — *"what we can invest in to get more out of"* is an ORIGIN
question, *"what isnt firing"* is a CHANNEL one.

## 2. ⚠️ WHAT EXISTS — AND THE TRAP IN IT

**`clients.source` ALREADY EXISTS**, and it is **not** what he is asking for:

| Value | Rows |
|---|---|
| `VISITOR_RELEASE` | 11 |
| `provisioned invitation` | 8 |
| `BOOKLINK backfill` | 1 |
| `staff created` | 1 |

⚠️ **THAT COLUMN RECORDS WHICH CODE PATH CREATED THE ROW — not where the human came from.** It is
free text with **no CHECK and no lookup**, and it mixes SCREAMING_CASE machine tokens with prose.
**Do not repurpose it. Do not extend it. Leave it exactly where it is** — it is a provenance trail
for the engineers and something reads it.

⚠️ **AND DO NOT ADD A THIRD FREE-TEXT COLUMN BESIDE IT.** *"from a constrained list of options"* is
the owner's own wording, and a free-text origin field produces "instagram", "Instagram", "IG" and
"insta" inside a month, which cannot be counted — which defeats the entire purpose.

## 3. THE BUILD

### §1 — TWO VOCABULARIES, IN `lookup_options`
⚠️ **`lookup_options` IS THE RIGHT HOME, NOT A CHECK CONSTRAINT AND NOT A HARDCODED ARRAY.** It is
already the editable-menu spine, it already carries `active`, and the menus editor already surfaces
it. **D13: he must be able to add "saw the trailer at a show" without a thread.** A CHECK constraint
would need a migration for every new option — that is the pattern D13 exists to stop.

Two keys: **`client_origin`** and **`contact_channel`**. **Seed them with his real answers, not
guesses — ⚠️ ASK HIM FOR THE STARTING LISTS.** A wrong seed list is worse than an empty one, because
he will pick the nearest wrong option rather than stopping to correct it.

### §2 — TWO FIELDS ON THE PERSON, SET LATE AS WELL AS EARLY
On `contacts`, **not** `clients` — ⚠️ **a LEAD has an origin too, and that is the most valuable one to
capture.** A person who never becomes a client is exactly the data point that tells him what is not
working.

- **Settable at intake** *(the website form and the staff provisioning form)*, and
- ⚠️ **editable afterwards, on the record, forever** — because he is backfilling by hand and most of
  these people already exist.

### §3 — RECORD A PURCHASE THE SYSTEM DOES NOT KNOW ABOUT
⚠️ **CHECK WHAT ALREADY EXISTS BEFORE BUILDING.** `grant_lesson_credit(p_client_id, p_offering_id,
p_quantity, p_mode, p_reason, p_payment_method)` already supports modes `handwrite` / `comp` / `bill`
and already records a payment method — **it may already be most of this.** And as of 2026-08-26
`mark_purchase_paid` honours a partial amount, so a historic order can be settled the way it actually
was, including a split.

**What is genuinely likely to be missing is a DATE.** ⚠️ **A backfilled purchase entered today with
today's timestamp is worse than no record — it will corrupt every "this month" and "this year" number
on the dashboard he is about to specify.** **It must be possible to say when it actually happened.**

### §4 — ⚠️ THREE ALLOWLISTS STAND BETWEEN §1/§2 AND A WORKING MENU

**Measured against production 2026-08-26 (ORCH5). All three are real, and the first one is the one
that would ship a half-editable menu and look finished.**

**T1 — `add_lookup_value` REFUSES ANY KEY OUTSIDE A HARDCODED FIVE.** The Menus page's
*Add a value…* control calls it, and its body reads:

```
IF v_key NOT IN ('horse_breeds', 'horse_colors', 'horse_markings',
                 'horse_registration_org', 'horse_passport_country') THEN
  RAISE EXCEPTION 'lookup % is not open to additions from a form', v_key;
```

⚠️ **So seeding `client_origin` and `contact_channel` and stopping there gives him menus he can
rename and switch off but CANNOT ADD TO** — which is precisely the D13 failure §1 is written to
avoid. **Widen it by adding the two keys. Do NOT replace the guard with "any key"** — it is reachable
from a public-facing form path, and an open namespace lets a form invent vocabularies.
⚠️ **Prove it by actually inserting** in `BEGIN; … ROLLBACK;` and pasting the returned JSON and the
row count. **Proving it did not raise proves nothing.**

**T2 — `update_contact_record` HAS ITS OWN COLUMN ALLOWLIST** (`v_allowed`) and raises
`'field % is not editable here'` for anything absent from it. The two new columns must be added, or
§2's "editable afterwards, forever" silently cannot save. **It raises rather than no-ops, which is
the only mercy here.** Keep the guard working: it must still refuse a genuinely unknown key.

**The read side needs nothing** — `contact_dossier` returns `to_jsonb(c)` for the whole row, so a new
column reaches the UI on its own. **Verify that rather than assuming it.**

**T3 — `menu_inventory()` WILL LABEL BOTH NEW MENUS AS HORSE MENUS.** It auto-discovers every
`lookup_options` key (`GROUP BY lo.lookup_key` — which is why §1's keys appear in the editor with no
UI work), but its `used_by` is the hardcoded string `'Horse intake · contracts'` for all of them.
**Fix with a minimal `CASE` so each new key states where it is really used. Do not restructure it.**

⚠️ **`set_menu_value` is already generic** and falls through to `lookup_options` for any key, so
rename and on/off need no change. **That asymmetry is exactly why T1 is easy to miss.**

⚠️ **`menu_inventory` and `add_lookup_value` are DATABASE functions, and `TASK-SURFACEEDITOR` is
live in `wt-surfaceeditor` reworking the menus surface.** A function-body collision does not appear
in a git diff. **Name both changes at the top of your report** so the merge can be checked, and
**do not open `AdminMenusPage.tsx`, `src/lib/pageRegistry.ts` or `src/App.tsx` — that thread owns
all three.**

## 4. ⚠️ FLAGGED BEFORE STARTING

- **Ask for the two starting lists.** §1.
- ⚠️ **The backfill date, §3.** This is the one that silently poisons the metrics work downstream.
- **Do not touch `clients.source`.** §2.
- **A person can have an origin and no client row.** Put the fields where the leads are.
- ⚠️ **The three allowlists, §4.** T1 is the one that ships a menu he cannot add to.
- **NO hard FK, and no CHECK, on the two new columns.** `lookup_options`'s primary key is
  `(lookup_key, code)` so a plain FK is unavailable anyway — but the real reason is already written
  into `set_menu_value`'s own comment: *"switching off is how a value is retired — it leaves every
  dropdown and stays valid on the records that already carry it."* **Validate on WRITE against an
  ACTIVE option; never on read.** A person who came from a channel he later switches off still came
  from it, and their record must still render that option's words rather than a blank or a raw code.

## THE REACH
The client/contact record, on the surface he is already going to be sitting on to review each account
— **not a separate data-entry screen.** He is reviewing accounts one by one; the fields must be on
the thing he is already looking at. **If he has to open a second page per client, this has failed.**

## THE TELL
Open any client record, set origin and channel from a menu, save, reopen — they are still there. Add
a purchase that happened in June, and it appears in June's numbers, not today's.
