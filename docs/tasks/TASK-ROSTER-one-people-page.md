> ## WHAT THIS PAGE IS FOR — read this before designing anything. Owner, 2026-08-10.
>
> > *"the things that matter most right now are who is active and who isnt, inactive then makes
> > me wonder if they were invited or not, if the invite expired, if they docs are done… i should
> > be able to glance at the grid of cards and spot the problem children and the standouts that
> > are engaging the most."*
>
> **THIS IS A TRIAGE VIEW, NOT A DIRECTORY.** Its job is to make two groups jump out of a grid:
> **people who are stuck**, and **people who are engaging most**. Everything else is subordinate.
>
> ### The diagnosis chain — one question leading to the next, not four independent facts
>
> ```
> is this person ACTIVE?
>    no -> were they INVITED?
>            no  -> nobody has reached out. That is the problem.
>            yes -> has the invite EXPIRED?
>                     yes -> the invite is the problem
>                     no  -> are their DOCUMENTS done?
>                              no -> the paperwork is the problem
> ```
>
> **The card must let him walk that chain by eye.** A card showing four unrelated facts makes him
> reconstruct it; a card showing where the chain stopped answers it.
>
> ### Every signal is backed — verified 2026-08-10
>
> ```
> invitations           sent 13 (7 EXPIRED) · revoked 13 · redeemed 6 · accepted 6 · superseded 2
>                       already exposed on admin_client_accounts as invite_status / invite_expires_at
> unpaid                2 purchases at awaiting_payment
> deal-only party       4 contacts are document parties with NO account and NO clients row
> document completion   contact_required_documents, 36 rows, against executed documents
> ```
>
> ### Badges — add DEAL-ONLY PARTY
>
> Rider and Horse owner stay (**derived from `groups`**, per the ruling below). **Add a
> deal-only-party badge:** someone who is a party to a document but has no account and no client
> relationship. **Four real people today**, currently indistinguishable from anyone else.
>
> ### Counts on the card
>
> **orders · credits · lessons · horses · UNPAID indicator.** The unpaid indicator is not a
> count — **it is a flag, and it belongs with the problem signals**, not with the engagement
> numbers.
>
> ### `TEAM` is EXCLUDED — settled
>
> > Owner: *"team doesnt need to be listed in a clients menu."*
>
> **Do not render `contact_type = 'TEAM'` at all.** That closes the gap where a staff member with
> a `clients` row would have rendered gold. `LEAD` also stays out — leads live on Leads until
> worked.
>
> ### ONE THING TO ASK — what does ACTIVE mean?
>
> **He has not defined it and it is the top of the whole chain.** Candidates: a recent booking, a
> recent order, an account that has signed in, or simply documents complete and nothing
> outstanding. **These produce very different grids. ASK. DO NOT GUESS.**

---

> ## REVERSED 2026-08-10 — USE THE CONTACTS CARDS, NOT THE ADMIN ROWS.
>
> > Owner: *"for the contacts vs clients merge. we should use the contacts cards since they will
> > format better with the volume of data i want to see on them."*
>
> **`ROSTER` delivered against the previous decision** — the positional ROW built on `Admin.tsx`
> (`cd665cd`, unmerged). **The row format is superseded; the CARD format from `ContactsPage`
> wins**, because the data volume he wants does not fit a row.
>
> **What survives from `ROSTER` and must NOT be rebuilt:** the database work is correct and
> already applied — `admin_client_accounts`'s third arm for bare contacts, the per-row
> aggregates (`document_count`, `order_count`, `credits`, `services`), and `roster_service_slots`.
> **Only the presentation changes.**
>
> **The positional principle still holds** — a fixed slot per service type, holding its position
> when empty, so a rider and a horse owner differ by SHAPE. **A card has more room for it than a
> row did.**
>
> ## THE BADGE PROBLEM — two stores, not two casings. Verified 2026-08-10.
>
> > Owner: *"i need to understand why some cards show a badge with 'Rider' and others 'RIDER'"*
>
> ```
> contacts.tags       free text, uncontrolled   "Horse owner" "owner" "Rider" "signatory" "test" "verify-thread"
> groups.group_type   controlled enum           GUEST  HORSE_OWNER  RIDER
> ```
>
> **They do not overlap per person:**
>
> ```
> Mary Richardson    tags: Rider, Horse owner    groups: none
> Brian Olenik       tags: none                  groups: RIDER
> ```
>
> **One card renders from `tags`, the other from `groups`.** Same badge, different source,
> different casing.
>
> **They are not two spellings of one fact — they are a CLAIM and a VERIFICATION.** `groups` is
> derived: `apply_affiliations` is its sole writer, computed from executed documents and horse
> ownership. `tags` is whatever someone typed, and it currently holds `test` and `verify-thread`.
> Mary's tags say Rider and Horse owner; her documents are all still DRAFT, so she has no derived
> groups. **Her tags are aspirational; her groups are the evidence.**
>
> **DECIDE BEFORE STYLING ANYTHING** — see the border question below. A colour that means
> "verified" for one person and "somebody typed it" for another is worse than no colour.
>
> ## THE PARENT / DEPENDENT PAIR — both cards name the other person. Owner, 2026-08-10.

