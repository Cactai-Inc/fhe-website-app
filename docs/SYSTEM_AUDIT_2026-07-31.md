# System audit — contracts, invites, records, documents

**Date:** 2026-07-31
**Scope requested by owner:** the entire contract system, the entire invite system, the entire records system, and the entire documents system.
**Method:** live queries against the production database (`lrstswfxfsezdmvkvukc`) plus source reading. Two parallel audit passes (wiring/dedup, flows/gating) with a third trace of real records run directly.

Findings are bucketed into the four categories the owner defined:

1. **Wiring** — a mapping exists but nothing reads it
2. **Deduping** — two things doing one job
3. **Flows and gating** — the sequence and the permissions around it
4. **Real test cases** — actual records traced end to end

Every item below was verified against the live database or the code. The two
exceptions are marked inline: **3.9** is reported from code reading without a
live reproduction, and the parts of **1.6** covering token-body cross-reference
come from the agent's extraction rather than a hand count.

Nothing in this document has been fixed. It is the survey that precedes the work.

---

## 1. Wiring — a mapping exists but nothing reads it

### 1.1 `apply_contract_execution_effects` keys on `HORSE_LEASE`; every live contract is `HORSE_LEASE_V2`

The function opens with:

```sql
IF v_key NOT IN ('HORSE_LEASE', 'HORSE_PURCHASE_SALE') THEN RETURN NEW;
```

Every live contract uses template key `HORSE_LEASE_V2`, so the function returns
early and **lease execution effects have never fired**.

Verified against Beau: he has an EXECUTED lease, yet `lessee_contact_id` is
null, `lease_start` and `lease_end` are null, there is no LESSEE relationship
row, and the horse documents were never bundled via `ensure_horse_documents`.

**Ownership is intact.** The early return happens *before* the branch split
between lease and purchase handling, so a V2 lease cannot fall into the `ELSE`
(purchase) path. The function is inert, not half-firing. This was checked
specifically because a partial fire would have been far more serious.

This is the same archetype as the `generate_document` CASE bug repaired
earlier: correct logic made unreachable by a key mismatch.

A fix needs a backfill as well as a code change — every already-executed lease
is missing its downstream state.

### 1.2 `generate_document` reads `contacts.phone`; only `fill_party_fields_from_contacts` reads `phone_display`

Migration `20260731120000_phone_normalisation.sql` §6 patched
`fill_party_fields_from_contacts` via a `DO` block that string-replaced
`c.email, c.phone,` with `c.email, c.phone_display AS phone,`.
`generate_document` contains the identical `c.phone` read and was never
patched.

```
                                  reads_display | reads_raw
generate_document                       f       |     t
fill_party_fields_from_contacts         t       |     f
```

Live evidence — three document bodies render bare digits:

```
Phone: 9177420109
Phone: 9177420109
Phone: 9177420109
```

against a contact stored as:

```
first_name | phone          | phone_display
Mary       | (917) 742-0109 | (917) 742-0109
```

The `.PHONE` token here came from the **person branch of
`generate_document`**, not from `contract_fields` (that table has zero
`%PHONE%` rows for the document), so the `fill_party_fields_from_contacts`
fix never touches it.

Five further functions also still read the raw column:
`my_onboarding_state`, `admin_client_overview`, `document_parties_summary`,
`pending_fee_candidates`, `staff_contact_directory`.

Only **one** function in the entire database reads `phone_display`. The
generated canonical column is effectively orphaned. No frontend file reads it
at all (`grep -rn "phone_display" src/` returns nothing).

### 1.3 `generate_document` reads `c.address_composed` bare; the fill path coalesces

- `fill_party_fields_from_contacts`:
  `coalesce(nullif(btrim(r.address_composed),''), compose_address(line1, line2, city, state, postal))`
- `generate_document` person branch: `c.address_composed` alone.

Any contact with address parts but a null or blank `address_composed` renders
`{{X.ADDRESS}}` blank through one path and correctly through the other. Same
field, two readers, divergent results.

### 1.4 `REQ.*` tokens are hardcoded to the empty string

In the namespace dispatch of `generate_document`:

