# TASK-SIGNFLOW-F — the rest of the app, by the rule

**Spec by `FHE-DSNR-SIGNFLOW`, 2026-09-01. Change order: `CR-102`, chunk 4 of 4.**
**Thread name: `FHE-TASK-SIGNFLOW-F`.**
🔒 **MUST NOT START UNTIL `TASK-SIGNFLOW-C` HAS MERGED.** ⚠️ **If
`docs/reports/TASK-SIGNFLOW-C-REPORT.md` does not exist, stop and ask `ORCH` through the owner.**
**It does NOT depend on `D` or `E` — your file list is disjoint from both.**

🔒 **THIS IS THE SWEEP. It is deliberately the LAST chunk and it is deliberately the MECHANICAL one:
`C` decided the rule, `D` proved it on the flow the owner walks, `E` protected the gold that survives.
Your job is volume applied faithfully — not judgement.** ⚠️ **If you find yourself deciding, see §4 T5.**

> ## READ THESE, BY PATH — nothing else is handed to you
> - `docs/method/TASK-ROLE.md` · `docs/method/CLNR-ROLE.md` §3 · `docs/method/THE-RUNNING-RECORD.md`
>   (open `docs/reports/FHE-TASK-SIGNFLOW-F-LEDGER.md` FIRST).
> - 🔒 **`docs/tasks/TASK-SIGNFLOW-C-...-global-classes.md` §3, §3a, §3b — the rule, the mapping, the keepers.**
> - 🔒 **`docs/reports/TASK-SIGNFLOW-C-REPORT.md` — the mapping block verbatim, plus C's deviations.**
> - **`docs/reports/TASK-SIGNFLOW-D-REPORT.md`** if it exists — D's §4c deviations are precedents you
>   should follow rather than re-derive.
> - `docs/reference/CHANGE-ORDER-LEDGER.md` §CR-102 — the owner's full verbatim ruling.

---

## 1. THE OWNER'S WORDS

> *"change the brown used on the things like icons, strikethru, checkmarks, text, boarders,
> highlights, and buttons in the doc signing flow to the company green color."*
> …and, when DISCO asked whether that meant the signing flow or the app: **the rule is
> DECORATIVE vs FUNCTIONAL, applied everywhere** — green for *"anything that is a functional action
> element or something like an icon or text"*, in the signing flow *"and any other places its used."*
> — owner, `docs/reference/CHANGE-ORDER-LEDGER.md` §CR-102

**"Any other places its used" is this chunk.**

## 2. WHAT WAS MEASURED — re-run by DSNR on 2026-09-01

| Fact | Query | Result |
|---|---|---|
| whole-app total | `grep -rEo 'gold-[0-9]+' src \| wc -l` | **568** across **96 files** |
| `C`'s share | `src/index.css` + `src/components/app/app-header.css` | **34** |
| `D`'s share | the 18 document/contract files | **210** |
| `E`'s share | the 4 shell/keeper files | **47** |
| 🔒 **YOUR share** | **the 70 files below** | **277 numeric + 25 `gold-ink`** |

**34 + 210 + 47 + 277 = 568.** ⚠️ **Every gold reference in the app is assigned. If you find one that
is not in any of the four lists, that is a finding — report it.**

🔒 **YOUR FILE LIST, EXHAUSTIVE. ⚠️ A file not on it belongs to `C`, `D` or `E`.**

