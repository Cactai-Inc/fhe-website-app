FRENCH HERITAGE EQUESTRIAN

DATABASE & CODE TAXONOMY SPECIFICATION

Version: 1.0

Purpose: Technical architecture reference for application development, database design, document generation, workflow automation, and future AI integration.

1. SYSTEM ARCHITECTURE OVERVIEW

The platform is built around:

Contacts ↓Clients / Participants / Related Parties ↓Engagements ↓Contracts ↓Service Records ↓Documents ↓Audit History

The database is the source of truth.

All generated outputs should be reproducible from stored structured data.

2. CORE IDENTIFIER SYSTEM

CLIENT_ID

Permanent client identifier.

Format:

CLI-000001

CONTACT_ID

Universal person identifier.

Format:

CON-000001

A contact can have multiple roles.

Examples:

Client

Buyer

Seller

Rider

Guardian

Emergency Contact

Contractor

HORSE_ID

Permanent horse identifier.

Format:

HOR-000001

ENGAGEMENT_ID

Unique service instance.

Format:

ENG-2026-000001

DOCUMENT_UUID

Unique document provenance identifier.

Format:

UUID

Purpose:

Audit

Version tracking

Provenance

Document recreation

3. DATABASE TABLES

TABLE: contacts

Purpose:

Universal person record.

Fields:

contact_id UUID PRIMARY KEYfirst_name STRINGlast_name STRINGemail STRINGphone STRINGaddress TEXTdate_of_birth DATEcreated_at TIMESTAMPupdated_at TIMESTAMP

TABLE: contact_roles

Purpose:

Allows one person to have multiple relationships.

Fields:

role_idcontact_id FKrole_type ENUM

Enum:

CLIENTBUYERSELLERLESSORLESSEERIDERGUARDIANEMERGENCY_CONTACTCONTRACTORFACILITY_CONTACT

TABLE: clients

Purpose:

Business relationship record.

Fields:

client_idcontact_id FKstatus ENUMcreated_atupdated_at

Status:

ACTIVEINACTIVEARCHIVED

TABLE: horses

Fields:

horse_idnamebreedagesexcolorregistration_numbercurrent_owner_contact_idnotescreated_atupdated_at

TABLE: facilities

Purpose:

Tracks operating locations.

Fields:

facility_idnameaddressowner_contact_idstatuscreated_at

TABLE: facility_agreements

Purpose:

Stores facility use relationships.

Fields:

facility_agreement_idfacility_iddocument_ideffective_dateexpiration_datestatus

TABLE: engagements

Purpose:

Central service transaction object.

Fields:

engagement_idclient_id FKhorse_id FK nullableservice_type ENUMstatus ENUMassigned_staff_idstart_dateend_datecreated_atupdated_at

SERVICE_TYPE ENUM

HORSE_FINDERHORSE_EVALUATIONHORSE_PURCHASEHORSE_SALEHORSE_LEASE_INHORSE_LEASE_OUTHORSE_TRAININGHORSE_EXERCISEHORSE_CLIPPINGRIDING_LESSONJUMPER_TRAININGHORSEMANSHIP_TRAININGCONTRACTOR

ENGAGEMENT_STATUS ENUM

LEADINTAKE_STARTEDINTAKE_COMPLETECONTRACT_PENDINGAWAITING_SIGNATUREACTIVECOMPLETEDCANCELLEDARCHIVED

TABLE: intake_records

Purpose:

Stores client-facing collected information.

Fields:

intake_idengagement_idform_typesubmitted_data JSONsubmitted_at

TABLE: internal_engagement_records

Purpose:

Stores staff-created engagement details.

Fields:

internal_record_idengagement_idconfiguration JSONcreated_bycreated_at

TABLE: contracts

Fields:

contract_idengagement_idcontract_typeversionstatusdocument_uuidcreated_at

Status:

DRAFTSENTSIGNEDVOIDARCHIVED

TABLE: documents

Purpose:

All generated files.

Fields:

document_idengagement_iddocument_typeuuidversionfile_pathformatcreated_at

Formats:

DOCXPDFHTML

TABLE: signatures

Fields:

signature_iddocument_idsigner_contact_idsigned_atsignature_methodip_address

TABLE: service_records

Purpose:

Operational service history.

Fields:

service_record_idengagement_idrecord_typerecord_data JSONperformed_datecreated_at

Examples:

TRAINING_SESSIONLESSON_RECORDCLIPPING_RECORDEVALUATION_REPORTEXERCISE_RECORD

TABLE: emergency_profiles

Purpose:

Reusable emergency authorization record.

Fields:

emergency_profile_idcontact_idemergency_contact_data JSONmedical_information JSONauthorization_statuscreated_at

TABLE: transactions

Purpose:

Purchase, sale, lease financial records.

Fields:

transaction_idengagement_idhorse_idbuyer_contact_idseller_contact_idamountcommissionstatuscreated_at

TABLE: payments

Fields:

payment_idclient_idengagement_idamountpayment_methodstatusdate

TABLE: communications

Fields:

communication_idengagement_idcontact_idtypemessagecreated_at

Types:

EMAILPHONETEXTNOTEMESSAGE

TABLE: audit_logs

Purpose:

Permanent history.

Fields:

audit_iduser_idactionobject_typeobject_idtimestampmetadata JSON

Actions:

CREATEUPDATEDELETESIGNGENERATEARCHIVE

4. DOCUMENT GENERATION MODEL

Generation:

Structured Data+Document Template↓Generated Document↓UUID Assignment↓Signature↓Archive

5. SERVICE MODULE STRUCTURE

Recommended code organization:

/serviceshorse-finderhorse-evaluationhorse-purchasehorse-salehorse-leasehorse-traininghorse-exercisehorse-clippingriding-lessonsjumper-traininghorsemanship-trainingcontractor

Each module contains:

/intake/internal/contracts/instructions/reports/summaries

6. DOCUMENT TEMPLATE TAXONOMY

Each service may contain:

AgreementContract InstructionsClient IntakeIntake InstructionsInternal Engagement FormInternal InstructionsService RecordProgress ReportEngagement Summary

7. APPLICATION COMPONENTS

Recommended:

ClientProfileHorseProfileEngagementWizardIntakeBuilderContractGeneratorDocumentManagerSignatureFlowServiceRecordEntryReportGeneratorAuditViewer

8. ROLE PERMISSIONS

Admin

Full access.

Trainer

Access:

Assigned engagements

Horses

Service records

Client

Access:

Own documents

Own agreements

Own reports

Contractor

Limited assigned access.

9. AI INTEGRATION MODEL

AI may:

Populate templates

Summarize records

Draft communications

Generate reports

AI should not:

Change approved legal templates

Modify signed documents

Delete records

10. IMPLEMENTATION ORDER

Recommended build sequence:

Phase 1

Database

Identifiers

Authentication

Users

Contacts

Phase 2

Clients

Horses

Engagements

Phase 3

Forms

Contracts

Documents

Signatures

Phase 4

Service Records

Reports

Client Portal

Phase 5

AI Automation

Analytics

Workflow Optimization

FINAL ARCHITECTURE RULE

Every business action should map to:

WHOWHATWHENWHEREDOCUMENTSTATUSAUDIT HISTORY

The system should always be able to answer:

“What happened, who was involved, what agreement controlled it, what service was performed, and what documents prove it?”
