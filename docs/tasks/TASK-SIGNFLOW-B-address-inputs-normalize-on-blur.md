# TASK-SIGNFLOW-B — address inputs normalize on blur, on all three doors

**Spec by `FHE-DSNR-SIGNFLOW`, 2026-09-01. Change order: `CR-100`.**
**Thread name: `FHE-TASK-SIGNFLOW-B`.**

> ## READ THESE, BY PATH — nothing else is handed to you
> - `docs/method/TASK-ROLE.md` — the standing requirements. **Not repeated here.**
> - `docs/method/CLNR-ROLE.md` §3 — your zeroth act.
> - `docs/method/THE-RUNNING-RECORD.md` — open `docs/reports/FHE-TASK-SIGNFLOW-B-LEDGER.md` FIRST.
> - `CLAUDE.md` **D34** (`:822`) — persisting and committing are different acts. This whole spine is D34's.
> - `CLAUDE.md` **D22** (`:421`) — the contact record is the source of truth for party fields.
> - `CLAUDE.md` **D18** (`:376`) — improve the incumbent; never build a second normalizer.
> - `src/lib/normalize.ts` — **read the whole file before you edit it.** Its header is the design.
> - `docs/reports/FHE-DISCO-SIGNFLOW-HANDOFF.md` §ITEM 2 — the discovery and the owner's mid-run lock.

---

## 1. THE OWNER'S WORDS

> *"we need the address fields to normalize the inputs, when i enter my address, 752 windemere ct san
> diego ca 92109, it stays looking like that it should normalize to capitalize and it should make sure
> its a valid address somehow."*
> — owner, `docs/reference/CHANGE-ORDER-LEDGER.md` §CR-100

And, ⚠️ **asked and answered mid-run — never re-ask, and do not design around it:**

> *"just normalize the inputs dont want to setup google api for paid lookup functionality, i know
> youre going to need a decision on this while running this task and i can tell you now that is my
> answer."* — owner, 2026-09-01

🔒 **"Valid somehow" = FORMAT-LEVEL SHAPING ONLY. No external verification service, no lookup, no
autocomplete, no API key, not now and not behind a flag.** A ZIP is checked for *shape*, never for
*existence*.

And the rule the whole spine exists to honour (`src/lib/normalize.ts:13-24`, owner via CR-83):
> *"if the person corrects it to La buzetta that is ok we shouldnt recorrect it."*

## 2. WHAT WAS MEASURED — re-run by DSNR on 2026-09-01

| Fact | How it was measured |
|---|---|
| Kinds today are exactly three | `src/lib/normalize.ts:27` — `export type NormalizeKind = 'name' \| 'phone' \| 'email'` |
| The blur hook | `src/lib/formState.ts:367` `useFieldNormalizer` — remembers `lastOutput` per key; **normalise, THEN save, one macrotask later** (`:362-366`, and do not "optimise" that timer away) |
| The derivation | `src/lib/normalize.ts:127` `normalizeKindForField` — `email` / `phone\|mobile\|whatsapp` / `name`, else `null` |
| Onboarding address has **zero** normalizers | `grep -n "normalize(" src/pages/app/Onboarding.tsx` → 5 hits, all name/phone (`:1526`, `:1534`, `:1558`, `:1564`, `:1592`). The four address inputs are `:1632`, `:1637`, `:1641`, `:1645` and carry **only `onChange`** |
| SignStart deal branch | `src/pages/SignStart.tsx:645-708`; `stateV` uppercases **on change** (`:690`); `line1`/`line2`/`city`/`zip` raw. Its normalizers (`:558`, `:572`, `:588`, `:602`) are name/phone/email only |
| The dossier is auto-wired | `src/components/app/ContactDossierModal.tsx:526` derives the kind from the field key over `FIELD_GROUPS` (`:106-139`), whose "Mailing address" group (`:122-125`) is `address_line1, address_line2, city, state, postal_code, country`. ⚠️ **DISCO is right: extending the derivation covers this surface with ZERO call-site edits.** |

## 3. THE INCUMBENT, NAMED (D18) — CONVERGENCE. There is no greenfield here.

`src/lib/normalize.ts` + `useFieldNormalizer` **is** the system. **Address is a missing KIND, not a
missing feature.** You add cases to an existing switch and wire four inputs. If you find yourself
writing a hook, a context, a `useEffect`, or a second "clean the address" helper anywhere, stop —
that is the second implementation D18 exists to prevent.

### ⚠️ 3a. THE INCUMBENT ARGUES AGAINST YOU, IN WRITING, AND YOU MUST OVERWRITE IT

