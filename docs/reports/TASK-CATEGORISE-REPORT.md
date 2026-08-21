# TASK-CATEGORISE — report

**Branch** `task/categorise` · worktree `~/Downloads/claude-code-repo/wt-categorise` · committed,
**not pushed**. Base `origin/main` = `2b9530d`.
**Both migrations are APPLIED to production and verified by query** (2026-08-21). The task doc's
hold was cleared by the orchestrator: *"WALK2 and WALK3 were never started, so nothing is observing
production… they should exercise the corrected provisioning, not the old behaviour."*
**Render claims: NOT VERIFIED.** No browser was opened. Every claim below about the database is a
query result; every claim about the screens is a claim about the code that produces them.

---

## 0. The one-paragraph version

The task's diagnosis was right about the cause and wrong about the damage, and the real defect is
worse. **The database already derives the correct document set from the cart** — a mixed cart's
`purchase_items` fire `promote_buyer_from_offering`, which recomputes affiliations from
`offerings.segment` and applies the union. **Then the staff screen strips it.** Because the inbox row
shows one category chosen from the funnel, a staff member converting a lesson-and-clipping inquiry
ticks *Rider*, `provision_client_invitation` calls `apply_category_documents(contact, ['RIDER'])`,
and the DELETE removes `HORSE_EMERGENCY_VET` and `RELEASE_HORSE_CARE` that the trigger had correctly
assigned. **That is proven below, on production, in a rolled-back transaction.** The fix makes the
cart the default the screen offers, makes the default a union that can only add, and makes the
categories visible everywhere staff look.

---

## 1. What was actually true before this task (verified, not assumed)

Four of the task doc's premises needed correcting.

**1.1 ✅ CONFIRMED — the cart lines are recorded, the segments are populated, the spine is plural.**
`request_selections` holds 9 rows across 8 requests. `offerings.segment` is non-null on all 43 SKUs
(23 active). `provision_client_invitation(p_categories text[])` and
`apply_category_documents(p_contact_id, p_categories text[])` both take arrays and both normalise
case and spacing.

**1.2 ❌ WRONG — "the derivation already works", proven by a JOIN on `offering_id`.**
It resolved **2 of the 9 rows**. Seven carry `offering_id IS NULL` with the offering's **UUID sitting
in `offering_slug`**:

```
 total | with_id | null_id | slug_looks_uuid
     9 |       2 |       7 |               7
```

That is `ASKRIGHT F3` — the checkout sent the UUID under the `offering_slug` key while
`submit_public_request` matched on `o.slug` alone. **ASKRIGHT fixed the writer and never repaired the
rows**, so for seven of eight production inquiries the cart still decides nothing. Migration §1b
backfills them. The orchestrator's proof query was an INNER JOIN and would have returned two rows.

**1.3 ❌ WRONG — "the ONLY defect is upstream … nothing derives anything from the cart".**
Something does, one layer down. `purchase_items` carries a trigger,
`purchase_items_promote_buyer` → `promote_buyer_from_offering`, which calls `apply_affiliations`
(whose `derive_affiliations` reads `offerings.segment` off the purchase: `rider` → RIDER,
`horse` → HORSE_OWNER) and then hands **every** affiliation to `apply_category_documents`, with a
comment saying exactly why: *"so the replace-semantics of apply_category_documents cannot strip an
earlier category's documents."* Measured on `main`, no migrations, a mixed cart:

```
--- BEFORE any provisioning: what the LEAD already has ---
groups:             HORSE_OWNER,RIDER
required documents: COMPANY_POLICIES, FACILITY_RULES, HORSE_EMERGENCY_VET,
                    HUMAN_EMERGENCY_MEDICAL, RELEASE_HORSE_CARE, RELEASE_PARTICIPANT
```

**All six. Correct. From the cart. Today.** This matters twice: it means the existing repo idiom for
this problem is *union, never replace* — which is the shape this task adopts rather than invents —
and it means the failure is downstream of the derivation, not upstream of it.

