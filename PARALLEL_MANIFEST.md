# Parallel Work Manifest

The single source of truth for a fan-out batch: N Claude Code sessions each work
ONE lane in isolation, push to their own branch, then everything merges into an
integration branch, is tested as a unit, and is promoted to `preview` (live test)
then `main`. See PARALLEL_WORKFLOW.md for the exact commands.

Fill this in per batch. Keep lanes genuinely independent — the whole point is
that two agents never edit the same file.

---

## This batch

- **Batch name:** <e.g. crm-cat-3-intake>
- **Integration base (branch every lane forks from):** `<BASE>`  ← currently the trunk is `feat/phase-2-contract-layer`; use `preview` once histories are reconciled.
- **Integration branch (where lanes merge back):** `integration/<batch-name>`
- **Full-suite gate:** `npx vitest run` must be green on the integration branch before promotion.

## Lanes

| Lane | Branch | Owns (files/dirs) | Must NOT touch | Task | Status |
|------|--------|-------------------|----------------|------|--------|
| A | `feat/<batch>-a` | e.g. `src/components/fields/*` | migrations, `src/lib/auth.ts` | <one-line task> | todo |
| B | `feat/<batch>-b` | e.g. `api/_lib/emails/*` | `src/components/**` | <one-line task> | todo |
| C | `feat/<batch>-c` | e.g. `supabase/migrations/*` (see hazard) | everything under `src/` | <one-line task> | todo |

## Collision rules (read before assigning lanes)

1. **One owner per path.** If two lanes need the same file, that file is a *shared
   dependency* — do it FIRST as a solo pre-step, land it on `<BASE>`, then fan out.
2. **Migrations are serialized, not parallel.** Files in `supabase/migrations/` are
   applied in timestamp order and the test harness runs them all. Two agents each
   adding `20260630xxxxxx_*.sql` will not conflict textually but CAN conflict
   semantically (both altering the same table, ordering assumptions). Assign at most
   ONE migration-authoring lane per batch, or pre-assign exact timestamp slots here:
   - Lane C migration slot(s): `20260630010000_*`, `20260630020000_*`
3. **Shared registries are merge magnets.** `src/lib/serviceCatalog.ts`, seed files,
   any central `index.ts`/barrel, and `contract_templates` registration all attract
   conflicts. Name their owner explicitly above; others append-only via their own file.
4. **Never edit `contract_templates/*.md` bodies casually** — loaded verbatim into the
   DB (see CONTRACT_MODULE_ARCHITECTURE.md).

## Definition of done for a lane
- Its own branch is pushed.
- `npx vitest run` green *for its area* (full suite runs at integration).
- No files edited outside its "Owns" column.