`src/lib/normalize.ts:120-126` says, verbatim:
> *"⚠️ Deliberately narrow. Owner named three things — names, phone numbers, email lowercasing — and a
> city or a street is NOT one of them. Widening this is a product decision, not a tidy-up:
> `po box 12` is not improved by `Po Box 12`."*

And `src/lib/normalize.test.ts:130-131` **asserts the absence**:
```
expect(normalizeKindForField('city')).toBeNull();
expect(normalizeKindForField('address_line1')).toBeNull();
```

🔒 **CR-100 IS THE OWNER MAKING THAT PRODUCT DECISION. The narrowing is superseded, by the same person
who set it.** You are not overruling a design; you are executing its stated escape hatch.
⚠️ **REWRITE THE COMMENT — do not delete it.** It must say that CR-100 (owner, 2026-09-01) widened the
set to include addresses, quote the owner, and keep the `po box 12` case as a **worked example that
the rule already handles correctly** (see §3b: `po` has no capital → `Po`; the owner accepted
capitalisation as the goal, and `Po Box 12` is the honest output of the rule he asked for).
**Update the two assertions to the new expected kinds; do not delete the test.**

### 🔒 3b. THE SHAPE — decided by DSNR. This is the HOW; do not re-open it.

**Four new kinds**, added to `NormalizeKind` and to `normalizeValue`'s switch:

| Kind | Rule | Owner's example |
|---|---|---|
| `street` | **Reuse `normalizeName`'s word rule exactly** — trim, collapse whitespace, capitalise each word that carries no capital of its own. Nothing more. | `752 windemere ct` → `752 Windemere Ct` |
| `city` | **Identical to `street`.** They are one transform under two names; the names exist so a reader of a call site knows what the field is. | `san diego` → `San Diego` |
| `region` | Trim; **if the value is exactly 2 letters, uppercase it. Otherwise return it EXACTLY as typed.** | `ca` → `CA`; `California` → `California` (untouched); `Baja California` → untouched |
| `postal` | Trim; **if it matches `/^\d{5}$/` or `/^\d{5}-\d{4}$/`, return it trimmed and unchanged. If it matches `/^\d{9}$/`, hyphenate to `12345-6789`. Anything else, return EXACTLY as typed.** | `92109` → `92109`; ` 921091234 ` → `92109-1234`; `SW1A 1AA` → untouched |

⚠️ **`region` and `postal` follow `normalizePhone`'s precedent (`normalize.ts:63-83`), and the comment
there is the reasoning you must not violate: *"ANYTHING THAT IS NOT RECOGNISABLY A US NUMBER IS
RETURNED UNCHANGED. A normaliser that mangles [a value] to make it fit is a silent correction of
exactly the kind this file exists to prevent."* **Format what is recognisable; never mangle what is
not.** A two-letter uppercase rule that also uppercased `California` to `CALIFORNIA` would be that
defect.

`country` gets **`street`'s** transform (a country is words), wired through the derivation only.
`address_line2` ("Apt / suite") gets **`street`'s** transform too — `apt 4b` → `Apt 4b`, which is the
same "add the first capital, never move one" rule and does not guess at `4B`.

**`normalizeOnBlur` and `useFieldNormalizer` are NOT modified.** The `lastOutput` guard
(`normalize.ts:116`) already gives every new kind the no-refight behaviour for free. ⚠️ **If you touch
either function, you have misread the task.**

### 3c. THE DERIVATION — tighten it while you widen it

`normalizeKindForField` matches with `String.includes()`. ⚠️ **`'capacity'.includes('city')` is
`true`.** It does not bite today — the one caller is `ContactDossierModal.tsx:526` over `FIELD_GROUPS`,
which has no colliding key (verify this yourself) — but the function is advertised at
`ContactDossierModal.tsx:519-522` as *"a new name/phone/email row added to FIELD_GROUPS is normalised
without anyone remembering to wire it"*, so the next row someone adds is the trap.

**For the address kinds, match on EXACT KEYS, not substrings**, and check them **before** the existing
substring arm so `address_line1` can never be caught by something else later:

- `street` ← `address_line1`, `address_line2`, `address_street`, `street`, `address`
- `city` ← `city`, `address_city`
- `region` ← `state`, `address_state`, `region`, `province`
- `postal` ← `postal_code`, `zip`, `address_zip`, `zip_code`, `postcode`
- `street` ← `country`

⚠️ **`state` as an exact key is safe; `state` as a substring is not** (`estate`, `statement`,
`status` — `status` does not contain it, but do not rely on that). **Exact keys. That is the rule.**

### 3d. THE THREE DOORS — what to wire

