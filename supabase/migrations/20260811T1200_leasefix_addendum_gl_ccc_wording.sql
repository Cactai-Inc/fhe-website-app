/*
  # LEASEFIX 2q — the addendum layer (owner change set, 2026-08-10 evening)

  Built to docs/tasks/TASK-LEASEFIX-ADDENDUM-2026-08-10.md. Where it contradicts
  the rulings doc, it wins. B2 / C4 / D3 and the three long-open E1 / E2 / E3 are
  all answered in its ruling block; nothing here waits on anything.

  NO TEMP TABLE, deliberately. 2o and 2p each created `_lf`, so they could not run
  in one transaction — the second failed on a name that already existed. The
  template list is inlined instead, so this file composes with anything.
  NO `COMMIT;` — a migration carrying its own COMMIT ends the dry-run wrapper and
  applies while you believe you are testing.

  ── 0a. THE LANDMINE, HANDLED ───────────────────────────────────────────────
  C1 removes HAS and WILL_OBTAIN from TXN.GL_LESSEE_STATUS. EIGHT other objects
  gate on `equals [HAS, WILL_OBTAIN]`. Left alone they could never match again and
  the entire CCC section would stop rendering on every contract, silently —
  typecheck clean, build clean, clause simply absent. Every one is re-pointed here,
  in the same migration.

  The mapping, which the addendum requires but does not state, so it is a judgment
  recorded openly: the CCC block asks "does the Lessee have a GL policy for CCC to
  attach to?"

      has GL      AGREES, OTHER              -> CCC block available
      no GL       '' (unanswered), ACCEPTS_PERSONALLY -> CCC_NA

  OTHER is treated as having a policy: it is a variant declaration of maintaining
  coverage, and the alternative — treating a free-text declaration as "no policy" —
  would hide the CCC question from a Lessee who may well carry one.

  ── 0b. THE SORT COLLISION ──────────────────────────────────────────────────
  GL_DED_SIMPLE sat at 170 against CCC_PICK at 170, and GL_DED_SPLITC at 171
  against CCC_NA at 171. A tie has no defined resolution, so GL deductible text
  interleaved into the CCC block — which is what the owner saw. GL_DED_SIMPLE moves
  to 164 (after GL_LESSEE_RESP at 163, before CCC_PICK at 170). The CCC block is
  not renumbered: it is dense and other things point at it. GL_DED_SPLITC needs no
  number because D3 deletes it.

  ── D3 / D3a ────────────────────────────────────────────────────────────────
  GL is the LESSEE's own policy, so its deductible is the Lessee's by construction
  and no split is meaningful. The menu and the split clause go; splits survive only
  on mortality and medical, which are the Lessor's policies.

  D3a is load-bearing and is obeyed to the letter: the replacement sentence keeps
  "arising from events for which Lessee bears responsibility, whether directly or
  indirectly" EXACTLY as given. That fragment is the only thing stopping the clause
  being a blanket assignment of every deductible to the Lessee. It is not tidied.

  ── C3: hard delete, having checked ─────────────────────────────────────────
  GL_LESSEE_HAS / _WILL / _RESP are DELETED, not retired. Checked first, as the
  addendum requires: zero EXECUTED documents carry a contract_field on any of the
  three, so nothing evidential points at them. Executed documents are untouched.

  Requires PGCLIENTENCODING=UTF8.
*/

-- ═══ 0b — clear the sort collision ═══════════════════════════════════════════
UPDATE contract_clause_defs SET sort_order = 164
 WHERE template_key IN ('HORSE_LEASE_V2','HORSE_LEASE_STANDARD','HORSE_LEASE_FULL','HORSE_LEASE_SIMPLE')
   AND clause_key = 'INSURANCE_RISK.GL_DED_SIMPLE';


-- ═══ D2 / D3 — the GL deductible menu and split go ═══════════════════════════
DELETE FROM contract_clause_defs
 WHERE template_key IN ('HORSE_LEASE_V2','HORSE_LEASE_STANDARD','HORSE_LEASE_FULL','HORSE_LEASE_SIMPLE')
   AND clause_key = 'INSURANCE_RISK.GL_DED_SPLITC';
DELETE FROM contract_field_defs
 WHERE template_key IN ('HORSE_LEASE_V2','HORSE_LEASE_STANDARD','HORSE_LEASE_FULL','HORSE_LEASE_SIMPLE')
   AND field_key IN ('TXN.GL_DED_RESP', 'TXN.GL_DED_LESSEE_SHARE',
                     'TXN.GL_DED_RESP_SPLIT_LESSOR', 'TXN.GL_DED_RESP_SPLIT_LESSEE');