```sql
ELSIF r.namespace = 'REQ' THEN v_val := '';
```

There is no fallback — the branch assigns `''` unconditionally, then
`v_body := replace(v_body, r.token, ...)`.

Twenty `REQ` tokens are registered in `template_tokens`, and four distinct
fields appear in live template bodies:

| Token | Uses in bodies |
|---|---|
| `REQ.NOTES` | 6 |
| `REQ.PREFERRED_SCHEDULE` | 6 |
| `REQ.LOCATION_PREFERENCE` | 5 |
| `REQ.CONDITION_UPDATES` | 3 |

`remerge_contract_from_fields` cannot rescue them either: it fills only from
`contract_fields`, and that table contains **zero** `REQ` rows. Namespaces
actually present are TXN (166), HORSE (34), LESSOR (12), LESSEE (11).

This is precisely the "mapping table exists ≠ wired" archetype.

### 1.5 Three `MEDICATION_*` tokens hardcoded to empty beside a working resolver

```sql
WHEN 'MEDICATION_NAME'         THEN horse_medications_prose(v_horse.id,'MEDICATION')
WHEN 'MEDICATION_DOSAGE'       THEN ''
WHEN 'MEDICATION_INSTRUCTIONS' THEN ''
WHEN 'MEDICATION_ADDITIONAL'   THEN ''
```

All four are registered and used in templates. A real resolver exists one line
above the three that return nothing.

### 1.6 Tokens used in template bodies with no `template_tokens` row

The resolver loop iterates `template_tokens`, so a token appearing in a body
with no row is never visited at all.

| Token(s) | Count | Note |
|---|---|---|
| `GUARDIAN.FULL_NAME / PRINTED_NAME / EMAIL / PHONE / ADDRESS` | 5 | No `GUARDIAN` branch either |
| `EMERGENCY_CONTACT.FULL_NAME / PHONE / RELATIONSHIP` | 3 | |
| `HORSE.PASSPORT_COUNTRY`, `HORSE.REGISTRATION_ORG` | 2 | Unfixed siblings of the four MARKINGS/PASSPORT_NUMBER/VET_* tokens already repaired |
| `PARTICIPANT.PRINTED_NAME` | 1 | `PARTICIPANT` has only `DOB` and `FULL_NAME` registered |
| `TXN.CARD_PROCESSOR`, `TXN.CO_OWNERS`, `TXN.EVAL_FIXED_FEE/LENGTH/UNIT`, `TXN.EVAL_INCLUDED_LENGTH/UNIT`, `TXN.ADDITIONAL_ACTIVITIES(_OTHER)`, `TXN.CAUSE_TERM_NOTICE_DAYS`, `TXN.COMP_OMIT`, `TXN.COMP_RESTRICTION` | ~9 | Used in `contract_clause_defs` bodies |

Related: `PARTY.*` has 8 registered tokens, but resolution matches
`dp.party_role = r.namespace` literally, so they are unreachable unless a party
is literally named `PARTY`.

### 1.7 `ensure_contact_for_profile` INSERTs five columns that do not exist

```sql
INSERT INTO contacts (org_id, …, address_line1, address_line2, city, state, postal_code)
VALUES (v_org, …, v_profile.address_line1, v_profile.address_line2,
        v_profile.city, v_profile.state, v_profile.postal_code)
```

`profiles` has none of those five columns — they were dropped in the S6
consolidation.

```sql
select column_name from information_schema.columns
 where table_name='profiles' and column_name in ('address_line1', …);   -- 0 rows
```

Compile-checking the statement gives
`ERROR: column p.address_line1 does not exist`.

The function is `plpgsql`, so this only raises when control actually reaches
the INSERT — a profile with `contact_id IS NULL` and no email match. One such
profile exists (`admin@cactai.io`) and it is short-circuited by the
`c_denied_users` guard. **Latent hard failure**, waiting on the next unmatched
profile.

Directionally this is also the archetype: contact identity is seeded *from*
`profiles` once at creation, rather than both sides reading a shared source.

### 1.8 `DOC.EFFECTIVE_DATE` resolves differently in two paths

