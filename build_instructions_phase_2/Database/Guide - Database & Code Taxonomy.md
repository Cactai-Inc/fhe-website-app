# FRENCH HERITAGE EQUESTRIAN

# DATABASE & CODE TAXONOMY SPECIFICATION

Version: 1.0

Purpose:
Technical architecture reference for application development, database design, document generation, workflow automation, and future AI integration.

---

# 1. SYSTEM ARCHITECTURE OVERVIEW

The platform is built around:

```text
Contacts
    ↓
Clients / Participants / Related Parties
    ↓
Engagements
    ↓
Contracts
    ↓
Service Records
    ↓
Documents
    ↓
Audit History
```

The database is the source of truth.

All generated outputs should be reproducible from stored structured data.

---

# 2. CORE IDENTIFIER SYSTEM

## CLIENT_ID

Permanent client identifier.

Format:

```text
CLI-000001
```

---

## CONTACT_ID

Universal person identifier.

Format:

```text
CON-000001
```

A contact can have multiple roles.

Examples:

* Client
* Buyer
* Seller
* Rider
* Guardian
* Emergency Contact
* Contractor

---

## HORSE_ID

Permanent horse identifier.

Format:

```text
HOR-000001
```

---

## ENGAGEMENT_ID

Unique service instance.

Format:

```text
ENG-2026-000001
```

---

## DOCUMENT_UUID

Unique document provenance identifier.

Format:

```text
UUID
```

Purpose:

* Audit
* Version tracking
* Provenance
* Document recreation

---

# 3. DATABASE TABLES

---

# TABLE: contacts

Purpose:

Universal person record.

Fields:

```text
contact_id UUID PRIMARY KEY

first_name STRING

last_name STRING

email STRING

phone STRING

address TEXT

date_of_birth DATE

created_at TIMESTAMP

updated_at TIMESTAMP
```

---

# TABLE: contact_roles

Purpose:

Allows one person to have multiple relationships.

Fields:

```text
role_id

contact_id FK

role_type ENUM
```

Enum:

```text
CLIENT

BUYER

SELLER

LESSOR

LESSEE

RIDER

GUARDIAN

EMERGENCY_CONTACT

CONTRACTOR

FACILITY_CONTACT
```

---

# TABLE: clients

Purpose:

Business relationship record.

Fields:

```text
client_id

contact_id FK

status ENUM

created_at

updated_at
```

Status:

```text
ACTIVE

INACTIVE

ARCHIVED
```

---

# TABLE: horses

Fields:

```text
horse_id

name

breed

age

sex

color

registration_number

current_owner_contact_id

notes

created_at

updated_at
```

---

# TABLE: facilities

Purpose:

Tracks operating locations.

Fields:

```text
facility_id

name

address

owner_contact_id

status

created_at
```

---

# TABLE: facility_agreements

Purpose:

Stores facility use relationships.

Fields:

```text
facility_agreement_id

facility_id

document_id

effective_date

expiration_date

status
```

---

# TABLE: engagements

Purpose:

Central service transaction object.

Fields:

```text
engagement_id

client_id FK

horse_id FK nullable

service_type ENUM

status ENUM

assigned_staff_id

start_date

end_date

created_at

updated_at
```

---

# SERVICE_TYPE ENUM

```text
HORSE_FINDER

HORSE_EVALUATION

HORSE_PURCHASE

HORSE_SALE

HORSE_LEASE_IN

HORSE_LEASE_OUT

HORSE_TRAINING

HORSE_EXERCISE

HORSE_CLIPPING

RIDING_LESSON

JUMPER_TRAINING

HORSEMANSHIP_TRAINING

CONTRACTOR
```

---

# ENGAGEMENT_STATUS ENUM

```text
LEAD

INTAKE_STARTED

INTAKE_COMPLETE

CONTRACT_PENDING

AWAITING_SIGNATURE

ACTIVE

COMPLETED

CANCELLED

ARCHIVED
```

---

# TABLE: intake_records

Purpose:

Stores client-facing collected information.

Fields:

```text
intake_id

engagement_id

form_type

submitted_data JSON

submitted_at
```

---

# TABLE: internal_engagement_records

Purpose:

Stores staff-created engagement details.

Fields:

```text
internal_record_id

engagement_id

configuration JSON

created_by

created_at
```

