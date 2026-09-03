# FHE-TASK-BANNEDWORDS HANDOFF — for the owner to rule on

**From FHE-TASK-BANNEDWORDS (DISCO profile, read-only), 2026-09-03. Subject: CR-111 / D43 — the nine banned words.**
**Nothing was changed. Every line below is a finding with a suggested replacement; the owner rules, a later TASK applies.**

Source rulings: `docs/reference/CHANGE-ORDER-LEDGER.md` § CR-111 and § CR-111·A1; `CLAUDE.md` D43 (amended 2026-09-03).
Banned unless specifically instructed: **Barn, Stable, School, Program, Academy, Hunter, Trailriding, Tours, Western.**
Approved by ruling (CR-111·A1): **"My Stable"** — listed in §0, not as a finding.
Vocabulary to replace with (owner, CR-111 + A1): **the Ranch** (Carmel Creek Ranch) · **French Heritage Equestrian** (never "FHE") for the business · **stalls (by number)** · **Tackroom** · **community / services / lessons** · **Headquarters · Stalls · Tackroom · Horse · Event · Activity · Client** (supplies attribution) · **jumper** (D38: never hunter/jumper).

---

## 0 · Scope, method, and the headline numbers

**Searched:** whole-word, case-insensitive, all nine words plus plurals and "trail riding/trail rides", across `src/`, `api/`, `public/`, `index.html`, `README.md`, `scripts/`, `supabase/migrations/` (live), `supabase/contract_templates/`, `supabase/horse_record/`, `test/`. Excluded as history or vendor: `docs/` (quotes the words by design), `supabase/migrations-archive/` (applied history, 222 hits, not editable), `node_modules`, `dist*`, `public/ffmpeg/` (vendor JS), `workspace/`.

| Word | Raw hits (in scope) | Real findings after sense filter |
|---|---|---|
| Barn | 523 | ~70 rendered/internal-name sites (rest = comments saying "at the barn" for timezone, and the building sense) |
| Stable | 1061 | ~45 (the bulk is SQL `STABLE` volatility, "stable id/seam" adjective, and the approved "My Stable") |
| School | 18 | 6 (2 public copy, 4 contract verb-sense) |
| Program | 48 | 12 (5 public copy, 3 staff UI, 4 contract/token) |
| Academy | 0 | 0 — only in CLAUDE.md's own ban list |
| Hunter | 34 | 9 (1 offering slug, 6 intake-form options, 2 demo seeds) + 3 placeholders |
| Trailriding | 92 | 3 public-story sentences, 2 image files, 8 contract/lease sites (mostly legal disclaimers) |
| Tours | 57 | ONE feature: the "App tour" walkthrough (31 code sites, 4 rendered labels) — different sense |
| Western | 0 | 0 — only in CLAUDE.md's own ban list |

**Three senses the owner must rule on once, not per line** (they account for most of the volume):

1. **"stable" as an adjective / SQL keyword** ("STABLE SECURITY DEFINER", "a stable id", "stable seam"). 250+ hits. Not the banned noun. Recommend: ignore.
2. **"barn" as an actual building** (horse intake "Barn A / Stall 12", fire-safety clause "barns, stalls, aisles"). D43 already allows this. Listed in §7 for completeness; recommend: keep.
3. **"Tour" = the app walkthrough** ("App tour", `tour_seen_at`). Not a property/trail tour. Listed in §6; owner to say whether the ban reaches it.

A fourth category, **legal enumerations in the releases** ("at any ranch, barn, arena, stable, tack room, trail…"; "Trail riding — not a Company activity"), narrows coverage if the words are removed. Listed in §3 with a recommendation to keep, but the owner rules.

---

## 1 · PUBLIC WEBSITE COPY (visitors read this)

