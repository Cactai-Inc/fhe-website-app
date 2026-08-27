# REBUILD SCOPE — multi-tenant platform, 2026-08-27

**Why this file exists.** ORCH5 produced a ruling artifact on the 80-item change-order ledger. The
owner rejected using it as-is — not because it's wrong, but because it was built against the
**interim refactor** framing, and the framing has since changed in a conversation ORCH5 wasn't part
of. This file captures the new framing verbatim so the chat thread (which is doing the actual
ruling) and any future orchestrator thread inherit it directly, rather than the ruling process
re-running against stale scope a second time.

**This is a capture, not a ruling.** Nothing below has been built, speced, or broken into tasks.
Treat every claim as the owner's own words or a direct paraphrase flagged as such — not settled
architecture.

---

## The owner's words, 2026-08-27, verbatim

> "the rebuild discussion uncovered the need to build from the ground up as a multi-tenant platform
> where the users are independent of the tenants and the tenants are the businesses that setup shop
> on the platform for the exposure, the client relationship, and the capabilities need to be tuned
> to the specific businesses and how their usage can further their interests while contributing to
> the community in valuable ways. its going to take time and thorough review and planning."

## What this changes

**D30 already established the rebuild is ground-up** — new app, new database, data ported not
migrated, the identity model explicitly named as suspect and first in line for redesign. **This
sharpens D30 rather than replacing it**, with one addition D30 doesn't currently name: the rebuild
target is not "a better version of FHE" — it's a **platform**, of which FHE is the first tenant.

Three structural claims in the owner's words above, unpacked (paraphrase, flagged as such):

1. **Users are independent of tenants.** A person's account is not owned by a business the way
   `contacts`/`profiles` are owned by `org_id` today. The current model — one tenant, `org_id`
   scoping nearly everything, `admin@cactai.io` deliberately excluded from tenancy as the platform
   owner (D1a) — already has the *shape* of this distinction in one place. The rebuild's job is to
   make it the general case, not the one exception.
2. **Tenants are businesses who set up shop for exposure, the client relationship, and platform
   capabilities tuned to their interests.** This implies configurable capability sets per tenant —
   not a single fixed feature set every tenant gets identically. D13/D21's principle (the owner
   configures without a developer) likely extends from *content* and *formulas* to *which
   capabilities a given tenant's business even has turned on* — unconfirmed, worth asking rather
   than assuming.
3. **Tenant usage should also contribute to "the community" in valuable ways.** Unclear yet whether
   "the community" means the existing FHE community-feed concept generalized across tenants, a
   platform-wide marketplace/network effect, or something not yet named. **Genuinely open — do not
   guess at this one, ask.**

## What this means for the 80-item ledger ruling

**Every item needs a three-way test, not a two-way one.** The owner's own framing for handing this
to the chat thread was "rule on what to keep and what to discard and what to wait on" — that's
already three buckets, and it maps directly onto the platform question:

- **Keep (build now)** — a real defect or gap a first-run FHE tester will hit, independent of
  whether FHE ends up single-tenant or one tenant among many. Fixes to reachability, data
  correctness, or a broken flow belong here regardless of the platform question.
- **Discard** — interim-refactor-shaped work that the platform rebuild will replace outright. An
  item that patches the *current* single-tenant admin IA, when the rebuild will restructure
  identity/tenancy from the ground up, is likely discard — not because the underlying complaint was
  wrong, but because the fix's *shape* won't survive the rebuild.
- **Wait on** — real, correctly-scoped, but belongs to the rebuild's own planning rather than a v1
  patch. Anything touching capability-tuning-per-tenant, cross-tenant community mechanics, or the
  identity/tenancy model itself almost certainly lands here now, given D30 already named identity
  as first in line for redesign and this framing sharpens why.

**The ruling artifact ORCH5 already produced is not void** — it answered a real question honestly.
It needs re-running (or re-checking, item by item) against this three-way test with the platform
framing in view, specifically re-examining anything it filed as "keep" that touches identity,
tenancy, or capability configuration, since those are exactly the areas this framing reclassifies.

## Relationship to what's already committed

- **`docs/design/refactor/`** (`ADMIN-IA.md` etc.) — written for the interim refactor, already
  flagged (2026-08-27, ORCH4-lineage session) as needing re-grounding against the OFFERINGDOCS
  obligation-model inversion. **Add this platform framing to that same re-grounding pass** — don't
  run it twice. It may turn out most of that bundle is itself "wait on."
- **`TASK-HOMESHAPES`** (member-side composable dashboard) — same caution. A per-account dashboard
  concept may need to be per-account-per-tenant once tenancy is user-independent.
- **D1a** (platform owner is not a tenant) — likely the seed of the correct tenancy model, not an
  exception to generalize away from.

## What happens next, and whose job it is

**Not this thread's.** The owner is routing the 80-item ruling to a `claude.ai` chat thread, which
now has this file's context to work from (once pointed at it, or once this repo is reviewed). This
document's only job is to make sure that ruling — and whichever orchestrator thread ends up running
after it — doesn't have to reconstruct the platform framing from a compacted conversation, or worse,
proceed on ORCH5's already-superseded scope without knowing it changed.