1. **`src/pages/app/Onboarding.tsx`** — add `onBlur={normalize(...)}` to `:1632` (`street`), `:1637`
   (`city`), `:1641` (`region`), `:1645` (`postal`), following the **exact idiom already on that page**
   at `:1592`:
   `onBlur={normalize('ob-street', 'street', form.address_street, (v) => setForm((f) => ({ ...f, address_street: v })))}`
   ⚠️ **The `key` argument must be stable and unique per field** — that is what `lastOutput` is keyed
   on. Reuse the input's own `id` (`ob-street`, `ob-city`, `ob-state`, `ob-zip`) and the guard is
   correct by construction.
2. **`src/pages/SignStart.tsx`**, deal branch — add `onBlur={normalize('sign-address1', 'street', line1, setLine1)}`
   and the same for `line2`/`city`/`stateV`/`zip`, matching the idiom at `:558`.
   🔒 **AND REMOVE the `.toUpperCase()` from `onChange` at `:690`** — replace
   `onChange={(e) => setStateV(e.target.value.toUpperCase())}` with a plain
   `onChange={(e) => setStateV(e.target.value)}`. ⚠️ **This is the point of CR-83 and it is the one
   subtractive edit in this task: correcting a value while the person is still typing is the "silent
   correction" `normalize.ts:4-5` exists to prevent.** Leave `maxLength={2}` and the `CA` placeholder
   alone — those shape the input without rewriting it.
3. **`src/components/app/ContactDossierModal.tsx`** — ⚠️ **NO EDIT.** §3c's derivation change wires all
   six mailing-address fields automatically. **Prove that by opening the dossier, not by asserting it.**

### 3e. ⚠️ ONE ADJACENT ONE-LINER, ADDED BY DSNR, NOT BY DISCO — do it, and say you did
`src/pages/app/Onboarding.tsx:1615` — `text_only_phone` has **no normalizer**, while `ob-phone` at
`:1592` has one. Same page, same spine, same defect, one line:
`onBlur={normalize('ob-text-phone', 'phone', form.text_only_phone, (v) => setForm((f) => ({ ...f, text_only_phone: v })))}`
**This is a deliberate scope addition by the spec's author, not drift.** Report it under its own
heading so `ORCH` can see it was authorised here.

## 4. THE TRAPS
- **T1 — normalise THEN save, never the reverse** (D34, and `formState.ts:355-366`). You get this for
  free by using `useFieldNormalizer`. ⚠️ **You lose it the moment you write your own `onBlur`.**
- **T2 — never normalise a value loaded from the database.** Also free, because the hook only ever
  runs on a blur (`normalize.ts:19-21`). ⚠️ **Do not add a normalise-on-load anywhere**; a contact
  whose city was deliberately stored as `van nuys` must survive being viewed.
- **T3 — the no-refight guard is keyed per field.** Two inputs sharing a `key` string share a memory
  and will fight each other. Every key in §3d is unique; keep it that way.
- **T4 — `region` is not "uppercase the state field".** `California` and `Baja California` must come
  back untouched. **Write the test for those two before you write the transform.**
- **T5 — the "already correct" case.** `normalizeOnBlur` returns `raw` when `next === raw`
  (`normalize.ts:115`), so a correctly-typed `San Diego` never even registers a `lastOutput`. That is
  intended. ⚠️ It also means **typing `SAN DIEGO` stays `SAN DIEGO`** — `capitaliseWord` never moves a
  capital (`normalize.ts:51`). Do not "improve" that; it is the `LaBuzetta` rule and it is load-bearing.
- **T6 — the saved value must equal the shown value.** On onboarding the address goes into `form`
  state and is submitted from there, so the normalised value is what saves. ⚠️ **On `SignStart` the
  submit trims and sends at `:461-465`** — confirm the normalised value is what reaches that payload,
  not a stale closure.
- **T7 — D22.** The contact record is the source of truth and contracts compose `{{...ADDRESS}}` via
  `compose_address`. ⚠️ **You are changing what gets STORED, so you are changing what prints on a
  contract.** That is the intended outcome. **It is not a licence to touch `compose_address` or any
  template token** — see §5.

## 5. OUT OF SCOPE — do not touch
- 🔒 **Any address verification, lookup, autocomplete or validation service.** Locked NO by the owner,
  verbatim in §1. **Not even a "did you mean" hint.**
- **Blocking a save on a malformed address.** `SignStart.tsx:442` already refuses a deal submit whose
  ZIP fails `ZIP_RE` (`:61`); that check stays exactly as it is. **Normalisation never rejects — it
  shapes what it recognises and returns everything else untouched.** No new required-field rules.
- `compose_address`, `template_tokens`, contract bodies, any migration. **No DB write of any kind, no
  backfill of existing rows.**
