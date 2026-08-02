# HORSE_SALE_TRANSFER — retired flat template (superseded by the clause model)

**This file no longer holds the sale & transfer contract text.** It is kept only as a pointer.

As of 2026-08-02 horse sales are built by the **clause authoring engine** under
template_key **`HORSE_SALE_V2`** (see `docs/contract-content/HORSE_SALE_V2_TEMPLATE.md`),
with the transfer instrument as the companion **`HORSE_BILL_OF_SALE`**
(`docs/contract-content/HORSE_BILL_OF_SALE_TEMPLATE.md`). `HORSE_SALE_TRANSFER` had no
start function or creation UI; its template row was deactivated + soft-deleted 2026-08-02.
Documents generated from it are retained untouched. The archived flat body is at
`docs/archive/contract-templates/HORSE_SALE_TRANSFER.md`.

> NOTE for `scripts/build-template-load-migration.mjs`: this key is excluded from the
> generator (see the `RETIRED` set there) so it is never re-loaded from this file.