| # | Location | Text (verbatim) | Sense | Suggested replacement |
|---|---|---|---|---|
| 1.1 | `index.html:19` (meta description — Google shows this) | "A family-run **jumper program** and community at Carmel Creek Ranch in coastal San Diego — riding lessons, horse care, and acquisition support…" | business | "A family-run jumper community at Carmel Creek Ranch in coastal San Diego — riding lessons, horse care, and acquisition support, rooted in classical European training." |
| 1.2 | `src/lib/seo.ts:20` (site-wide SEO description) | "Family-run full-service equestrian **program** and rider community featuring riding lessons and jumper training…" | business | "Family-run full-service equestrian community offering riding lessons and jumper training in the classical European style, alongside horse care services and support for purchasing and leasing, located in beautiful coastal San Diego." |
| 1.3 | `src/components/layout/Footer.tsx:59` (every public page footer) | same sentence as 1.2 | business | same as 1.2 (the two should stay identical) |
| 1.4 | `src/pages/About.tsx:88` | "And the best **barns** are not really about the riding at all. They are about the people who keep showing up…" | business-as-community (generic "barns") | "And the best riding communities are not really about the riding at all." — or "And the best places to ride…" |
| 1.5 | `src/pages/Faq.tsx:13` | "Most riders begin on our **school** horses — steady, well-**schooled** partners matched to your level." | lesson horses / trained | "Most riders begin on our own horses — steady, experienced partners matched to your level." |
| 1.6 | `src/pages/Lessons.tsx:53` (weekly-membership footnote, rendered under the cards) | "With this **program** you can ride every week even when there's a 5th week…" | the weekly membership | "With a weekly membership you can ride every week even when there's a 5th week…" |
| 1.7 | `src/pages/BookRider.tsx:126` | emptyLead: "Our riding **programs** are arranged personally rather than booked online." | services | "Our riding lessons are arranged personally rather than booked online." |
| 1.8 | `src/pages/BookRider.tsx:154` (radio option; value `'school'` at :154 and :179 is internal) | "I ride **school** horses" | lesson horses | "I ride French Heritage Equestrian horses" — or "I don't have a horse yet; I ride yours" |
| 1.9 | `src/pages/BookRider.tsx:261` | "…we would love to discuss your horse's **program**." | the horse's training/care routine | "…we would love to discuss your horse's care and training." |
| 1.10 | `src/pages/Story.tsx:196` | "…one of the only locations in coastal San Diego with **trailhead access right from the stable doors**. Enjoy miles of interconnected **trails** winding through the Peñasquitos preserve…" | property description (the Ranch's terrain), not a trail-riding service | "…trailhead access right from the stalls." Keep "trails" as terrain if the owner allows; note the releases (§3) state trail riding is NOT a company activity, so this sentence should not read as an offer. |
| 1.11 | `src/pages/Story.tsx:238` (image alt text) | "The **stables** at Carmel Creek Ranch at golden hour." | the pens/stalls (owner: "stables is how the collection of pens are referred to in some cases") | "The stalls at Carmel Creek Ranch at golden hour." |
| 1.12 | `src/pages/Story.tsx:31,32` + `public/images/Stables.png`, `public/images/Trail.png` | image file names `Stables.png`, `Trail.png` (visible in the page source and image URLs) | asset names | rename to `Stalls.png` / `Preserve.png` (or leave; URLs only) — owner's call |
| 1.13 | `src/pages/Checkout.tsx:258` (public checkout, service-address field) | placeholder "**Barn** / property address" | client's horse's location (could be any facility) | "Ranch / property address" |
| 1.14 | `src/lib/acquisition.ts:64` (public horse-finder form) | placeholder "**Barn** / property address" | same | "Ranch / property address" |
| 1.15 | `src/lib/acquisition.ts:48` | placeholder "e.g. **hunter**/jumper, dressage, **trail**" | client's intended discipline for a horse being sought | "e.g. jumper, dressage, pleasure" |
| 1.16 | `src/lib/intakeCategoryFields.ts:26` | placeholder "**Hunter**/jumper, dressage…" | same | "Jumper, dressage…" |
| 1.17 | `src/lib/questionSets.ts:270` (ASKRIGHT question, sought horse) | placeholder "Showing, **trail riding**, lessons…" | client's intended use | "Showing, pleasure riding, lessons…" |
| 1.18 | `src/lib/questionSets.ts:462` (evaluated horse) | placeholder "City, or the **barn** it is kept at" | where the CLIENT's horse lives (any facility) | "City, or the ranch or facility it is kept at" |
| 1.19 | `src/lib/seed.ts:35` (Community Feed description, members) | "…share your experiences or views from around the **stables**…" | the Ranch | "…views from around the Ranch…" |

---

## 2 · EMAILS (DB `email_templates`, sent to real inboxes) and their admin-facing descriptions

| # | Location | Text | Sense | Suggested replacement |
|---|---|---|---|---|
| 2.1 | `supabase/migrations/20260826T1710_the_start_of_day_email.sql:17,20` → live row `email_templates.CALENDAR_DAY_SHEET` | title "Today at the **barn** (ops inbox)"; **subject line** "Today at the **barn** — {{MSG.COUNT}} session(s)" (lands in hello@ daily at 07:00) | the Ranch / the business | subject "Today at the Ranch — {{MSG.COUNT}} session(s)"; title "Today at the Ranch (ops inbox)". Needs a migration (the row is live; the seed uses ON CONFLICT DO UPDATE). |
| 2.2 | `supabase/migrations/20260812T2010_emailextract_seed.sql:210,221,232` (mirrored in `scripts/emailextract/bodies.mjs:346,359,389`) → `email_templates.description` shown in the admin Email editor | "…so the **barn** sees everything coming up…"; "…mailed to the **barn** immediately so the owners see…"; "…so the **barn** hears about it…" | the business (staff) | "so French Heritage Equestrian sees…", "mailed to French Heritage Equestrian immediately…", "so French Heritage Equestrian hears about it…" |
| 2.3 | `supabase/migrations/20260812T2020_emailextract_tokens.sql:35` → `template_tokens.notes` (admin token reference) | "Use this one in the two **barn**-facing emails (new inquiry, new support request)…" | the business | "the two French-Heritage-Equestrian-facing emails" or "the two staff-facing emails" |
| 2.4 | `supabase/migrations/20260822T0940_dashboardbuild_5…sql:316` → `dash_*` business dashboard activity feed (staff) | "copy to the **barn**" (delivery mirror label) | the business's own copy | "copy to French Heritage Equestrian" — or "office copy" |

---

## 3 · CONTRACT TEMPLATES (rendered into documents clients sign)

Files under `supabase/contract_templates/` are mirrored into `contract_templates.body` by `supabase/migrations/20260629100000_load_contract_bodies.sql` and by the sale-templates migration, so each change needs BOTH the .md and a re-load migration (D-rule: use `remerge_contract_body` / `regenerate_contract_document`, never `remerge_from_fields`). Archive/ copies under `contract_templates/Archive/` carry the same text and are not listed separately.

| # | Location | Text | Sense | Recommendation |
|---|---|---|---|---|
| 3.1 | `RELEASE_PARTICIPANT.md:9`, `RELEASE_HORSE_CARE.md:9` (+ load migration :1342 area) | "This Agreement applies at any ranch, **barn**, arena, **stable**, tack room, **trail**, private property, leased premises, event venue, show grounds…" | legal enumeration of places (breadth of the release) | **KEEP** — each noun widens where the release applies. Removing "barn/stable/trail" narrows coverage. Owner to confirm. |
| 3.2 | `RELEASE_PARTICIPANT.md:23,25` — "4. **TRAIL RIDING** — NOT A COMPANY ACTIVITY … trail riding is not a service offered, sold, scheduled, organized, supervised, or conducted by COMPANY…" ; `COMPANY_POLICIES.md:64` — "**Trail riding.** COMPANY does not offer, sell, schedule, supervise, or provide guided **trail rides**…" | the disclaimer NEEDS the word to disclaim it | **KEEP** — it states exactly the owner's position. (Note it contradicts the tone of 1.10.) |
| 3.3 | `FACILITY_RULES.md:80` | "No open flames are permitted in or near **barns**, stalls, aisles, or storage areas." | actual buildings | KEEP (D43 building exception). Optionally "in or near any building, stalls, aisles…" |
| 3.4 | `RELEASE_HORSE_CARE.md:30,32` | "…catch, halter, handle, exercise, **school**, train, ride…" ; activities list includes "**Schooling**" | verb: to school a horse (training term of art) | Owner to rule. If banned in this sense too: "…exercise, train, ride…" and drop "Schooling" from the list (it duplicates "Training"). |
| 3.5 | `RELEASE_JUMPER_ADDENDUM.md:19` | "…may not jump, **school** over fences, or attempt…" | same verb sense | same as 3.4: "…may not jump, ride over fences, or attempt…" |
| 3.6 | `HORSE_TRANSACTION_REP.md:16`, `HORSE_EMERGENCY_VET.md:21`, `RELEASE_HORSE_CARE.md:15`, `sale_and_bos_templates.sql:79,255` (HORSE_SALE_V2, HORSE_BILL_OF_SALE bodies) | "**Barn** Name: {{HORSE.BARN_NAME}}" | the horse's everyday name (the DB column was renamed to `nickname` on 2026-07-17; the owner has ruled twice that "barn name" is the wrong label — see `HorseRecordsPage.tsx:155`) | "Nickname: {{HORSE.BARN_NAME}}" — token key stays (internal), label changes. Also `sale_and_bos_templates.sql:498,516` field label 'Barn name' → 'Nickname', and `template_tokens.notes` (`tokenaudit_notes.sql:79`) "The horse's barn name (nickname)" → "The horse's nickname". |
| 3.7 | Lease structure `20260804020000_lease_structure_batch.sql:93` → clause heading | "Lessons — Lessee's Instruction **Program**" | the lessee's lesson arrangement | "Lessons — Lessee's Instruction" or "Lessons — Lessee's Lesson Plan" |
| 3.8 | Lease structure `:17,:61` + `_lease_button_options()` (`schema_snapshot.sql:969,978`) | field label "Check this box to include restrictions for **trail riding**"; PERMITTED/PROHIBITED activity options "**Trail riding**" (value `TRAIL`); clause "Trail Riding Risks" / "Trail riding is restricted as follows: {{TXN.TRAIL_RESTRICTION}}" (`test/ui/fixtures/contractsend-rpc-payloads.json:431,1784,5613,6458`) | what a LESSEE may do with the leased horse — legal specificity | KEEP the option (a lease must be able to permit or prohibit it); owner to confirm. Values `TRAIL`, `TXN.TRAIL_OMIT`, `TXN.TRAIL_RESTRICTION` are internal keys. |
| 3.9 | MINOR_RIDER template body (`schema_snapshot.sql:47485`; live `contract_templates` row 'Minor Rider Agreement') | checklist "□ Educational **Programs**" among "□ Clinics □ Horse Shows □ Other:" | activities a minor may take part in | "□ Educational Sessions" or "□ Clinics & Educational Events" |
| 3.10 | `template_tokens.notes` (`tokenaudit_notes.sql:66,170`) | ENG.PROGRAM_SCOPE "horsemanship **program** scope … ALWAYS RENDERS BLANK"; TXN.MONTHLY_FEE "monthly **program** fee token … renders blank" | two DEAD tokens (audit already says nothing feeds them) | Retire both tokens rather than reword. |
| 3.11 | `supabase/horse_record/horse_intake_form.md:7`, `horse_record_schema.sql:25` | "**Barn** Name:" / `barn_name text -- barn/call name` | intake form doc + schema note (design docs, not rendered) | "Nickname:" |

---

## 4 · MEMBER APP (signed-in clients read this)

| # | Location | Text | Sense | Suggested replacement |
|---|---|---|---|---|
| 4.1 | `src/components/app/StableEditors.tsx:116`; `src/components/ops/horses/HorseForm.tsx:45,76`; `src/components/app/AddHorseModal.tsx:9`; `src/lib/fieldSources.ts:28`; `src/lib/horses.ts:386`; `src/pages/app/ops/NewContractPage.tsx:31,34` | field label "**Barn** name" / "Enter a barn name or registered name." / "Name (registered or **barn**)" | the horse's nickname | "Nickname" everywhere (the Records page already made this switch at `HorseRecordsPage.tsx:155`). |
| 4.2 | `src/pages/app/CareHome.tsx:90` | "**Barn**: {nickname}" | nickname | "Nickname: …" or just the nickname in quotes |
| 4.3 | `src/components/app/PartiesHorseCard.tsx:34-45` | comment + variable `barn` ("The barn name leads") | nickname | rename variable/comment `nickname` |
| 4.4 | `src/pages/app/HorsePage.tsx:84` | confirm "Remove this horse from your **stable**?" | My Stable | "Remove this horse from My Stable?" (approved term) |
| 4.5 | `src/pages/app/HorsePage.tsx:108`, `src/pages/app/HorseIntakePage.tsx:106` | back-link / button "My **stable**" (lowercase s) | My Stable | "My Stable" (capitalised, the approved form) |
| 4.6 | `src/components/app/StableSection.tsx:177` | submit "Add to the business **stable**" / "Add to my **stable**" | My Stable, company view | "Add to French Heritage Equestrian's horses" / "Add to My Stable" |
| 4.7 | `src/lib/files.ts:157,374`; `src/pages/app/ops/ContentStorePage.tsx:171` | error "Your account is not attached to a **stable**." | the business/tenant | "Your account is not attached to a business." |
| 4.8 | `src/components/app/FilesContent.tsx:35,93,135` | "a **stable** page"; "This deletes your copy from the **stable**'s storage."; "…anything you want the **stable** to have on hand." | the business | "a My Stable page"; "…from French Heritage Equestrian's storage."; "…anything you want French Heritage Equestrian to have on hand." |
| 4.9 | `src/pages/app/ops/ContentStorePage.tsx:218` (staff, same file) | "…owned by the **stable**, not by the person who uploads it." | the business | "owned by French Heritage Equestrian" |
| 4.10 | `src/components/app/HorseIntakeForm.tsx:319` | placeholder "123 **Barn** Rd" | example address | "123 Ranch Rd" |
| 4.11 | `src/components/app/HorseIntakeForm.tsx:435-438` (+ `horses.ts:117-119`, `home_barn`/`current_barn` columns) | label "**Barn** (blank if outdoor)" with prefix picker ['**Barn**', '**Stable**'] → composes "Barn A" | an actual building the CLIENT's horse lives in (may be another facility) | D43 building exception applies. For horses at the Ranch, FHE's own horses are "stall N" with no building. Suggest: keep the field, relabel "Building (blank if outdoor)", prefixes ['Barn', 'Stable', 'Block'] — owner to rule. |
| 4.12 | `src/components/app/HorseIntakeForm.tsx:1110` | "A stay of more than 48 hours away from the lease location (show, vet, another **barn**)." | another facility | "(show, vet, another facility)" |
| 4.13 | `src/components/app/ContractCascade.tsx:996` | placeholder "Facility / place name (e.g. Willow Creek **Stables**)" | example facility name | "Facility / place name (e.g. Carmel Creek Ranch)" |
| 4.14 | `src/pages/app/CalendarPage.tsx:448,452` (comments) + `:940` link `?section=stable` | comments "the **barn**'s monthly…", "in the **barn**'s own words" | the business | comment-only: "French Heritage Equestrian's" |
| 4.15 | `src/lib/seed.ts:76,153,172,195` (demo/seed content) | "A generous, push-ride **hunter**…"; "Summer **barn** dinner" ×2; discipline: '**Hunter**' | demo data shown in the Community feed / My Stable demo | "push-ride jumper"; "Summer Ranch dinner"; 'Jumper' |
| 4.16 | `src/portal/__fixtures__/portalFixtures.ts:31` | "Buyer representation for **hunter** prospect." | test fixture | "jumper prospect" |
| 4.17 | `src/components/app/ActivationOrderPanel.tsx:49-59` (comment only) | "3 of us at the **stables** have been told" (examples of the tenant-term rendering) | property-term mechanism examples | comment-only; the rendered text uses `usePropertyTerm` = "ranch" for FHE |
| 4.18 | `supabase/migrations/20260816T3100_evaluation_gold_copy.sql:4` → live `offerings.note` (Evaluation Lesson card, public catalog) | "…go over horsemanship practices at our **stable**…" | the Ranch | "…horsemanship practices at the Ranch…" (needs a migration; owner authored this line 2026-08-16) |
| 4.19 | `src/components/app/AppOverviewModal.tsx:13-28,81-138,257`; `src/components/app/AppLayout.tsx:1300-1304,1861`; `src/pages/app/Onboarding.tsx:392-1023` | "App **tour**" menu item, "welcome **tour**", "You can reopen this **tour** any time…" | the app walkthrough feature (not a property tour) | If the ban reaches this sense: "App overview" / "Walkthrough". Internal: `profiles.tour_seen_at`, `tour_seen_desktop_at`, `tour_seen_mobile_at`, `mark_tour_seen()`, `onOpenTour`, `TourFormFactor` (~31 sites). |

---

## 5 · STAFF / OPS APP (staff read this)

| # | Location | Text | Sense | Suggested replacement |
|---|---|---|---|---|
| 5.1 | `src/App.tsx:509` | Settings page description "Configuration for how the **barn** runs." | the business | "Configuration for how French Heritage Equestrian runs." |
| 5.2 | `src/components/app/LeadWorkDrawer.tsx:54` | checklist label "Right **program** identified" (key `program_identified` is stored in `requests.checklist` jsonb — changing the KEY orphans stored ticks; change the LABEL only) | the right service/lesson | "Right service identified" |
| 5.3 | `src/lib/dashboard/registry.ts:91`; `src/components/app/dashboard/TrainerZones.tsx:375`; `src/lib/ops/api-dashboard.ts:126`; DB `dash_stable_board()` | Trainer dashboard zone C7 title "The **stable**" | the horses | "Horses" or "The stalls" |
| 5.4 | `src/components/app/AppLayout.tsx:562`; `src/lib/pageRegistry.ts:231` (`people.stable`, Records row) | staff Records nav row label "**Stable**" → /app/records/horses (owner chose it 2026-08-08, before CR-111; the A1 approval named "My Stable" only) | the horses roster | Owner to confirm whether the bare "Stable" row is covered by A1. If not: "Horses". |
| 5.5 | `src/pages/app/AccountHub.tsx:175,201` | NavRow "My Stable" sub "The business's horses, gear, and supplies" / "Your horses, gear, and supplies" | approved | none (approved) |
| 5.6 | `src/pages/app/AccountHub.tsx:235`; `AppLayout.tsx:639`; `pageRegistry.ts:115,298`; `OpsDashboard.tsx:117`; `BarnopsHubPage.tsx:81,86,88`; `ConsumptionLogPage.tsx:133`; `AllocationRulesPage.tsx:344`; `ResourcesPage.tsx:369` | module label "**Barn** Ops" / "Barn Ops & Inventory"; page titles "… · Barn Ops"; h1 "Barn Ops"; "Inventory, consumption, and cost attribution for the **barn**." | the supplies/inventory module — D43 already says "misnomer twice over", held under CR-109; CR-112 restructures it as Headquarters + My Stable | Do not rename piecemeal. CR-109/CR-112 own it. Interim label if wanted: "Supplies & Inventory". Internal keys `mod.barnops`, `barnops.hub`, route `/app/ops/barnops`, `api-barnops.ts` follow whatever CR-112 names it. |
| 5.7 | `ConsumptionLogPage.tsx:210,218,311`; `AllocationRulesPage.tsx:41,102,290,352,413,438,478`; DB `v_barn_payer` | "attribution falls to the **barn** when blank"; option "— **Barn** / no horse —"; column value "**Barn**"; "**Barn** default"; "the default/**barn** payer" | the business as payer of unattributed consumption | CR-111·A1 vocabulary: "Headquarters" (or "Stalls"/"Tackroom" where the location is meant). "Headquarters default", "— Headquarters / no horse —". |
| 5.8 | `src/pages/app/ops/ContactsPage.tsx:77`; `src/lib/api.ts:2454` | Partners blurb "…referring trainers, affiliated **barns**, event organisers…" | other businesses | "…referring trainers, affiliated ranches and facilities, event organisers…" |
| 5.9 | `src/pages/app/ops/ContactsPage.tsx:607` | archive-reason placeholder "Left the **barn**, duplicate record, test identity…" | left the business | "Left French Heritage Equestrian, duplicate record…" |
| 5.10 | `src/pages/app/ops/lessons/ScheduleSessionForm.tsx:55`; `src/lib/ops/api-lessons.ts:99,149,844` (comments) | "**barn** + client horses", "**barn**-horse lesson", "**barn** horses" | French Heritage Equestrian's own horses vs clients' | comment-only: "company horses" / "our horses" |
| 5.11 | `src/lib/ops/api-calendar.ts:103,119` (comments) | "**Barn**-wide locations … (barn default first)" | tenant-wide | comment-only: "tenant-wide" |
| 5.12 | `src/pages/app/ops/admin/AdminBrandingPage.tsx:186`; `superadmin/ProvisionTenantPage.tsx:285`; `src/lib/propertyTerm.ts:1,6,20,50-72`; `src/contexts/AuthContext.tsx:47`; DB `property_terms` rows BARN, STABLES (`facilityterm_property_term.sql:76,78`; `…safe_subset_applied.sql:31,33`) | "**Barn**, ranch, **stables**, grounds, facility — whatever you call it…" (the per-tenant property-word picker and its seeded options) | the multi-tenant mechanism D43 names as the seam; FHE's own row is RANCH | KEEP the picker and rows (other tenants choose their own word). Only FHE-rendered copy matters, and FHE resolves to "ranch". |
| 5.13 | `src/pages/app/ops/HorseRecordsPage.tsx:155-158` (comment) | explains the Nickname label and that `home_barn`/`current_barn` are the building columns | already compliant | none |
| 5.14 | `src/pages/app/ContractPage.tsx:317,667,819` (comments) | "**barn**-office wet-signing", "a **barn** admin", "so the **barn** can wet-sign" | the business/office | comment-only: "the Tackroom office" / "a staff admin" |
| 5.15 | `src/lib/questionSets.ts:408` (comment) | "It is how the **barn** operates, not a preference" | the business | comment-only |
| 5.16 | `src/pages/app/MyPayments.tsx:94`; `src/lib/admin.ts:425,671`; `src/lib/standingSlots.ts:25`; `AgreedLessonPanel.tsx:71`; `api/_lib/invitationEmail.ts:50`; `api/deliver-documents.ts:238`; `api/calendar-reminders.ts:168`; `api/inquiry-confirmation.ts:176`; `api/orders-mark-paid.ts:35,80,128`; `src/lib/ops/api-payments.ts:372`; `src/lib/recordedDate.ts:11-43`; `src/lib/dashboard/windows.ts:17`; `api/request-received.ts:1,237,262,270`; `api/_lib/email.ts:141` | the recurring comment idiom "today at the **barn**", "the **barn**'s own timezone", "email the **barn**", "the **barn**'s week", "other **barns**' from-domains" | the business / the Ranch (timezone, inbox) | comment-only. If the owner wants internal purity: "at the Ranch" for timezone/day, "French Heritage Equestrian" for the inbox/business. `barnToday()` (18 sites) → `ranchToday()`. |
| 5.17 | `src/components/PublicIntakeForm.tsx:266` (comment) | "which side of the **barn** to walk them round" | figurative | comment-only |
| 5.18 | `src/index.css:427` (comment) | "Quiet **Stable**: landing + story showcase utilities" | design-theme name | comment-only: "Quiet Ranch" |
| 5.19 | `README.md:8` | "…horses/**stable**, evaluations…" | module list | "horses / My Stable" |
| 5.20 | `scripts/build-sale-template-migration.mjs:264,267` | generator emits 'HORSE.BARN_NAME', 'Barn name' | see 3.6 | label 'Nickname' |

---

## 6 · INTERNAL NAMES (routes, DB objects, keys, code identifiers)

Visible in URLs, the DB, the admin token/page registries, or only in source. Renaming DB objects is a migration with the D-rule ACL trap (DROP+CREATE re-grants anon); renaming TS identifiers is churn with no rendered effect. Recommend the owner rules **which tier** must change, not each name.

| Tier | Name(s) | Where | Note |
|---|---|---|---|
| URL (users see it) | `/app/stable` | `App.tsx:315`, nav links | "My Stable" is approved → keep |
| URL | `/app/ops/barnops` | `pageRegistry.ts:298`, `AppLayout.tsx:639` | follows CR-109/CR-112 |
| URL / catalog slug | offering slug `hunter-jumper` (→ service_type JUMPER_TRAINING) | `offerings` row (seeded 2026-06-23); `src/lib/inquiry.ts:29,75`; `src/lib/serviceCatalog.ts:62`; `test/db/crm_identity.test.ts:84,90` | D38 says never "hunter/jumper". Suggest slug `jumper-training`; update the 3 code sites + test; keep a redirect if the slug ever appeared in a public link. |
| DB tables/types | `stable_items`, enum `stable_item_kind` | `stable_business_aware.sql:187-232` | backs My Stable (approved) → keep |
| DB functions | `my_stable_horses`, `my_stable_add_horse`, `my_stable_update_horse`, `my_stable_delete_horse`, `dash_stable_board`, `my_nav_presence` key `stable`, `file_links.kind='stable'` | live migrations | My Stable → keep |
| DB columns | `horses.home_barn`, `horses.current_barn` (+ `p_barn_name` params, which actually write `nickname`) | `horse_location_multiline.sql`, `stable_business_aware.sql:92,132` | `home_barn/current_barn` = building (allowed). `p_barn_name` is a misnomer for nickname → `p_nickname` if a signature change is ever made anyway. |
| DB seed data | `horses.current_barn = 'Main Barn'`, `current_location = 'Carmel Creek Ranch, Main Barn, Stall 12'`, facility name 'FHE Main Barn Stall 12' | `horse_location_multiline.sql:84-91`; `u2_labels_meds_dates_location.sql:108` | FHE horses live in numbered stalls with no barn (owner). Seed rows → 'Stall 12' only; facility name 'Carmel Creek Ranch — Stall 12'. |
| DB form schemas | `form_definitions` INTAKE_HORSE_EVALUATION / FINDER / LEASE_OUT (+3 more; 6 hits) checkbox options ["Lessons","**Hunters**","Jumpers","Equitation","Dressage",…] | `migrations-archive/20260629120000_form_definitions.sql:47,55,63…`; `test/db/form_definitions.test.ts:86` asserts 'Hunters' exists | a client's horse's discipline (not FHE's offer). Owner to rule; if removed, the test must change. |
| DB tokens/fields | `HORSE.BARN_NAME` (label 'Barn name'), `ENG.PROGRAM_SCOPE` (dead), `TXN.MONTHLY_FEE` (dead), `TXN.TRAIL_OMIT`, `TXN.TRAIL_RESTRICTION`, option value `TRAIL` | see §3.6, 3.8, 3.10 | labels change; keys stay (documents already reference them) |
| DB profile columns | `profiles.tour_seen_at`, `tour_seen_desktop_at`, `tour_seen_mobile_at`, `mark_tour_seen()` | archive migrations | only if "App tour" is renamed (§4.19) |
| DB email row | `email_templates.CALENDAR_DAY_SHEET` title/subject | §2.1 | migration needed |
| Request checklist key | `program_identified` | `LeadWorkDrawer.tsx:54` | stored in jsonb → keep key, change label |
| TS/JSX identifiers (source only) | `listStableHorses`, `StableHorse`, `StableSection`, `StableEditors`, `StableItem*`, `StableOwnership`, `StableRow`, `StableReason`, `StableZone`, `fetchStableBoard`, `lib/stable.ts`, `pages/app/Stable.tsx`, `barnToday`, `barnName`, `barnopsOn`, `BarnopsHubPage`, `api-barnops.ts`, `onOpenTour`, `setTourOpen`, `markTourSeen`, `TourFormFactor`, `currentTourFormFactor`, BookRider value `'school'` | ~80 distinct names, ~400 sites | No rendered effect. Recommend: leave unless the owner wants internal purity; `barnToday` → `ranchToday` is the one worth doing (18 sites, the timezone idiom). |

---

## 7 · ALLOWED BY THE RULING AS WRITTEN (listed so nothing is hidden)

- **"My Stable"** everywhere it is rendered capitalised (AccountHub, AppLayout, AppOverviewModal, Stable.tsx eyebrow/title, HorseIntakePage back-link) — CR-111·A1.
- **Building-sense "barn"**: FACILITY_RULES fire clause (3.3), horse intake building/stall composite (4.11), `home_barn`/`current_barn` columns.
- **SQL `STABLE`** volatility keyword (~240 sites), and "stable id / stable seam / stays stable" adjective uses (`kit-contract.ts:7`, `portalFixtures.ts:5`, `pageRegistry.ts:72`, `api-lessonplan.ts:44`, `contracts.ts:1457`, `AdminProductsPage.tsx:141,617`, `ClauseDocument.tsx:1261,1273`, `HorsePage.tsx:378`, `HorseIntakeForm.tsx:116`, `DataTable.tsx:28`, `cart.ts:25,48`, `api.ts:1041`, `pagevis…sql:40,126`, `lessonplan_m1…sql:200`) — not the noun.
- **"trailing"** (columns, whitespace) — not the word.
- `CLAUDE.md:934-939` **D38's own heading still reads "IT IS A PROGRAM, NOT A BARN"** — D43's amendment supersedes it but the D38 text was not edited. Suggest a one-line strike-through note on D38 so the next reader does not apply it.

---

## 8 · NOT AUDITED LINE-BY-LINE (history, not surfaces)

- `docs/` — 4,800+ hits; task docs, ledgers and rulings quote the words by design.
- `supabase/migrations-archive/` — 222 hits in applied history (e.g. `20260717150000_rename_barn_to_nickname.sql`); the live DB state they produced is covered in §6.
- `test/` — 400+ hits, of which `test/db/fixtures/schema_snapshot.sql` (308) mirrors the DB and regenerates; the rest assert current labels (`form_definitions.test.ts:86` 'Hunters', `crm_identity.test.ts:90` 'hunter-jumper', `contract_workflow.test.ts:197-207` 'Trail riding', `cr85_three_nav_sections.test.ts` 'Stable' row, `mod_barnops.test.ts`). Each rename above lists its test.
- `public/ffmpeg/ffmpeg-core.js` — vendor minified JS.

---

## 9 · WHAT THE OWNER IS ASKED TO RULE

1. The three sense questions in §0 (adjective "stable"; building "barn"; "App tour").
2. §3.1–3.2, 3.8: keep the legal enumerations and the trail-riding disclaimers/lease options as-is?
3. §3.4–3.5: is the verb "to school (a horse)" banned too?
4. §5.4: does the A1 "My Stable" approval extend to the staff Records row labelled plain "Stable"?
5. §5.6–5.7: confirm Barn Ops vocabulary waits for CR-109/CR-112, and that "Headquarters" is the unattributed-consumption payer word.
6. §6: which tier of internal names must change (URL / DB / source-only).
7. Every line-level suggestion in §1, §2, §4, §5 — accept, reword, or leave.

**Apply-thread shape once ruled:** one TASK with public copy + emails (migration for §2.1, §4.18) first, contract bodies second (re-load migration + `remerge_contract_body`), Barn Ops deferred to CR-112.