| File | `gold-[0-9]+` | `gold-ink` |
|---|---:|---:|
| `src/components/feed/CommunityFeed.tsx` | 23 | 0 |
| `src/components/app/HorseIntakeForm.tsx` | 16 | 0 |
| `src/components/app/ClientInvitationSection.tsx` | 13 | 0 |
| `src/pages/Story.tsx` | 12 | 0 |
| `src/components/app/DashboardPanel.tsx` | 11 | 0 |
| `src/components/app/ClientRecordActions.tsx` | 10 | 0 |
| `src/pages/app/ops/ContactsPage.tsx` | 9 | 0 |
| `src/components/app/ContactDossierModal.tsx` | 8 | 0 |
| `src/components/app/dashboard/TrainerZones.tsx` | 8 | 0 |
| `src/components/feed/PostModal.tsx` | 8 | 0 |
| `src/components/app/EmailChangeModal.tsx` | 7 | 0 |
| `src/components/app/StableSection.tsx` | 6 | 0 |
| `src/components/app/dashboard/DashboardChrome.tsx` | 6 | 0 |
| `src/pages/app/ops/TeamPage.tsx` | 6 | 0 |
| `src/pages/app/ops/review/ReviewIndexPage.tsx` | 6 | 0 |
| `src/pages/app/CalendarPage.tsx` | 6 | 4 |
| `src/pages/About.tsx` | 5 | 0 |
| `src/pages/Landing.tsx` | 5 | 0 |
| `src/pages/Redeem.tsx` | 5 | 0 |
| `src/pages/app/CareHome.tsx` | 5 | 0 |
| `src/components/gift/GiftReveal.tsx` | 4 | 0 |
| `src/pages/app/DealHome.tsx` | 4 | 0 |
| `src/pages/app/InstructorHome.tsx` | 4 | 0 |
| `src/pages/app/ops/HorseRecordsPage.tsx` | 4 | 0 |
| `src/pages/app/ops/lessons/SessionActivityForm.tsx` | 4 | 0 |
| `src/components/OfferingCatalog.tsx` | 4 | 1 |
| `src/components/app/MyPostsContent.tsx` | 4 | 1 |
| `src/components/app/InvitationHistoryPanel.tsx` | 3 | 0 |
| `src/components/app/ProvisionClientForm.tsx` | 3 | 0 |
| `src/components/app/StandingSlotPicker.tsx` | 3 | 0 |
| `src/components/app/profile/SectionCard.tsx` | 3 | 0 |
| `src/pages/Faq.tsx` | 3 | 0 |
| `src/pages/app/HorsePage.tsx` | 3 | 0 |
| `src/pages/app/ops/InstructorHomePreview.tsx` | 3 | 0 |
| `src/pages/app/ops/review/ReviewBanner.tsx` | 3 | 0 |
| `src/components/app/GiftsContent.tsx` | 2 | 0 |
| `src/components/app/OrdersContent.tsx` | 2 | 0 |
| `src/components/app/SameHorseAsk.tsx` | 2 | 0 |
| `src/components/app/TodaysPlansPanel.tsx` | 2 | 0 |
| `src/components/app/dashboard/BusinessZones.tsx` | 2 | 0 |
| `src/components/app/profile/ProfileCard.tsx` | 2 | 0 |
| `src/components/order/OrderPayment.tsx` | 2 | 0 |
| `src/pages/app/MemberProfile.tsx` | 2 | 0 |
| `src/pages/app/MyPayments.tsx` | 2 | 0 |
| `src/pages/app/ops/DealsPage.tsx` | 2 | 0 |
| `src/pages/app/ops/LookupReviewPage.tsx` | 2 | 0 |
| `src/pages/app/ops/superadmin/TenantDetailPage.tsx` | 2 | 0 |
| `src/pages/Services.tsx` | 2 | 1 |
| `src/pages/BookRider.tsx` | 2 | 3 |
| `src/components/app/PartiesHorseCard.tsx` | 2 | 5 |
| `src/components/ContinueShoppingModal.tsx` | 1 | 0 |
| `src/components/app/AccountPanels.tsx` | 1 | 0 |
| `src/components/app/ActivateShell.tsx` | 1 | 0 |
| `src/components/app/CreateModal.tsx` | 1 | 0 |
| `src/components/app/ExplainTip.tsx` | 1 | 0 |
| `src/components/app/RecordedDateField.tsx` | 1 | 0 |
| `src/components/app/VerifyEmailScreen.tsx` | 1 | 0 |
| `src/components/feed/FeedVideo.tsx` | 1 | 0 |
| `src/pages/Shop.tsx` | 1 | 0 |
| `src/pages/app/HorseIntakePage.tsx` | 1 | 0 |
| `src/pages/app/Messages.tsx` | 1 | 0 |
| `src/pages/app/ops/admin/AdminPageVisibilityPage.tsx` | 1 | 0 |
| `src/pages/app/ops/lessons/GrantCreditDialog.tsx` | 1 | 0 |
| `src/pages/app/ops/lessons/LessonPlansPage.tsx` | 1 | 0 |
| `src/components/app/MyLessonPlanCard.tsx` | 1 | 1 |
| `src/pages/app/ops/ModerationPage.tsx` | 1 | 1 |
| `src/pages/app/ops/SupportPage.tsx` | 1 | 1 |
| `src/pages/Confirmation.tsx` | 1 | 2 |
| `src/pages/Lessons.tsx` | 1 | 2 |
| `src/components/ServiceSelector.tsx` | 1 | 3 |
| **total** | **277** | **25** |