**1.4 🔴 THE ACTUAL LIVE DEFECT, WORSE THAN DESCRIBED.** The screen then destroys it. Production,
`main`, no migrations, one rolled-back transaction:

```
=== ON MAIN, TODAY. The trigger already got it right from the cart: ===
 COMPANY_POLICIES, FACILITY_RULES, HORSE_EMERGENCY_VET, HUMAN_EMERGENCY_MEDICAL,
 RELEASE_HORSE_CARE, RELEASE_PARTICIPANT

=== Staff read the inbox row. It says "lessons". They tick Rider. ===
 ticked: ["RIDER"]
 after:  COMPANY_POLICIES, FACILITY_RULES, HUMAN_EMERGENCY_MEDICAL, RELEASE_PARTICIPANT

=== WHAT WAS LOST: ===
 HORSE_EMERGENCY_VET
 RELEASE_HORSE_CARE
```

**The person who paid for horse clipping arrives with no horse-care release and no emergency
veterinary authorization**, and the staff member who caused it did the only thing the screen told
them to do. This is the `PARTYROLE` mechanism, reached through the front door.

**1.5 One more correction.** `category_document_requirements` has a **fourth** category,
`Deal client`, with **zero rows** (retired by `20260817T1800` under the owner's PARTYROLE ruling that
a deal client signs what any guest signs). Its token is `GUEST`, and that map existed **only in the
browser** (`CATEGORY_TOKEN`, `src/lib/admin.ts`). Any server-side derivation that returned
`Deal client` would assign **nothing** — `apply_category_documents` rule 1a returns early on an
unmatched category rather than raising. The token now lives in the database (§2.1).

**1.6 Also noted, not changed (out of scope: "the document *contents*", "adding … document sets").**
`Rider` and `Horse owner` do **not** include `RELEASE_GENERAL`; only `Guest` does. So a rider who
never signs a guest release has no general visitor release on file. That is consistent with D8
(*"RELEASE_GENERAL gates physical visits, signed at visit, kiosk-style"*) and inconsistent with the
owner's *"all required documents completed ahead of their initial arrival."* **Flagged in §7.**

---

## 2. What was built

Two migrations and seven source files. One commit: `49f4ae0`.

### §1 — the derived category SET
`supabase/migrations/20260821T0300_categorise_1_the_cart_decides_the_category.sql`

**2.1 `segment_categories`** — the map, as data. One row per segment per tenant, three columns of
meaning:

| segment | request_category | onboarding_category | onboarding_token |
|---|---|---|---|
| `rider` | `lessons` | Rider | `RIDER` |
| `horse` | `horse_care` | Horse owner | `HORSE_OWNER` |
| `acquisition` | `acquisition` | Deal client | `GUEST` |

Three vocabularies already existed and the translations between them were scattered. The
`request_category` column speaks the `requests.category` allowlist (what staff filter on); the
`onboarding_category` column speaks the `category_document_requirements` allowlist (what selects
documents); `onboarding_token` is the standing role both `apply_category_documents` and
`derive_affiliations` actually match on. **Both check constraints mirror the live allowlists**, so a
row that could never resolve cannot be inserted. RLS: staff read only.

The token column is not new machinery — it **moves** the browser's `CATEGORY_TOKEN` map into the
database so the two cannot disagree. `CATEGORY_TOKEN` stays where it is, for the categories staff
pick by hand.

**2.2 §1b — the backfill.** The seven unreadable selections get their `offering_id` and their real
`slug`, matched on the id the `offering_slug` column actually held.

**2.3 `request_categories` view** — the plural membership, **beside** `requests.category`, never
instead of it. One row per (request, category) with `from_cart` / `from_funnel` provenance.

