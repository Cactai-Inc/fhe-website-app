# TASK HORSEINTAKE — the horse record blocks a new owner's onboarding

**A real client is blocked right now.** A new contact, a horse owner, cannot complete the
horse record during onboarding. Everything else in this document is secondary to that.

Owner, 2026-08-10, verbatim:

> 1. the required fields are not indicated well enough and if a required field is not filled
>    in it doesnt highlight it and tell them when they try to save.
> 2. when n/a is selected the field should gray out, right now it marks the input tan which
>    looks like its being highlighted not removed.
> 3. Failure to save - they received a notice above the save button that says could not save
>    the horse record.

And separately, later the same day:

> i want to remove the A/B euthanization selection section and just mark every record with
> the option for B, dont show it at all, just add it to the horse record as if it were
> selected, or add it to the vet authorization form as a clause that doesnt need their input
> its just stated as how it is handled.

**Almost everything is in one file:** `src/components/app/HorseIntakeForm.tsx` (1000 lines).

---

# FINDINGS ALREADY ESTABLISHED — do not re-derive these

Verified 2026-08-10 against the repo and production. Each names where it was found.

## F1 — The real error is being thrown away. Fix this FIRST.

`src/lib/horses.ts:96`

```ts
const { data, error } = await supabase.rpc('create_horse_record', { p });
if (error) throw error;
```

`HorseIntakeForm.tsx:739`

```ts
setErr(e instanceof Error ? e.message : 'Could not save the horse record.');
```

**Supabase's `PostgrestError` is a plain object. It is NOT an instance of `Error`.** So
`e instanceof Error` is `false`, the branch falls to the literal string, and **the database's
actual message — which says exactly what went wrong — is discarded and never shown to anyone.**

That is why issue 3 has no diagnosis. **Fix the error surfacing before you try to guess the
cause.** Then reproduce and read what the database actually says.

The same shape may exist on other call sites in `src/lib/horses.ts` — check `updateHorseRecord`
and the location/medication helpers while you are there.

## F2 — Issue 3's message is the CATCH block, which means validation PASSED

This matters and it is easy to miss.

`submit()` has three early-return branches (`HorseIntakeForm.tsx:672–683`) that set their own
messages and never reach the server. "Could not save the horse record." comes only from the
`catch` at 739 — **after** `createHorseRecord` was called.

**So the form was complete and the SERVER rejected it.** Issue 3 is a backend failure, not a
validation failure. Do not conflate it with issue 1.

## F3 — Candidate causes, from `create_horse_record`'s own body

`SECURITY DEFINER`, read from `pg_get_functiondef` on production. It raises exactly three
exceptions before the INSERT, and **every one of them would render as that same generic
string**:

| raise | fires when |
|---|---|
| `an authenticated member account is required to create a horse record` | `auth.uid() IS NULL OR current_contact_id() IS NULL` |
| `no org context` | `current_org()` returns NULL |
| `a horse name is required` | both `registered_name` and `nickname` are blank |

Past that it INSERTs into `horses` — so a NOT NULL violation, a constraint, or an RLS/grant
problem on the insert would also surface here.

**One hypothesis TESTED AND WEAKENED — do not spend time on it.** The obvious guess was that a
brand-new horse owner has no `contacts` row, so `current_contact_id()` returns NULL. Checked
on production:

```
profiles with contact_id IS NULL : 0
profiles total                   : 11
```

**Every existing profile has a contact.** That does not fully clear the path — the blocked
user may be newer than that snapshot, or may have failed before a profile existed at all —
but it is not the cause for any account currently on file. **Verify the state of the actual
blocked account rather than assuming this class of bug.**

**ASK THE OWNER WHO IT WAS.** With the person's identity you can check their `profiles`,
`contacts` and `current_org()` directly, which beats any amount of reasoning from here.

## F4 — Issue 2 is one CSS class

`HorseIntakeForm.tsx:32`

