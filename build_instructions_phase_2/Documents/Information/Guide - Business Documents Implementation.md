FRENCH HERITAGE EQUESTRIAN

MASTER IMPLEMENTATION GUIDE

Application Architecture, Document System, Workflow & Data Model

Version: 1.1Status: Implementation Reference

BUSINESS PROFILE

Business:

French Heritage Equestrian

Operating Location:

11500 Clews Ranch Rd, Suite A, San Diego, CA 92130

Mailing Address:

DO NOT INCLUDE MAILING ADDRESS ON ANYTHING IN THESE DOCUMENTS

PURPOSE

This document defines the operational, document, workflow, and database architecture for converting French Heritage Equestrian’s service documents into a digital application.

The system should support:

Client onboarding

Intake collection

Service selection confirmation

Engagement creation

Contract generation

Electronic signatures

Service tracking

Deliverable generation

Document storage

Audit history

CORE DESIGN PRINCIPLE

Information should be collected once and reused.

The system should transform:

Client Intake+Internal Engagement Data+Templates=Completed Documents

No duplicate manual entry should be required.

ENGAGEMENT LIFECYCLE

Prospect↓Client Intake↓Internal Engagement Creation↓Contract Generation↓Signature Collection↓Active Engagement↓Service Delivery↓Deliverables / Reports↓Completion↓Archive

IDENTIFIER ARCHITECTURE

Client ID

Permanent identifier.

Example:

CLI-000001

Never changes.

Horse ID

Permanent horse record.

Example:

HOR-000001

Engagement ID

Created for each purchased service.

Example:

ENG-2026-000001

Each engagement references:

Client

Horse (if applicable)

Service type

Contract

Deliverables

Document UUID

Every generated document receives a unique UUID.

Used for:

Provenance

Auditing

Version tracking

Document history

Example:

550e8400-e29b-41d4-a716-446655440000

SERVICE CATALOG

The application service catalog shall contain only actual French Heritage Equestrian offerings.

HORSE_FINDERHORSE_EVALUATIONHORSE_PURCHASEHORSE_SALEHORSE_LEASE_INHORSE_LEASE_OUTHORSE_TRAININGHORSE_EXERCISEHORSE_CLIPPINGRIDING_LESSONJUMPER_TRAININGHORSEMANSHIP_TRAININGCONTRACTOR

SERVICE DEFINITIONS

HORSE_TRAINING

Horse-specific training performed by FHE.

Examples:

Training rides

Development work

Behavioral improvement

Performance preparation

Does not include:

Riding lessons

Horsemanship education

General clipping

HORSEMANSHIP_TRAINING

Participant education focused on understanding and safely interacting with horses.

Examples:

Horse handling

Safety

Catching

Leading

Grooming education

Tacking education

Untacking

Stable practices

Ownership preparation

Does not automatically include:

Riding instruction

Jumper training

Horse training

RIDING_LESSON

Mounted instruction.

Examples:

Position

Flatwork

Riding skills

JUMPER_TRAINING

Jumping-specific instruction.

Examples:

Grid work

Courses

Competition preparation

HORSE_CLIPPING

Specialized coat clipping service.

Examples:

Full body clip

Trace clip

Blanket clip

Hunter clip

Custom clipping

Does not include:

General grooming packages

Horse care visits

REMOVED SERVICE CATEGORIES

The following are not offerings and should not exist in the active application:

HORSE_CAREHORSE_GROOMING

Reason:

They do not accurately represent FHE services.

DOCUMENT ARCHITECTURE

Each engagement follows:

Engagement|├── Client Intake Form├── Internal Engagement Form├── Contract├── Signed Contract├── Service Records├── Deliverables└── Completion Records

DATABASE TABLES

Clients

Fields:

client_idfirst_namelast_nameemailphoneaddresscreated_atupdated_at

Contacts

Recommended global contact table.

Supports:

Clients

Buyers

Sellers

Lessors

Lessees

Contractors

Emergency Contacts

Fields:

contact_idnameemailphonerole

Horses

Fields:

horse_idnamebreedagesexcolorowner_contact_idnotes

Engagements

Fields:

engagement_idclient_idhorse_idservice_typestatuscreated_atclosed_at

Documents

Fields:

document_idengagement_iduuiddocument_typeversionstatusfile_locationcreated_at

Signatures

Fields:

signature_iddocument_idsignertimestampsignature_status

Service Records

Fields:

record_idengagement_idrecord_typedatenotes

DOCUMENT GENERATION MODEL

Example:

Horse Finder:

Horse Finder Intake+Horse Finder Internal Form=Horse Finder Agreement=Horse Finder Results Report

Horse Clipping:

Horse Clipping Intake+Horse Clipping Internal Form=Horse Clipping Agreement=Horse Clipping Service Record

Horsemanship:

Horsemanship Intake+Horsemanship Internal Form=Horsemanship Agreement=Progress Reports

RELEASE ARCHITECTURE

Emergency authorization should exist as a reusable profile.

Do not duplicate emergency information inside every contract.

Use:

Emergency Profile↓Referenced by:- Riding Lessons- Jumper Training- Horsemanship Training- Visitors- Contractors

RELEASE PRIORITY

Maintain historical releases.

Do not delete.

Example:

Visitor Release↓Participant Release↓Advanced Activity Release

Newer releases supplement prior records.

FILE NAMING STANDARD

Format:

ENGAGEMENTID_DOCUMENTTYPE_VERSION

Example:

ENG-2026-0001_HORSE_TRAINING_AGREEMENT_V1

VERSION CONTROL

Never overwrite documents.

Use:

V1V2V3

Maintain:

Original generation

Signed version

Revised versions

CLIENT PORTAL STRUCTURE

Recommended:

DashboardMy ProfileMy HorsesMy ServicesMy AgreementsMy ReportsInvoicesDocuments

INTERNAL STAFF STRUCTURE

Recommended:

ClientsHorsesEngagementsContractsReportsTasksDocumentsSettings

STATUS FLOW

Lead↓Intake Started↓Intake Complete↓Contract Generated↓Awaiting Signature↓Active↓Completed↓Archived

AI GENERATION RULES

AI may assist with:

Filling templates

Summaries

Reports

Communications

AI should not modify approved legal language without review.

IMPLEMENTATION CHECKLIST

Database

☐ Create tables

☐ Create identifiers

☐ Create document relationships

Forms

☐ Build all client intake forms

☐ Build internal engagement forms

☐ Build emergency profile

Documents

☐ Load contracts

☐ Load instructions

☐ Load service records

☐ Load engagement summaries

Workflow

☐ Intake automation

☐ Contract generation

☐ Signature workflow

☐ Deliverable generation

☐ Archive system

FINAL SYSTEM RULE

The application database is the source of truth.

Every client interaction should create structured data that can generate:

Agreements

Summaries

Reports

Service records

Audit history

without repeated information entry.
