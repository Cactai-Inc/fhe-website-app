# HARVESTCLOSE Phase 1 — the ONE family list (all 975 raw items)

Nothing is judged in this file. It exists to prove the collapse and to be the single list swept in Phase 3.

Notation: `ca:` slice-CONTRACT-A · `cb:` slice-CONTRACT-B · `sec:` slice-SEC · `df:` slice-DOCFLOW ·
`db:` slice-DB-MISC · `em:` slice-EMAIL · ids are `batchN#M` shortened to `N#M`.
`UI-nn` / `ID-nn` = families already deduped in `verified-UI.md` / `verified-IDENTITY.md` (72→51 and
109→99); those two collapses are reused as input, and the families are merged ACROSS slices here.

---

## A. VERIFICATION CAPABILITY — nothing has been seen running (the largest recurrence)

F001 | No staff/admin browser session exists, so no staff screen has ever been looked at | rank 4
  ca: 3#1, 3#61, 3#95, 4#101, 5#51, 5#74, 5#87, 5#105, 6#29, 8#14, 8#47
  cb: 1#12, 1#81, 2#83, 3#8, 3#87, 3#98, 3#119, 3#120, 4#119, 4#120, 4#129, 5#33, 5#34, 5#56, 5#115, 6#8, 6#24, 6#30, 6#31, 7#2, 8#69, 8#77, 8#78, 8#87
  sec: 1#86, 2#65, 2#101, 6#60
  df: 1#1, 1#143, 1#156, 4#6, 4#46, 4#61, 4#73, 5#53, 6#73, 7#82, 8#21
  db: 1#22, 1#96, 4#41, 7#45, 8#28
  em: 2#36, 3#2
  folds: UI-04 (11 raw), ID-19, ID-49, ID-97
F002 | No member/rider session either — the member-side flows are unobserved | rank 4
  folds: ID-57 (gift path), ID-62 (community/profile), ID-94, ID-95, ID-96, ID-98
F003 | Nothing has been checked on a real phone (iOS scroll physics, landscape header, tap) | rank 4
  ca: 3#96 · cb: 5#57, 8#63 · df: 3#105 · folds: UI-20, UI-49
F004 | Worktrees carry no app credentials/node_modules, so build+prerender+PDF cannot run | rank 4
  cb: 2#25, 6#61 · df: 7#83 · folds: UI-11, ID-99
F005 | The admin/superadmin gate rests on a simulated JWT, never an observed session | rank 5
  folds: ID-50, ID-93
F006 | No live email has ever been sent and confirmed end to end through the deployed path | rank 4
  em: 1#94, 2#6, 2#53, 4#7, 5#80, 7#55 · sec: 2#7, 2#35
F007 | Google identity linking is unproven for this project (and the dashboard flag is unknown) | rank 3
  em: 1#73, 1#74, 1#76 · cb: 1#75, 1#79 · sec: 7#9 · folds: ID-64
F008 | "Reachable" was proven, "exploitable" was inferred — the guard audits are code readings | rank 5
  sec: 4#88, 4#89, 6#80, 6#81, 7#104, 7#105, 7#107, 7#109, 1#133, 1#134, 4#90, 4#91, 7#110, 1#135

## B. THE TEST SUITES

F010 | test:db / the PGlite suite is not a green baseline and proves nothing today | rank 4
  df: 1#14, 6#85, 6#88, 7#46, 8#15, 8#94, 3#86, 5#113, 2#2 · db: 1#104, 2#73, 6#25 · em: 7#67
  cb: 6#41, 8#99 · ca: 4#103, 6#96 · sec: 7#123
F011 | The snapshot fixture's hand-maintained allowlist silently breaks suites (SNAPSHOT_DATA_TABLES) | rank 5
  ca: 7#116 · df: 8#100
F012 | ~16 REVOKE-asserting tests cannot pass because the snapshot carries no grants | rank 5
  sec: 7#120
F013 | 8 test files die on the retired provision_lesson_invitation / engagements helper | rank 3
  df: 7#121
F014 | The suite's display-code sequences were unset in the fixture (21 files died) | rank 6
  df: 7#115
F015 | Two named test files are broken by their own stale references (golden_render, service_catalog) | rank 5
  db: 2#1 · ca: 2#17
F016 | One broken migration makes a from-empty replay impossible (enforce_launch_modules FK) | rank 4
  db: 5#2
F017 | Tests assert a module set production contradicts (all six modules are ON) | rank 5
  db: 7#124
F018 | The vitest maxWorkers cap that halves runtime was deliberately not committed | rank 6
  db: 7#125
F019 | ~31 migrations rewrite function bodies and are not replayable on a fresh database | rank 5
  db: 2#18, 4#132
F020 | Two pre-existing test/ui failures (pluspass_create_controls, reviewnav_section) | rank 5
  ca: 1#82, 3#85, 8#102 · db: 2#64, 4#58 · em: 3#31 · folds: UI-33
F021 | The one test that caught a real bug was thrown away, and that bug class is invisible to CI | rank 5
  db: 3#97 · ca: 3#6
F022 | The contract/document DB suite is 9-red on main independently of any task | rank 6
  ca: 4#103 (see F010)

## C. PROCESS, TOOLING AND INCIDENTS

F025 | Concurrent threads in one shared checkout kept losing and mis-attributing work | rank 3
  em: 2#38, 4#1 · db: 1#21 · df: 4#2, 6#87 · cb: 5#39 · ca: 1#118, 1#115
F026 | A migration's own BEGIN/COMMIT defeats the house dry-run wrapper — applied for real | rank 3
  cb: 2#43, 2#79, 4#123 · folds: ID-41
F027 | The documented lint baseline is wrong (~26 stated, 36 measured) | rank 6
  db: 6#27, 8#57, 4#8 · df: 2#72, 3#100, 5#86, 6#74, 8#74, 8#95, 1#155 · cb: 5#50
F028 | Disk space and iCloud have twice destroyed or hidden worktrees | rank 4
  db: 1#144 · df: 6#87 (see F025) · folds: ID-92
F029 | "Did it land?" must be tested on content, not on a commit SHA | rank 6
  cb: 1#107, 1#108, 1#109
F030 | Rolled-back proofs burn display-code sequence numbers, leaving visible gaps | rank 6
  db: 7#47
F031 | A dead migration was left in the journal because the journal records what was run | rank 6
  cb: 1#116
F032 | Production is not quiescent while tasks run — snapshots drift mid-task | rank 5
  cb: 1#137, 1#132 · sec: 4#91
F033 | Prod was written in two passes for grants; the migration reflects only the end state | rank 6
  sec: 7#49
F034 | A branch name that pushes somewhere else (work/ui-design → origin/main) | rank 6
  cb: 8#5
F035 | The governing spec lived outside the repo (~/Downloads) | rank 6
  db: 2#9
F036 | Phase B was held for review and the review loop was never closed by the orchestrator | rank 6
  db: 4#92 · df: 7#93
F037 | A branch point named in a task doc was already stale when the thread started | rank 6
  db: 8#56 · df: 4#124
F038 | Task docs and manifests go stale within hours; downstream work must re-derive | rank 5
  df: 1#70 · folds: ID-65
F039 | The session_replication_role=replica cleanup practice is the standing data hazard | rank 2
  cb: 5#29, 5#31

## D. GRANTS AND THE DEFINER-FUNCTION SURFACE

F045 | ROOT CAUSE: the schema default grants EXECUTE on every new function to anon | rank 2
  sec: 6#83, 7#48, 7#101
F046 | A REVOKE that does not name anon, authenticated AND PUBLIC is a silent no-op | rank 2
  sec: 1#92, 3#30, 5#89, 5#90, 7#102
F047 | ~48 definer functions relying on a PUBLIC-revoke alone were never audited | rank 2
  sec: 6#56, 6#75
F048 | 76 of 285 anon-reachable definer functions enforce no access rule (38 of them write) | rank 2
  sec: 7#94
F049 | 45 functions were left DOES-NOT-ENFORCE with reasons, as a designed third phase | rank 2
  sec: 1#127
F050 | The authenticated surface (≈396 functions, "one signup away") has never been measured | rank 2
  sec: 1#130, 6#82, 7#90, 7#103
F051 | void_signatures_on_edit: anon-reachable, no identity check, no caller — voids any document | rank 2
  sec: 7#87, 7#95 · cb: 7#92
F052 | remove_document_co_buyer deletes BUYER parties with no identity check | rank 2
  sec: 1#122, 7#85
F053 | ...and it calls the signature-lock assert AFTER its deletes | rank 2
  ca: 1#123
F054 | The contract_fields mutator family can rewrite any contract; several have no caller | rank 2
  sec: 7#88, 7#98