- `generate_document`: `to_char(now(), …)` — i.e. generation time
- `remerge_contract_from_fields`: `coalesce(v_doc.effective_date, v_doc.created_at::date)`

Two different answers for one token, depending on which path last wrote
`merged_body`. The `now()` version masks the real `documents.effective_date`
column.

---

## 2. Deduping — two things doing one job

### 2.1 `profiles.phone` vs `contacts.phone` — 7 of 7 rows drift

```
display_name |  pf      | cf       | pphone     | cphone         | phone_drift
CJ           | CJ       | CJ       | 6178384183 | (null)         | t
             | Madeline | Madeline | 8584142124 | (858) 414-2124 | t
             | Claire   | Claire   | 8584393614 | (858) 439-3614 | t
             | CJ       | CJ       | (null)     | (617) 838-4183 | t
             | Mary     | Mary     | 9177420109 | (917) 742-0109 | t
             | Sarah    | Sarah    | 5712157569 | (571) 215-7569 | t
CACTAI INC.  |          |          |            |                | t
```

`profiles.phone` was never normalised — the `contacts_normalise_phone` trigger
and the §5 backfill in the phone migration both target `contacts` only.

`src/pages/Account.tsx:38` reads `profile?.phone`, and line 69 writes `phone`
back to `profiles` via `upsertMyProfile`. **The user-facing Account page reads
and writes the stale copy while contracts read the other one.** This is the
same shape as the profiles-address bug already fixed, one column over.

### 2.2 `set_horse_locations` is silently shadowed

```
oid   | args                                                  | ndefaults
26328 | p_horse_id uuid, p_payload jsonb                       | 0
25822 | p_horse_id uuid, p_home_name text, p_current_name text | 2
```

A 2-argument call resolves to the **text, text** overload, not the jsonb one:

```
select set_horse_locations('…'::uuid, null);
ERROR: unknown horse
CONTEXT: PL/pgSQL function set_horse_locations(uuid,text,text) line 15
```

The only caller, `src/lib/horses.ts:87`, goes through
`supabase.rpc('set_horse_locations', {…})`. PostgREST resolves by named
argument, so which overload it lands on depends entirely on the keys sent. Two
overloads with genuinely different semantics share one name.

Shadowing is worse than ambiguity here: an ambiguous call errors loudly, a
shadowed one quietly runs the wrong function.

### 2.3 `_provision_purchase_for_offerings` has two overloads with swapped parameters

```
28238 | (…, p_offering_ids uuid[], p_mark_paid boolean, p_payment_method text, p_notes text, p_partial_amount numeric) | 4 defaults
28625 | (…, p_offering_ids uuid[], p_payment_method text, p_mark_paid boolean, p_amount_paid numeric, p_notes text)    | 0 defaults
```

Parameters 5 and 6 are **reversed** between the two (`boolean, text` versus
`text, boolean`). A 4-argument call succeeds via defaults, a 5-argument boolean
call succeeds, and a 5-argument text call hard-fails:

```
select _provision_purchase_for_offerings(…, null::uuid[], 'card');
ERROR: invalid input syntax for type boolean: "card"
```

Defined in `20260725000000_provision_spine_core.sql:53` and
`20260726010000_phase2_service_credits_horse_gate.sql:52`. The GRANT/REVOKE at
`20260725000000:123-124` names only the first signature, so the second
overload's privileges were **never revoked from `public`/`anon`**.

Three call sites exist in migrations; each is resolving by positional luck.

### 2.4 `src/components/ops/contacts/ContactTable.tsx` has zero callers

`grep -rn "ContactTable" src/` returns only its own definition (lines 11 and
37). Its apparent consumer, `src/pages/app/ops/ContactsPage.tsx`, imports
`ContactForm` on line 15 but never `ContactTable`, and renders its own inline
table instead.

Line 34 of the dead file reads raw `c.phone ?? '—'` — it carries the 1.2 bug
too, which is a good argument for deleting rather than fixing it.

### 2.5 `document_changes_frozen` ignores its second parameter

```sql
CREATE FUNCTION document_changes_frozen(p_document_id uuid, p_author_contact_id uuid DEFAULT NULL)
...
SELECT EXISTS (SELECT 1 FROM documents d WHERE d.id = p_document_id AND d.status = 'EXECUTED');
```

