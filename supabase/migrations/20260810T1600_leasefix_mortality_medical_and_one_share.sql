/*
  # LEASEFIX 2p — ruling 3 (mortality/medical) and the single-share collapse

  ── RULING 3: mortality is the parent, medical the optional component ────────

  On a partial lease the Lessee cannot insure a horse they do not own, so
  "Lessor requires mortality insurance" was the wrong question — carried over from
  general liability, where requiring a policy of the Lessee is meaningful. The only
  true variable is whether the LESSOR holds one, so the old two-dropdown shape
  (TXN.MORT_ELECTION "is it required" + TXN.MORT_LESSOR_STATUS "has/will obtain")
  MERGES into one election whose answer alone governs everything below:

      NOT_CARRIED   Lessor does not carry a mortality insurance policy for the Horse
      CARRIES       Lessor carries a mortality insurance policy for the Horse
      WILL_OBTAIN   Lessor will obtain a mortality insurance policy for the Horse
                    for the duration of this Agreement

  The dependency is one-directional and is the whole design: mortality stands
  alone and needs nothing; medical is available ONLY where mortality is carried or
  will be obtained; mortality never requires medical. This is the same parent/
  component machinery built for GL -> CCC in 2o, reused rather than reinvented.

  VOCABULARY: "component", never "rider" (owner, 2026-08-10). In a horse lease
  "rider" means the person on the horse. MED_NA already said "a component of a
  mortality policy on the Horse"; every clause added here matches that. The word
  is banned in contract text only — parent/rider stays in these comments and the
  engineering docs.

  ── THE SPLIT: ONE FIELD, ONE PARTY, A UNIT SELECTOR ────────────────────────

  Corrected by the owner 2026-08-10, superseding the percent-only reading:

    > "$100 toward the insurance" is not expressible as a percentage. A fixed
    > contribution and a proportion are different agreements — 10% floats with the
    > premium at renewal, $100 does not — so converting one to the other changes
    > what was agreed.

      Lessee's share of the cost:  [$|%] [number]

  `%` means the Lessor's share is 100 minus X. `$` means the Lessor pays the
  remainder. Either way it is arithmetic and left unstated — NEVER a second field.
  Two independent party shares that can each say 60% is what was actually broken.

  So at all five split sites the per-party PAIR is deleted and replaced by one
  field naming the Lessee in its LABEL, not in its value:

      TXN.MORT_COST_SPLIT_{LESSOR,LESSEE}   -> TXN.MORT_COST_LESSEE_SHARE
      TXN.MED_COST_SPLIT_{LESSOR,LESSEE}    -> TXN.MED_COST_LESSEE_SHARE
      TXN.MORT_DED_RESP_SPLIT_{LESSOR,LESSEE} -> TXN.MORT_DED_LESSEE_SHARE
      TXN.MED_DED_RESP_SPLIT_{LESSOR,LESSEE}  -> TXN.MED_DED_LESSEE_SHARE
      TXN.GL_DED_RESP_SPLIT_{LESSOR,LESSEE}   -> TXN.GL_DED_LESSEE_SHARE

  FINAL SHAPE (owner, 2026-08-10): a COMPOSITE `format_type`, authoring-shape
  differing from composed text exactly as week_grid, med_schedule, fee_schedule and
  contacts_list already do:

      authoring   [$|%] [number]          structured = {"unit":"USD|PCT","amount":"100"}
      composed    $100.00     or   100%   symbol before for currency, after for percent

  Composition lives INSIDE the control, which is why this one field replaces four:
  the per-party pair, the `*_SPLIT_TEXT` "Split (composed)" field and the floating
  `Allocation` field. The composed-text fields are not merely deleted — putting
  composition in the control removes the reason they existed.

  NOTE: `percent_split` already exists in compose_field_prose and has ZERO users. It
  composes "Lessor 60%, Lessee 40%" — the two-independent-shares shape the owner
  killed. It is NOT reused here and is left untouched as dead code for a separate
  cleanup to judge.

  The DB half ships here (the compose branch). The AUTHORING CONTROL is a
  ContractCascade change, presented as a diff and NOT applied — shared authoring
  surface for lease, sale and bill of sale.

  Also deleted, per the owner: the premium input, the floating `Allocation` field,
  and the composed `*_SPLIT_TEXT` line that restated the split the line above
  already established. The premium is a FACT that changes over time and belongs in
  an appendix; the split is a TERM of the agreement and belongs in the clause.

  compose_insurance_allocation() becomes inert once TXN.*_POLICY_COST is gone (it
  returns at its first CONTINUE WHEN NOT FOUND). It is LEFT IN PLACE, not dropped,
  so the four migrations that reference it stay replayable.

  Requires PGCLIENTENCODING=UTF8.
*/