> *"the use of the COUNTERPARTY badge on a dependant when they are the RIDER is weird, the name
> itself is weird. we should just label them as CLIENT and also as DEPENDENT with their Parent's
> name listed."* … *"and the Parent should list their Dependent's name. the title Parent and
> Dependent should be included."*

**`COUNTERPARTY` is contract-role language leaking into a people page.** It describes a position
in a document, not who someone is. **Replace it.**

```
the child's card     CLIENT · DEPENDENT        Parent: Brian Olenik
the parent's card    CLIENT · PARENT           Dependent: Gabriella Olenik
```

**Both directions. The titles "Parent" and "Dependent" appear as labels, not just the names.**

### The data exists and NOTHING reads it — verified 2026-08-10

- **`contacts.guardian_contact_id`** is populated. **One real link today: Gabriella Olenik →
  Brian Olenik.**
- **It is referenced NOWHERE in `src/`.** The relationship has been in the database and invisible
  in the UI, which is why the child gets labelled by her contract role instead.
- **`contacts.date_of_birth`** exists alongside it.

**USE THE FOREIGN KEY, NOT THE GROUP.** `PARENT_GUARDIAN` is a declared `group_type` with
**zero rows** — it is not the source and deriving from it would produce nothing.

**The reverse direction needs a lookup**, not a column: a parent is anyone who is some other
contact's `guardian_contact_id`. **One person may have several dependants** — the card must
handle more than one name rather than assuming one.

**Find where `COUNTERPARTY` is actually rendered before changing it.** It appears in `src/` only
in comments and in `inviteCounterparty`; the visible badge is generated somewhere else. **Do not
guess at the site.**

## SETTLED 2026-08-10 — THE RING CARRIES THE RELATIONSHIP; THE CARD SHOWS WHAT IS DERIVED

> Owner: *"maybe instead of the card doing the work for the category indication, we can use the
> avatar ring and stop with the green fill, we can use a gold ring for a client or customer and a
> green ring for a guest, and a grey ring for a lead."* … *"the card shows whats derived so we
> know the system is accurate."*

### Three dimensions, three encodings — none of them competing

```
RING COLOUR      what KIND of relationship        lead -> guest -> client/customer
BADGES           what SERVICES they engage in     rider, horse owner
SLOT POSITION    what they have CONSUMED          lessons, horse care
```

**And no green fill on the avatar.** The ring carries it.

### The card shows DERIVED values only. `contacts.tags` is not rendered.

**His reason is diagnostic, and it is the right one:** *"so we know the system is accurate."*
**The card becomes a CHECK on `derive_affiliations`** — if a category is wrong you find out by
looking at a person, not by running a query.

**So `groups` is the source and `tags` is not shown.** That resolves both the Rider/RIDER and
Horse Owner/HORSE OWNER mismatches: they were one card reading typed text and another reading
the derived enum. **Only the derived side survives.**

**`tags` is not deleted** — it still holds `signatory`, `owner`, `test`, `verify-thread`. It is
simply not what a badge renders.

### The ring derives cleanly — verified 2026-08-10

```
contact_type    CONTACT 15  ·  LEAD 6  ·  TEAM 4
of the 15 CONTACTs:   14 have a clients row  ·  5 have an account
customer_since = 0    nobody is a customer yet, so gold means CLIENT today
```

| ring | condition |
|---|---|
| **grey** | `contact_type = 'LEAD'` |
| **gold** | `clients.client_since` **or** `.customer_since` present |
| **green** | has an account, no service or commercial marker — **guest**, per D8 |

**Unlike the badges, this has ONE source per state.** No claimed-versus-verified problem.

### GAP — `TEAM` has no ring colour. ASK.

**4 contacts are `TEAM`, and one of them also has a `clients` row**, so under the rules above
they would render **gold** — staff appearing as clients in the roster. **That is unlikely to be
intended.**