```
const input = '… bg-white disabled:bg-cream-100 disabled:text-muted';
```

`cream-100` is **`#f5f0e8`** — the warm cream used for the header surface. **That is the "tan".**
When N/A is checked the control disables (`HorseIntakeForm.tsx:45–46`) and takes that fill,
which reads as a highlight rather than as removed.

The fix is a genuinely neutral disabled treatment. **The owner has not specified the value.**
See the OPEN QUESTIONS — do not invent a colour, and note that this project has a standing
rule against unrequested visual choices.

## F5 — Issue 1 is HALF WRONG, and the half that exists must not be rebuilt

**The validation machinery is fully built and it does highlight and does tell them.**

- `showError` state at `:441`, set by all three early-return branches at `:672–683`
- Every unanswered required field gets `border-red-400` — threaded into `Field`,
  `SelectOrOther`, `PersonBlock`, `VetBlock`, `LocationEntry`, the euthanasia buttons, and the
  staff account picker. Roughly 30 call sites.
- The message at `:681` is *"Please answer every required field — fill it in or mark it N/A."*

**Do not rebuild any of that.** What is actually missing, and what the owner's complaint most
likely describes:

- **No up-front indication of WHICH fields are required.** No asterisk, no "required" marker,
  no legend. The completeness rule (`HORSE_DOC_REQUIRED_KEYS` plus the structural extras at
  `:636–658`) is invisible until submit fails. That is the "not indicated well enough" half,
  and it is real.
- **The message does not name the offending fields**, and on a 1000-line form the first red
  border may be far off-screen. **There is no scroll-to-first-error.**
- `border-red-400` against a default `border-green-800/15` may simply be too quiet.

**Diagnose which of these it is before changing anything.** And re-read F2 — if what the
client actually hit was issue 3, they may never have seen the validation path at all.

## F6 — The euthanasia change is safer than it looks. The data is already all B.

Production, `horses` where `deleted_at IS NULL`:

```
euthanasia_authorization = 'B' : 3
total horses               : 3
```

**Every existing horse is already B.** There is no backfill and no divergence to reconcile.

Option B is the conservative election — *"I DO NOT AUTHORIZE euthanasia without my express
consent"* — so standardising on it moves toward more owner protection, not less.

### OWNER RULING 2026-08-10 — SETTLED. Questions 3 and 4 are closed.

> "the token goes, we are telling them in the vet auth 'this is how we handle this situation'
> we are not asking 'how do you want us to handle this situation'... hence adding a clause and
> they sign the doc the clause is shown in, no reason for special handling on that specific
> one, its the most accommodating of the two options."

**The election is removed. Section 7 becomes a stated clause carrying Option B's substance.**
No checkbox, no initials, no per-record field. They sign the document; the clause is in it.

**A CORRECTION on which token.** `CLIENT.EUTHANASIA_INITIALS` — the one named in
`docs/TOKEN_DICTIONARY.md:38` — is **already absent from the live template.** It survives only
in the dictionary and in `supabase/contract_templates/Archive/HORSE_EMERGENCY_VET.md` (the v1
body). What is actually live is a **checkbox pair**, and these are what must go:

`{{HORSE.EUTHANASIA_A}}` · `{{HORSE.EUTHANASIA_B}}`

Same intent as the owner's ruling — different token names. Remove all three references
(the two live tokens, plus the stale dictionary entry).

### The live text today — `HORSE_EMERGENCY_VET` v2, read from production

```
7. EUTHANASIA

COMPANY may not authorize euthanasia without CLIENT approval.

CLIENT must select ONE of the following (required):
[ {{HORSE.EUTHANASIA_A}} ]  Option A - I AUTHORIZE the attending veterinarian to perform
humane euthanasia if, in the veterinarian's professional judgment, it is necessary to
relieve the Horse's suffering and I cannot be reached in time.
[ {{HORSE.EUTHANASIA_B}} ]  Option B - I DO NOT AUTHORIZE euthanasia without my express
consent. Every reasonable effort must be made to reach me or my emergency contact before
any such decision, except where required by law.
```

