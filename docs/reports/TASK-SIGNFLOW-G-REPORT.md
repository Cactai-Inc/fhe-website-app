# TASK-SIGNFLOW-G-REPORT

**CLNR: clean.** No orphan/duplicate lineages for this task; `docs/` folders match §2a; no loose root files.

## 1. THE HEADLINE
Wired `useFieldNormalizer` + `normalizeKindForField` (CR-100, D18 incumbent, zero library edits) into
the three unnormalised contact writers ORCH's routing named: `ProvisionClientForm.tsx`,
`ContractIntake.tsx`, `ContractPage.tsx`'s co-buyer grid. Every contact field on all three — not just
address, per §3b — now normalizes on blur: 8 fields in `ProvisionClientForm`, 9 in `ContractIntake`
(the 4 `vet_*` fields left untouched, as specced), 8 in `ContractPage`'s grid. `git diff --stat`:
exactly the three files. All checks in item 8 below are green.

## 2. CRITERION BY CRITERION — "THE TEST THIS MUST PASS"

⚠️ **Items 1–7 require a rendered browser with a staff login. Per `TASK-ROLE.md` §3, "Renders are NOT
VERIFIED by you. No worktree has a staff login. Never simulate one."** They are handed to the owner as
the numbered checklist in §8 below, each phrased directly off the spec's wording so it can be run
verbatim. Item 8 (build/lint/typecheck/test) is proven here, with pasted output.

**8.** `git diff --stat` — exactly three files:
```
$ git diff --stat HEAD~1
 src/components/app/ProvisionClientForm.tsx | 24 +++++++++++++++++-------
 src/pages/app/ContractIntake.tsx           | 30 +++++++++++++++++++++---------
 src/pages/app/ContractPage.tsx             |  6 +++++-
 3 files changed, 43 insertions(+), 17 deletions(-)
```
```
$ npx tsc --noEmit           → 0 errors
$ npm run typecheck:api      → 0 errors
$ npm run lint                → 45 problems (0 errors, 45 warnings) — matches baseline 45w/0e at
                                 b846b227; none of the 45 are in the three touched files; no new
                                 react-hooks warnings
$ npm run build               → exit 0, all 8 routes prerendered, sitemap + robots written
$ npm run test:api            → 7 passed (7)
$ npx vitest run src/lib/normalize.test.ts → 42 passed (42)
```
`test:db` not run, per §5.8/D-rule (red at baseline, proves nothing).

**9.** THE REACH — §3 below.
**10.** §3b — its own heading below.

## 3. THE REACH — what a person clicks

| Door | Path | Who |
|---|---|---|
| 1a | `/app/ops/accounts/new` (`AccountInvitePage.tsx:30`, `source="new"`) → *Their details* | staff |
| 1b | Records → a person → **Contact dossier** → the invitation section (`ContactDossierModal.tsx:798` → `ClientInvitationSection.tsx:126`, `source="contact"`) | staff |
| 1c | the lead inbox / dashboard lead panel → **LeadWorkDrawer** (`DashboardPanel.tsx:546`, `IntakePage.tsx:167` → `LeadWorkDrawer.tsx:600`, `source="submission"`) | staff |
| 2 | `/app/contracts/:id/start` — reached from `/app/documents` → *Read*, from onboarding, or carried through registration — when the contract still needs the person's address | a party, signed in |
| 3 | `/app/contracts/:id` as staff, on a sale contract with co-buyer elected and unnamed → **Co-Buyer** card → leave the picker empty → the hand-entry grid | staff |

**"Is that the only way?"** `ProvisionClientForm` is one component serving three hosts (1a/1b/1c); one
edit at `ProvisionClientForm.tsx` covers all three — confirmed by reading each host's mount, which all
render `<ProvisionClientForm>` with a different `source` prop and no local re-implementation of the
`ident`/email fields.

**The ten-door table, re-run today** (`grep -rn 'address_line1\|address_street\|postal_code\|address_zip\|address_city\|address_state\|address_line2' src`):

| # | Surface | State |
|---|---|---|
| 1–4 | `Onboarding.tsx` · `SignStart.tsx` · `ContactDossierModal.tsx` · `CaptureInfoModal.tsx` | ✅ WIRED — SIGNFLOW-B |
| 5 | `ProvisionClientForm.tsx` | ✅ **WIRED — this task** |
| 6 | `ContractIntake.tsx` | ✅ **WIRED — this task** |
| 7 | `ContractPage.tsx` co-buyer grid | ✅ **WIRED — this task** |
| 8 | `DocsParticipantFlow.tsx` | **CONFIRMED DELETED** — `docs/reports/TASK-SIGNFLOW-D-REPORT.md:15,134`; `find src -iname '*DocsParticipantFlow*'` → 0 hits |
| 9 | `AccountInfoCard.tsx:138-153` — tenant's own address | ❌ NOT WIRED — out of scope (§5): its `onBlur` already commits, wiring it is a different shape (normalise-then-commit in one handler), not this task |
| 10 | `HorseIntakeForm.tsx` — vet business / horse location, not a person | ❌ NOT WIRED — out of scope (§5): not a contact field |

