# TASK HORSEINTAKE — report

Branch `task/horseintake`, worktree `~/Downloads/claude-code-repo/wt-horseintake`, off
`origin/main` (`7cfe8b6`). Steps 1–4 done. **Stopped at the Step 5 gate — no euthanasia
change was made.**

**The blocking bug is found, reproduced against production, and fixed.** It is not one
bug: it is **six**, all of which rendered as the same sentence, and all of which are
reachable from the form's own instructions.

---

## Step 1 — the real error now reaches the screen (F1)

F1's conclusion is right, and the mechanism is slightly more specific than stated —
worth recording because it explains why the truth was invisible.

`postgrest-js` **does** define `class PostgrestError extends Error`, but it only
constructs it on the `.throwOnError()` path, which this codebase never uses. On the
normal path it does:

```js
// node_modules/@supabase/postgrest-js/dist/cjs/PostgrestBuilder.js:127  (v1.21.4)
error = JSON.parse(body);
```

and hands that **plain object** back as `{ data, error }`. So `throw error` threw an
object, `e instanceof Error` was `false` at every catch site, and the database's own
message was replaced by a literal string. Verified by reading the installed dependency,
not from memory.

Fixed in `src/lib/horses.ts`:

- **`DbError`** — a real `Error` carrying all four PostgREST parts (`message`,
  `details`, `hint`, `code`), composed into one readable sentence.
- **All 18** `if (error) throw error;` sites in the file now throw it, each naming what
  was being attempted (`updateHorseRecord` and the location/medication helpers included,
  as the task asked).
- **`errorText(e, fallback)`** — reads a real `Error`, a raw PostgREST object, or
  anything else; the fallback string is used only when there is genuinely nothing to say.
- `HorseIntakeForm.tsx:739` uses it, and **so does the autosave catch**, which was
  discarding its error entirely and printing a fixed sentence.

Unit tests: `src/lib/horses.test.ts`, 6 passing (`npx vitest run src/lib/horses.test.ts`).

**This defect is codebase-wide, not ours alone.** 78 call sites test `e instanceof Error`
against errors that may be raw PostgREST objects. `DbError` / `errorText` are exported so
other threads can adopt them; I changed only the three files I own.

---

## Step 2 — the diagnosis (F2, F3, F7)

F2 is right: the message came from the `catch`, so validation had **passed** and the
**server** rejected the insert. F7 is right that neither identity raise can fire for
Claire Bourdon — I re-verified her `profiles`/`contacts`/`org_id` directly.

### The reproduction

Simulated her exact PostgREST session (`SET LOCAL role authenticated` + her jwt `sub`)
and called `create_horse_record` with the payload shapes the form produces, **inside a
transaction that was rolled back**. Verbatim results:

| form action | outcome |
|---|---|
| every required field a real value | `created` |
| **Date of birth marked N/A** | **FAILED [22007] invalid input syntax for type date: "N/A"** |
| **Fair market value marked N/A** | **FAILED [22P02] invalid input syntax for type numeric: "N/A"** |
| **Sex marked N/A** | **FAILED [23514] violates check constraint "horses_sex_check"** |
| **Breed marked N/A** | **FAILED [23503] violates foreign key constraint "horses_breed_fkey"** |
| **Color marked N/A** | **FAILED [23503] violates foreign key constraint "horses_color_fkey"** |
| **Breed typed into "Other (enter manually)"** | **FAILED [23503] horses_breed_fkey** |
| **Color typed into "Other (enter manually)"** | **FAILED [23503] horses_color_fkey** |
| Markings / registration org typed into "Other" | `created` (plain text columns) |
| Microchip, height, known conditions, vet + farrier, passport marked N/A | `created` |

**Every one of those failures printed "Could not save the horse record." and nothing else.**

### Why the form walks people straight into it

The form's own instruction is *"fill it in or mark it N/A"*, and five of the six columns
that cannot hold `'N/A'` are in the **required** set. The edit-mode patch path already
knew this — `TYPED_KEYS` cleared the sentinel for `date_of_birth`, `fair_market_value`,
`sex`, `euthanasia_authorization`. **The create path never applied it**, and it omitted
`breed` and `color` (foreign keys) on both paths. A brand-new owner only ever meets the
create path. That is the defect.

### Which one did Claire actually hit?

**Unknown, and not knowable from the database** — a failed `INSERT` leaves no row and no
audit entry, and there is no server-side statement log I can read. What is established:
she has **no horse row and no `horse_reconciliation` row**, so she never got past the
insert; and each of the six failures produces exactly the message she was shown. I did
not guess between them — I fixed all six.

### The fix

`src/lib/horses.ts`

- **`HORSE_SENTINEL_UNSAFE_KEYS`** — the six columns that cannot store the sentinel, with
  the reason (typed / CHECK / FK) recorded against each.
- **`scrubHorseSentinels()`** applied **inside** `createHorseRecord`, `updateHorseRecord`
  and `staffUpdateHorse`, so the seam is safe no matter which caller sends the payload.
