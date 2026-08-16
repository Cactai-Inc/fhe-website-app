-- Owner ruling 2026-08-16 on the policy-vs-catalog conflict: "the catalog wins
-- and the policy needs to be updated to match them."
--
-- COMPANY_POLICIES §4 said multi-lesson packages are valid for 90 days. The
-- catalog says 60 days (4-Lesson Punch Card) and 120 days (8-Lesson Punch Card)
-- -- copy the owner supplied directly on 2026-08-14. A single flat number can no
-- longer describe the offer, so the clause now defers to the per-package term
-- shown at purchase, which is where the real number lives.
--
-- ⚠️ TEMPLATE ONLY. 15 EXECUTED COMPANY_POLICIES documents carry the old 90-day
-- wording. Executed documents are evidence and are NEVER rewritten (D11, and the
-- standing executed-docs rule) -- those clients signed the 90-day term and that
-- is what they signed. This changes what FUTURE signers receive. If the owner
-- wants existing clients moved onto the new terms, that is a re-signing, not an
-- edit, and it goes through the supersession spine.
UPDATE contract_templates
   SET body = replace(
         body,
         'Multi-lesson packages are valid for 90 days from the date of purchase; unused lessons expire at the end of that period.',
         'Multi-lesson packages are valid for the period stated for that package at the time of purchase (currently 60 days for the 4-Lesson Punch Card and 120 days for the 8-Lesson Punch Card); unused lessons expire at the end of that period.'
       )
 WHERE template_key = 'COMPANY_POLICIES'
   AND body LIKE '%valid for 90 days from the date of purchase%';
