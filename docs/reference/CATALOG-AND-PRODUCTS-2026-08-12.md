# CATALOG, PRODUCTS AND THE PRICE BOOK — what they are, measured 2026-08-12

**Recorded from the owner's design conversation. NOT YET SPECCED** — two decisions are open
(one templates engine or two; one catalog or two). This is the map they will be built against.

---

# THE TWO LAYERS ALREADY EXIST

The owner's split — *"catalog is a list of tiles (groups of service offerings)… products are the
individual line items"* — is already the schema's split. It has simply never had an editor.

## Catalog layer — `service_types`, 14 rows

```
code · display_name · description · segment · requires_horse · active
sort_order · cover_image_url · card_weight · catalog_rank
```

**This is the tile layer, and it already carries the arrangement controls the owner described:**
`sort_order` + `catalog_rank` for order, `card_weight` for prominence, `requires_horse` for a
display condition, `cover_image_url` for the tile picture.

**A Catalog editor edits this table.** Nothing edits it today.

## Product layer — `offerings`, 43 rows

The flat SKUs, grouped by `service_type` within a `segment`. `fetchPublicCatalog(segment)`
already returns `ServiceGroup[]` — the heading from `service_types`, the SKUs beneath it.

## ⚠️ CORRECTION TO AN EARLIER ORCHESTRATOR CLAIM

The orchestrator called `products` *"a thinner duplicate of `offerings` — drop it."* **That was
right about the table and wrong about the concept.** The owner's Product is the line item **plus
everything it generates once an order is processed**, which is far bigger than `products` (a
6-column pricing record) and bigger than `offerings` too. **`offerings` is the Product. The
`products` table is neither layer.**

## Price book — `products` + `product_prices`, 0 rows each

The **newer, multi-tenant** pricing model: `provision_tenant` seeds both for every new tenant,
and `org_public_config` publishes the current effective price from them. FHE predates it and was
never migrated, so both are empty — and **nothing in the frontend reads that output** (`pricing`
appears only in a test fixture).

**`product_prices` has exactly the right SHAPE and the wrong TARGET.** Effective-dated
(`effective_from` / `effective_to`), newest effective row wins, a price change is a **new row,
never an overwrite** — which is the one thing `offerings.price_amount` cannot do, and it matters
because there are **12 subscription offerings**.

**Recommendation: repoint the effective-dated price table at `offerings`, retire `products`.**
The nine money-path functions keep reading `price_amount` as the *current effective price*, so
checkout, gifting, invitations and revenue reporting are not rewired.

**The nine readers of `offerings.price_amount`:** `public_offerings`,
`finalize_purchase_payment`, `create_gift`, `provision_client_invitation`,
`attach_offerings_to_client`, `_provision_purchase_for_offerings`, `calendar_revenue`,
`calendar_free_busy`, `save_calendar_item`.

**A third dead end:** `products.price_value_key` points into the value registry — but all
**14** `config_values` are identity and branding (NAME, EMAIL, LEGAL_IDENTITY, LOGO_PATH…).
**Zero prices.** A pointer with nothing to point at.

---

# WHAT A PRODUCT NEEDS, AGAINST WHAT EXISTS

The owner's definition: *"name, description, units, price, conditional logic, photo, and the
associated relationship to booking, and the things that are generated once an order is
processed, like the booking entry, the item's page both parties see, the activity log, forms and
deliverables (reports/notes), the order summary content, the purchase detail content."*

| element | today |
|---|---|
| name · description · units · price | ✅ on `offerings` |
| conditional logic | ⚠️ partial — `config_kind`, and `requires_horse` on the tile |
| **photo (per product)** | ❌ **see below** |
| relationship to booking | ✅ `config_kind` → `fulfillment_units` → bookings (D6) |
| what gets generated on order | ✅ the mechanism: `scheduled`→session · `recurring`→period · `intake_*`→milestone · `document_transaction`→execution · `inquire`→none |
| the item's page both parties see | ❌ |
| activity log | ✅ `status_events` |
| forms and deliverables | ⚠️ per-type only — `evaluation_reports` exists; nothing generic |
| order summary / purchase detail content | ❌ rendered generically, not defined per product |

## The connection worth keeping

**Everything in the ❌ column is a TEMPLATES problem, not a catalog problem.** The item page, the
order summary, the purchase detail, the deliverable forms are *content produced when an order
processes*.

**So a Product = the line item + its generation mechanics (`config_kind`) + which templates
produce its outputs.** The Templates decision and the Products decision are one decision seen
twice.

---

# PER-PRODUCT IMAGE — APPROVED TO BUILD (owner, 2026-08-12)

**Owner, 2026-08-12, first:** *"per product image is not something we use yet but it will be
soon."* **Then, same day — APPROVED TO BUILD:** *"we can add the per product image capability,
but dont render a placeholder if it doesnt have a picture dont show one, if it has a picture
uploaded to it, show it. simple handling."*

**Build it. Specifics:**

- **NO PLACEHOLDER.** No empty frame, no "no image" tile, no grey box. **The element is absent
  when there is no file** — not present-and-empty. This is the whole of the owner's handling
  rule and it is the easy thing to get wrong.
- **It is a NEW field on `offerings`, not a reuse.** `cover_image_url` lives on `service_types`
  (the TILE), and only **3 of 14** tiles have one.
- **When it lands, it goes through the `files` spine** (`TASK-UPLOADS`, merged 2026-08-11) — the
  polymorphic subject table with RLS and signed URLs. **Do not create a product-images bucket.**
  Twelve buckets already exist; the missing piece was never storage, it was the binding between
  a stored file and a record, and that now exists.
- **`brand-assets` (1 object) and the two public buckets (`feed-media`, `profile-images`) are
  deliberately public.** A product image is public-facing catalog content, so **whether it is a
  public bucket or a signed URL is a real decision** — make it explicitly when the time comes,
  and never flip an existing private bucket to public to make a render work.
- The catalog card layout should **not** hard-assume a tile image is the only picture available.

---

# TWO FINDINGS THE OWNER SHOULD SEE

1. **5 of 14 tiles have ZERO SKUs, and all five are active:** Horse Sale Assistance, Horse
   Lease-In Assistance, Horse Lease-Out Assistance, Account Onboarding, Independent Contractor.
   Five catalog tiles with nothing purchasable behind them.
2. **Only 3 of 14 tiles have a cover image.** Whatever the catalog renders for the other eleven,
   it is not a picture.

---

# THE SHAPE, WHEN IT IS BUILT

One page under Configuration, three tabs over **one spine**:

- **Catalog** → `service_types`. Tiles, grouping, order, prominence, cover image, display
  conditions. Editable.
- **Products** → `offerings`. Line items — plus the reserved image field and the template
  references for what each one generates. Editable, `+ Add New`.
- **Price book** → effective-dated prices **for offerings**. Editable; a change writes a new row
  and never overwrites history.
