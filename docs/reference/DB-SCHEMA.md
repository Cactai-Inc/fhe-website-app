# DB SCHEMA — generated from the live database

**Generated 2026-09-01. Regenerate with:**
```
node scripts/gen-db-schema.mjs
```

Replaces the 972-file migration journal as the day-to-day schema reference (D30 —
the journal is archived history at `supabase/migrations-archive/`, kept for audit,
not read to understand current shape). Table/column comments below are `pg_catalog`
`COMMENT ON` text where a migration set one; most do not have one yet.

**156 tables.**

---

## activity_checklists

Rows (estimate): 31

| column | type | nullable | default | comment |
|---|---|---|---|---|
| **id** (PK) | uuid | NO | gen_random_uuid() |  |
| org_id → organizations.id | uuid | NO |  |  |
| service_type | text | NO |  |  |
| label | text | NO |  |  |
| sort_order | integer | NO | 0 |  |
| active | boolean | NO | true |  |
| created_at | timestamp with time zone | NO | now() |  |

## announcements

Rows (estimate): 0

| column | type | nullable | default | comment |
|---|---|---|---|---|
| **id** (PK) | uuid | NO | gen_random_uuid() |  |
| author_id | uuid | YES |  |  |
| title | text | NO |  |  |
| body | text | NO |  |  |
| pinned | boolean | NO | false |  |
| published | boolean | NO | true |  |
| created_at | timestamp with time zone | NO | now() |  |
| org_id → organizations.id | uuid | NO | current_org() |  |

## audit_logs

Rows (estimate): 5727

| column | type | nullable | default | comment |
|---|---|---|---|---|
| **id** (PK) | uuid | NO | gen_random_uuid() |  |
| occurred_at | timestamp with time zone | NO | now() |  |
| actor_user_id | uuid | YES |  |  |
| action | text | NO |  |  |
| table_name | text | NO |  |  |
| record_id | uuid | YES |  |  |
| old_value | jsonb | YES |  |  |
| new_value | jsonb | YES |  |  |
| ip | text | YES |  |  |
| user_agent | text | YES |  |  |

## billable_lines

Rows (estimate): 0

| column | type | nullable | default | comment |
|---|---|---|---|---|
| **id** (PK) | uuid | NO | gen_random_uuid() |  |
| org_id → organizations.id | uuid | NO | current_org() |  |
| payer_contact_id → contacts.id | uuid | NO |  |  |
| source_kind | text | NO |  |  |
| source_id | uuid | YES |  |  |
| horse_id → horses.id | uuid | YES |  |  |
| qty | numeric | NO | 1 |  |
| unit_amount | numeric | NO | 0 |  |
| amount | numeric | NO | 0 |  |
| status | text | NO | 'OPEN'::text |  |
| period | tstzrange | YES |  |  |
| created_at | timestamp with time zone | NO | now() |  |
| updated_at | timestamp with time zone | NO | now() |  |
| deleted_at | timestamp with time zone | YES |  |  |
| deleted_by → profiles.user_id | uuid | YES |  |  |

## board_agreements

Rows (estimate): 0