CREATE TEMP TABLE _lf(k text) ON COMMIT DROP;
INSERT INTO _lf VALUES
  ('HORSE_LEASE_V2'), ('HORSE_LEASE_STANDARD'), ('HORSE_LEASE_FULL'), ('HORSE_LEASE_SIMPLE');


-- ═══ retire what the owner ordered removed ═══════════════════════════════════
DELETE FROM contract_field_defs
 WHERE template_key IN (SELECT k FROM _lf)
   AND field_key IN (
     'TXN.MORT_LESSOR_STATUS',
     'TXN.MORT_POLICY_COST',  'TXN.MORT_COST_ALLOCATION', 'TXN.MORT_COST_SPLIT_TEXT',
     'TXN.MED_POLICY_COST',   'TXN.MED_COST_ALLOCATION',  'TXN.MED_COST_SPLIT_TEXT',
     'TXN.MORT_COST_SPLIT_LESSOR', 'TXN.MORT_COST_SPLIT_LESSEE',
     'TXN.MED_COST_SPLIT_LESSOR',  'TXN.MED_COST_SPLIT_LESSEE',
     'TXN.MORT_DED_RESP_SPLIT_LESSOR', 'TXN.MORT_DED_RESP_SPLIT_LESSEE',
     'TXN.MED_DED_RESP_SPLIT_LESSOR',  'TXN.MED_DED_RESP_SPLIT_LESSEE',
     'TXN.GL_DED_RESP_SPLIT_LESSOR',   'TXN.GL_DED_RESP_SPLIT_LESSEE');

DELETE FROM contract_clause_defs
 WHERE template_key IN (SELECT k FROM _lf)
   AND clause_key IN ('INSURANCE_RISK.MORT_REQ',
                      'INSURANCE_RISK.MORT_COST_SPLIT', 'INSURANCE_RISK.MORT_COST_TOTAL',
                      'INSURANCE_RISK.MED_COST_SPLIT',  'INSURANCE_RISK.MED_COST_TOTAL',
                      'INSURANCE_RISK.MORT_SHARES', 'INSURANCE_RISK.MED_SHARES');


-- ═══ ruling 3 — one Lessor-side election ═════════════════════════════════════
UPDATE contract_field_defs
   SET label = 'Mortality insurance',
       options = '[{"label": "Lessor does not carry a mortality insurance policy for the Horse", "value": "NOT_CARRIED"},
                   {"label": "Lessor carries a mortality insurance policy for the Horse", "value": "CARRIES"},
                   {"label": "Lessor will obtain a mortality insurance policy for the Horse for the duration of this Agreement", "value": "WILL_OBTAIN"}]'::jsonb
 WHERE template_key IN (SELECT k FROM _lf) AND field_key = 'TXN.MORT_ELECTION';

UPDATE contract_clause_defs
   SET body = 'Lessor does not carry mortality insurance on the Horse under this Agreement. Lessor accepts full risk and responsibility for the loss of the Horse''s value in the event of the Horse''s death, theft, or humane destruction, except as otherwise expressly allocated in this Agreement.',
       conditional_on = '{"equals": ["NOT_CARRIED"], "field_key": "TXN.MORT_ELECTION"}'::jsonb
 WHERE template_key IN (SELECT k FROM _lf) AND clause_key = 'INSURANCE_RISK.MORT_NOT_REQ';

INSERT INTO contract_clause_defs (
  template_key, section_key, clause_key, heading, body, clause_type, sort_order,
  is_optional, conditional_on, render_as_subitem)