**Query to reconcile:** `for f in <list>; do grep -oE 'gold-[0-9]+' "$f" | wc -l; done`.
⚠️ **Re-run it before you start and again before you report.**

**Thirteen further files contain `gold-ink` and NO numeric gold** — `QualifierGroup.tsx`,
`QualifierText.tsx`, `AvailabilityPicker.tsx`, `ContractChangeHistory.tsx`, `MyLessonsContent.tsx`,
`NotifyConfirmModal.tsx`, `Checkout.tsx`, `BookSupport.tsx`, `Gift.tsx`, `Contact.tsx`,
`app/Schedule.tsx`, `app/CalendarItemPanel.tsx`, `ops/ContentStorePage.tsx`.
🔒 **THEY NEED NO EDIT AT ALL** — `C` made `.text-gold-ink` paint green. ⚠️ **Do not open them to
"finish the job"; they are already finished.**

## 3. 🔒 THE RULE YOU APPLY — from `C` §3a, and you do not re-derive it

**FUNCTIONAL → GREEN.** An action element, an icon, text, a border, a highlight, a focus affordance,
a state marker.
**DECORATIVE → STAYS GOLD.** A small light-gold accent, almost always on a DARK green surface.

🔒 **THE MECHANICAL MAPPING: `gold-N` → `green-N`, SAME NUMERIC STEP, opacity suffix unchanged.**
Both scales run dark→light in the same direction (`tailwind.config.js:64-76`, `:99-110`).
`bg-gold-50/70` → `bg-green-50/70`. `border-gold-400/60` → `border-green-400/60`.
`text-gold-900` → `text-green-900`.

**Deviations are allowed only in these two cases, and each must be listed in your report:**
1. **Placeholder / hint text.** A same-step green is darker than the page's own hint token. **Converge
   on the incumbent instead: `text-muted` or `placeholder:text-green-800/40`** (`src/index.css:153`,
   `:282`). ⚠️ **`D` set this precedent; follow it rather than inventing a second answer.**
2. **Contrast on a filled control.** White text on `gold-500`/`600` becomes white on
   `green-500 #2d7043` / `green-600 #215531`. **Compute the ratio; if under 4.5:1, step one darker and
   say so.**

## 4. THE TRAPS
- 🔒 **T1 — THE ARBITRARY-VALUE TRAP, TWICE BITTEN, AND YOU ARE THE MOST EXPOSED CHUNK.**
  `border-green-900/12` emitted **no CSS rule at all** because `/12` is not in the scale
  (`docs/method/TASK-ROLE.md` §2a, `tailwind.config.js:13-22`). ⚠️ **Across 277 sites you will write
  many opacity suffixes. A missing rule looks like "no border", which reads as a deliberate design
  choice, so nobody catches it by eye.** **Prove it in the BUILT CSS** — §8 item 3.