F055 | Three gift_* guards are present but NULL-propagate for anon | rank 2
  sec: 7#91, 7#97
F056 | Four functions are protected only by a NOT NULL column, not by any access rule | rank 2
  sec: 7#96
F057 | Two unauthenticated full customer-roster dumps (both dead code) | rank 2
  sec: 7#99
F058 | confirm_booking_for_purchase confirms a booking without payment | rank 2
  sec: 7#100
F059 | claim_receipt_send / log_receipt_send let anyone forge or suppress receipt evidence | rank 2
  sec: 3#27
F060 | generate_document is an anon-granted INVOKER function that creates documents | rank 2
  sec: 4#85
F061 | lease_expiry_nudge is a definer wrapper that launders a missing privilege | rank 2
  sec: 7#89
F062 | The vulnerable guard idiom keeps being written — the class regenerates | rank 2
  sec: 4#82 · cb: 5#36
F063 | feed_post_create is safe only by accident (a NOT NULL column stops it) | rank 2
  sec: 4#87
F064 | Document/deal/horse/member readers reachable by id are real info leaks (Phase C) | rank 2
  sec: 4#86
F065 | Three live NULL-org holes found and fixed (attach_horse_to_document, request_booking_change, purge_account) | rank 2
  sec: 7#73, 7#74, 7#75
F066 | feed_post_delete/update let any account rewrite the 9 NULL-author posts — fixed | rank 2
  sec: 4#77
F067 | _provision_purchase_for_offerings let any signup mint a paid purchase — revoked | rank 2
  sec: 4#84
F068 | platform_tenant_detail leaked the whole tenant to anon — fixed | rank 2
  sec: 6#84
F069 | clone_contract_template was anon-executable for the duration of a task | rank 2
  sec: 6#55, 6#79, 7#81
F070 | Two inverted guards (auth.uid() IS NOT NULL AND NOT …) — rewritten defensively | rank 5
  sec: 1#126, 4#83
F071 | record_invitation_failure has no caller check and can burn an invitation | rank 3
  sec: 6#78
F072 | profiles_role_guard's NULL-uid → RETURN NEW shape is a latent hazard | rank 2
  sec: 6#77
F073 | NULL-propagating predicates that take arguments were never evaluated for anon | rank 2
  sec: 6#76
F074 | RLS policies were never audited for their own NULL logic | rank 2
  sec: 6#81 (see F008)
F075 | Corrections to the guard audits' own numbers (7 not 9, 19 not 15, 26/27/31/45) | rank 6
  sec: 1#121, 7#71, 7#84, 7#86 · db: 1#120
F076 | anon holds EXECUTE on the three add/remove-composition RPCs | rank 2
  sec: 6#19
F077 | Dynamic SQL (EXECUTE format) is invisible to every audit method used | rank 5
  db: 7#106
F078 | The three retained service_role paths were privilege-checked but never executed | rank 5
  sec: 1#135 (see F008)
F079 | A new definer function landed mid-audit with the right revokes but the wrong reach | rank 5
  sec: 1#131

## E. RLS AND WHO CAN READ WHAT

F085 | member_directory publishes real emails/mobiles and was anon-readable | rank 2
  sec: 4#10, 4#39
F086 | Four more anon-readable views share the shape (incl. inbound_queue with staff_notes) | rank 2
  sec: 4#11, 5#95
F087 | member_directory still emits the legacy contacts.mobile/whatsapp/email columns, gated by hide_* flags no UI can set | rank 2
  sec: 1#141, 4#25 · em: 2#20
F088 | The directory view still executes as postgres and bypasses RLS — the design is unresolved | rank 2
  sec: 5#88
F089 | member_directory_list gates on "authenticated", not on membership | rank 3
  folds: ID-61
F090 | Whether the accountless contacts' hide_* flags were set deliberately is unrecoverable | rank 5
  folds: ID-36
F091 | A member could repoint profiles.contact_id at another person's contact record | rank 2
  sec: 4#12 · cb: 4#13
F092 | profiles_role_guard is BEFORE UPDATE only — the first insert of a profile is unguarded | rank 2
  sec: 4#14
F093 | _ensure_client_account was anon-executable with no caller check | rank 2
  sec: 4#15, 5#90
F094 | anon and authenticated still hold broad table-level grants on profiles | rank 2
  sec: 5#91, 5#92
F095 | The profiles grant is now a 28-column list — a new column is unwritable until added | rank 5
  sec: 5#96, 5#97
F096 | contacts_update_own has no column predicate: a member can write notes, tags, DOB, is_company | rank 2
  sec: 4#31
F097 | adminUpdateProfile exposes profiles.email as free text, and the email-change proof trusts it | rank 2
  sec: 4#18
F098 | contact_dossier / update_contact_record grant MANAGER-EMPLOYEE what table RLS denies them | rank 2
  sec: 4#34
F099 | contact_dossier returns the entire contacts row, including columns on no screen | rank 2
  sec: 4#35
F100 | Staff-read RLS on documents/contacts/horses was is_admin() while the app treats MANAGER/EMPLOYEE as staff | rank 2
  sec: 4#72, 7#76
F101 | Two-factor authentication is unreachable for any member | rank 2
  sec: 4#23
F102 | invitations RLS is is_admin(), so an instructor sees an empty invitation panel | rank 5
  sec: 1#87
F103 | signatures_select gates staff visibility on is_admin() rather than has_staff_access() | rank 5
  sec: 3#88
F104 | admin_client_documents keeps its pre-existing PUBLIC EXECUTE grant | rank 2
  sec: 5#55
F105 | contacts / requests: support_requests RLS requires a member although the form reads public | rank 5
  sec: 2#33
F106 | Nothing provisions a profile at signup — two real contactless accounts exist | rank 2
  sec: 4#78, 7#77 · cb: 5#17
