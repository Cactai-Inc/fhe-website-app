# SQL Amendment Instructions

Revise the generated database schema, lookup tables, seed data, enums, workflow definitions, pricing tables, and document mappings to reflect the finalized French Heritage Equestrian service catalog.

## Remove the following services completely

* Horse Care
* Grooming
* Bathing
* Tack Cleaning
* Mane Pulling
* Turnout Assistance
* Show Preparation

These should not exist as independent services, document types, workflow types, pricing records, or lookup values.

## Rename

HORSE_GROOMING

↓

HORSE_CLIPPING

Display Name:

Horse Clipping

Description:

Hair clipping services for horses.

## Confirm the active service catalog is exactly:

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

## Update all dependent objects

Update:

* foreign keys
* lookup tables
* pricing tables
* workflow definitions
* document mappings
* intake mappings
* engagement mappings
* reporting views
* analytics
* permissions
* seed data

to reference only the approved services.

## Verify

There shall be no remaining references anywhere in the schema to:

Horse Care

Horse Grooming

Bathing

Tack Cleaning

Show Preparation

Turnout Assistance

Mane Pulling

except where historical migration compatibility comments are intentionally preserved.
