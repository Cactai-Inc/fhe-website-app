# HORSE_PURCHASE_SALE — retired flat template (content moved to the database)

**This file no longer holds the purchase & sale contract text.** It is kept only as a pointer.

As of 2026-08-02 the horse sale is built by the **clause authoring engine**, not from a
flat markdown body. New sales use template_key **`HORSE_SALE_V2`**, whose content lives
entirely in the database as structured Section › Clause › Field data (seeded by
`supabase/migrations/20260802090000_sale_and_bos_templates.sql`, generated from the
canonical content file `docs/contract-content/HORSE_SALE_V2_TEMPLATE.md`). The companion
document is **`HORSE_BILL_OF_SALE`** (`docs/contract-content/HORSE_BILL_OF_SALE_TEMPLATE.md`).

The legacy flat `HORSE_PURCHASE_SALE` template and `start_purchase_contract` were retired
2026-08-02: template row deactivated + soft-deleted, start function dropped. Executed and
draft documents generated from the flat template are retained untouched (signed documents
are never swept). The archived flat body is at
`docs/archive/contract-templates/HORSE_PURCHASE_SALE.md`.

> NOTE for `scripts/build-template-load-migration.mjs`: this key is excluded from the
> generator (see the `RETIRED` set there) so it is never re-loaded from this file.