**Decision, and why (§1 asked for it explicitly): a VIEW, not a column.** A stored plural column
needs a trigger to stay in step with `request_selections`, and `request_selections` keeps changing
after the request is written — line states move, `§C5c` splits an inquiry across two orders. Two
writers, two truths, and the drift is invisible because both columns look populated. A view cannot
drift from the rows it reads. `requests.category` is untouched: same value, same check constraint,
same readers (`inbound_queue`, `inquiry_email_payload`, `requests_capture_contact`, the drawer).

**The view unions the stored funnel value deliberately.** §4 requires that a derived filter cannot
under-count; keeping the stored value means no request can vanish from a filter it appears under
today, including the nine kiosk rows that carry no selections at all. The flags say which source
claimed it, so nothing is concealed.

**2.4 `request_onboarding_categories(p_request_id, p_contact_id, p_include_held)`** — the
provisioning default, in the display vocabulary the form uses. Staff-gated, `SECURITY DEFINER`,
`coalesce(has_staff_access(), false)` per D1a.

**This is the dangerous one, and it is why the function takes a contact.** A derived default
introduces a narrowing risk hand-picked categories never had: a boarder who enquires about a riding
lesson derives `{Rider}`, and provisioning on that alone strips their horse paperwork. So the default
is a **union** — the cart's categories PLUS the categories the contact already holds — computed once
in the database rather than in each caller. A category counts as held when the contact holds **every**
template it requires (ALL, not ANY, so a shared `COMPANY_POLICIES` row cannot conjure *Horse owner*),
or when `groups` says so. Both are read because they answer at different moments: requirements exist
from the invitation, groups only once documents are executed.

Dead lines (`declined`, `withdrawn`, `not_a_booking` — each a deliberate staff act) are excluded from
the cart half only. The view still counts them, because "what did this inquiry touch" is a different
question from "what should this person sign".

### §2 — the derived set reaches provisioning
`supabase/migrations/20260821T0310_categorise_2_provisioning_defaults_from_the_cart.sql`

Reissued from the **live** body (`pg_get_functiondef`, 2026-08-21), not from a migration file — per
the standing rule after `TASK-PAGEMERGE` found the live body had drifted past every filed migration.
`diff` of the reissue against the live body is **exactly two hunks and nothing else**:

1. the `at least one category is required` guard moves **below** the org resolution, unchanged
   (the derivation needs `v_org`; nothing between the two points reads `v_cats`);
2. the derive-when-empty block is inserted at its new home.

Everything else — LESSONREQUEST §L3's agreed-lesson block, §C5b order confirmation, INVITEWORKS
supersession, `apply_affiliations` — is byte-for-byte what was live.

The default lands **in the database**, not only in the form, because `ProvisionClientForm` is not the
only caller (`/api/sign-start` calls this RPC too) and because CLOSEOUT §3.4 already settled the
principle in this repo's words: *"client-side-only enforcement is a request, not a rule."*

**It runs only when the caller names no category at all.** A staff member who ticks boxes gets
exactly what they ticked — including a deliberate narrowing. §2: *the derivation is the default, not
a cage.*

### §4 — the filters read the derived set
There was **no category filter on Inbound at all**, and nothing anywhere filtered on
`requests.category` — so §4 is a build, not a rewire.

- `src/lib/ops/api-intake.ts` — `listRequestCategories()` reads the view (one read for the whole
  list; RLS via `security_invoker` means a non-staff caller gets an empty map, not someone else's
  inbox). A failure here degrades to "no categories", never to a blank queue.
- `src/pages/app/ops/IntakePage.tsx` — a category filter row beside the kind filter, desktop buttons
  and a mobile select, offering **only the categories the queue actually contains** so no button can
  return an empty result.
- `src/lib/intakeCategoryFields.ts` — `REQUEST_CATEGORY_LABEL` / `PUBLIC_CATEGORY_OPTIONS` /
  `requestCategoryLabel()`. The label map existed twice (the public form's dropdown and
  `api/request-received.ts`) and the filter needed a third; this file already exists to stop that
  drift between the public form and the staff inbox, so it lives there and `PublicIntakeForm` now
  reads it. (`api/` compiles under its own tsconfig and was left alone.)