SELECT k, 'INSURANCE_RISK', v.ck, NULL, v.body, 'prose', v.so, false, v.cond::jsonb, false
  FROM _lf CROSS JOIN (VALUES
  ('INSURANCE_RISK.MORT_CARRIES', 202,
   'Lessor carries a mortality insurance policy for the Horse. Lessor bears responsibility for loss of, injury to, or death of the Horse, and Lessor''s mortality policy shall be the first policy noticed and claimed against for any such covered event.',
   '{"equals": ["CARRIES"], "field_key": "TXN.MORT_ELECTION"}'),
  ('INSURANCE_RISK.MORT_WILL_OBTAIN', 203,
   'Lessor will obtain a mortality insurance policy for the Horse. Lessor bears responsibility for loss of, injury to, or death of the Horse, and Lessor''s mortality policy shall be the first policy noticed and claimed against for any such covered event.',
   '{"equals": ["WILL_OBTAIN"], "field_key": "TXN.MORT_ELECTION"}')
  ) AS v(ck, so, body, cond)
ON CONFLICT (template_key, clause_key) DO NOTHING;

-- everything downstream keys off "a policy is or will be in force"
UPDATE contract_clause_defs
   SET conditional_on = replace(conditional_on::text,
         '"equals": ["REQUIRED"], "field_key": "TXN.MORT_ELECTION"',
         '"equals": ["CARRIES", "WILL_OBTAIN"], "field_key": "TXN.MORT_ELECTION"')::jsonb
 WHERE template_key IN (SELECT k FROM _lf) AND conditional_on::text LIKE '%"REQUIRED"%';
UPDATE contract_field_defs
   SET conditional_on = replace(conditional_on::text,
         '"equals": ["REQUIRED"], "field_key": "TXN.MORT_ELECTION"',
         '"equals": ["CARRIES", "WILL_OBTAIN"], "field_key": "TXN.MORT_ELECTION"')::jsonb
 WHERE template_key IN (SELECT k FROM _lf) AND conditional_on::text LIKE '%"REQUIRED"%';
UPDATE contract_clause_defs
   SET conditional_on = '{"equals": ["NOT_CARRIED"], "field_key": "TXN.MORT_ELECTION"}'::jsonb
 WHERE template_key IN (SELECT k FROM _lf) AND clause_key = 'INSURANCE_RISK.MED_NA';

-- cost: the three real options, both sections
UPDATE contract_field_defs
   SET options = '[{"label": "paid by Lessor", "value": "LESSOR"},
                   {"label": "split between Lessor and Lessee", "value": "SPLIT"},
                   {"label": "Other", "value": "OTHER"}]'::jsonb
 WHERE template_key IN (SELECT k FROM _lf)
   AND field_key IN ('TXN.MORT_COST_RESP', 'TXN.MED_COST_RESP');


-- ═══ one share field per split site ══════════════════════════════════════════
INSERT INTO contract_clause_defs (
  template_key, section_key, clause_key, heading, body, clause_type, sort_order,
  is_optional, conditional_on, render_as_subitem)
SELECT k, 'INSURANCE_RISK', v.ck, NULL, v.body, 'input', v.so, false, v.cond::jsonb, false
  FROM _lf CROSS JOIN (VALUES
  ('INSURANCE_RISK.MORT_SHARE', 207, 'Lessee''s share of the cost: {{TXN.MORT_COST_LESSEE_SHARE}}',
   '{"all": [{"equals": ["CARRIES", "WILL_OBTAIN"], "field_key": "TXN.MORT_ELECTION"},
             {"equals": ["SPLIT"], "field_key": "TXN.MORT_COST_RESP"}]}'),
  ('INSURANCE_RISK.MED_SHARE', 307, 'Lessee''s share of the cost: {{TXN.MED_COST_LESSEE_SHARE}}',
   '{"all": [{"equals": ["CARRIES", "WILL_OBTAIN"], "field_key": "TXN.MORT_ELECTION"},
             {"equals": ["YES"], "field_key": "TXN.MED_INCLUDED"},
             {"equals": ["SPLIT"], "field_key": "TXN.MED_COST_RESP"}]}')
  ) AS v(ck, so, body, cond)
ON CONFLICT (template_key, clause_key) DO NOTHING;

