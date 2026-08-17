# CLOSED — every family removed by machine-closing, with its evidence

Nothing here is on your sheet. Each line names the commit, migration, policy or query that proves it,
and confirms the fix is real. Spot-check freely: a bad reading here is the only way something live
could have vanished.

**A decision (D1–D15) was never used as a reason to close anything.** Where a decision bears on an
item, it stayed on `DECIDE.md` with a factual status.

---

## A. Closed by evidence found in this pass (queried or read today)

| # | family | evidence | confirmed real |
|---|---|---|---|
| C01 | A function that voided every signature on any document, callable by anyone, with no caller | migration `20260810T0100_noguard2_drop_void_signatures_on_edit.sql` | `pg_proc` has no `void_signatures_on_edit` today — the function is gone, not guarded |
| C02 | Three gift functions whose guard silently passed for anonymous callers | NOGUARD1/2 coalesce fixes | prod: all three bodies now contain `coalesce`; the guard evaluates |
| C03 | Two functions that dumped the whole customer roster to an unauthenticated caller | NOGUARD2/3 revokes | prod: `has_function_privilege('anon', …)` = false for both |
| C04 | A function that confirmed a booking without payment | NOGUARD2 revoke | prod: anon EXECUTE = false |
| C05 | Two functions that let anyone forge or suppress receipt evidence | migration `20260816T2000_receipt_rpcs_service_role_only.sql` | prod: anon **and** authenticated EXECUTE both false — service role only |
| C06 | A wrapper that laundered a missing privilege for the lease reminder sweep | NOGUARD2 revoke | prod: anon EXECUTE = false |
| C07 | Three live holes where a staff caller with no business admitted a write | migration `20260812T1200_guardrest_coalesce_bare_definer_guards.sql` | named in TASK-GUARDREST-REPORT.md with before/after proofs; the guards now coalesce |
| C08 | Two feed functions that let any account rewrite the nine author-less posts | NOGUARD3 Phase A | fixed per TASK-NOGUARD3-REPORT.md; the NULL-author route is closed (the functions remain granted, which is item 80's separate point) |
| C09 | A function that let any signup mint a purchase marked paid | NOGUARD3 Phase B revoke | prod: anon EXECUTE = false |
| C10 | A function that returned the whole tenant record to an unauthenticated caller | NULLUID fix | prod: anon EXECUTE = false |
| C11 | A template-cloning function reachable by unauthenticated callers | migration `20260807130000_leasefork_clone_grant_hardening.sql` | prod: anon EXECUTE = false |
| C12 | Two inverted guards that exempted the unidentified caller | migration `20260811T0400_noguard3_inverted_guards.sql` | rewritten defensively per the report |
| C13 | Three authoring functions granted to anonymous callers | migration `20260815T1100_partystaging_revoke_anon.sql` | prod: anon EXECUTE = false on all three (authenticated retained, correctly) |
| C14 | Five contract-field mutators reachable without identity | NOGUARD2 revokes | prod: anon **and** authenticated EXECUTE both false for all five. (One sibling, `fill_party_fields_from_contacts`, is still open — item 79) |
| C15 | The co-buyer remover's *reachability* (deletes parties with no check) | NOGUARD2 revoke | prod: anon and authenticated EXECUTE both false. (The assert-ordering defect stays on the sheet as item 27) |
| C16 | The member directory readable without signing in | SECFIX anon revoke | prod: neither public role holds SELECT on `member_directory` |
| C17 | Four more anon-readable views (clients overview, inbound queue, memberships, service credits) | SECFIX anon revokes | prod: no SELECT for `anon` on any of the four |
| C18 | The account-provisioning function callable by anyone | migration `20260807140000_secfix_s3_ensure_client_account_execute.sql` | prod: anon EXECUTE = false |
| C19 | A party could not read their own party row | migration from TASK-PARTYRLS (`document_parties_self_read`) | prod `pg_policies`: the policy exists on `document_parties` |
| C20 | A signer could not read their own signature row | migration from TASK-SIGREAD (`signatures_self_read`) | prod `pg_policies`: the policy exists on `signatures` |
| C21 | Contract starters never created the party controls, so no invite interface appeared | later contract work | prod: both `start_lease_contract_v2` and `start_sale_contract` now reference `document_party_controls` |
| C22 | The horse-document sweep could soft-delete two executed signed documents | migration `20260810T1500_horsedocs_signed_docs_never_swept.sql` | prod body now protects EXECUTED **and** any document carrying a live signature |
| C23 | Superseding a document ignored which horse it was for | migration `20260810T1700_supersede_horse_scoped.sql` | prod: the body now references `horse_id`. (The blank-horse case is item 105) |
| C24 | Two voided leases were offered for signature on the acquisition home | COUNTFIX | prod: `my_contract_documents` now filters VOID |
| C25 | Every document opened in the wrong viewer from one page | new `src/lib/documentHref.ts` | adopted at `Admin.tsx:253` and `:524` and `DocumentQueueTable.tsx:136` |
| C26 | Six unresolved template-version decisions the signing wall was enforcing | WALLSYNC + later resolutions | prod: `template_version_events` → 12 rows, **0** unresolved |
| C27 | The re-signature request wrote nothing for anyone already holding the assignment | WALLSYNC migration | rewritten to use supersession per TASK-WALLSYNC-REPORT.md |
| C28 | Structural authoring was blocked while a document was in review | migration `20260812T2100_inreview_widen_authoring_rpcs.sql` | prod: four of the five RPCs now permit `in_review`; the fifth was rebuilt by `20260815T1000_partystaging_edit_vs_suggest.sql` onto a permission check with no state lock. Either way the block is gone |
| C29 | Staff had no personal account link in any menu | later navigation work | prod code: `AccountNavLink` is live in the staff rail (`AppLayout.tsx:1931`) and the mobile menu (`:2130`) |
| C30 | One page held the app's only RSVP control | later community work | `setRsvp` is now called from `src/components/feed/PostModal.tsx:259` as well — no longer single-sited |
| C31 | Lesson lists served availability slots as lessons (318 rows where 39 existed) | commit `ffbb296` | `src/lib/ops/api-lessons.ts` now excludes available slots and gives the complement its own named reader |
| C32 | The public acquisition page rendered zero of three services | COUNTFIX 1.5 | `src/lib/publicCatalog.ts:22-29` documents the removal of the price filter; prod confirms all three services are unpriced and now included |
| C33 | The horse-records document count counted the wrong thing | later fix | prod body now reads `count(*) FROM documents d WHERE d.horse_id = h.id` |
| C34 | A broken staff view that errored when executed | removed | prod: `pending_fee_candidates` does not exist |
| C35 | Enquiries were never linked to a person (every request since 2026-08-02 was unlinked) | migrations `ab283cb`/`204cc4f` (TASK-REQTRIGGER) | prod: 14 of 16 enquiries now carry a person; the 2 legacy rows are item 180 |
| C36 | A domain check hid the Google activation control from every eligible member | later GOOGLEAUTH work | `LoginSecurityCard.tsx:132` now reads the server's identity list and states "NEVER inferred from the email" |
| C37 | Money rendered as a bare number on every draft re-compose | later fix | prod: `remerge_contract_from_clauses` now calls `fmt_money`. (Unrendered — item 10) |
| C38 | The document editor's grid had a hard column floor that broke narrow screens | later fix | `ClauseDocument.tsx:579` now uses zero-minimum tracks. (The never-wrap label is item 169) |
| C39 | The test fixture's display-code sequences were unset, killing 21 test files | `alignDisplayCodeSequences()` in the harness | named and fixed in TASK-TESTDB-REPORT.md |
| C40 | One of two pre-existing interface test failures | the file was deleted since the baseline | `git diff --diff-filter=D 6a58c0f..HEAD` lists `test/ui/reviewnav_section.tsx`. (The other file remains — item 238) |
| C41 | Notification checkboxes that wrote nothing on every account, forever | TASK-PROFILE | replaced with informational rows; the remaining question is item 70 (no producers) |
| C42 | Gift redemption assigned zero onboarding documents to every recipient | TASK-GIFTCREDITS | fixed and proven by row counts in that report |
| C43 | A gift recipient hit a dead end after registering | new `api/register-gift.ts` | built and proven in TASK-GIFTCREDITS-REPORT.md |
| C44 | Gift redemption failed for any genuinely new recipient (no account row) | TASK-GIFTCREDITS | fixed by mirroring the existing insert; proven in that report |
| C45 | One dead helper function nothing called | SECFIX2 G1 | prod: `ensure_gift_buyer_account` closed and unreferenced |
| C46 | The invitation endpoint flattened every failure to one message | TASK-INVITEFLOW | fixed; verified in `verified-IDENTITY.md` ID-40 |
| C47 | A "dry run" that applied to production because the migration carried its own transaction | recorded and closed | `verified-IDENTITY.md` ID-41. (The pattern itself is item 86) |

## B. Closed in the two already-verified slices, and re-baselined against the 185 new commits

Both slices were judged at `6a58c0f` (2026-08-13). `main` is 185 commits ahead. I re-baselined by
listing every file changed in that range (`git diff --name-only 6a58c0f..HEAD`) and checking each
family's cited file against it. **These 25 stand.** Spot-checked four against current code — the
footer fix, the lesson-slot filter, the layout backstop and the deleted header files — all four
confirmed.

CLOSED in `verified-UI.md` (7): UI-01 test mock shape · UI-05 duplicate footer links · UI-06 empty
directory page · UI-10 the main-area overflow backstop · UI-15 the drawer header row · UI-26 slots
shown as lessons · UI-32 the header shadow decision.
SUPERSEDED in `verified-UI.md` (2): UI-13 the ring-versus-fill question · UI-14 twelve findings
against the shelved header.
CLOSED in `verified-IDENTITY.md` (14): ID-04 · ID-06 · ID-08 · ID-12 · ID-25 · ID-28 · ID-40 · ID-41
· ID-53 · ID-79 · ID-80 · ID-81 · ID-83 · ID-92.
SUPERSEDED in `verified-IDENTITY.md` (2): ID-13 the intake page · ID-78 the long modules group.

**The re-baseline result, stated plainly: of the 120 items those two slices had marked OPEN, 4
flipped to closed** — ID-82 (staff account link, C29), ID-16 (single RSVP control, C30), UI-05's
code half (C31 group) and UI-24 remains open. The other 116 were re-checked against the changed-file
list and are on the sheet. Four of the five files the biggest UI families point at
(`PostModal.tsx`, `SessionNotesView.tsx`, `HorseIntakeForm.tsx`, `seed.ts`, `tailwind.config.js`)
were **not touched** in those 185 commits, which is why so few flipped.

## C. Folded, not closed — 13 duplicate pointers

These were numbered in `FAMILIES.md` before the cross-slice merge finished and are duplicates of a
family that is on the sheet. Nothing was dropped: F022→F010 · F074→F008 · F078→F008 · F113→F085 ·
F271→F238 · F339→F038 · F366→F028 · F389→F388 · F488→F450 · F603→F404 · F611→F602 · F655→F654 ·
F661→F614 · F664→F654.

---

# THE ACCOUNTING

```
975 raw flagged items (all 104 reports)
  → 609 families after deduplication within and across all 8 slices
  →  61 machine-closed with evidence (47 in section A, 25 in section B, minus 11 that appear in both)
  →  13 duplicate pointers folded (section C)
  → 535 families survive on DECIDE.md, presented as 438 decision blocks
     (37 of those blocks group several same-shape record-only families — each says how many)
  →  14 of the 535 are flagged MOOT?
```

Every one of the 975 is therefore either in a family on `DECIDE.md`, in a closed family above, or in
a folded pointer. **Nothing vanished unaccounted for** — the mechanical proof is in
`TASK-HARVESTCLOSE-REPORT.md` §5.