-- D1 — the sentence now ends in a fixed word. The at-fault scoping is reproduced
-- exactly as specified; do not tidy it.
UPDATE contract_clause_defs
   SET body = 'For any and all such claims made against any such insurance policy arising from events for which Lessee bears responsibility, whether directly or indirectly, responsibility for any deductible shall be borne by Lessee',
       conditional_on = '{"equals": ["GL_ONLY"], "field_key": "TXN.GL_LESSOR_REQUIRES"}'::jsonb
 WHERE template_key IN ('HORSE_LEASE_V2','HORSE_LEASE_STANDARD','HORSE_LEASE_FULL','HORSE_LEASE_SIMPLE')
   AND clause_key = 'INSURANCE_RISK.GL_DED_SIMPLE';


-- ═══ A1 / B1 / B2 — Lessor's own coverage, and what Lessor requires ══════════
UPDATE contract_clause_defs
   SET body = 'Lessor does not have general liability insurance for the Horse or the activities contemplated by this Agreement.'
 WHERE template_key IN ('HORSE_LEASE_V2','HORSE_LEASE_STANDARD','HORSE_LEASE_FULL','HORSE_LEASE_SIMPLE')
   AND clause_key = 'INSURANCE_RISK.GL_LESSOR_COVERAGE_NONE';

UPDATE contract_clause_defs
   SET body = 'Lessor requires Lessee to maintain, at Lessee''s sole cost, general liability insurance covering the Horse and the activities contemplated by this Agreement for the duration of this Agreement, and to provide proof of coverage to Lessor upon request. Failure to maintain coverage constitutes a material breach subject to the Termination for Cause provisions of this Agreement.'
 WHERE template_key IN ('HORSE_LEASE_V2','HORSE_LEASE_STANDARD','HORSE_LEASE_FULL','HORSE_LEASE_SIMPLE')
   AND clause_key = 'INSURANCE_RISK.GL_REQUIRED';

UPDATE contract_field_defs
   SET options = '[{"label": "Requires Lessee to maintain general liability insurance", "value": "GL_ONLY"},
                   {"label": "Does not require general liability insurance of Lessee", "value": "NEITHER"}]'::jsonb
 WHERE template_key IN ('HORSE_LEASE_V2','HORSE_LEASE_STANDARD','HORSE_LEASE_FULL','HORSE_LEASE_SIMPLE')
   AND field_key = 'TXN.GL_LESSOR_REQUIRES';


-- ═══ C1 / C2 / C3 — the Lessee's declaration ═════════════════════════════════
-- Three options. ACCEPTS_PERSONALLY is RETAINED per C4, keeping its existing
-- `when` gate; only HAS and WILL_OBTAIN are removed. OTHER uses the established
-- {"label":"Other","value":"OTHER"} pattern that InlineSelect's isOtherOpt already
-- recognises and pairs with a free-text box — no new input mechanism.
UPDATE contract_field_defs
   SET options = '[{"label": "Agrees", "value": "AGREES"},
                   {"label": "Does not carry general liability insurance", "value": "ACCEPTS_PERSONALLY",
                    "when": {"equals": ["NEITHER"], "field_key": "TXN.GL_LESSOR_REQUIRES"}},
                   {"label": "Other", "value": "OTHER"}]'::jsonb
 WHERE template_key IN ('HORSE_LEASE_V2','HORSE_LEASE_STANDARD','HORSE_LEASE_FULL','HORSE_LEASE_SIMPLE')
   AND field_key = 'TXN.GL_LESSEE_STATUS';

INSERT INTO contract_clause_defs (
  template_key, section_key, clause_key, heading, body, clause_type, sort_order,
  is_optional, conditional_on, render_as_subitem)
SELECT k, 'INSURANCE_RISK', 'INSURANCE_RISK.GL_LESSEE_AGREES', NULL,
       'Lessee agrees to maintain general liability insurance covering the Horse and the activities contemplated by this Agreement for the duration of this Agreement, and shall provide to Lessor proof of coverage upon request. As between the parties, and except as otherwise expressly allocated in this Agreement, Lessee bears responsibility for liability claims for bodily injury or property damage to third parties arising from the Horse or the activities contemplated by this Agreement to the extent not covered by an in-force policy.',
       'prose', 160, false,
       '{"equals": ["AGREES"], "field_key": "TXN.GL_LESSEE_STATUS"}'::jsonb, false
  FROM unnest(ARRAY['HORSE_LEASE_V2','HORSE_LEASE_STANDARD','HORSE_LEASE_FULL','HORSE_LEASE_SIMPLE']) k
ON CONFLICT (template_key, clause_key) DO NOTHING;