-- the deductible split clauses lose their pair and take the single share
UPDATE contract_clause_defs
   SET body = 'Lessee''s share of the deductible: {{TXN.MORT_DED_LESSEE_SHARE}}'
 WHERE template_key IN (SELECT k FROM _lf) AND clause_key = 'INSURANCE_RISK.MORT_DEDR_SPLITC';
UPDATE contract_clause_defs
   SET body = 'Lessee''s share of the deductible: {{TXN.MED_DED_LESSEE_SHARE}}'
 WHERE template_key IN (SELECT k FROM _lf) AND clause_key = 'INSURANCE_RISK.MED_DEDR_SPLITC';
UPDATE contract_clause_defs
   SET body = 'Lessee''s share of the deductible: {{TXN.GL_DED_LESSEE_SHARE}}'
 WHERE template_key IN (SELECT k FROM _lf) AND clause_key = 'INSURANCE_RISK.GL_DED_SPLITC';

INSERT INTO contract_field_defs (
  template_key, field_key, label, section, clause_key, owner_role,
  input_kind, value_type, format_type, required, is_optional, sort_order, conditional_on)
SELECT k, v.fk, v.label, 'INSURANCE_RISK', v.ck, 'LESSOR',
       'share_amount', 'text', 'share_amount', false, false, v.so, v.cond::jsonb
  FROM _lf CROSS JOIN (VALUES

  ('TXN.MORT_COST_LESSEE_SHARE', 'Lessee''s share of the cost', 'INSURANCE_RISK.MORT_SHARE', 207,
   '{"all": [{"equals": ["CARRIES", "WILL_OBTAIN"], "field_key": "TXN.MORT_ELECTION"},
             {"equals": ["SPLIT"], "field_key": "TXN.MORT_COST_RESP"}]}'),

  ('TXN.MED_COST_LESSEE_SHARE', 'Lessee''s share of the cost', 'INSURANCE_RISK.MED_SHARE', 307,
   '{"all": [{"equals": ["CARRIES", "WILL_OBTAIN"], "field_key": "TXN.MORT_ELECTION"},
             {"equals": ["YES"], "field_key": "TXN.MED_INCLUDED"},
             {"equals": ["SPLIT"], "field_key": "TXN.MED_COST_RESP"}]}'),

  ('TXN.MORT_DED_LESSEE_SHARE', 'Lessee''s share of the deductible', 'INSURANCE_RISK.MORT_DEDR_SPLITC', 215,
   '{"all": [{"equals": ["CARRIES", "WILL_OBTAIN"], "field_key": "TXN.MORT_ELECTION"},
             {"equals": ["SPLIT", "OTHER"], "field_key": "TXN.MORT_COST_RESP"},
             {"equals": ["SPLIT"], "field_key": "TXN.MORT_DED_RESP"}]}'),

  ('TXN.MED_DED_LESSEE_SHARE', 'Lessee''s share of the deductible', 'INSURANCE_RISK.MED_DEDR_SPLITC', 315,
   '{"all": [{"equals": ["CARRIES", "WILL_OBTAIN"], "field_key": "TXN.MORT_ELECTION"},
             {"equals": ["YES"], "field_key": "TXN.MED_INCLUDED"},
             {"equals": ["SPLIT", "OTHER"], "field_key": "TXN.MED_COST_RESP"},
             {"equals": ["SPLIT"], "field_key": "TXN.MED_DED_RESP"}]}'),

  ('TXN.GL_DED_LESSEE_SHARE', 'Lessee''s share of the deductible', 'INSURANCE_RISK.GL_DED_SPLITC', 164,
   '{"all": [{"equals": ["GL_ONLY"], "field_key": "TXN.GL_LESSOR_REQUIRES"},
             {"equals": ["SPLIT"], "field_key": "TXN.GL_DED_RESP"}]}')

  ) AS v(fk, label, ck, so, cond)
ON CONFLICT (template_key, field_key) DO NOTHING;