- `normalizeName`, `normalizePhone`, `normalizeEmail`, `normalizeOnBlur`, `useFieldNormalizer` —
  behaviour unchanged. (`normalizeName` is **reused** by `street`/`city`, not edited.)
- **Colour.** `TASK-SIGNFLOW-D` owns every `gold-*` in `Onboarding.tsx`. ⚠️ **You and D both edit that
  file; D merges after you. Change nothing cosmetic.**
- `CaptureInfoModal` / `StableEditors` — verified: no address fields.

## 6. THE REACH — what a person clicks

| Door | Path | Who |
|---|---|---|
| 1 | `/app/onboarding` → the details step → Street / City / State / ZIP | a client, signed in, doing onboarding |
| 2 | `/sign/...` deal branch (`SignStart.tsx`, `isDeal`) → Street address / Apt / City / State / ZIP | a counterparty on a deal, **often not signed in** |
| 3 | staff → Records/Clients → a person → **Contact dossier** → *Mailing address* group | staff |

**Is that the only way?** ⚠️ **Prove it.** `grep -rn "address_line1\|address_street\|postal_code\|address_zip" src`
and list in your report every input element that writes an address field, with **wired / not wired /
not an input**. **An unwired door is this task shipping half-done.**

## 7. THE TELL (D19)
**The person watches the correction happen.** They type `san diego`, click away, and the field says
`San Diego` before anything is saved — that is the whole design (`normalize.ts:4-5`). Nothing is
silent, so nothing needs an undo affordance: **the undo is typing over it, and the `lastOutput` guard
guarantees we will not take it back** (`normalize.ts:116`). ⚠️ **Item 5 of §8 is the proof of that
promise and is not optional.**

## 8. THE TEST THIS MUST PASS
**Built from the validation criteria the owner agreed on 2026-09-01
(`docs/reports/FHE-DISCO-SIGNFLOW-HANDOFF.md` §ITEM 2).** ⚠️ **Renders are NOT verified by you.
Items 1–6 are the numbered checklist you hand the owner, and it must name the phone.**

Using the owner's own example, typed lowercase: `752 windemere ct` / `san diego` / `ca` / `92109`.

1. **Onboarding** (`/app/onboarding`): blur each of the four →
   `752 Windemere Ct` · `San Diego` · `CA` · `92109`. **Submit, reopen, and the SAVED value equals the
   SHOWN value** on all four.
2. **The deal door** (`SignStart`, deal branch): same four results. ⚠️ **And while typing `ca` the box
   shows `ca`, not `CA` — it only changes on blur.** That is the `.toUpperCase()` removal, and it is a
   pass condition, not a regression.
3. **The staff dossier**: same four results on `address_line1` / `city` / `state` / `postal_code`,
   **with no edit to `ContactDossierModal.tsx`** — confirm by `git diff --stat`.
4. **`country`**: `united states` → `United States`. **`address_line2`**: `apt 4b` → `Apt 4b`.
5. 🔒 **THE NO-REFIGHT GUARD.** In the same session, correct `Ct` back to `ct` and blur → **it stays
   `ct`.** Repeat for `San Diego` → `san diego` → stays. Run this on **all three doors**.
6. **THE THINGS THAT MUST NOT CHANGE**, one blur each: `California` stays `California`;
   `Baja California` stays; `SW1A 1AA` stays; `PO BOX 12` stays; `SAN DIEGO` stays; a UK-style
   `SW1A 1AA` in the ZIP box does not block the field. ⚠️ **Report each of these six by its actual
   observed value.**
7. **Unit tests in `src/lib/normalize.test.ts`** — extend, do not replace. Cover: every row of §3b's
   table; every "must not change" case in item 6; ⚠️ **`921091234` → `92109-1234`**; and
   `normalizeKindForField` for all 15 keys in §3c **plus** the existing `city`/`address_line1`
   assertions at `:130-131`, **rewritten to the new expected kinds**. `npm run test` green, with the
   file's pass count before and after in your report.
8. `npx tsc --noEmit` clean; `npm run build` succeeds. ⚠️ **`npm run test:db` is red at baseline and
   proves nothing** — do not report it either way.
9. **The reach inventory from §6 is in your report as a list.**
10. **`src/lib/normalize.ts`'s header comment and the `normalizeKindForField` docstring name CR-100 and
    quote the owner**, so the next thread cannot re-narrow it (§3a).

## 9. WHERE THE REPORT GOES
`docs/reports/TASK-SIGNFLOW-B-REPORT.md`. Ledger: `docs/reports/FHE-TASK-SIGNFLOW-B-LEDGER.md`.
**Open the ledger with your first action.** `ORCH` verifies your claims itself. **You do not push.**
