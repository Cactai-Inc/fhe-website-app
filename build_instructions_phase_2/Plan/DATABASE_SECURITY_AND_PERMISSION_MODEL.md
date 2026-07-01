# French Heritage Equestrian
# Database Security and Permission Model

Version: 1.0
Target platform: Supabase (PostgreSQL 15+, Supabase Auth, Supabase Storage)
Status: Blueprint for migrations 008_rls.sql, 009_permissions.sql, 015_storage_policies.sql, 016_audit.sql

This document is the single source of truth for who can see and do what. Application code, RLS policies, storage policies, and audit triggers must conform to it. Where application logic and this document disagree, this document wins until it is formally revised.

## 1. Authentication Flow

Authentication is handled by Supabase Auth. The `auth.users` table is owned by Supabase and is never written to directly by application code or migrations except through the Supabase Auth API.

Every authenticated principal has exactly one row in `profiles`, linked one-to-one with `auth.users.id`. The `profiles` row is the application's identity record and is created by a trigger on `auth.users` insert.

A `profile` is linked to at most one `contact` record. This is the bridge between the authentication layer and the domain layer: a logged-in user (profile) is also a person in the business (contact). Staff and clients both have a contact record. Not every contact has a profile — most contacts (sellers, emergency contacts, guardians, facility contacts) never log in and therefore have no profile and no auth user.

Flow:

```
auth.users (Supabase-owned)
  -> profiles (1:1, trigger-created)
    -> contacts (0:1, linked when the user is also a domain person)
      -> contact_roles (0:N domain roles)
profiles -> user_roles (1:N application roles) -> roles -> role_permissions -> permissions
```

Two distinct role systems exist and must not be conflated:

- contact_roles: domain relationships (BUYER, SELLER, RIDER, GUARDIAN, etc.). These describe a person's relationship to engagements and horses. They do not grant application access.
- user_roles: application authorization (ADMIN, TRAINER, CLIENT). These grant access. Only principals who log in have these.

## 2. Launch Roles

Three application roles exist at launch. The model is built to add more (Assistant Trainer, Parent, Viewer, Contractor-with-login) later without schema change, by inserting rows into `roles` and `role_permissions`.

| Role | Who | Scope summary |
|------|-----|---------------|
| ADMIN | Owner and spouse | Full access to all records and settings. |
| TRAINER | Staff trainers | Read/write only on engagements assigned to them, plus the horses, intake, internal records, service records, reports, and communications belonging to those engagements. No financial, payroll, tax, pricing-edit, or admin-settings access. |
| CLIENT | Paying clients with portal logins | Read/write only on records they own. Never another client's data. |

Contractors exist as a contact_role and as a service type at launch but do not receive a login at launch. The CONTRACTOR application role is defined in seed data as inactive so it can be activated later without migration.

## 3. Record Ownership Rules

Ownership is the basis of every CLIENT and TRAINER policy. These rules define ownership precisely.

CLIENT ownership. A client owns a row when the row resolves to their own client_id. Resolution paths:

- clients: row where clients.contact_id maps to the requesting profile's contact_id.
- engagements: engagements.client_id equals the requester's client_id.
- horses: a horse is client-visible when horses.current_owner_contact_id equals the requester's contact_id, OR the horse is referenced by an engagement the client owns. A client must not see horses merely because they exist.
- intake_records, internal_engagement_records, contracts, documents, service_records, transactions, payments, communications: visible when their engagement_id (or client_id, for payments) belongs to an engagement the client owns.
- internal_engagement_records are an exception: clients never read these even for their own engagements. They are staff-only.
- signatures: visible when the document belongs to an owned engagement AND the signer_contact_id is the requester's own contact_id, OR the requester is the counterparty on that document.
- emergency_profiles: visible only where emergency_profiles.contact_id equals the requester's own contact_id.

TRAINER ownership. A trainer owns a row when it belongs to an engagement where engagements.assigned_staff_id maps to the trainer's profile. Same resolution chain as client ownership but keyed on assignment instead of client_id. Trainers additionally may read internal_engagement_records for assigned engagements (clients may not). Trainers may never read payments, transactions financial fields (amount, commission), pricing edit functions, payroll, or tax documents.

