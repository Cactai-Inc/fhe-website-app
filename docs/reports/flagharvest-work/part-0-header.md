# Unviewed inventory — set A (batches 1–4)

> "An artifact the owner has never seen is not dead code — it is unreviewed inventory."

Scope: every `[INV batchN.md#k]` entry from **batch1.md, batch2.md, batch3.md, batch4.md** of
`master-inventory.txt`. **76 raw entries → 57 deduped artifacts.** Nothing here is a deletion
recommendation. No code was changed; all DB access was SELECT-only.

Each block shows: what reported it, how it is unreachable today (verified, with the gate/flag
file:line), whether it still exists, and **enough of the real content to judge it** — not a
description of the content.

## Dedupe map (raw entry → artifact)

| # | Artifact | Raw INV entries |
|---|---|---|
| 1 | myContractDocuments() / my_contract_documents RPC | b1#1 |
| 2 | HorsesPage — /app/ops/horses | b1#2, b2#37 |
| 3 | OpsHome + OpsDashboard — /app/ops | b1#3, b4#65 |
| 4 | InstructorHome + InstructorHomePreview | b1#4, b2#38, b4#64 |
| 5 | ContactsPage (CONTACTS_PAGE_RETIRED) | b1#5, b2#33, b2#43 |
| 6 | IntakePage (INTAKE_PAGE_RETIRED) + RequestInbox | b1#6, b1#18, b2#34 |
| 7 | Schedule.tsx — /app/schedule (only RSVP surface) | b1#7, b2#39 |
| 8 | Account.tsx — /account | b1#8, b2#26 |
| 9 | serviceCatalog.ts + SERVICE_TYPES | b1#9, b3#47 |
| 10 | countContacts / countHorses / countOpenBillableLines | b1#10 |
| 11 | DealHome + CareHome | b1#11 |
| 12 | StaffPage — /app/ops/employees/staff | b1#12, b2#42 |
| 13 | Directory page / DirectoryPage / 'directory' mode | b1#13, b2#41, b3#48 |
| 14 | Inline body preview (INLINE_BODY_PREVIEW_RETIRED) | b1#14, b4#68 |
| 15 | Dark module pages: boarding / barnops / employees | b1#15 |
| 16 | PDF body renderer — documentPdf.ts | b1#16 |
| 17 | docs/proposed/INVITEWORKS-provision-no-default-supersede.sql | b1#17 |
| 18 | void_signatures_on_edit(uuid) — dropped | b1#19 |
| 19 | Gifts subsystem (+ ensure_gift_buyer_account, gifts.order_id) | b1#20, b2#28, b2#29 |
| 20 | template_tokens dictionary rows (template_id IS NULL) | b1#21 |
| 21 | 46 defined-but-unused tokens | b1#22 |
| 22 | 24 inactive-body-only tokens | b1#23 |
| 23 | MINOR_RIDER template | b1#24 |
| 24 | docs/BACKLOG.md dead-nav + placeholder-media items | b2#25 |
| 25 | git branch task/b-lead-notifications | b2#27 |
| 26 | Held PAGEVIS nav-filter patch | b2#30 |
| 27 | AdminPageVisibilityPage — /app/ops/admin/pages | b2#31 |
| 28 | mod.brokerage — entitled, hub not built | b2#32 |
| 29 | ContactDossierModal — review-only mount | b2#35 |
| 30 | ContactForm — review-only mount | b2#36 |
| 31 | /app/documents member self-sign row (hidden for staff) | b2#40 |
| 32 | git branch task/roster — RosterRow / RosterHeader | b2#44 |
| 33 | SavedPanel + SEED_SAVED + SEED_ENABLED | b3#45, b4#56 |
| 34 | seed.ts FEED_VIEW_META.all.description | b3#46 |
| 35 | uio-006-open-state-options.html | b3#49 |
| 36 | uio-011-hover-and-green-evaluation.html | b3#50 |
| 37 | ARENA_SOLO — dead lease option | b3#51 |
| 38 | contract_split_deductible_sync — dead branches | b3#52, b3#54 |
| 39 | clause_cut_kept — inert on HORSE_LEASE_V2 | b3#53 |
| 40 | SendCopiesMenu | b4#55 |
| 41 | TwoFactorSettings | b4#57 |
| 42 | contacts.rider_skill_level | b4#58 |
| 43 | contacts.jump_limitations / {{CLIENT.JUMP_LIMITATIONS}} | b4#59 |
| 44 | profiles: tour_seen_at, first_dashboard_at, welcome_removed_at, created_from_request_id | b4#60 |
| 45 | contacts: staff_preferred_contact, zelle_*, correspondence_email, mobile_number, texts_phone | b4#61 |
| 46 | contacts.hide_email / hide_mobile / hide_whatsapp + SeedFallback | b4#62 |
| 47 | AccountHub ?section=profile / ?section=documents | b4#63 |
| 48 | PageHeader aria-label fallback | b4#66 |
| 49 | listContractTemplates() | b4#67 |
| 50 | HORSE_LEASE_FULL/SIMPLE/STANDARD + FlatDocument.tsx | b4#69 |
| 51 | FACILITY_LICENSE + INDEPENDENT_CONTRACTOR (empty bodies) | b4#70 |
| 52 | Shelved CardstockHeader | b4#71 |
| 53 | tailwind.config.js glass.nav | b4#72 |
| 54 | AppHeader.tsx + archived oneheader harness | b4#73 |
| 55 | 23 helper functions revoked in NOGUARD3 Phase B | b4#74 |
| 56 | SENDGUARD §2 migration, committed unapplied | b4#75 |
| 57 | Re-sign workflow + 6 unactioned version decisions | b4#76 |

---