-- ═══ the deductible gate the owner reported ══════════════════════════════════
-- it asked who bears the deductible even where the Lessor pays for the policy
UPDATE contract_clause_defs
   SET conditional_on = '{"all": [{"equals": ["CARRIES", "WILL_OBTAIN"], "field_key": "TXN.MORT_ELECTION"},
                                  {"equals": ["SPLIT", "OTHER"], "field_key": "TXN.MORT_COST_RESP"}]}'::jsonb
 WHERE template_key IN (SELECT k FROM _lf) AND clause_key = 'INSURANCE_RISK.MORT_DEDR_SIMPLE';
UPDATE contract_field_defs
   SET conditional_on = '{"all": [{"equals": ["CARRIES", "WILL_OBTAIN"], "field_key": "TXN.MORT_ELECTION"},
                                  {"equals": ["SPLIT", "OTHER"], "field_key": "TXN.MORT_COST_RESP"}]}'::jsonb
 WHERE template_key IN (SELECT k FROM _lf) AND field_key = 'TXN.MORT_DED_RESP';
UPDATE contract_clause_defs
   SET conditional_on = '{"all": [{"equals": ["CARRIES", "WILL_OBTAIN"], "field_key": "TXN.MORT_ELECTION"},
                                  {"equals": ["SPLIT", "OTHER"], "field_key": "TXN.MORT_COST_RESP"},
                                  {"equals": ["SPLIT"], "field_key": "TXN.MORT_DED_RESP"}]}'::jsonb
 WHERE template_key IN (SELECT k FROM _lf) AND clause_key = 'INSURANCE_RISK.MORT_DEDR_SPLITC';

UPDATE contract_clause_defs
   SET conditional_on = '{"all": [{"equals": ["CARRIES", "WILL_OBTAIN"], "field_key": "TXN.MORT_ELECTION"},
                                  {"equals": ["YES"], "field_key": "TXN.MED_INCLUDED"},
                                  {"equals": ["SPLIT", "OTHER"], "field_key": "TXN.MED_COST_RESP"}]}'::jsonb
 WHERE template_key IN (SELECT k FROM _lf) AND clause_key = 'INSURANCE_RISK.MED_DEDR_SIMPLE';
UPDATE contract_field_defs
   SET conditional_on = '{"all": [{"equals": ["CARRIES", "WILL_OBTAIN"], "field_key": "TXN.MORT_ELECTION"},
                                  {"equals": ["YES"], "field_key": "TXN.MED_INCLUDED"},
                                  {"equals": ["SPLIT", "OTHER"], "field_key": "TXN.MED_COST_RESP"}]}'::jsonb
 WHERE template_key IN (SELECT k FROM _lf) AND field_key = 'TXN.MED_DED_RESP';
UPDATE contract_clause_defs
   SET conditional_on = '{"all": [{"equals": ["CARRIES", "WILL_OBTAIN"], "field_key": "TXN.MORT_ELECTION"},
                                  {"equals": ["YES"], "field_key": "TXN.MED_INCLUDED"},
                                  {"equals": ["SPLIT", "OTHER"], "field_key": "TXN.MED_COST_RESP"},
                                  {"equals": ["SPLIT"], "field_key": "TXN.MED_DED_RESP"}]}'::jsonb
 WHERE template_key IN (SELECT k FROM _lf) AND clause_key = 'INSURANCE_RISK.MED_DEDR_SPLITC';


-- ═══ the composite: compose $100.00 or 100% from the stored unit ═══════════
CREATE OR REPLACE FUNCTION public.compose_field_prose(p_format text, p_structured jsonb, p_label text, p_value text DEFAULT NULL::text)
 RETURNS text
 LANGUAGE plpgsql
 IMMUTABLE
AS $function$
DECLARE
  s jsonb := coalesce(p_structured, '{}'::jsonb);
  v_out text; v_party text; v_prov jsonb; v_manage jsonb; v_split jsonb;
  v_parts text[]; v_e jsonb; v_sel int; v_opt jsonb; v_amt text;
  v_num numeric;
