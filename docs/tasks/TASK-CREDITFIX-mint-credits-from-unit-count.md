# TASK CREDITFIX — credits mint from what was bought, not from a regex on the name

**Read `docs/reports/TASK-FLOWTRACE-REPORT.md` §8 (two ledgers) and §1-F2 first.** Prod-verified;
do not re-derive. This is the fix for "item 12: credit counts wrong" and the reason a client
who pays for a 4-pack can book nothing.

# THE MECHANISM (verified in prod)

`_provision_purchase_for_offerings` mints `lesson_credits` with count = **a regex on the
offering's display name** (`'(\d+)-Lesson'`), else 1 if `price_unit='session'`, else **nothing**.
`offerings.unit_count` is never read. Proven results: 8-Lesson Punch Card → 8 (name
coincidence); 4-Class Pack → **0**; every monthly SKU → **0**; Full Body Clip (a grooming
service with `price_unit='session'`) → **1 bookable lesson credit it has no business minting**.
Since `book_open_slot` is credit-gated, a paying pack/monthly buyer hits `NO_CREDITS`.

**THIS WAS FIXED ONCE AND SILENTLY REVERTED — restore, do not reinvent.**
`20260726010000` already minted from `unit_count` and tagged credits with `offering_id`.
`20260802020000_u3_payment_notifications.sql` (~line 146) re-declared the function and reverted
both. Read BOTH migrations before writing a line. Second known instance of a later migration
undoing an earlier fix — say in your migration header comment that this is the restoration,
and write the PGlite test so a third revert fails loudly.

# THE BUILD

1. **Mint = `offerings.unit_count × quantity`** for scheduled SKUs; tag each credit with
   `offering_id` (restoring 20260726010000). The name regex is deleted entirely.
   ⚠️ Offering NAMES changed on 2026-08-15 ('1x Weekly Lesson', '2x Weekly Lessons') — one more
   reason nothing may key on display names.
2. **Segment gate**: only riding-lesson offerings mint lesson credits — read the `offerings`
   schema and gate on the correct column (`service_type='RIDING_LESSON'` is the live
   classification; verify against prod rows before trusting this line). A grooming/clip SKU
   with `price_unit='session'` mints ZERO.
3. **Recurring/monthly SKUs: do NOT invent their entitlement here.** Their model (mint per
   month, expire at month end, no carryover) is owned by `TASK-BOOKLINK` §B4. State explicitly
   in your report what recurring SKUs mint after your change (expected: still nothing, no
   longer by accident but by declared scope) so BOOKLINK inherits a clean seam.
4. **The twin key bug, same family as PAYLOCK**: `my_horse_onboarding_state`
   (`20260714350000_horse_onboarding_state.sql`, both EXISTS probes, ~lines 56 and 64) keys on
   `buyer_user_id = auth.uid()` alone — silently disables the horse-intake gate for every
   provisioned (contact-keyed) buyer. Apply the exact two-key idiom from
   `20260813T1200_paylock_finalize_payment_keys_on_buyer_contact.sql` (read it): 
   `buyer_user_id = auth.uid() OR buyer_contact_id = current_contact_id()`, NULL-safe.

# TRAPS
- Migration files never contain BEGIN/COMMIT; dry-run in the wrapper, PROVE the rollback.
- PGlite harness proof required (model: `test/db/paylock_finalize_payment_buyer_keys.test.ts`):
  the mint table (8→8, 4-pack→4 not 0, single→1, clip→0, monthly→declared scope), offering_id
  tagging, replay safety (apply the migration twice), and the horse-gate two-key fix
  exercised as a provisioned buyer.
- Existing wrong credits in prod: do NOT retro-mint or delete anything — report the delta
  (what each real purchase would have minted vs holds) for the owner to rule on backfill.
- `test:db` at large may be flaky; your new test file must pass deterministically.

# OUT OF SCOPE
Ledger unification (credits vs fulfillment_units — flag, don't do), book_open_slot's credit
CHOICE ordering, anything BOOKLINK owns (calendar UI, debits on staff save).

# THE TEST THIS MUST PASS
1. Mint counts proven in PGlite exactly per the table above, and the regex provably gone.
2. Credits carry offering_id.
3. A provisioned buyer's `my_horse_onboarding_state` returns true gates (proven as PAYLOCK's
   test proves its RPC — contact-keyed caller, no buyer_user_id).
4. Prod delta report: per real purchase, credits-held vs credits-correct, no writes.
5. Migration applied to prod with dry-run/rollback proof shown.

Report to `docs/reports/TASK-CREDITFIX-REPORT.md`. Do not push; the orchestrator merges.