---

# TABLE: contracts

Fields:

```text
contract_id

engagement_id

contract_type

version

status

document_uuid

created_at
```

Status:

```text
DRAFT

SENT

SIGNED

VOID

ARCHIVED
```

---

# TABLE: documents

Purpose:

All generated files.

Fields:

```text
document_id

engagement_id

document_type

uuid

version

file_path

format

created_at
```

Formats:

```text
DOCX

PDF

HTML
```

---

# TABLE: signatures

Fields:

```text
signature_id

document_id

signer_contact_id

signed_at

signature_method

ip_address
```

---

# TABLE: service_records

Purpose:

Operational service history.

Fields:

```text
service_record_id

engagement_id

record_type

record_data JSON

performed_date

created_at
```

Examples:

```text
TRAINING_SESSION

LESSON_RECORD

CLIPPING_RECORD

EVALUATION_REPORT

EXERCISE_RECORD
```

---

# TABLE: emergency_profiles

Purpose:

Reusable emergency authorization record.

Fields:

```text
emergency_profile_id

contact_id

emergency_contact_data JSON

medical_information JSON

authorization_status

created_at
```

---

# TABLE: transactions

Purpose:

Purchase, sale, lease financial records.

Fields:

```text
transaction_id

engagement_id

horse_id

buyer_contact_id

seller_contact_id

amount

commission

status

created_at
```

---

# TABLE: payments

Fields:

```text
payment_id

client_id

engagement_id

amount

payment_method

status

date
```

---

# TABLE: communications

Fields:

```text
communication_id

engagement_id

contact_id

type

message

created_at
```

Types:

```text
EMAIL

PHONE

TEXT

NOTE

MESSAGE
```

---

# TABLE: audit_logs

Purpose:

Permanent history.

Fields:

```text
audit_id

user_id

action

object_type

object_id

timestamp

metadata JSON
```

Actions:

```text
CREATE

UPDATE

DELETE

SIGN

GENERATE

ARCHIVE
```

---

# 4. DOCUMENT GENERATION MODEL

Generation:

```text
Structured Data

+

Document Template

↓

Generated Document

↓

UUID Assignment

↓

Signature

↓

Archive
```

---

# 5. SERVICE MODULE STRUCTURE

Recommended code organization:

```text
/services

horse-finder

horse-evaluation

horse-purchase

horse-sale

horse-lease

horse-training

horse-exercise

horse-clipping

riding-lessons

jumper-training

horsemanship-training

contractor
```

Each module contains:

```text
/intake

/internal

/contracts

/instructions

/reports

/summaries
```

---

# 6. DOCUMENT TEMPLATE TAXONOMY

Each service may contain:

```text
Agreement

Contract Instructions

Client Intake

Intake Instructions

Internal Engagement Form

Internal Instructions

Service Record

Progress Report

Engagement Summary
```

---

# 7. APPLICATION COMPONENTS

Recommended:

```text
ClientProfile

HorseProfile

EngagementWizard

IntakeBuilder

ContractGenerator

DocumentManager

SignatureFlow

ServiceRecordEntry

ReportGenerator

AuditViewer
```

---

# 8. ROLE PERMISSIONS

## Admin

Full access.

## Trainer

Access:

* Assigned engagements
* Horses
* Service records

## Client

Access:

* Own documents
* Own agreements
* Own reports

## Contractor

Limited assigned access.

---

# 9. AI INTEGRATION MODEL

AI may:

* Populate templates
* Summarize records
* Draft communications
* Generate reports

AI should not:

* Change approved legal templates
* Modify signed documents
* Delete records

---

# 10. IMPLEMENTATION ORDER

Recommended build sequence:

## Phase 1

Database

Identifiers

Authentication

Users

Contacts

---

## Phase 2

Clients

Horses

Engagements

---

## Phase 3

Forms

Contracts

Documents

Signatures

---

## Phase 4

Service Records

Reports

Client Portal

---

## Phase 5

AI Automation

Analytics

Workflow Optimization

---

# FINAL ARCHITECTURE RULE

Every business action should map to:

```text
WHO

WHAT

WHEN

WHERE

DOCUMENT

STATUS

AUDIT HISTORY
```

The system should always be able to answer:

"What happened, who was involved, what agreement controlled it, what service was performed, and what documents prove it?"
