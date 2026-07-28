# Platform Separation Audit — admin@cactai.io rows in FHE tenant tables

**Stage 1b verify-first output (2026-07-27, Thread R).** D1 expectation: zero FHE
tenant rows for the platform owner. **Finding: contamination exists — 12 tables.**
Method: swept EVERY `public` uuid column for the auth id `3c5d6af1…` and the
contact id `c6f7cddc…`, and every text/jsonb column for `%cactai%` / either uuid.
Nothing was cleaned; per the plan this is report-only.

## Anchors

- `auth.users` `3c5d6af1-ce10-45c0-afbb-1ddbdfc77bd5` admin@cactai.io (created 2026-07-02, day one).
- `contacts` `c6f7cddc-69da-4948-8e62-4a310f079100` "CJ Z" — **inside the FHE org**
  (`org_id e656f20b…`), created 2026-07-02 23:54 — two minutes after the auth user.
- `profiles`: role SUPER_ADMIN, org_id NULL, **contact_id → the FHE contact above**.
  This profile→contact link is the structural bridge INTO the tenant.

## Findings (all rows tied to the two ids above)

| Table | Rows | Provenance (how it got there) |
|---|---|---|
| `contacts` | 1 | Day-one setup: the platform owner was provisioned an FHE person-contact like any client. |
| `profiles.contact_id` | 1 | The platform account bridged to that FHE contact. |
| `clients` | 1 ACTIVE (2026-07-03) | Early provisioning-era client record on the contact. |
| `documents` | 1 EXECUTED `RELEASE_PARTICIPANT` `f9d7dbb4…` (2026-07-03), `contact_id` = the cactai contact | Day-one kiosk-flow testing. The signature on it is typed "Madeline Do", `party_role` PARTICIPANT, with a DIFFERENT `signer_contact_id` — the doc is anchored to the platform owner's contact while a test person signed it. Five-writers-era data shape. |
| `contact_roles` | 2 — PARTICIPANT (2026-07-03), **RIDER (2026-07-26)** | PARTICIPANT written in the five-writers era. **RIDER was derived by `apply_affiliations` from the executed release above** — the new derivation engine is faithfully propagating contaminated source data. |
| `members` | 1 active 'community' (2026-07-10) | Community access grant. (`memberships` also hit = it is a VIEW over `members`; same single row, not double contamination.) |
| `moderation_actions` | 1 `set_role_admin` (2026-07-10) | Legitimate super-admin act recorded in a tenant-scoped table. |
| `feed_view_pref` / `feed_account_items` | 1 / 2 (orientation, welcome) | Community onboarding state for the account. |
| `audit_logs` | 76 as `actor_user_id` (all 2026-07-03 → 07-07, 34 INSERT + 42 UPDATE); 8 rows with `record_id` = the contact (all `table_name='contacts'`) | Setup-week admin actions; audit trail, not identity state. |

## Name-only matches (NOT identity links — reported for completeness)

- `horses.registered_name` = **"Beaumont de Cactai"** (created 2026-07-16) — a test
  horse named after the platform. Its `current_owner_contact_id` is NOT the cactai
  contact; no ownership link exists.
- `documents.merged_body` / `contract_fields.value` / `contract_execution_audit.merged_body`
  (1 each) — the executed HORSE_LEASE_V2 carries the horse name
  "Beaumont de Cactai" in `HORSE.REGISTERED_NAME`. Text echo of the horse name,
  not an identity row.
- `clients_overview.email` — a view over the contaminated `clients`/`contacts`
  rows (same source rows, not extra state).

## Read of the situation (for the owner's disposition — no action taken)

1. The contamination is **day-one bootstrap testing**, not an ongoing leak: every
   identity row traces to 2026-07-02/03 provisioning + kiosk testing, plus two
   mechanical follow-ons (the 07-10 membership/moderation grants and the 07-26
   derived RIDER row).
2. The **live propagation risk is real**: `apply_affiliations` derived RIDER for
   the platform owner a day ago because the executed release is anchored to its
   contact. As long as the document row stays, any future re-derivation recreates
   the group row — cleanup that deletes `contact_roles` but not the document
   anchor will not stick.
3. The severance point is structural: `profiles.contact_id → c6f7cddc` plus the
   document anchor. Stage 2's promotion machinery (re-anchoring) or an explicit
   D1 cleanup migration are the natural homes for the fix; the Stage 2a denylist
   must include both the auth id and this contact id.
4. The audit_logs actor rows are qualitatively different (history of admin acts,
   not identity state) — the owner should decide separately whether history is
   purged or kept.