- **T2 — a substring replace will corrupt this repo.** `text-gold-ink` contains `gold-`;
  `decoration-gold-600` is a keeper token in `E`'s files but the same string appears nowhere in
  yours — ⚠️ **verify that before relying on it.** **Use `gold-[0-9]+` as the boundary and check every
  hit; a blind `sed s/gold-/green-/g` breaks `text-gold-ink` and `.btn-outline-gold`.**
- **T3 — `text-gold-ink`, `focus-ring`, `form-input`, `eyebrow`, `btn-outline-gold`, `btn-primary`,
  `link-underline`, `selectable-card`, `step-complete` need NO edit.** `C` moved them all.
  ⚠️ **Replacing a global class with an inline green deletes a token and undoes `C`'s work.** The 25
  `gold-ink` hits in your files are **already done**.
- **T4 — light gold on a DARK green surface is the decorative case and it survives.** Before greening
  any `gold-300/400/500`, check what is behind it. ⚠️ **`text-gold-400` on `bg-green-900` greened
  becomes green-on-green and vanishes** — that is a legibility bug, not a colour change. **Where you
  find one, KEEP it and list it in your report under "kept as decorative-on-dark".**
- 🔒 **T5 — THERE ARE NO NAMED KEEPERS IN YOUR FILE LIST. DSNR verified this.** Every keeper the owner
  named (`RosterCard.tsx:83`, `Header.tsx:151`/`:165`, `AppLayout.tsx:120`/`:163`/`:253`) lives in
  `E`'s four files. ⚠️ **So apart from the T4 legibility case, every gold site in your 70 files goes
  green. If you believe you have found a keeper here, STOP and report it as a QUESTION — do not decide
  it.** **That is the single strongest signal that the rule has an exception nobody has seen, and it
  is worth more than finishing the file.**
- **T6 — hue only.** No layout, spacing, radius, border-style, weight or state-logic change anywhere.
- **T7 — do not report the tangential** (CR-94). You will pass a great deal of code. ⚠️ **A finding
  outside this task gets ONE LINE under "flagged, not fixed."** No analysis, no reproduction.

## 5. OUT OF SCOPE — do not touch
- **Any file not in §2's table**, including the thirteen `gold-ink`-only files.
- `src/index.css` and `src/components/app/app-header.css` — **`C`'s**.
- `tailwind.config.js`. 🔒 **The gold scale STAYS** — `E`'s keepers use it.
- Any DB write, migration, RPC, copy or template change. **This chunk is CSS classes only.**

## 6. THE REACH
⚠️ **70 files is too many to walk one by one, and pretending otherwise is how a sweep gets reported as
done. Group them, and hand the owner the GROUPS:**

| Group | Files | Where to look |
|---|---|---|
| the public marketing site | `Landing`, `About`, `Story`, `Faq`, `Services`, `Shop`, `Lessons`, `Confirmation`, `BookRider`, `OfferingCatalog`, `ServiceSelector`, `ContinueShoppingModal` | `/`, `/about`, `/story`, `/faq`, `/services`, `/shop` |
| the community feed | `CommunityFeed`, `PostModal`, `FeedVideo`, `MyPostsContent` | `/app` → the feed, open a post |
| the member app | `DashboardPanel`, `dashboard/*`, `TodaysPlansPanel`, `OrdersContent`, `GiftsContent`, `MyPayments`, `MemberProfile`, `profile/*`, `AccountPanels`, `Messages`, `StandingSlotPicker`, `SameHorseAsk`, `MyLessonPlanCard`, `RecordedDateField`, `CalendarPage`, `CareHome`, `DealHome`, `InstructorHome`, `HorsePage` | `/app` and each of its pages |
| identity + invitations | `ClientInvitationSection`, `InvitationHistoryPanel`, `ProvisionClientForm`, `ClientRecordActions`, `ContactDossierModal`, `EmailChangeModal`, `VerifyEmailScreen`, `ActivateShell`, `CreateModal`, `ExplainTip` | staff → a contact → the dossier and its actions |
| horses + stable | `HorseIntakeForm`, `HorseIntakePage`, `HorseRecordsPage`, `StableSection`, `PartiesHorseCard` | `/app/stable`, horse intake, horse records |
| ops | `ContactsPage`, `TeamPage`, `DealsPage`, `LookupReviewPage`, `ModerationPage`, `SupportPage`, `review/*`, `lessons/*`, `admin/*`, `superadmin/*`, `InstructorHomePreview` | the ops nav, each page |
| gift + order | `GiftReveal`, `Redeem`, `OrderPayment` | the gift reveal and redeem flow, checkout payment |

