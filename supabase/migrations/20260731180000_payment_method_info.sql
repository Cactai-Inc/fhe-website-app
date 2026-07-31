-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 7 "PAYMENT METHOD": ONE INFO BUBBLE, CORRECT TEXT (2026-07-31, owner)
--
-- Three problems, all fixed here.
--
-- 1. THE SECTION BUBBLE WAS WRONG. It read "How the Lessee may pay amounts owed
--    under this Agreement." — but this contract defines how BOTH parties pay
--    each other, so it described half the section.
--
-- 2. GUIDANCE WAS SCATTERED. Two more bubbles sat on individual fields, so a
--    reader had to hunt mid-sentence for fragments. Worse, the card-processor
--    bubble hung off a FULL-WIDTH input, which pushed it onto its own line
--    followed by a stray period. All of it now lives in the section bubble,
--    where it can be read in one place.
--
-- 3. THE TRAILING PERIODS were literal characters typed after each {{token}} in
--    the clause bodies. Removed: the token composes its own sentence, and the
--    result read "…: methods." with the period orphaned after the control.
--
-- Capitalisation corrected too — "Credit Card" and "Accepted" were capitalised
-- mid-sentence for no reason.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. The one bubble, with the conditional card guidance folded in ─────────
UPDATE contract_section_defs
   SET guidance =
       'How each party may pay amounts owed under this Agreement.'
       || E'\n\n'
       || 'Select every method the party may use to pay.'
       || E'\n\n'
       || 'Credit cards'
       || E'\n'
       || 'List the name of the processor(s) and access information (e.g. emailed '
       || 'invoice with link, text message with payment link, payment url inserted '
       || 'here, etc).'
 WHERE template_key = 'HORSE_LEASE_V2' AND section_key = 'PAYMENT_METHOD';

-- ── 2. Retire the two field-level bubbles it replaces ──────────────────────
UPDATE contract_field_defs
   SET guidance = NULL
 WHERE template_key = 'HORSE_LEASE_V2'
   AND field_key IN ('TXN.PAYMENT_METHODS', 'TXN.CARD_PROCESSOR',
                     'TXN.LESSOR_PAYMENT_METHODS', 'TXN.LESSOR_CARD_PROCESSOR');

-- ── 3. Drop the stray periods after the tokens ─────────────────────────────
UPDATE contract_clause_defs
   SET body = regexp_replace(body, '(\{\{[A-Z0-9_.]+\}\})\.', '\1', 'g')
 WHERE template_key = 'HORSE_LEASE_V2'
   AND section_key = 'PAYMENT_METHOD'
   AND body ~ '\}\}\.';