`p_author_contact_id` is declared and never referenced. Both callers
(`set_contract_field`, `set_field_structured`) pass NULL, so there is no live
impact — but the signature advertises per-author freeze semantics that do not
exist.

### 2.6 Duplicate phone validation in the frontend

`src/components/app/CaptureInfoModal.tsx:19` defines a local `phoneOk()`
(≥10 digits) with no shared helper. There is no `formatPhone` equivalent
anywhere in `src/`. Combined with 1.2 and 2.1, the database's canonical display
form never reaches the UI on any surface.

---

## 3. Flows and gating

### 3.1 `void_signatures_on_edit` fires before the no-op check — worst bug in the audit

In `set_contract_field` the ordering is:

```
39: IF v_state NOT IN ('editable','editing','in_review') THEN RAISE 'document is locked'
46: IF document_changes_frozen(...) THEN RAISE 'fully executed'
52: PERFORM void_signatures_on_edit(p_document_id);
...
95: IF coalesce(v_old_value,'') IS DISTINCT FROM coalesce(p_value,'') THEN
```

**Signatures are voided at line 52; the "did the value actually change" test is
at line 95.** Writing a field to the value it already holds destroys every
signature on the document.

A user tabbing through a form, or a client re-saving without changing anything,
triggers it. `void_signatures_on_edit` soft-deletes all signature rows, stamps
`signatures_voided_at`, and downgrades `status` to `AWAITING_SIGNATURE`.
Everyone who already signed must sign again.

The intent of the design is sound and documented in
`20260731160000_edits_until_signed.sql`: an edit invalidates a signature
because the signature attests to a specific text. But a write that changes
nothing is not an edit. The `PERFORM` needs to move below the change detection
at line 95.

### 3.2 `apply_category_documents` DELETEs before it inserts, and `GUEST` maps to nothing

```sql
DELETE FROM contact_required_documents crd
 WHERE crd.contact_id = p_contact_id
   AND crd.template_key NOT IN (SELECT template_key FROM _wanted);
```

`category_document_requirements` has rows only for `Rider` and `Horse owner`.
`_ensure_client_account` defaults to `v_cats := ARRAY['GUEST']` when no
categories are passed, and it is called unconditionally on every
`provision_client_invitation` — **including re-invites of existing contacts**.

Re-inviting an existing client with no categories therefore wipes every
required document they had. A destructive default, not a no-op.

### 3.3 Category matching is a fragile string transform

```sql
lower(cdr.category) = lower(replace(s.cat, '_', ' '))
```

`HORSE_OWNER` → `horse owner`. This works today only because the seed data
happens to read "Horse owner". Any new category whose display string is not
exactly the underscore-to-space form of the enum silently assigns zero
documents — no error, no warning, and the invite still sends.

### 3.4 The onboarding wall is client-side only

`src/components/app/AppLayout.tsx:511`:

```jsx
if (wall?.wall && location.pathname !== '/app/onboarding') {
  return <Navigate to="/app/onboarding" replace />;
}
```

This is a React redirect. It gates *navigation*, not *data* — RLS is unchanged
by wall state, so a direct Supabase query or RPC from a walled session still
succeeds. The fail-closed branch at line 520 is good practice but likewise only
blocks rendering.

**The real enforcement is elsewhere and is correct.** `record_signature`
enforces server-side (`cannot sign: onboarding documents must be completed
first`), exempting the wall-gating templates themselves and staff.
`contract_lock_blockers` mirrors it with the `onboarding_documents` blocker,
also exempting `wall_gating` documents to avoid deadlock. Those two are
consistent with each other.

Recorded here because the wall should be understood as UX, not security.

### 3.5 The wall's version check has a deliberate leak that never expires

```sql
coalesce(d.signed_template_version, ct2.version) >= ct.version
```

For any document row where `signed_template_version` was never backfilled, this
compares the current (mutated) template version against itself, `>=` holds, and
the person is let through regardless of what they actually signed. The inline
comment describes this as keeping rows the backfill missed "behaving as before"
— it is deliberate, but it is unbounded in time.