---

## 3. The seven acceptance tests

All run against **production**, inside `BEGIN … ROLLBACK`, with the rollback verified afterwards by
querying for the objects (`ABSENT / ABSENT`, 17 requests, 7 still-null selections, Sarah still on 3
documents).

**1. A cart with a riding lesson AND a horse clipping yields BOTH categories, from
`request_selections` alone.** ✅

```
  service_type  | segment | request_category | onboarding_category | onboarding_token
 HORSE_CLIPPING | horse   | horse_care       | Horse owner         | HORSE_OWNER
 RIDING_LESSON  | rider   | lessons          | Rider               | RIDER

-- the view:                     -- the stored column, untouched:   -- the default:
  category  |from_cart|from_funnel      requests_category              {"Horse owner",Rider}
 horse_care |    t    |     f           lessons
 lessons    |    t    |     t
```

**2. Provisioning that request assigns the union of both document sets.** ✅ Called with
`p_categories := '{}'`; the RPC used `["HORSE_OWNER", "RIDER"]` and six templates landed:

| template | required by |
|---|---|
| COMPANY_POLICIES | Guest+Horse owner+Rider |
| FACILITY_RULES | Guest+Horse owner+Rider |
| HORSE_EMERGENCY_VET | Horse owner |
| HUMAN_EMERGENCY_MEDICAL | Rider |
| RELEASE_HORSE_CARE | Horse owner |
| RELEASE_PARTICIPANT | Horse owner+Rider |

Every template from Rider and every template from Horse owner. Nothing else.

**3. A contact who already holds requirements does not LOSE any when categories widen.** ✅
**Re-run against the LIVE functions after the migrations were applied**, on **two** real production
contacts, with "stripped" computed as a query against a `held_before` snapshot rather than read off a
list by eye.

| | holds today | groups |
|---|---|---|
| **Sarah Morgan** `b996dd2c…` | COMPANY_POLICIES, FACILITY_RULES, RELEASE_GENERAL | GUEST, HORSE_OWNER, RIDER |
| **Kit Garcin** `5c5bbdb1…` | COMPANY_POLICIES, FACILITY_RULES, HUMAN_EMERGENCY_MEDICAL, RELEASE_PARTICIPANT | RIDER |

A **lesson-only** inquiry arrives. Its cart alone says `{Rider}` — the narrowing case.

```
################ THE DANGER (what the cart alone would do) ################
  apply_category_documents(sarah, ARRAY['RIDER'])  -> 4
  apply_category_documents(kit,   ARRAY['RIDER'])  -> 4
-- templates that WERE held and are now GONE:
  who   |    destroyed
  Sarah | RELEASE_GENERAL

################ THE GUARD (request_onboarding_categories, live) ################
  Kit   | {Rider}
  Sarah | {Guest,"Horse owner",Rider}

################ APPLY THE WIDENED SET ################
  who   | before | after
  Kit   |      4 |     4
  Sarah |      3 |     7

-- STRIPPED (must be ZERO ROWS):
  (0 rows)

-- ADDED:
  Sarah | HORSE_EMERGENCY_VET
  Sarah | HUMAN_EMERGENCY_MEDICAL
  Sarah | RELEASE_HORSE_CARE
  Sarah | RELEASE_PARTICIPANT

-- IDEMPOTENT: applying the same widened set again -> 7
```

Then `ROLLBACK`, and production re-queried: **Sarah 3 documents, Kit 4, requests 17 — unchanged.**

Three things this proves beyond the ask:

- **Sarah's `Horse owner` came from `groups`, not from her requirements** — she holds none of the
  horse templates. The affiliation arm of the union is live, and it is what saves a boarder whose
  paperwork is executed rather than pending.
