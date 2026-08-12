### ITEM [batch1.md#9]
- report: TASK-COUNTFIX-REPORT.md
- date: 2026-08-12
- item: The spec's hypothesis for member document counts was wrong: my_documents() has never listed a document the member cannot open (it is a strict subset of documents_select RLS), so the wider count was correct all along.
- quote: "The task expected the **wider** count to be the bad one ... **Checked against the RLS: false.**"
- kind: correction
- artifacts: my_documents, documents_select
- decision-mention: none

### ITEM [batch1.md#20]
- report: TASK-COUNTFIX-REPORT.md
- date: 2026-08-12
- item: Flagged: countOpenLessonSlots() is org-scoped by RLS only, trusting the bookings policies rather than naming an org — consistent with its neighbour, noted because it is a new reader.
- quote: "**`countOpenLessonSlots()` is org-scoped by RLS only** — like `listLessonSessions()`, it trusts the `bookings` policies rather than naming an org."
- kind: correctness
- artifacts: countOpenLessonSlots, bookings
- decision-mention: none

### ITEM [batch1.md#63]
- report: TASK-DUPECENSUS-REPORT.md
- date: 2026-08-12
- item: Finding 3.6: if mod.employees is ever enabled, TeamPage vs StaffPage becomes a Tier 2 duplicate — TeamPage owns roles/suspension/invitations/instructor grants; StaffPage owns title and pay type.
- quote: "**If `mod.employees` is ever enabled, this becomes a Tier 2 duplicate.**"
- kind: inventory
- artifacts: src/pages/app/ops/TeamPage.tsx, StaffPage
- decision-mention: none

### ITEM [batch1.md#77]
- report: TASK-GOOGLEAUTH-REPORT.md
- date: 2026-08-11
- item: Open decision 1 (does the password survive after Google linking) was implemented as "yes, it survives", but explicitly flagged as still the owner's call; no removal control was built.
- quote: "**Flagging rather than deciding: this is still the owner's call, and nothing here forecloses it.**"
- kind: blocked-on-owner
- artifacts: src/components/app/profile/LoginSecurityCard.tsx
- decision-mention: none

### ITEM [batch1.md#78]
- report: TASK-GOOGLEAUTH-REPORT.md
- date: 2026-08-11
- item: Finding: the pre-existing @gmail.com domain gate hid the Google-activation control from every eligible member (all four password-only accounts are @icloud.com) — 0 of 4 could see it, so the redirect path has never been exercised in production.
- quote: "in production it was not a partial restriction — **it hid the control from every single member it was for.**"
- kind: defect
- artifacts: src/components/app/profile/LoginSecurityCard.tsx
- decision-mention: none

### ITEM [batch1.md#86]
- report: TASK-INVITEWORKS-REPORT.md
- date: 2026-08-11
- item: Not verified: the staff send leg (§A resend/regenerate and §C links panel UI) — no worktree gets a staff login per the 2026-08-10 VERIFICATION POLICY; a 10-step post-deploy checklist is provided.
- quote: "**Not verified: the staff send leg.** Per the VERIFICATION POLICY ruling of 2026-08-10 no worktree gets a staff login."
- kind: not-verified
- artifacts: api/admin-resend-invitation.ts, InvitationHistoryPanel.tsx, InviteResultPanel.tsx, Admin.tsx, TeamPage.tsx
- decision-mention: none

### ITEM [batch1.md#87]
- report: TASK-INVITEWORKS-REPORT.md
- date: 2026-08-11
- item: Flagged, not widened: invitations RLS is is_admin() (not has_staff_access()), so an instructor (MANAGER/EMPLOYEE) sees an empty invitation-links panel rather than a permission error — pre-existing, unchanged.
- quote: "that RLS pair is `is_admin()`, not `has_staff_access()` — so an instructor (MANAGER/EMPLOYEE) sees an empty panel rather than a permission error. Pre-existing, unchanged, flagged rather than widened."
- kind: defect
- artifacts: invitations RLS, InvitationHistoryPanel.tsx
- decision-mention: none

### ITEM [batch1.md#92]
- report: TASK-INVITEWORKS-REPORT.md
- date: 2026-08-11
- item: Security trap found: Supabase default privileges grant EXECUTE to anon at CREATE time, so REVOKE FROM PUBLIC does not close a function; caught on first apply of 20260811170000; the other ~48 SECURITY DEFINER functions relying on a PUBLIC revoke alone are worth checking — reachable by anon today.
- quote: "**Worth checking the other ~48 SECURITY DEFINER functions** — anything relying on a PUBLIC revoke alone is reachable by `anon` today."
- kind: security
- artifacts: SECURITY DEFINER functions, supabase/migrations/20260811170000_inviteworks_resend_support.sql, record_invitation_delivery
- decision-mention: none

### ITEM [batch1.md#119]
- report: TASK-LEASEFIX-REPORT.md
- date: 2026-08-10
- item: Still open: whether the Lessor's own-coverage election (TXN.GL_LESSOR_COVERAGE) should gate anything — it currently gates nothing, which is deliberate (CCC rides on the Lessee's policy).
- quote: "Whether the Lessor's own-coverage election should gate anything. It currently gates nothing, which is deliberate"
- kind: blocked-on-owner
- artifacts: TXN.GL_LESSOR_COVERAGE, 20260809T2200_leasefix_gl_lessor_own_coverage.sql
- decision-mention: none

---

### ITEM [batch1.md#121]
- report: TASK-NOGUARD2-REPORT.md
- date: 2026-08-10
- item: Correction to input docs: the "nine anon-reachable contract_fields writers" are seven — contract_split_deductible_sync and sync_horse_fields_to_documents are RETURNS trigger and cannot be called directly.
- quote: "Two of the nine are an artifact of that dropped filter."
- kind: correction
- artifacts: contract_split_deductible_sync, sync_horse_fields_to_documents
- decision-mention: none

### ITEM [batch1.md#122]
- report: TASK-NOGUARD2-REPORT.md
- date: 2026-08-10
- item: Correction to the audit: remove_document_co_buyer IS anon-reachable with no identity check at all (deletes BUYER rows and clears COBUYER.* values given only a document id), and set_field_structured is a fourth lock-caller the audit omits.
- quote: "**`remove_document_co_buyer` carries no identity check at all** — it deletes `BUYER` rows from `document_parties` and `contract_parties` and clears every `COBUYER.*` value, given only a document id."
- kind: security
- artifacts: remove_document_co_buyer, set_field_structured, set_document_co_buyer
- decision-mention: none

### ITEM [batch1.md#124]
- report: TASK-NOGUARD2-REPORT.md
- date: 2026-08-10
- item: Correction to the task doc: "revoking breaks the in-database caller" is false here — SECURITY DEFINER callers execute as postgres, which keeps EXECUTE; revoking closes the HTTP surface and leaves the internal call graph untouched; this changed the strategy from seven guards to revoke-six-guard-one.
- quote: "**Revoking closes the HTTP surface and leaves the internal call graph untouched.**"
- kind: correction
- artifacts: apply_field_formats, noguard2_probe_wrapper
- decision-mention: none

### ITEM [batch1.md#126]
- report: TASK-NOGUARD2-REPORT.md
- date: 2026-08-10
- item: A distinct failure shape found while sweeping: guards that explicitly exempt the unidentified caller (IF auth.uid() IS NOT NULL AND NOT …) in remerge_contract_from_fields and invite_contract_counterparty — not an anon hole (neither is anon-executable) but an authenticated exposure belonging to NOGUARD3; a class worth grepping for.
- quote: "Two functions carry a guard that **explicitly exempts the unidentified caller** — the inverse of the NULL-propagation bug"
- kind: security
- artifacts: remerge_contract_from_fields, invite_contract_counterparty
- decision-mention: none

### ITEM [batch1.md#127]
- report: TASK-NOGUARD2-REPORT.md
- date: 2026-08-10
- item: 45 functions remain DOES-NOT-ENFORCE, deliberately left with reasons per group: 7 safe by construction; 4 config reads; 4 api-called log writers (receipt/idempotency seam — log_receipt_send burning an idempotency key can suppress a real receipt); 14 document/deal readers leaking by document id (need per-function party guards — a coherent third phase); 8 horse/member readers (animal medical data, name/address lookups); 8 writers needing designed guards (complete_deal, assert_horse_care_eligible which creates documents despite the name, etc.).
- quote: "Deliberately left, grouped by reason. Nothing here is left for lack of time; each has a reason it should not be changed by this task."
- kind: security
- artifacts: log_receipt_send, contract_notes_for_document, document_signature_state, party_user_ids, horse_medications_prose, member_horses, complete_deal, assert_horse_care_eligible, supersede_invitations, ensure_staff_profile
- decision-mention: none

### ITEM [batch1.md#130]
- report: TASK-NOGUARD2-REPORT.md
- date: 2026-08-10
- item: Out of scope but named: NOGUARD3's real question is untouched — 370 definer functions are still callable by any free signup, most with browser callers needing predicates, not grant changes; on consequence this still outranks what this task closed.
- quote: "**370** definer functions are still callable by any free signup, and most of them *do* have browser callers, so they cannot be fixed by a grant"
- kind: security
- artifacts: (370 SECURITY DEFINER functions)
- decision-mention: none

### ITEM [batch1.md#131]
- report: TASK-NOGUARD2-REPORT.md
- date: 2026-08-10
- item: A new SECURITY DEFINER function landed mid-task: compose_insurance_allocation (leasefix thread, 2026-08-09) — anon/PUBLIC revoked (good pattern to copy) but authenticated-reachable, which is NOGUARD3's surface.
- quote: "one was added since the audit: `compose_insurance_allocation(uuid)`, from the leasefix thread on 2026-08-09 ... It is `authenticated`-reachable, which is NOGUARD3's surface."
- kind: security
- artifacts: compose_insurance_allocation
- decision-mention: none

