/*
  # Owner pricing (2026-07-01) — replaces the placeholder catalog

  First real price sheet from the owner. Replaces the placeholder tiers for the
  repriced service lines wholesale (delete + insert; tier ids are not referenced
  by any seed and order_items.tier_id is only populated at purchase time).
  Adds the horse-exercise offering (priced as its own line now; the offering
  did not exist — exercise previously rode along under training).

  Frontend twin: src/lib/catalog.ts mirrors the rider-facing subset; the
  drift-guard test (purchase_catalog_matrix) pins the lesson tiers to these rows.
*/

-- New offering: horse exercise (idempotent).
INSERT INTO offerings (org_id, segment, name, tagline, slug, active, sort_order)
SELECT (SELECT id FROM organizations ORDER BY created_at LIMIT 1),
       'horse', 'Horse Exercise', 'Consistent under-saddle and ground work between your rides', 'horse-exercise', true, 45
WHERE NOT EXISTS (SELECT 1 FROM offerings WHERE slug = 'horse-exercise');

-- Bridge to the canonical 13-service catalog (turnout + exercise both live in
-- the HORSE_EXERCISE family; no separate turnout code exists).
UPDATE offerings SET service_type = 'HORSE_EXERCISE'
 WHERE slug = 'horse-exercise' AND service_type IS DISTINCT FROM 'HORSE_EXERCISE';

DO $$
DECLARE
  v_id uuid;
  v_org uuid;
BEGIN
  -- ── Riding lessons (with our horses + own-horse/lessee line) ──
  SELECT id, org_id INTO v_id, v_org FROM offerings WHERE slug = 'riding-lesson';
  DELETE FROM offering_tiers WHERE offering_id = v_id;
  INSERT INTO offering_tiers (org_id,offering_id,label,description,price_amount,price_unit,note,is_popular,sort_order) VALUES
    (v_org,v_id,'Evaluation Lesson','Required before the first lesson for every new client — we assess your riding and map the plan.',150,'session',NULL,false,1),
    (v_org,v_id,'Single Lesson','60-minute private lesson on our horses',150,'session',NULL,false,2),
    (v_org,v_id,'4-Lesson Punch Card','Four private lessons — good for 90 days',500,'flat','Save $100',true,3),
    (v_org,v_id,'8-Lesson Punch Card','Eight private lessons — good for 90 days',950,'flat','Save $150',false,4),
    (v_org,v_id,'1x Weekly','One lesson every week — billed the 1st of each month; 30 days notice to cancel',460,'month',NULL,false,5),
    (v_org,v_id,'2x Weekly','Two lessons every week — billed the 1st of each month; 30 days notice to cancel',880,'month','Most chosen',true,6),
    (v_org,v_id,'3x Weekly','Three lessons every week — billed the 1st of each month; 30 days notice to cancel',1260,'month',NULL,false,7),
    (v_org,v_id,'Own Horse — Single Lesson','60-minute private lesson on your own or leased horse',120,'session',NULL,false,8),
    (v_org,v_id,'Own Horse — 1x Weekly','One lesson a week on your own or leased horse — billed monthly',420,'month',NULL,false,9),
    (v_org,v_id,'Own Horse — 2x Weekly','Two lessons a week on your own or leased horse — billed monthly',780,'month',NULL,false,10);

  -- ── Horse training ──
  SELECT id, org_id INTO v_id, v_org FROM offerings WHERE slug = 'horse-training';
  DELETE FROM offering_tiers WHERE offering_id = v_id;
  INSERT INTO offering_tiers (org_id,offering_id,label,description,price_amount,price_unit,note,is_popular,sort_order) VALUES
    (v_org,v_id,'Training Session','Single training ride by the trainer',95,'session',NULL,false,1),
    (v_org,v_id,'Training 1x Weekly','One training session a week — billed monthly',360,'month',NULL,true,2),
    (v_org,v_id,'Training 2x Weekly','Two training sessions a week — billed monthly',680,'month',NULL,false,3);

  -- ── Horse exercise ──
  SELECT id, org_id INTO v_id, v_org FROM offerings WHERE slug = 'horse-exercise';
  DELETE FROM offering_tiers WHERE offering_id = v_id;
  INSERT INTO offering_tiers (org_id,offering_id,label,description,price_amount,price_unit,note,is_popular,sort_order) VALUES
    (v_org,v_id,'Exercise Session','Single exercise session',55,'session',NULL,false,1),
    (v_org,v_id,'Exercise 1x Weekly','One exercise session a week — billed monthly',200,'month',NULL,false,2),
    (v_org,v_id,'Exercise 2x Weekly','Two exercise sessions a week — billed monthly',390,'month',NULL,true,3);

  -- ── Turnout ──
  SELECT id, org_id INTO v_id, v_org FROM offerings WHERE slug = 'riding-turnout';
  DELETE FROM offering_tiers WHERE offering_id = v_id;
  INSERT INTO offering_tiers (org_id,offering_id,label,description,price_amount,price_unit,note,is_popular,sort_order) VALUES
    (v_org,v_id,'Turnout Session','Single turnout session',25,'session',NULL,false,1),
    (v_org,v_id,'Turnout 1x Weekly','One turnout a week — billed monthly',100,'month',NULL,false,2),
    (v_org,v_id,'Turnout 2x Weekly','Two turnouts a week — billed monthly',200,'month',NULL,false,3);

  -- ── Clipping ──
  SELECT id, org_id INTO v_id, v_org FROM offerings WHERE slug = 'hair-clipping';
  DELETE FROM offering_tiers WHERE offering_id = v_id;
  INSERT INTO offering_tiers (org_id,offering_id,label,description,price_amount,price_unit,note,is_popular,sort_order) VALUES
    (v_org,v_id,'Bridle Path & Ears','Bridle path, ears, muzzle, and face tidying',85,'session',NULL,false,1),
    (v_org,v_id,'Legs & Face Clip','Legs, face, and bridle path',110,'session',NULL,false,2),
    (v_org,v_id,'Full Body Clip','Complete body clip for working horses',200,'session',NULL,true,3);
END $$;