- **Kit was NOT credited with `Guest`** even though she holds two of Guest's three templates. The
  ALL-not-ANY rule works: `COMPANY_POLICIES` alone cannot conjure a category.
- **Kit is a genuine no-op** — 4 in, 4 out, nothing added, nothing stripped. Widening a Rider by a
  rider cart is correctly nothing at all.

**4. Existing single-category inquiries behave exactly as before.** ✅ All 17 production requests,
after the backfill:

| stored | derived set | onboarding default (cart only) | rows |
|---|---|---|---|
| `general` ×9 | `general` | `{}` | 0 lines each |
| `lessons` ×8 | `lessons` | `{Rider}` | 1–2 lines each |

Every derived set equals the stored single value. The nine cartless kiosk rows derive **nothing** —
**there is deliberately no funnel fallback in the provisioning default.** Where there is no cart the
cart decides nothing and staff decide, exactly as today. Inventing a `general → Guest` fallback would
have defaulted a *gift* buyer into service paperwork, which D8 rules out.

**5. Staff filtering by horse care finds the mixed inquiry, and filtering by lessons finds the same
one.** ✅ `horse_care` → the mixed inquiry (whose stored column says `lessons`).
`lessons` → 9 rows, `mixed_present = t`.

**6. `requests.category` still satisfies its check constraint and every existing reader works.** ✅
`UPDATE requests SET category='mixed'` → `ERROR: new row … violates check constraint
"requests_category_check"`. The column is never written by this work.

**7. `typecheck` 0 · lint identical to main · `test/db` diffed file-for-file.** ✅

```
npm run typecheck       0 errors
npm run typecheck:api   0 errors
npm run lint            46 problems (0 errors, 46 warnings)   ← identical to main: 46 / 0 / 46
npm run build:client    ✓ built in 4.46s

test/db  baseline (main)  Test Files 46 failed | 26 passed (72)
                          Tests 203 failed | 479 passed | 107 skipped (789)
test/db  after            Test Files 46 failed | 26 passed (72)
                          Tests 203 failed | 479 passed | 107 skipped (789)
         failing-file list diff:  IDENTICAL
```

The 46-red baseline matches the task doc exactly. (`test/db` runs off a schema snapshot, so it does
not exercise these migrations; the point of the diff is that nothing regressed.)

**Additional, not asked for: RLS.** A plain authenticated non-staff user sees **0 rows** in
`request_categories` and **0** in `segment_categories`, and
`request_onboarding_categories` raises `not authorized to read request categories`. The view is
`security_invoker = true`; without it a view owned by `postgres` would have bypassed the RLS on
`requests` and handed the whole inbox to any logged-in member.

---

## 4. §5 — the gap to the owner's end state

> *"a person has a paid and scheduled purchase with an active account and all required documents
> completed ahead of their initial arrival or ours."*

**What is already true.**

1. **The cart becomes an order at submission.** `submit_public_request` opens a `draft` /
   `unpaid` purchase with a `enquiry` status event the moment a selection resolves to a catalog row.
2. **Conversion is one act.** `provision_client_invitation` promotes the lead, confirms the order
   (`draft` → `awaiting_payment`), assigns the documents, books the agreed lesson (§L3) and mints
   the invitation, in one transaction.
3. **Declaring payment unblocks everything (D23).** Credits mint on declaration, not on staff
   confirmation — `20260821T0110_buyandbook_2`. Staff confirmation governs whether the lesson
   happens, not whether the client can act.
4. **The standing weekly slot exists (D23/D25).** `20260821T0120_buyandbook_3` — a recurring
   purchase is a reserved recurring time, not a credit balance.
5. **Documents are enforced.** `my_wall_state()` walls a member's session while a `wall_gating`
   document is unsigned; staff are never hard-walled.
6. **And after this task, the document set follows the cart end to end** rather than surviving as far
   as the trigger and being cut down at the screen.

**What still stands between today and that sentence, in order.**