**Draft the replacement from Option B's own wording and bring it to the owner before
applying it. This is legal text — do not compose it and ship it in one motion.**

### WHICH BODY IS AUTHORITATIVE — establish this FIRST

`docs/BACKLOG.md` records, for this exact template: *"HORSE_EMERGENCY_VET historical-migration
archaeology — ruled zero-live-behavior: the `.md` body wins live (byte-verified 2026-08-02)."*

So `supabase/contract_templates/HORSE_EMERGENCY_VET.md` may be the source of truth rather than
the `contract_templates` row. **Determine which actually renders before editing either**, and
say how you established it. Editing the wrong one is a silent no-op that reports success.

### Every surface that references the election

Verified 2026-08-10. Nothing here is optional; a missed one leaves a dangling token.

**Document bodies**
- `contract_templates` row, `HORSE_EMERGENCY_VET` v2, section 7
- `supabase/contract_templates/HORSE_EMERGENCY_VET.md` lines 64-70
- `docs/TOKEN_DICTIONARY.md:38` — the stale `CLIENT.EUTHANASIA_INITIALS` entry
- `supabase/contract_templates/Archive/HORSE_EMERGENCY_VET.md` — **the v1 archive. LEAVE IT.**
  It is history, not a live surface.

**Database functions that reference EUTHANASIA** (from `pg_get_functiondef`)
`create_horse_record` · `update_horse_record` · `generate_document` ·
`horse_field_token_value` · `horse_page_detail`

**Frontend**
- `HorseIntakeForm.tsx` — the A/B button block (`:962-985`), `euthanasiaAnswered` (`:646`),
  its early-return branch (`:674-678`), and the key in `PATCHABLE_KEYS` (`:416`) and
  `TYPED_KEYS` (`:419`), plus the load normaliser (`:536-537`)
- `src/lib/horses.ts` — `:47` (the `'A' | 'B'` type), `:116`, `:296`, `:315`, `:337`, `:359`

### The column, and what happens to in-flight documents

**Keep `horses.euthanasia_authorization`.** All 3 horses are already `B` (F6) so there is
nothing to backfill, and dropping a column is riskier than leaving one unread. **Stop
collecting it; do not drop it.** Say so in the report rather than deciding otherwise.

**Documents on `HORSE_EMERGENCY_VET` right now:**

```
EXECUTED           : 2     keep their text, untouched, forever
AWAITING_SIGNATURE : 1     IN FLIGHT — will pick up the new clause on re-merge
DRAFT              : 2     will pick up the new clause
```

**The AWAITING_SIGNATURE one is mid-signature.** Flag it to the owner before applying —
changing the text under a document someone is being asked to sign is his call, not yours.

**Executed documents are never rewritten**, and `signed_template_version` is evidence — it is
never edited to make a symptom disappear.

### Migration discipline

If this becomes a body-rewrite migration: **it must assert the rewrite matched.** A string
replacement that matches nothing silently no-ops and reports success — roughly 31 existing
migrations in this repo have that shape. Dry-run in `BEGIN … ROLLBACK` with raw output shown,
apply, verify with a query, commit.

## F7 — THE BLOCKED CLIENT IS IDENTIFIED, and her account has a second, separate bug

**Claire Bourdon** — `claire.bourdon21@gmail.com`
contact `8c413fd4-e30b-4ceb-96ef-96afca5dccdb` · user `d4a30809-8fe7-4db8-8f13-de69df7847d7`

**Note:** this is NOT Claire at `hello@fhequestrian.com` (a D1 production FHE identity). Same
first name, different person. Do not conflate them.

### Two of `create_horse_record`'s three exceptions are RULED OUT for her

Verified on production 2026-08-10:

```
profiles.org_id   : e656f20b-ef43-4725-9029-19e7f0190d9c
profiles.contact_id : 8c413fd4-...      (set)
contacts.org_id   : e656f20b-...        (matches)
```