Separately, `contact_required_documents.template_key` is a bare text value with
**no foreign key**. The wall join requires `ct.active AND ct.deleted_at IS
NULL`. Two templates are currently `active = false` (`HORSE_REPRESENTATION`,
`MEDIA_RELEASE`), so a requirement row pointing at either silently *un*-walls
the person for a document someone deliberately assigned.

Version state at time of audit: `RELEASE_PARTICIPANT` at v3;
`HUMAN_EMERGENCY_MEDICAL`, `HORSE_EMERGENCY_VET`, `RELEASE_GENERAL`,
`RELEASE_HORSE_CARE`, `EVALUATION_LIABILITY_WAIVER` at v2.

Staff bypass (`my_wall_state` returns `staff_banner` rather than `wall`) is
intentional and consistently applied, but it does mean a staff member can sign
a contract while personally out of compliance.

### 3.6 Twenty-one functions create notifications; exactly one resolves them

Producers (21): `advance_document_workflow`, `approve_contract_termination`,
`calendar_reminder_sweep`, `cancel_lesson_session`, `confirm_booking`,
`contract_notify`, `decide_booking_change`, `decline_contract_termination`,
`deliver_evaluation_report`, `mirror_admin_notification`, `notify_staff`,
`notify_user`, `record_signature`, `redline_notify`,
`request_contract_termination`, `say_hi`, `say_hi_back`,
`schedule_lesson_session`, `send_contract_to_party`, `set_my_onboarding_horses`.

Resolvers (1): `record_signature`, and only on full execution, and only for its
own document link:

```sql
PERFORM resolve_notifications_for_link('/app/contracts/' || p_document_id::text, auth.uid());
```

Confirmed residue in live data:

| Kind | Count | Oldest |
|---|---|---|
| `document_executed` | 12 | 2026-07-10 |
| `contract_cancelled` | 2 | 2026-07-16 |
| `contract_in_review` | 1 | 2026-07-29 |

Specific breakages:

- **`request_new`** links to the constant `/app/ops/intake`, not a per-request
  URL. N inquiries produce N identical rows, and even a hypothetical resolver
  would clear them all at once. `provision_client_invitation` sets
  `requests.status = 'invited'` without touching notifications. Live: 6 `new`
  and 3 `contacted` requests.
- **`contract_in_review` / `contract_locked`** resolve only if the document
  reaches full execution. A document moved `in_review → editable` — a legal
  transition — leaves "ready for your review" standing forever.
- **`document_executed`** is inserted by `record_signature` immediately after
  it resolves the link, so it is self-inflicted permanent residue.
- **Termination flow**: `request_contract_termination` inserts;
  `approve_contract_termination` and `decline_contract_termination` both insert
  *new* notifications rather than resolving the original. The pending alert
  survives its own resolution.

Not broken: every notification `link` resolves to a real route, checked against
`src/App.tsx`.

### 3.7 Website form → request → contact are joined only by string-matched email

`requests_capture_contact()` does `RETURNING id INTO v_contact` and then
returns without using it. There is no `requests.contact_id` column:

```
select column_name from information_schema.columns
 where table_name='requests' and column_name like '%contact%'
→ contact_name, contact_email, contact_phone, contact_method,
  contact_first_name, contact_last_name
```

All denormalised text. The request row and the contact row are joined only by
`lower(contact_email)` string match, and
`provision_client_invitation(p_request_id)` re-resolves the contact from
scratch through `_ensure_client_account`'s own by-email lookup rather than
following a link.

An email correction on either side silently forks them into two people.

### 3.8 Contact typing depends on which door the person came through

- The request trigger explicitly sets `contact_type = 'LEAD'`.
- `_ensure_client_account` (the invite spine) inserts
  `INTO contacts (org_id, first_name, last_name, email)` with **no
  `contact_type`**, falling through to `contacts_file_on_insert()`, which
  defaults non-company rows to `'CONTACT'`.

Whether a person ends up LEAD or CONTACT depends on the entry path, not on what
they are. Live counts: LEAD 3, CONTACT 12. Every contact with a `clients` row
is CONTACT or TEAM — **never a promoted LEAD**, because nothing anywhere
promotes LEAD → CONTACT on conversion.