1. **A visitor cannot get there without staff.** Every public path ends at an inquiry.
   `/shop` redirects to `/lessons` (hidden by the owner, 2026-08-16), `stripe-create-session`
   requires a bearer token and an order the caller already owns, and `BUYANDBOOK` gave the purchase
   RPC to **members**. So "paid and scheduled with an active account" always passes through a staff
   conversion. **This is the largest single gap and it is the owner's stated direction** — *"fully
   functional on the user side."*
2. **Nothing sequences documents against ARRIVAL.** Queried: **no function in the database names
   both `bookings` and the required-documents state** (`purge_account` is the sole hit, and only for
   deletion). Nothing can answer *"who is arriving this week with paperwork outstanding"* — for
   staff or for the client. The wall catches them at login, which is not the same as ahead of
   arrival, and an off-site engagement has no login moment at all.
3. **Nothing reminds.** D9 deleted the welcome and dunning producers deliberately; the invitation is
   the only push. If a client activates and leaves three documents unsigned, no second message ever
   goes out, and the wall only fires if they come back.
4. **`RELEASE_GENERAL` is not in the Rider or Horse owner set** (§1.6). Under the current data a
   client who never signs a guest release has no general visitor release on file, and the owner's
   sentence says *all* required documents.
5. **Off-site engagements are not modelled.** *"or ours (when it's an off-site engagement)"* — there
   is no location concept on the readiness question at all, so "ahead of ours" has nothing to hang
   on.
6. **No editor.** `category_document_requirements` — the map from category to legal documents — has
   **no write surface anywhere in the app**; it is read by two RPCs and edited only by migration.
   `segment_categories` joins it in that state. Under D13 that is unfinished, and under D21 the map
   is exactly the kind of rule that should ship with its editor. Named, not built (§7).

**Not built, per the task. This section is a report.**

---

## 5. THE REACH

Where staff see an inquiry's categories:

1. **`/app/ops/intake` — the Inbound list.** Each booking row now carries its categories as chips
   beside the timestamp, titled *"From what they asked for"* or *"From the page they submitted
   from"*. A mixed inquiry announces itself without being opened.
2. **The same page's category filter** — desktop buttons / mobile select, above the list, labelled
   *"What it's about"*. Present only when the queue holds more than one category.
3. **The lead drawer** (`LeadWorkDrawer`, opened by clicking a row, or by the `request_new`
   notification deep link `/app/ops/intake?request=<id>`) — a *Categories:* line under *Requested*,
   naming each category and its provenance.

Where they override the derived set:

4. **`ProvisionClientForm` → "Account category"**, inside the drawer's *Send confirmation & invite*
   step. The boxes arrive pre-ticked from the cart, with a line saying so —
   *"Prefilled from what they asked for: Horse owner + Rider. This decides the paperwork below —
   change it if the conversation said otherwise."* Unticking is one click, and the paperwork list
   below re-derives in front of them.

The prefill runs **once per request** (a `useRef` guard): re-ticking a box a staff member
deliberately cleared would be worse than not prefilling at all.

## 6. THE TELL

**What the client sees.** The invitation email's `MSG.CHECKLIST` block, which names each document and
what to do with it, then the onboarding wall at `/app/onboarding` after activation.

⚠️ **The provisioned invitation was not sending it.** `api/admin-send-invitation.ts` derived a
checklist from `contact_checklist()` and passed it on the **plain-invite** path only. The
**provisioning** path — the one an inquiry actually travels — sent the offering label and the agreed
lesson time and **no paperwork at all**. So the person whose categories had just been decided was
told what they bought and when their lesson is, and never told there were documents. Fixed here:
same RPC, same template slot, contact id straight off the provisioning result, best-effort exactly as
the other path. **Not verified by render or by a live send** — it is a code change on a path that
requires a real SMTP send to observe.

**What staff see confirming the right set was assigned.** The paperwork checkboxes in
`ProvisionClientForm` (each titled, already-signed ones shown complete and disabled), and after
sending, `InviteResultPanel`. The RPC also returns `categories`, which the endpoint passes back.