**Options for the owner:** a fourth ring colour, no ring at all, or excluded from the roster
entirely. **Do not pick.**

## CARD STYLING INSTEAD OF THE WORD "CLIENT" — SUPERSEDED by the ring above
>
> > *"maybe instead of calling someone a client we can indicate by card styling. a green boarder
> > is one thing, a gold border is another, and a non colored gray boarder is another?"*
>
> **The idea is sound and the mapping is not stated.** Three borders, three meanings — **which
> three?** Client / customer / neither? Verified / claimed / unknown? Active / pending / archived?
>
> **ASK. And whatever it encodes, state which SOURCE drives it** — given the finding above, that
> is the decision, not the colour.

---

# TASK ROSTER — one people page, and the row tells you who someone is at a glance

**Owner ruling, 2026-08-10. This REVERSES a previous instruction and the reversal is the point.**

> "we need to decide about the clients vs contacts, originally i instructed you to remove the
> clients page after contacts page was done being built, I like the layout of the clients page
> better and the information shown on the card is more useful and the click takes me right into
> their record. we need to just stick with using the clients page, but we need to update it to
> show all of the contacts not just the ones labeled clients"

**The Clients page wins. `ContactsPage` is retired.** Removal means hidden behind a boolean,
never deleted — the standing rule from `86a2c33`.

---

## Naming, before anyone goes looking

| what the nav says | route | file |
|---|---|---|
| **Clients** — the page that WINS | `/app/admin` | `src/pages/app/Admin.tsx` |
| **Contacts** — the page being retired | `/app/ops/contacts` | `src/pages/app/ops/ContactsPage.tsx` |

The page the owner calls "Clients" is `Admin.tsx`. Do not assume a `ClientsPage` exists.

## Findings — verified 2026-08-10, do not re-derive

### F1. It cannot show all contacts today. They are not filtered out — they are never selected.

`admin_client_accounts` is a UNION of exactly two arms:

```sql
-- arm 1: accounts
FROM profiles p ... WHERE p.role = 'USER' AND is_admin()
UNION ALL
-- arm 2: clients WITHOUT an account
FROM clients cl ... WHERE cl.org_id = current_org() AND cl.deleted_at IS NULL AND is_admin()
  AND NOT EXISTS (SELECT 1 FROM profiles p WHERE p.contact_id = c.id)
```

**A contact with no account and no `clients` row appears in neither arm.** Widening this is the
core of the task, not a filter change.

### F2. None of the row data the owner wants is returned.

`admin_client_accounts` returns: `kind, user_id, contact_id, client_id, first_name, last_name,
display_name, email, is_suspended, member_status, created_at, tags, invite_id, invite_status,
invite_expires_at, invite_scheduled_for`.

**No document count. No order count. No credits. No services consumed.** All of it must be
added — this is why the task is not a UI order.

### F3. Aggregates that already exist and should be reused, not rebuilt.

`credits_roster` · `admin_client_documents` · `admin_client_items` · `admin_client_bookings` ·
`admin_client_overview` · `contact_checklist`

**Read each before writing anything new.** Prefer extending `admin_client_accounts` with
aggregate columns over N+1 calls per row — the page renders a list.

---

## AVATAR INITIALS — settled 2026-08-10. Two letters here.

> Owner: *"keep the two letter use in place internally for admin, and keep the single letter
> for the user facing avatar. Claire looked at the two options and she picked the single letter
> as looking nicer."*

**The rule underneath it, so the boundary is not argued case by case:**

> **One letter for yourself. Two letters for other people.**

| where | initials | why |
|---|---|---|
| header avatar (`AppHeader`) | **ONE** — `C` | it is always the signed-in person's own mark. Identity. |
| this roster's rows | **TWO** — `CZ` | a list of other people who must be told apart. Differentiation. |

**This is not "admin vs user-facing."** Staff see one letter in their own header and two in a
roster row, and both are correct for what each is doing. **Do not change the header avatar.**

**BOTH FORMS APPEAR ON SCREEN AT ONCE.** Owner: *"i see two letters for the entries into client
page where the row card shows the person as their name and avatar with two letters, they see one
letter like i do in the corner where the avatar is used in the ui for the header and what
becomes a button on mobile."*

So `C` sits in the corner while `CZ` sits in a row, in the same view. **To anyone who does not
know the rule that reads as an inconsistency to be tidied** — and this codebase has a habit of
exactly that. A comment in `AppLayout.tsx` still calls the nav a "solid green panel" when it is
near-white; reconciling apparent mismatches the wrong way is a recorded failure mode (T5).

