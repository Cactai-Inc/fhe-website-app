# TASK PROFILE — Profile & Preferences restructure (owner spec 2026-08-05)

Owner-authored redesign of the Account page's Profile & Preferences surface. The current
implementation has DUPLICATED profile surfaces (an inner "Name, photo & bio" page duplicating
the main page's fields; a sign-in card duplicated inside that inner page alongside the Login &
Security section) — classic duplicate-instead-of-expand drift. This task consolidates to ONE
surface with ONE interaction model.

## Interaction rules (owner's design law for this page)
- Allowed: expandable header cards, modals, surface-level editable fields.
- FORBIDDEN: navigating to separate inner pages (they lack embedded back buttons and break
  flow). The existing inner pages ("Change email address", "Password", "Sign in with Google",
  "Name, photo & bio") are DISSOLVED into sections/modals per below.
- Section boundaries must be visually unmistakable — the current expansion blends into the
  cards below it. Give each section a clear header band and containment.
- Where a card expands in place, the collapse affordance must be obvious (the current
  title-card-click-as-back is not intuitive — make the close/collapse control explicit).

## Page structure, top to bottom

### 1. PROFILE (community-visible)
Rendered AS IT APPEARS TO OTHER MEMBERS — a real profile card preview: photo/avatar, display
name, badges (see data note below), about-you text, social accounts, community-visible
contact methods, preferred contact method FOR COMMUNITY MEMBERS, "Member since". One EDIT
button → reveals every editable field (in-place expansion or modal, per the rules); SAVE
returns to the card view.
- Preferred-contact-method options GAIN socials: Facebook, Instagram, TikTok (people may
  prefer being contacted there). Existing hide-from-community toggles move into this edit
  view — they are community-visibility controls, so they live with the profile.
- Riding level (currently on the duplicate inner page) moves into this edit view.
- Badges: check whether any badge data model exists; if none, render the slot only when a
  future badge system provides data (no fake placeholders), and note the absence in the
  report.

### 2. PREFERENCES
The existing notification preferences etc., clearly its own labeled section.

### 3. ACCOUNT INFORMATION (internal-only)
Own card/section, explicitly labeled visible ONLY to company staff. Fields:
- Full legal name: first + last, separate fields.
- Contact phone for calls; mobile number; a checkbox "I use a different number for texts"
  which reveals a texts-number field below the mobile field.
- Correspondence email — may differ from the login email. Helper copy: used for all company
  correspondence EXCEPT access emails (password reset → magic link to the LOGIN email;
  login-email-change notices; legal documents) which always go to the login email.
- Physical mailing address (the existing address fields move here).
- Zelle ID (phone and/or email tied to their Zelle account) — helper copy: used to match
  Zelle payments to their orders. (The matching automation is a SEPARATE future task — just
  collect + store here.)
- Date of birth — internal-only; note it drives minor-protection rules. (Do NOT allow email
  on a minor's contact — the C10 trigger enforces it; surface its error message gracefully
  if hit.)
- Emergency contact: READ-THROUGH display of what their signed onboarding documents captured
  (find where that lives — contract_fields on their executed docs); shown, not editable here;
  if none on file, show "none on file" with no input. Do not create a second editable copy.
- Preferred contact method FOR COMPANY STAFF (separate from the community one in section 1).

### 4. LOGIN & SECURITY
Own section, no inner pages:
- "Login" — shows the login email (their access credential) + change option (with its
  verified-before-effect flow) inline/modal. Simple.
- Password — set/change, inline/modal. Password reset always magic-links the login email.
- Sign in with Google — connect/switch, inline/modal.
The duplicated sign-in card inside the old "Name, photo & bio" page dies with that page.

## Data layer
Read-first: map every field above to existing columns (contacts/profiles — first/last, email,
phone, address fields, socials, notification prefs all partially exist). Migration for what's
genuinely missing (likely: correspondence_email, texts_phone, zelle_id, staff_preferred
contact method, about/bio if absent, community preferred-contact socials options). Put
person-facts on `contacts`, account/login-facts on `profiles` — follow the existing split
(owner's identity taxonomy: contact = the person, profile = the login). Standard grant
tightening on any new RPC (the default-EXECUTE gotcha). RLS: internal-only fields must NOT be
readable by other members — check what the community profile read path exposes and prove the
new fields are excluded from it.

## Eliminations (the duplicate cleanup)
- Inner pages listed above: removed, routes/links updated.
- The old duplicate profile edit surfaces: one survivor (section 1's edit view).
- List every deleted component/route in the report.

## Rules
- Branch `task/profile-restructure` off `origin/main`, own worktree
  (`git worktree add ~/Downloads/claude-code-repo/wt-profile -b task/profile-restructure origin/main`).
  Copy this doc + `.env.db` from the shared checkout (untracked there).
- Production DB: the one migration + rolled-back proofs only. Prove internal-field RLS
  exclusion with a simulated OTHER-member session (technique in prior reports).
- `ClauseDocument.tsx` FROZEN. Signed documents never deleted. Do not touch `AppLayout.tsx`
  (a parallel thread owns nav/header work right now) — if a nav label/route must change,
  note it in the report for the orchestrator instead of editing.
- Done-checks: `npm run typecheck`, `npm run typecheck:api`, `npm run lint` (baseline 29
  warnings / 0 errors) + live RPC/RLS proofs.
- Update `docs/archive/BUILD_TRACKER.md`: add section K rows (K1 profile card, K2 preferences
  boundary, K3 account info, K4 login & security, K5 duplicate elimination) with honest
  statuses.
- Report: `docs/reports/TASK-PROFILE-REPORT.md`, committed + pushed. Print ONLY the report
  path. STOP-and-ask gates: any ambiguity about which of two existing columns is canonical
  for a field (don't guess identity data), and anything requiring AppLayout edits.
