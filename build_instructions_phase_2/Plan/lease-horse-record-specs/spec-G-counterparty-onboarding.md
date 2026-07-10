# Spec G — Counterparty Onboarding & Minimal App Surface

Goal: an invited lease/purchase counterparty can (1) be invited by email, (2) sign in with Google if it's a Gmail address else set a password with their email as username, (3) land in an app that opens only to their contract intake → review → sign, plus viewing their own account — nothing else (owner decision 12).

## G.1 What already exists to reuse
- `invitations` table + `redeem_invitation(p_token)` (`20260703020000`): validates a sent, unexpired token whose email matches the signed-in user, then grants COMMUNITY membership and marks the invite accepted. This is the RIGHT redemption primitive but it lands the user in the community (rider) context, which is NOT what a contract counterparty should get.
- `adminSendInvitation` / `admin-send-invitation.ts` API and `provision_lesson_invitation` (rider onboarding): patterns for issuing an invite tied to a purpose.
- OAuth (Google) and password auth already exist (`GoogleButton.tsx`, `OAuthButtons.tsx`, auth layout). Email-as-username password signup exists in the rider onboarding path.
- The contract engine already notifies the counterparty (`contract_shared`, `contract_in_review`, `contract_locked`) with links to `/app/contracts/{id}`.

## G.2 Gaps to build
1. Contract-scoped invitation. When the owner shares a contract to a counterparty who has no account, issue an invitation carrying the document/engagement context (not a community invite). Extend the invitation issuance (new RPC `invite_contract_counterparty(p_document_id, p_contact_id, p_email)` or extend `share_document` to issue one when the shared contact has no `profiles` row) that:
   - creates/records an `invitations` row for the email, with a purpose/kind marking it a CONTRACT invite and storing `document_id` (add nullable `document_id uuid` + `kind text` columns to `invitations` if not present, additive);
   - sends the invite email (reuse the email sender in `api/_lib/email.ts` / `admin-send-invitation.ts`) linking to the app with the token.
2. Contract redemption path. Add `redeem_contract_invitation(p_token)` (or branch inside `redeem_invitation` on `kind`) that: validates the token/email exactly as `redeem_invitation`; links the signed-in `auth.uid()`'s profile to the counterparty `contact_id` named on the invitation (so `caller_is_document_party` matches — the counterparty must resolve to the engagement's party contact); marks the invite accepted; and does NOT grant community membership. The redirect target is the contract, not the feed.
3. Contact↔profile linkage. The counterparty's `profiles.contact_id` must equal the engagement party's `contact_id` for `caller_party_roles`/`set_contract_field`/signing to authorize them. Ensure redemption sets this link (the rider path has an analogous linkage; mirror it). If the counterparty contact was created by `create_lease_engagement`/`create_purchase_engagement`, the invite must reference THAT contact id.

## G.3 Minimal app surface (routing/UI)
For a user whose only relationship is being a contract counterparty (no community membership, no other entitlements), the app must open to the contract, not the rider dashboard. Implement in the app shell/routing:
- After contract-invite redemption, route to `/app/contracts/{document_id}`.
- That contract view, for a counterparty, shows in sequence: their INTAKE (only the fields they own — their personal fields, plus any fields the owner surfaced to them as required blanks, resolved via `contract_document_detail`'s `can_edit` flag), then the DOCUMENT REVIEW (the merged/preview body), then SIGN (`lock_and_sign_contract` as their party role) once the document reaches `locked`.
- In the negotiation branch (`recipient_editing` on), the same view also exposes `request_document_change` on DEAL fields and shows open change requests in their sections.
- The counterparty can view their own account/profile. No feed, no community, no other ops surfaces. Gate the rest of `/app/*` behind the memberships/entitlements the counterparty does not have (this gating largely exists; ensure a contract-only user isn't handed rider/community routes).

## G.4 Contribute-and-sign vs negotiation (the two controls, decision 4)
- Contribute-and-sign: `recipient_editing=false`. Counterparty can edit only their own personal fields (and any required blanks the owner left them that are owned by their role). They cannot touch DEAL fields and have no change-request affordance for them. If the owner left them ONLY personal fields, they go intake → review → sign with no owner round-trip beyond the owner's final signature.
- Non-editable-with-suggestions / editable: `recipient_editing=true`. Counterparty may `request_document_change` on DEAL fields; the negotiation loop runs; then review → sign.

The owner sets this via `set_recipient_editing` / `share_document(..., p_recipient_editing)` at authoring.

## G.5 Acceptance
- Owner shares a lease to a new counterparty by email → counterparty receives an invite → signs in with Google (Gmail) or sets a password → lands on the contract intake, not the community feed.
- The counterparty's profile resolves to the engagement party contact, so they can fill their fields and sign; `set_contract_field` authorizes their personal/assigned fields and rejects others.
- A contract-only counterparty has no access to feed/community/ops routes.