So `current_contact_id()` and `current_org()` both resolve for her. **Neither the
"authenticated member account is required" nor the "no org context" raise can fire.** The
failure is at or after the INSERT — a constraint, a NOT NULL, an RLS/grant problem, or the
microchip reconciliation branch. **Still unknown. F1 is how you find out.**

### Her standing affiliations were destroyed at account creation — a separate ordering bug

From `audit_logs`, her complete trail:

| time (UTC) | what |
|---|---|
| 15:49:48.658 | `contacts` INSERT · `clients` INSERT · **`groups` INSERT ×2 — RIDER and HORSE_OWNER, `actor_user_id` NULL** |
| 15:50:46 / :47 | `contacts` UPDATE ×2 |
| **15:56:31.287** | **her `profiles` row is created — and `groups` DELETE ×2 removes BOTH, actor = her own new user id** |
| 15:58:15.580 | `contacts` UPDATE |
| 15:58:16.331 | **`documents` INSERT ×6 + UPDATE ×6** — her onboarding set |

**The two DELETEs are one action, correctly logged.** `apply_affiliations` deletes group rows
no longer derived; the `audit_contact_roles` trigger on `groups` is FOR EACH **ROW**, so two
rows removed writes two entries at one timestamp. The audit is behaving properly.

**The deletion itself is the bug.** `apply_affiliations` calls `derive_affiliations`, which
computes from **executed documents + horse ownership**. At 15:56:31 she had neither — **her
documents were not created until 15:58:16, 105 seconds later.** So derive correctly returned
nothing and both rows were correctly removed. The ordering is what is wrong.

**Two models are colliding:**

- the invitation/provisioning path **writes RIDER and HORSE_OWNER directly** (actor NULL =
  server-side). `CLAUDE.md` states plainly: *"If you find code writing those roles directly,
  that's a regression — route it through `apply_affiliations`."*
- `apply_affiliations` is the **sole legitimate writer** and rebuilds them from evidence

Note the derive rule needs documents **EXECUTED**, not merely assigned — so signing is what
would restore her groups, not receiving them.

**DO NOT FIX THIS IN THIS THREAD.** It is identity/taxonomy work, it touches the provisioning
spine, and it is not what is blocking the horse record. **Report it** — the orchestrator will
spec it separately. Two things make it worth reporting carefully:

- **it is not specific to her.** Any invited client whose categories are set before they
  activate loses them at activation. Check `audit_logs` for the same DELETE pattern on other
  contacts and say how many are affected.
- **standing categories drive onboarding documents, app nav and gated offerings**, so the
  consequence is what she is shown and offered, not just a stale row.

---

# WHAT TO DO

**In this order. Stop at the gate.**

## Step 1 — surface the real error (F1)

Make the thrown Supabase error readable. A `PostgrestError` carries `message`, `details`,
`hint` and `code` — all four are useful and none currently reach the screen.

This is small, it is a prerequisite for everything else in issue 3, and it is worth shipping
on its own.

## Step 2 — diagnose the save failure (F2, F3)

**The client is Claire Bourdon — see F7**, which already rules out two of F3's three
candidates against production. Reproduce her submission, read the real error that F1 now
surfaces, and work from that.

**Do not theorise from likely code paths.** The contract reload bug took three attempts
because of exactly that; what found it was enumerating call sites. Reproduce, read the real
error, then fix.

## Step 3 — the N/A treatment (F4)

One class. **BLOCKED on the owner's colour** — see OPEN QUESTIONS.

## Step 4 — required-field indication (F5)

**Extend, do not rebuild.** Determine which of F5's three gaps is the real complaint before
writing anything.

## Step 5 — GATE. STOP HERE AND REPORT.

**The euthanasia change is a change to a legal document. Do not implement it in the same pass
as the defects.** Report your Step 1–4 findings and the OPEN QUESTIONS answers, and wait.