**Post-apply smoke, against the live functions** — a mixed cart provisioned with no categories named:

```
view:        horse_care (from_cart) + lessons (from_cart, from_funnel)
filter:      horse_care -> found t   |   lessons -> found t
categories:  ["HORSE_OWNER", "RIDER"]
assigned:    6 documents
contact_checklist() -> 6 items:
  Company Policies · Facility Rules and Safety Acknowledgment ·
  Horse Emergency Veterinary Authorization · Human Emergency Medical Authorization v2 ·
  Horse Handling and Routine Care Liability Release · Participant Liability Release
```

That last block is what the invitation email's `MSG.CHECKLIST` now merges. **The source is proven;
the SEND is not** — observing it needs a real SMTP delivery.

---

## 7. FLAGGED, NOT FIXED

1. 🔴 **An explicit staff narrowing still strips documents, silently and without a record.** By
   design — §2 requires the override, and PARTYROLE ruled that an explicit selection is an
   instruction. But `apply_category_documents`'s DELETE writes no `audit_logs` row, no
   `status_events` entry, and cannot be undone. **This is precisely the class D19 exists for**
   (*"a value-moving action states itself, records itself, and can be undone"*), applied to legal
   documents rather than money. The mitigation shipped here is informational only: the categories are
   now visible, the prefill is correct, and the document list visibly shrinks when a box is unticked.
   **A DELETE of a required legal document should leave a trail. It does not.**
2. 🟠 **`RELEASE_GENERAL` is in the Guest set only.** A Rider or Horse owner who never signs as a
   guest has no general visitor liability release. Consistent with D8's kiosk-at-visit model,
   inconsistent with *"all required documents completed ahead of their initial arrival."* Changing
   the set is explicitly out of scope; **this is an owner decision, not a code fix.**
3. 🟠 **`category_document_requirements` and `segment_categories` have no editor** (§4.6). Under D13
   the feature is unfinished; under D21 the map is a rule that should ship with its editor. Both are
   small tables, and one settings surface could edit both — the category-to-documents map and the
   segment-to-category map are the same screen's two halves.
4. 🟡 **`suggested_category_for_contact` returns ONE token** and `ProvisionClientForm` preselects a
   single label from it. It is now superseded by the union inside
   `request_onboarding_categories` on the request path, but the **contact** path (provisioning a
   walk-in with no inquiry) still gets a single suggestion and can still narrow. Same defect, other
   door.