- The form now derives its `TYPED_KEYS` from that same exported set, so the create path
  and the patch path cannot drift apart again — which is what caused this.

**Proof (rolled back):** a payload with **every N/A-able field marked N/A** now returns
`{"outcome": "created"}`, storing `microchip=N/A reg_no=N/A height=N/A conditions=N/A
vet_phone=N/A` and `dob/fmv/sex/breed/color = NULL`.

### Consequence the owner should see (not a decision I made)

On those six columns `'N/A'` is stored as **NULL**, so the corresponding
`{{HORSE.*}}` token renders **blank** on the vet authorization rather than "N/A". That
was already true for date of birth, value and sex before this change; breed and colour
now join them. The clean fix is in the database, not the client — see follow-up **B**.

---

## Two further defects found (reported, not fixed)

### A — a microchip of "N/A" hijacks the next owner's horse. **Proven.**

`create_horse_record` matches on the microchip **as text**. `'N/A'` is text.

Reproduced (rolled back), two different accounts, two different horses:

```
owner A, first horse with microchip N/A  => {"outcome": "created", ...}
owner B, DIFFERENT horse, microchip N/A  => {"outcome": "match_pending_review"}
```

Owner B is shown *"This horse may already be on file"* and is **stopped**, with a
reconciliation row opened against a stranger's horse. Same owner twice is worse in a
quieter way: the second horse is never created and they are handed the **first horse's
id**.

No horse on file has an `'N/A'` microchip today, so it has never fired — **but the fix
above is what lets people save an N/A microchip in the first place**, so this moves from
latent to reachable. **The client cannot fix it; the match is server-side.** Suggested
one-line change to `create_horse_record`, for a separate migration thread:

```sql
IF v_chip IS NOT NULL AND upper(v_chip) <> 'N/A' THEN   -- the match branch
...
IF v_chip IS NULL OR upper(v_chip) = 'N/A' THEN         -- the fuzzy-duplicate branch
```

### B — breed and colour cannot hold a typed-in value at all

`horses.breed` / `horses.color` are **foreign keys** into `horse_breeds` / `horse_colors`
(15 and 14 codes). The "Other (enter manually)…" escape in `SelectOrOther` writes the
typed text straight into the column, which can only ever fail. Until the DB changes, the
form now **catches it at the field** with a message naming the field and pointing at the
in-list "Other" option (both vocabularies define an `OTHER` code), and still records the
suggestion for the barn.

The real fix is one of: add `'N/A'`-style rows to both vocabularies, or drop the FK and
let the merge fall back to the raw text — `horse_field_token_value` **already** does
`coalesce(display_name, v_horse.breed)`, so free text would render correctly today if the
constraint allowed it. That also fixes the blank-token consequence above. **Owner call,
DB change, outside this task.**

---

## Step 3 — the N/A treatment (F4). **BLOCKED, nothing changed.**

F4 confirmed from the **built** CSS (allowing for the space after the colon that
minification keeps):

```
disabled\:bg-cream-100:disabled{--tw-bg-opacity: 1;background-color:rgb(245 240 232 / var(--tw-bg-opacity, 1))}
```

`rgb(245 240 232)` = `#f5f0e8` = `cream-100`, the header surface. **That is the tan.**

I did not pick a replacement. Four candidates, each **compiled and verified to emit a
real rule** (per the standing warning that an arbitrary value can silently emit nothing):

| option | class | renders |
|---|---|---|
| current (the complaint) | `disabled:bg-cream-100` | `#f5f0e8` warm tan |
| 1 — warm neutral | `disabled:bg-stone-100` | `#f5f5f4` — grey, keeps the page's warmth |
| 2 — true neutral | `disabled:bg-neutral-100` | `#f5f5f5` — plainest grey |
| 3 — cool grey | `disabled:bg-gray-100` | `#f3f4f6` — faintly blue, coolest |
| 4 — recede entirely | `disabled:bg-cream-50` | `#faf8f4` — the page colour; the field stops looking like a field |

The disabled text is already `#143321b3` (brand green at 70%). **Say which and I will
apply it — it is one class.**

---

## Step 4 — required-field indication (F5)

F5 is right that the machinery exists and I did not rebuild it. I audited **all 16**
required keys against their controls before changing anything. All three of F5's gaps are
real, and there is a fourth that is the sharpest match to the owner's words:

**The owner is literally correct: two required fields could never be highlighted.**
`vet_phone` and `farrier_phone` are both in `HORSE_DOC_REQUIRED_KEYS`, so they block
submit — but `VetBlock` passed `cls(false)` for the phone and `PersonBlock` passed
`cls(false)` for its second part. So filling the vet's name and leaving the phone empty
produced *"Please answer every required field"* **with nothing on screen turning red
anywhere.** That is "it doesn't highlight it and tell them", exactly.

What changed (extensions only, in the file's existing idiom — the trailing `*` it already
used on the staff account picker; no new colour, no new component):