### ITEM [batch1.md#134]
- report: TASK-NOGUARD2-REPORT.md
- date: 2026-08-10
- item: The PostgREST HTTP layer was not probed (no real anon key available); all anon behaviour was demonstrated at the database layer with the role and JWT claim PostgREST sets.
- quote: "**The PostgREST HTTP layer.** Not probed, for want of a real anon key."
- kind: not-verified
- artifacts: PostgREST, .env
- decision-mention: none

### ITEM [batch1.md#135]
- report: TASK-NOGUARD2-REPORT.md
- date: 2026-08-10
- item: The three retained service_role paths (confirm_booking_for_purchase, lease_expiry_nudge, publish_open_slots_all) were privilege-checked but deliberately not executed — running them would notify every lessee / write availability across every tenant.
- quote: "**The `service_role` sweeps were not executed**, only privilege-checked."
- kind: not-verified
- artifacts: confirm_booking_for_purchase, lease_expiry_nudge, publish_open_slots_all
- decision-mention: none

### ITEM [batch1.md#141]
- report: TASK-PROFILE-REPORT.md
- date: 2026-08-05
- item: Real undocumented leak found: member_directory still exposes the legacy contacts.mobile/.whatsapp/.email columns gated only by hide flags that have no UI to set them — known deferred cleanup ("Stage B drops the columns"), which drove the decision to add a new mobile_number column rather than reuse contacts.mobile.
- quote: "**A real, undocumented leak found while mapping the community read path**: `member_directory` still exposes the *legacy* `contacts.mobile`, `.whatsapp`, `.email` columns ... gated only by ... flags with **no UI to set them**"
- kind: security
- artifacts: member_directory, contacts.mobile, contacts.whatsapp, contacts.email
- decision-mention: none

### ITEM [batch2.md#7]
- report: POST_RUN_CLOSEOUT.md
- date: 2026-08-02
- item: The real-email H3 check against admin@fhequestrian.com is not applicable — the account is Google-OAuth-only with no password-grant equivalent for scripted testing; reported as N/A rather than blocked.
- quote: "That account authenticates via Google OAuth ... — there is no password-grant equivalent to exercise via curl."
- kind: not-verified
- artifacts: /api/deliver-my-document, auth.identities
- decision-mention: D22

### ITEM [batch2.md#33]
- report: TASK-B-REPORT.md
- date: 2026-08-04
- item: Deviation flagged: the task's Goal frames support requests as a public website form, but support_requests RLS requires an authenticated member — the three outcomes were built anyway since the table is explicitly in scope, but the mismatch is flagged in case the intent was narrower.
- quote: "`support_requests` RLS (`support_own_insert`) requires `user_id = auth.uid()` — it's submitted by an authenticated app member from `/app/account`, not by an anonymous website visitor."
- kind: correctness
- artifacts: support_requests, submit_support_request, src/pages/app/Support.tsx
- decision-mention: none

### ITEM [batch2.md#35]
- report: TASK-B-REPORT.md
- date: 2026-08-04
- item: The public-intake email path fix was verified by code inspection and type/lint only — no live HTTP call possible (no SUPABASE_SERVICE_ROLE_KEY locally to invoke the Vercel function).
- quote: "the live email send for the public path was verified by code inspection + the type/lint pass, not a live HTTP call."
- kind: not-verified
- artifacts: api/request-received.ts, PublicIntakeForm.tsx
- decision-mention: none

### ITEM [batch2.md#65]
- report: TASK-PLUSPASS-REPORT.md
- date: 2026-08-06
- item: No live browser session was possible (only placeholder Supabase credentials locally) — everything is code reading, a clean build, and 16 component tests; RLS enforcement, visual placement/responsive wrapping at real breakpoints, and the real AppLayout shell are all NOT verified.
- quote: "**I could not sign into the running app.** ... So there was no way to drive a real authenticated browser click-through in this environment, as either a member or an admin."
- kind: not-verified
- artifacts: PageCreateButton.tsx, CreateModalContext.tsx, Home.tsx, MyPosts.tsx, CalendarPage.tsx, AccountHub.tsx, Messages.tsx
- decision-mention: none

### ITEM [batch2.md#101]
- report: TASK-ROSTERCARD-REPORT.md
- date: 2026-08-11
- item: The embedded-resource query (document_parties with embedded documents) could not be exercised without a real session — FK and precedent verified, but not independently exercised this session.
- quote: "**The embedded-resource query** ... can't be exercised without a real session (the `.env` in this worktree is a placeholder — no anon key). ... Not independently exercised this session."
- kind: not-verified
- artifacts: document_parties, src/lib/ops/api-documents.ts
- decision-mention: none

### ITEM [batch2.md#105]
- report: TASK-ROSTERCARD-REPORT.md
- date: 2026-08-11
- item: Known limitation stated plainly: the outstanding-documents flag is a partial signal — contact_required_documents has RLS enabled with zero policies (deny-all for authenticated), contact_checklist is service_role-only, and admin_client_documents covers only account-kind rows; the flag catches "started but not finished," not "required but never generated." No grant or bulk RPC was added per the no-database-work constraint.
- quote: "`contact_required_documents` ... has RLS enabled with **zero policies** — deny-all for the `authenticated` role, confirmed live. The one RPC that computes real per-document completion, `contact_checklist(contact_id)`, is granted to `service_role` only"
- kind: defect
- artifacts: contact_required_documents, contact_checklist, admin_client_documents, RosterCard.tsx
- decision-mention: none

