# Prior thread, 2026-08-20 — partially superseded

The four documents in this directory are from an earlier refactor thread, dated 2026-08-20, that
handed off to the thread producing the docs one level up (ADMIN-IA.md, ADMIN-PAGE-SPECS.md,
ADMIN-WAVES.md, PROGRESSION-PLAN.md — all 2026-08-24). Preserved for history and because they
contain real, still-relevant design work (the layout primitive kit in particular), not because
they're authoritative over the newer set.

**Known material differences from the newer docs, not yet reconciled:**

- **Scope.** This set touches member app, public `/sign/*`, and superadmin. The newer set is
  staff/admin only, matching the owner's explicit instruction ("this will only be a refactor of
  the admin side for me and Claire for now").
- **Rail shape.** This set proposes a flat 8-area rail (Today · Schedule · People · Horses ·
  Money · Documents & Deals · Operations · Settings), all peers. The newer set proposes 4 nested
  zones (Dashboard · Work · Community · Admin) with those same areas as flat entries inside
  Work. **The owner confirmed the newer 4-zone model on 2026-08-24** ("claire gets three and i
  get 4") — the 8-flat-area shape in this directory's docs is superseded.
- **02-IA-LAYOUT-TREE.html contains a factual error, verified wrong 2026-08-24:** it claims
  `Admin.tsx` has zero imports and marks it dead. It has one live importer (`RecordsPage.tsx`)
  and is the current Clients tab. Do not act on that claim from this document.
- **04-SEQUENCE-AND-RULINGS.md's ten open rulings** — several are now resolved by reality or by
  the newer docs (TASK-AUTHORITY has run; D27 evaluations placement is confirmed unchanged) and
  several are out of scope under the newer set's narrower scope (member schedule merge, tenant
  suspend confirmation, /book/rider). Treat that list as historical, not a live checklist.
- **01-DESIGN-SYSTEM.md's primitive kit (`src/ui/`) has not been built** — verified directly,
  2026-08-24. It remains the most detailed spec of what such a kit should contain if the owner
  decides to build it; ADMIN-PAGE-SPECS.md assumes it exists without saying where from.

See `docs/design/refactor/ADMIN-IA.md` §5 and `docs/design/refactor/ADMIN-WAVES.md`'s appended
ORCH3 notes for the full corrections.