Also: one contact has `contact_type IS NULL`
(`3c23bb7f-bdce-4943-b40a-85cf41554491`, Gabriella Olenik, no email). The
column is nullable with no default and the trigger is BEFORE INSERT only, so
any pre-trigger row stays untyped permanently.

Minor: the trigger silently no-ops without an email
(`IF v_email IS NULL THEN RETURN NEW;`). `submit_public_request` hard-requires
email, so this only affects direct staff/ops inserts.

This is the taxonomy the owner specified (LEAD / CONTACT / TEAM / DIRECTORY)
not being enforced at the write path.

### 3.9 `promote_contact_to_account` can leave a dead-end account

*(Reported from code reading; not reproduced live.)*

The function performs roughly ten `UPDATE`s re-pointing `documents`,
`document_parties`, `signatures`, `contract_parties`, `document_shares`,
`contact_required_documents`, `invitations`, `clients` and `groups` to the
survivor — and only *afterwards* runs the dynamic FK-reference scan that raises
`contact % still referenced by %`.

In plpgsql an exception rolls the whole call back, so this is safe when called
standalone. But it is called from inside `redeem_invitation`, so a
referenced-contact collision aborts the entire redemption, leaving the user
signed in with a profile but no contact link and `invitations.status` still
`'sent'`. The token remains valid, so a retry hits the same exception.
Unrecoverable without staff intervention.

### 3.10 Conditional clause gates — three sections share the shape just fixed in EVALUATION

Only `HORSE_LEASE_V2` uses conditions: 63 conditional clauses out of 131,
across 23 sections. The EVALUATION fix is present and correct —
`DATES_INCLUDED` carries `{"equals":[""], "field_key":"TXN.EVAL_FIXED_LENGTH"}`
to stay mutually exclusive with `DATES_FIXED`.

Note throughout: `clause_condition_met` supports only `all`, `any`, `contains`,
`equals`, `gte`. There is no negation operator.

**3.10a — `PROHIBITED.OTHER_NONE` can never fire when it matters, and can double-render.**

`TXN.ADDITIONAL_ACTIVITIES` is `input_kind = 'buttons'` (multi-select) stored
as CSV. Confirmed in live data:
`TXN.PERMITTED_ACTIVITIES = 'LESSONS,ARENA_SOLO,ARENA_GROUP,JUMPING,COMPETITIONS,TRAIL'`.
But the gate uses `equals`, which does a whole-string match:

```
PROHIBITED.OTHER_NONE  {"equals": ["", "NONE"],  "field_key": "TXN.ADDITIONAL_ACTIVITIES"}
PROHIBITED.OTHER       {"contains": ["BREEDING","EMOTIONAL_SUPPORT","FILM_TV_AD","OTHER"], ...}
```

Proven against the live function:

```sql
clause_condition_met('{"field_key":"A","equals":["","NONE"]}',    '{"A":"NONE,BREEDING"}') → f
clause_condition_met('{"field_key":"A","contains":["BREEDING"]}', '{"A":"NONE,BREEDING"}') → t
```

Since NONE is selectable *alongside* the others, a value like `NONE,BREEDING`
matches neither `equals` — `OTHER_NONE` is dead — while `OTHER` fires. Nothing
prevents NONE and BREEDING being selected together in the first place.

Fix direction: `OTHER_NONE` must use `contains`, or NONE must be made exclusive
at the input.

**3.10b — `TRAINING_LESSONS` renders the wrong clause when unset, and ignores permitted activities.**

```
TRAINING_LESSONS.LESSONS         {"equals": ["INDIVIDUAL", ""], "field_key": "LESSEE.PARTY_TYPE"}
TRAINING_LESSONS.LESSONS_ENTITY  {"equals": ["ENTITY"],         "field_key": "LESSEE.PARTY_TYPE"}
```

Verified against an empty field map:

```sql
clause_condition_met('{"equals":["INDIVIDUAL",""],"field_key":"LESSEE.PARTY_TYPE"}', '{}') → t
clause_condition_met('{"equals":["ENTITY"],"field_key":"LESSEE.PARTY_TYPE"}',        '{}') → f
```

