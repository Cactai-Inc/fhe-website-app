# Backlog

Drained 2026-08-02 under the zero-deferral closure directive: every item with
live behavior was fixed and verified in-session (see the closure report /
commit trail of that date). What remains falls only into the two permitted
survivor classes: **owner-decision stops** (content or direction only the
owner can supply) and **zero-live-behavior items** (nothing running today
behaves differently while these wait).

---

## Owner-decision stops

- **Charles Zigmund duplicate contact pair** — `07ab7dbf-33f2-4c2c-963a-f37761d5ffd1`
  (no email) and `d268330c-436a-4f42-bf88-9172d9b4155f` (`cjzigs@icloud.com`) are the
  same person. Deliberately not merged: `d268330c` is the live lessor on real lease
  drafts. **Stop: owner picks the merge direction.**
- **Placeholder media + copy** — hero (`Landing.tsx`), Story "SWAP" bands,
  offering-card `CoverPlaceholder`, `Faq.tsx` placeholder copy, hero/page content
  refresh, real street address for `src/lib/seo.ts` (TODO at :18), and whether
  `Contact.tsx`'s `noindex` is intended. **Stop: owner supplies assets/copy.**
- **Purchase/sale contract template** — blocked on the owner's reference document.
- **SEO keyword/content strategy** — technical SEO is implementable; the strategy
  needs owner input.
- **Payment / Zelle receipt-validation live testing** — needs real payment
  credentials only the owner can exercise.
- **Fulfillment-spine live proof** — `purchases` has ~1 row; the spine's first real
  exercise is the first real client purchase. Cannot be manufactured honestly.
- **Email-change round-trip** — requires clicking the emailed links from the real
  inboxes; not executable from a DB/repo session.

## Zero-live-behavior work

- **DB test-suite remediation** — the harness itself now works (snapshot
  regenerated post-sprint; `row_security` leak fixed; smoke 6/6, golden 3/3,
  service_catalog 2/2). First-ever full `npm run test:db` (2026-08-02):
  **8 files green, 54 stale (88 failed / 154 passed / 428 skipped tests)** —
  per-file expectations written against older schemas, same class as the smoke
  test's retired-table list. Scoped remediation workstream; no live behavior.
- **Business admin suite build** — sales tracker, expense tracker, growth tracker,
  KPI dashboard, PDF report, CSV export. The two blocking defects in the
  deliberately-unapplied `20260726090000_biz_expenses_and_financials.sql` are FIXED
  in-file (MRR now windowed+normalised monthly value of paid recurring items;
  member KPI counts non-staff members only); the migration stays unapplied until
  the suite ships.
- **Brokerage staff hub** — `mod.brokerage`'s staff hub page does not exist; the
  dead nav entry (which 404'd live) was removed 2026-08-02. Build the hub, then
  re-add the nav item.
- **Feature work, unchanged scope**: linked-account schedule sharing; calendar
  day/list view modes; stable item form fields; mobile device pass;
  chat-with-us deep-link; membership tiers (deferred by owner ruling D4 — `tier`
  stays reserved).
- **HORSE_EMERGENCY_VET historical-migration archaeology** — ruled zero-live-behavior:
  the `.md` body wins live (byte-verified 2026-08-02); which old migrations drifted
  is history only.

---

## Standing notes (facts, not work)

- **Migrations are not rebuild-safe.** Many rewrite live function bodies via
  `pg_get_functiondef` + string-replace, which no-ops on a fresh database. The test
  harness sidesteps this with the schema snapshot; a production rebuild would need
  a strategy.
- There is no `supabase_migrations.schema_migrations` table — migrations are a
  hand-maintained journal applied via `psql`.
- **Insurance no-coverage mechanics** — settled by `docs/insurance-resolution-spec.md`
  (owner ruling 2026-08-01): a both-`NONE` section is UNRESOLVED and blocks signing
  until the responsible party's own election; the withdrawn editor auto-check must
  not be implemented. The three `{X}_NONE` clause gates stay equals-`YES` on
  `TXN.{X}_NOT_REQUIRED`. The C1 responsibility bodies landed 2026-08-02 (manifest
  M22); U2.8's policy-exists deductible gating applied 2026-08-02 in positive
  any/equals form.
- **`ensure_contact_for_profile`'s no-name/no-email fallback** can still mint an
  "Unnamed Contact" row for a profile with neither; the two historical artifacts it
  produced were reference-checked (zero FKs) and deleted 2026-08-02.

---

## GLOBALIZATION SWEEP — recorded 2026-08-12, NOT scheduled

**Owner: note it well, act after the spot checks are finished.** Full measurement:
`docs/reference/GLOBALIZATION-DEBT-2026-08-12.md`.

The headline, `src/pages/app`, 80 pages: **`PageHeader` 1% · `PageLayout` 11% ·
`EmptyState` 3% · `DataTable` 23%**. **63 of 80 pages hand-roll their own `<h1>`.**
And **885 arbitrary Tailwind values across 105 files** — the surface of the trap that has
already shipped two invisible defects to production.

**Runs AFTER duplicate consolidation** (DUPECENSUS → REVIEWNAV → owner rulings →
consolidation), so nothing is converted that is about to be retired. **One exception:** the
885-value audit against the emitted CSS is independent of which pages survive, finds live
bugs rather than inconsistency, and can run any time.
