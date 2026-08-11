# TASK INVITEFLOW — the invitation category survives to the account

Branch `task/inviteflow` off `origin/main` (`1928e98`). Owner decision 2026-08-10: **option A**
— the admin's choice is evidence, `apply_affiliations` stays the sole writer.

**Applied to production.** See "How it was applied" — the first dry run committed itself, which
is a process failure worth recording.

---

## The defect, reproduced on all six shapes

Three rules were fighting and the invited person always lost:

1. `provision_client_invitation` wrote **no** group — the chosen category only drove paperwork.
2. `promote_buyer_from_offering` (AFTER INSERT ON `purchase_items`) wrote one **directly**, from
   the *offering's segment* rather than the admin's choice. That was the only reason an invite
   with an order had a category at all.
3. `redeem_invitation` → `promote_contact_to_account` → `apply_affiliations` recomputed from
   executed documents + horse ownership. At activation nothing is signed, so it **deleted** it.

| invited as | order | after provisioning | after activation (before) | after activation (now) |
|---|---|---|---|---|
| Rider | — | NONE | NONE | **RIDER** |
| Horse owner | — | NONE | NONE | **HORSE_OWNER** |
| Rider + Horse owner | — | NONE | NONE | **HORSE_OWNER+RIDER** |
| Rider | Single Lesson | RIDER | NONE | **RIDER** |
| Horse owner | Training Session | HORSE_OWNER | NONE | **HORSE_OWNER** |
| Both | both | HORSE_OWNER+RIDER | NONE | **HORSE_OWNER+RIDER** |

Paperwork was never the problem — 4/5/6 assignments, correct templates per category, and they
survive activation intact. (My first measurement said the paperwork was lost too; that reading
was taken while still in the `authenticated` role and RLS was filtering the count. Corrected.)

## The fix — `20260810T1730_inviteflow_category_is_evidence.sql`

`derive_affiliations` gains the two evidence sources the system was already acting on but never
recorded, so one function still decides and one function still writes:

- **a live invitation's categories** — matched on `invitations.contact_id` only, never on email
  (two staff identities share an inbox on this tenant); `revoked` and `superseded` invitations
  excluded, because a withdrawn or replaced decision is not evidence.
- **a real purchase, by segment** — `rider` → RIDER, `horse` → HORSE_OWNER. Exactly the rule the
  trigger applied by hand, now recorded where the recompute can see it.

`promote_buyer_from_offering` stops writing group rows and calls `apply_affiliations`.
`provision_client_invitation` calls it too, after the invitation row exists — so the contact
record shows the category the moment the invite goes out, computed the same way activation will
compute it. The two can no longer disagree.

## How it was applied — a process failure

The migration file carried its own `BEGIN; … COMMIT;`. Wrapping it in the house dry-run
(`BEGIN; \i file; ROLLBACK;`) meant the file's **COMMIT ended the wrapper**: the "dry" run
applied for real, and the `ROLLBACK` hit no transaction. psql said so twice — *"there is already
a transaction in progress"*, then *"there is no transaction in progress"* — and I should have
stopped on the first warning.

Consequences: the three functions went live before their verification ran, and one stray test
contact (`dryrun.fresh@example.test`) was committed. The functions are the intended, owner-
approved change and now verify correct; the stray contact and its 2 groups / 6 assignments /
1 invitation / 1 client row were deleted.

The file no longer contains `BEGIN`/`COMMIT`, and replaying it inside the dry-run wrapper now
rolls back properly — proven after the fact.

## Verification

- **Six activations, rolled back, measured with the role reset so RLS cannot filter**: every
  shape now ends holding exactly the invited category (table above). Rollback confirmed —
  11 profiles and 10 auth users before and after.
- **Replay-safe**: `BEGIN; \i <file>; ROLLBACK;` runs clean and reverts.
- **No one loses a category**: `derive_affiliations` was evaluated against every contact
  currently holding a group row; all thirteen derive a set equal to or larger than what they
  hold. Nothing would be stripped by a recompute.

## Two corrections to what I reported earlier

- **Claire Bourdon self-healed.** Her audit trail shows her signing at 16:41–16:42 today, which
  re-derived HORSE_OWNER and RIDER. My snapshot was taken minutes before that. She was
  category-less for ~45 minutes, not permanently.
- **The nine riders were never at risk.** Each holds **4 executed documents**, so RIDER derives
  from signed evidence. I said they would lose it at activation; that was wrong.

## Left in production

Six test contacts + clients + invitations at `cjzigs+r / +h / +rh / +ro / +ho / +rho@icloud.com`,
and purchases PUR-000063/64/65. Created deliberately for these runs; **no email was sent** (the
SMTP and service-role credentials live in Vercel, not locally, so the delivery leg is still
untested). Say the word and I'll purge them.

## Still open

- **The email leg** — one invite sent from the UI would prove it end to end.
- `api/admin-send-invitation.ts:229` catches everything and returns a flat
  `"could not create invitation"`. Same discard the horse form had; worth the same fix.
- The invite page fields, the booking calendar, the contact-record edit mode, and the
  "File Under" row — queued, not started.