5. 🟡 **Seven production `request_selections` rows are repaired by §1b, but the repair is a
   migration.** If any other writer ever inserts an unresolved row, the view's slug fallback catches
   it for reading but the row stays wrong for everything that joins on `offering_id` (including
   `submit_public_request`'s own order-building). **A `CHECK` or a `NOT NULL` on `offering_id` was not
   added** — some legitimately unresolvable rows may be wanted, and that is a data-model decision.
6. 🟡 **`request_categories` is not exposed anywhere a client can see it**, deliberately. If the
   client-facing onboarding is ever meant to say *"because you booked a lesson and a clipping"*, the
   provenance flags are already there for it.
7. ⚪ **The `acquisition` segment derives `Deal client` → `GUEST` → Guest's three documents.** Correct
   per the owner's PARTYROLE ruling, but it means an acquisition-only inquiry now defaults to
   assigning three documents where before it defaulted to nothing. Intentional; called out because it
   is a behaviour change on a path with no production traffic yet.

---

## 8. Files

```
supabase/migrations/20260821T0300_categorise_1_the_cart_decides_the_category.sql     NEW
supabase/migrations/20260821T0310_categorise_2_provisioning_defaults_from_the_cart.sql NEW
api/admin-send-invitation.ts              paperwork checklist on the provisioning email (§7 TELL)
src/lib/intakeCategoryFields.ts           one label map for the request categories
src/lib/ops/api-intake.ts                 listRequestCategories() + RequestCategoryRow
src/lib/admin.ts                          requestOnboardingCategories()
src/components/PublicIntakeForm.tsx       reads the shared label map
src/components/app/ProvisionClientForm.tsx  cart prefill + the line that explains it
src/components/app/LeadWorkDrawer.tsx     the Categories line under Requested
src/pages/app/ops/IntakePage.tsx          the category filter + the row chips
```

## 9. Migrations — APPLIED and verified

The task doc held these pending orchestrator coordination. **The orchestrator cleared the hold**:
WALK2 and WALK3 were never started, so nothing was observing production and there were no findings to
keep attributable — and applying migration 2 *before* those walks run is preferable, so they exercise
the corrected provisioning rather than the old behaviour.

Both were dry-run first inside `BEGIN … ROLLBACK`, with the rollback **proven by query** rather than
assumed (`segment_categories: ABSENT`, `request_categories: ABSENT`, 17 requests, 7 still-null
selections, Sarah still on 3 documents), then applied:

```
20260821T0300  BEGIN / CREATE TABLE / … / INSERT 0 3 / UPDATE 7 / CREATE VIEW / CREATE FUNCTION / COMMIT
20260821T0310  BEGIN / CREATE FUNCTION / COMMIT
```

Verified on production afterwards:

```
=== segment_categories ===
 acquisition | acquisition | Deal client | GUEST
 horse       | horse_care  | Horse owner | HORSE_OWNER
 rider       | lessons     | Rider       | RIDER

=== the backfill ===                    still_null 0 | total 9
=== derived membership ===              general  9 requests (0 from_cart, 9 from_funnel)
                                        lessons  8 requests (8 from_cart, 8 from_funnel)
=== request_onboarding_categories ===   SECURITY DEFINER, (p_request_id, p_contact_id, p_include_held)
=== provision_client_invitation ===     derives_from_cart t | guard_intact t
=== requests.category ===               general 9 | lessons 8   (untouched)
```

`from_cart` is now **8 of 8** on the lesson inquiries — before the backfill it would have been 1,
because seven of those rows could not be joined to a catalog row at all.

**Reversibility.** Migration 1 is additive: `DROP VIEW request_categories; DROP FUNCTION
request_onboarding_categories(uuid,uuid,boolean); DROP TABLE segment_categories;` — the §1b backfill
is a data repair and would not be reverted. Migration 2 rewrites a function body in place and is
therefore not replayable on a fresh database, the pre-existing property CLAUDE.md documents for ~31
migrations; to revert it, re-execute the body captured in that file with its two hunks removed.

## 10. TEARDOWN — process census

Every process this thread started was a foreground `npm`/`npx` invocation that exited before the next
step. Census after the last run:

```
$ ps aux | grep -E 'node|vite|vitest|esbuild' | grep -v grep     # editor processes excluded
(no vitest, vite or esbuild processes)
$ pgrep -fl wt-categorise
(nothing)
$ sysctl vm.swapusage
vm.swapusage: total = 4096.00M  used = 3008.19M  free = 1087.81M  (encrypted)
```

`test/db` was run with `--maxWorkers=3` throughout (the PGlite harness stands up a WASM Postgres per
worker; the default one-per-core is what filled the disk on 2026-08-13). `node_modules` in the
worktree is a **symlink** to the canonical checkout's, not a second 446 MB copy. `dist/` from the
build check has been removed.

⚠️ **Swap is at 3.0 GB of 4.0 GB with this thread's processes all gone**, so that load belongs to
other threads or to the editor — worth a look before another parallel `test/db` run.

**Production is clean.** Every probe in this report ran inside `BEGIN … ROLLBACK`. After the
migrations were applied and all proofs re-run: `requests 17` (unchanged), `purchases 6`, and **zero**
rows anywhere matching `%example.test` — no request, no contact, no invitation.