BEGIN
  IF p_structured IS NULL OR p_structured = '{}'::jsonb THEN RETURN coalesce(p_value, ''); END IF;
  CASE p_format
    WHEN 'med_schedule' THEN v_out := compose_med_schedule(s);
    WHEN 'reveal_text' THEN v_out := compose_reveal_text(s, p_value);
    WHEN 'yesno' THEN
      v_out := CASE upper(coalesce(s->>'value', p_value, '')) WHEN 'YES' THEN 'Yes' WHEN 'NO' THEN 'No' ELSE coalesce(p_value,'') END;
    WHEN 'contact' THEN
      v_parts := ARRAY[]::text[];
      IF coalesce(s->>'name','')    <> '' THEN v_parts := v_parts || (s->>'name'); END IF;
      IF coalesce(s->>'company','') <> '' THEN v_parts := v_parts || (s->>'company'); END IF;
      IF coalesce(s->>'line1','')   <> '' THEN v_parts := v_parts || (s->>'line1'); END IF;
      IF coalesce(s->>'city','') <> '' OR coalesce(s->>'state','') <> '' OR coalesce(s->>'postal','') <> '' THEN
        v_parts := v_parts || btrim(concat_ws(' ', concat_ws(', ', nullif(s->>'city',''), nullif(s->>'state','')), nullif(s->>'postal','')));
      END IF;
      IF coalesce(s->>'phone','')   <> '' THEN v_parts := v_parts || (s->>'phone'); END IF;
      IF coalesce(s->>'email','')   <> '' THEN v_parts := v_parts || (s->>'email'); END IF;
      IF coalesce(s->>'website','') <> '' THEN v_parts := v_parts || (s->>'website'); END IF;
      v_out := array_to_string(v_parts, ', ');
      IF v_out = '' THEN v_out := needs(coalesce(p_label,'contact')); END IF;
    WHEN 'person' THEN
      v_parts := ARRAY[]::text[];
      IF coalesce(s->>'name','')    <> '' THEN v_parts := v_parts || (s->>'name'); END IF;
      IF coalesce(s->>'company','') <> '' THEN v_parts := v_parts || (s->>'company'); END IF;
      IF coalesce(s->>'phone','')   <> '' THEN v_parts := v_parts || (s->>'phone'); END IF;
      IF coalesce(s->>'email','')   <> '' THEN v_parts := v_parts || (s->>'email'); END IF;
      v_out := array_to_string(v_parts, ', ');
      IF v_out = '' THEN v_out := needs(coalesce(p_label,'contact')); END IF;
    WHEN 'address' THEN
      v_out := compose_address(s->>'line1', s->>'line2', s->>'city', s->>'state', s->>'postal');
      IF coalesce(v_out,'') = '' THEN v_out := needs(coalesce(p_label,'address')); END IF;
    WHEN 'location' THEN
      v_out := nullif(btrim(concat_ws(' — ', nullif(s->>'name',''),
                 compose_address(s->>'line1', s->>'line2', s->>'city', s->>'state', s->>'postal'))), '');
      IF coalesce(v_out,'') = '' THEN v_out := needs(coalesce(p_label,'location')); END IF;
    WHEN 'percent_split' THEN
      v_split := s->'parties'; v_parts := ARRAY[]::text[];
      IF v_split IS NOT NULL THEN
        FOR v_e IN SELECT * FROM jsonb_array_elements(v_split) LOOP
          v_parts := v_parts || (party_label(v_e->>'party') || ' ' || coalesce(v_e->>'pct','?') || '%');
        END LOOP;
      END IF;
      v_out := array_to_string(v_parts, ', ');
      IF coalesce(nullif(s->>'note',''),'') <> '' THEN v_out := btrim(v_out || ' (' || (s->>'note') || ')'); END IF;
      IF v_out = '' THEN v_out := needs(coalesce(p_label,'split')); END IF;
    -- LEASEFIX 2026-08-10: the share composite. Authoring is [$|%] + a number;
    -- the composed form puts the symbol where the unit belongs -- before for
    -- currency, after for percent. One field, one party (named in the LABEL),
    -- replacing the per-party pair, the *_SPLIT_TEXT field and the Allocation
    -- field: composition lives in the control, so those had no reason to exist.
    -- A fixed contribution and a proportion are DIFFERENT AGREEMENTS -- 10%
    -- floats with the premium at renewal, $100 does not -- so the unit is stored,
    -- never inferred and never converted.
    WHEN 'share_amount' THEN
      v_num := nullif(regexp_replace(coalesce(s->>'amount',''), '[^0-9.]', '', 'g'), '')::numeric;
      IF v_num IS NULL THEN
        v_out := needs(coalesce(p_label, 'share'));
      ELSIF upper(coalesce(s->>'unit','PCT')) = 'USD' THEN
        v_out := fmt_money(v_num);
      ELSE
        v_out := rtrim(rtrim(to_char(v_num, 'FM999990.99'), '0'), '.') || '%';
      END IF;
    WHEN 'fee_schedule' THEN
      v_parts := ARRAY[]::text[];
      IF coalesce(nullif(btrim(s->>'initial_due'),''),'') <> '' THEN
        DECLARE v_init text := btrim(s->>'initial_due');
        BEGIN
          -- U2.1: a parseable amount is formatted by fmt_money (two decimals,
          -- thousands separators). Anything the user typed as their own wording
          -- with no number in it is left exactly as written.
          v_num := money_numeric(v_init);
          IF v_num IS NOT NULL THEN v_init := fmt_money(v_num); END IF;
          IF coalesce(nullif(btrim(s->>'initial_terms'),''),'') <> '' THEN
            v_parts := v_parts || ('Initial payment due: ' || v_init || ' — ' || btrim(s->>'initial_terms') || '.');
          ELSE
            v_parts := v_parts || ('Initial payment due: ' || v_init || '.');
          END IF;
        END;
      END IF;
      v_sel := nullif(s->>'selected','')::int;
      IF v_sel IS NOT NULL AND s->'options' IS NOT NULL AND jsonb_array_length(s->'options') > v_sel THEN
        v_opt := (s->'options') -> v_sel; v_amt := btrim(coalesce(v_opt->>'amount',''));
        IF v_amt <> '' THEN
          v_num := money_numeric(v_amt);
          IF v_num IS NOT NULL THEN v_amt := fmt_money(v_num);
          ELSIF left(v_amt,1) <> '$' THEN v_amt := '$' || v_amt; END IF;
          v_out := v_amt || '.';
          IF coalesce(nullif(btrim(v_opt->>'notes'),''),'') <> '' THEN v_out := v_out || ' ' || btrim(v_opt->>'notes'); END IF;
          v_parts := v_parts || v_out;
        END IF;
      END IF;
      v_out := array_to_string(v_parts, ' ');
      IF v_out = '' THEN v_out := needs(coalesce(p_label,'lease fee')); END IF;
    WHEN 'party' THEN
      v_party := s->>'party';
      IF coalesce(v_party,'') = '' THEN v_out := needs(coalesce(p_label,'responsible party'));
      ELSIF v_party = 'CARE_PROVIDER' THEN
        v_prov := s->'provider'; v_out := party_label('CARE_PROVIDER');
        IF coalesce(v_prov->>'name','') <> '' THEN v_out := v_out || ' (' || compose_field_prose('person', v_prov, p_label, NULL) || ')';
        ELSE v_out := v_out || ' (' || needs('care provider contact') || ')'; END IF;
      ELSIF v_party = 'OTHER' THEN v_out := coalesce(nullif(s->>'note',''), needs(coalesce(p_label,'arrangement')));
      ELSIF v_party = 'SHARED' THEN v_out := compose_field_prose('percent_split', s, p_label, NULL);
      ELSE v_out := party_label(v_party); END IF;
    WHEN 'pair' THEN
      v_manage := s->'manage'; IF v_manage IS NULL THEN v_manage := s; END IF;
      v_out := compose_field_prose('party', v_manage, p_label, NULL);
    WHEN 'week_grid' THEN v_out := compose_week_grid(s);
    WHEN 'contacts_list' THEN v_out := compose_contacts_list(s);
    WHEN 'certify' THEN
      -- checked → the statement (its label); unchecked → nothing.
      v_out := CASE WHEN upper(coalesce(s->>'value', p_value, '')) = 'YES'
                    THEN coalesce(p_label, '') ELSE '' END;
    ELSE
      v_out := coalesce(nullif(s->>'value',''), nullif(s->>'text',''), p_value, '');
  END CASE;
  RETURN coalesce(v_out, '');
END;
$function$;