-- C3: hard delete — verified zero EXECUTED documents reference these
DELETE FROM contract_clause_defs
 WHERE template_key IN ('HORSE_LEASE_V2','HORSE_LEASE_STANDARD','HORSE_LEASE_FULL','HORSE_LEASE_SIMPLE')
   AND clause_key IN ('INSURANCE_RISK.GL_LESSEE_HAS','INSURANCE_RISK.GL_LESSEE_WILL',
                      'INSURANCE_RISK.GL_LESSEE_RESP');


-- ═══ 0a — re-point EVERY gate that named a deleted value ═════════════════════
UPDATE contract_field_defs
   SET conditional_on = replace(conditional_on::text,
         '"equals": ["HAS", "WILL_OBTAIN"], "field_key": "TXN.GL_LESSEE_STATUS"',
         '"equals": ["AGREES", "OTHER"], "field_key": "TXN.GL_LESSEE_STATUS"')::jsonb
 WHERE template_key IN ('HORSE_LEASE_V2','HORSE_LEASE_STANDARD','HORSE_LEASE_FULL','HORSE_LEASE_SIMPLE')
   AND conditional_on::text LIKE '%"HAS", "WILL_OBTAIN"%'
   AND conditional_on::text LIKE '%TXN.GL_LESSEE_STATUS%';

UPDATE contract_clause_defs
   SET conditional_on = replace(conditional_on::text,
         '"equals": ["HAS", "WILL_OBTAIN"], "field_key": "TXN.GL_LESSEE_STATUS"',
         '"equals": ["AGREES", "OTHER"], "field_key": "TXN.GL_LESSEE_STATUS"')::jsonb
 WHERE template_key IN ('HORSE_LEASE_V2','HORSE_LEASE_STANDARD','HORSE_LEASE_FULL','HORSE_LEASE_SIMPLE')
   AND conditional_on::text LIKE '%"HAS", "WILL_OBTAIN"%'
   AND conditional_on::text LIKE '%TXN.GL_LESSEE_STATUS%';


-- ═══ F1 – F5 — care, custody and control ═════════════════════════════════════
UPDATE contract_clause_defs
   SET body = 'Lessor does not require Lessee to maintain care, custody and control coverage under this Agreement.'
 WHERE template_key IN ('HORSE_LEASE_V2','HORSE_LEASE_STANDARD','HORSE_LEASE_FULL','HORSE_LEASE_SIMPLE')
   AND clause_key = 'INSURANCE_RISK.CCC_NOT_REQUIRED';

-- F2: "have" -> "maintain", and "loss of," dropped from the APPLICABILITY sentence
-- only. The final sentence still reads "Where a loss is caused…" — left alone.
UPDATE contract_clause_defs
   SET body = 'Lessor requires Lessee to maintain care, custody and control insurance for the duration of this Agreement. Care, custody and control insurance applies only where injury to, or death of the Horse is caused by Lessee''s negligence. It shall not be claimed against merely because other coverage is unavailable, is not in force, or has denied a claim. Where a loss is caused by Lessee''s negligence, care, custody and control insurance is the policy to be claimed against for that loss.'
 WHERE template_key IN ('HORSE_LEASE_V2','HORSE_LEASE_STANDARD','HORSE_LEASE_FULL','HORSE_LEASE_SIMPLE')
   AND clause_key = 'INSURANCE_RISK.CCC_REQ';

UPDATE contract_field_defs
   SET options = '[{"label": "Requires Lessee to maintain care, custody and control coverage", "value": "YES"},
                   {"label": "Does not require care, custody and control coverage of Lessee", "value": "NO"}]'::jsonb
 WHERE template_key IN ('HORSE_LEASE_V2','HORSE_LEASE_STANDARD','HORSE_LEASE_FULL','HORSE_LEASE_SIMPLE')
   AND field_key = 'TXN.CCC_REQUIRED';

-- F4: lower-case labels are deliberate — this token renders inline mid-sentence
UPDATE contract_field_defs
   SET options = '[{"label": "agrees to maintain", "value": "AGREES"},
                   {"label": "Other", "value": "OTHER"}]'::jsonb
 WHERE template_key IN ('HORSE_LEASE_V2','HORSE_LEASE_STANDARD','HORSE_LEASE_FULL','HORSE_LEASE_SIMPLE')
   AND field_key = 'TXN.CCC_LESSEE_STATUS';

-- F5: the colon goes, so AGREES composes as a sentence
UPDATE contract_clause_defs
   SET body = 'Lessee {{TXN.CCC_LESSEE_STATUS}} care, custody and control insurance covering the Horse while in Lessee''s care, custody, or control.'
 WHERE template_key IN ('HORSE_LEASE_V2','HORSE_LEASE_STANDARD','HORSE_LEASE_FULL','HORSE_LEASE_SIMPLE')
   AND clause_key = 'INSURANCE_RISK.CCC_STATUS';