| column | type | nullable | default | comment |
|---|---|---|---|---|
| **id** (PK) | uuid | NO | gen_random_uuid() |  |
| org_id → organizations.id | uuid | NO | current_org() |  |
| horse_id → horses.id | uuid | NO |  |  |
| stall_id → stalls.id | uuid | YES |  |  |
| boarder_contact_id → contacts.id | uuid | NO |  |  |
| board_rate | numeric | YES | (NULLIF(config_value('BOARDING'::text, ' |  |
| board_type | text | YES |  |  |
| start_date | date | YES |  |  |
| end_date | date | YES |  |  |
| status | text | NO | 'ACTIVE'::text |  |
| created_at | timestamp with time zone | NO | now() |  |
| updated_at | timestamp with time zone | NO | now() |  |
| deleted_at | timestamp with time zone | YES |  |  |
| deleted_by → profiles.user_id | uuid | YES |  |  |

## board_charges

Rows (estimate): 0

| column | type | nullable | default | comment |
|---|---|---|---|---|
| **id** (PK) | uuid | NO | gen_random_uuid() |  |
| org_id → organizations.id | uuid | NO | current_org() |  |
| board_agreement_id → board_agreements.id | uuid | NO |  |  |
| period_start | date | NO |  |  |
| period_end | date | NO |  |  |
| amount | numeric | NO | 0 |  |
| billable_line_id → billable_lines.id | uuid | YES |  |  |
| created_at | timestamp with time zone | NO | now() |  |
| updated_at | timestamp with time zone | NO | now() |  |
| deleted_at | timestamp with time zone | YES |  |  |
| deleted_by → profiles.user_id | uuid | YES |  |  |

## booking_change_fees

ONBOARD §7: THE TIERED CHANGE-FEE SCHEDULE, and the place the owner's numbers go. One row per band: hours_before + fee_amount (+ a label the client sees). Empty by design — with no rows, reschedule_fee() falls back to the incumbent flat calendar_settings.reschedule_fee, so behaviour is unchanged until the owner enters the schedule. Edited from the calendar settings panel via set_booking_change_fee_schedule(); adding a tier is never a migration (D13).

Rows (estimate): 3

| column | type | nullable | default | comment |
|---|---|---|---|---|
| **id** (PK) | uuid | NO | gen_random_uuid() |  |
| org_id → organizations.id | uuid | NO |  |  |
| hours_before | integer | NO |  |  |
| fee_amount | numeric | NO |  |  |
| label | text | YES |  |  |
| active | boolean | NO | true |  |
| created_at | timestamp with time zone | NO | now() |  |
| updated_at | timestamp with time zone | NO | now() |  |

## booking_change_requests

Rows (estimate): 0

| column | type | nullable | default | comment |
|---|---|---|---|---|
| **id** (PK) | uuid | NO | gen_random_uuid() |  |
| org_id → organizations.id | uuid | NO |  |  |
| booking_id → bookings.id | uuid | NO |  |  |
| requested_by | uuid | YES |  |  |
| request_kind | text | NO |  |  |
| proposed_starts_at | timestamp with time zone | YES |  |  |
| proposed_ends_at | timestamp with time zone | YES |  |  |
| scope | text | YES |  |  |
| status | text | NO | 'pending'::text |  |
| fee_amount | numeric | YES |  |  |
| fee_paid | boolean | NO | false |  |
| fee_waived | boolean | NO | false |  |
| phone_required | boolean | NO | false |  |
| note | text | YES |  |  |
| created_at | timestamp with time zone | NO | now() |  |
| decided_by | uuid | YES |  |  |
| decided_at | timestamp with time zone | YES |  |  |
| awaiting_client | boolean | NO | false | REVIEWQ R2: true when staff proposed a counter-time and the booking's own client must accept/decline it; false (default) is the existing client-raises/staff-decides direction. |
| staff_note | text | YES |  | REVIEWQ R2/R3: staff-authored note — a decline reason or a note on a proposed counter-time. Separate from the client-authored `note` column so neither overwrites the other. |
| fee_reported_method | text | YES |  | ONBOARD §7: 'zelle' or 'cash' — what the CLIENT said they did about the change fee, captured before the request was allowed to submit. A claim; fee_paid is still only ever set by staff through mark_change_fee_paid. |
| fee_reported_reference | text | YES |  |  |
| fee_reported_at | timestamp with time zone | YES |  |  |

## booking_fee_charges

FEECHOICE F4: one row per staff fee decision on a booking — which policy clause was invoked (or none, for a waiver/custom amount), the amount, the required reason, who decided and when, and the purchases row it settles through. Never updated after creation except superseded_by — a correction is a new row, per D11/D14 (nothing is mutated, corrections supersede).

Rows (estimate): 0

| column | type | nullable | default | comment |
|---|---|---|---|---|
| **id** (PK) | uuid | NO | gen_random_uuid() |  |
| org_id → organizations.id | uuid | NO |  |  |
| booking_id → bookings.id | uuid | NO |  |  |
| change_request_id → booking_change_requests.id | uuid | YES |  |  |
| purchase_id → purchases.id | uuid | YES |  |  |
| fee_kind | text | NO |  |  |
| policy_clause | text | YES |  |  |
| policy_wording | text | NO |  |  |
| amount | numeric | NO |  |  |
| reason | text | YES |  |  |
| decided_by → profiles.user_id | uuid | NO |  |  |
| decided_at | timestamp with time zone | NO | now() |  |
| superseded_by → booking_fee_charges.id | uuid | YES |  |  |
| created_at | timestamp with time zone | NO | now() |  |

## booking_forms

LESSONFORM: one activity-form INSTANCE per serviced booking. The link is booking_id, which is why a reschedule moves the form for free (a reschedule edits the booking's times in place and never changes its id). answers is the record; bookings.activity_log and bookings.notes are one-way projections written by save_booking_form so the rider-facing surfaces that already read them keep working.

Rows (estimate): 116

| column | type | nullable | default | comment |
|---|---|---|---|---|
| **id** (PK) | uuid | NO | gen_random_uuid() |  |
| org_id → organizations.id | uuid | NO |  |  |
| booking_id → bookings.id | uuid | NO |  |  |
| form_key | text | NO |  |  |
| form_definition_id → form_definitions.id | uuid | YES |  |  |
| service_type | text | YES |  |  |
| status | text | NO | 'open'::text | open = exists, may be blank or partly filled (never an error state — many lessons will never get one). submitted = Claire says it is done. retired = its booking was cancelled and the form had been written in, so it is kept as evidence (D11) instead of deleted. A blank form on a cancelled booking is hard-deleted and has no row here. |
| answers | jsonb | NO | '{}'::jsonb | Keyed by the definition's field keys: attendance \| activities \| log_text \| report. |
| submitted_at | timestamp with time zone | YES |  |  |
| submitted_by | uuid | YES |  |  |
| retired_at | timestamp with time zone | YES |  |  |
| retired_by | uuid | YES |  |  |
| created_at | timestamp with time zone | NO | now() |  |
| updated_at | timestamp with time zone | NO | now() |  |
| plan_id → lesson_plans.id | uuid | YES |  | LESSONPLAN: the plan version this lesson was TAUGHT AGAINST, pinned when progress is recorded. NULL while the lesson is still ahead — an unheld lesson resolves the client's current plan live, which is exactly how the next lesson picks up a plan that changed after the last one. |
| form_version | integer | YES |  | The form_definition_versions row these answers were collected under. Stamped at creation; a later edit to the form cannot change what this set of answers means. |

## booking_item_swaps

CREDITALIGN A2: every time a booking was re-charged from one purchased item to another — who, from what, to what, when, and what state the booking was in. Deliberately NOT foreign-keyed to lesson_credits: a credit row can be soft-deleted or superseded and this record has to outlive it (same reasoning as executed documents — evidence you deleted is evidence you do not have). It is a log, not a ledger: nothing is ever spent from it.

Rows (estimate): 0

| column | type | nullable | default | comment |
|---|---|---|---|---|
| **id** (PK) | uuid | NO | gen_random_uuid() |  |
| org_id → organizations.id | uuid | NO |  |  |
| booking_id → bookings.id | uuid | NO |  |  |
| swapped_by → profiles.user_id | uuid | YES |  |  |
| swapped_by_role | text | NO |  |  |
| booking_status_at | text | YES |  |  |
| from_credit_id | uuid | YES |  |  |
| from_offering_id | uuid | YES |  |  |
| from_purchase_id | uuid | YES |  |  |
| from_label | text | YES |  |  |
| to_credit_id | uuid | NO |  |  |
| to_offering_id | uuid | YES |  |  |
| to_purchase_id | uuid | YES |  |  |
| to_label | text | YES |  |  |
| created_at | timestamp with time zone | NO | now() |  |

## booking_note_seen

DASHBOARDBUILD C6. One row = this person has read that lesson note. Same shape as contract_change_request_seen, deliberately — see that table before changing this one.

Rows (estimate): 0

| column | type | nullable | default | comment |
|---|---|---|---|---|
| **note_id** (PK) → booking_notes.id | uuid | NO |  |  |
| **contact_id** (PK) → contacts.id | uuid | NO |  |  |
| org_id | uuid | NO | current_org() |  |
| seen_at | timestamp with time zone | NO | now() |  |
| seen_role | text | YES |  |  |
| seen_label | text | YES |  |  |

## booking_notes

Rows (estimate): 0

| column | type | nullable | default | comment |
|---|---|---|---|---|
| **id** (PK) | uuid | NO | gen_random_uuid() |  |
| org_id → organizations.id | uuid | NO |  |  |
| booking_id → bookings.id | uuid | NO |  |  |
| author_user_id | uuid | YES |  |  |
| author_role | text | NO |  |  |
| author_name | text | YES |  |  |
| phase | text | NO |  |  |
| body | text | NO |  |  |
| created_at | timestamp with time zone | NO | now() |  |

## bookings

Rows (estimate): 718

| column | type | nullable | default | comment |
|---|---|---|---|---|
| **id** (PK) | uuid | NO | gen_random_uuid() |  |
| display_code | text | YES |  |  |
| org_id → organizations.id | uuid | NO | current_org() |  |
| purchase_id → purchases.id | uuid | YES |  |  |
| contract_id → contracts.id | uuid | YES |  |  |
| account_user_id → profiles.user_id | uuid | YES |  |  |
| account_contact_id → contacts.id | uuid | YES |  |  |
| offering_id → offerings.id | uuid | YES |  |  |
| starts_at | timestamp with time zone | YES |  |  |
| ends_at | timestamp with time zone | YES |  |  |
| location | text | YES |  |  |
| status | text | NO | 'pending_slot'::text |  |
| hold_expires_at | timestamp with time zone | YES |  |  |
| notes | text | YES |  |  |
| created_at | timestamp with time zone | NO | now() |  |
| updated_at | timestamp with time zone | NO | now() |  |
| client_id → clients.id | uuid | YES |  |  |
| instructor_user_id → profiles.user_id | uuid | YES |  |  |
| credit_id → lesson_credits.id | uuid | YES |  |  |
| request_id → requests.id | uuid | YES |  |  |
| kind | text | NO | 'purchase'::text |  |
| horse_id → horses.id | uuid | YES |  |  |
| activity_log | jsonb | YES |  |  |
| is_flexible | boolean | NO | false |  |
| series_id | uuid | YES |  |  |
| travel_before_minutes | integer | NO | 0 |  |
| travel_after_minutes | integer | NO | 0 |  |
| address | text | YES |  |  |
| price_amount | numeric | YES |  |  |
| location_id → locations.id | uuid | YES |  |  |
| created_by | uuid | YES |  |  |
| all_day | boolean | NO | false |  |
| reminder_1h_sent_at | timestamp with time zone | YES |  |  |
| reminder_2h_sent_at | timestamp with time zone | YES |  |  |
| current_status | text | YES |  |  |
| deleted_at | timestamp with time zone | YES |  | REVIEWQ R3/D11: set by delete_calendar_item when a row carrying client/purchase/credit/audit history is retired instead of hard-deleted. NULL = live. |
| deleted_by → profiles.user_id | uuid | YES |  |  |

## business_config

Rows (estimate): 1

| column | type | nullable | default | comment |
|---|---|---|---|---|
| **id** (PK) | uuid | NO | gen_random_uuid() |  |
| legal_entity_name | text | YES |  |  |
| entity_formation | text | YES |  |  |
| registered_agent | text | YES |  |  |
| signatory_name | text | YES |  |  |
| signatory_title | text | YES |  |  |
| business_address | text | YES |  |  |
| commission_purchase_rate | numeric | YES |  |  |
| commission_sale_rate | numeric | YES |  |  |
| commission_lease_rate | numeric | YES |  |  |
| commission_min | numeric | YES |  |  |
| travel_fee_method | text | YES |  |  |
| travel_fee_amount | numeric | YES |  |  |
| cancellation_fee | numeric | YES |  |  |
| late_fee | numeric | YES |  |  |
| no_show_fee | numeric | YES |  |  |
| protection_period | text | YES |  |  |
| sales_tax_rate | numeric | YES |  |  |
| document_retention | text | YES |  |  |
| esignature_provider | text | YES |  |  |
| updated_at | timestamp with time zone | NO | now() |  |
| lease_full_fee | numeric | YES |  |  |
| lease_half_fee | numeric | YES |  |  |
| org_id → organizations.id | uuid | NO | current_org() |  |
| signatory_contact_id → contacts.id | uuid | YES |  |  |

## business_hours

Rows (estimate): 7

| column | type | nullable | default | comment |
|---|---|---|---|---|
| **id** (PK) | uuid | NO | gen_random_uuid() |  |
| org_id → organizations.id | uuid | NO |  |  |
| weekday | smallint | NO |  |  |
| open_time | time without time zone | NO | '10:00:00'::time without time zone |  |
| close_time | time without time zone | NO | '18:00:00'::time without time zone |  |
| closed | boolean | NO | false |  |

## calendar_settings

Rows (estimate): 1

| column | type | nullable | default | comment |
|---|---|---|---|---|
| **org_id** (PK) → organizations.id | uuid | NO |  |  |
| reschedule_fee | numeric | NO | 0 |  |
| updated_at | timestamp with time zone | NO | now() |  |

## category_document_requirements

Rows (estimate): 12

| column | type | nullable | default | comment |
|---|---|---|---|---|
| **id** (PK) | uuid | NO | gen_random_uuid() |  |
| org_id | uuid | NO |  |  |
| category | text | NO |  |  |
| template_key | text | NO |  |  |

## channel_messages

Rows (estimate): 0

| column | type | nullable | default | comment |
|---|---|---|---|---|
| **id** (PK) | uuid | NO | gen_random_uuid() |  |
| channel_id → channels.id | uuid | NO |  |  |
| author_id | uuid | NO |  |  |
| body | text | NO |  |  |
| hidden | boolean | NO | false |  |
| created_at | timestamp with time zone | NO | now() |  |
| org_id → organizations.id | uuid | NO | current_org() |  |

## channels

Rows (estimate): 0

| column | type | nullable | default | comment |
|---|---|---|---|---|
| **id** (PK) | uuid | NO | gen_random_uuid() |  |
| name | text | NO |  |  |
| slug | text | NO |  |  |
| description | text | YES |  |  |
| sort_order | integer | NO | 0 |  |
| created_at | timestamp with time zone | NO | now() |  |
| org_id → organizations.id | uuid | NO | current_org() |  |

## clients

Rows (estimate): 24

| column | type | nullable | default | comment |
|---|---|---|---|---|
| **id** (PK) | uuid | NO | gen_random_uuid() |  |
| display_code | text | YES |  |  |
| contact_id → contacts.id | uuid | NO |  |  |
| status | text | NO | 'ACTIVE'::text |  |
| source | text | YES |  |  |
| created_at | timestamp with time zone | NO | now() |  |
| updated_at | timestamp with time zone | NO | now() |  |
| deleted_at | timestamp with time zone | YES |  |  |
| deleted_by → profiles.user_id | uuid | YES |  |  |
| org_id → organizations.id | uuid | NO | current_org() |  |
| customer_since | timestamp with time zone | YES |  |  |
| client_since | timestamp with time zone | YES |  |  |

## config_keys

Rows (estimate): 22

| column | type | nullable | default | comment |
|---|---|---|---|---|
| **namespace** (PK) | text | NO |  |  |
| **key** (PK) | text | NO |  |  |
| expected_type | text | NO |  |  |
| required | boolean | NO | false |  |
| description | text | YES |  |  |

## config_values

Rows (estimate): 15

| column | type | nullable | default | comment |
|---|---|---|---|---|
| **id** (PK) | uuid | NO | gen_random_uuid() |  |
| org_id → organizations.id | uuid | NO | current_org() |  |
| namespace | text | NO |  |  |
| key | text | NO |  |  |
| value_text | text | YES |  |  |
| value_num | numeric | YES |  |  |
| value_json | jsonb | YES |  |  |
| category | text | YES |  |  |
| effective_from | timestamp with time zone | NO | now() |  |
| updated_by → profiles.user_id | uuid | YES |  |  |
| created_at | timestamp with time zone | NO | now() |  |
| updated_at | timestamp with time zone | NO | now() |  |

## consumption_events

Rows (estimate): 0

| column | type | nullable | default | comment |
|---|---|---|---|---|
| **id** (PK) | uuid | NO | gen_random_uuid() |  |
| org_id → organizations.id | uuid | NO | current_org() |  |
| resource_id → resources.id | uuid | NO |  |  |
| resource_lot_id → resource_lots.id | uuid | YES |  |  |
| horse_id → horses.id | uuid | YES |  |  |
| qty | numeric | NO | 1 |  |
| administered_by → profiles.user_id | uuid | YES |  |  |
| occurred_at | timestamp with time zone | NO | now() |  |
| notes | text | YES |  |  |
| created_at | timestamp with time zone | NO | now() |  |
| deleted_at | timestamp with time zone | YES |  |  |
| deleted_by → profiles.user_id | uuid | YES |  |  |

## contact_required_documents

Rows (estimate): 49

| column | type | nullable | default | comment |
|---|---|---|---|---|
| **contact_id** (PK) → contacts.id | uuid | NO |  |  |
| **template_key** (PK) | text | NO |  |  |
| org_id | uuid | NO | current_org() |  |
| skipped_at | timestamp with time zone | YES |  |  |
| skipped_by | uuid | YES |  |  |
| skip_reason | text | YES |  |  |
| disposition | text | NO | 'AT_LOGIN'::text |  |

## contacts

THE person record — the single home for everything we know about a human or organisation, whether or not they have a login. `profiles` is the ACCOUNT (auth bridge, role, community persona, tour markers) and holds nothing about the person. Onboarding, the website form, the app profile page and every staff surface all read and write HERE.

Rows (estimate): 33

| column | type | nullable | default | comment |
|---|---|---|---|---|
| **id** (PK) | uuid | NO | gen_random_uuid() |  |
| display_code | text | YES |  |  |
| first_name | text | YES |  |  |
| last_name | text | YES |  |  |
| email | text | YES |  |  |
| phone | text | YES |  |  |
| address_line1 | text | YES |  |  |
| address_line2 | text | YES |  |  |
| city | text | YES |  |  |
| state | text | YES |  |  |
| postal_code | text | YES |  |  |
| country | text | YES | 'USA'::text |  |
| address_composed | text | YES |  |  |
| date_of_birth | date | YES |  |  |
| tags | ARRAY | NO | '{}'::text[] |  |
| notes | text | YES |  |  |
| created_at | timestamp with time zone | NO | now() |  |
| updated_at | timestamp with time zone | NO | now() |  |
| deleted_at | timestamp with time zone | YES |  |  |
| deleted_by → profiles.user_id | uuid | YES |  |  |
| org_id → organizations.id | uuid | NO | current_org() |  |
| emergency_contact_1_name | text | YES |  |  |
| emergency_contact_1_relationship | text | YES |  |  |
| emergency_contact_1_phone | text | YES |  |  |
| emergency_contact_2_name | text | YES |  |  |
| emergency_contact_2_relationship | text | YES |  |  |
| emergency_contact_2_phone | text | YES |  |  |
| riding_experience_years | text | YES |  |  |
| jump_experience | text | YES |  |  |
| riding_background | text | YES |  |  |
| jump_limitations | text | YES |  |  |
| is_company | boolean | NO | false |  |
| guardian_contact_id → contacts.id | uuid | YES |  |  |
| contact_type | text | NO | 'CONTACT'::text | The person-page discriminator — one row appears on exactly ONE page. LEAD: a potential future client we may reach out to or include in a campaign. CONTACT: an internal person the business serves (client, member, horse owner, counterparty) who is not part of the company. TEAM: the company itself — staff, internal accounts, and the tenant org record. DIRECTORY: external people and businesses that PROVIDE something — farriers, vets, suppliers, service providers, event organizers. Explicit and settable. NULL means unclassified and is surfaced for a human decision, never silently bucketed — the old "Lead" was assigned whenever nothing else matched, which is why it never formed a usable campaign list. |
| mobile | text | YES |  |  |
| whatsapp | text | YES |  |  |
| preferred_contact | text | YES |  |  |
| hide_email | boolean | NO | false |  |
| hide_mobile | boolean | NO | false |  |
| hide_whatsapp | boolean | NO | false |  |
| social_tiktok | text | YES |  |  |
| social_instagram | text | YES |  |  |
| social_facebook | text | YES |  |  |
| social_linkedin | text | YES |  |  |
| name_needs_confirmation | boolean | NO | false | TRUE when we cannot safely assert this person's legal name and they must supply it before filling a form or signing anything. Set when two sources disagreed irreconcilably (not a mere abbreviation) — the alternative was to guess, and a guessed surname on an executed contract is not recoverable. Cleared the moment they confirm. |
| phone_ext | text | YES |  | Extension for `phone`, stored separately so the number itself stays clean and dialable. Composed into the display form as "(858) 439-3614 ext. 412". |
| mobile_ext | text | YES |  |  |
| phone_display | text | YES |  | THE reading form of the phone number, generated from phone + phone_ext. Every surface that SHOWS a number should read this; `phone` is the storage form. Generated, so it cannot fall out of step with its parts. |
| mobile_display | text | YES |  |  |
| mobile_call | text | YES |  | Community-facing number for phone calls. Independent of contacts.phone (the company-on-file number): seeded from it once, then fully the member's to change. Hidden from the community when hide_mobile_call. |
| mobile_text | text | YES |  |  |
| whatsapp_call | text | YES |  |  |
| whatsapp_text | text | YES |  |  |
| community_email | text | YES |  | Community-facing email, may differ from the account/login email. Seeded from the contact email once, then independent. |
| hide_mobile_call | boolean | NO | false |  |
| hide_mobile_text | boolean | NO | false |  |
| hide_whatsapp_call | boolean | NO | false |  |
| hide_whatsapp_text | boolean | NO | false |  |
| hide_community_email | boolean | NO | false |  |
| rider_skill_level | text | YES |  | Internal staff assessment of the rider's level; pairs with horses.rider_level_min/max for horse-rider matching. |
| mobile_number | text | YES |  |  |
| texts_phone | text | YES |  |  |
| correspondence_email | text | YES |  |  |
| zelle_phone | text | YES |  |  |
| zelle_email | text | YES |  |  |
| staff_preferred_contact | text | NO | 'none'::text |  |
| deleted_reason | text | YES |  | Why this contact was archived, captured by archive_contact (D19). Cleared by unarchive_contact; the audit_contacts trigger keeps the prior value in audit_logs either way. |
| text_only_phone | text | YES |  | An alternate number the person wants TEXTS ONLY on. `phone` is their mobile and the number we call. Added 2026-08-24 (TASK-INTAKE). |
| family_sort_key | text | YES |  |  |
| client_origin | text | YES |  |  |
| contact_channel | text | YES |  |  |

## content_acknowledgments

Rows (estimate): 0

| column | type | nullable | default | comment |
|---|---|---|---|---|
| **id** (PK) | uuid | NO | gen_random_uuid() |  |
| block_id → content_blocks.id | uuid | NO |  |  |
| version | integer | NO |  |  |
| user_id → profiles.user_id | uuid | NO |  |  |
| acknowledged_at | timestamp with time zone | NO | now() |  |

## content_block_versions

Rows (estimate): 0

| column | type | nullable | default | comment |
|---|---|---|---|---|
| **id** (PK) | uuid | NO | gen_random_uuid() |  |
| block_id → content_blocks.id | uuid | NO |  |  |
| version | integer | NO |  |  |
| body | text | NO |  |  |
| edited_by → profiles.user_id | uuid | YES |  |  |
| created_at | timestamp with time zone | NO | now() |  |
| parent_version | integer | YES |  | The version this one was edited FROM. NULL = the immediately preceding version (the ordinary case). Never points forward. |

## content_blocks

Rows (estimate): 0

| column | type | nullable | default | comment |
|---|---|---|---|---|
| **id** (PK) | uuid | NO | gen_random_uuid() |  |
| org_id → organizations.id | uuid | NO |  |  |
| slug | text | NO |  |  |
| kind | text | NO | 'content'::text |  |
| title | text | NO |  |  |
| current_version | integer | NO | 1 |  |
| created_at | timestamp with time zone | NO | now() |  |
| updated_at | timestamp with time zone | NO | now() |  |

## content_posts

Rows (estimate): 0

| column | type | nullable | default | comment |
|---|---|---|---|---|
| **id** (PK) | uuid | NO | gen_random_uuid() |  |
| author_id | uuid | YES |  |  |
| title | text | NO |  |  |
| slug | text | NO |  |  |
| excerpt | text | YES |  |  |
| body | text | NO |  |  |
| cover_url | text | YES |  |  |
| published | boolean | NO | false |  |
| created_at | timestamp with time zone | NO | now() |  |
| updated_at | timestamp with time zone | NO | now() |  |
| org_id → organizations.id | uuid | NO | current_org() |  |

## content_resources

Rows (estimate): 0

| column | type | nullable | default | comment |
|---|---|---|---|---|
| **id** (PK) | uuid | NO | gen_random_uuid() |  |
| title | text | NO |  |  |
| description | text | YES |  |  |
| kind | text | NO | 'file'::text |  |
| url | text | YES |  |  |
| storage_path | text | YES |  |  |
| published | boolean | NO | true |  |
| created_at | timestamp with time zone | NO | now() |  |
| org_id → organizations.id | uuid | NO | current_org() |  |
| file_id → files.id | uuid | YES |  |  |

## contract_addenda

Rows (estimate): 0

| column | type | nullable | default | comment |
|---|---|---|---|---|
| **id** (PK) | uuid | NO | gen_random_uuid() |  |
| org_id → organizations.id | uuid | NO | current_org() |  |
| document_id → documents.id | uuid | NO |  |  |
| item_number | integer | NO |  |  |
| body | text | NO |  |  |
| proposed_by_contact_id → contacts.id | uuid | YES |  |  |
| proposed_by_role | text | YES |  |  |
| status | text | NO | 'open'::text |  |
| resolved_by_contact_id → contacts.id | uuid | YES |  |  |
| resolved_at | timestamp with time zone | YES |  |  |
| created_at | timestamp with time zone | NO | now() |  |

## contract_change_log

Rows (estimate): 59

| column | type | nullable | default | comment |
|---|---|---|---|---|
| **id** (PK) | uuid | NO | gen_random_uuid() |  |
| org_id → organizations.id | uuid | NO | current_org() |  |
| document_id → documents.id | uuid | NO |  |  |
| change_kind | text | NO |  |  |
| field_key | text | YES |  |  |
| field_label | text | YES |  |  |
| owner_role | text | YES |  |  |
| old_value | text | YES |  |  |
| new_value | text | YES |  |  |
| detail | jsonb | NO | '{}'::jsonb |  |
| actor_contact_id → contacts.id | uuid | YES |  |  |
| actor_label | text | YES |  |  |
| actor_roles | ARRAY | NO | '{}'::text[] |  |
| actor_is_staff | boolean | NO | false |  |
| created_at | timestamp with time zone | NO | now() |  |

## contract_change_request_seen

One row per (entry, viewer) recording a GENUINE view of a change-request entry: who, when, and with what party role. Written only by mark_change_request_seen, which the client calls when a reader EXPANDS the thread — never on collapsed render. An entry stays editable by its author until a row appears here.

Rows (estimate): 0

| column | type | nullable | default | comment |
|---|---|---|---|---|
| **request_id** (PK) → contract_change_requests.id | uuid | NO |  |  |
| **contact_id** (PK) → contacts.id | uuid | NO |  |  |
| org_id → organizations.id | uuid | NO |  |  |
| seen_at | timestamp with time zone | NO | now() |  |
| seen_role | text | YES |  |  |
| seen_label | text | YES |  |  |

## contract_change_requests

The single change-request surface (was contract_comments; document_change_requests retired into it). A ROOT row (parent_request_id IS NULL) is a change request against target_section. submitted_at NULL = a free-to-edit draft that does NOT block locking; submitted_at SET = the thread is locked-on-send and BLOCKS locking until resolved_at (Agreed). Child rows are thread entries, each stamped with author_role/author_label + created_at.

Rows (estimate): 0

| column | type | nullable | default | comment |
|---|---|---|---|---|
| **id** (PK) | uuid | NO | gen_random_uuid() |  |
| org_id → organizations.id | uuid | NO | current_org() |  |
| document_id → documents.id | uuid | NO |  |  |
| parent_request_id → contract_change_requests.id | uuid | YES |  |  |
| anchor_kind | text | NO | 'document'::text |  |
| anchor_ref | text | YES |  |  |
| quote | text | YES |  |  |
| quote_prefix | text | YES |  |  |
| is_stale | boolean | NO | false |  |
| body | text | NO |  |  |
| author_contact_id → contacts.id | uuid | YES |  |  |
| author_role | text | YES |  |  |
| author_label | text | YES |  |  |
| resolved_at | timestamp with time zone | YES |  |  |
| resolved_by_contact_id → contacts.id | uuid | YES |  |  |
| created_at | timestamp with time zone | NO | now() |  |
| updated_at | timestamp with time zone | NO | now() |  |
| needs_review | boolean | NO | false |  |
| edited_at | timestamp with time zone | YES |  |  |
| submitted_at | timestamp with time zone | YES |  |  |
| agreed_at | timestamp with time zone | YES |  |  |
| agreed_by_contact_id → contacts.id | uuid | YES |  |  |
| annotation_number | integer | YES |  |  |
| target_section | text | YES |  |  |
| impact_rank | integer | NO | 0 |  |
| reopened_at | timestamp with time zone | YES |  | Last time this request was reopened after being resolved. Resolution is a SOFT close: either party may reopen, which returns the request to the open set and therefore blocks locking again via contract_lock_blockers. |
| reopened_by_contact_id → contacts.id | uuid | YES |  |  |

## contract_clause_defs

Rows (estimate): 768

| column | type | nullable | default | comment |
|---|---|---|---|---|
| **id** (PK) | uuid | NO | gen_random_uuid() |  |
| template_key | text | NO |  |  |
| section_key | text | NO |  |  |
| clause_key | text | NO |  |  |
| heading | text | YES |  |  |
| body | text | YES |  |  |
| clause_type | text | NO | 'input'::text |  |
| sort_order | integer | NO |  |  |
| is_optional | boolean | NO | false |  |
| cut_name | text | YES |  |  |
| conditional_on | jsonb | YES |  |  |
| guidance | text | YES |  |  |
| created_at | timestamp with time zone | NO | now() |  |
| render_as_subitem | boolean | NO | false |  |
| draft_body | text | YES |  | Unpublished wording edit from the template editor. NULL = no pending edit. Publish copies this into body and clears it; nothing else may read it — remerge_contract_from_clauses reads body only. |

## contract_execution_audit

Rows (estimate): 51

| column | type | nullable | default | comment |
|---|---|---|---|---|
| **id** (PK) | uuid | NO | gen_random_uuid() |  |
| org_id → organizations.id | uuid | NO |  |  |
| document_id → documents.id | uuid | NO |  |  |
| executed_at | timestamp with time zone | NO | now() |  |
| execution_hash | text | YES |  |  |
| merged_body | text | YES |  |  |
| change_log | jsonb | NO | '[]'::jsonb |  |
| comments | jsonb | NO | '[]'::jsonb |  |
| change_count | integer | NO | 0 |  |
| comment_count | integer | NO | 0 |  |
| created_at | timestamp with time zone | NO | now() |  |

## contract_field_defs

Rows (estimate): 667

| column | type | nullable | default | comment |
|---|---|---|---|---|
| **id** (PK) | uuid | NO | gen_random_uuid() |  |
| template_key | text | NO |  |  |
| field_key | text | NO |  |  |
| parent_field_key | text | YES |  |  |
| label | text | NO |  |  |
| section | text | NO |  |  |
| owner_role | text | NO | 'DEAL'::text |  |
| input_kind | text | NO | 'text'::text |  |
| value_type | text | NO | 'text'::text |  |
| options | jsonb | YES |  |  |
| conditional_on | jsonb | YES |  |  |
| guidance | text | YES |  |  |
| required | boolean | NO | false |  |
| is_optional | boolean | NO | false |  |
| responsibility | jsonb | YES |  |  |
| sort_order | integer | NO | 0 |  |
| created_at | timestamp with time zone | NO | now() |  |
| format_type | text | YES |  |  |
| clause_key | text | YES |  |  |
| responsibility_kind | text | YES |  |  |
| closed | boolean | NO | false |  |
| default_value | text | YES |  | Seeded into contract_fields.value when a document is created. NULL = seed blank. Never applied to an existing document - sync_contract_fields_from_defs deliberately leaves values alone, so a default cannot retro-answer a question a party already saw. |

## contract_fields

Structured, party-owned field store for a contract document. owner_role names the party_role that owns/must-fill the field (personal/horse fields → that party; DEAL fields → the originator, and the counterparty only when documents.recipient_editing). All writes go through set_contract_field()/seed_contract_fields() (SECURITY DEFINER) — no direct authenticated DML — so ownership enforcement is centralized.

Rows (estimate): 125

| column | type | nullable | default | comment |
|---|---|---|---|---|
| **id** (PK) | uuid | NO | gen_random_uuid() |  |
| org_id → organizations.id | uuid | NO | current_org() |  |
| document_id → documents.id | uuid | NO |  |  |
| field_key | text | NO |  |  |
| label | text | YES |  |  |
| section | text | YES |  |  |
| owner_role | text | NO |  |  |
| value | text | YES |  |  |
| value_type | text | YES | 'text'::text |  |
| entered_by_contact_id → contacts.id | uuid | YES |  |  |
| entered_at | timestamp with time zone | YES |  |  |
| required | boolean | YES | false |  |
| sort_order | integer | YES | 0 |  |
| created_at | timestamp with time zone | NO | now() |  |
| updated_at | timestamp with time zone | NO | now() |  |
| proposed_value | text | YES |  |  |
| proposed_by_contact_id → contacts.id | uuid | YES |  |  |
| proposed_at | timestamp with time zone | YES |  |  |
| parent_field_key | text | YES |  |  |
| input_kind | text | YES |  |  |
| options | jsonb | YES |  |  |
| conditional_on | jsonb | YES |  |  |
| guidance | text | YES |  |  |
| is_optional | boolean | NO | false |  |
| included | boolean | NO | true |  |
| is_na | boolean | NO | false |  |
| control_override | jsonb | YES |  |  |
| responsibility | jsonb | YES |  |  |
| format_type | text | YES |  |  |
| structured | jsonb | YES |  |  |
| pair_cost_key | text | YES |  |  |
| pair_manage_key | text | YES |  |  |
| clause_key | text | YES |  |  |
| responsibility_kind | text | YES |  |  |
| closed | boolean | NO | false |  |
| custom_kind | text | YES |  | Author-added row kind: section \| header \| line \| element. NULL = a template field, or a legacy custom field from the pre-R11 add surface (still rendered as "Label: value"). |
| body | text | YES |  | Prose of a custom_kind='line' row, with {{CUSTOM.*}} tokens where inline elements sit — the same convention contract_clause_defs.body uses. |
| added_by_contact_id → contacts.id | uuid | YES |  |  |

## contract_formats

Rows (estimate): 26

| column | type | nullable | default | comment |
|---|---|---|---|---|
| **format_type** (PK) | text | NO |  |  |
| label | text | NO |  |  |
| category | text | NO |  |  |
| input_kind | text | NO |  |  |
| guidance | text | YES |  |  |
| validate_hint | text | YES |  |  |
| reusable_as | text | YES |  |  |
| sort_order | integer | NO | 100 |  |

## contract_note_messages

Rows (estimate): 0

| column | type | nullable | default | comment |
|---|---|---|---|---|
| **id** (PK) | uuid | NO | gen_random_uuid() |  |
| org_id | uuid | NO |  |  |
| note_id → contract_notes.id | uuid | NO |  |  |
| author_contact_id → contacts.id | uuid | YES |  |  |
| author_label | text | YES |  |  |
| body | text | NO |  |  |
| created_at | timestamp with time zone | NO | now() |  |
| deleted_at | timestamp with time zone | YES |  |  |

## contract_notes

A titled conversation thread hanging off a contract. Distinct from a change request: a note proposes nothing and has no resolution lifecycle — it is a contained space for the parties to talk. The title is author-editable and defaults to "Note N".

Rows (estimate): 13

| column | type | nullable | default | comment |
|---|---|---|---|---|
| **id** (PK) | uuid | NO | gen_random_uuid() |  |
| org_id | uuid | NO |  |  |
| document_id → documents.id | uuid | NO |  |  |
| title | text | NO |  |  |
| created_by_contact_id → contacts.id | uuid | YES |  |  |
| created_at | timestamp with time zone | NO | now() |  |
| updated_at | timestamp with time zone | NO | now() |  |
| deleted_at | timestamp with time zone | YES |  |  |

## contract_parties

Rows (estimate): 2

| column | type | nullable | default | comment |
|---|---|---|---|---|
| **id** (PK) | uuid | NO | gen_random_uuid() |  |
| contract_id → contracts.id | uuid | NO |  |  |
| contact_id → contacts.id | uuid | NO |  |  |
| party_role | text | NO |  |  |
| relationship | text | YES |  |  |
| title | text | YES |  |  |
| is_signer | boolean | NO | false |  |
| signer_order | integer | YES |  |  |
| can_fill | boolean | NO | false |  |
| can_edit_deal | boolean | NO | false |  |
| can_suggest | boolean | NO | false |  |
| org_id → organizations.id | uuid | NO | current_org() |  |
| created_at | timestamp with time zone | NO | now() |  |

## contract_pending_compositions

Rows (estimate): 0

| column | type | nullable | default | comment |
|---|---|---|---|---|
| **id** (PK) | uuid | NO | gen_random_uuid() |  |
| org_id → organizations.id | uuid | NO | current_org() |  |
| document_id → documents.id | uuid | NO |  |  |
| spec | jsonb | NO |  |  |
| proposed_by_contact_id → contacts.id | uuid | YES |  |  |
| proposed_by_role | text | YES |  |  |
| status | text | NO | 'open'::text |  |
| resolved_by_contact_id → contacts.id | uuid | YES |  |  |
| resolved_at | timestamp with time zone | YES |  |  |
| created_at | timestamp with time zone | NO | now() |  |

## contract_requirements

Rows (estimate): 36

| column | type | nullable | default | comment |
|---|---|---|---|---|
| **id** (PK) | uuid | NO | gen_random_uuid() |  |
| service_type → service_types.code | text | NO |  |  |
| template_key → contract_templates.template_key | text | NO |  |  |
| created_at | timestamp with time zone | NO | now() |  |
| org_id → organizations.id | uuid | NO | current_org() |  |

## contract_role_documents

Rows (estimate): 12

| column | type | nullable | default | comment |
|---|---|---|---|---|
| **id** (PK) | uuid | NO | gen_random_uuid() |  |
| org_id | uuid | NO |  |  |
| doc_role | text | NO |  |  |
| template_key | text | NO |  |  |
| active | boolean | NO | true |  |
| retired_reason | text | YES |  |  |

## contract_section_defs

Rows (estimate): 117

| column | type | nullable | default | comment |
|---|---|---|---|---|
| **id** (PK) | uuid | NO | gen_random_uuid() |  |
| template_key | text | NO |  |  |
| section_key | text | NO |  |  |
| heading | text | NO |  |  |
| sort_order | integer | NO |  |  |
| is_optional | boolean | NO | false |  |
| cut_name | text | YES |  |  |
| guidance | text | YES |  |  |
| created_at | timestamp with time zone | NO | now() |  |

## contract_template_versions

One row per contract template version, retained in full. The latest is the live one; every earlier version is a non-functional fully retained copy. Append-only.

Rows (estimate): 26

| column | type | nullable | default | comment |
|---|---|---|---|---|
| **id** (PK) | uuid | NO | gen_random_uuid() |  |
| template_key | text | NO |  |  |
| version | integer | NO |  |  |
| title | text | NO |  |  |
| body | text | YES |  |  |
| composition | jsonb | YES |  | sections / clauses / fields as they stood at this version. NULL only for a template that has no composition rows at all. |
| parent_version | integer | YES |  | The version this one was edited FROM. NULL = the immediately preceding version (the ordinary case). Never points forward. |
| edited_by → profiles.user_id | uuid | YES |  |  |
| created_at | timestamp with time zone | NO | now() |  |

## contract_templates

Rows (estimate): 26

| column | type | nullable | default | comment |
|---|---|---|---|---|
| **id** (PK) | uuid | NO | gen_random_uuid() |  |
| template_key | text | NO |  |  |
| title | text | NO |  |  |
| service_type → service_types.code | text | YES |  |  |
| party_namespaces | ARRAY | NO | '{}'::text[] |  |
| body | text | YES |  |  |
| version | integer | NO | 1 |  |
| active | boolean | NO | true |  |
| created_at | timestamp with time zone | NO | now() |  |
| updated_at | timestamp with time zone | NO | now() |  |
| deleted_at | timestamp with time zone | YES |  |  |
| deleted_by → profiles.user_id | uuid | YES |  |  |
| wall_gating | boolean | NO | false |  |
| contract_kind | text | YES |  | What the template IS, independent of its template_key string or version. Functions that need to know "is this a lease" must check this, never the literal key — HORSE_LEASE_V2 broke five functions still hardcoded to the v1 key string. |
| short_label | text | YES |  | OPTIONAL shorter name for a signing-set step or picker chip. Not a registry every template must appear in: readers resolve coalesce(short_label, title), so a template that is never given one is named by its title, and a title edited later flows through. |
| show_comments | boolean | NO | true |  |
| show_change_requests | boolean | NO | true | Whether the Requests drawer appears. FALSE for standard-form documents nobody negotiates. |
| show_history | boolean | NO | true |  |
| show_party_controls | boolean | NO | true | Whether the per-party can_fill / can_edit_deal / can_suggest card appears. |
| allows_co_buyer | boolean | NO | false |  |
| companion_template_key → contract_templates.template_key | text | YES |  | A document this one can generate alongside itself (HORSE_SALE_V2 -> HORSE_BILL_OF_SALE). |
| draft_body | text | YES |  | Unpublished body edit for FLAT (non-clause-composed) templates. NULL = no pending edit. Publish copies this into body, bumps version and clears it. |
| onboarding_order | integer | YES |  | Running order on the onboarding flow (low first; NULL sorts last). The order a member meets their paperwork in — was a hardcoded array in generate_my_onboarding_documents and my_onboarding_state until 2026-08-24. |

## contracts

Rows (estimate): 1

| column | type | nullable | default | comment |
|---|---|---|---|---|
| **id** (PK) | uuid | NO | gen_random_uuid() |  |
| display_code | text | YES |  |  |
| org_id → organizations.id | uuid | NO | current_org() |  |
| status | text | NO | 'draft'::text |  |
| segment | text | YES |  |  |
| title | text | YES |  |  |
| horse_id_retired_20260826 → horses.id | uuid | YES |  | RETIRED 2026-08-26. The contract's horse is derived from documents.horse_id via contract_horse_id(). This column held a copy written only at creation and never updated, so it drifted (it said "Tiz Love" while the document said "Sundance"). Renamed rather than dropped so an unknown reader fails loudly instead of serving a stale horse. Safe to drop once a deploy has passed with no errors naming it. |
| purchase_id → purchases.id | uuid | YES |  |  |
| originator_contact_id → contacts.id | uuid | YES |  |  |
| effective_date | date | YES |  |  |
| lease_start | date | YES |  |  |
| lease_end | date | YES |  |  |
| terms | jsonb | NO | '{}'::jsonb |  |
| notes | text | YES |  |  |
| signed_at | timestamp with time zone | YES |  |  |
| created_at | timestamp with time zone | NO | now() |  |
| updated_at | timestamp with time zone | NO | now() |  |
| deleted_at | timestamp with time zone | YES |  |  |
| deleted_by → profiles.user_id | uuid | YES |  |  |

## cost_allocation_rules

Rows (estimate): 0

| column | type | nullable | default | comment |
|---|---|---|---|---|
| **id** (PK) | uuid | NO | gen_random_uuid() |  |
| org_id → organizations.id | uuid | NO | current_org() |  |
| scope | text | NO |  |  |
| scope_id | uuid | YES |  |  |
| payer_contact_id → contacts.id | uuid | NO |  |  |
| share_pct | numeric | NO | 100 |  |
| effective_from | date | YES |  |  |
| effective_to | date | YES |  |  |
| created_at | timestamp with time zone | NO | now() |  |
| updated_at | timestamp with time zone | NO | now() |  |
| deleted_at | timestamp with time zone | YES |  |  |
| deleted_by → profiles.user_id | uuid | YES |  |  |

## deals

The deal envelope — the top-level object a transaction lives in. Owns one `contracts` spine row (documents attach there); party members live in contract_parties on that spine; what each side gives lives in deal_consideration. deal_type is chosen FIRST and labels the parties (SALE → seller/buyer, LEASE → lessor/lessee).

Rows (estimate): 1

| column | type | nullable | default | comment |
|---|---|---|---|---|
| **id** (PK) | uuid | NO | gen_random_uuid() |  |
| display_code | text | YES |  |  |
| org_id → organizations.id | uuid | NO | current_org() |  |
| contract_id → contracts.id | uuid | NO |  |  |
| deal_type | text | NO |  |  |
| status | text | NO | 'pending'::text |  |
| completed_at | timestamp with time zone | YES |  |  |
| notes | text | YES |  |  |
| created_by_contact_id → contacts.id | uuid | YES |  |  |
| created_at | timestamp with time zone | NO | now() |  |
| updated_at | timestamp with time zone | NO | now() |  |
| deleted_at | timestamp with time zone | YES |  |  |
| deleted_by | uuid | YES |  |  |
| title | text | YES |  | The name the user gives this deal. A deal is a blank named container — what it reports comes from the documents inside it, not from fields on the deal. |

## direct_messages

Rows (estimate): 0

| column | type | nullable | default | comment |
|---|---|---|---|---|
| **id** (PK) | uuid | NO | gen_random_uuid() |  |
| sender_id | uuid | NO |  |  |
| recipient_id | uuid | NO |  |  |
| body | text | NO |  |  |
| read_at | timestamp with time zone | YES |  |  |
| created_at | timestamp with time zone | NO | now() |  |
| org_id → organizations.id | uuid | NO | current_org() |  |
| edited_at | timestamp with time zone | YES |  |  |
| deleted_at | timestamp with time zone | YES |  |  |

## dm_hidden_conversations

Rows (estimate): 0

| column | type | nullable | default | comment |
|---|---|---|---|---|
| **user_id** (PK) | uuid | NO |  |  |
| **other_id** (PK) | uuid | NO |  |  |
| hidden_before | timestamp with time zone | NO | now() |  |

## document_data_requirements

THE registry of record fields that signable documents depend on. One row per field, derived from the tokens those documents actually use. Read by the intake forms (to warn), the record surfaces (to mark required) and the dashboard (to notify) — so all three agree by construction rather than by three hand-maintained lists drifting apart.

Rows (estimate): 23

| column | type | nullable | default | comment |
|---|---|---|---|---|
| **id** (PK) | uuid | NO | gen_random_uuid() |  |
| subject | text | NO |  |  |
| column_name | text | NO |  |  |
| label | text | NO |  |  |
| needed_for | ARRAY | NO | '{}'::text[] |  |
| sort_order | integer | NO | 100 |  |
| active | boolean | NO | true |  |

## document_deliveries

Rows (estimate): 79

| column | type | nullable | default | comment |
|---|---|---|---|---|
| **id** (PK) | uuid | NO | gen_random_uuid() |  |
| document_id → documents.id | uuid | NO |  |  |
| recipient_contact_id → contacts.id | uuid | YES |  |  |
| channel | text | NO | 'PORTAL'::text |  |
| copy_url | text | YES |  |  |
| delivered_at | timestamp with time zone | NO | now() |  |
| created_at | timestamp with time zone | NO | now() |  |
| deleted_at | timestamp with time zone | YES |  |  |
| deleted_by → profiles.user_id | uuid | YES |  |  |
| is_mirror | boolean | NO | false |  |

## document_delivery_holds

ONBOARD §4: an open row means "this person is mid-signing-run — hold their executed document emails so the run ends in ONE email". Opened by the flow that knows a run is starting, released when the set is delivered (or by the backstop sweep). Keyed by contact when known and by email otherwise, because /api/sign-release opens the hold before the contact row exists.

Rows (estimate): 1

| column | type | nullable | default | comment |
|---|---|---|---|---|
| **id** (PK) | uuid | NO | gen_random_uuid() |  |
| org_id → organizations.id | uuid | YES |  |  |
| contact_id → contacts.id | uuid | YES |  |  |
| email | text | YES |  |  |
| source | text | NO |  |  |
| opened_at | timestamp with time zone | NO | now() |  |
| released_at | timestamp with time zone | YES |  |  |

## document_horses

Ordered set of horses a document names. Position 1 mirrors documents.horse_id (the primary). A single-horse document has exactly one row here, so all existing documents.horse_id readers are unaffected.

Rows (estimate): 18

| column | type | nullable | default | comment |
|---|---|---|---|---|
| **id** (PK) | uuid | NO | gen_random_uuid() |  |
| org_id → organizations.id | uuid | NO | current_org() |  |
| document_id → documents.id | uuid | NO |  |  |
| horse_id → horses.id | uuid | NO |  |  |
| position | integer | NO | 1 |  |
| created_at | timestamp with time zone | NO | now() |  |

## document_opened

One row per (document, viewer) recording that this person actually OPENED and rendered the document body. Written only by mark_document_opened. This is the freeze trigger for CHANGES (field edits): an author may keep editing the document until a counterparty has opened it.

Rows (estimate): 1

| column | type | nullable | default | comment |
|---|---|---|---|---|
| **document_id** (PK) → documents.id | uuid | NO |  |  |
| **contact_id** (PK) → contacts.id | uuid | NO |  |  |
| org_id → organizations.id | uuid | NO |  |  |
| opened_at | timestamp with time zone | NO | now() |  |
| opened_role | text | YES |  |  |
| opened_label | text | YES |  |  |

## document_parties

Rows (estimate): 108

| column | type | nullable | default | comment |
|---|---|---|---|---|
| **id** (PK) | uuid | NO | gen_random_uuid() |  |
| document_id → documents.id | uuid | NO |  |  |
| contact_id → contacts.id | uuid | NO |  |  |
| party_role | text | NO |  |  |
| relationship | text | YES |  |  |
| title | text | YES |  |  |
| is_signer | boolean | NO | false |  |
| signer_order | integer | YES |  |  |
| org_id → organizations.id | uuid | NO | current_org() |  |
| created_at | timestamp with time zone | NO | now() |  |

## document_party_archives

Rows (estimate): 0

| column | type | nullable | default | comment |
|---|---|---|---|---|
| **document_id** (PK) → documents.id | uuid | NO |  |  |
| **contact_id** (PK) | uuid | NO |  |  |
| org_id | uuid | NO |  |  |
| archived_at | timestamp with time zone | NO | now() |  |

## document_party_controls

Rows (estimate): 2

| column | type | nullable | default | comment |
|---|---|---|---|---|
| **document_id** (PK) → documents.id | uuid | NO |  |  |
| **party_role** (PK) | text | NO |  |  |
| can_fill | boolean | NO | true |  |
| can_edit_deal | boolean | NO | false |  |
| can_suggest | boolean | NO | false |  |
| org_id | uuid | NO | current_org() |  |
| can_add_clause | boolean | NO | false |  |

## document_party_hidden

Per-party visibility flag. A row hides the document from THAT contact's documents page only; the document row itself is never deleted and stays visible to every other party and to staff/ops.

Rows (estimate): 0

| column | type | nullable | default | comment |
|---|---|---|---|---|
| **document_id** (PK) → documents.id | uuid | NO |  |  |
| **contact_id** (PK) → contacts.id | uuid | NO |  |  |
| org_id → organizations.id | uuid | NO |  |  |
| hidden_at | timestamp with time zone | NO | now() |  |

## document_shares

Party-to-party access grant on a contract, recording the editing permission. share_document() creates/updates it, mirrors recipient_editing onto documents, and notifies the recipient. Parties read; writes are SECURITY DEFINER only.

Rows (estimate): 0

| column | type | nullable | default | comment |
|---|---|---|---|---|
| **id** (PK) | uuid | NO | gen_random_uuid() |  |
| org_id → organizations.id | uuid | NO | current_org() |  |
| document_id → documents.id | uuid | NO |  |  |
| shared_with_contact_id → contacts.id | uuid | NO |  |  |
| granted_by_contact_id → contacts.id | uuid | YES |  |  |
| recipient_editing | boolean | NO | false |  |
| notified_at | timestamp with time zone | YES |  |  |
| created_at | timestamp with time zone | NO | now() |  |

## document_status

Rows (estimate): 4

| column | type | nullable | default | comment |
|---|---|---|---|---|
| **code** (PK) | text | NO |  |  |
| display_name | text | NO |  |  |
| is_terminal | boolean | NO | false |  |
| sort_order | integer | NO | 0 |  |

## documents

Rows (estimate): 72

| column | type | nullable | default | comment |
|---|---|---|---|---|
| **id** (PK) | uuid | NO | gen_random_uuid() |  |
| display_code | text | YES |  |  |
| template_id → contract_templates.id | uuid | YES |  |  |
| title | text | YES |  |  |
| merged_body | text | YES |  |  |
| status → document_status.code | text | NO | 'DRAFT'::text |  |
| generated_at | timestamp with time zone | NO | now() |  |
| effective_date | date | YES |  |  |
| created_at | timestamp with time zone | NO | now() |  |
| updated_at | timestamp with time zone | NO | now() |  |
| deleted_at | timestamp with time zone | YES |  |  |
| deleted_by → profiles.user_id | uuid | YES |  |  |
| org_id → organizations.id | uuid | NO | current_org() |  |
| execution_hash | text | YES |  | SHA-256 over the final merged_body + sealing signature fields (signer contact id, typed_name, signed_at), hex. Stamped once at the EXECUTED flip; NULL for drafts and for documents executed before 20260703110000. |
| workflow_state | text | NO | 'editable'::text | Finer multi-party workflow layer beside status (DRAFT..EXECUTED). editable→editing→in_review→locked→executed, plus void. Executed is reached ONLY through record_signature (v6 sets it at the EXECUTED flip); advance_document_workflow rejects a manual →executed. |
| recipient_editing | boolean | NO | false | Whether the NON-originating party may edit DEAL fields / body (vs only their own personal fields). Mirrored from the active document_shares row; toggled by set_recipient_editing / share_document. |
| originator_contact_id → contacts.id | uuid | YES |  | The party who started this contract (always "us"/the initiating client — e.g. the LESSEE on a LEASE_IN). The originator always owns DEAL fields; the counterparty may touch them only when recipient_editing is true. |
| horse_section_confirmed_at | timestamp with time zone | YES |  |  |
| horse_section_confirmed_by → contacts.id | uuid | YES |  |  |
| contact_id → contacts.id | uuid | YES |  |  |
| horse_id → horses.id | uuid | YES |  |  |
| contract_id → contracts.id | uuid | YES |  |  |
| sign_sequence | integer | YES |  |  |
| sent_at | timestamp with time zone | YES |  |  |
| archived_at | timestamp with time zone | YES |  |  |
| archived_by → contacts.id | uuid | YES |  |  |
| terminated_at | timestamp with time zone | YES |  |  |
| terminated_by | uuid | YES |  |  |
| termination_requested_at | timestamp with time zone | YES |  |  |
| termination_requested_by | uuid | YES |  |  |
| termination_request_reason | text | YES |  |  |
| current_status | text | YES |  |  |
| voided_at | timestamp with time zone | YES |  |  |
| voided_by → contacts.id | uuid | YES |  |  |
| void_reason | text | YES |  | The voiding party's note to the other party ("why I am no longer interested"). Shown to the counterparty in their notification and on the voided document. |
| signed_template_version | integer | YES |  | The contract_templates.version in force WHEN THIS DOCUMENT WAS SIGNED, frozen at signature time. Templates are edited in place (one row per key, version bumped), so template_id alone cannot tell you what the signer actually read — an old signature would inherit the new number. This column is the evidence. |
| signatures_voided_at | timestamp with time zone | YES |  | When an edit last invalidated one or more signatures on this document. Cleared when the document is next sent for review, which is when the affected parties are told — an author edits in bursts and may revert, so alerting on each field change would make the alert meaningless. |
| signatures_voided_roles | ARRAY | YES |  |  |
| executed_email_sent_at | timestamp with time zone | YES |  | When the executed-copy email was dispatched. NULL = not sent (UI offers SEND); set = sent (UI offers RESEND). |
| executed_email_error | text | YES |  | Last dispatch failure, surfaced to staff so a silent non-delivery is impossible. |
| delivery_held_at | timestamp with time zone | YES |  | ONBOARD §4: set when an executed document is deliberately NOT emailed yet because its signer is mid-signing-run. Cleared when the set goes out as one email. NULL on every pre-existing row, which is what keeps the flush away from history. |

## email_template_versions

TASK-SURFACEEDITOR: the retained history of every email template. Append-only; the history holds EVERY version including the live one (TASK-VERSIONSPINE §5.1's settled storage rule).

Rows (estimate): 24

| column | type | nullable | default | comment |
|---|---|---|---|---|
| **id** (PK) | uuid | NO | gen_random_uuid() |  |
| template_id → email_templates.id | uuid | NO |  |  |
| email_key | text | NO |  |  |
| version | integer | NO |  |  |
| parent_version | integer | YES |  | The version this one was edited FROM. NULL = the immediately preceding version (the ordinary case). Never points forward. |
| title | text | NO |  |  |
| subject | text | NO |  |  |
| body | text | NO |  |  |
| edited_by | uuid | YES |  |  |
| created_at | timestamp with time zone | NO | now() |  |

## email_templates

Rows (estimate): 24

| column | type | nullable | default | comment |
|---|---|---|---|---|
| **id** (PK) | uuid | NO | gen_random_uuid() |  |
| email_key | text | NO |  |  |
| title | text | NO |  |  |
| description | text | YES |  |  |
| category | text | NO | 'GENERAL'::text |  |
| subject | text | NO | ''::text |  |
| body | text | NO | ''::text |  |
| draft_subject | text | YES |  |  |
| draft_body | text | YES |  |  |
| from_address_rule | text | NO | 'tenant'::text |  |
| reply_to_rule | text | NO | 'none'::text |  |
| recipient_note | text | YES |  |  |
| transactional | boolean | NO | true |  |
| version | integer | NO | 1 |  |
| active | boolean | NO | true |  |
| created_at | timestamp with time zone | NO | now() |  |
| updated_at | timestamp with time zone | NO | now() |  |
| deleted_at | timestamp with time zone | YES |  |  |
| deleted_by → profiles.user_id | uuid | YES |  |  |

## esign_consents

Consent-to-electronic-transaction log (UETA/ESIGN): one row per affirmative consent event, with session attribution. Inserted only by the SECURITY DEFINER signing RPCs; staff read; org-bounded like signatures.

Rows (estimate): 71

| column | type | nullable | default | comment |
|---|---|---|---|---|
| **id** (PK) | uuid | NO | gen_random_uuid() |  |
| org_id → organizations.id | uuid | NO | current_org() |  |
| contact_id → contacts.id | uuid | NO |  |  |
| document_id → documents.id | uuid | YES |  |  |
| kind | text | NO | 'ESIGN_CONSENT'::text |  |
| consented_at | timestamp with time zone | NO | now() |  |
| ip_address | text | YES |  |  |
| user_agent | text | YES |  |  |

## evaluation_report_access

Rows (estimate): 0

| column | type | nullable | default | comment |
|---|---|---|---|---|
| **id** (PK) | uuid | NO | gen_random_uuid() |  |
| org_id | uuid | NO | current_org() |  |
| report_id → evaluation_reports.id | uuid | NO |  |  |
| actor_user_id | uuid | YES |  |  |
| action | text | NO |  |  |
| detail | text | YES |  |  |
| created_at | timestamp with time zone | NO | now() |  |

## evaluation_report_shares

Rows (estimate): 0

| column | type | nullable | default | comment |
|---|---|---|---|---|
| **id** (PK) | uuid | NO | gen_random_uuid() |  |
| org_id | uuid | NO | current_org() |  |
| report_id → evaluation_reports.id | uuid | NO |  |  |
| shared_with_contact_id → contacts.id | uuid | YES |  |  |
| shared_with_email | text | YES |  |  |
| shared_by | uuid | YES |  |  |
| created_at | timestamp with time zone | NO | now() |  |

## evaluation_reports

Rows (estimate): 0

| column | type | nullable | default | comment |
|---|---|---|---|---|
| **id** (PK) | uuid | NO | gen_random_uuid() |  |
| org_id | uuid | NO | current_org() |  |
| contact_id → contacts.id | uuid | NO |  |  |
| purchase_item_id → purchase_items.id | uuid | YES |  |  |
| horse_id → horses.id | uuid | YES |  |  |
| horse_label | text | YES |  |  |
| title | text | NO | 'Horse Evaluation Report'::text |  |
| body | text | YES |  |  |
| status | text | NO | 'draft'::text |  |
| delivered_at | timestamp with time zone | YES |  |  |
| available_until | timestamp with time zone | YES |  |  |
| created_at | timestamp with time zone | NO | now() |  |
| created_by | uuid | YES |  |  |
| updated_at | timestamp with time zone | NO | now() |  |
| deleted_at | timestamp with time zone | YES |  |  |

## event_rsvps

Rows (estimate): 0

| column | type | nullable | default | comment |
|---|---|---|---|---|
| **event_id** (PK) → events.id | uuid | NO |  |  |
| **user_id** (PK) | uuid | NO |  |  |
| status | text | NO | 'going'::text |  |
| created_at | timestamp with time zone | NO | now() |  |
| org_id → organizations.id | uuid | NO | current_org() |  |

## events

Rows (estimate): 0

| column | type | nullable | default | comment |
|---|---|---|---|---|
| **id** (PK) | uuid | NO | gen_random_uuid() |  |
| title | text | NO |  |  |
| description | text | YES |  |  |
| starts_at | timestamp with time zone | NO |  |  |
| ends_at | timestamp with time zone | YES |  |  |
| location | text | YES |  |  |
| capacity | integer | YES |  |  |
| published | boolean | NO | true |  |
| created_at | timestamp with time zone | NO | now() |  |
| org_id → organizations.id | uuid | NO | current_org() |  |

## facilities

Rows (estimate): 0

| column | type | nullable | default | comment |
|---|---|---|---|---|
| **id** (PK) | uuid | NO | gen_random_uuid() |  |
| org_id → organizations.id | uuid | NO | current_org() |  |
| name | text | NO |  |  |
| address_value_key | text | YES |  |  |
| created_at | timestamp with time zone | NO | now() |  |
| updated_at | timestamp with time zone | NO | now() |  |
| deleted_at | timestamp with time zone | YES |  |  |
| deleted_by → profiles.user_id | uuid | YES |  |  |

## feed_account_items

Rows (estimate): 0

| column | type | nullable | default | comment |
|---|---|---|---|---|
| **id** (PK) | uuid | NO | gen_random_uuid() |  |
| org_id | uuid | NO |  |  |
| user_id → profiles.user_id | uuid | NO |  |  |
| kind | text | NO |  |  |
| title | text | YES |  |  |
| body | text | YES |  |  |
| payload | jsonb | NO | '{}'::jsonb |  |
| resolved | boolean | NO | false |  |
| created_at | timestamp with time zone | NO | now() |  |
| publish_at | timestamp with time zone | NO | now() |  |

## feed_posts

Rows (estimate): 34

| column | type | nullable | default | comment |
|---|---|---|---|---|
| **id** (PK) | uuid | NO | gen_random_uuid() |  |
| org_id | uuid | NO |  |  |
| author_id → profiles.user_id | uuid | YES |  |  |
| as_company | boolean | NO | false |  |
| post_type | USER-DEFINED | NO |  |  |
| media_url | text | YES |  |  |
| media_kind | USER-DEFINED | YES |  |  |
| body | text | YES |  |  |
| source_link | text | YES |  |  |
| subject_horse_id → horses.id | uuid | YES |  |  |
| visibility | USER-DEFINED | NO | 'members'::feed_visibility |  |
| scan_state | USER-DEFINED | NO | 'clean'::feed_scan_state |  |
| pulled_down | boolean | NO | false |  |
| reported_reason | text | YES |  |  |
| published | boolean | NO | false |  |
| publish_at | timestamp with time zone | NO | now() |  |
| created_at | timestamp with time zone | NO | now() |  |
| updated_at | timestamp with time zone | NO | now() |  |

## feed_seen

Rows (estimate): 44

| column | type | nullable | default | comment |
|---|---|---|---|---|
| **user_id** (PK) → profiles.user_id | uuid | NO |  |  |
| **post_id** (PK) → feed_posts.id | uuid | NO |  |  |
| seen_at | timestamp with time zone | NO | now() |  |

## feed_shares

Rows (estimate): 0

| column | type | nullable | default | comment |
|---|---|---|---|---|
| **id** (PK) | uuid | NO | gen_random_uuid() |  |
| org_id | uuid | NO |  |  |
| post_id → feed_posts.id | uuid | NO |  |  |
| from_user_id → profiles.user_id | uuid | NO |  |  |
| to_user_id → profiles.user_id | uuid | NO |  |  |
| created_at | timestamp with time zone | NO | now() |  |

## feed_view_pref

Rows (estimate): 0

| column | type | nullable | default | comment |
|---|---|---|---|---|
| **user_id** (PK) → profiles.user_id | uuid | NO |  |  |
| shape | USER-DEFINED | NO | 'blended'::feed_view_shape |  |
| updated_at | timestamp with time zone | NO | now() |  |

## file_links

Rows (estimate): 2

| column | type | nullable | default | comment |
|---|---|---|---|---|
| **id** (PK) | uuid | NO | gen_random_uuid() |  |
| org_id → organizations.id | uuid | NO | current_org() |  |
| file_id → files.id | uuid | NO |  |  |
| subject_type | text | NO |  |  |
| subject_id | uuid | NO |  |  |
| created_by_user_id | uuid | YES | auth.uid() |  |
| created_at | timestamp with time zone | NO | now() |  |
| deleted_at | timestamp with time zone | YES |  |  |

## files

Rows (estimate): 2

| column | type | nullable | default | comment |
|---|---|---|---|---|
| **id** (PK) | uuid | NO | gen_random_uuid() |  |
| org_id → organizations.id | uuid | NO | current_org() |  |
| owner_kind | text | NO |  |  |
| owner_contact_id → contacts.id | uuid | YES |  |  |
| bucket_id | text | NO | 'facility-files'::text |  |
| storage_path | text | NO |  |  |
| filename | text | NO |  |  |
| mime_type | text | YES |  |  |
| byte_size | bigint | YES |  |  |
| title | text | YES |  |  |
| description | text | YES |  |  |
| uploaded_by_user_id | uuid | YES | auth.uid() |  |
| created_at | timestamp with time zone | NO | now() |  |
| deleted_at | timestamp with time zone | YES |  |  |

## form_definition_versions

One row per PUBLISHED version of a form schema. Written by snapshot_form_definition before any edit, so the shape an answer set was collected under is always retrievable. booking_forms.form_version names the row that applies.

Rows (estimate): 28

| column | type | nullable | default | comment |
|---|---|---|---|---|
| **id** (PK) | uuid | NO | gen_random_uuid() |  |
| form_key | text | NO |  |  |
| version | integer | NO |  |  |
| title | text | NO |  |  |
| audience | text | NO |  |  |
| purpose | text | YES |  |  |
| schema | jsonb | NO |  |  |
| edited_by | uuid | YES |  |  |
| created_at | timestamp with time zone | NO | now() |  |
| parent_version | integer | YES |  | The version this one was edited FROM. NULL = the immediately preceding version (the ordinary case). Never points forward. |

## form_definitions

Rows (estimate): 28

| column | type | nullable | default | comment |
|---|---|---|---|---|
| **id** (PK) | uuid | NO | gen_random_uuid() |  |
| form_key | text | NO |  |  |
| audience | text | NO |  |  |
| title | text | NO |  |  |
| purpose | text | YES |  |  |
| schema | jsonb | NO |  |  |
| version | integer | NO | 1 |  |
| active | boolean | NO | true |  |
| created_at | timestamp with time zone | NO | now() |  |
| updated_at | timestamp with time zone | NO | now() |  |

## fulfillment_units

Rows (estimate): 26

| column | type | nullable | default | comment |
|---|---|---|---|---|
| **id** (PK) | uuid | NO | gen_random_uuid() |  |
| org_id | uuid | NO |  |  |
| purchase_id → purchases.id | uuid | NO |  |  |
| purchase_item_id → purchase_items.id | uuid | NO |  |  |
| unit_kind | text | NO |  |  |
| seq | integer | NO | 1 |  |
| label | text | YES |  |  |
| booking_id → bookings.id | uuid | YES |  |  |
| document_id → documents.id | uuid | YES |  |  |
| report_id → evaluation_reports.id | uuid | YES |  |  |
| period_start | date | YES |  |  |
| period_end | date | YES |  |  |
| current_status | text | NO | 'open'::text |  |
| consumed_at | timestamp with time zone | YES |  |  |
| created_at | timestamp with time zone | NO | now() |  |
| deleted_at | timestamp with time zone | YES |  |  |

## gifts

Rows (estimate): 0

| column | type | nullable | default | comment |
|---|---|---|---|---|
| **id** (PK) | uuid | NO | gen_random_uuid() |  |
| code | text | NO |  |  |
| item_type | text | NO |  |  |
| item_label | text | NO |  |  |
| amount | numeric | YES |  |  |
| buyer_name | text | YES |  |  |
| buyer_email | text | YES |  |  |
| buyer_user_id | uuid | YES |  |  |
| order_id | uuid | YES |  |  |
| recipient_name | text | YES |  |  |
| recipient_email | text | YES |  |  |
| gift_message | text | YES |  |  |
| status | text | NO | 'created'::text |  |
| unlock_gate | text | NO | 'none'::text |  |
| unlocked | boolean | NO | false |  |
| opened_at | timestamp with time zone | YES |  |  |
| redeemed_at | timestamp with time zone | YES |  |  |
| redeemed_user_id | uuid | YES |  |  |
| expires_at | timestamp with time zone | YES |  |  |
| created_at | timestamp with time zone | NO | now() |  |
| org_id → organizations.id | uuid | NO | current_org() |  |
| deliver_on | date | YES |  |  |
| last_sent_at | timestamp with time zone | YES |  |  |
| send_count | integer | NO | 0 |  |
| transferred_from_email | text | YES |  |  |
| offering_id → offerings.id | uuid | YES |  |  |

## group_members

Rows (estimate): 0

| column | type | nullable | default | comment |
|---|---|---|---|---|
| **group_id** (PK) → member_groups.id | uuid | NO |  |  |
| **user_id** (PK) | uuid | NO |  |  |
| role | text | NO | 'member'::text |  |
| joined_at | timestamp with time zone | NO | now() |  |
| org_id → organizations.id | uuid | NO | current_org() |  |

## groups

Rows (estimate): 27

| column | type | nullable | default | comment |
|---|---|---|---|---|
| **id** (PK) | uuid | NO | gen_random_uuid() |  |
| contact_id → contacts.id | uuid | NO |  |  |
| group_type | text | NO |  |  |
| title | text | YES |  |  |
| created_at | timestamp with time zone | NO | now() |  |

## horse_breeds

Rows (estimate): 16

| column | type | nullable | default | comment |
|---|---|---|---|---|
| **code** (PK) | text | NO |  |  |
| display_name | text | NO |  |  |
| active | boolean | NO | true |  |
| sort_order | integer | NO | 0 |  |

## horse_colors

Rows (estimate): 14

| column | type | nullable | default | comment |
|---|---|---|---|---|
| **code** (PK) | text | NO |  |  |
| display_name | text | NO |  |  |
| active | boolean | NO | true |  |
| sort_order | integer | NO | 0 |  |

## horse_contract_locations

Rows (estimate): 0

| column | type | nullable | default | comment |
|---|---|---|---|---|
| **id** (PK) | uuid | NO | gen_random_uuid() |  |
| org_id → organizations.id | uuid | NO | current_org() |  |
| horse_id → horses.id | uuid | NO |  |  |
| location_id → locations.id | uuid | NO |  |  |
| starts_on | date | YES |  |  |
| ends_on | date | YES |  |  |
| source_document_id → documents.id | uuid | YES |  |  |
| active | boolean | NO | true |  |
| created_at | timestamp with time zone | NO | now() |  |
| created_by_contact_id → contacts.id | uuid | YES |  |  |

## horse_health_events

Rows (estimate): 0

| column | type | nullable | default | comment |
|---|---|---|---|---|
| **id** (PK) | uuid | NO | gen_random_uuid() |  |
| org_id → organizations.id | uuid | NO | current_org() |  |
| horse_id → horses.id | uuid | NO |  |  |
| event_type | text | NO |  |  |
| occurred_at | timestamp with time zone | NO | now() |  |
| provider_contact_id → contacts.id | uuid | YES |  |  |
| next_due | date | YES |  |  |
| notes | text | YES |  |  |
| document_id → documents.id | uuid | YES |  |  |
| created_at | timestamp with time zone | NO | now() |  |
| updated_at | timestamp with time zone | NO | now() |  |
| deleted_at | timestamp with time zone | YES |  |  |
| deleted_by → profiles.user_id | uuid | YES |  |  |

## horse_medications

Rows (estimate): 3

| column | type | nullable | default | comment |
|---|---|---|---|---|
| **id** (PK) | uuid | NO | gen_random_uuid() |  |
| org_id | uuid | NO |  |  |
| horse_id → horses.id | uuid | NO |  |  |
| kind | text | NO | 'MEDICATION'::text |  |
| sort_order | integer | NO | 0 |  |
| name | text | YES |  |  |
| dosage | text | YES |  |  |
| instructions | text | YES |  |  |
| cost | numeric | YES |  |  |
| supplier_website | text | YES |  |  |
| supplier_phone | text | YES |  |  |
| rx_info | text | YES |  |  |
| order_units | text | YES |  |  |
| days_supply | text | YES |  |  |
| created_at | timestamp with time zone | NO | now() |  |
| deleted_at | timestamp with time zone | YES |  |  |

## horse_reconciliation

Rows (estimate): 0

| column | type | nullable | default | comment |
|---|---|---|---|---|
| **id** (PK) | uuid | NO | gen_random_uuid() |  |
| org_id → organizations.id | uuid | NO |  |  |
| existing_horse_id → horses.id | uuid | YES |  |  |
| claimed_by_contact_id → contacts.id | uuid | YES |  |  |
| claim_type | text | YES |  |  |
| claim_note | text | YES |  |  |
| evidence_document_id → documents.id | uuid | YES |  |  |
| match_method | text | YES |  |  |
| status | text | NO | 'open'::text |  |
| resolved_by_contact_id → contacts.id | uuid | YES |  |  |
| resolved_at | timestamp with time zone | YES |  |  |
| created_at | timestamp with time zone | NO | now() |  |

## horse_relationships

Rows (estimate): 3

| column | type | nullable | default | comment |
|---|---|---|---|---|
| **id** (PK) | uuid | NO | gen_random_uuid() |  |
| org_id → organizations.id | uuid | NO |  |  |
| horse_id → horses.id | uuid | NO |  |  |
| relationship | text | NO |  |  |
| party_contact_id → contacts.id | uuid | YES |  |  |
| party_name_text | text | YES |  |  |
| term_start | date | YES |  |  |
| term_end | date | YES |  |  |
| source_document_id → documents.id | uuid | YES |  |  |
| created_by_contact_id → contacts.id | uuid | YES |  |  |
| active | boolean | NO | true |  |
| created_at | timestamp with time zone | NO | now() |  |
| ended_at | timestamp with time zone | YES |  |  |
| share_pct | numeric | YES |  |  |
| notes | text | YES |  |  |

## horses

Rows (estimate): 3

| column | type | nullable | default | comment |
|---|---|---|---|---|
| **id** (PK) | uuid | NO | gen_random_uuid() |  |
| display_code | text | YES |  |  |
| registered_name | text | YES |  |  |
| nickname | text | YES |  |  |
| breed → horse_breeds.code | text | YES |  |  |
| color → horse_colors.code | text | YES |  |  |
| sex | text | YES |  |  |
| date_of_birth | date | YES |  |  |
| height | text | YES |  |  |
| registration_number | text | YES |  |  |
| microchip_id | text | YES |  |  |
| current_location | text | YES |  |  |
| current_owner_contact_id → contacts.id | uuid | YES |  |  |
| notes | text | YES |  |  |
| created_at | timestamp with time zone | NO | now() |  |
| updated_at | timestamp with time zone | NO | now() |  |
| deleted_at | timestamp with time zone | YES |  |  |
| deleted_by → profiles.user_id | uuid | YES |  |  |
| org_id → organizations.id | uuid | NO | current_org() |  |
| vet_name | text | YES |  |  |
| vet_phone | text | YES |  |  |
| farrier_name | text | YES |  |  |
| farrier_phone | text | YES |  |  |
| fair_market_value | numeric | YES |  |  |
| markings | text | YES |  |  |
| registration_org | text | YES |  |  |
| passport_number | text | YES |  |  |
| passport_country | text | YES |  |  |
| medical_history | text | YES |  |  |
| behavioral_history | text | YES |  |  |
| known_conditions | text | YES |  |  |
| training_history | text | YES |  |  |
| competition_history | text | YES |  |  |
| created_by_contact_id → contacts.id | uuid | YES |  |  |
| owner_name_text | text | YES |  |  |
| lessee_contact_id → contacts.id | uuid | YES |  |  |
| lessee_name_text | text | YES |  |  |
| lease_start | date | YES |  |  |
| lease_end | date | YES |  |  |
| euthanasia_authorization | text | YES |  |  |
| home_location_id → locations.id | uuid | YES |  |  |
| current_location_id → locations.id | uuid | YES |  |  |
| sublease_allowed | boolean | NO | false |  |
| vet_business_name | text | YES |  |  |
| vet_address_line1 | text | YES |  |  |
| vet_city | text | YES |  |  |
| vet_state | text | YES |  |  |
| vet_postal | text | YES |  |  |
| home_location_notes | text | YES |  |  |
| home_trainer | text | YES |  |  |
| home_care_giver | text | YES |  |  |
| home_groom | text | YES |  |  |
| home_other_person | text | YES |  |  |
| current_location_notes | text | YES |  |  |
| current_trainer | text | YES |  |  |
| current_care_giver | text | YES |  |  |
| current_groom | text | YES |  |  |
| current_other_person | text | YES |  |  |
| home_barn | text | YES |  |  |
| home_stall | text | YES |  |  |
| current_barn | text | YES |  |  |
| current_stall | text | YES |  |  |
| rider_level_min | text | YES |  | Lowest rider level this horse suits (matching, not yet enforced). |
| rider_level_max | text | YES |  | Highest rider level this horse suits (matching, not yet enforced). |

## instructor_surface_grants

Rows (estimate): 8

| column | type | nullable | default | comment |
|---|---|---|---|---|
| **id** (PK) | uuid | NO | gen_random_uuid() |  |
| org_id → organizations.id | uuid | NO |  |  |
| user_id | uuid | YES |  |  |
| nav_key | text | NO |  |  |
| created_by | uuid | YES |  |  |
| created_at | timestamp with time zone | NO | now() |  |

## intake_requirements

Rows (estimate): 6

| column | type | nullable | default | comment |
|---|---|---|---|---|
| **id** (PK) | uuid | NO | gen_random_uuid() |  |
| org_id → organizations.id | uuid | NO |  |  |
| channel | text | NO |  |  |
| field_key | text | NO |  |  |
| required | boolean | NO | false |  |
| updated_at | timestamp with time zone | NO | now() |  |

## invitations

Rows (estimate): 22

| column | type | nullable | default | comment |
|---|---|---|---|---|
| **id** (PK) | uuid | NO | gen_random_uuid() |  |
| request_id → requests.id | uuid | YES |  |  |
| email | text | NO |  |  |
| token | text | NO |  |  |
| created_at | timestamp with time zone | NO | now() |  |
| expires_at | timestamp with time zone | NO |  |  |
| status | text | NO | 'sent'::text |  |
| loaded_slot_ids | jsonb | YES |  |  |
| org_id → organizations.id | uuid | NO | current_org() |  |
| kind | text | NO | 'COMMUNITY'::text |  |
| document_id → documents.id | uuid | YES |  |  |
| contact_id → contacts.id | uuid | YES |  |  |
| invited_role | text | NO | 'USER'::text |  |
| scheduled_for | date | YES |  |  |
| deleted_at | timestamp with time zone | YES |  |  |
| first_name | text | YES |  |  |
| last_name | text | YES |  |  |
| title | text | YES |  |  |
| categories | ARRAY | YES |  |  |
| offering_ids | ARRAY | YES |  |  |
| template_keys | ARRAY | YES |  |  |
| failure_reason | text | YES |  |  |
| superseded_by → invitations.id | uuid | YES |  |  |
| resend_of → invitations.id | uuid | YES |  |  |
| redeemed_at | timestamp with time zone | YES |  |  |
| current_status | text | YES |  |  |

## lease_participants

Rows (estimate): 0

| column | type | nullable | default | comment |
|---|---|---|---|---|
| **id** (PK) | uuid | NO | gen_random_uuid() |  |
| org_id → organizations.id | uuid | NO |  |  |
| document_id → documents.id | uuid | NO |  |  |
| contact_id → contacts.id | uuid | NO |  |  |
| days_used | text | YES |  |  |
| hours | text | YES |  |  |
| usage_pct | numeric | YES |  |  |
| payment_pct | numeric | YES |  |  |
| created_at | timestamp with time zone | NO | now() |  |

## lease_payment_options

Rows (estimate): 0

| column | type | nullable | default | comment |
|---|---|---|---|---|
| **id** (PK) | uuid | NO | gen_random_uuid() |  |
| org_id → organizations.id | uuid | NO |  |  |
| document_id → documents.id | uuid | NO |  |  |
| amount | numeric | YES |  |  |
| describe | text | YES |  |  |
| created_at | timestamp with time zone | NO | now() |  |

## lesson_credits

Rows (estimate): 21

| column | type | nullable | default | comment |
|---|---|---|---|---|
| **id** (PK) | uuid | NO | gen_random_uuid() |  |
| org_id → organizations.id | uuid | NO | current_org() |  |
| client_id → clients.id | uuid | NO |  |  |
| package_key | text | YES |  |  |
| credits_total | integer | NO | 0 |  |
| credits_remaining | integer | NO | 0 |  |
| purchased_at | timestamp with time zone | NO | now() |  |
| created_at | timestamp with time zone | NO | now() |  |
| updated_at | timestamp with time zone | NO | now() |  |
| deleted_at | timestamp with time zone | YES |  |  |
| deleted_by → profiles.user_id | uuid | YES |  |  |
| offering_id → offerings.id | uuid | YES |  |  |
| purchase_id → purchases.id | uuid | YES |  | BOOKWRITE: the purchase that granted these credits. NULL for a hand-granted credit with no order behind it. Lets a credit-paid booking name what paid for it. |
| purchase_item_id → purchase_items.id | uuid | YES |  | CREDITALIGN: the purchased LINE this entitlement was minted from. purchase_id alone is ambiguous — one order can carry two recurring lines (prod PUR-000059 holds Training 1x Weekly and Exercise 1x Weekly). Together with period_start it is the idempotency key that makes minting safe to run twice. NULL on every pre-CREDITALIGN row and on compensating refund rows, which is what keeps those out of the unique index. |
| period_start | date | YES |  | CREDITALIGN: for a recurring (weekly/monthly) allotment, the FIRST DAY OF THE BILLING MONTH this allotment covers — always a month start, never the purchase date, because it doubles as the idempotency key and a mid-month purchase and the month roll must resolve to the same period. Proration lives in credits_total, not here. NULL for session packs, which have no period. |
| expires_at | timestamp with time zone | YES |  | CREDITALIGN: the instant this entitlement stops being spendable — for a monthly allotment, midnight starting the next calendar month (owner: a month does not carry over). NULL = never expires, which is every session pack and every row that predates this task. Enforced at book_open_slot, _debit_or_create_for_booking, complete_lesson_session, credits_roster, swap_booking_item and the member's own item picker — see m3. |

## lesson_packages

Rows (estimate): 0

| column | type | nullable | default | comment |
|---|---|---|---|---|
| **id** (PK) | uuid | NO | gen_random_uuid() |  |
| org_id → organizations.id | uuid | NO | current_org() |  |
| package_key | text | NO |  |  |
| name | text | NO |  |  |
| price_value_key | text | YES |  |  |
| credits | integer | NO | 0 |  |
| active | boolean | NO | true |  |
| created_at | timestamp with time zone | NO | now() |  |
| updated_at | timestamp with time zone | NO | now() |  |
| deleted_at | timestamp with time zone | YES |  |  |
| deleted_by → profiles.user_id | uuid | YES |  |  |

## lesson_plans

LESSONPLAN: the riding plan for one client, versioned. Exactly one row per client has status='current'; every earlier version is retained with status='superseded' and a supersedes_id chain back through the whole history. Recording progress on a lesson produces the next version (record_lesson_progress), which is what makes the next lesson carry an updated plan. Nothing here is ever updated in place except the transition to superseded.

Rows (estimate): 0

| column | type | nullable | default | comment |
|---|---|---|---|---|
| **id** (PK) | uuid | NO | gen_random_uuid() |  |
| org_id → organizations.id | uuid | NO |  |  |
| client_id → clients.id | uuid | NO |  |  |
| version | integer | NO | 1 |  |
| status | text | NO | 'current'::text |  |
| supersedes_id → lesson_plans.id | uuid | YES |  |  |
| focus | text | YES |  |  |
| objectives | jsonb | NO | '[]'::jsonb | Ordered array of {id, label, state, note}. state is planned\|working\|achieved. Array order is the running order — the first non-achieved objective is what comes next. note is RIDER-VISIBLE; coach_notes is the staff-private lane. |
| coach_notes | text | YES |  |  |
| advanced_from_booking_id → bookings.id | uuid | YES |  |  |
| created_at | timestamp with time zone | NO | now() |  |
| created_by | uuid | YES |  |  |
| superseded_at | timestamp with time zone | YES |  |  |

## locations

Rows (estimate): 1

| column | type | nullable | default | comment |
|---|---|---|---|---|
| **id** (PK) | uuid | NO | gen_random_uuid() |  |
| org_id → organizations.id | uuid | NO |  |  |
| name | text | NO |  |  |
| address | text | YES |  |  |
| is_offsite | boolean | NO | false |  |
| is_default | boolean | NO | false |  |
| sort_order | integer | NO | 0 |  |
| active | boolean | NO | true |  |
| created_at | timestamp with time zone | NO | now() |  |
| owner_contact_id → contacts.id | uuid | YES |  |  |
| address_line1 | text | YES |  |  |
| city | text | YES |  |  |
| state | text | YES |  |  |
| postal | text | YES |  |  |

## lookup_options

Rows (estimate): 44

| column | type | nullable | default | comment |
|---|---|---|---|---|
| **lookup_key** (PK) | text | NO |  |  |
| **code** (PK) | text | NO |  |  |
| display_name | text | NO |  |  |
| active | boolean | NO | true |  |
| sort_order | integer | NO | 100 |  |

## lookup_suggestions

Rows (estimate): 3

| column | type | nullable | default | comment |
|---|---|---|---|---|
| **id** (PK) | uuid | NO | gen_random_uuid() |  |
| lookup_key | text | NO |  |  |
| raw_value | text | NO |  |  |
| norm_value | text | NO |  |  |
| count | integer | NO | 1 |  |
| status | text | NO | 'open'::text |  |
| org_id | uuid | YES |  |  |
| first_seen | timestamp with time zone | NO | now() |  |
| last_seen | timestamp with time zone | NO | now() |  |

## member_greetings

Rows (estimate): 0

| column | type | nullable | default | comment |
|---|---|---|---|---|
| **id** (PK) | uuid | NO | gen_random_uuid() |  |
| org_id → organizations.id | uuid | NO | current_org() |  |
| from_user | uuid | NO |  |  |
| to_user | uuid | NO |  |  |
| kind | text | NO |  |  |
| created_at | timestamp with time zone | NO | now() |  |

## member_groups

Rows (estimate): 0

| column | type | nullable | default | comment |
|---|---|---|---|---|
| **id** (PK) | uuid | NO | gen_random_uuid() |  |
| name | text | NO |  |  |
| slug | text | NO |  |  |
| description | text | YES |  |  |
| created_at | timestamp with time zone | NO | now() |  |
| org_id → organizations.id | uuid | NO | current_org() |  |

## members

Rows (estimate): 17

| column | type | nullable | default | comment |
|---|---|---|---|---|
| **id** (PK) | uuid | NO | gen_random_uuid() |  |
| user_id | uuid | NO |  |  |
| status | text | NO | 'active'::text |  |
| started_at | timestamp with time zone | NO | now() |  |
| renews_at | timestamp with time zone | YES |  |  |
| created_at | timestamp with time zone | NO | now() |  |
| org_id → organizations.id | uuid | NO | current_org() |  |

## moderation_actions

Rows (estimate): 5

| column | type | nullable | default | comment |
|---|---|---|---|---|
| **id** (PK) | uuid | NO | gen_random_uuid() |  |
| moderator_id | uuid | YES |  |  |
| target_type | text | NO |  |  |
| target_id | uuid | NO |  |  |
| action | text | NO |  |  |
| reason | text | YES |  |  |
| created_at | timestamp with time zone | NO | now() |  |
| org_id → organizations.id | uuid | NO | current_org() |  |

## modules

Rows (estimate): 12

| column | type | nullable | default | comment |
|---|---|---|---|---|
| **module_key** (PK) | text | NO |  |  |
| name | text | NO |  |  |
| description | text | YES |  |  |
| is_core | boolean | NO | false |  |
| active | boolean | NO | true |  |
| created_at | timestamp with time zone | NO | now() |  |

## notification_log

Rows (estimate): 57

| column | type | nullable | default | comment |
|---|---|---|---|---|
| **id** (PK) | uuid | NO | gen_random_uuid() |  |
| org_id | uuid | NO |  |  |
| notification_id | uuid | NO |  |  |
| kind | text | NO |  |  |
| category | text | YES |  |  |
| title | text | YES |  |  |
| body | text | YES |  |  |
| link | text | YES |  |  |
| author_user_id | uuid | YES |  |  |
| reason | text | YES |  |  |
| recipient_user_id | uuid | YES |  |  |
| recipient_email | text | YES |  |  |
| raised_at | timestamp with time zone | NO |  |  |
| emailed_at | timestamp with time zone | YES |  |  |
| read_at | timestamp with time zone | YES |  |  |
| locations | ARRAY | NO |  |  |
| outcome | text | NO |  |  |
| outcome_at | timestamp with time zone | NO | now() |  |
| outcome_by | uuid | YES |  |  |

## notifications

Rows (estimate): 167

| column | type | nullable | default | comment |
|---|---|---|---|---|
| **id** (PK) | uuid | NO | gen_random_uuid() |  |
| org_id → organizations.id | uuid | NO | current_org() |  |
| user_id | uuid | NO |  |  |
| kind | text | NO |  |  |
| title | text | NO |  |  |
| body | text | YES |  |  |
| link | text | NO |  |  |
| read_at | timestamp with time zone | YES |  |  |
| created_at | timestamp with time zone | NO | now() |  |
| emailed_at | timestamp with time zone | YES |  | When the email nudge digested this notification (api/notifications-nudge). NULL = not yet emailed; stamped only after a successful send. |
| category | text | YES |  |  |
| author_user_id | uuid | YES |  |  |
| reason | text | YES |  |  |

## offerings

Rows (estimate): 43

| column | type | nullable | default | comment |
|---|---|---|---|---|
| **id** (PK) | uuid | NO | gen_random_uuid() |  |
| segment | text | NO |  |  |
| name | text | NO |  |  |
| tagline | text | YES |  |  |
| description | text | YES |  |  |
| slug | text | NO |  |  |
| active | boolean | NO | true |  |
| sort_order | integer | NO | 0 |  |
| created_at | timestamp with time zone | NO | now() |  |
| service_type → service_types.code | text | YES |  |  |
| org_id → organizations.id | uuid | NO | current_org() |  |
| price_amount | numeric | YES |  |  |
| price_unit | text | YES |  |  |
| price_min | numeric | YES |  |  |
| purchase_type | USER-DEFINED | YES |  | Drives payment-time UI: one_time \| subscription \| deposit_retainer. |
| horse_included | boolean | YES |  | Rider lessons only: true = "Ride our horse", false = "Ride your horse", null = not a lesson. |
| is_popular | boolean | NO | false |  |
| note | text | YES |  |  |
| price_model | jsonb | YES |  |  |
| config_kind | text | YES |  |  |
| unit_count | integer | YES |  |  |
| weekly_frequency | integer | YES |  |  |
| badge_label | text | YES |  | Card corner badge text (e.g. "Most Popular", "Best Value"). Rendered when set; is_popular alone renders the legacy "Popular". |

## org_modules

Rows (estimate): 6

| column | type | nullable | default | comment |
|---|---|---|---|---|
| **id** (PK) | uuid | NO | gen_random_uuid() |  |
| org_id → organizations.id | uuid | NO | current_org() |  |
| module_key → modules.module_key | text | NO |  |  |
| enabled | boolean | NO | true |  |
| source | text | NO | 'GRANT'::text |  |
| enabled_at | timestamp with time zone | NO | now() |  |
| expires_at | timestamp with time zone | YES |  |  |
| created_at | timestamp with time zone | NO | now() |  |
| updated_at | timestamp with time zone | NO | now() |  |

## org_page_visibility

TASK-PAGEVIS: pages this tenant has hidden from its own navigation. PRESENCE = HIDDEN; no row means visible, so a page added later ships visible. Keyed on the code-owned page_key from src/lib/pageRegistry.ts, NEVER on a route path — a rename must not orphan the row. This is a display PREFERENCE and gates nothing: hidden routes still resolve.

Rows (estimate): 0

| column | type | nullable | default | comment |
|---|---|---|---|---|
| **id** (PK) | uuid | NO | gen_random_uuid() |  |
| org_id → organizations.id | uuid | NO | current_org() |  |
| page_key | text | NO |  | Stable slug from src/lib/pageRegistry.ts (grammar: group.page). The route path lives in the code registry beside it and may change without touching this row. |
| hidden_at | timestamp with time zone | NO | now() |  |
| hidden_by_user_id | uuid | YES | auth.uid() |  |

## organizations

Rows (estimate): 1

| column | type | nullable | default | comment |
|---|---|---|---|---|
| **id** (PK) | uuid | NO | gen_random_uuid() |  |
| display_code | text | YES |  |  |
| name | text | NO |  |  |
| slug | text | YES |  |  |
| status | text | NO | 'ACTIVE'::text |  |
| created_at | timestamp with time zone | NO | now() |  |
| updated_at | timestamp with time zone | NO | now() |  |
| deleted_at | timestamp with time zone | YES |  |  |
| deleted_by → profiles.user_id | uuid | YES |  |  |
| company_contact_id → contacts.id | uuid | YES |  |  |

## payment_notifications

Rows (estimate): 0

| column | type | nullable | default | comment |
|---|---|---|---|---|
| **id** (PK) | uuid | NO | gen_random_uuid() |  |
| received_at | timestamp with time zone | NO | now() |  |
| source_inbox | text | YES |  |  |
| raw_subject | text | YES |  |  |
| raw_body | text | YES |  |  |
| parsed_sender | text | YES |  |  |
| parsed_amount | numeric | YES |  |  |
| parsed_reference | text | YES |  |  |
| matched_purchase_id → purchases.id | uuid | YES |  |  |
| status | text | NO | 'unmatched'::text |  |
| org_id → organizations.id | uuid | NO | current_org() |  |

## payment_request_sends

TASK-CREDITGRANT: one row per attempt to email a client about a balance owed — success or failure, with the provider error verbatim. Mirrors receipt_sends / request_alert_sends. No row at all means the endpoint never ran.

Rows (estimate): 0

| column | type | nullable | default | comment |
|---|---|---|---|---|
| **id** (PK) | uuid | NO | gen_random_uuid() |  |
| org_id → organizations.id | uuid | NO |  |  |
| purchase_id → purchases.id | uuid | NO |  |  |
| idempotency_key | text | NO |  |  |
| recipient_email | text | YES |  |  |
| amount_due | numeric | YES |  |  |
| succeeded | boolean | NO |  |  |
| error | text | YES |  |  |
| message_id | text | YES |  |  |
| requested_by → profiles.user_id | uuid | YES |  |  |
| attempted_at | timestamp with time zone | NO | now() |  |

## payments

Rows (estimate): 6

| column | type | nullable | default | comment |
|---|---|---|---|---|
| **id** (PK) | uuid | NO | gen_random_uuid() |  |
| display_code | text | YES |  |  |
| org_id | uuid | NO |  |  |
| purchase_id → purchases.id | uuid | YES |  |  |
| payer_contact_id → contacts.id | uuid | YES |  |  |
| method | text | NO |  |  |
| amount | numeric | NO |  |  |
| reference | text | YES |  |  |
| status | text | NO | 'pending'::text |  |
| declared_at | timestamp with time zone | NO | now() |  |
| declared_by | uuid | YES |  |  |
| confirmed_at | timestamp with time zone | YES |  |  |
| confirmed_by | uuid | YES |  |  |
| decline_reason | text | YES |  |  |
| notes | text | YES |  |  |
| created_at | timestamp with time zone | NO | now() |  |
| updated_at | timestamp with time zone | NO | now() |  |
| deleted_at | timestamp with time zone | YES |  |  |
| deleted_by | uuid | YES |  |  |

## product_prices

Rows (estimate): 0

| column | type | nullable | default | comment |
|---|---|---|---|---|
| **id** (PK) | uuid | NO | gen_random_uuid() |  |
| org_id → organizations.id | uuid | NO | current_org() |  |
| product_id → products.id | uuid | NO |  |  |
| amount | numeric | NO |  |  |
| effective_from | timestamp with time zone | NO | now() |  |
| effective_to | timestamp with time zone | YES |  |  |
| created_at | timestamp with time zone | NO | now() |  |
| updated_at | timestamp with time zone | NO | now() |  |
| deleted_at | timestamp with time zone | YES |  |  |
| deleted_by → profiles.user_id | uuid | YES |  |  |

## products

Rows (estimate): 0

| column | type | nullable | default | comment |
|---|---|---|---|---|
| **id** (PK) | uuid | NO | gen_random_uuid() |  |
| org_id → organizations.id | uuid | NO | current_org() |  |
| product_key | text | NO |  |  |
| name | text | NO |  |  |
| service_type → service_types.code | text | YES |  |  |
| module_key → modules.module_key | text | YES |  |  |
| price_value_key | text | YES |  |  |
| active | boolean | NO | true |  |
| created_at | timestamp with time zone | NO | now() |  |
| updated_at | timestamp with time zone | NO | now() |  |
| deleted_at | timestamp with time zone | YES |  |  |
| deleted_by → profiles.user_id | uuid | YES |  |  |

## profiles

THE account: the auth bridge (user_id ↔ auth.users), org and role, the community persona (display_name, avatar_url, bio, riding_level), tour markers and the email-change state machine. It holds NOTHING about the person — name aside, which is still being consolidated. Address, phone, mobile, WhatsApp, socials, contact preferences and community-visibility flags all live on `contacts`, which is the single person record and works for the majority of people who have no login at all.

Rows (estimate): 13

| column | type | nullable | default | comment |
|---|---|---|---|---|
| **user_id** (PK) | uuid | NO |  |  |
| first_name | text | YES |  |  |
| last_name | text | YES |  |  |
| email | text | YES |  |  |
| is_admin | boolean | NO | false |  |
| created_from_request_id | uuid | YES |  |  |
| created_at | timestamp with time zone | NO | now() |  |
| updated_at | timestamp with time zone | NO | now() |  |
| display_name | text | YES |  |  |
| avatar_url | text | YES |  |  |
| bio | text | YES |  |  |
| riding_level | text | YES |  |  |
| is_suspended | boolean | NO | false |  |
| contact_id → contacts.id | uuid | YES |  |  |
| org_id → organizations.id | uuid | YES |  |  |
| role | text | NO | 'USER'::text |  |
| pending_email | text | YES |  |  |
| pending_email_mode | text | YES |  |  |
| pending_email_token_hash | text | YES |  |  |
| pending_email_started_at | timestamp with time zone | YES |  |  |
| old_email | text | YES |  |  |
| first_dashboard_at | timestamp with time zone | YES |  |  |
| welcome_removed_at | timestamp with time zone | YES |  |  |
| title | text | YES |  |  |
| pay_type | text | YES |  |  |
| staff_active | boolean | NO | false |  |
| tour_seen_at | timestamp with time zone | YES |  | A3: when this account first dismissed the app-overview tour. NULL = show it on next login. Menu re-opens do not stamp it. |
| tour_seen_desktop_at | timestamp with time zone | YES |  |  |
| tour_seen_mobile_at | timestamp with time zone | YES |  |  |
| dashboard_focus | text | YES |  | DASHBOARDBUILD §2 / D26. Which owner dashboard this account LANDS on: trainer (Head Trainer) or business (Business Operations). NULL = fall back by role. NEVER read by a permission check — both views are open to every staff account. |

## property_terms

Rows (estimate): 5

| column | type | nullable | default | comment |
|---|---|---|---|---|
| **key** (PK) | text | NO |  |  |
| term | text | NO |  |  |
| article | text | NO | 'the'::text |  |
| plural | boolean | NO | false |  |
| preposition | text | NO | 'at'::text |  |
| active | boolean | NO | true |  |
| sort_order | integer | NO | 0 |  |

## purchase_items

Rows (estimate): 14

| column | type | nullable | default | comment |
|---|---|---|---|---|
| **id** (PK) | uuid | NO | gen_random_uuid() |  |
| purchase_id → purchases.id | uuid | NO |  |  |
| offering_id → offerings.id | uuid | YES |  |  |
| label | text | NO |  |  |
| price_amount | numeric | NO | 0 |  |
| price_unit | text | YES |  |  |
| quantity | integer | NO | 1 |  |
| org_id → organizations.id | uuid | NO | current_org() |  |
| created_at | timestamp with time zone | NO | now() |  |
| config | jsonb | NO | '{}'::jsonb |  |
| plan_ends_on | date | YES |  | CREDITALIGN: the last day a recurring plan line is entitled. NULL = still running. The monthly roll (mint_recurring_allotments) skips a line whose plan_ends_on falls before the month it is about to mint. Set from the calendar panel via set_recurring_plan_end(); stopping a plan is never a migration (D13). Meaningless on non-recurring lines and ignored there. |
| voided_at | timestamp with time zone | YES |  | CAREPATH C5b: a cancelled line is voided, never deleted — the record of what was asked for is evidence. A voided line is excluded from the order total. |
| voided_by | uuid | YES |  |  |
| void_reason | text | YES |  |  |

## purchases

Rows (estimate): 14

| column | type | nullable | default | comment |
|---|---|---|---|---|
| **id** (PK) | uuid | NO | gen_random_uuid() |  |
| display_code | text | YES |  |  |
| org_id → organizations.id | uuid | NO | current_org() |  |
| contract_id → contracts.id | uuid | YES |  |  |
| buyer_contact_id → contacts.id | uuid | YES |  |  |
| buyer_user_id → profiles.user_id | uuid | YES |  |  |
| status | text | NO | 'draft'::text |  |
| amount | numeric | NO | 0 |  |
| payment_method | text | YES |  |  |
| payment_status | text | NO | 'unpaid'::text |  |
| payment_reference | text | YES |  |  |
| unique_amount | numeric | YES |  |  |
| paid_at | timestamp with time zone | YES |  |  |
| notes | text | YES |  |  |
| created_at | timestamp with time zone | NO | now() |  |
| updated_at | timestamp with time zone | NO | now() |  |
| deleted_at | timestamp with time zone | YES |  |  |
| deleted_by → profiles.user_id | uuid | YES |  |  |
| horse_id → horses.id | uuid | YES |  |  |
| amount_paid | numeric | NO | 0 |  |
| current_status | text | YES |  |  |
| client_reported_method | text | YES |  | ONBOARD §6: what the BUYER says they did — 'zelle' or 'cash'. A claim, never a confirmation. payment_status is still only ever written by staff reconciliation. |
| client_reported_reference | text | YES |  | ONBOARD §6: the confirmation number the buyer typed, if they typed one. Optional by owner instruction ("if they leave it blank thats ok"). NOT payment_reference — that is the memo code WE generate for matching, and it is never overwritten by this. |
| client_reported_at | timestamp with time zone | YES |  |  |
| client_claim_status | text | NO | 'none'::text | CASHCONFIRM: staff handling of the current client-reported claim — 'none' (no claim), 'pending' (claimed, awaiting staff), 'confirmed', 'declined'. Distinct from client_reported_* (the claim itself, never overwritten here) and from payment_status (never set by a claim — only mark_purchase_paid sets that). |
| client_claim_resolved_by → profiles.user_id | uuid | YES |  |  |
| client_claim_resolved_at | timestamp with time zone | YES |  |  |
| client_claim_decline_reason | text | YES |  |  |
| request_id → requests.id | uuid | YES |  | CAREPATH C5: the inquiry this order came from. Both halves of a split order carry the same value, so staff never lose why order B exists. |

## receipt_sends

Rows (estimate): 0

| column | type | nullable | default | comment |
|---|---|---|---|---|
| **id** (PK) | uuid | NO | gen_random_uuid() |  |
| org_id | uuid | NO |  |  |
| purchase_id → purchases.id | uuid | NO |  |  |
| idempotency_key | text | NO |  |  |
| recipient_email | text | YES |  |  |
| succeeded | boolean | NO |  |  |
| error | text | YES |  |  |
| message_id | text | YES |  |  |
| attempted_at | timestamp with time zone | NO | now() |  |

## request_alert_sends

INBOUNDALERT: one row per attempt to email the ops inbox about an inbound request — success or failure, with the provider's error verbatim. Mirrors receipt_sends. No row at all means the endpoint never ran.

Rows (estimate): 6

| column | type | nullable | default | comment |
|---|---|---|---|---|
| **id** (PK) | uuid | NO | gen_random_uuid() |  |
| org_id | uuid | NO |  |  |
| request_id → requests.id | uuid | NO |  |  |
| idempotency_key | text | NO |  |  |
| recipient_email | text | YES |  |  |
| succeeded | boolean | NO |  |  |
| error | text | YES |  |  |
| message_id | text | YES |  |  |
| attempted_at | timestamp with time zone | NO | now() |  |
| kind | text | NO | 'staff'::text | CAREPATH C6: which of the two inquiry emails this attempt was — the staff alert or the submitter's own copy. Every attempt of either is a row. |

## request_selections

Rows (estimate): 8

| column | type | nullable | default | comment |
|---|---|---|---|---|
| **id** (PK) | uuid | NO | gen_random_uuid() |  |
| request_id → requests.id | uuid | NO |  |  |
| offering_id → offerings.id | uuid | YES |  |  |
| offering_slug | text | YES |  |  |
| label | text | YES |  |  |
| org_id → organizations.id | uuid | YES | COALESCE(current_org(), current_addresse |  |
| state | USER-DEFINED | NO | 'received'::line_item_state | Per-item lifecycle (spec Part 2). Parent request state derives from items. |
| assigned_date | date | YES |  |  |
| approved_at | timestamp with time zone | YES |  |  |
| hold_expires_at | timestamp with time zone | YES |  | approved_at + 48h. Real-time expiry by computation; reaper housekeeps 6am-9pm. |
| order_id | uuid | YES |  |  |
| disposition_note | text | YES |  |  |
| origin | text | YES |  |  |
| purchase_id → purchases.id | uuid | YES |  |  |

## requests

Rows (estimate): 17

| column | type | nullable | default | comment |
|---|---|---|---|---|
| **id** (PK) | uuid | NO | gen_random_uuid() |  |
| created_at | timestamp with time zone | NO | now() |  |
| status | text | NO | 'new'::text |  |
| contact_name | text | NO |  |  |
| contact_email | text | NO |  |  |
| contact_phone | text | YES |  |  |
| contact_method | text | YES |  |  |
| proposed_times | jsonb | NO | '[]'::jsonb |  |
| notes | text | YES |  |  |
| org_id → organizations.id | uuid | YES | COALESCE(current_org(), current_addresse |  |
| staff_notes | jsonb | NO | '[]'::jsonb |  |
| checklist | jsonb | YES |  |  |
| subject | text | YES |  |  |
| booking_eligible | boolean | NO | true |  |
| invited_at | timestamp with time zone | YES |  |  |
| invitation_expires_at | timestamp with time zone | YES |  |  |
| contact_first_name | text | YES |  |  |
| contact_last_name | text | YES |  |  |
| category | text | YES |  |  |
| channel | text | YES |  |  |
| entry_location | text | YES |  |  |
| intent | text | YES |  |  |
| details | jsonb | NO | '{}'::jsonb |  |
| contact_id → contacts.id | uuid | YES |  |  |

## resource_lots

Rows (estimate): 0

| column | type | nullable | default | comment |
|---|---|---|---|---|
| **id** (PK) | uuid | NO | gen_random_uuid() |  |
| org_id → organizations.id | uuid | NO | current_org() |  |
| resource_id → resources.id | uuid | NO |  |  |
| vendor_contact_id → contacts.id | uuid | YES |  |  |
| qty_purchased | numeric | NO | 0 |  |
| unit_cost | numeric | NO | 0 |  |
| on_hand | numeric | NO | 0 |  |
| purchased_at | timestamp with time zone | NO | now() |  |
| created_at | timestamp with time zone | NO | now() |  |
| updated_at | timestamp with time zone | NO | now() |  |
| deleted_at | timestamp with time zone | YES |  |  |
| deleted_by → profiles.user_id | uuid | YES |  |  |

## resources

Rows (estimate): 0

| column | type | nullable | default | comment |
|---|---|---|---|---|
| **id** (PK) | uuid | NO | gen_random_uuid() |  |
| org_id → organizations.id | uuid | NO | current_org() |  |
| resource_key | text | NO |  |  |
| name | text | NO |  |  |
| category | text | NO |  |  |
| unit_of_measure | text | NO | 'unit'::text |  |
| is_consumable | boolean | NO | true |  |
| created_at | timestamp with time zone | NO | now() |  |
| updated_at | timestamp with time zone | NO | now() |  |
| deleted_at | timestamp with time zone | YES |  |  |
| deleted_by → profiles.user_id | uuid | YES |  |  |

## segment_categories

TASK-CATEGORISE: what an offering's segment means in the two category vocabularies. Read by the request_categories view (staff filtering) and by request_onboarding_categories() (the provisioning default). One row per segment per tenant.

Rows (estimate): 3

| column | type | nullable | default | comment |
|---|---|---|---|---|
| **id** (PK) | uuid | NO | gen_random_uuid() |  |
| org_id → organizations.id | uuid | NO |  |  |
| segment | text | NO |  |  |
| request_category | text | NO |  |  |
| onboarding_category | text | NO |  |  |
| onboarding_token | text | NO |  |  |

## service_type_document_requirements

Rows (estimate): 47

| column | type | nullable | default | comment |
|---|---|---|---|---|
| **id** (PK) | uuid | NO | gen_random_uuid() |  |
| org_id → organizations.id | uuid | NO |  |  |
| service_type → service_types.code | text | NO |  |  |
| template_key | text | NO |  |  |
| active | boolean | NO | true |  |
| retired_reason | text | YES |  |  |
| created_at | timestamp with time zone | NO | now() |  |

## service_types

Rows (estimate): 14

| column | type | nullable | default | comment |
|---|---|---|---|---|
| **code** (PK) | text | NO |  |  |
| display_name | text | NO |  |  |
| description | text | YES |  |  |
| segment | text | YES |  |  |
| requires_horse | boolean | NO | false |  |
| active | boolean | NO | true |  |
| sort_order | integer | NO | 0 |  |
| cover_image_url | text | YES |  |  |
| card_weight | integer | NO | 1 |  |
| catalog_rank | integer | YES |  |  |

## shifts

Rows (estimate): 0

| column | type | nullable | default | comment |
|---|---|---|---|---|
| **id** (PK) | uuid | NO | gen_random_uuid() |  |
| org_id → organizations.id | uuid | NO | current_org() |  |
| starts_at | timestamp with time zone | NO |  |  |
| ends_at | timestamp with time zone | YES |  |  |
| role | text | YES |  |  |
| created_at | timestamp with time zone | NO | now() |  |
| updated_at | timestamp with time zone | NO | now() |  |
| deleted_at | timestamp with time zone | YES |  |  |
| deleted_by → profiles.user_id | uuid | YES |  |  |
| staff_user_id → profiles.user_id | uuid | NO |  |  |

## sign_path_document_requirements

Rows (estimate): 18

| column | type | nullable | default | comment |
|---|---|---|---|---|
| **id** (PK) | uuid | NO | gen_random_uuid() |  |
| org_id → organizations.id | uuid | NO |  |  |
| path | text | NO |  |  |
| template_key | text | NO |  |  |
| active | boolean | NO | true |  |
| created_at | timestamp with time zone | NO | now() |  |

## sign_start_attempts

Rows (estimate): 9

| column | type | nullable | default | comment |
|---|---|---|---|---|
| **id** (PK) | uuid | NO | gen_random_uuid() |  |
| requester_hash | text | NO |  |  |
| window_start | timestamp with time zone | NO | now() |  |
| count | integer | NO | 1 |  |
| notified_at | timestamp with time zone | YES |  |  |
| created_at | timestamp with time zone | NO | now() |  |

## signatures

Rows (estimate): 71

| column | type | nullable | default | comment |
|---|---|---|---|---|
| **id** (PK) | uuid | NO | gen_random_uuid() |  |
| document_id → documents.id | uuid | NO |  |  |
| signer_contact_id → contacts.id | uuid | NO |  |  |
| party_role | text | NO |  |  |
| typed_name | text | YES |  |  |
| signed_at | timestamp with time zone | YES |  |  |
| ip_address | text | YES |  |  |
| method | text | YES |  |  |
| created_at | timestamp with time zone | NO | now() |  |
| deleted_at | timestamp with time zone | YES |  |  |
| deleted_by → profiles.user_id | uuid | YES |  |  |
| org_id → organizations.id | uuid | NO | current_org() |  |
| user_agent | text | YES |  | Signer's browser user-agent at signing (device attribution for the e-sign audit trail). Captured server-side from PostgREST request headers when not supplied. |
| signer_user_id | uuid | YES |  |  |

## signup_alert_sends

ONBOARD §3: one row per attempt to tell the owner that somebody never got their activation email. Mirrors request_alert_sends exactly — a send nobody can prove is a send nobody should claim.

Rows (estimate): 0

| column | type | nullable | default | comment |
|---|---|---|---|---|
| **id** (PK) | uuid | NO | gen_random_uuid() |  |
| org_id → organizations.id | uuid | NO |  |  |
| attempt_id → signup_attempts.id | uuid | NO |  |  |
| idempotency_key | text | NO |  |  |
| recipient_email | text | YES |  |  |
| succeeded | boolean | NO |  |  |
| error | text | YES |  |  |
| message_id | text | YES |  |  |
| attempted_at | timestamp with time zone | NO | now() |  |

## signup_attempts

ONBOARD §3: one row per /sign signup attempt, carrying the REAL activation-email outcome (ok / provider error / rate-limited) so the send-state screen can render it and staff can see later that an account was created but never emailed.

Rows (estimate): 7

| column | type | nullable | default | comment |
|---|---|---|---|---|
| **id** (PK) | uuid | NO | gen_random_uuid() |  |
| org_id → organizations.id | uuid | YES |  |  |
| email | text | NO |  |  |
| first_name | text | YES |  |  |
| last_name | text | YES |  |  |
| phone | text | YES |  |  |
| path | text | YES |  |  |
| categories | ARRAY | YES |  |  |
| invitation_id → invitations.id | uuid | YES |  |  |
| email_ok | boolean | NO | false |  |
| email_error | text | YES |  |  |
| message_id | text | YES |  |  |
| rate_limited | boolean | NO | false |  |
| requester_hash | text | YES |  |  |
| created_at | timestamp with time zone | NO | now() |  |
| help_requested_at | timestamp with time zone | YES |  |  |

## stable_items

Rows (estimate): 0

| column | type | nullable | default | comment |
|---|---|---|---|---|
| **id** (PK) | uuid | NO | gen_random_uuid() |  |
| org_id → organizations.id | uuid | NO |  |  |
| user_id | uuid | NO |  |  |
| kind | USER-DEFINED | NO |  |  |
| name | text | NO |  |  |
| detail | text | YES |  |  |
| vendor_id → vendors.id | uuid | YES |  |  |
| created_at | timestamp with time zone | NO | now() |  |
| updated_at | timestamp with time zone | NO | now() |  |
| owner_kind | text | NO | 'contact'::text | Mirrors files.owner_kind (D15/TASK-UPLOADS): contact = the adding user's own gear/supplies; org = the tenant's (My Stable, act-as-company). user_id is retained as the audit trail (who clicked add), never the ownership question, same distinction files.ts documents for uploaded_by. |

## stalls

Rows (estimate): 0

| column | type | nullable | default | comment |
|---|---|---|---|---|
| **id** (PK) | uuid | NO | gen_random_uuid() |  |
| org_id → organizations.id | uuid | NO | current_org() |  |
| facility_id → facilities.id | uuid | NO |  |  |
| code | text | NO |  |  |
| stall_type | text | YES |  |  |
| active | boolean | NO | true |  |
| created_at | timestamp with time zone | NO | now() |  |
| updated_at | timestamp with time zone | NO | now() |  |
| deleted_at | timestamp with time zone | YES |  |  |
| deleted_by → profiles.user_id | uuid | YES |  |  |

## status_events

Rows (estimate): 1377

| column | type | nullable | default | comment |
|---|---|---|---|---|
| **id** (PK) | uuid | NO | gen_random_uuid() |  |
| org_id | uuid | NO |  |  |
| entity_type → status_events_vocab.code | text | NO |  |  |
| entity_id | uuid | NO |  |  |
| status → status_events_vocab.code | text | NO |  |  |
| detail | text | YES |  |  |
| actor_user_id | uuid | YES |  |  |
| created_at | timestamp with time zone | NO | now() |  |

## status_events_vocab

Rows (estimate): 70

| column | type | nullable | default | comment |
|---|---|---|---|---|
| **entity_type** (PK) | text | NO |  |  |
| **code** (PK) | text | NO |  |  |
| display_name | text | NO |  |  |
| is_true_status | boolean | NO | true |  |
| is_terminal | boolean | NO | false |  |
| sort_order | integer | NO | 0 |  |

## support_requests

Rows (estimate): 0

| column | type | nullable | default | comment |
|---|---|---|---|---|
| **id** (PK) | uuid | NO | gen_random_uuid() |  |
| org_id → organizations.id | uuid | NO |  |  |
| user_id → profiles.user_id | uuid | NO |  |  |
| subject | text | NO |  |  |
| body | text | NO |  |  |
| status | text | NO | 'open'::text |  |
| resolved_at | timestamp with time zone | YES |  |  |
| resolved_by → profiles.user_id | uuid | YES |  |  |
| created_at | timestamp with time zone | NO | now() |  |

## template_tokens

Rows (estimate): 364

| column | type | nullable | default | comment |
|---|---|---|---|---|
| **id** (PK) | uuid | NO | gen_random_uuid() |  |
| template_id → contract_templates.id | uuid | YES |  |  |
| namespace | text | NO |  |  |
| field | text | NO |  |  |
| token | text | NO |  |  |
| kind | text | NO |  |  |
| source_table | text | YES |  |  |
| source_column | text | YES |  |  |
| computed | boolean | NO | false |  |
| required | boolean | NO | false |  |
| party_scoped | boolean | NO | false |  |
| notes | text | YES |  |  |
| created_at | timestamp with time zone | NO | now() |  |

## template_variants

Rows (estimate): 10

| column | type | nullable | default | comment |
|---|---|---|---|---|
| **id** (PK) | uuid | NO | gen_random_uuid() |  |
| template_key | text | NO |  |  |
| retained_by | text | NO |  |  |
| deal_side | text | NO |  |  |
| token_overrides | jsonb | NO | '{}'::jsonb |  |
| active | boolean | NO | true |  |
| created_at | timestamp with time zone | NO | now() |  |
| updated_at | timestamp with time zone | NO | now() |  |

## template_version_events

One row per template version bump, UNRESOLVED until staff say whether past signers must re-sign (ALL / SELECTED / NONE). contract_templates is edited in place and keeps no history, so without this there is no event to prompt from and a wording change can reach signers with nobody deciding what it means for people who already signed.

Rows (estimate): 12

| column | type | nullable | default | comment |
|---|---|---|---|---|
| **id** (PK) | uuid | NO | gen_random_uuid() |  |
| template_key | text | NO |  |  |
| from_version | integer | YES |  |  |
| to_version | integer | NO |  |  |
| occurred_at | timestamp with time zone | NO | now() |  |
| resolved_at | timestamp with time zone | YES |  |  |
| resolution | text | YES |  |  |
| resolved_by | uuid | YES |  |  |
| people_required | integer | NO | 0 |  |

## thread_posts

Rows (estimate): 0

| column | type | nullable | default | comment |
|---|---|---|---|---|
| **id** (PK) | uuid | NO | gen_random_uuid() |  |
| thread_id → threads.id | uuid | NO |  |  |
| author_id | uuid | NO |  |  |
| body | text | NO |  |  |
| hidden | boolean | NO | false |  |
| created_at | timestamp with time zone | NO | now() |  |
| org_id → organizations.id | uuid | NO | current_org() |  |

## threads

Rows (estimate): 0

| column | type | nullable | default | comment |
|---|---|---|---|---|
| **id** (PK) | uuid | NO | gen_random_uuid() |  |
| author_id | uuid | NO |  |  |
| title | text | NO |  |  |
| body | text | NO |  |  |
| pinned | boolean | NO | false |  |
| locked | boolean | NO | false |  |
| hidden | boolean | NO | false |  |
| created_at | timestamp with time zone | NO | now() |  |
| last_post_at | timestamp with time zone | NO | now() |  |
| org_id → organizations.id | uuid | NO | current_org() |  |

## tier_modules

Rows (estimate): 15

| column | type | nullable | default | comment |
|---|---|---|---|---|
| **tier_key** (PK) → tiers.tier_key | text | NO |  |  |
| **module_key** (PK) → modules.module_key | text | NO |  |  |

## tiers

Rows (estimate): 5

| column | type | nullable | default | comment |
|---|---|---|---|---|
| **tier_key** (PK) | text | NO |  |  |
| name | text | NO |  |  |
| monthly_price | numeric | YES |  |  |
| sort_order | integer | NO | 0 |  |
| active | boolean | NO | true |  |
| created_at | timestamp with time zone | NO | now() |  |

## time_entries

Rows (estimate): 0

| column | type | nullable | default | comment |
|---|---|---|---|---|
| **id** (PK) | uuid | NO | gen_random_uuid() |  |
| org_id → organizations.id | uuid | NO | current_org() |  |
| clock_in | timestamp with time zone | NO |  |  |
| clock_out | timestamp with time zone | YES |  |  |
| minutes | integer | YES |  |  |
| source_kind | text | YES |  |  |
| source_id | uuid | YES |  |  |
| created_at | timestamp with time zone | NO | now() |  |
| updated_at | timestamp with time zone | NO | now() |  |
| deleted_at | timestamp with time zone | YES |  |  |
| deleted_by → profiles.user_id | uuid | YES |  |  |
| staff_user_id → profiles.user_id | uuid | NO |  |  |

## vendors

Rows (estimate): 0

| column | type | nullable | default | comment |
|---|---|---|---|---|
| **id** (PK) | uuid | NO | gen_random_uuid() |  |
| org_id → organizations.id | uuid | NO |  |  |
| name | text | NO |  |  |
| category | text | YES |  |  |
| url | text | YES |  |  |
| phone | text | YES |  |  |
| email | text | YES |  |  |
| note | text | YES |  |  |
| shared | boolean | NO | false |  |
| created_by | uuid | YES |  |  |
| created_at | timestamp with time zone | NO | now() |  |
| updated_at | timestamp with time zone | NO | now() |  |

