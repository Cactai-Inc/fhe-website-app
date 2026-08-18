# TASK-PARTYROLE — report

**Branch** `task/partyrole` · base `108a496` · **committed, not pushed** · migration **applied to prod**
(`lrstswfxfsezdmvkvukc`) with the rollback proven first.

Every DB claim below is query output, run against production and rolled back. Render claims are
marked **NOT VERIFIED** with a numbered owner checklist at the end.

---

## THE HEADLINE — the bug was not where the task expected it

The task asked for a `Party` provisioning category that assigns zero documents. **It did not need
one.** The counterparty path already exists end to end and already carries no categories and no
template keys:

```
contact  →  document_parties(party_role='LESSOR'|'SELLER')  →  invite_contract_counterparty
         →  CONTRACT invitation  →  redeem_contract_invitation  →  account  →  sign
```

`document_parties.party_role`'s CHECK constraint has allowed `LESSOR` and `SELLER` since it was
written. Nothing on that path reads a category. **One line broke it**, in
`redeem_contract_invitation`:

```sql
PERFORM _ensure_client_account(v_inv.org_id, v_email, …, ARRAY['GUEST'], NULL);
                                                                        ^^^^
```

A NULL `p_template_keys` means *"fall through to the category defaults"*, and the category is
`GUEST`. So **redeeming a contract invitation assigned the counterparty Guest's three documents** —
and because `apply_category_documents` deletes every requirement outside the wanted set, it also
**stripped the horse-owner requirements off a boarder invited as Lessor.**

That is the destructive case §R2b told me to prove could not happen. It could, and here it is —
before, after the fix, and after the old code, on the same synthetic contact:

```
before_set            COMPANY_POLICIES, FACILITY_RULES, HORSE_EMERGENCY_VET,
                      RELEASE_HORSE_CARE, RELEASE_PARTICIPANT
after_fixed_fold_in   COMPANY_POLICIES, FACILITY_RULES, HORSE_EMERGENCY_VET,
                      RELEASE_HORSE_CARE, RELEASE_PARTICIPANT      ← untouched
after_old_null_fold_in COMPANY_POLICIES, FACILITY_RULES, RELEASE_GENERAL
```

**Three requirements destroyed and one unsigned gating document added in their place.** Every
onboarding template is `wall_gating = true`, so that new `RELEASE_GENERAL` then blocks the very
lease the person was invited to sign — *"Onboarding documents must be completed first by: …"*, the
stall `TASK-CONTRACTWALK` reported, **manufactured by the invitation itself.**

The fix is an explicit empty array. `'{}'` takes the other branch: `INSERT … FROM unnest('{}')`
inserts nothing, and `apply_category_documents` — the only thing that deletes — is never reached.

---

## WHAT WAS MEASURED (the task's own measurements, re-verified)

| claim in the task | verdict | evidence |
|---|---|---|
| a dead `Deal client → RELEASE_GENERAL` row exists | ✅ **confirmed** | 1 row, id `4f927743-…` |
| `CATEGORY_TOKEN` maps it to GUEST before the RPC | ✅ **confirmed** | `src/lib/admin.ts:556` |
| `apply_category_documents` matches on the category string | ✅ **confirmed** | `upper(replace(btrim(cdr.category),' ','_')) = upper(replace(btrim(s.cat),' ','_'))` — `'Deal client'` normalises to `DEAL_CLIENT`, which no token ever equals |
| the RPC already expresses zero documents | ✅ **confirmed** | `IF p_template_keys IS NOT NULL THEN INSERT … unnest … ELSE PERFORM apply_category_documents` |
| the UI is additive-only | ⚠️ **confirmed, but the break is in the API, not the form** | see below |
| a fifth group type is cheap (**1** RLS policy, not ~10) | ✅ **confirmed** | one policy reads `groups`: `evaluation_reports_owner_read`. 11 functions reference the type strings; one CHECK constraint |

### The additive-only defect was one line in the endpoint

`ProvisionClientForm` already builds an empty set correctly when staff untick everything
(`docChecked` becomes an empty `Set`, and `[]` is truthy in JS, so `templateKeys: []` is sent).
`api/admin-send-invitation.ts:266` then threw the distinction away:

```ts
p_template_keys: templateKeys.length > 0 ? templateKeys : null,
```

**An explicitly empty selection and an absent one both became NULL**, so unticking every box handed
the category's full set straight back. The distinction is the *shape of the field*, not its length:
an array that arrived is an instruction, even when empty.

---

## THE BUILD

### R1 — Deal client tells the truth: the standard three

- **The dead row is retired.** Only two functions read `category_document_requirements` at all —
  `apply_category_documents` (which never matched it) and `category_document_defaults` (the prefill
  it misled). Confirmed by scanning every function body in `public`. Nothing else depends on it.
- **The screen now resolves documents the way the RPC does.** `ProvisionClientForm` matched
  `d.category === c` on the *display label* while the submit sent the *token*. It now goes through
  `CATEGORY_TOKEN` + a new `matchesCategoryToken()` that reproduces the RPC's normalisation. This
  makes the class of bug structurally impossible rather than fixing one instance: a future label
  that reuses a token cannot reintroduce it.
- **No behaviour changed.** The database wrote three before and writes three now.
- **`CAREPATH` §C10a updated** — recorded as a change of mind (new §C10a-ii), with the owner's
  earlier ruling left standing on the page and struck rather than deleted. Its "~10 RLS-bearing
  surfaces" argument is withdrawn there too.

### R2 — `Party`: **no provisioning category, and no fifth group type. Here is why.**

**Decision: neither was added.** This is the "much smaller task" §R2b invited, and it is the right
answer on the evidence, not a shortcut.

**Why no fifth `groups.group_type`.** The task is right that it is affordable — but affordability
was never the objection. `groups` rows are **DERIVED**: `derive_affiliations` computes them from
executed documents, horse ownership, purchases and invitation categories, and `apply_affiliations`
is their sole writer. A `PARTY` token has no derivation rule that isn't already covered, nothing
would branch on it, and writing one by hand would be the exact regression `CLAUDE.md` warns about.
**A token nothing branches on is decoration** — the task's own words, and they apply.

**Why no `Party` provisioning category.** Three reasons, in order of weight:

1. **`_ensure_client_account` would reject it.** `IF EXISTS (SELECT 1 FROM unnest(v_cats) c WHERE c
   NOT IN ('GUEST','RIDER','HORSE_OWNER')) THEN RAISE EXCEPTION 'categories must be a subset of
   GUEST/RIDER/HORSE_OWNER'`. A `PARTY` token means widening that guard, the `groups` CHECK
   constraint, and `derive_affiliations` — for a role that never appears in any of them.
2. **The role already has a home, and the owner put it there himself** — *"on a contract they are
   lessor or seller."* That is `document_parties.party_role`, which is per-contract, which is what a
   Party is: **a role on a contract, not a standing relationship.** A provisioning category is a
   standing relationship by construction; modelling a Party as one would contradict the ruling it
   was meant to implement.
3. **It would put the destructive case back on the table.** Any category is an input to
   `apply_category_documents`, and that function deletes. Keeping Party out of the category system
   entirely is what makes §R2b's "prove this cannot happen" a structural guarantee rather than a
   test result.

**⚠️ Two things kept a re-provision safe even before this task**, and both are worth recording
because they are why the damage came through the *redemption* path rather than the provisioning one:

- `apply_category_documents` returns early and **deletes nothing** when the wanted set is empty
  (*"a re-invite with empty categories must never strip the requirements an earlier invite
  established"*). A hypothetical `PARTY` category, having no requirements rows, would have hit that
  guard.
- `_ensure_client_account` skips document assignment entirely for an existing contact re-provisioned
  with no categories.

**How the Party role is applied to an existing contact:** purely as a `document_parties` row. Staff
pick them from `contract_party_options()` when starting the lease or sale, or attach them to a deal
via `add_deal_member`. **No category changes, no category is added, and nothing they have signed is
read or written.** A boarder who becomes a Lessor still owes exactly what they owed this morning —
proven above.

### R2-adjacent — the control staff actually needed

The ruling is **discretion, not a whitelist**: nothing required, anything permitted. Two surfaces
now honour that.

- **`api/admin-send-invitation.ts`** distinguishes an explicit `[]` from an absent field. This is the
  whole mechanism the task depends on, and it is one line plus the comment explaining why.
- **`ProvisionClientForm`** gains **"+ Add another document"**, offering every onboarding template
  and **not filtered by category** — because a counterparty's category suggests nothing, so a control
  built from suggestions can subtract but never add outside them. Staff can now move the set in both
  directions from any starting point, including applying the standard three to a Party if that is
  genuinely what the situation calls for.
- **`PaperworkEditor`** (the existing-contact editor) was built from the category defaults, so it
  showed **7 of the 9** onboarding templates and, on a contact with no category, showed the union of
  nothing — the one surface that could apply a document to a counterparty offered none. It now lists
  all 9 via the new `onboarding_template_options()` RPC, with the category shown as a note on the row
  rather than as the source of the row. `set_contact_required_documents` already REPLACED the set, so
  this control always moved both ways; what it lacked was reach.

**No ceiling was built.** The two templates the defaults never mentioned —
`EVALUATION_LIABILITY_WAIVER` and `RELEASE_JUMPER_ADDENDUM` — are now reachable for the first time.

### R3 — what a Party needs

1. **Their information** — a plain `contacts` row. `createContact` is a direct insert; the ten
   triggers on `contacts` are audit, display-code, phone normalisation and channel seeding. **No
   document side effects.**
2. **The contract** — `document_parties` + `invite_contract_counterparty` → `redeem_contract_invitation`.
3. **Their horse** — `horses.current_owner_contact_id`, unchanged by this task.

### R4 — the lock gate

`contract_lock_blockers` is written the safe way — *"no unsigned gating document exists"*, via
`(contact_document_wall_state(c.id)->>'gating')::int > 0`, and `contact_document_wall_state`
`coalesce`s an empty aggregate to 0. **Proven on a real document, not by reading** — see TEST 5.

### R5 — signing still requires an account

Unchanged. `record_signature` requires `current_contact_id()`, which requires a profile.
`redeem_contract_invitation` → `promote_contact_to_account` is how a Party gets one. **No accountless
signing path was built.**

---

## THE TEST THIS MUST PASS

All run against production inside `BEGIN … ROLLBACK`. **Zero synthetic rows survived** (verified by a
trailing count after each rollback). **The real `Tiz` row was never read, written or referenced.**

### 1 — a Deal client is assigned exactly the standard three ✅
```
COMPANY_POLICIES
FACILITY_RULES
RELEASE_GENERAL
```
**And the screen names all three** — NOT VERIFIED (render). Checklist item 1.

### 2 — the dead row is gone and nothing regressed ✅
```
deal_client_rows: 0
Guest        → COMPANY_POLICIES, FACILITY_RULES, RELEASE_GENERAL
Horse owner  → COMPANY_POLICIES, FACILITY_RULES, HORSE_EMERGENCY_VET,
               RELEASE_HORSE_CARE, RELEASE_PARTICIPANT
Rider        → COMPANY_POLICIES, FACILITY_RULES, HUMAN_EMERGENCY_MEDICAL,
               RELEASE_PARTICIPANT
```
12 rows, down from 13. The other three categories are byte-identical to before.

### 3 — a Party is assigned ZERO ✅
```
required_documents_for_absent_seller: 0
```

### 4 — the form moves the set in BOTH directions ✅
```
explicit '{}'                       → 0 rows            (does NOT fall through)
explicit {RELEASE_GENERAL}          → RELEASE_GENERAL   (exactly one)
NULL (control, unchanged behaviour) → the three         (still falls through)
```
The control proves the two are genuinely distinguished rather than both landing on empty.

### 4b — the Tiz Love case, end to end ✅
Two synthetic sellers, same category, same act:
```
seller who never visits   → 0 documents
seller who delivers       → RELEASE_GENERAL, and nothing else
```

### 4c — nothing mandatory, everything permitted ✅
```
Party default                        → {}
staff apply the standard three       → COMPANY_POLICIES, FACILITY_RULES, RELEASE_GENERAL
```
No code path requires a document of a Party: `record_signature` consults none, and
`redeem_contract_invitation` no longer assigns any. **Nothing restricts what staff may apply** —
the ceiling the earlier draft proposed was not built, and the reach was widened from 7 templates
to 9.

### 5 — a Party as LESSOR, and the lock gate ✅ **proven on a real document**
A synthetic `HORSE_LEASE_V2` was started with the zero-document Party as Lessor:
```
lease           {"contract_id":"daab5f16-…","document_id":"dad9785e-…",
                 "template_key":"HORSE_LEASE_V2","fields_seeded":114}
parties         LESSEE  is_signer=t  Lee Lessee
                LESSOR  is_signer=t  Les Lessor
blockers        required_fields    (a blank lease — expected)
                horse_unconfirmed  (expected)
onboarding_blocker_absent: t
```
**And the empty-set case is proven live, not inert** — give the same Lessor one unsigned gating
document and the blocker appears immediately, naming them:
```
onboarding_documents | Onboarding documents must be completed first by: Les Lessor
```
So the gate is genuinely reading their set and passing because it is empty.

### 6 — a Party can sign, and execution applies the lease effects ⚠️ **partially proven**
Proven: the Party is seeded as `is_signer` on the document (above); `record_signature` requires only
a signer party row plus an account and **consults no document requirement, wall state or profile
predicate** (full body scanned). Not driven end to end: signing requires an authenticated browser
session and 114 filled fields, which is a render-path acceptance, not a SQL one. **Checklist item 5.**

### 7 — a Party is never assigned a horse-owner document set ✅ — **with one honest finding**
```
contact_required_documents rows on the Lessor: 0
horse_owner_requirement_rows:                  0
wall state:  {"gating": 0, "titles": [], "pending": 0}
```

⚠️ **But lease execution does generate two documents for the horse's owner.**
`apply_contract_execution_effects` calls `ensure_horse_documents(horse, contract, true)` on the lease
branch, which generates `HORSE_EMERGENCY_VET` and `RELEASE_HORSE_CARE` **for
`horses.current_owner_contact_id` — which in a lease is the Lessor, i.e. the Party**:
```
generated: HORSE_EMERGENCY_VET, RELEASE_HORSE_CARE   (documents table)
contact_required_documents_rows: 0                    (requirements table)
lessor wall after execution: {"gating": 0, …}
```
**These are different tables and different things.** The wall and the lock gate read
`contact_required_documents`, which stays empty, so the Party is never walled or blocked. And this is
not the onboarding set — it is the horse's owner authorising vet care and handling for an animal that
is now living in your barn, which is an obligation of ownership rather than of presence.

**It is out of this task's scope and I did not change it** — but it does sit against a literal
reading of *"the counterparty signs the contract and nothing else"*, so it is **owner question 2**
below. **The sale branch does not do this**: ownership moves to the buyer, so a Seller — the Tiz Love
case — gets nothing at all.

### 8 — is a Party gated on `contact_profile_complete`? ✅ **No.**
```
party_profile_complete: f     ← and nothing blocks on it
```
The predicate demands phone, date of birth, emergency contact name and phone. Its only three readers
are `contact_profile_complete` itself, `my_onboarding_state` and `my_profile_completion`, and:
- `my_onboarding_state` **returns** `profile_complete` but drives `needed` from documents alone;
- `Onboarding.tsx:378` sends a member with no documents straight to `'done'` — **a Party never sees
  the details step at all**;
- `record_signature` does not consult it.

**The one residual is cosmetic:** `DashboardPanel` shows a "Complete your profile" tile off
`myProfileCompletion()`, so a Party with a login would be nagged for an emergency contact they have
no reason to give. **It is friction on the wrong person, and it blocks nothing.** Raised as owner
question 3 rather than silently suppressed — suppressing a tile for a class of person the system does
not model would need a rule I do not have.

### 9 — every DB claim is query output ✅
All of the above. Render claims are below.

---

## NOT VERIFIED — render claims, for the owner to check

Nothing in this task was confirmed in a browser. Numbered so they can be walked in one pass:

1. **Provision a Deal client.** The "First-login paperwork" box names **all three** — General Visitor
   Liability Release, Company Policies, Facility Rules — and all three are ticked.
2. **Untick all three, then submit.** The invited person gets **no documents at all**. (Before this
   change they silently got the three back.)
3. **On any category, click "+ Add another document".** The dropdown lists nine documents, including
   *Pre-Purchase / Lease Evaluation Liability Waiver* and *Jumper Training Addendum*, which were
   never offered before. Choosing one adds it to the list above with its box ticked.
4. **Open a client's record → First-login paperwork.** Nine rows, not seven. The two new ones read
   *"Not suggested by any category — apply when the situation calls for it."* Ticking and unticking
   saves both ways.
5. **The counterparty round trip.** Start a lease with a Lessor who has no paperwork → invite them
   from the contract page → activate the emailed link → confirm they land on the **contract**, with
   **no signing wall and no onboarding list**, and can sign it. This is TEST 6's unproven half.
6. **The footer** now begins *"A family-run equestrian program and community featuring classical
   European style riding and jumper training…"* — the word *hunter* is gone from that sentence.

---

## OWNER QUESTIONS

**1. (the task's own) Does a Party get a portal account with an app to log into, or only enough to
sign?** They need an account to sign (R5, unchanged). Afterwards they hold a login, a stable
containing a horse they may have just sold, and no relationship with the business. **Not decided and
not built** — the current behaviour is that they get an ordinary account and see the ordinary app.

**2. Should a Lessor be asked to sign the two horse documents at lease execution?** Today they are
(TEST 7). It is defensible — the horse is in your barn and someone must authorise its vet care — but
it is not "the contract and nothing else". **Left exactly as it was**; say the word either way.

**3. Should the "Complete your profile" tile be suppressed for someone whose only relationship is a
contract?** It nags a Lessor for an emergency contact. It blocks nothing.

**4. A Party is marked `CLIENT`.** `_ensure_client_account` defaults `p_marker` to `'CLIENT'`, so
redeeming a contract invitation stamps `clients.client_since`. Per D8 that marker means *service
engagement*, which a Lessor selling you a horse does not have; the only alternative the function
accepts is `'CUSTOMER'`, which means *commercial purchase* and fits no better. **Unchanged — I am not
inventing a third marker without a ruling.**

---

## FILES

| file | what |
|---|---|
| `supabase/migrations/20260817T1800_partyrole_the_counterparty_signs_and_nothing_else.sql` | retire the dead row · fix the FOLD-IN · add `onboarding_template_options()` |
| `api/admin-send-invitation.ts` | an explicitly empty selection is not an absent one |
| `src/lib/admin.ts` | `matchesCategoryToken()` · `onboardingTemplateOptions()` · §C10a comment corrected |
| `src/components/app/ProvisionClientForm.tsx` | derive through the token · "+ Add another document" |
| `src/components/app/ClientRecordActions.tsx` | `PaperworkEditor` lists all nine onboarding templates |
| `src/components/layout/Footer.tsx` | owner's copy change (unrelated to PARTYROLE) |
| `docs/tasks/TASK-CAREPATH-…md` | §C10a-ii — the change of mind, recorded as one |

**Health:** `typecheck` 0 errors · `typecheck:api` 0 errors · `eslint` on the changed files 0 problems.

**PGlite suite:** 46 failed files / 26 passed, **identical file-for-file to `main`** (`diff` of the
two failure lists is empty). Not a green baseline; no new red.

**Migration discipline:** dry-run inside `BEGIN … ROLLBACK` first, with the rollback proven — the
`redeem_contract_invitation` body's md5 was `f4a78ba8…` before, `f97062f7…` inside the transaction,
and `f4a78ba8…` again after `ROLLBACK`; the deleted row returned; the new function disappeared. Then
applied, then verified by query. No `BEGIN`/`COMMIT` in the migration file.