## 3b. §3b — EVERY CONTACT FIELD, NOT ONLY ADDRESS (reported under its own heading, as required)
All three surfaces had zero normalisation on name/phone/email too (measured, §2 of spec — `grep` for
`useFieldNormalizer\|normalize(` → 0 hits pre-change). Wired the full set:
- `ProvisionClientForm.tsx`: email, first_name, last_name, phone, address_line1, city, state, postal_code — 8 fields.
- `ContractIntake.tsx`: first_name, last_name, email, phone, address_line1, address_line2, city, state, postal_code — 9 fields. The 4 `vet_*` fields (`vet_address_line1/city/state/postal`) deliberately left untouched — `normalizeKindForField` derives `null` for them by design (§5), and no new key was added.
- `ContractPage.tsx` co-buyer grid: first_name, last_name, email, phone, address_line1, city, state, postal_code — 8 fields, all via one derivation over the mapped `[k, label]` array.

## 3c. §2c's THREE QUESTIONS
This task writes no new field — it changes WHEN an existing value is transformed before being stored
through the SAME three writers that already existed (`update_contact_record`, `captureContactInfo`,
`setDocumentCoBuyer`). Nothing new is captured, so:
1. **CAPTURE → seen?** Same as before this task — each writer's existing consumer (contact dossier,
   the contract's own re-composed body, the co-buyer's dossier) already reads the value back. This
   task changes its shape, not its visibility.
2. **SEEN → acted on?** Unchanged by this task.
3. **What else does the outcome need that nobody asked for?** Nothing identified — this is a format
   change on an existing write path, not a new capability.

## 4. FLAGGED, NOT FIXED
- `ContractPage.tsx` still has 3 `barn` hits (T8/`RANCHWORD`, D43) — untouched, as instructed.
- `test:db` red at baseline — not chased, not reported further, per standing rule.

## 5. DECIDED, NOT IN THE SPEC
- The spec's item 2 for `ContractIntake.tsx` said "same derivation" as the dossier's IIFE form; its
  item 3 for `ProvisionClientForm.tsx` said explicit kinds are "fine" for explicit inputs. Since
  `ContractIntake`'s 9 contact inputs are also explicit (not a `.map()`, unlike `ContractPage`'s grid),
  the choice between the two was not spelled out by the letter of the surrounding text. Followed the
  literal HOW given for item 2 — derivation via `normalizeKindForField(k)` inside the dossier's IIFE
  shape, one call site per field, rather than substituting the item-3 explicit-kind idiom — since the
  spec drew that line deliberately between the two files and TASK-ROLE.md §7 says an HOW that's given
  is executed, not re-opened.

## 6. WHERE THE SPEC WAS WRONG
Nothing found wrong. Every measured fact in §2 of the spec (line numbers, state shapes, hook location,
zero prior hits) checked out against today's tree at `d45edb72` (spec was authored against `b846b227`;
main has moved but nothing spec-relevant shifted).

## 7. NUMBERS
```
tsc --noEmit        0 errors
typecheck:api        0 errors
lint                  45 problems, 0 errors, 45 warnings (baseline; none new, none in touched files)
build                 exit 0
test:api              7/7
normalize.test.ts     42/42
```

## 8. THE OWNER'S RENDER CHECKLIST
Run on `wt-1` after `npm run dev` (or against the merged build). Type the owner's example exactly as
given: `752 windemere ct` / `san diego` / `ca` / `92109`, name `pamela godde`, phone `6195551234`,
email `Pamela@Example.COM`.

1. **Door 1** — open any of: `/app/ops/accounts/new` (Their details), a contact's dossier → invitation
   section, or the lead inbox → LeadWorkDrawer. Type the example into email/first/last/phone/address
   fields, blur each. Expect: `752 Windemere Ct` · `San Diego` · `CA` · `92109` · `Pamela Godde` ·
   `(619) 555-1234` · `pamela@example.com`. Save, reopen the contact dossier, confirm the stored value
   equals the shown value on every field.
2. **Door 2** — `/app/contracts/:id/start` on a contract still missing the party's address. Same 9
   contact fields, same expected results. Also fill the 4 vet fields (if shown) with lowercase text and
   confirm they do NOT normalize.
3. **Door 3** — on a sale contract as staff with co-buyer elected and no co-buyer named yet, open the
   **Co-Buyer** card, leave the picker empty, type the example into the 8 grid fields, blur each; same
   expected results. Click **Add co-buyer**, then open the new party's contact dossier and confirm it
   holds the normalised values.
4. **Click-without-tab** — on each of the three doors, type the ZIP last and click Save / Add co-buyer
   directly without tabbing out first. Confirm the saved value is the normalised one (T2 — the button's
   `mousedown` blurs the field before `click` fires).
5. **D22 on Door 2** — after submitting, open the contract body and confirm it prints
   `752 Windemere Ct, San Diego, CA 92109` via `compose_address` — not the lowercase you typed.
6. **No-refight guard** — on all three doors, correct `Ct` back to `ct` in the street field and blur.
   Confirm it stays `ct` (does not re-correct).
7. **Must-not-change cases**, one blur each on a State box: `California`, `Baja California`; a ZIP box:
   `SW1A 1AA`; a city box: `SAN DIEGO`. Confirm each stays exactly as typed, unchanged.

## 9. TEARDOWN CENSUS
No dev server, browser, or scratch worktree started this session. Nothing to tear down beyond the
claimed `wt-1` (left checked out on `task/signflow-g`, commit `31e8b958`, for ORCH to merge/reclaim).

---
Hand this back to the thread that dispatched `FHE-TASK-SIGNFLOW-G`.