**Put the REASON in the code, not only in this document.** A comment at both sites — the header
avatar and the roster row — stating that one letter is identity, two letters are differentiation,
and the difference is deliberate. **Without it the next thread makes them match and destroys the
distinction.**

**Two letters need two things a single letter does not:**

- **Deliberate tracking.** Two capitals in a circle read cramped at default spacing.
  `.oh-mono` already carries `letter-spacing: .04em` for `FH` — start from that rather than
  guessing, and optically centre the pair rather than mathematically centring it.
- **People without two initials — SETTLED 2026-08-10.** Owner: *"the person with one name uses
  one letter in the client page."*

  **One name, one letter.** Do not pad it, do not take a second letter from the first name, do
  not substitute the email or a company word. The row shows what the person's name actually
  gives.

  **So a one-letter row avatar is CORRECT, not a fallback that failed.** It differs from its
  neighbours because the underlying name differs — which is information, not noise. **The mark's
  circle, size and position do not change**; only the number of glyphs inside it does. Note this
  in the comment too, or it reads as a bug in a grid of two-letter marks.

## What the row must show

**Only when it exists.** An empty slot is information; a zero is noise.

- avatar letters · name · email
- tags
- document count
- order count
- credits, **and the name the credit applies to**
- services consumed, **each with its own label** — lessons, and each horse-care service

## THE DESIGN PRINCIPLE — position encodes category. This is the requirement.

> "things should have a specific location so lessons are always in the same place and horse
> care services are each in their own place. this way i can visually differentiate a horse
> owner from a rider easily and quickly based on where there is information shown on the row
> card."

**Every service type owns a fixed slot on the row. The slot exists whether or not it is filled.**
Lessons are always in the lessons position; each horse-care service is always in its own.

**So a row is read by SHAPE before it is read by content.** A rider shows information on the
left of the service band and nothing on the right; a horse owner is the inverse. The owner
identifies who someone is **without reading a word** — that is the feature, and any layout that
reflows to close gaps destroys it.

**This rules out a flex row that collapses empty items.** Slots hold their position when empty.

**The service list is DATA, not a hardcoded set.** The catalog is DB-driven (`offerings`,
`config_kind`) and `src/lib/services.ts` and `src/lib/catalog.ts` are RETIRED shadow catalogs —
do not resurrect them. **Derive the slots from the catalog** so a new service does not silently
have nowhere to land. **If the slot count grows unbounded, stop and report** rather than
letting the row become unreadable.

## Also required

- **The sort from `ContactsPage`** — port it, do not reinvent it.
- **The button becomes `+ ADD NEW`.** No designation, no "add client".
- **Clicking a row still goes straight into the record.** The owner named this as a reason the
  page won; do not regress it.

## Lead lifecycle — context, not scope

> "when a lead is done being worked it goes to either the contacts page or it stays in the
> leads page."

Leads move into this roster when worked. **UIO-012 makes the Dashboard absorb Inbound** and
render leads as entries. **Do not build the lead flow here** — note how a worked lead should
appear in this roster and report it.

## Constraints

- Own worktree off `origin/main`. **Never the canonical checkout** — a pre-commit hook refuses
  code commits there.
- `npm install` in the worktree before claiming a typecheck. **`npx tsc` with no `node_modules`
  fetches an unrelated package and exits 0.**
- A migration must **never** contain its own `BEGIN;`/`COMMIT;` — the file's COMMIT ends the
  dry-run wrapper. **Two threads applied to production this way on 2026-08-10.** Prove the
  rollback by re-querying after it.
- Retire `ContactsPage` behind a boolean. **Do not delete it.**
- `ClauseDocument.tsx` is untouched by this.

## Verification

- **Every contact appears.** Compare the roster's row count against `SELECT count(*) FROM
  contacts WHERE deleted_at IS NULL` and account for any deliberate exclusion.
- **Every count on a row reconciles** against its source, on at least three real contacts with
  different shapes — one rider, one horse owner, one with neither.
- **The positional test:** screenshot a rider row and a horse-owner row and show that the
  difference is visible in the SHAPE, with slots holding position when empty.
- Typecheck, typecheck:api, lint, build. Baseline: 0 errors, ~30 lint warnings.

## Reporting

`docs/reports/TASK-ROSTER-REPORT.md`. State what you verified versus assumed, and list any
service type you could not give a stable slot.
