# Backlog

The standing work list. Everything here is either not started or deliberately
deferred; anything finished simply leaves the file.

---

## Ready to build

### Business admin suite
`supabase/migrations/20260726090000_biz_expenses_and_financials.sql` is written but
**deliberately unapplied**. Two defects must be fixed before it ships:

- **The MRR calculation is wrong** — it sums `amount` over all recurring purchases
  with no time window and no per-month normalisation: a lifetime total mislabelled
  "monthly", for a product that does not exist.
- **The member KPI is misleading** — it counts activated accounts including staff,
  not paying members.

Then build: sales tracker, expense tracker, growth tracker, KPI dashboard, a PDF
business-report generator, and a CSV financial export. All must read live data
(`purchases.amount/amount_paid/paid_at`, `board_charges`, `contacts`, `expenses`) and
degrade gracefully on empty periods. Existing building blocks: the `KpiSpec`/`KpiTile`
framework in `OpsDashboard.tsx`, the reduce-sum pattern in `api-boarding.ts`, and the
`<Money>` formatter.

### Verification gaps
- **The DB test suites have never been executed.** They are re-targeted onto the
  current schema but need a dedicated test database. Several were stale before that.
- **The fulfillment spine is proven only synthetically.** `purchases` is at 0 rows;
  its first real exercise is the first real purchase.
- **The email-change round-trip has never been run end to end.**

---

## Known defects

- **Landing's only CTA goes to `/story`, not the booking funnel** —
  `src/pages/Landing.tsx:104-105`.
- **Dead nav route** — `src/components/app/AppLayout.tsx` links "Brokerage" to
  `/app/ops/brokerage`, which is not defined in `App.tsx`.
- **`Lessons.tsx` has no loading or error state** (`src/pages/Lessons.tsx:36-40`); on
  fetch failure it silently renders an empty grid.
- **Placeholder media** — hero (`src/pages/Landing.tsx:24`), Story "SWAP" bands
  (`Story.tsx:104,164,183,250`), offering-card `CoverPlaceholder`
  (`OfferingCatalog.tsx:39,46`), and `src/pages/Faq.tsx:6-7` placeholder copy.

---

## Deferred

- **Linked accounts: schedule sharing** — rider-permission-gated schedule visibility
  between linked accounts. (The record-sharing half is covered: a shared horse record
  works through `horse_relationships` parties.)
- **Calendar day/list view modes** — week/month exist; the item panel is still
  compact (`CalendarItemPanel.tsx`).
- **Stable item form fields** — `AddItemModal` is name + detail + vendor only
  (`src/components/app/StableEditors.tsx`); category list, conditional size,
  where-bought, price-paid and notes are not built.
- **Mobile device pass** — needs real-device testing.
- **Membership tiers** — settled as deferred (D4). `tier` stays a reserved word.
- **Chat-with-us** — SMS/WhatsApp deep-link with preformatted messages, recording the
  click and capturing the visitor as a contact.
- **SEO** — technical SEO is implementable now; keyword/content strategy needs input.
  `src/lib/seo.ts:18` has a TODO for the real street address, and `Contact.tsx:21` is
  `noindex` — confirm that is intended.
- **Hero image + page content refresh.**
- **Payment / Zelle receipt-validation live testing** — needs real credentials.
- **Org-config streamlining** — `src/lib/stable.ts` hardcodes a
  `'Carmel Creek Ranch'` location fallback and nulls discipline/markings/photo_url.
- **Purchase/sale contract template** — blocked on the owner's reference document.

---

## Standing notes

- **Migrations are not rebuild-safe.** Many rewrite existing function bodies in place
  via `pg_get_functiondef` + string-replace, which silently no-ops on a fresh
  database. Worth a strategy if a clean rebuild is ever needed.
- There is no `supabase_migrations.schema_migrations` table — migrations are a
  hand-maintained journal applied via `psql`.
- **`profiles.payment_reminders` is vestigial** (D9: no dunning email exists). It has
  no reader and is not in the profile payload.