`LESSEE.PARTY_TYPE` is `required = true` with options only INDIVIDUAL and
ENTITY, so there is no legitimate `""`. The empty string in the individual gate
is a default-to-individual fallback, which means an unset entity lease silently
renders the **individual** lessons clause.

Compounding it, neither gate checks `TXN.PERMITTED_ACTIVITIES`.
`PERMITTED_USE.TRAINER` (sort 200) correctly gates on
`contains ["LESSONS","JUMPING","COMPETITIONS"]` — verified `'ARENA_SOLO'` alone
returns false — but `TRAINING_LESSONS.LESSONS` (sort 250) does not. A lease
permitting only `ARENA_SOLO` therefore drops the trainer clause and still
prints the lessons clause.

The same `""`-default appears in `DEFINITIONS.LESSOR_IND` / `LESSEE_IND` and
`LESSEE_REPS.MAIN_INDIVIDUAL`, but there it is paired with an exclusive ENTITY
twin, so those are fine.

**3.10c — `PURPOSE` renders nothing for an out-of-domain value.**

```
PURPOSE.RECREATION          {"equals": ["RECREATIONAL","INSTRUCTIONAL","COMPETITION","COMMERCIAL"], ...}
PURPOSE.RECREATION_DEFAULT  {"equals": [""], ...}
```

These two cover exactly the four enum options plus empty. `TXN.LEASE_PURPOSE`
is `required = false`, so empty is handled. But any value outside that set — a
legacy row, an import, a renamed option — satisfies neither gate and the
purpose section renders **nothing at all**.

Contrast `INSURANCE_RISK.*_STATUS` versus `*_NONE`, which use
`equals ["NO",""]` / `equals ["YES"]` over a boolean-ish certify field and are
genuinely total. `PURPOSE` is a closed-world assumption over a `select` whose
options can change; it needs an else-branch clause rather than an enumerated
twin.

**Adjacent, probably intentional:** `SCHEDULE.MAIN`, `SCHEDULE.OTHER` and
`SCHEDULE.CHANGES` all gate identically on `TXN.LEASE_TYPE = 'PARTIAL'`, so a
FULL lease renders zero SCHEDULE clauses. That reads as deliberate (a full
lease has no shared schedule), but the entire section vanishes with no "not
applicable" text — the same render-nothing shape as 3.10c, and it may read as
an omission in the executed PDF.

### 3.11 Hardcoded tenant domain in an intake email

`api/request-received.ts:74`:

```ts
`<p><a href="${(identity.siteUrl ?? 'https://fhequestrian.com')}/app/ops/intake">Open the Request Inbox</a> to reply.</p>`
```

The fallback is a specific tenant's domain rather than a generic origin. Every
other sender uses ``req.headers.origin || `https://${req.headers.host}` ``. If
`identity.siteUrl` is unset for another tenant, their staff receive an email
linking into this tenant's site, where their session does not exist and
`requireStaff` bounces them.

All other email links were verified live against `src/App.tsx`:

| Sender | Link | Route |
|---|---|---|
| `admin-send-invitation.ts:193,250` | `${origin}/activate?token=` | `:132` |
| `contract-invite.ts:94` | `${origin}/activate?token=&kind=contract` | `:132` |
| `contract-change-requests-submitted.ts:109`, `contract-voided.ts:72`, `delete-document-with-copy.ts:78` | `/app/contracts/{id}` | `:237` |
| `calendar-reminders.ts:62` | `/app/calendar` | `:200` |
| `notifications-nudge.ts:75` | `/app` | `:187` |
| `email-change-start.ts:116` | `/verify-email` | `:183` |
| `stripe-create-session.ts:85,86` | `/order/{id}` | `:170` |
| `request-received.ts:74` | `/app/ops/intake` | `:255` |

`/activate` and `/verify-email` are correctly outside the
`ScrollToTop`/`Layout` wrapper and outside `/app`, so token links work
unauthenticated.

---

## 4. Real test cases — actual records traced end to end

### 4.1 Website form → request → contact — works

**0 orphaned** across 9 requests. Every request has a matching contact.

