# Database SQL Files

database/

000_extensions.sql

001_types.sql

002_tables.sql

003_indexes.sql

004_constraints.sql

005_views.sql

006_functions.sql

007_triggers.sql

008_rls.sql

009_permissions.sql

010_seed_lookup_tables.sql

011_seed_services.sql

012_seed_document_types.sql

013_seed_workflows.sql

014_storage.sql

015_storage_policies.sql

016_audit.sql

017_reporting_views.sql

018_test_data.sql

README.md
```

I would also add a few things that we hadn't previously discussed.

---

# Authentication Model

I'd avoid embedding permissions directly into the `users` table.

Instead:

```text
auth.users

↓

profiles

↓

roles

↓

permissions

↓

role_permissions
```

This lets you grant multiple roles later without schema changes.

Example:

```text
Owner

Trainer

Assistant Trainer

Contractor

Client

Parent

Viewer
```

---

# Row Level Security

Instead of generic RLS, I'd write table-specific policies.

Examples:

## Client

Can only read:

* Their own profile
* Their own horses
* Their own engagements
* Their own contracts
* Their own reports

Never another client's.

---

## Trainer

Can read:

Assigned engagements.

Cannot see:

Payroll

Tax information

Admin settings

---

## Contractor

Can only see:

Assignments

Own documents

Emergency information (if appropriate)

---

## Owner/Admin

Full access.

---

# Storage Policies

People forget these.

Supabase Storage needs policies too.

Example buckets:

```text
contracts

reports

horse-photos

horse-documents

profile-images

facility-files

generated-documents

temporary-uploads
```

Each bucket gets its own RLS.

---

# Audit System

I would never trust application logging alone.

I'd build:

```text
audit_log

id

timestamp

user

action

table

record

old_value

new_value

ip

user_agent
```

Automatically populated by triggers.

---

# Soft Deletes

Rather than:

DELETE

I'd recommend:

```sql
deleted_at TIMESTAMP

deleted_by UUID
```

Everything archived instead.

Especially:

Contracts

Clients

Horses

Transactions

---

# Document Versioning

Never overwrite documents.

Every revision:

```text
Version 1

Version 2

Version 3
```

Each with its own UUID.

---

# Workflow Engine

Instead of booleans:

```text
contract_signed

payment_received

...
```

I'd build a workflow table.

```text
Workflow Step

Pending

Completed

Blocked

Skipped
```

Much more scalable.

---

# Event System

Every major action creates an event.

Example:

```text
Client Created

Horse Added

Contract Generated

Contract Signed

Lesson Completed

Horse Purchased

Payment Received
```

This becomes:

Notifications

Timeline

Audit

Analytics

---

# Feature Flags

Future-proofing.

```text
AI_ENABLED

CLIENT_PORTAL

ONLINE_BOOKING

SMS

EMAIL

ONLINE_PAYMENTS
```

Instead of hardcoding.

---

# Enumerations

I'd move all of these into lookup tables rather than PostgreSQL enums:

* Service types
* Engagement status
* Contract status
* Communication type
* Payment method
* Payment status
* Horse disciplines
* Horse colors
* Breeds (optional)
* Lesson types
* Activity types

Why?

Because you can add values without a migration.

---

# API Layer

I would keep the frontend from talking directly to tables wherever business rules matter.

Example:

Instead of:

```text
Insert Engagement
```

Have an RPC/function:

```text
create_engagement()

↓

creates engagement

↓

creates intake

↓

creates workflow

↓

creates audit

↓

returns engagement
```

Far safer.

---

# Search

I'd build full-text indexes for:

* Clients
* Horses
* Notes
* Evaluations
* Communications

You'll thank yourself later.

---

# UUID Strategy

Everything gets UUIDs.

Everything.

Even lookup tables.

Integer IDs can exist internally if desired, but UUIDs make synchronization, imports, and external references much cleaner.

---

## One additional architecture document

I think we're now at the point where there's one more document worth creating before any SQL:

**`DATABASE_SECURITY_AND_PERMISSION_MODEL.md`**

It would define, in one place:

* Authentication flow
* Authorization model
* User roles
* Permission matrix
* RLS policy strategy
* Storage bucket permissions
* Audit logging rules
* Soft-delete policy
* Record ownership rules
* Service-role responsibilities
* API trust boundaries
* Admin override behavior

That document becomes the blueprint for `008_rls.sql`, `009_permissions.sql`, `015_storage_policies.sql`, and `016_audit.sql`.

---

### My recommendation

At this point, I would **not** have your AI coding tool invent the database. We have enough domain knowledge now that the database should be treated as a first-class deliverable. I would generate the complete SQL package from our specifications, including RLS policies, triggers, indexes, storage policies, helper functions, audit logging, and seed data. That will give your coding agent a stable, opinionated foundation instead of asking it to infer business rules from the contracts. I think that approach will produce a more maintainable application and significantly reduce the chance of subtle data-model or security mistakes.
