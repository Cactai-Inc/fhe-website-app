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

---

## ✅ DONE — the ruling artifact WAS re-checked against this framing (ORCH5, 2026-08-27)

**All 85 rows re-examined item by item, exactly as this file asked**, with attention on anything
filed "build now" that touches identity, tenancy, or capability configuration.

**The board now runs the three-way test**, plus a fourth column for items that are not a live ruling
at all: **Keep — build now · Discard the fix · Wait on · Already settled.** *"Already settled"* is
kept separate deliberately — an item that is already built or already answered is none of the owner's
three buckets, and filing it as one would misrepresent it as a decision.

**Before → after: 22 / 49 / 14 → 20 keep · 5 discard · 46 wait on · 14 settled.**

### The two rows the framing moved OUT of "build now", and they moved for one reason
**Both fixes are a per-tenant setting**, which is the capability-tuning layer the platform
introduces.
- **CR-13** *(the trainer is always Claire)* — the fix was "keep her in settings rather than code."
  A one-off settings row now is the interim shape.
- **CR-24** *(the barn's timezone is hardcoded)* — ⚠️ **re-checking changed the FINDING, not just the
  bucket: it is hardcoded to Los Angeles and the barn is in Los Angeles, so it is not a live defect.**
  It is only wrong for tenant number two. It was in "build now" on a misreading.

### The five new discards — the complaint stays, the fix does not
`CR-12` *(move the weekly-lesson editor to a surface being replaced)* · `CR-48` *(Guest→Visitor as a
migration inside the tag model D31 already replaces)* · `CR-50` *(the three-boolean lead/client/account
model — the exact thing user-independent-of-tenant answers differently)* · `CR-58` *(reconcile this
app's add-controls, when a new app has one design system from day one)* · `CR-63` *(edit the current
nav, when CR-66 says the person picks their own menu anyway)*.
**Each row names where its requirement is already recorded**, so discarding the fix loses nothing.

### ⚠️ RE-CHECKED AND IT STILL SHIPS: `TASK-ORIGIN`
It adds origin and channel to the person record — squarely the identity model the platform redesigns,
so it is the obvious candidate for reclassification. **It stays in "build now", and the reasoning
generalises: the DATA is what ports; the columns are only the vessel.** He is about to enter it by
hand. Captured now it survives into whatever the platform's person model becomes; not captured, it
never exists at all and no later schema can recover it.

### Two questions this framing ADDS to `docs/handoff/04-OPEN-QUESTIONS.md`
1. ⚠️ **What does "contributing to the community" mean?** The owner's sentence ends on it and it has
   no precedent in the current app. **Genuinely open — ask, do not infer.** It decides whether the
   community layer is a tenant feature or the platform's reason to exist.
2. **Does per-tenant capability tuning extend D13/D21** from content and formulas to *which
   capabilities a tenant has at all*? That is a materially bigger claim, and it decides whether the
   platform ships a capability editor or a fixed feature set.

**Where it is:** the published board, revised in place at the same URL. **This file's request is
discharged; the chat thread still owns the actual ruling.**