Caveat: the match is by email string, not by key. See 3.7.

### 4.2 Invite → account — works, with one exception

The apparent gap (8 accepted invitations, 5 accounts) is entirely explained by
D1 identities — `hello@` duplicates and a test identity — not by lost users.
**Not a bug.**

One genuine exception: `charlesjzigmund@…` shows status `accepted` with **no
contact at all** and zero required documents — a redemption that attached
nothing. It carries the legacy `accepted` status, which `redeem_invitation` no
longer writes (it writes `redeemed`), so status is not a reliable success
marker across historical rows.

Also observed: `offering_ids`, `categories` and `template_keys` are frequently
NULL on real invitations.

```
cjzigs@icloud.com    | sent     | categories NULL     | template_keys NULL | offering_ids NULL | crd_n 6
maeboon@gmail.com    | sent     | {RIDER,HORSE_OWNER} | NULL               | NULL              | crd_n 6
charlesjzigmund@…    | accepted | NULL                | NULL               | NULL              | crd_n 0, no contact
```

### 4.3 Document delivery — correct by design

Every party copy is linked to a recipient. The 10 unlinked rows are all
`is_mirror = true` — company copies with no individual recipient, which is what
the mirror is for. **Not a bug.**

### 4.4 Purchases — clean

1 of 1 has a buyer link.

### 4.5 Lease execution — fails

See 1.1. Beau's EXECUTED lease produced none of its downstream effects.

### 4.6 Notification email delivery — not a bug

All 16 notifications have `emailed_at = NULL`. That column is written only by
the cron endpoints (`api/notifications-nudge.ts`,
`api/calendar-reminders.ts`) — a daily-digest design, so the nulls are
expected. A design question if per-notification delivery is wanted, not a
defect.

---

## Recommended order of work

1. **3.1** — no-op writes destroying signatures. Live legal damage; a one-line
   ordering change.
2. **3.2** — re-invite wiping required documents. Live data loss.
3. **1.1** — lease execution effects never firing. Every executed lease is
   missing downstream state; needs a backfill as well as a fix.
4. **1.2 / 2.1** — the phone split, in both directions (document rendering and
   the Account page).
5. **1.7, 2.2, 2.3** — latent hard failures and overload shadowing. Cheap to
   close.
6. **3.10a / 3.10b** — wrong or missing clauses in executed legal contracts.
7. **3.6** — notification resolution. Twenty producers need resolvers, and
   `request_new` needs a per-request link before a resolver can work.
8. **3.7 / 3.8** — the request→contact link and the LEAD/CONTACT promotion
   path. Structural; worth doing together.
9. **1.4, 1.5, 1.6, 1.8** — token resolvers. Either wire them or remove them
   from `template_tokens`; a registered token that renders empty is worse than
   an absent one.
10. **3.9** — reproduce first, then fix.
11. **2.4, 2.5, 2.6, 3.11** — cleanup.

Items deliberately not on this list because they were verified as correct:
document mirroring (4.3), `emailed_at` (4.6), staff wall bypass (3.5),
`advance_document_workflow` lock preconditions, and the invite spine's
convergence on `redeem_invitation` (3.2 preamble).

---

## Scope notes

**Two systems were not fully traced.** The wiring pass covered
contract/document/token wiring thoroughly and the profiles↔contacts pair in
depth, but the **invite** and **records** systems did not receive the same
read-versus-write comparison — the phone thread consumed that budget, and
clause gating consumed the other pass's. Given that 1.7
(`ensure_contact_for_profile`) is an invite-adjacent path and already yielded a
latent hard failure, those two systems warrant a follow-up pass using the same
method.

**One finding is code-reading only.** 3.9 has a verified code path but no live
reproduction.

**Screenshots pending.** The owner has contract defects to report that were
"either ignored or made worse" in recent work. Those are not represented here
and should be folded in before fixes begin, since some may trace to the same
root causes.

**Open owner decisions carried forward from earlier sessions**, unaffected by
this audit but still outstanding: six version-bump re-sign decisions seeded and
waiting; Gabriella Olenik unfiled (see 3.8); the `cjzigs@` duplicate contact.