1. **Required is visible before you fail.** `*` on every required label — the 16 doc-merged
   fields, the name pair, the home/lease location names, the lease term. The intro
   paragraph now reads "Fields marked * … are required".
2. **Vet phone and farrier phone can now turn red** (`PersonBlock` gained a `required` flag
   on its second part; `VetBlock` tracks the phone separately).
3. **The message names the fields**: *"…Still needed: Vet phone, Farrier phone."*
4. **It scrolls to the first problem.** On a 1000-line form the first red border is
   routinely off-screen. Every rejected submit now moves to the first flagged control, or
   to the message itself when the rejection came from the server.
5. Breed/colour free text is flagged **on the field** (see defect B) rather than becoming
   an opaque server error.

I did **not** change `border-red-400` — F5 suggests it may be too quiet, but that is a
colour decision and belongs with question 2.

---

## F7's second bug — standing categories wiped at activation. **Reported, not fixed.**

Not touched, as instructed. Two things the orchestrator asked for:

**How many are affected.** `audit_logs` holds group `DELETE`s for **5 contacts**; four of
those contact rows no longer exist (test fixtures). **Claire is the only real person it
has happened to so far.**

**But the exposure is nine more.** Nine contacts hold a `RIDER` row today with **no
account yet** — Elisheva Fiszer, Serena Lee, Raymond Thicklin, Brian Olenik, Ashlan
Hockersmith, Audrey Slater, Marissa Robertson, Melanie O'Mea-Smith, and the owner's test
identity Charles Zigmund. Each one loses it the moment they activate, exactly as Claire
did, unless their documents are executed first.

**Claire's current state:** zero groups; all **6** onboarding documents `DRAFT` /
`assigned`, none executed — so `derive_affiliations` still returns nothing and signing is
what restores RIDER. One piece of good news: the `horses_apply_affiliations` trigger
fires on horse ownership, so **completing the horse record will restore HORSE_OWNER by
itself** — verified, the trigger exists on `horses`.

---

## VERIFICATION — what I verified vs what I assumed

**Verified, with evidence:**

- The plain-object error shape — read out of the installed `postgrest-js` 1.21.4, line
  quoted above.
- All six save failures — executed against production inside `BEGIN … ROLLBACK`,
  SQLSTATEs quoted verbatim. Rollback confirmed: 3 horses before and after, 0
  reconciliation rows.
- The fix — the fully-N/A payload returns `created`, rolled back.
- The microchip collision — executed across two real accounts, rolled back.
- The tan — grepped out of `dist/assets/*.css` after a build, with the space-after-colon
  caveat honoured; all four alternatives compiled and confirmed to emit rules.
- The un-highlightable phones — read directly from `VetBlock` / `PersonBlock`, and every
  one of the 16 required keys traced to its control.
- Claire's identity rows, her 6 documents, the group DELETE audit trail, the nine exposed
  contacts, the `horses_apply_affiliations` trigger — all queried.
- `npm run typecheck` 0 · `npm run typecheck:api` 0 · `npm run lint` **30 warnings, 0
  errors** · `npm run build` clean. **30 is the baseline**: I ran lint with my changes
  stashed and got the same 30, so I introduced none. (The task doc's "~26" is stale.)
- `npx vitest run src/lib/horses.test.ts` — 6/6.

**Taken on trust / not established:**

- **Which** of the six failures Claire actually hit. Not recoverable — see above.
- **Nothing is browser-verified.** I did not render this form. Every UI claim is a claim
  about the code and the compiled CSS, not about what the screen looks like.
- I did not test the staff-assigned path (`owner_contact_id`) against production, only the
  client path Claire used; the same scrub covers both.
- Whether the nine exposed contacts will all in fact lose their RIDER row depends on their
  document state at activation, which I did not project forward per person.

**Not done, deliberately:** the euthanasia change (Step 5 gate), the N/A colour (question
2), the microchip match (server-side), the breed/colour FK (server-side), the F7 ordering
bug (assigned elsewhere).

---

## OPEN QUESTIONS

1. ~~Who is the blocked client?~~ Answered — Claire Bourdon.
2. **What should an N/A'd field look like?** Four verified options in Step 3. One class,
   applied the moment you say which. **I did not pick one.**
3. **The euthanasia shape — (a) stamp `B` silently and drop the section, or (b) drop the
   field and state it as a fixed clause in the vet authorization?** Behind the gate.
4. **What happens to `CLIENT.EUTHANASIA_INITIALS`?** Follows from 3.
5. **New records only, or existing too?** All 3 horses on file are already `B`, so nothing
   needs migrating either way — but confirm, because it decides whether a migration is
   written at all.

Two more that came out of the work:

6. **Should breed/colour accept a typed-in value?** (defect B) Today they cannot, and the
   consequence is a blank breed on a legal document when someone marks it N/A. Add
   vocabulary rows, or drop the FK — the document merge already handles free text.
7. **The N/A microchip match** (defect A) — a two-line change to `create_horse_record`.
   Want it as its own migration thread?