---

# OPEN QUESTIONS — ASK, DO NOT GUESS

1. ~~**Who is the blocked client?**~~ **ANSWERED 2026-08-10 — Claire Bourdon, see F7.**
   Her org and contact both resolve, so two of the three candidate causes are already ruled
   out. Start from F7, not from scratch.
2. **What should an N/A'd field look like?** Neutral grey, or something else? The owner said
   "gray out" — that is a direction, not a value. **Show him options rather than picking one.**
   A previous session shipped eight visual changes he rejected, including a colour he had
   already turned down.
3. ~~**The euthanasia shape?**~~ **ANSWERED 2026-08-10 — a stated clause in the vet auth.**
   See the ruling in F6.
4. ~~**What happens to the initials token?**~~ **ANSWERED — it goes.** Note the correction in
   F6: the live tokens are `{{HORSE.EUTHANASIA_A}}` / `{{HORSE.EUTHANASIA_B}}`, not
   `CLIENT.EUTHANASIA_INITIALS`, which is already absent from the live body.
5. **The replacement clause wording** — draft it from Option B and bring it to him. Legal
   text is not composed and shipped in one motion.
6. **The one `AWAITING_SIGNATURE` vet auth** — someone is mid-signature on the old text.
   Applying the new clause changes what they are being asked to sign. His call.

---

# VERIFICATION

Evidence, not assertion. For each item say **what you verified and what you assumed.**

- **Issue 3** — the real database error, quoted verbatim from a reproduction. "It saves now"
  without knowing why it failed is not a fix, it is a coincidence.
- **Issue 2** — the disabled rule grepped out of `dist/assets/*.css`. **An arbitrary Tailwind
  value can silently emit nothing while typecheck, lint and build all pass** —
  `bg-cream-100/[0.92]` produced no rule at all, and `bg-navfill/64` produced nothing because
  64 is not in the default opacity scale. Also: **minified CSS keeps the space after the
  colon**, so grepping `bg-cream-100` style patterns without allowing for it returns false
  negatives.
- **Issue 1** — say which of F5's three gaps you found to be the actual complaint, and how you
  established it.
- `npm run typecheck` · `npm run typecheck:api` · `npm run lint` · `npm run build`.
  Baseline: 0 errors, ~26 pre-existing lint warnings. More means you introduced them.

**Nothing here is browser-verified by anyone but the owner.** Do not claim a render.

---

# CONSTRAINTS

- **Worktree** `~/Downloads/claude-code-repo/wt-horseintake`, branch `task/horseintake`, off
  `origin/main`. Repo is `/Users/Cactai/Downloads/claude-code-repo/fhe-website-app`.
  **NEVER any clone under `~/Desktop`** — an iCloud sync destroyed a repo there and stranded
  four applied migrations.
- **You own** `src/components/app/HorseIntakeForm.tsx`, `src/lib/horses.ts`, and
  `src/pages/app/HorseIntakePage.tsx`. `TASK-UIBUILD` owns the app chrome — `AppLayout.tsx`,
  `AppHeader.tsx`, `index.css`, `tailwind.config.js`. **If your fix needs a change in any of
  those, report it; do not apply it.**
- **`ClauseDocument.tsx` is FROZEN.**
- **Read-only on production data.** You may query it freely. **No writes, no migrations
  applied**, without coming back first — and the euthanasia work is behind the Step 5 gate
  regardless.
- **Executed documents are never rewritten**, and `signed_template_version` is evidence — it
  is never edited to make a symptom disappear.
- **Sarah's document `704c8d2d-d179-43f9-8a4a-7ea8cb920ab9` is a LIVE NEGOTIATION.** Read-only.
- **No design decisions alone.** Question 2 is a design decision. Show options.

# REPORTING

`docs/reports/TASK-HORSEINTAKE-REPORT.md`. State plainly what you verified versus what you
took on trust, and list anything you could not determine.