F107 | A false-alarm lockout was chased down and disproved (test SQL's own RLS filter) | rank 6
  sec: 5#98
F108 | ensure_gift_buyer_account is dead code, and redeem_gift's anon grant is harmless for a different reason than stated | rank 6
  sec: 5#93, 5#99, 5#100
F109 | An admin "view-as" lens is the missing capability behind every party-visibility question | rank 3
  sec: 6#5
F110 | The owner cannot create an instructor account — TeamPage invites ADMIN only | rank 3
  sec: 7#80
F111 | TeamPage vs StaffPage becomes a duplicate the moment mod.employees is on | rank 5
  sec: 1#63
F112 | The MANAGER/EMPLOYEE arm of the email_templates policy is proven by definition only | rank 5
  sec: 7#66
F113 | Whether the anon-readable views are reachable over HTTPS was never proven | rank 5
  sec: 4#39 (see F085)

## F. FILES AND UPLOADS

F115 | "Remove" hard-deletes the bytes — D15 says a linked file must survive | rank 2
  sec: 8#81
F116 | A horse's owner cannot read a Coggins another member uploaded (no cross-member read) | rank 3
  sec: 8#82
F117 | Members cannot create file_links, so only staff can surface a file on a record | rank 3
  sec: 8#83
F118 | storage_admin_all is org-gated but not path-scoped | rank 2
  sec: 8#84
F119 | content_resources.storage_path is now redundant with file_id | rank 6
  sec: 8#86
F120 | None of the nine consuming surfaces for files were built | rank 3
  sec: 8#89
F121 | The Community → Resources card has no download control | rank 3
  df: 8#93
F122 | purge_account does not know about files, leaving a dangling owner | rank 3
  df: 8#80
F123 | File ownership for leads needs a ruling (a lead has no account) | rank 3
  df: 8#91
F124 | Directory-card files are probably org-owned — confirm before building | rank 3
  df: 8#92
F125 | The lessons file-subject grain (package vs session vs credit) must be picked first | rank 3
  df: 8#90
F126 | Staff have no personal Files surface | rank 6
  df: 8#85

## G. DOCUMENTS, PARTIES, SIGNING

F130 | documents_select and my_documents() keyed only on documents.contact_id, hiding a real signer's own documents | rank 2
  sec: 6#2 · ca: 4#75 · cb: 4#74
F131 | document_parties had no party-read policy, so a party's own row returned nothing | rank 2
  sec: 5#16
F132 | signatures_select gates on document ownership, so a signer party cannot see their own signature | rank 2
  cb: 8#75
F133 | contracts and document_party_controls have RLS with zero policies | rank 2
  sec: 8#101
F134 | document_deliveries' party-read arm existed all along (a correction) | rank 6
  cb: 8#76
F135 | The executed-document card's status-stamp trail was specified, never built | rank 3
  sec: 5#24
F136 | Party controls are never bootstrapped by the contract starters, so no invite UI renders | rank 1
  ca: 6#1
F137 | A brand-new counterparty cannot redeem a contract invite (no profiles row, no trigger) | rank 1
  cb: 5#17 (see F106)
F138 | Register.tsx masks the real activation error behind a generic message | rank 5
  cb: 5#18
F139 | The owner's own invite link landed on an unwired page — never reproduced | rank 3
  cb: 5#19
F140 | A17/A18/A19 (self-send copy, download signed PDF) were never reachable | rank 4
  em: 6#3 · cb: 4#76, 6#8 (see F001)
F141 | The company LESSEE party is structurally unverifiable (no login can equal a company contact) | rank 3
  em: 6#4
F142 | The ops viewer offers a sign box for every party, but signing errors for individuals | rank 1
  ca: 4#98 · cb: 6#28
F143 | Five signature-capture surfaces each re-implement the same typed-name + consent rules | rank 5
  cb: 1#55
F144 | 60% of production signatures carry no signing account (kiosk rows, one writer stamps it) | rank 5
  cb: 1#56
F145 | Kiosk signers get a contact with no account and no self-serve route to their document | rank 3
  cb: 2#4
F146 | Kiosk-to-account promotion and the /sign/... short URLs were deferred by the owner | rank 3
  ca: 2#3
F147 | Kiosk releases raise no staff notification of any kind | rank 3
  em: 8#25
F148 | The sessionless release flow hit a stop-and-show gate; three options, nothing applied | rank 3
  em: 2#11
F149 | ensure_horse_documents sweeps with no status filter and has two EXECUTED documents in range | rank 1
  cb: 4#116
F150 | apply_document_supersession ignores horse_id, so one horse's execution supersedes another's | rank 1
  ca: 5#72
F151 | ...and the horse_id predicate must answer the NULL case | rank 3
  ca: 5#73
F152 | Two ready_to_sign documents point at a contract row that no longer exists — signing will error | rank 1
  cb: 3#89 · sec: 7#78
F153 | The orphaned-document cleanup was written, dry-run and deliberately not applied | rank 3
  cb: 5#27, 5#28
F154 | Any second same-transaction update on those documents aborts (not only signing) | rank 1
  cb: 5#32
F155 | The document-integrity check fires on absent keys but not on stale keys held | rank 5
  cb: 5#37
F156 | It cannot be proven that the replica-mode session deleted that contract row | rank 6
  cb: 5#30
F157 | Two retained signed vet authorizations merged with an EMPTY horse name | rank 2
  ca: 5#77
F158 | Executed documents carry literal unfilled {{tokens}} (generated before scoped rows existed) | rank 5
  ca: 1#160, 5#76
F159 | my_contract_documents has no void filter — two VOIDED leases were offered for signing | rank 1
  cb: 1#10
F160 | ...and its staff branch returns every contract in the org under a function named "my" | rank 5
  cb: 1#19
F161 | A member's document count reads 13 on one page and 5 on another | rank 1
  cb: 1#34
F162 | Admin.tsx sends every document to the ops viewer regardless of kind | rank 5
  cb: 1#54
F163 | A superseded document displays as plain "Signed" and the packet count overstates | rank 5
  cb: 5#52
F164 | Staff have no nav route to their own documents | rank 5
  df: 1#18 · cb: 1#69
F165 | The kiosk /release page signs a real document and should be labelled destructive | rank 3
  cb: 1#68
F166 | REQ-25, the documents-page management functions, was never started | rank 3
  df: 8#1
F167 | The PDF renderer cannot be mounted for review (no component, no route) | rank 4
  em: 2#96
F168 | Three document-body renderers exist and the comment claiming one is false | rank 5
  ca: 1#51, 1#66
F169 | The same document shows a styled mark on one screen and raw ⟦NEEDS:⟧ on another | rank 5
  ca: 1#52
F170 | Three copies of the signature-line regex, one already divergent | rank 5
  ca: 1#53
F171 | The documents queue's presets are partly unbuilt (needs-attention, signed library, by horse) | rank 5
  ca: 4#70
F172 | The Templates tab from design v2 was not built | rank 3
  ca: 4#71
F173 | The queue's default view changed from all documents to the five awaiting signature | rank 6
  cb: 4#68
F174 | VOID unreachability was caused by a missing filter, not the reader (a correction) | rank 6
  cb: 4#66
F175 | The "Contract" column shows a raw id prefix; the owner asked for parties instead | rank 6
  cb: 5#25
F176 | Party-column ordering beyond LESSOR/LESSEE is unexercised guesswork | rank 5
  cb: 5#43
F177 | Only the two highest-ranked parties are shown; further parties are dropped silently | rank 5
  cb: 5#44
F178 | The company contact renders unlinked because it has no reachable record page | rank 6
  cb: 5#45
F179 | The default-on date column was an interpretive call | rank 6
  cb: 5#47
F180 | Corrections to DOCCOLS' own arithmetic (37→29 pairs; party_role 'FHE' has no rows) | rank 6
  cb: 5#41, 5#42
F181 | The is_admin() gate on admin_client_accounts was not re-verified end to end | rank 5
  cb: 5#46
F182 | "By person" filters in place instead of deep-linking into the dossier | rank 6
  df: 4#69
F183 | 37 undelivered executed documents predate the stamping trigger and are un-alerted by design | rank 5
  em: 2#27
F184 | True mailbox bounces are invisible (Gmail SMTP gives no webhook) | rank 5
  em: 2#26
F185 | The 6-hour delivery guard is in the executed-document path, not the invitation path | rank 6
  em: 7#70
F186 | A11's lease-effect stamping deliberately skipped the horse-document side effect | rank 5
  ca: 1#2
F187 | No idempotent re-fire wrapper exists for the lease-execution effects | rank 5
  cb: 1#5
F188 | The A16 staff broadcast was folded into party_signed (one-line revert available) | rank 6
  em: 8#24, 8#26
F189 | The company-inbox mirror notice is skipped for targeted sends | rank 6
  em: 4#5
F190 | DeliveryPanel was left out of the ops viewer's admin menu by spec reading | rank 6
  em: 4#4 · cb: 4#3
F191 | Routing flat documents to the one authoring page is the owner's call (DeliveryPanel is the cost) | rank 3
  em: 4#99

## H. THE LEASE — INSURANCE SECTION (LEASEMAP F1–F19 + LEASEGATE)

F200 | The insurance section has never been filled in by any real transaction (22 empty fields) | rank 3
  cb: 3#57 · ca: 2#23
F201 | Three permitted activities produce no risk-acknowledgement clause; one gates nothing at all | rank 5
  ca: 3#32, 3#37
F202 | Choosing OTHER on a deductible select prints "Other" and leads nowhere | rank 5
  ca: 3#33
F203 | The deductible sentence is dead exactly when the Lessee has accepted responsibility | rank 5
  ca: 3#34
F204 | ...and it misdescribes whose policy it is, printing identically either way | rank 5
  sec: 3#44
F205 | Most of the deductible-sync trigger is dead, and GL behaves differently from mortality/medical | rank 5
  cb: 3#36, 3#50
F206 | clause_cut_kept has no effect on this lease and tests three fields it does not have | rank 6
  ca: 3#35
F207 | The one executed lease carries 13 orphaned insurance field rows in a retired vocabulary | rank 5
  ca: 3#38
F208 | An unconditional "Lessor assumes all risk" prints beside the Lessee accepting mortality | rank 2
  cb: 3#39
F209 | MED_TAIL prints inside the same numbered item as statements that say the opposite | rank 2
  cb: 3#40
F210 | COORDINATION names the Lessor's mortality policy two items below a line saying none exists | rank 2
  sec: 3#41
F211 | An entity lessee with mortality waived produces two owners of the same loss | rank 2
  sec: 3#42 · em: 8#43
F212 | The Lessee-responsibility clause always prints beside a contradicting status line | rank 2
  ca: 3#43
F213 | A blank insurance status prints as an affirmative undertaking with a typo | rank 1
  ca: 3#45
F214 | A blank deductible selection prints a bare colon | rank 5
  ca: 3#46
F215 | Blank split shares print an empty allocation | rank 5
  ca: 3#47
F216 | An optional fair-market-value token prints unconditionally, leaving "of." | rank 1
  ca: 3#48
F217 | Nothing anywhere records whether proof of insurance was ever provided | rank 3
  sec: 3#54
F218 | full-vs-partial lease never reaches the insurance section | rank 3
  ca: 3#51
F219 | A Lessee's election does not stay made when the Lessor changes their own status | rank 2
  ca: 3#53
F220 | The Lessor (and staff) can write the Lessee's own first-person undertakings | rank 2
  cb: 3#52
F221 | is_minor_contact is read by no insurance field or clause | rank 5
  ca: 3#55
F222 | The status vocabulary has no word for "cannot" — scenario 4 has only bad moves | rank 3
  cb: 3#56 · ca: 8#42
F223 | Hiding a field with a waiver does not clear its stored value, so stale NONEs re-arm the block | rank 2
  em: 3#49
F224 | The execution-blocker predicate is duplicated verbatim in two places | rank 2
  em: 8#34
F225 | R4 as written makes the owner's live no-insurance arrangement unexecutable | rank 3
  ca: 8#31
F226 | R1 and R2 self-contradict against the live gate evaluator | rank 3
  ca: 8#32
F227 | Phase 2's gates would land on a template no document uses | rank 3
  ca: 8#33
F228 | R3 already exists; the question is whether it should be stricter | rank 3
  cb: 8#30 · ca: 8#41
F229 | Nothing forces the ineligible value, and an empty ineligible required field blocks the lock | rank 3
  cb: 8#36
F230 | A new column not listed in sync_contract_fields_from_defs is silently dropped | rank 2
  cb: 8#35
F231 | The form-side renderer would need the same ineligible treatment; not designed | rank 3
  cb: 8#38
F232 | Q1/Q2 (what replaces the waiver; all sections or only GL) gate everything else | rank 3
  ca: 8#39 · cb: 8#40, 8#46
F233 | The "Not Eligible" affordance diff was written against a frozen file and never compiled | rank 3
  ca: 8#37
F234 | The forced-NONE render and the silent column-drop were read, never run | rank 5
  ca: 8#45
F235 | Assumed: the owner's no-insurance client is on paper — no document matches that shape | rank 5
  cb: 8#44
F236 | Whether the Lessor's own-coverage election should gate anything is still open | rank 3
  sec: 1#119
F237 | The three insurance clauses still carry [PENDING LEGAL REVIEW] bodies | rank 3
  ca: 2#22
F238 | The staged deductible-gating JSON must not be applied before a coherence ruling | rank 3
  cb: 5#4 · db: 2#16 · ca: 5#5
F239 | The insurance "not required" carve-out assumes FHE is always the Lessor | rank 3
  cb: 5#22

## I. THE LEASE AND SALE TEMPLATES

F245 | Four/five lease templates are byte-identical and every content change is a 4× write | rank 3
  ca: 4#94, 4#95, 8#48, 1#72
F246 | HORSE_LEASE v1 is inactive but holds 104 tokens, 98 orphan field defs and body text | rank 3
  ca: 5#10, 5#13, 5#15, 6#58
F247 | V2 and the retired original share one title, so a picker listing by title is ambiguous | rank 5
  cb: 6#59
F248 | MINOR_RIDER is ACTIVE with a full body and zero token rows — it would render raw {{…}} | rank 1
  ca: 1#158, 5#11
F249 | FACILITY_LICENSE and INDEPENDENT_CONTRACTOR are ACTIVE with empty bodies | rank 1
  ca: 4#96, 5#110
F250 | Two more inactive flat templates have empty bodies | rank 6
  ca: 5#109
F251 | Body-less retired-in-practice template rows are still present | rank 6
  ca: 6#97
F252 | The 12 flat templates were never converted to the clause engine | rank 3
  ca: 4#102
F253 | The retainer/representation money tokens render blank — those templates cannot complete | rank 1
  ca: 1#162
F254 | The bill of sale has no picker card and no standalone authoring entry | rank 3
  ca: 4#67
F255 | Placeholder clauses in SALE/BOS are still headingless | rank 5
  ca: 2#76
F256 | The bill of sale's numbering visibly changed | rank 6
  ca: 2#77
F257 | HORSE_SALE_V2 was kept live rather than retired, without sign-off | rank 3
  ca: 8#20
F258 | The sworn affidavit has no content, no template and no home for the notary block | rank 3
  ca: 8#4
F259 | The sale template's identity grid has the same long-location exposure | rank 5
  ca: 3#60
F260 | CARE.INTRO and CARE.SUPPLEMENTS sit under a header neither belongs to | rank 5
  ca: 2#75
F261 | "FHE Approved Trainer" is used in four clauses and defined nowhere | rank 5
  sec: 6#66
F262 | Where the Lessor arranges care, §12.5/§12.6 print labels with nothing after them | rank 5
  ca: 6#67
F263 | TXN.MONTHLY_START is gated on a field that does not exist — it can never appear | rank 5
  ca: 6#54, 6#65
F264 | The simple-lease Keep/Cut worksheet is blank on all 144 rows | rank 3
  cb: 6#64
F265 | The protective/standalone classifications are hand-read judgments | rank 5
  ca: 6#68
F266 | The clone covers four tables — enough today, not in general | rank 6
  ca: 6#63
F267 | Six unresolved template-version events mean the wall enforced a decision nobody made | rank 3
  ca: 4#127, 4#131
F268 | require_resign_from was silently a no-op for anyone already holding the assignment | rank 1
  ca: 4#126
F269 | The lease trio's version is now 3 from a byte-identical publish/revert proof | rank 6
  ca: 5#112
F270 | resolve_version_decision returns 0 on NONE resolutions by design | rank 6
  ca: 5#107
F271 | The gate engine may not support not_equals/any | rank 5
  ca: 5#5 (see F238)

## J. TOKENS AND THE MERGE PATH

F275 | template_tokens.source_table/source_column are documentation, not the resolution mechanism | rank 5
  ca: 1#157
F276 | DOC.UUID and ORD.UUID both map to documents.id — one of the two is wrong | rank 3
  ca: 1#159
F277 | The 17 intake.* tokens always render blank because the capture was never built | rank 3
  ca: 1#161
F278 | Nine retired order-form fee tokens are retire candidates | rank 6
  ca: 1#163
F279 | Two token→column mappings are dead (horses.owner_name does not exist) | rank 5
  ca: 1#164
F280 | Duplicate token wiring awaits rulings (PARTY.*, FHE.* vs ORG.*, PACKAGE_FEE vs SERVICE_FEE) | rank 3
  ca: 1#165
F281 | TOKEN_DICTIONARY.md disagrees with the table in several places | rank 5
  ca: 1#166
F282 | Token descriptions live in the DB and only SQL can edit them (D13) | rank 3
  ca: 1#167
F283 | The stale source-column re-pointing recommendations were left undone | rank 6
  ca: 1#168
F284 | There are two parallel token vocabularies (307 rows and 667 field keys) | rank 4
  ca: 1#169
F285 | Four horse tokens resolve through a third, code-only path with no registry row | rank 5
  ca: 5#12
F286 | HORSE_LEASE_V2 has zero template_tokens rows and renders anyway | rank 6
  ca: 5#14
F287 | The token picker surfaces TOKENAUDIT's unresolved data as-is | rank 5
  ca: 5#108
F288 | {{CLIENT.JUMP_LIMITATIONS}} is editable, declared, and merges into nothing | rank 5
  ca: 4#26
F289 | 'N/A' is stored as NULL on six horse columns, so those tokens render blank | rank 5
  db: 6#45
F290 | remerge (the path run on every draft edit) has none of the money-rendering logic | rank 1
  ca: 2#13
F291 | A line whose only token is unanswered composes as a bare sentence with a full stop | rank 5
  ca: 6#21
F292 | Removing a composed element leaves a dangling {{CUSTOM.…}} token in the prose | rank 5
  ca: 6#20
F293 | No composition has ever landed in production | rank 4
  ca: 6#26
F294 | Structural authoring during in_review blocked Add-item on both live leases | rank 3
  ca: 6#18
F295 | Legacy custom fields could never land inside a template section (headings vs keys) | rank 5
  ca: 2#80
F296 | The muted-preview half of R11 was not built | rank 3
  ca: 2#78
F297 | The terminal-punctuation rule only punctuates token-bearing lines | rank 5
  ca: 2#81
F298 | R11 disclosed three deviations (a new RPC, a composite RPC, two new columns) | rank 6
  ca: 2#82
F299 | The gate chicken-and-egg fix double-renders a gate-driving field | rank 5
  ca: 5#23
F300 | generate_lease_availability parses a prose sentence as a comma list | rank 5
  ca: 7#39
F301 | ...and it was unreachable until retargeted; the feature has never run | rank 5
  ca: 7#40

## K. IDENTITY, PEOPLE PAGES, ACCOUNT

F310 | Creating a person files them as CONTACT whatever tab you created them from | rank 1
  folds: ID-01
F311 | The review mount of the contact form has a deliberately inert submit | rank 6
  folds: ID-02
F312 | Two contact editors, two field sets, two write paths on one page | rank 5
  folds: ID-03
F313 | Contact components had no route and could not be reviewed | rank 6
  folds: ID-04
F314 | FormField + pre-submit validation must be carried before the small form is retired | rank 4
  folds: ID-05
F315 | The "Unfiled" banner is the only contact_type setter | rank 6
  folds: ID-06
F316 | The four TEAM-typed contacts appear on no people page | rank 3
  folds: ID-07
F317 | The Contacts retirement was half-applied (nav row still shown) | rank 6
  folds: ID-08
F318 | The instructor Clients tile points at a retired route | rank 6
  folds: ID-09
F319 | Every instructor session row is literally named "Client" | rank 1
  folds: ID-10
F320 | Nothing sweeps expired invitations, so "sent" counts read as live | rank 2
  folds: ID-37
F321 | The "13 sent never redeemed" number was twelve test sends plus one real address | rank 6
  folds: ID-38
F322 | Eight of the nine pending roster rows have no invitation at all | rank 2
  folds: ID-39
F323 | Four INVITEFLOW follow-ups were left unstarted (partly overtaken) | rank 4
  folds: ID-42
F324 | provision_client_invitation — the account spine — has zero test coverage | rank 2
  folds: ID-43
F325 | The lead-capture trigger's "ambiguous match" branch does not exist (a correction) | rank 5
  folds: ID-44
F326 | No audit was done of code reading requests.contact_id with the old semantics | rank 5
  folds: ID-45
F327 | A methodology lesson with no home: RETURNING does not show an AFTER trigger's work | rank 6
  folds: ID-46
F328 | Should the schedule-lesson path mark a request converted? It never has | rank 3
  folds: ID-47
F329 | Nothing that converts a lead sets contact_type or goes through the spine | rank 3
  folds: ID-48
F330 | Roster credits are summed, not itemised | rank 6
  folds: ID-51
F331 | "Not yet invited" is flagged only for pending rows, not bare contacts | rank 3
  folds: ID-52
F332 | The frontend roster type had drifted from the RPC | rank 6
  folds: ID-53
F333 | No live contact has consumed a horse-care service; the roster row was a labelled demo | rank 4
  folds: ID-54
F334 | The Active-first sort key was lost in the port | rank 6
  folds: ID-55
F335 | The gift CUSTOMER-marker branch may never fire against real inventory | rank 4
  folds: ID-56
F336 | The gift coalesce fix narrowed a NULL-buyer gift to staff-only | rank 5
  folds: ID-58
F337 | A single-direction Gifts header needs a structural change | rank 6
  folds: ID-59
F338 | The mixed-cart "Price on enquiry" render has never been seen | rank 4
  folds: ID-60
F339 | Retirement-by-boolean means any copied list of retired pages goes stale | rank 5
  folds: ID-65 (see F038)
F340 | A microchip of "N/A" hijacks the next owner's horse | rank 2
  folds: ID-66
F341 | suggested_category_for_contact still tests two retired template keys | rank 6
  folds: ID-67
F342 | save_calendar_item's edit branch overwrites four foreign keys unconditionally | rank 1
  folds: ID-68
F343 | The booking ledger carries almost no links: 294/319 have no client, 0 have purchases | rank 3
  folds: ID-69 · db: 7#32, 7#37 · cb: 7#30
F344 | Composite-argument functions were ranked by reasoning, not tested | rank 5
  folds: ID-70
F345 | No positive-path proof was ever run for the lesson-booking gate | rank 5
  folds: ID-71
F346 | The specified adversarial company proof is blocked by a real unique index | rank 5
  folds: ID-72 · ca: 4#65
F347 | There is no admin order surface of any kind | rank 4
  folds: ID-73
F348 | A whole sales-KPI / P&L backend exists as a migration nothing ran and nothing reads | rank 4
  folds: ID-74
F349 | Duplicate nav glyphs — Contact fixed, Shield ×7 not | rank 6
  folds: ID-75 · cb: 6#71, 6#72
F350 | The wording editor still lives under the temporary Review section | rank 3
  folds: ID-76
F351 | Records must return to the nav WITH its module key | rank 4
  folds: ID-77
F352 | Eleven rows in one Modules group may read as clutter | rank 6
  folds: ID-78
F353 | The employees review slot rendered a locked fallback | rank 6
  folds: ID-79
F354 | Two Stable nav links pointed at a redirect | rank 6
  folds: ID-80
F355 | Nav labels were internally inconsistent ("Stable" vs "My Stable") | rank 6
  folds: ID-81
F356 | Staff have no personal Account link in ANY nav surface | rank 1
  folds: ID-82
F357 | Changing only one nav component would split the active-state look | rank 6
  folds: ID-83
F358 | The avatar menu's link component has no badge slot | rank 6
  folds: ID-84
F359 | The account-menu block still carries the old hover fill (eight sites) | rank 6
  folds: ID-85
F360 | The Add-New divider went only to the staff rail | rank 6
  folds: ID-86
F361 | A comment the order asked to change did not need changing | rank 6
  folds: ID-87
F362 | Was the staff rail meant to go green too? | rank 3
  folds: ID-88
F363 | The account dropdown's max-height still assumes the old header | rank 6
  folds: ID-89
F364 | A regular member has no create affordance in the chrome at all | rank 3
  folds: ID-90
F365 | The Lessons nav inclusion is built and awaits go/no-go | rank 3
  folds: ID-91
F366 | A build failed with ENOSPC at 99% disk | rank 6
  folds: ID-92 (see F028)
F367 | The account page's My Lessons row has no lessons-module gate | rank 5
  folds: ID-27
F368 | The account hub's 10-row order is not owner-ranked | rank 3
  folds: ID-29
F369 | An Account row icon was changed without acknowledgement | rank 6
  folds: ID-30
F370 | My Posts' create control is page-only, absent from the Account panel | rank 3
  folds: ID-31
F371 | Orders' list item navigates outside /app | rank 6
  folds: ID-32
F372 | Two writes on the member's own account do not prove they landed | rank 2
  folds: ID-33
F373 | Contact preferences write one row per keystroke and swallow the error | rank 1
  folds: ID-34
F374 | Emergency contacts are presented as immutable but are writable elsewhere | rank 5
  folds: ID-35
F375 | The label question "Profile & preferences" vs "My Profile…" | rank 6
  folds: ID-28
F376 | AccountHub reads ?section= only in its initializer | rank 5
  folds: ID-26
F377 | ...and those deep links are referenced nowhere | rank 6
  df: 4#28
F378 | "Saved Content" has no data model and can never contain anything | rank 4
  folds: ID-24
F379 | Saved Content became unreachable from mobile nav | rank 6
  folds: ID-25
F380 | /account is a dead page duplicating a status map and a money formatter | rank 4
  folds: ID-22
F381 | /account bounces members yet is still the default post-login destination | rank 5
  folds: ID-23
F382 | The dashboard has no loading and no error branch — a failed read reads "all caught up" | rank 1
  folds: ID-14 · db: 1#17
F383 | The Schedule page force-casts one type and mislabels the staff view | rank 5
  folds: ID-15
F384 | Schedule.tsx holds the app's only RSVP control | rank 4
  folds: ID-16
F385 | ServiceSelector's radiogroup semantics and mechanics hint must survive its retirement | rank 4
  folds: ID-17
F386 | The records hub sends the reader to a "Horses screen" the app does not link to | rank 6
  folds: ID-18
F387 | Person→horse leaves the page while horse→person expands in place | rank 6
  folds: ID-20
F388 | The dossier renders the same horse information twice | rank 6
  folds: ID-21
F389 | A second inert Horses section duplicates the live card | rank 6 (see F388)
F390 | The intake page was reachable only when the lead list was non-empty | rank 6
  folds: ID-13
F391 | Two staff surfaces stated the same "inbound waiting" concept as two numbers | rank 6
  folds: ID-12 · em: 1#28
F392 | Email exists in three places and no path reconciles all three | rank 2
  em: 4#17
F393 | first_name/last_name sync one way only, so the two copies diverge | rank 2
  cb: 4#16
F394 | Two onboarding write paths use opposite precedence for the same fields | rank 2
  cb: 4#20
F395 | A phone write seeds four community channels, two of them WhatsApp, unchecked | rank 5
  em: 4#19
F396 | Six fields the member fills are consumed by nothing | rank 5
  em: 4#33
F397 | The platform-owner row holds a tenant contact despite a guard that denies it | rank 2
  em: 4#37, 5#35
F398 | A blind coalesce sweep would lock out the org-less platform operator | rank 5
  em: 4#79
F399 | One applied guard is already denying the platform operator today | rank 3
  em: 4#80
F400 | The platform owner's inbound count is always zero | rank 5
  em: 1#101
F401 | Three profiles rows violate two validated foreign keys | rank 2
  df: 4#36
F402 | Three non-member accounts look like seed rows but were never confirmed | rank 5
  df: 5#104
F403 | No auth account is linked to the company lessee contact | rank 3
  em: 1#3
F404 | The Charles Zigmund duplicate contact pair is deliberately not merged | rank 3
  df: 5#9
F405 | A contact count in a task doc disagreed with production (20 vs 17) | rank 6
  df: 3#81
F406 | The IDENTITY_MODEL_DESIGN phased build does not exist yet | rank 3
  cb: 4#42
F407 | name_needs_confirmation can never be raised again | rank 2
  folds: UI-24

## L. NAV, LAYOUT AND VISUAL POLISH

F410 | A hook's return-shape change broke a preview test (caught and fixed) | rank 6
  folds: UI-01
F411 | Review nav rows are deliberately absent from the page registry | rank 3
  folds: UI-02
F412 | Three lessons children and two Records routes have no nav rows and no registry entries | rank 3
  folds: UI-03
F413 | Two footer links pointed at the same page (fixed; the Review page still says otherwise) | rank 6
  folds: UI-05 · db: 1#36
F414 | /app/ops/directory was a live nav entry on an empty page | rank 6
  folds: UI-06
F415 | Calendar's "+ Booking" interpolates a default start time | rank 3
  folds: UI-07
F416 | The business-hours arithmetic was never exercised against live calendar data | rank 4
  folds: UI-08
F417 | CreateModal gained an initialStep and a context beyond the task's scope | rank 6
  folds: UI-09
F418 | The <main> overflow-x backstop was specified and left for the merge | rank 6
  folds: UI-10
F419 | PostModal's author row lacks the truncation guard its sibling has | rank 5
  folds: UI-12
F420 | The gold-ring vs fill active state was judged from hex values | rank 6
  folds: UI-13
F421 | Twelve findings against the shelved cardstock header | rank 6
  folds: UI-14 · df: 4#105
F422 | The drawer header row would look off-balance after the Close button went | rank 6
  folds: UI-15
F423 | RailLink sets no explicit aria-current, unlike its five siblings | rank 5
  folds: UI-16
F424 | The greeting's fourth "night" bucket was mapped to Evening — and two surfaces disagree | rank 6
  folds: UI-17
F425 | The rail's X-axis shadow may be clipped by the same nav's overflow rule | rank 5
  folds: UI-18
F426 | The avatar's :active gradient transition is inferred, not seen | rank 6
  folds: UI-19
F427 | The 7% hover fill was an interpretation of an unspecified value | rank 6
  folds: UI-21
F428 | The apple-touch-icon's font resolution is machine-specific | rank 6
  folds: UI-22
F429 | The nav divider colour was only confirmed to have stopped being wrong — and two weights coexist | rank 6
  folds: UI-23
F430 | "Horse records" may wrap at the narrowest viewports | rank 6
  folds: UI-25
F431 | The instructor home rendered availability slots as lessons | rank 6
  folds: UI-26 · db: 1#32, 7#43
F432 | App.tsx is a shared route table no branch owns | rank 3
  folds: UI-27
F433 | glass.nav in the Tailwind config has no reader | rank 6
  folds: UI-28
F434 | Superadmin chrome is 56px while the rails stick at 76px | rank 5
  folds: UI-29
F435 | AppLayout.tsx is a 134KB contended shared file with fifteen open items pointing into it | rank 3
  folds: UI-30
F436 | Nav resize was not built because the drawer's dimensions are recorded nowhere | rank 3
  folds: UI-31
F437 | The header drop shadow shipped pending judgement (since ruled and moved) | rank 6
  folds: UI-32
F438 | The session-notes optimistic append invents no id or timestamp | rank 5
  folds: UI-34
F439 | About.tsx's "The Facility" eyebrow collides with the tenant's chosen word | rank 6
  folds: UI-35
F440 | Seed copy says "around the stables" | rank 6
  folds: UI-36
F441 | The N/A disabled-field colour is blocked on an owner choice | rank 3
  folds: UI-37
F442 | border-red-400 may be too quiet as the error state (four sites, one token) | rank 3
  folds: UI-38
F443 | Euthanasia authorization: new records only or existing too — and the form change is behind that gate | rank 3
  folds: UI-39 · ca: 6#47
F444 | Which of six horse-save failures the user hit is unknowable | rank 6
  folds: UI-40
F445 | The three material languages were correctly not built, and their premise has changed | rank 3
  folds: UI-41
F446 | Three horse surfaces read the same roster; the owner must pick, and one feature only the loser has | rank 4
  folds: UI-42 · cb: 7#21, 1#41 · db: 1#38
F447 | mod.brokerage is enabled with no nav entry and no hub page | rank 4
  folds: UI-43 · db: 7#28
F448 | /app/ops/availability is a dormant legacy redirect | rank 6
  folds: UI-44
F449 | Horse-care offerings exist in the database with no page, nav entry, label or module | rank 4
  folds: UI-45 · db: 7#33
F450 | The gold underline measures 2.66:1, below the 3:1 non-text contrast floor | rank 5
  folds: UI-46 · df: 3#115
F451 | The collapsed rail's selected state is icon tone alone | rank 5
  folds: UI-47
F452 | The growing-underline animation was not built | rank 6
  folds: UI-48
F453 | The drawer moving left costs thumb reach (an accepted trade) | rank 6
  folds: UI-50
F454 | The drawer scrim silently became tenant-branded on a superadmin surface | rank 5
  folds: UI-51
F455 | Sign out is reachable only via the avatar menu, for every role | rank 3
  cb: 3#66
F456 | Admin vs instructor avatar-menu asymmetry reads as branch drift | rank 5
  cb: 3#67
F457 | Three ONEMENU recommendations were answered as recommendations, not commitments | rank 3
  cb: 3#68
F458 | Six net-new avatar-menu items must land in the merged drawer or be lost | rank 4
  cb: 3#75
F459 | The avatar is framed as a live choice in one place and ruled inert in another | rank 3
  df: 3#62
F460 | Should the app header minify on scroll? | rank 3
  df: 4#106
F461 | The third header question was cut off mid-sentence and is still unknown | rank 3
  df: 4#108
F462 | The one-time nav tip is per-device localStorage, not per-account | rank 6
  df: 8#59
F463 | Most nav-icon assignments cannot be applied until the page merges exist | rank 6
  cb: 4#110
F464 | The nav filter patch was proven and held because the file was contended | rank 3
  df: 2#55
F465 | ...and if its child rows are rejected, the no-cascade hiding rule must change | rank 3
  df: 2#56
F466 | The App-pages nav block is hand-written JSX, so it cannot be hidden | rank 3
  db: 2#57
F467 | Accepting a page out of Review requires a code change, not a button (D13) | rank 3
  db: 2#90
F468 | The /app/ops nav-entry diff was specified and not applied | rank 6
  db: 4#55
F469 | Hub-card links still point at hidden pages | rank 5
  cb: 2#62
F470 | The tenant owner cannot disable a module himself, by design | rank 3
  cb: 2#61
F471 | Nav group open/collapsed state does not survive a reload | rank 6
  df: 3#110
F472 | Eleven pages still carry a large dark-green title as their default | rank 3
  df: 3#76
F473 | 71 of 80 in-app pages do not use the page frame | rank 4
  db: 1#65
F474 | Four pages' width caps were rounded up to the nearest bucket | rank 6
  cb: 8#71
F475 | ContractPage was deliberately left out of the page frame | rank 3
  cb: 8#72
F476 | The subheader carries the same underline-flicker defect | rank 5
  ca: 8#50
F477 | Three page-level create controls arguably should read "Add New" | rank 6
  cb: 4#44
F478 | A lucide glyph was substituted for a literal "+" | rank 6
  df: 4#43
F479 | The "Ops" label survives on two page eyebrows | rank 6
  df: 2#89
F480 | The Team nav row is temporarily gated tighter than its route | rank 6
  df: 2#91
F481 | The two retirement booleans were deliberately not flipped | rank 6
  df: 2#94
F482 | Inbound C and Staff home both highlight as active on the dashboard | rank 6
  em: 2#92
F483 | Typography: Libre Caslon ships only 400/700, runs larger, and is being thinned | rank 5
  db: 5#60, 5#61, 5#62
F484 | The header names a font directly rather than the app's display token | rank 6
  ca: 5#71
F485 | The reference header mockup is itself defective | rank 6
  df: 5#69
F486 | The drawer pops in instantly while its tab slides | rank 6
  df: 5#67
F487 | UIO-006's open-state fill is still identical to pressed | rank 3
  df: 3#107, 8#53
F488 | UIO-013's selected fill is structurally incompatible with the label colour | rank 3
  df: 3#115 (see F450)
F489 | UIO-016 is superseded on two points — recorded so nobody reverts it | rank 6
  df: 8#60
F490 | UIO-012's content half (Inbound dissolving into Leads) is unbuilt | rank 3
  em: 3#111
F491 | The attention band renders three tiles with no "and N more" | rank 5
  em: 1#57
F492 | The lead expand control cannot be exercised against live data | rank 5
  db: 1#102
F493 | Horizontal overflow: DataTable forces overflow-y, clipping any future popover | rank 5
  db: 3#10
F494 | ...and the overflow is expected to be worse with more columns toggled on | rank 5
  df: 5#48
F495 | Confirmed-and-unfixed overflow sites (Admin overview row, tenant detail row, CopyRow) | rank 5
  em: 3#12, 3#14 · db: 3#17
F496 | The "maybe" tier of overflow sites (four named, plus fifteen more) | rank 5
  em: 3#21 · df: 3#20
F497 | ContractCascade's co-owner grid uses bare 1fr tracks | rank 5
  ca: 3#15
F498 | RevealText's label+input minimum deterministically exceeds a 320px column | rank 5
  cb: 3#18
F499 | Two overflow fixes are blocked on a frozen file (grid floor, matrix-cell nowrap) | rank 3
  ca: 3#16, 3#19
F500 | A frozen file was edited before the freeze was known; not reverted | rank 3
  ca: 1#110
F501 | The long-option label squeeze: fix unverified, a second field suspected, a data-only alternative exists | rank 5
  ca: 1#111, 1#112, 1#113 · cb: 1#114
F502 | Dimming was kept on not-mine fields despite a stated preference for tooltips | rank 3
  ca: 3#3
F503 | A trailing period was added to the owner's quoted tooltip | rank 6
  ca: 3#4
F504 | SYSTEM/unknown owner roles fall back to generic tooltip wording | rank 6
  ca: 3#5
F505 | InfoDot shares the tooltip defect and was left untouched | rank 5
  cb: 3#93
F506 | Five title= sites were deliberately left as plain titles | rank 6
  cb: 3#94
F507 | My Lessons' document title and eyebrow disagree in casing | rank 6
  df: 6#14
F508 | The Orders eyebrow change was applied by pattern, outside the spec table | rank 6
  df: 1#153
F509 | Nav-page eyebrow copy was changed on five pages as a scope reading | rank 6
  df: 7#12
F510 | The Orders back button routes to the community feed | rank 5
  cb: 6#6
F511 | Two "Coming up" tiles link to a URL-only page | rank 5
  db: 1#50
F512 | The care home's primary CTA links to a route that does not exist | rank 1
  db: 1#60
F513 | The calendar's "Review & sign paperwork" button 404s | rank 1
  cb: 1#62
F514 | The module launcher exists only on one URL-only page | rank 4
  db: 1#42
F515 | The horse-records page hand-rolls its own modal beside the app's Modal | rank 6
  db: 1#39
F516 | /app/deal and /app/care are surfaces to decide about | rank 3
  cb: 1#61
F517 | MyLessons and Documents need a design decision before expanding inline | rank 3
  cb: 6#12
F518 | The add-item draft is per browser, not per account | rank 3
  df: 6#22
F519 | A staff landing page exists but is unreachable — retire it or reconnect it | rank 3
  db: 7#27, 8#27, 4#54, 4#47 · cb: 7#15 · folds: ID-11
F520 | The instructor status chip is keyed lowercase against uppercase statuses | rank 1
  db: 4#50
F521 | The ops dashboard's docstring promises four tiles and renders two | rank 6
  sec: 4#48

## M. EMAIL, NOTIFICATIONS AND DELIVERY

F525 | The brand site URL points at a parked domain, so any email linking to the site goes nowhere | rank 2
  em: 1#88 · db: 2#10, 2#19
F526 | The SMTP send has no timeout, so a hung connection hangs the request | rank 2
  em: 1#91
F527 | The database→endpoint call has no timeout, so real successes read as timeouts | rank 5
  em: 2#28
F528 | The single address every lead alert goes to has no owner-facing editor (D13) | rank 3
  em: 3#26
F529 | A dismissed in-app notification leaves no trace in any surface the owner reads | rank 2
  em: 3#28
F530 | Two missed leads were never backfilled or re-notified | rank 3
  em: 3#29
F531 | notify_staff has no body parameter, so diagnostics are packed into the title | rank 5
  em: 2#44
F532 | The staff "Resend" on a gift has never sent an email — no gift email path exists | rank 1
  em: 2#46
F533 | The preference card promises three notification behaviours no producer exists for | rank 2
  em: 4#21 · db: 1#140 (see F534)
F534 | The old notification checkboxes wrote nothing, on every account, forever | rank 2
  em: 1#140
F535 | Prophylactic hardening of the notification writers was left as a backlog entry | rank 5
  em: 5#6
F536 | The support-email dispatch 404s until the branch merges and deploys | rank 3
  em: 2#34
F537 | Email templates are extracted but there is still no UI to edit them (D13) | rank 3
  em: 7#65, 5#111
F538 | The welcome and dunning email wording still exists in the renderer | rank 6
  em: 7#56
F539 | The old renderer is entirely dead but kept | rank 6
  em: 7#57
F540 | An email-specific token namespace was created against the task's instruction | rank 6
  em: 7#58
F541 | email_templates has no org_id — bodies are global | rank 5
  em: 7#61
F542 | No plain-text alternative exists and the transport has no field for one | rank 5
  em: 7#62
F543 | Three enum→label maps are the last email vocabulary left in code | rank 5
  em: 7#63
F544 | The renderer is duplicated in a build script because .mjs cannot import .ts | rank 5
  em: 7#64
F545 | Inconsistent HTML escaping is preserved byte for byte as _HTML token twins | rank 5
  sec: 7#59
F546 | Two API routes hardcode "French Heritage Equestrian" as the identity fallback | rank 2
  sec: 7#60
F547 | Fallback wording moved from code into templates (the one behaviour change) | rank 6
  em: 7#68
F548 | Corrections to the email census's own counts (19 emails across 16 files) | rank 6
  em: 7#69
F549 | Email templates were never compared against each other for duplication | rank 4
  em: 1#24
F550 | The from-address depends on an env var this environment cannot read | rank 5
  em: 2#32
F551 | The deliverability panel resolves the inbox client-side rather than server-side | rank 6
  em: 2#42
F552 | The minor-reject branch of the invite endpoint is structurally unreachable | rank 6
  em: 7#51
F553 | The evaluation-report minor branch could not be exercised | rank 5
  db: 7#50
F554 | Profiles-based reminder senders were left untouched | rank 6
  em: 7#54
F555 | The lead queue now counts "contacted" as open — vetoable in one line | rank 3
  em: 1#97
F556 | The lead trigger had never linked a request; every request since 2026-08-02 was NULL | rank 1
  em: 1#98
F557 | ...and whether the remaining NULL rows get backfilled is out of scope | rank 3
  df: 1#146
F558 | The backfill's ambiguous-email guard has no production data to exercise it | rank 5
  em: 1#103
F559 | Two stale links/wordings were left pointing at the retired intake page | rank 6
  em: 1#100
F560 | The intake deep-link is inert — the page reads no query params | rank 5
  df: 5#7
F561 | Historic stacked invitation tokens were not back-filled | rank 6
  em: 1#93
F562 | The held supersede migration must apply after the frontend deploys | rank 3
  df: 1#85
F563 | provision_client_invitation still supersedes on every call — fix written, held | rank 2
  cb: 1#84
F564 | The invitation email path was flattened to one message (fixed) | rank 6
  folds: ID-40
F565 | The inquiry email's real gap was content, not the absence of a send | rank 6
  em: 2#54
F566 | D1a honoured: nothing gave the platform account an org | rank 6
  em: 1#83

## N. CATALOG, COMMERCE, BOOKINGS

F570 | /acquisition renders zero of three services because the reader filters unpriced SKUs | rank 1
  db: 1#35, 2#86 · ca: 1#7
F571 | /acquisition and /shop have never been looked at by anyone | rank 3
  db: 1#13
F572 | The catalog page deliberately got no page-level create control | rank 6
  db: 2#71
F573 | createLessonCredit is duplicated in two modules | rank 5
  db: 7#38
F574 | A booking FK was changed from CASCADE to SET NULL to stop an armed cascade | rank 6
  db: 7#44
F575 | Half the fulfillment-unit ledger is orphaned; ~57–71 purchases were hard-deleted | rank 2
  db: 7#29, 7#31, 7#36
F576 | gifts.order_id is a vestigial unconstrained column | rank 6
  db: 2#45
F577 | The recipient-books-against-a-gifted-credit path was not re-verified end to end | rank 4
  db: 2#49
F578 | Two gift "already works" claims were false and were fixed | rank 6
  ca: 2#50, 2#51
F579 | The gift redemption lacked the profiles-insert guard every new recipient needed | rank 6
  df: 2#52
F580 | The bill-of-sale standalone starter has no UI caller | rank 4
  db: 8#12
F581 | Deal creation spans two calls with no transaction | rank 5
  cb: 8#13
F582 | The deal status vocabulary is display-layer only | rank 5
  cb: 8#9
F583 | The deal activity log is composed at read time from other tables | rank 6
  cb: 8#10
F584 | reopen_deal exists in the database and nothing calls it | rank 6
  cb: 8#11
F585 | Four deal-build decisions were made without sign-off | rank 3
  cb: 8#16, 8#17, 8#18, 8#19
F586 | REQ-26, the deal-workflow inventory the UI thread was blocked on, was never produced | rank 3
  cb: 8#2
F587 | REQ-21 is partial — the deal-record button exists in one place only | rank 3
  cb: 8#3
F588 | pending_fee_candidates is broken in production (wrong table alias) | rank 1
  db: 2#14
F589 | A trigger references a column dropped with the transactions retirement | rank 1
  db: 7#117
F590 | owns_order queries a dropped table (dead, not breakage) | rank 6
  db: 7#119 · sec: 7#118
F591 | Bookings carry no audit trigger, so a booking-only client shows no activity | rank 5
  cb: 2#106
F592 | Two roster judgment calls were flagged (ring derivation, fixed "Client" word) | rank 6
  cb: 2#102, 2#103
F593 | The outstanding-documents flag is a partial signal by construction | rank 5
  sec: 2#105
F594 | Service-slot scaling past ~12 needs a design pass | rank 6
  cb: 6#93
F595 | A member's own document count read wider than the RLS-visible set — and was right | rank 6
  sec: 1#9
F596 | A new reader trusts the bookings policies rather than naming an org | rank 5
  sec: 1#20
F597 | Whether the password survives after Google linking is implemented but unruled | rank 3
  sec: 1#77
F598 | A domain gate hid the Google activation control from every eligible member | rank 1
  sec: 1#78

## O. DATA IN PRODUCTION (residue, orphans, test rows)

F600 | Beau carries duplicated active LESSEE rows with a dangling source document | rank 2
  df: 1#4, 2#108 · db: — · ca: — · (also df 8#22)
F601 | ...and that contact would incorrectly pass the horse-use gate | rank 2
  df: 8#22
F602 | Test accounts, contacts, purchases and documents were deliberately left in production | rank 3
  df: 1#90, 2#8, 2#24 · em: 5#79 · cb: 1#6, 8#8 · em: 8#7
F603 | Two "Unnamed Contact" artifacts await the pre-launch purge | rank 3
  df: 5#9 (see F404)
F604 | Two documents show a negative field delta against their template defs | rank 5
  ca: 1#128
F605 | The horse-document counts in an earlier census included soft-deleted rows | rank 6
  df: 1#8
F606 | staff_horse_records counts relationship rows, not documents — wrong for every horse | rank 1
  df: 1#31
F607 | Standing categories are wiped at account activation; nine contacts would lose theirs | rank 1
  df: 6#48
F608 | Breed and colour cannot hold a typed-in value at all | rank 1
  db: 6#44
F609 | The staff-assigned horse path was never tested against production | rank 5
  cb: 6#51
F610 | Two self-corrections on the record (Claire self-healed; nine riders were never at risk) | rank 6
  df: 5#83
F611 | A live lease document is only presumed to be owner testing | rank 5
  em: 8#7 (see F602)
F612 | Mary Richardson holds two blank-horse drafts the supersession ruling will govern | rank 3
  ca: 3#91
F613 | The premature send on a real lease is accepted as a live negotiation | rank 6
  sec: 5#26
F614 | The live drift between git and production function bodies was found and recaptured | rank 5
  cb: 1#151, 1#152

## P. MISSING SURFACES AND UNVIEWED INVENTORY

F620 | Marketing is entirely missing at the schema level | rank 4
  db: 7#26
F621 | There is no obligations view of Lessons | rank 4
  db: 7#24
F622 | The census never reached api/, migrations, superadmin pages or CSS tokens | rank 4
  db: 1#23, 1#25, 1#27
F623 | The two largest contract files were never audited for self-duplication | rank 4
  cb: 1#26
F624 | Two more shadow catalogs exist (form_definitions, serviceCatalog) | rank 4
  df: 1#71 · db: 1#59
F625 | A dead read path was left in place (listContractTemplates) | rank 6
  ca: 4#97
F626 | The inline body preview was retired behind a boolean, not deleted | rank 6
  ca: 4#100
F627 | No badge data model exists anywhere | rank 4
  df: 1#139
F628 | Stages 4 and 5 of the hardening plan were never started | rank 3
  df: 5#1
F629 | Everything ACCTEVAL found outside SECFIX's scope remains untouched | rank 3
  df: 5#94
F630 | Other pre-existing BACKLOG items were untouched | rank 4
  df: 2#5
F631 | The sendguard churn refactor is built, dry-run and unapplied | rank 3
  df: 4#114
F632 | The regenerate path takes the service type as a parameter the row does not record | rank 5
  df: 4#118
F633 | Two-tabs-at-once onboarding is not modelled (no lock) | rank 5
  df: 4#121
F634 | The staff-caller branch of the horse-document generator was never exercised | rank 5
  df: 5#75
F635 | Should staff be able to override the send refusal? | rank 3
  ca: 4#115
F636 | The event log's vocabulary deviates from its spec in three ways | rank 6
  cb: 7#3, 7#4, 7#5
F637 | The non-staff rejection of the event log was not live-tested | rank 5
  ca: 7#6
F638 | Party-control defaults were made uniform rather than role-asymmetric | rank 6
  cb: 7#111
F639 | The party backfill included documents outside the starters' scope | rank 6
  ca: 7#112
F640 | One tracker row was left NOT VERIFIED because it belongs to another thread | rank 6
  cb: 7#113
F641 | The A11 "Leased to" line was left beside the new lease card | rank 6
  cb: 7#1
F642 | Purge-routine guardian orphaning was out of scope | rank 3
  cb: 7#52
F643 | Kiosk-side age screening was out of scope | rank 3
  cb: 7#53
F644 | The barnops module family rename was deferred | rank 3
  df: 6#35 · db: 6#36
F645 | Confirm the tenant's facility word is "ranch" | rank 3
  df: 6#37
F646 | 78 call sites test the wrong error shape | rank 5
  df: 6#42
F647 | The packet display name is an open owner pick | rank 3
  df: 5#54
F648 | Column visibility persists in localStorage as a display preference | rank 6
  df: 5#49
F649 | The status-events entity type for bookings is deliberate, not a bug | rank 6
  df: 7#42
F650 | The intentionally-public function set was confirmed untouched | rank 6
  db: 1#138
F651 | A real migration bug the harness caught (no min(uuid) aggregate) | rank 6
  db: 1#106
F652 | The mobile-number decision was resolved by evidence and documented | rank 6
  df: 1#145
F653 | The directory redirect goes to Vendors, not Partners, by judgment | rank 6
  df: 3#84
F654 | Corrections to task-doc premises and inventories (a cluster of 20 one-line record entries) | rank 6
  ca: 1#117, 1#142, 1#150, 2#81, 3#7, 6#7, 6#57, 6#98, 6#99, 6#100, 8#70, 4#125, 4#128, 5#38, 5#84
  cb: 4#117, 5#85, 6#17, 6#40
  df: 1#8, 2#21, 2#29, 2#68, 2#69, 3#74, 4#122, 4#130, 6#16, 6#34, 7#114, 8#29, 8#88, 3#113, 5#3, 4#38
  db: 1#30, 3#101, 6#80, 6#86, 7#119
  em: 2#30, 2#31, 5#8
  ca: 2#40, 7#6 (see F637)
F655 | The A8 test document had prior delivery rows, so only idempotent-skip was proven | rank 6
  em: 2#30 (see F654)
F656 | profiles.phone survives because the staff editor is a third writer for one account | rank 3
  em: 2#15
F657 | The rate-limit window is tumbling, not sliding | rank 6
  cb: 2#39
F658 | The sign route was nested inside the public chrome group | rank 6
  cb: 2#41
F659 | The sign-start endpoint returns 500 on a genuine DB exception | rank 6
  ca: 2#40
F660 | A guard's staff branch is marginally tighter than its callers' | rank 5
  cb: 1#125
F661 | The set_contract_field proof is weaker than the other four | rank 6
  cb: 1#151 (see F614)
F662 | Two owner out-of-band commits' applied state was never verified | rank 5
  ca: 8#6
F663 | The leaseset branch is local only, deliberately not pushed | rank 6
  cb: 8#49
F664 | D9 says a column is vestigial; the column does not exist | rank 6
  df: 4#38 (see F654)

---

# COLLAPSE
975 raw items → 456 numbered families (F001–F664 with gaps; see the sweep for the exact count).