ADMIN ownership. Admins bypass ownership. All rows, all columns, subject only to soft-delete visibility rules in section 7.

## 4. Permission Matrix

Read = R, Create = C, Update = U, Soft-delete/Archive = D. Blank = no access. "own" means scoped by section 3 ownership.

| Table | ADMIN | TRAINER | CLIENT |
|-------|-------|---------|--------|
| profiles | RCUD | R (own) | RU (own) |
| roles, permissions, role_permissions, user_roles | RCUD | | |
| contacts | RCUD | R (own engagements' parties) | RU (own contact only) |
| contact_roles | RCUD | R (own) | R (own) |
| clients | RCUD | R (own engagements) | R (own) |
| horses | RCUD | RCU (own engagements) | R (own) |
| facilities | RCUD | R | |
| facility_agreements | RCUD | | |
| engagements | RCUD | RU (own) | R (own) |
| intake_records | RCUD | RU (own) | RCU (own) |
| internal_engagement_records | RCUD | RCU (own) | |
| contracts | RCUD | R (own) | R (own) |
| documents | RCUD | R (own) | R (own) |
| signatures | RCUD | R (own) | RC (own, self as signer) |
| service_records | RCUD | RCU (own) | R (own) |
| emergency_profiles | RCUD | R (own engagements) | RCU (own contact) |
| transactions | RCUD | R (own, non-financial cols) | R (own, non-financial cols) |
| payments | RCUD | | R (own) |
| pricing tables | RCUD | R | R (active rates only) |
| communications | RCUD | RCU (own) | RC (own) |
| audit_logs | R | | |
| events | R | R (own) | R (own) |
| workflow_steps | RCUD | RU (own) | R (own) |
| feature_flags | RCUD | R | R |
| lookup tables | RCUD | R | R |

Notes that the RLS migration must enforce, not just the matrix:

- "non-financial cols" on transactions means amount and commission are hidden from TRAINER and CLIENT via column-level grants or a view; the base table is admin-only for those columns.
- CLIENT create on intake_records and signatures is how the portal captures intake submissions and type-name signatures. Updates to a signature row after signed_at is set must be blocked for everyone except via a void-and-reissue admin function.
- CLIENT update on engagements is intentionally absent. Clients move engagements forward only by completing intake and signing, which are writes to other tables that trigger status transitions through the workflow engine, never by editing engagement status directly.

## 5. API Trust Boundary

The frontend never performs direct table inserts where business rules apply. State-changing domain operations go through SECURITY DEFINER Postgres functions (RPCs) that enforce invariants, write the audit row, advance the workflow, and emit the event in one transaction.

Functions that must exist as the only write path for their domain:

- create_engagement(client, service_type, horse?) — creates engagement, opens intake record, seeds workflow steps, writes audit, emits ENGAGEMENT_CREATED.
- submit_intake(engagement, form_type, data) — writes intake_records, advances status LEAD/INTAKE_STARTED -> INTAKE_COMPLETE, audits, emits.
- generate_contract(engagement, contract_type) — creates contract DRAFT and document row with new UUID, sets status CONTRACT_PENDING.
- record_signature(document, signer_contact, method, ip) — writes signature, on completion advances AWAITING_SIGNATURE -> ACTIVE, audits, emits CONTRACT_SIGNED.
- record_payment(engagement, amount, method) — writes payment, audits, emits PAYMENT_RECEIVED.
- void_document(document, reason) — admin-only, voids and triggers reissue path.
- archive_record(table, id, reason) — the only delete path (section 7).

Direct table writes that bypass these functions are denied to TRAINER and CLIENT by RLS. ADMIN may write directly for correction, but every direct admin write is still caught by the audit trigger.

## 6. Storage Buckets and Policies

Supabase Storage buckets, each with its own RLS. Default deny; policies grant.

| Bucket | Public | ADMIN | TRAINER | CLIENT |
|--------|--------|-------|---------|--------|
| contracts | no | RW | R (own engagements) | R (own) |
| generated-documents | no | RW | R (own) | R (own) |
| reports | no | RW | RW (own) | R (own) |
| horse-photos | no | RW | RW (own engagements) | R (own horses) |
| horse-documents | no | RW | R (own) | R (own) |
| profile-images | no | RW | RW (own) | RW (own) |
| facility-files | no | RW | R | |
| temporary-uploads | no | RW | RW (own) | RW (own, auto-expire) |

Storage object paths must embed the owning identifier so policies can match on path prefix, e.g. contracts/{engagement_id}/{document_uuid}.docx and profile-images/{profile_id}/avatar.png. Policy predicates match the path prefix against the requester's owned ids. temporary-uploads objects older than 24 hours are purged by a scheduled job.

## 7. Soft Delete Policy

No hard deletes of business records. Every table that holds business data carries:

```sql
deleted_at TIMESTAMPTZ
deleted_by UUID REFERENCES profiles(id)
```

Rules:

- The only delete path is archive_record(); it sets deleted_at and deleted_by, writes an audit row with action ARCHIVE, and emits an event. It never issues SQL DELETE.
- All RLS read policies append "AND deleted_at IS NULL" so archived rows vanish from normal queries.
- ADMIN may read archived rows through an explicit include_archived view or function parameter.
- Contracts, clients, horses, transactions, signatures, and documents are never hard-deletable under any role, including ADMIN. This is enforced by REVOKE DELETE on those tables from all roles; archival is the only mechanism.
- Lookup tables and feature flags may be hard-deleted by ADMIN since they carry no business history.

## 8. Audit Logging Rules

Audit is trigger-based, not application-based, so it cannot be bypassed by a direct write or a missed code path.

- A generic AFTER INSERT/UPDATE/DELETE trigger on every business table writes to audit_logs with: timestamp, user (auth.uid()), action, table name, record id, old_value JSONB, new_value JSONB, ip, user_agent.
- The trigger captures the acting user from the session; SECURITY DEFINER functions set the acting user explicitly so RPC writes are attributed to the real caller, not the function owner.
- audit_logs is append-only: no UPDATE or DELETE permitted for any role, including ADMIN. Enforced by REVOKE and by a trigger that raises on UPDATE/DELETE.
- SIGN and GENERATE actions are recorded by the relevant RPC in addition to the row-level trigger, so legal events have an explicit, queryable trail independent of table mechanics.

## 9. Enum Strategy Confirmation

Per the data architecture decision, application-facing enumerations are lookup tables, not native PostgreSQL enums, so values can be added without migration. This applies to: service types, engagement status, contract status, communication type, payment method, payment status, horse disciplines, horse colors, breeds, lesson types, activity types, role types. Native enums are acceptable only for values that are structurally fixed and security-relevant (the three application role names are seeded data in the roles table, not an enum).

## 10. Finalized Service Catalog

The schema references exactly these 13 service types (catalog amendment applied; all Horse Care, Grooming, Bathing, Tack Cleaning, Mane Pulling, Turnout Assistance, and Show Preparation services removed). Any reference elsewhere in the specs to the superseded names is obsolete.

```
HORSE_FINDER
HORSE_EVALUATION
HORSE_PURCHASE_ASSISTANCE
HORSE_SALE_ASSISTANCE
HORSE_LEASE_IN_ASSISTANCE
HORSE_LEASE_OUT_ASSISTANCE
HORSE_TRAINING
HORSE_EXERCISE
HORSE_CLIPPING
RIDING_LESSON
JUMPER_TRAINING
HORSEMANSHIP_TRAINING
INDEPENDENT_CONTRACTOR
```

## 11. Open Values To Confirm Before Production

These are data gaps, not schema gaps. The schema ships with them nullable or placeholder; they must be filled before go-live:

- Commission rates (purchase, sale, lease) and minimum commission — blank in the pricing spec.
- Travel fee method (flat, mileage, or time-based) — undecided in the pricing spec.
- Discount rules — all unchecked in the pricing spec.
- Signature method values acceptable for the type-name-plus-checkbox model and whether ip_address capture is required for the liability audit trail (recommended yes, given California has no Equine Activity Liability Act and the waiver is the primary protection).