### ITEM [batch3.md#27]
- report: TASK-INBOUNDALERT-REPORT.md
- date: 2026-08-12
- item: claim_receipt_send / log_receipt_send are still executable by anon and authenticated — anyone with the public anon key can forge receipt-send evidence or claim a key to suppress a real send. Not touched (not this task's table).
- quote: "**`claim_receipt_send` / `log_receipt_send` are executable by `anon` and `authenticated`.** Anyone with the public anon key can write `receipt_sends` rows claiming a receipt was sent, or claim one to suppress a real send."
- kind: security
- artifacts: claim_receipt_send, log_receipt_send, receipt_sends
- decision-mention: none

### ITEM [batch3.md#30]
- report: TASK-INBOUNDALERT-REPORT.md
- date: 2026-08-12
- item: Grant trap caught by verifying: REVOKE FROM PUBLIC was a silent no-op because ALTER DEFAULT PRIVILEGES grants anon/authenticated explicitly; the migration now names every role. (Recurring project-wide trap.)
- quote: "`REVOKE … FROM PUBLIC` was a **silent no-op** — this project's `ALTER DEFAULT PRIVILEGES` grants `anon`/`authenticated` explicitly, so a PUBLIC-only revoke left them untouched."
- kind: process
- artifacts: 20260812T2000_inboundalert_request_alert_attempts.sql, claim_request_alert_send, log_request_alert_send
- decision-mention: none

### ITEM [batch3.md#41]
- report: TASK-LEASEMAP-REPORT.md
- date: 2026-08-07
- item: F10 — COORDINATION's gate does not test the Lessor's mortality status, so the document can name the Lessor's mortality policy as first-claimed two items below a line saying no such policy exists.
- quote: "**F10 — `COORDINATION` names a policy the document may say does not exist.**"
- kind: defect
- artifacts: COORDINATION clause, HORSE_LEASE_V2
- decision-mention: none

### ITEM [batch3.md#42]
- report: TASK-LEASEMAP-REPORT.md
- date: 2026-08-07
- item: F11 — entity lessee with mortality waived produces two owners of the same loss (MORT_NONE and CCC) with the ordering clause switched off; nothing states which policy responds or who keeps proceeds.
- quote: "**F11 — entity lessee with mortality waived produces two owners of the same loss.**"
- kind: defect
- artifacts: MORT_NONE, CCC, COORDINATION, HORSE_LEASE_V2
- decision-mention: none

### ITEM [batch3.md#44]
- report: TASK-LEASEMAP-REPORT.md
- date: 2026-08-07
- item: F13 — the deductible sentence misdescribes whose policy it is, printing identically whether the policy is Lessor's or Lessee's.
- quote: "**F13 — the deductible sentence misdescribes whose policy it is.**"
- kind: defect
- artifacts: *_DEDR_SIMPLE clauses, HORSE_LEASE_V2
- decision-mention: none

### ITEM [batch3.md#54]
- report: TASK-LEASEMAP-REPORT.md
- date: 2026-08-07
- item: No field, upload, date, or status anywhere records whether proof of insurance coverage was given or a policy actually exists, despite four clauses saying "shall provide proof of coverage upon request".
- quote: "A policy is actually in force | nowhere | ... There is no field, upload, date or status anywhere that records whether proof was given or a policy exists."
- kind: defect
- artifacts: CCC, GL_LESSEE_RESP, MORT_LESSEE_RESP, MED_LESSEE_RESP
- decision-mention: none

### ITEM [batch3.md#88]
- report: TASK-SIGREAD-REPORT.md
- date: 2026-08-06
- item: signatures_select gates staff visibility on is_admin() rather than the broader has_staff_access() used elsewhere — pre-existing, flagged, not touched.
- quote: "(`signatures_select` gates on `is_admin()`, not the broader `has_staff_access()` used elsewhere — pre-existing, not something this task touches.)"
- kind: caveat
- artifacts: signatures_select policy, signatures table
- decision-mention: none

---

### ITEM [batch4.md#10]
- report: TASK-ACCTEVAL-REPORT.md
- date: 2026-08-06
- item: U1 — Every member's real email and mobile number are readable without signing in, via the anon-granted member_directory view that bypasses RLS.
- quote: "U1 — Every member's real email address and mobile number are readable without signing in ... `anon` — the role an unauthenticated browser request executes as — holds `SELECT` on it. RLS on `contacts` and `profiles` is therefore never evaluated"
- kind: security
- artifacts: member_directory, contacts, profiles, profile-images bucket
- decision-mention: none

### ITEM [batch4.md#11]
- report: TASK-ACCTEVAL-REPORT.md
- date: 2026-08-06
- item: U2 — Four more anon-readable views share the same shape, including inbound_queue which carries staff_notes.
- quote: "U2 — Four more views have the same shape, including one carrying staff notes ... `inbound_queue` columns include `contact_email`, `contact_phone`, `notes`, **`staff_notes`**"
- kind: security
- artifacts: clients_overview, inbound_queue, memberships, service_credits, member_directory
- decision-mention: none

### ITEM [batch4.md#12]
- report: TASK-ACCTEVAL-REPORT.md
- date: 2026-08-06
- item: U3 — A member can repoint their own profiles.contact_id at another person's contact record (no column guard on contact_id), giving read/write on that contact.
- quote: "U3 — A member can repoint their own account at another person's contact record ... The only column guard is the trigger `profiles_role_guard_trg` ... and **not** `contact_id`."
- kind: security
- artifacts: profiles.contact_id, profiles_role_guard_trg, contacts_select, contacts_update_own, current_contact_id()
- decision-mention: none

### ITEM [batch4.md#14]
- report: TASK-ACCTEVAL-REPORT.md
- date: 2026-08-06
- item: U4 — profiles_role_guard is BEFORE UPDATE only; the first insert of a profile row is unguarded, allowing role/is_admin/org_id to be set on insert. Two signed-in users have no profiles row today.
- quote: "U4 — `profiles_role_guard` is `BEFORE UPDATE` only; the first insert of a profile row is unguarded ... `authenticated` holds `INSERT` on `role`, `is_admin` and `org_id`"
- kind: security
- artifacts: profiles_role_guard_trg, profiles_insert_own, auth.users
- decision-mention: none

### ITEM [batch4.md#15]
- report: TASK-ACCTEVAL-REPORT.md
- date: 2026-08-06
- item: U5 — _ensure_client_account is anon-executable with no caller check (no is_admin/has_staff_access/auth.uid test); org taken from parameter, writes clients/contacts.
- quote: "U5 — `_ensure_client_account` is anon-executable with no caller check ... There is no `is_admin()`, `has_staff_access()` or `auth.uid()` test anywhere in it, and the org is taken from the `p_org` parameter rather than from the caller."
- kind: security
- artifacts: _ensure_client_account, clients, contacts, contact_required_documents
- decision-mention: none

### ITEM [batch4.md#18]
- report: TASK-ACCTEVAL-REPORT.md
- date: 2026-08-06
- item: adminUpdateProfile exposes profiles.email as free-text, and email-change-complete authenticates the password proof against that editable value.
- quote: "`email-change-complete.ts` proves the password by calling `signInWithPassword({ email: profile.email, password })` — i.e. the value an admin can edit is the address the proof authenticates against."
- kind: security
- artifacts: adminUpdateProfile, api/email-change-complete.ts, profiles.email
- decision-mention: none

### ITEM [batch4.md#23]
- report: TASK-ACCTEVAL-REPORT.md
- date: 2026-08-06
- item: Two-factor authentication is unreachable for any member — TwoFactorSettings renders only on /account which immediately redirects members to /app; MFA is still enforced at sign-in with no surface to enrol/unenrol.
- quote: "Two-factor authentication is unreachable for any member ... there is simply no reachable surface to enrol or unenrol one."
- kind: correctness
- artifacts: TwoFactorSettings, Account.tsx, LoginSecurityCard, Login.tsx
- decision-mention: none

### ITEM [batch4.md#25]
- report: TASK-ACCTEVAL-REPORT.md
- date: 2026-08-06
- item: Legacy directory columns hide_email/hide_mobile/hide_whatsapp have zero references (no control writes them) yet member_directory gates on them and they ship on the wire in every directory response.
- quote: "Legacy directory columns with no control and an active publisher ... those three columns are on the wire in every directory response delivered to every member's browser"
- kind: security
- artifacts: hide_email, hide_mobile, hide_whatsapp, member_directory, fetchMemberDirectory
- decision-mention: none

### ITEM [batch4.md#31]
- report: TASK-ACCTEVAL-REPORT.md
- date: 2026-08-06
- item: A member can, through the REST API only (no screen), read and write their own notes, tags, contact_type, is_company, guardian_contact_id, date_of_birth (drives C10 minor rules), emergency contacts, etc. — contacts_update_own has no column predicate.
- quote: "through the REST API and not through any screen, a member may read and write their own: `notes` ... `date_of_birth` (which drives the C10 minor rules), all six emergency-contact fields, `deleted_at`, `display_code`, and the four riding-background fields."
- kind: security
- artifacts: contacts_update_own, contacts_select, contacts, date_of_birth
- decision-mention: none

### ITEM [batch4.md#34]
- report: TASK-ACCTEVAL-REPORT.md
- date: 2026-08-06
- item: Two SECURITY DEFINER RPCs (contact_dossier, update_contact_record) grant MANAGER/EMPLOYEE person-record access the table RLS policies deny them; dormant today because no MANAGER/EMPLOYEE account exists.
- quote: "The two `SECURITY DEFINER` RPCs therefore grant instructor/employee roles a level of access to person records that the table policies deny them. No account in production currently holds `MANAGER` or `EMPLOYEE`"
- kind: security
- artifacts: contact_dossier, update_contact_record, contacts_select, has_staff_access
- decision-mention: none

### ITEM [batch4.md#35]
- report: TASK-ACCTEVAL-REPORT.md
- date: 2026-08-06
- item: contact_dossier returns the entire contacts row (to_jsonb) including columns on no screen (zelle_phone, zelle_email, all hide_* flags, community channels) delivered in the payload.
- quote: "`contact_dossier` returns `to_jsonb(c)`, the entire row. The dossier UI renders about 25 of the 66 columns; the remaining columns ... are in the response payload but on no screen."
- kind: security
- artifacts: contact_dossier, ContactDossierModal
- decision-mention: none

### ITEM [batch4.md#39]
- report: TASK-ACCTEVAL-REPORT.md
- date: 2026-08-06
- item: Could not confirm the anon-readable views are reachable over HTTPS in production — proved the anon role reads at the DB but could not issue the HTTP request (placeholder URL/key locally); PostgREST reachability is an inference.
- quote: "Whether the anon-readable views are reachable over HTTPS in production. I proved the `anon` role reads all six `member_directory` rows at the database. I could not issue the HTTP request"
- kind: not-verified
- artifacts: member_directory, PostgREST
- decision-mention: none

### ITEM [batch4.md#48]
- report: TASK-ADMINSWEEP-PHASE2.md
- date: 2026-08-11
- item: D-1 — OpsDashboard's docstring is stale: promises four KPI tiles but code renders two, across a still-four-column grid.
- quote: "D-1 · The file's own docstring is stale. It describes 'Four RLS-scoped KPI tiles ...' The code has two. Engagements and charges were removed and the comment was not."
- kind: correctness
- artifacts: OpsDashboard
- decision-mention: D-1

### ITEM [batch4.md#72]
- report: TASK-DOCQUEUE-REPORT.md
- date: 2026-08-11
- item: RLS observation found not touched — documents_select/contacts_select/horses_select gate org-wide read behind is_admin(), but frontend isStaff includes MANAGER/EMPLOYEE, so those roles would see a partial queue; dormant today (no such accounts).
- quote: "One RLS observation — found, not touched ... a MANAGER/EMPLOYEE user hitting this page would, under current RLS, see only documents/contacts/horses they own ... **This is pre-existing and unchanged by this task**"
- kind: security
- artifacts: documents_select, contacts_select, horses_select, listDocuments, ProtectedRoute
- decision-mention: none

### ITEM [batch4.md#77]
- report: TASK-NOGUARD3-REPORT.md
- date: 2026-08-11
- item: feed_post_delete / feed_post_update let any signed-in account delete or rewrite the 9 live posts with NULL author_id (NULL propagation through a nullable stored column) — REAL, exploitable; FIXED in Phase A.
- quote: "**Any signed-in account could delete or rewrite those 9 posts.** ... REAL — exploitable, 9 live rows. FIXED in Phase A."
- kind: security
- artifacts: feed_post_delete, feed_post_update, feed_posts.author_id
- decision-mention: none

### ITEM [batch4.md#78]
- report: TASK-NOGUARD3-REPORT.md
- date: 2026-08-11
- item: Every fresh signup begins contactless (auth.uid non-NULL, current_contact_id/current_org NULL) because nothing provisions a profile at signup (no trigger on auth.users); two such real users exist.
- quote: "**Nothing provisions a profile at signup.** ... **every fresh signup begins in exactly this state** ... Two of ten `auth.users` have no `profiles` row"
- kind: security
- artifacts: current_contact_id, current_org, auth.users, profiles
- decision-mention: none

### ITEM [batch4.md#81]
- report: TASK-NOGUARD3-REPORT.md
- date: 2026-08-11
- item: B4 — a policy decision the owner must make (operator org-scoped / platform-role / leave it) that sequences before any coalesce sweep; recommended Option 1 but not taken because it's a real-data change.
- quote: "The decision this forces — B4, for the owner ... I recommend **Option 1**, and I did not take it, because it is a data change to a real row and the decision is the owner's."
- kind: blocked-on-owner
- artifacts: profiles.org_id, admin@cactai.io, is_super_admin()
- decision-mention: B4

### ITEM [batch4.md#82]
- report: TASK-NOGUARD3-REPORT.md
- date: 2026-08-11
- item: The vulnerable house-guard idiom is still being written — three new SECURITY DEFINER functions (can_cleanup_document etc.) landed mid-session in the same NULL class; the class regenerates faster than per-function auditing.
- quote: "**A brand-new, well-written, security-conscious function lands in the same NULL class, because the idiom is the house style.** ... this class regenerates faster than it can be audited one function at a time."
- kind: security
- artifacts: can_cleanup_document, cleanup_document, document_integrity
- decision-mention: none

### ITEM [batch4.md#83]
- report: TASK-NOGUARD3-REPORT.md
- date: 2026-08-11
- item: Two inverted guards (remerge_contract_from_fields, invite_contract_counterparty) with the auth.uid() IS NOT NULL AND NOT(...) shape — not currently exploitable, defensively rewritten in Phase B.
- quote: "**Neither of the two is currently exploitable, and I would rather say so than dress it up** ... The change is defensive — a guard that cannot fire for the caller it names stops anyone from looking again."
- kind: security
- artifacts: remerge_contract_from_fields, invite_contract_counterparty
- decision-mention: none

### ITEM [batch4.md#84]
- report: TASK-NOGUARD3-REPORT.md
- date: 2026-08-11
- item: _provision_purchase_for_offerings was granted to anon/authenticated and lets any free signup mint a purchase marked paid (caller-supplied p_mark_paid); revoked in Phase B.
- quote: "**The highest-consequence item is `_provision_purchase_for_offerings`**: it creates a purchase for a caller-supplied contact/client/org with a caller-supplied `p_mark_paid`, so any free signup could mint a purchase marked **paid**."
- kind: security
- artifacts: _provision_purchase_for_offerings
- decision-mention: none

### ITEM [batch4.md#85]
- report: TASK-NOGUARD3-REPORT.md
- date: 2026-08-11
- item: generate_document is a SECURITY INVOKER function that creates documents and is granted to anon — left alone as a larger decision than this migration should make; deserves its own look.
- quote: "**The more interesting finding is the one I did not act on:** `generate_document` is a `SECURITY INVOKER` function that creates documents and is granted to `anon`. It is left alone because changing it is a larger decision than this migration should make."
- kind: security
- artifacts: generate_document, documents
- decision-mention: none

### ITEM [batch4.md#86]
- report: TASK-NOGUARD3-REPORT.md
- date: 2026-08-11
- item: The document/deal/horse/member readers reachable by id (group d/e, several write) are genuine info leaks left for a Phase C — deferred because the obvious guard denies the platform operator until B4 is settled.
- quote: "These are genuine information leaks and several write. **They are not in Phase B because the obvious guard ... denies the platform operator ... B4 first, then this group as a coherent Phase C.**"
- kind: security
- artifacts: contract_notes_for_document, contract_comments_list, document_signature_state, deal_completion_state, member_horses, complete_deal
- decision-mention: B4

### ITEM [batch4.md#87]
- report: TASK-NOGUARD3-REPORT.md
- date: 2026-08-11
- item: feed_post_create is safe only by accident — a NULL p_as_company skips the guard and is stopped only by a NOT NULL column constraint; flagged, not changed.
- quote: "`feed_post_create` | Safe in effect, **by accident** ... NOGUARD1's 'safe only because of a column constraint' class. Flagged, not changed."
- kind: security
- artifacts: feed_post_create, feed_posts.as_company
- decision-mention: none

### ITEM [batch4.md#90]
- report: TASK-NOGUARD3-REPORT.md
- date: 2026-08-11
- item: The 23 Phase B revokes were not exercised through every real in-database caller (mechanism re-demonstrated but individual chains not run to avoid mutating real rows).
- quote: "**The 23 Phase B revokes were not exercised through every real in-database caller.** ... the individual chains were not run, because each creates or mutates real contract, purchase or document rows."
- kind: not-verified
- artifacts: none
- decision-mention: none

### ITEM [batch4.md#91]
- report: TASK-NOGUARD3-REPORT.md
- date: 2026-08-11
- item: The definer-function snapshot moved during the session (442→445, 371→374); classification is of the 371 while Phase B arithmetic is against the live number.
- quote: "**The snapshot moved under me.** `definer_total` 442 → 445 and `auth_callable` 371 → 374 during this session. ... NOGUARD1's caveats #8 and #9 are not theoretical — they bit twice in one session."
- kind: process
- artifacts: none
- decision-mention: none

### ITEM [batch5.md#16]
- report: TASK-A-PARTY-VERIFY-2-REPORT.md
- date: 2026-08-06
- item: `document_parties` has no permissive non-staff read policy, so a genuine party silently gets zero rows from a direct read — blocking the "Contracts you've signed" richer view/download UI; diagnosed, not fixed (needs a dedicated RLS policy migration).
- quote: "**Not fixed here** — this is an RLS/migration change (new permissive SELECT policy needed on `document_parties` for `contact_id = current_contact_id()`), out of scope for in-line patching"
- kind: security
- artifacts: document_parties, document_parties_org_boundary, document_parties_staff_all, listMySignableDocuments
- decision-mention: none

### ITEM [batch5.md#24]
- report: TASK-A-PARTY-VERIFY-2-REPORT.md
- date: 2026-08-06
- item: The document-card status stamp trail ("Complete" badge + chronological Created/Sent/Signed/Sent-to-you stamps, plus a my_resends column on my_documents()) is spec'd only, not built — deferred to a separate build; document_deliveries also lacks a party-facing RLS policy (same gap class as document_parties).
- quote: "Owner request, deferred to a separate build alongside the RLS/invite-provisioning fixes above."
- kind: deferred
- artifacts: my_documents(), document_deliveries, executed-document card
- decision-mention: none

### ITEM [batch5.md#26]
- report: TASK-A-PARTY-VERIFY-2-REPORT.md
- date: 2026-08-06
- item: Incident disposition — the premature "Send to both parties" that landed on Sarah Rosengard's real lease (invitation already redeemed) is accepted as a live negotiation going forward; the document is left alone entirely by ruling.
- quote: "left alone entirely. The premature send is accepted as a live, real negotiation going forward; her field permissions were separately unlocked at the orchestrator level."
- kind: process
- artifacts: documents (704c8d2d), src/pages ContractPage.tsx
- decision-mention: none

---

### ITEM [batch5.md#55]
- report: TASK-DOCPACKET-REPORT.md
- date: 2026-08-11
- item: admin_client_documents keeps its pre-existing PUBLIC EXECUTE grant — grants were restored byte-for-byte and no REVOKE was added; tightening its access posture is flagged as a separate decision not made here.
- quote: "**No REVOKE was added** — tightening that function's access posture is a separate, unrelated decision and wasn't made here."
- kind: security
- artifacts: admin_client_documents(uuid), supabase/migrations/20260811T1300_docpacket_admin_documents_wall_gating.sql
- decision-mention: none

---

### ITEM [batch5.md#88]
- report: TASK-SECFIX-REPORT.md
- date: 2026-08-07
- item: Open item needing a decision — member_directory could not take security_invoker (directory collapses 6→1 for ordinary members because base-table RLS is self-only); anon SELECT was revoked instead, but the view still executes with postgres rights and bypasses RLS for any caller that can reach it. Options: directory-scoped SELECT policies then invoker on, or convert to a SECURITY DEFINER RPC.
- quote: "`member_directory` still executes with `postgres`'s rights and still bypasses RLS for any caller that can reach it. **Decision needed**"
- kind: security
- artifacts: member_directory, profiles, contacts, src/lib/community.ts
- decision-mention: none

### ITEM [batch5.md#89]
- report: TASK-SECFIX-REPORT.md
- date: 2026-08-07
- item: The task doc's literal S2 fix (REVOKE UPDATE (contact_id) ... FROM authenticated) is a silent no-op against a table-level grant — PostgreSQL reports success while the takeover still works; the real fix drops the table-level grant and re-grants 28 columns.
- quote: "Because the grant is **table-level**, a column-scoped REVOKE does nothing — and PostgreSQL reports success"
- kind: correction
- artifacts: profiles, supabase/migrations/20260807120000_secfix_s2_profiles_contact_id_grant.sql
- decision-mention: none

### ITEM [batch5.md#90]
- report: TASK-SECFIX-REPORT.md
- date: 2026-08-07
- item: The task doc's literal S3 fix is also a silent no-op — revoking EXECUTE from anon alone leaves the PUBLIC grant on _ensure_client_account; PUBLIC must be revoked too.
- quote: "So `REVOKE … FROM anon` would have committed cleanly and left `anon` able to execute. PUBLIC must go too."
- kind: correction
- artifacts: _ensure_client_account, supabase/migrations/20260807140000_secfix_s3_ensure_client_account_execute.sql
- decision-mention: none

### ITEM [batch5.md#91]
- report: TASK-SECFIX-REPORT.md
- date: 2026-08-07
- item: Reported, not fixed — anon still holds the same table-level INSERT/UPDATE grant on profiles (dormant, blocked by RLS since anon has no auth.uid()); recommended as defence-in-depth revoke, deliberately outside S2's revert unit.
- quote: "**`anon` holds the same table-level INSERT/UPDATE grant on `profiles`.** Dormant today: RLS refuses both ... My read is that it should be revoked as defence in depth; it is not urgent."
- kind: security
- artifacts: profiles (anon grants)
- decision-mention: none

### ITEM [batch5.md#92]
- report: TASK-SECFIX-REPORT.md
- date: 2026-08-07
- item: Reported, not examined — anon also holds table-level DELETE/INSERT/UPDATE on profiles more broadly, and authenticated holds DELETE; out of S2's scope.
- quote: "**`anon` also holds table-level DELETE/INSERT/UPDATE on `profiles`** more broadly, and `authenticated` holds DELETE. Same reasoning as above — out of S2's scope, unexamined."
- kind: security
- artifacts: profiles (DELETE grants)
- decision-mention: none

### ITEM [batch5.md#93]
- report: TASK-SECFIX-REPORT.md
- date: 2026-08-07
- item: Noticed while checking callers, not examined — redeem_gift and ensure_gift_buyer_account are PUBLIC-executable (=X/postgres in their ACLs), the same shape as S3 and worth a look. (ensure_gift_buyer_account was subsequently closed by SECFIX2 G1.)
- quote: "**`redeem_gift` and `ensure_gift_buyer_account` are PUBLIC-executable** ... the same shape as S3 and worth a look."
- kind: security
- artifacts: redeem_gift, ensure_gift_buyer_account
- decision-mention: none

### ITEM [batch5.md#95]
- report: TASK-SECFIX-REPORT.md
- date: 2026-08-07
- item: Correction narrowing the task doc — inbound_queue's staff_notes column is exposed to anon, but every row's value is an empty JSON array today, so no note text is actually readable; emails and phone numbers are real and readable.
- quote: "The `staff_notes` *column* is exposed, but every row's value is an empty JSON array (`[]`) today, so no note text is actually readable right now."
- kind: correction
- artifacts: inbound_queue
- decision-mention: none

### ITEM [batch5.md#96]
- report: TASK-SECFIX-REPORT.md
- date: 2026-08-07
- item: Accepted maintenance consequence of S2 — the profiles grant is now an explicit 28-column list, so a column added to profiles later will not be writable by authenticated until it is added to the grant; fails visibly on write.
- quote: "a column added to `profiles` later will not be writable by `authenticated` until it is added there. That fails visibly on write rather than silently reopening the hole."
- kind: caveat
- artifacts: profiles, 20260807120000_secfix_s2_profiles_contact_id_grant.sql
- decision-mention: none

### ITEM [batch5.md#97]
- report: TASK-SECFIX-REPORT.md
- date: 2026-08-07
- item: Scope deviations stated plainly — S2 also revoked INSERT of contact_id (second verb of the same hole, made live by the missing auth.users→profiles trigger), and S3 also revoked authenticated's EXECUTE; both flagged rather than done quietly.
- quote: "I did that, and **also** revoked INSERT of the same column from the same role, because it is the same hole reached through a second verb"
- kind: deviation
- artifacts: profiles, _ensure_client_account
- decision-mention: none

### ITEM [batch5.md#98]
- report: TASK-SECFIX-REPORT.md
- date: 2026-08-07
- item: A false alarm chased down and put on record — the first P7 check showed contact_linked=f and looked like a caused lockout; the real cause was the test SQL's own RLS-filtered subquery, proven by a pre-migration control run.
- quote: "Reporting it because \"verify before asserting\" is the standing rule here and the first reading was wrong."
- kind: process
- artifacts: ensure_contact_for_profile, profiles_link_contact
- decision-mention: none

---

### ITEM [batch5.md#99]
- report: TASK-SECFIX2-REPORT.md
- date: 2026-08-07
- item: Correction to the task brief — nothing calls ensure_gift_buyer_account at all (not even other DB functions, verified four ways); it is dead code in production, so the revoke cannot break a gift flow.
- quote: "**1. Nothing calls this function at all.** The brief said \"only other database functions do\". None do. ... The function is dead code in production"
- kind: correction
- artifacts: ensure_gift_buyer_account, redeem_gift, _ensure_client_account
- decision-mention: none

### ITEM [batch5.md#100]
- report: TASK-SECFIX2-REPORT.md
- date: 2026-08-07
- item: Nuance recorded, not acted on — redeem_gift's anon grant is harmless because of its own in-body auth.uid() guard, not because anon needs it; the brief's stated justification for keeping the grant is not the real one. Not revoked per instruction.
- quote: "the grant is harmless, but it is harmless because of the guard, not because anon needs it."
- kind: correction
- artifacts: redeem_gift, src/pages/Redeem.tsx, src/lib/gifts.ts
- decision-mention: none

### ITEM [batch6.md#2]
- report: TASK-A-PARTY-VERIFY-REPORT.md
- date: 2026-08-04
- item: Multi-party document visibility bug: documents_select RLS and my_documents() check only documents.contact_id, so a real signer whose contact_id differs cannot see their own signed docs; 5 executed prod documents affected.
- quote: "Five currently-EXECUTED production documents have at least one real signer whose contact_id differs from documents.contact_id — those signers likely cannot see their own signed documents in their account today."
- kind: data-integrity
- artifacts: my_documents(), documents_select, caller_owns_document, document_parties, caller_is_document_party
- decision-mention: none

### ITEM [batch6.md#5]
- report: TASK-A-PARTY-VERIFY-REPORT.md
- date: 2026-08-04
- item: Recommended new capability (owner-directed) — an admin-only "view-as"/impersonation lens to preview the true party-restricted UI; not built here.
- quote: "the owner proposed the correct direction: an admin-only 'view-as'/impersonation lens ... Not built here — it's a new capability spanning RLS/RPC/client, outside this task's fix policy."
- kind: blocked-on-owner
- artifacts: RLS, RPC, client (ContractPage.tsx)
- decision-mention: none

### ITEM [batch6.md#19]
- report: TASK-ADDITEM-REPORT.md
- date: 2026-08-12
- item: anon holds EXECUTE on add_contract_composition, remove_contract_composition and add_contract_element (last also grants PUBLIC); pre-existing, not exploitable, reported rather than changed as SECFIX territory.
- quote: "anon holds EXECUTE on add_contract_composition, remove_contract_composition and add_contract_element; the last also still grants PUBLIC. ... Reported rather than changed, because revoking grants is a security-surface decision"
- kind: security
- artifacts: add_contract_composition, remove_contract_composition, add_contract_element
- decision-mention: none

### ITEM [batch6.md#55]
- report: TASK-LEASEFORK-REPORT.md
- date: 2026-08-07
- item: Security defect the author INTRODUCED in Phase 1 and later fixed — clone_contract_template was executable by unauthenticated (anon) callers via pg_default_acl and a NULL-auth.uid guard; live in prod for the task duration; unauthenticated caller could mint contract templates.
- quote: "a defect I introduced in Phase 1: clone_contract_template was executable by unauthenticated (anon) callers. ... An unauthenticated caller could mint contract templates. ... it was live in prod from the Phase 1 apply until this fix."
- kind: security
- artifacts: clone_contract_template, pg_default_acl
- decision-mention: none

### ITEM [batch6.md#56]
- report: TASK-LEASEFORK-REPORT.md
- date: 2026-08-07
- item: The same REVOKE-FROM-public + auth.uid()-IS-NULL-trusted pattern is used elsewhere in the repo; any other SECURITY DEFINER function created that way has the same hole — NOT audited, flagged for a dedicated pass.
- quote: "Any other SECURITY DEFINER function created with a auth.uid() IS NULL ⇒ trusted guard has the same hole. I did not audit the rest of the database for that pattern"
- kind: security
- artifacts: SECURITY DEFINER functions (repo-wide)
- decision-mention: none

### ITEM [batch6.md#60]
- report: TASK-LEASEFORK-REPORT.md
- date: 2026-08-07
- item: The lease-version picker was not browser-clicked — data path, RPC and RLS read proven separately but nobody rendered the page.
- quote: "Not browser-clicked. ... I did not run the app and click through the picker. Calling that verified would be overclaiming."
- kind: not-verified
- artifacts: NewContractPage.tsx, listLeaseTemplates
- decision-mention: none

### ITEM [batch6.md#66]
- report: TASK-LEASESIMPLE-REPORT.md
- date: (no explicit header date)
- item: Found while reading (inherited from V2) — "FHE Approved Trainer" and "Approved Instructor" terms are used in §11.2/11.4/11.6/12.2 but never defined anywhere in the lease.
- quote: "'French Heritage Equestrian Approved Trainer' and 'Approved Instructor' are used but never defined. ... No clause anywhere in the lease says what approval means or who grants it."
- kind: correctness
- artifacts: HORSE_LEASE_SIMPLE clause bodies §11.2/11.4/11.6/12.2
- decision-mention: none

### ITEM [batch6.md#75]
- report: TASK-NULLUID-REPORT.md
- date: (no explicit header date; worktree off origin/main 8facc04)
- item: The single biggest remaining gap — anon-callable SECURITY DEFINER functions with NO identity check at all were NOT audited here; a different, probably larger bug family (TASK-SECFIX S3 was this).
- quote: "Anon-callable definers with no identity check at all. A different bug family, and probably the larger one ... Not audited here. This is the single biggest remaining gap."
- kind: security
- artifacts: SECURITY DEFINER functions (repo-wide)
- decision-mention: none

### ITEM [batch6.md#76]
- report: TASK-NULLUID-REPORT.md
- date: (no explicit header date)
- item: NULL-propagating predicates taking arguments (caller_is_document_party(uuid), caller_owns_horse(uuid), is_platform_profile) were not evaluated for anon — same NOT-trap could apply.
- quote: "Predicates taking arguments (caller_is_document_party(uuid), caller_owns_horse(uuid), is_platform_profile(text,uuid)) were not evaluated ... If any returns NULL for anon, the same NOT … trap applies."
- kind: security
- artifacts: caller_is_document_party, caller_owns_horse, is_platform_profile
- decision-mention: none

### ITEM [batch6.md#77]
- report: TASK-NULLUID-REPORT.md
- date: (no explicit header date)
- item: profiles_role_guard's auth.uid() IS NULL → RETURN NEW is the dangerous shape but a trigger not directly callable; left as-is and flagged as a latent hazard deserving its own task.
- quote: "profiles_role_guard's auth.uid() IS NULL → RETURN NEW — latent, deserves its own task. ... it is a latent hazard, not a live one, and changing a trigger on profiles deserves its own task."
- kind: security
- artifacts: profiles_role_guard, profiles
- decision-mention: none

### ITEM [batch6.md#78]
- report: TASK-NULLUID-REPORT.md
- date: (no explicit header date)
- item: record_invitation_failure has no caller check at all and a NULL-uid lookup branch; low risk (token is the credential) but a token holder can burn an invitation and raise a staff notification; unchanged.
- quote: "It has no caller check at all, but it is reached from the unauthenticated invite flow by design and the token is the credential. ... worth knowing, not a NULL-uid hole. Unchanged."
- kind: security
- artifacts: record_invitation_failure
- decision-mention: none

### ITEM [batch6.md#79]
- report: TASK-NULLUID-REPORT.md
- date: (no explicit header date)
- item: clone_contract_template uses the bare session_user IN (…) form and has the same PGlite property — not exploitable in prod but worth the same tightening (recommended follow-up for LEASEFORK).
- quote: "Note for TASK-LEASEFORK: clone_contract_template uses the bare session_user IN (…) form and has the same PGlite property — not exploitable in prod ... but worth the same tightening."
- kind: security
- artifacts: clone_contract_template
- decision-mention: none

### ITEM [batch6.md#81]
- report: TASK-NULLUID-REPORT.md
- date: (no explicit header date)
- item: Guards living in RLS policies were not fully audited for NULL logic — checked policies for negated use of the three predicates (none) but did not audit all 70 policies.
- quote: "Guards in RLS policies rather than function bodies. I checked policies for negated use of the three predicates (none) but did not audit all 70 for NULL logic."
- kind: not-verified
- artifacts: RLS policies
- decision-mention: none

### ITEM [batch6.md#82]
- report: TASK-NULLUID-REPORT.md
- date: (no explicit header date)
- item: The authenticated threat model ("one signup away") was not addressed — several functions remain callable by any signed-up account fenced only by the guard; a separate worthwhile task.
- quote: "authenticated as the threat model. Everything here is about anon. Several of these functions remain callable by any signed-up account, fenced only by the guard. A pass with 'one signup away' as the attacker is a separate and worthwhile task."
- kind: security
- artifacts: SECURITY DEFINER functions
- decision-mention: none

### ITEM [batch6.md#83]
- report: TASK-NULLUID-REPORT.md
- date: (no explicit header date)
- item: pg_default_acl still grants EXECUTE on every new public function to anon — until changed, this bug class regenerates itself with each new function; not changed (project-wide decision).
- quote: "pg_default_acl still grants EXECUTE on every new public function to anon. Until that default changes, this class regenerates itself with each new function. I did not change it — it is a project-wide decision"
- kind: security
- artifacts: pg_default_acl
- decision-mention: none

### ITEM [batch6.md#84]
- report: TASK-NULLUID-REPORT.md
- date: (no explicit header date)
- item: Proven live exploit (before fix) — platform_tenant_detail returned to an unauthenticated caller the full tenant record, per-table row counts, and every staff account's name, email and user id.
- quote: "An unauthenticated reader obtained the tenant record, per-table row counts, and every staff account's name, email address and user id."
- kind: security
- artifacts: platform_tenant_detail, platform_set_tenant_module, platform_set_tenant_status, inbound_open_count
- decision-mention: none

### ITEM [batch7.md#9]
- report: TASK-ACCOUNTSURFACE-REPORT.md
- date: 2026-08-05
- item: The Google-switch "or is switching to one" clause is unimplemented; no client-observable signal exists for an in-flight email-change-to-Google.
- quote: ""Or is switching to one" I did not implement — I found no client-observable signal for an in-flight email-change-to-Google anywhere in the codebase"
- kind: not-verified
- artifacts: LoginSecurityCard, EmailChangeModal
- decision-mention: none

### ITEM [batch7.md#48]
- report: TASK-C10-REPORT.md
- date: 2026-08-04
- item: Found mid-verification a systemic pre-existing privilege exposure — the public schema default privilege auto-grants EXECUTE on every new function to anon/authenticated/service_role; fixing it project-wide is out of C10 scope.
- quote: "this project's `public` schema has a default privilege auto-granting `EXECUTE` on every newly created function to `anon`, `authenticated`, and `service_role` ... fixing it project-wide is outside C10's scope."
- kind: security
- artifacts: pg_default_acl, is_minor_contact, notify_minor_delivery_skipped, log_mirror_delivery, notify_staff
- decision-mention: none

### ITEM [batch7.md#49]
- report: TASK-C10-REPORT.md
- date: 2026-08-04
- item: Production was written to in two passes for grant statements — the committed migration reflects the final state; a direct follow-up REVOKE/GRANT brought prod in sync rather than a second migration file.
- quote: "production was therefore written to in two passes for the grant statements ... production was brought in sync with a direct follow-up `REVOKE/GRANT` (not a second migration file)"
- kind: process
- artifacts: 20260804150000_minor_delivery_guard.sql
- decision-mention: none

### ITEM [batch7.md#59]
- report: TASK-EMAILEXTRACT-REPORT.md
- date: 2026-08-12
- item: Inconsistent HTML escaping across senders is preserved byte for byte and now visible as _HTML token twins; a unified escaping policy is real work with output changes needing owner sign-off.
- quote: "Inconsistent HTML escaping across the senders is preserved byte for byte and now visible as `_HTML` token twins. A unified escaping policy ... needs owner sign-off"
- kind: correctness
- artifacts: DOC.TITLE, DOC.TITLE_HTML, contract-voided.ts, deliver-documents.ts
- decision-mention: none

### ITEM [batch7.md#60]
- report: TASK-EMAILEXTRACT-REPORT.md
- date: 2026-08-12
- item: api/contract-invite.ts:117 hardcodes 'French Heritage Equestrian' as the identity fallback when resolveTenantEmailIdentity throws — a multi-tenant leak that predates this task; contract-voided.ts has the same. Left as found.
- quote: "`api/contract-invite.ts:117` hardcodes `'French Heritage Equestrian'` as the identity fallback ... a §15 multi-tenant leak that predates this task. `contract-voided.ts` has the same."
- kind: security
- artifacts: api/contract-invite.ts, api/contract-voided.ts, resolveTenantEmailIdentity
- decision-mention: none

### ITEM [batch7.md#66]
- report: TASK-EMAILEXTRACT-REPORT.md
- date: 2026-08-12
- item: The MANAGER/EMPLOYEE staff-read arm of the email_templates policy is proven by policy definition, not by a live actor — no such account exists in production.
- quote: "No MANAGER/EMPLOYEE account exists in production ... so the staff-read policy's manager arm is proven by policy definition, not by a live actor."
- kind: not-verified
- artifacts: email_templates RLS
- decision-mention: none

### ITEM [batch7.md#71]
- report: TASK-GUARDREST-REPORT.md
- date: 2026-08-12
- item: Correction — the bare-guard query under-reports: its prosrc !~ 'coalesce' filter hides every bare guard in a function that has any unrelated coalesce. The real number is 19, not 15; four functions were invisible.
- quote: "The query returns 15, as the task said. But the real number is 19 ... Four functions with the exact dangerous shape were invisible to it"
- kind: security
- artifacts: mark_comment_review, request_contract_termination, set_horse_locations, set_horse_medications
- decision-mention: none

### ITEM [batch7.md#72]
- report: TASK-GUARDREST-REPORT.md
- date: 2026-08-12
- item: Correction — the task's stated rationale (NULL-auth caller makes the guard go NULL) is wrong; helpers coalesce to false. The real hole is a staff caller with NULL org_id (e.g. admin@cactai.io, SUPER_ADMIN), plus a NULL-data family.
- quote: "The stated rationale is wrong ... The hole is one step in from there: a caller who IS staff but whose `org_id` is NULL."
- kind: security
- artifacts: has_staff_access(), is_admin(), current_org()
- decision-mention: D1a

### ITEM [batch7.md#73]
- report: TASK-GUARDREST-REPORT.md
- date: 2026-08-12
- item: Live hole 1 — attach_horse_to_document admitted the platform owner (org NULL) to write to a tenant document; fixed and proven before/after.
- quote: "attach_horse_to_document — the platform owner writes to a tenant document ... A2. platform owner (org NULL) => ADMITTED (no error)"
- kind: security
- artifacts: attach_horse_to_document
- decision-mention: none

### ITEM [batch7.md#74]
- report: TASK-GUARDREST-REPORT.md
- date: 2026-08-12
- item: Live hole 2 — request_booking_change let any member act on 294 bookings with NULL client_id (write access, flipped status to pending); fixed and proven.
- quote: "request_booking_change — any member can act on 294 bookings that are not theirs ... It also flipped the booking's status to `pending`, so this was write access"
- kind: security
- artifacts: request_booking_change, bookings.client_id
- decision-mention: none

### ITEM [batch7.md#75]
- report: TASK-GUARDREST-REPORT.md
- date: 2026-08-12
- item: Live hole 3 — purge_account's structural gate went NULL on the proof domain (current_setting unset), so a @purge-proof.invalid address could purge; fixed and proven.
- quote: "purge_account — the structural gate goes NULL on the proof domain ... the `RAISE` is skipped and the purge proceeds."
- kind: security
- artifacts: purge_account
- decision-mention: none

### ITEM [batch7.md#76]
- report: TASK-GUARDREST-REPORT.md
- date: 2026-08-12
- item: The MANAGER/EMPLOYEE mismatch was resolved by widening three RLS SELECT policies (documents/contacts/horses) to has_staff_access(); write policies stay is_admin(), an asymmetry recorded so it is not rediscovered as a bug.
- quote: "Write policies remain `is_admin()` while reads are now `has_staff_access()`. Intentional (above), but recorded so the asymmetry is not rediscovered as a bug."
- kind: security
- artifacts: documents_admin_write, contacts_admin_write, horses_admin_write
- decision-mention: D1a

### ITEM [batch7.md#77]
- report: TASK-GUARDREST-REPORT.md
- date: 2026-08-12
- item: No trigger provisions profiles at signup — diagnosed, NOT built. Two real orphan accounts exist (OAuth signup and direct-signup past the invite spine); a signup trigger is a security decision needing an owner ruling.
- quote: "No trigger provisions `profiles` at signup — diagnosed, NOT built ... Recommend a separate task with an owner ruling"
- kind: blocked-on-owner
- artifacts: auth.users, profiles, src/lib/auth.ts, signUpWithPassword
- decision-mention: D5

### ITEM [batch7.md#80]
- report: TASK-GUARDREST-REPORT.md
- date: 2026-08-12
- item: Flagged #3 — the owner cannot create an instructor account; TeamPage invites staff as ADMIN only and the MANAGER/EMPLOYEE roles this RLS change made real cannot be granted without SQL. A D13 gap, owner's call.
- quote: "The owner cannot create an instructor account ... A D13 gap: it now needs SQL. Small fix ... but it is a role/permission change, so it is the owner's call"
- kind: blocked-on-owner
- artifacts: TeamPage
- decision-mention: D13

### ITEM [batch7.md#81]
- report: TASK-GUARDREST-REPORT.md
- date: 2026-08-12
- item: Flagged #4 — clone_contract_template is not executable by authenticated (pre-existing, deliberate psql/migration-only tool); its guard was coalesced here regardless. Not a regression.
- quote: "`clone_contract_template` is not executable by `authenticated` ... Pre-existing and deliberate ... Not a regression."
- kind: correctness
- artifacts: clone_contract_template, 20260807130000_leasefork_clone_grant_hardening.sql
- decision-mention: none

### ITEM [batch7.md#84]
- report: TASK-NOGUARD1-ORCHESTRATOR-AUDIT.md
- date: 2026-08-08
- item: This audit was corrected by NOGUARD2 in three places — "nine unguarded contract_fields writers" is really seven (two are trigger-only functions).
- quote: ""Nine unguarded anon-reachable `contract_fields` writers" — it is SEVEN. `contract_split_deductible_sync` and `sync_horse_fields_to_documents` are `RETURNS trigger`"
- kind: correctness
- artifacts: contract_split_deductible_sync, sync_horse_fields_to_documents
- decision-mention: none

### ITEM [batch7.md#85]
- report: TASK-NOGUARD1-ORCHESTRATOR-AUDIT.md
- date: 2026-08-08
- item: Correction — three of the lock-carrying functions are NOT anon=false; set_document_co_buyer and remove_document_co_buyer are anon=true, and set_field_structured (a fourth lock-caller) was omitted entirely. remove_document_co_buyer deletes BUYER parties on any document with no identity check.
- quote: ""All three [lock-carrying functions] are `anon = false`" — WRONG ... `remove_document_co_buyer` has no identity check and deletes BUYER parties on any document id."
- kind: security
- artifacts: set_document_co_buyer, remove_document_co_buyer, set_field_structured, set_contract_field
- decision-mention: none

### ITEM [batch7.md#86]
- report: TASK-NOGUARD1-ORCHESTRATOR-AUDIT.md
- date: 2026-08-08
- item: Correction — the claim "a function with an internal caller must be guarded, not revoked" is false; SECURITY DEFINER inner calls are checked against postgres, so six of seven are revoked rather than re-guarded.
- quote: ""A function with an internal caller must be GUARDED, not revoked — revoking would break the caller." FALSE."
- kind: correctness
- artifacts: SECURITY DEFINER functions
- decision-mention: none

### ITEM [batch7.md#87]
- report: TASK-NOGUARD1-ORCHESTRATOR-AUDIT.md
- date: 2026-08-08
- item: void_signatures_on_edit confirmed — anon-reachable, no identity check, no caller anywhere (dead code); voids every signature on any document and resets status. Recommendation: DROP.
- quote: "There is no identity check of any kind ... Any unauthenticated caller holding a document id voids every signature on that document ... Recommendation: DROP it, do not guard it."
- kind: security
- artifacts: void_signatures_on_edit, signatures, documents
- decision-mention: none

### ITEM [batch7.md#88]
- report: TASK-NOGUARD1-ORCHESTRATOR-AUDIT.md
- date: 2026-08-08
- item: The report understates the contract-field surface by 3×: 28 functions write to contract_fields, 22 anon-executable, nine anon-reachable with no identity check.
- quote: "28 functions write to `contract_fields`. 22 of them are anon-executable. Nine are anon-executable and carry no identity check at all"
- kind: security
- artifacts: contract_fields, apply_field_formats, bos_generate_document, recompose_document_fields, fill_party_fields_from_contacts
- decision-mention: none

### ITEM [batch7.md#89]
- report: TASK-NOGUARD1-ORCHESTRATOR-AUDIT.md
- date: 2026-08-08
- item: lease_expiry_nudge is a definer wrapper that launders the missing privilege — anon-reachable, its whole body calls the anon-unreachable lease_reminder_sweep. A class, not an instance.
- quote: "The wrapper launders the missing privilege. The finding stands; the count of 76 stands; the explanation in the report does not. This is a class, not an instance."
- kind: security
- artifacts: lease_expiry_nudge, lease_reminder_sweep
- decision-mention: none

### ITEM [batch7.md#90]
- report: TASK-NOGUARD1-ORCHESTRATOR-AUDIT.md
- date: 2026-08-08
- item: The authenticated definer surface (396 callable functions, 111 more than anon) has never been measured — a separate audit that outranks the residue of this one on consequence.
- quote: "NOGUARD1 measured the anonymous surface. The authenticated surface is larger and has never been measured. That is a separate audit"
- kind: security
- artifacts: SECURITY DEFINER functions
- decision-mention: none

### ITEM [batch7.md#91]
- report: TASK-NOGUARD1-ORCHESTRATOR-AUDIT.md
- date: 2026-08-08
- item: The three gift_* NULL-propagating guards (gift_claim_link, gift_mark_sent, gift_reschedule) do not fire for anon; each needs one coalesce(...,false), copied from gift_transfer.
- quote: "The three `gift_*` NULL-propagating guards — confirmed verbatim ... `gift_transfer` already carries the fix."
- kind: security
- artifacts: gift_claim_link, gift_mark_sent, gift_reschedule, gift_transfer
- decision-mention: none

### ITEM [batch7.md#94]
- report: TASK-NOGUARD1-REPORT.md
- date: 2026-08-07
- item: Headline — 76 of 285 anon-reachable SECURITY DEFINER functions do not enforce an access rule; 38 of those modify data. (Read-only audit, nothing fixed.)
- quote: "76 of 285 anon-reachable `SECURITY DEFINER` functions do not enforce an access rule. 38 of those modify data."
- kind: security
- artifacts: SECURITY DEFINER functions
- decision-mention: none

### ITEM [batch7.md#95]
- report: TASK-NOGUARD1-REPORT.md
- date: 2026-08-07
- item: void_signatures_on_edit — worst finding: takes a document id, soft-deletes every signature and resets status, no identity check, no caller (dead code), anon holds EXECUTE.
- quote: "the worst finding is `void_signatures_on_edit(uuid)` — it takes a document id, soft-deletes every signature on it, and resets the document's status. It has no identity check of any kind, no caller"
- kind: security
- artifacts: void_signatures_on_edit, signatures, documents
- decision-mention: none

### ITEM [batch7.md#96]
- report: TASK-NOGUARD1-REPORT.md
- date: 2026-08-07
- item: Four functions are protected only by a NOT NULL column constraint, not by any access rule; a future migration relaxing one silently opens a write path. Flagged, not fixed.
- quote: "Four functions are protected by a column constraint rather than by any access rule. A future migration relaxing one of those silently opens a write path. Flagged, not fixed"
- kind: security
- artifacts: content_acknowledgments, dm_hidden_conversations, feed_seen, feed_view_pref, dm_hide_conversation
- decision-mention: none

### ITEM [batch7.md#97]
- report: TASK-NOGUARD1-REPORT.md
- date: 2026-08-07
- item: Three gift_* functions have a guard present but with no effect (NULL-propagation) — the only "guard present, no effect" write cases; fix is a one-line coalesce copy.
- quote: "The three `gift_*` functions — the only "guard present, no effect" cases left."
- kind: security
- artifacts: gift_claim_link, gift_mark_sent, gift_reschedule
- decision-mention: none

### ITEM [batch7.md#98]
- report: TASK-NOGUARD1-REPORT.md
- date: 2026-08-07
- item: contract_fields mutator family (recompose_document_fields, sync_contract_fields_from_defs, seed_cascade_fields, regroup_contract_subjects, apply_field_formats, fill_party_fields_from_contacts, remove_document_co_buyer) can insert/rewrite/reorder/delete any contract; four have no caller; none checks assert_not_signature_locked first.
- quote: "Together these can insert, rewrite, reorder and delete the content of any contract. Four of the seven have no caller at all. None of them checks `assert_not_signature_locked` first"
- kind: security
- artifacts: recompose_document_fields, sync_contract_fields_from_defs, seed_cascade_fields, regroup_contract_subjects, apply_field_formats, fill_party_fields_from_contacts, remove_document_co_buyer
- decision-mention: none

### ITEM [batch7.md#99]
- report: TASK-NOGUARD1-REPORT.md
- date: 2026-08-07
- item: affiliation_reconciliation and wall_onboarding_invariant_violations are two unauthenticated full customer-roster dumps, both dead code.
- quote: "`affiliation_reconciliation` and `wall_onboarding_invariant_violations` — two unauthenticated full-roster dumps. Both are dead code."
- kind: security
- artifacts: affiliation_reconciliation, wall_onboarding_invariant_violations
- decision-mention: none

### ITEM [batch7.md#100]
- report: TASK-NOGUARD1-REPORT.md
- date: 2026-08-07
- item: confirm_booking_for_purchase confirms a booking without payment, bypassing the Stripe webhook path; reachable from stripe-webhook.ts so any fix must keep the service_role path alive.
- quote: "Confirms a booking without payment — bypasses the Stripe webhook path ... guard on `auth.role() = 'service_role'`, never on `session_user` alone."
- kind: security
- artifacts: confirm_booking_for_purchase, api/stripe-webhook.ts
- decision-mention: none

### ITEM [batch7.md#101]
- report: TASK-NOGUARD1-REPORT.md
- date: 2026-08-07
- item: The grant default (pg_default_acl grants EXECUTE on every new public function to anon) is the root cause and is unchanged; every migration adds to this surface by default. This is the root cause; items 1-7 are symptoms.
- quote: "The grant default regenerates this class ... Until it changes, every migration adds to this surface by default ... This is the root cause; items 1–7 are symptoms."
- kind: security
- artifacts: pg_default_acl
- decision-mention: none

### ITEM [batch7.md#102]
- report: TASK-NOGUARD1-REPORT.md
- date: 2026-08-07
- item: Both trap grants (PUBLIC =X/postgres and anon=X/postgres) are present on every function checked; either revoke alone is a silent no-op — any revoke must name anon, authenticated and PUBLIC separately and re-read has_function_privilege.
- quote: "Both trap grants are present on every function I checked ... Any revoke must name `anon`, `authenticated` and `PUBLIC` separately ... never the `REVOKE` output."
- kind: security
- artifacts: SECURITY DEFINER functions
- decision-mention: none

### ITEM [batch7.md#103]
- report: TASK-NOGUARD1-REPORT.md
- date: 2026-08-07
- item: Limitation — the authenticated surface is not modelled at all; every one of the 76 is also callable by any signed-up account and most of the 199 "enforcing" only distinguish nobody from somebody. Judged the larger surface, untouched.
- quote: "`authenticated` is not modelled at all ... I judge this the larger surface, and it is untouched here."
- kind: security
- artifacts: SECURITY DEFINER functions
- decision-mention: none

### ITEM [batch7.md#104]
- report: TASK-NOGUARD1-REPORT.md
- date: 2026-08-07
- item: Limitation — the 76 were not executed (by instruction), so "no guard in the body" is a claim about code, not a demonstration; something outside the body (trigger/CHECK/FK/NOT NULL) could still stop them, so 76 may be an over-count.
- quote: "I did not execute the 76 ... There are probably more, which would make my 76 an over-count."
- kind: not-verified
- artifacts: SECURITY DEFINER functions
- decision-mention: none

### ITEM [batch7.md#105]
- report: TASK-NOGUARD1-REPORT.md
- date: 2026-08-07
- item: Limitation — RLS policies were not audited for their own NULL logic (only one policy checked); RLS fails closed on NULL where IF NOT fails open.
- quote: "RLS is not in the picture, and that is load-bearing ... I checked that one policy. I did not check the rest."
- kind: security
- artifacts: RLS policies, profiles_select_own
- decision-mention: none

### ITEM [batch7.md#109]
- report: TASK-NOGUARD1-REPORT.md
- date: 2026-08-07
- item: Limitation — reachability is proven but exploitability is inferred; the 22P02 probe proves the request reaches argument parsing, not that the body completes. Authorisation does not stop them, not that they all succeed.
- quote: "Reachability is proven, exploitability is inferred ... the honest statement is: authorisation does not stop them, not they all succeed."
- kind: not-verified
- artifacts: SECURITY DEFINER functions
- decision-mention: none

### ITEM [batch7.md#110]
- report: TASK-NOGUARD1-REPORT.md
- date: 2026-08-07
- item: Point-in-time snapshot — measured 2026-08-07 against ab3d490; three threads in flight, any adding a function adds to the list.
- quote: "A point-in-time snapshot. Measured 2026-08-07 against `ab3d490`. Three threads are in flight ... any of them adding a function adds to this list."
- kind: process
- artifacts: SECURITY DEFINER functions
- decision-mention: none

### ITEM [batch7.md#118]
- report: TASK-TESTDB-REPORT.md
- date: 2026-08-12
- item: D-2 (dead code) — owns_order(uuid) is a SQL function querying the dropped orders table; unreachable (no RLS/function/view/code reference) because old-style SQL bodies aren't dependency-tracked. Cleanup, not breakage.
- quote: "an orphan function survives `orders` ... `orders` is GONE ... It is unreachable"
- kind: defect
- artifacts: owns_order(uuid), orders
- decision-mention: none

### ITEM [batch7.md#120]
- report: TASK-TESTDB-REPORT.md
- date: 2026-08-12
- item: Harness limitation — the snapshot carries no GRANT/REVOKE and BOOTSTRAP blanket-grants ALL, so ~16 tests asserting table-level REVOKE cannot pass no matter how correct production is (e.g. horse_relationships DELETE genuinely revoked). Reported, not fixed.
- quote: "every test asserting a table-level REVOKE cannot pass on the snapshot path, no matter how correct production is ... The test is right, production is right, and the harness cannot express the assertion."
- kind: process
- artifacts: schema_snapshot.sql, harness.ts, BOOTSTRAP, horse_relationships
- decision-mention: none

### ITEM [batch7.md#123]
- report: TASK-TESTDB-REPORT.md
- date: 2026-08-12
- item: The 203 failures are pre-existing conditions that 651 skipped tests were hiding — clusters: REVOKE assertions (~16), retired tables in live files (9), stale module-set premise (~10), missing retired functions (4), assorted assertion drift.
- quote: "None are regressions from this task — all are pre-existing conditions that 651 skipped tests were hiding."
- kind: process
- artifacts: test:db
- decision-mention: none

### ITEM [batch8.md#41]
- report: TASK-LEASEGATE-PHASE1.md
- date: 2026-08-07
- item: Open question Q3 — three options for enforcing R3 laid out (leave the D3 blocker, ineligible_when on the Lessor's field, drop NONE from options) with trade-offs; no pick made; today's blocker is clearable by a promise (GL_LESSEE_RESPONSIBLE=YES) rather than a policy.
- quote: "Also clearable by a *promise* (`GL_LESSEE_RESPONSIBLE`), not a policy"
- kind: blocked-on-owner
- artifacts: contract_lock_blockers, TXN.GL_LESSOR_STATUS, TXN.GL_LESSEE_RESPONSIBLE
- decision-mention: none

### ITEM [batch8.md#81]
- report: TASK-UPLOADS-REPORT.md
- date: 2026-08-11
- item: removeMyFile() hard-deletes the storage bytes and tombstones the row; if the owner wants recoverable removal instead it is a one-line change plus a retention policy — flagged as an open ruling.
- quote: "**Member 'remove' deletes the bytes, tombstones the row.** ... If the owner wants recoverable removal instead, it is a one-line change (drop the `storage.remove` call) plus a retention policy."
- kind: blocked-on-owner
- artifacts: removeMyFile (src/lib/files.ts), files
- decision-mention: none

### ITEM [batch8.md#82]
- report: TASK-UPLOADS-REPORT.md
- date: 2026-08-11
- item: Cross-member reads are not built — a Coggins on a horse is not readable by the horse's owner if a different member uploaded it; needs a files SELECT policy arm using client_can_read_horse plus a matching storage arm, before the horse-record UI.
- quote: "**Cross-member reads are not built.** A file is readable by its owner and by staff. The horse-record case above is the first surface that needs more"
- kind: not-built
- artifacts: files SELECT policies, client_can_read_horse, storage.objects policies
- decision-mention: none

### ITEM [batch8.md#83]
- report: TASK-UPLOADS-REPORT.md
- date: 2026-08-11
- item: Members cannot create file_links — only staff can surface a file on another record; member-initiated surfacing needs a per-subject permission check that does not exist yet.
- quote: "**Members cannot create `file_links`.** Only staff can surface a file on another record ... Member-initiated surfacing needs a per-subject permission check that does not exist yet."
- kind: not-built
- artifacts: file_links, file_links_owner_unlink
- decision-mention: none

### ITEM [batch8.md#84]
- report: TASK-UPLOADS-REPORT.md
- date: 2026-08-11
- item: storage_admin_all is now org-gated but still not path-scoped — a second tenant's admin could read tenant #1's objects in buckets whose path grammar does not start with an org id; not live single-tenant, but the next fix in that file and larger than one condition.
- quote: "**`storage_admin_all` is now org-gated but still not path-scoped.** A second tenant's admin could read tenant #1's objects in buckets whose path grammar does not start with an org id (`contracts`, `generated-documents`, `reports`, `profile-images`, `temporary-uploads`)."
- kind: security
- artifacts: storage_admin_all, storage.objects
- decision-mention: D1a

### ITEM [batch8.md#86]
- report: TASK-UPLOADS-REPORT.md
- date: 2026-08-11
- item: content_resources.storage_path is now redundant with file_id — both are written and the storage policy still reads storage_path; collapsing to file_id alone is a later cleanup.
- quote: "**`content_resources.storage_path` is now redundant with `file_id`.** Both are written, and the storage policy reads `storage_path`. Nothing was deleted."
- kind: follow-up
- artifacts: content_resources.storage_path, content_resources.file_id
- decision-mention: none

### ITEM [batch8.md#89]
- report: TASK-UPLOADS-REPORT.md
- date: 2026-08-11
- item: None of the nine consuming surfaces (deal, contract, horse, stable, lessons, offerings, leads, directory, community resources) were built, per the task's instruction to report rather than half-wire; each has a listed layout/permission question.
- quote: "Everything below is a `file_links` row and a list component; **none of it was built**, per the task's instruction to report rather than half-wire six surfaces."
- kind: not-built
- artifacts: DealPage.tsx, ContractPage.tsx, HorsePage.tsx, Stable.tsx, MyLessons.tsx, CatalogPage.tsx, ContactsPage.tsx, communityFeed.ts
- decision-mention: none

### ITEM [batch8.md#101]
- report: TASK-WALLRETURN-REPORT.md
- date: 2026-08-07
- item: Two related out-of-scope defects named by the task doc — contracts has no party-read policy and document_party_controls has RLS enabled with zero policies — were not touched; re-reported with nothing new to add.
- quote: "The two related-but-out-of-scope defects the task doc names (`contracts` has no party-read policy; `document_party_controls` has RLS with zero policies) were not touched"
- kind: defect
- artifacts: contracts RLS, document_party_controls RLS
- decision-mention: none
