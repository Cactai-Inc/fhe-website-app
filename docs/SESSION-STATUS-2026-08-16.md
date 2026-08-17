# SESSION STATUS — 2026-08-16

**Written before a context compaction.** State only. `main` = `53b3056`, clean, pushed.
Supersedes `SESSION-STATUS-2026-08-12.md`.

---

# 1. WHAT SHIPPED TODAY (all merged to main, deployed)

**Merged from threads, each audited against prod before merging:**
`PAYLOCK` · `CREDITFIX` · `BOOKLINK` · `REVIEWQ` · `PAGEMERGE` · `ONBOARD` · `CASHCONFIRM` ·
`ZELLECLOSE` · `CREDITALIGN` · `LESSONFORM` · `PARTYSTAGING` follow-ups.

**Defects found and fixed by the orchestrator during audits** (not by the threads):
- **Quote-priced offerings could not be provisioned at all** — `purchase_items.price_amount` is
  NOT NULL and provisioning passed it straight through, so Horse Finder / Horse Evaluation /
  Acquisition Assistance crashed. The whole acquisition lane was unsellable. (`1667e37`)
- **Two unguarded anon-reachable RPCs** — `claim_receipt_send` / `log_receipt_send` had no auth
  check at all; an anonymous caller could suppress a receipt or write false delivery rows.
- **Four partystaging RPCs shipped anon-executable** — `REVOKE … FROM PUBLIC` does not remove a
  direct grant. Caught with `has_function_privilege`, not by reading the migration.
- **`node_modules` corrupted by case-variant symlinks** (`/Users/Cactai` vs `/Users/cactai`) —
  macOS loaded React twice, nulling every hook. Broke the build and ~50 UI tests; a clean
  `npm install` fixed it. **This is why threads must never symlink node_modules.**
- **The selection bar was missing from `/lessons`** — the one page where lessons are chosen.

**Website work (all owner-directed, all deployed):**
- Lessons page: full catalog copy rewrite, badges, gold price lines, punch-card line breaks,
  own-horse row, weekly footnote, headline `Start Riding With Us`.
- Landing hero: new images, phone layout, position.
- **Our Community page (`/story`)**: renamed from Our Story in nav; new images (Hero_A, Stables,
  Trail); newspaper float in section 1; sections renamed to **Our Story · What You'll Find ·
  Beyond The Arena · Our Services · What We Deliver**; anchor ids match the eyebrows because they
  show in the URL; a Continue link ends each section; cards-forward layout in Our Services.
- Nav: `Book a Lesson` added, `Say Hello` moved to the right corner as an outlined gold button,
  account links moved to the footer (kept in the mobile menu).
- `/shop` hidden (redirects to `/lessons`) — web visitors get funnelled, not shown a catalogue.
- Back/forward navigation now restores scroll position instead of jumping to the top.
- Acquisition page: three cards side by side, full-width container.
- Floating selection bar on all four funnel pages.

---

# 2. THE FLOW WORK — the owner's design, captured in specs, NONE BUILT YET

**These four are one program and MUST be sequenced, not run in parallel — they all touch
`/lessons` and the checkout.** Recommended order:

1. **`TASK-THREEFORMS`** — one step-2 form for all three funnels, three configurations, plus the
   combined category-separated form for a mixed cart. **Start here**; the others build on the
   shape it establishes.
2. **`TASK-RIDERQUALIFY`** — the lesson buyer answers what you would ask on the call. The
   questions already exist, orphaned, on `/book/rider`.
3. **`TASK-SESSIONBOOK`** — `/lessons` becomes a purchase flow when signed in, and hides
   own-horse lessons from members with no horse.
4. **`TASK-LESSONREQUEST`** — enquiry → staff approve/amend the slot → activation link →
   onboarding → payment → app. **The only missing link is step 4** (staff approving or amending
   the requested time); every other step already exists.

**The owner's stated flow, verbatim, is in `TASK-LESSONREQUEST`.** The key principle he gave:
*"every website visitor who submitted a form has converted to something"* — an enquiry is a
customer who has already decided.

---

# 3. OTHER SPECS WRITTEN, NOT RUN

- **`TASK-GIFTPATH`** — gifts stay a conversation. **No gift checkout gets built** (owner: *"i
  want the chance to talk to a person buying a gift"*). `/gift` becomes the primary path; needs
  reach from horse care + acquisition, and a **provable** staff alert.
- **`TASK-CASHCONFIRM`** — cash claims confirm like Zelle. (Built and merged; see §1.)
- **`TASK-FEECHOICE`** — staff apply / substitute / waive the reschedule fee. No-show ($75) and
  the two late-start fees ($30/$40) are staff-applied, not automatable.
- **`TASK-DEPENDENT`** — guardian buys, dependent rides. **Gabriella Olenik is a real 13-year-old
  recorded as the buyer of her own lessons.** Four owner questions unanswered in that spec.
- **`TASK-RECORDSELECT`** — row + bulk Archive on every Records tab; `DataTable` has no selection
  support at all today.
- **`TASK-CREDITALIGN`** — built and merged; see §1.

---

# 4. BLOCKED ON THE OWNER

1. **`TASK-DEPENDENT`'s four questions** — can a guardian use their own credit; can siblings
   share; does Brian get an account now; what happens at 18.
2. **`TASK-THREEFORMS`** — should acquisition reach `/checkout` at all, given it takes no payment?
3. **`TASK-GIFTPATH`** — which fields on the gift form.
4. **`TASK-RIDERQUALIFY`** — which of the three rider questions, and where in the flow.
5. **`TASK-LESSONREQUEST`** — does an agreed-by-phone time get a confirmation email?
6. **Browser verification** — nothing built today was verified in a browser. Several reports end
   with numbered click-through checklists.

---

# 5. STANDING FACTS WORTH KEEPING

- **The catalog is the source of truth for every number.** Nothing may parse offering names —
  names changed on 2026-08-15 and a name-based rule broke credit minting three separate times.
- **`horse_included`**: 8 offerings `true`, 4 `false`, **14 `null`**. A filter must use `= true`,
  never `!= false`.
- **Reschedule fee bands are loaded from the SIGNED Company Policies §6**: 48h → $10, 24h → $20,
  8h → $30. No-show $75 and the §7 late-start fees are staff-applied.
- **15 executed COMPANY_POLICIES documents carry the old 90-day package expiry.** The template now
  defers to the per-package term (60/120 days). Executed documents are never rewritten.
- **The PGlite suite is not a green baseline** — 46 pre-existing red files. Diff against `main`.
- **Zero gift enquiries in prod**; **zero unlinked scheduled lessons** (BOOKLINK backfilled 14).
