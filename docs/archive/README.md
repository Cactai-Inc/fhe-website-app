# Archived documentation

These docs are kept for historical context only. **Do not follow them as
instructions** — each describes an earlier state of the platform.

| Doc | What it was | Why archived |
|---|---|---|
| `README-original.md` | Original project overview | Describes a marketing-brochure app; references the deleted `src/lib/services.ts` and "service tiers"; its schema section lists 2 tables |
| `SETUP.md` | External service wiring | Its member-grant SQL targets the old `memberships` table and **will fail**; says "run these 5 migrations" (there are hundreds); names Resend (decision was Google Workspace SMTP) |
| `PLATFORM_ARCHITECTURE.md` | Multi-tenant backbone spec | Good seam/RLS discipline, but its "prime directive: nothing rewrites existing schema" is no longer true, and it models `engagements` / `products` / `product_prices` (retired or never shipped) |
| `FEATURE_BUILD_PLAN.md` | 60-unit build manifest | Units largely shipped; pinned to a branch that no longer exists |
| `CHECKLIST.md` | Two-lane coordination checklist | The workstream split it coordinated no longer exists |
| `COMPLETE-ENUMERATION.md` | Exhaustive item list | Cites a non-existent parent spec; mostly unverified; has its own erratum (`GAP-ANALYSIS.md`) |
| `GAP-ANALYSIS.md` | Erratum for the above | Only meaningful alongside the doc it corrects; content dated 2026-07-10 |
| `CONTRACT_SPEC_HANDOFF.md` | Prompt for a contract-spec interview | The interview happened; the lease now builds from DB clause content |
| `BOOKING_FLOWS_PLAN.md` | Booking/onboarding flow plan | Still the clearest *narrative* of flow intent, but its "what exists / what's missing" section is stale |

**For current state:** `/CLAUDE.md` · `docs/STATUS_REPORT.md` · `docs/ECOSYSTEM_PLAN.md`