## 7. THE TELL
There is no state change here, so the tell is purely visual and app-wide: **no functional action
element, icon, or text is left in `gold-800`/`gold-900` brown.** The undo is `git revert`; nothing is
persisted and nothing needs a migration.

## 8. THE TEST THIS MUST PASS
**Built from the validation criteria the owner agreed on 2026-09-01
(`docs/reports/FHE-DISCO-SIGNFLOW-HANDOFF.md` §ITEM 3): *"App-wide: no functional action element, icon,
or text remains in gold-800/900 brown"*, and *"the named keepers still gold."***
⚠️ **Renders are NOT verified by you. Items 5–7 are the numbered checklist you hand the owner, and it
must name the phone.**

1. `git diff --stat` shows **only files from §2's table**.
2. 🔒 **`grep -rE 'gold-(800|900)' <your 70 files>` returns ZERO** — those two shades are the brown, and
   none of them is ever the decorative-on-dark case. ⚠️ **Any remaining `gold-300/400/500/600` in your
   files is a T4 keep and must appear by name in your "kept as decorative-on-dark" list.**
   State the full `grep -rEo 'gold-[0-9]+' src | wc -l` before and after, and reconcile it against the
   568 → the number you predict.
3. 🔒 **THE T1 PROOF — THE BUILT CSS, NOT THE SOURCE.** After `npm run build`: for every **distinct**
   green class you introduced, prove a rule exists in `dist/assets/*.css`. ⚠️ **Report the distinct-class
   list and the per-class result.** **"The build succeeded" is not this test.**
   Also `grep -o '#ba9935\|#7a6421\|#5c4a18' dist/assets/*.css | sort | uniq -c` — **`#ba9935` must
   still be non-zero** (`E`'s keepers); **`#7a6421` and `#5c4a18` should be at or near zero, and you
   must account for anything left.**
4. `npx tsc --noEmit` clean; `npm run build` succeeds. ⚠️ **`npm run test:db` is red at baseline and
   proves nothing** — do not report it either way.
5. **Walk each of §6's seven groups** and confirm **zero brown** on icons, checkmarks, text, borders,
   highlights and buttons. ⚠️ **Report group by group, not as one line.**
6. **Nothing became illegible.** Specifically: every place you kept a light gold on a dark surface (T4)
   still reads, and every place you greened one is still legible against its background. **List them.**
7. 🔒 **THE KEEPERS ARE STILL GOLD** — the contact-card avatar ring, the selected nav row, the
   notification count. ⚠️ **You did not edit `E`'s files; this item proves you did not reach them
   through something you did edit.**
8. **Your deviations (§3) and your T4 keeps are each listed with a reason.**
9. **The reconciliation from §2 holds:** `34 + 210 + 47 + 277 = 568`, and after all four chunks the
   only `gold-*` left in `src` is `E`'s keepers plus your T4 list plus the class definitions `C` kept.
   ⚠️ **State the final number and what makes it up.**

## 9. WHERE THE REPORT GOES
`docs/reports/TASK-SIGNFLOW-F-REPORT.md`. Ledger: `docs/reports/FHE-TASK-SIGNFLOW-F-LEDGER.md`.
**Open the ledger with your first action.** `ORCH` verifies your claims itself. **You do not push.**
