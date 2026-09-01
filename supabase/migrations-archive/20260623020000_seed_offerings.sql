/*
  # Seed offerings + tiers from the service catalog

  Mirrors src/lib/services.ts so the offerings page and request/purchase flows can
  be DB-backed. Idempotent: upserts by slug / (offering, label).
*/

-- Upsert offerings by slug
INSERT INTO offerings (segment, name, tagline, description, slug, active, sort_order) VALUES
  ('rider','Horseback Riding Lessons','Tailored instruction for every level',
   'Private and semi-private riding lessons with a focus on a correct, balanced seat and a harmonious connection with your horse. Beginners through advanced amateurs.',
   'riding-lesson', true, 1),
  ('rider','Hunter Jumper Training','Develop skill, rhythm, and partnership over fences',
   'Structured monthly training: course work, gymnastic grids, flat work, and preparation for local schooling shows.',
   'hunter-jumper', true, 2),
  ('rider','Horsemanship Classes','The foundation every rider deserves',
   'Ground-based classes that deepen your understanding of equine behaviour, body language, and partnership.',
   'horsemanship', true, 3),
  ('horse','Hands-On Horse Training','Patient, methodical training rooted in classical principles',
   'Professional training for horses at any stage — green-breaking, refining, rehabilitation, or competition prep.',
   'horse-training', true, 1),
  ('horse','Riding & Turnout Service','Keep your horse fit, supple, and content',
   'We ride, exercise, and turn out your horse on your behalf — ideal when travelling, recovering, or needing support.',
   'riding-turnout', true, 2),
  ('horse','Hair Clipping','A clean, functional clip for comfort and health',
   'A clean, functional clip for the horse''s comfort and health, not a show turnout. We do not clip at events.',
   'hair-clipping', true, 3),
  ('support','Horse Locator Service','We find the right match — you make the decision',
   'We draw on an extensive network to curate a shortlist of horses that align with your goals, budget, and experience. Retainer credited toward brokering at purchase.',
   'horse-locator', true, 1),
  ('support','Pre-Purchase & Lease Evaluation','Expert eyes before you commit',
   'A thorough on-site evaluation of any horse you are considering — movement, temperament, training level, soundness. Written summary and consultation call.',
   'evaluation', true, 2),
  ('support','Purchase & Lease Brokering','Professional guidance through every step',
   'We manage the entire purchase or lease — negotiating, coordinating vet exams, reviewing contracts, and ensuring a smooth transition.',
   'brokering', true, 3)
ON CONFLICT (slug) DO UPDATE SET
  segment = EXCLUDED.segment, name = EXCLUDED.name, tagline = EXCLUDED.tagline,
  description = EXCLUDED.description, active = EXCLUDED.active, sort_order = EXCLUDED.sort_order;

-- Tiers. Insert only when the (offering, label) pair is absent.
DO $$
DECLARE
  v_id uuid;
BEGIN
  -- Riding lessons
  SELECT id INTO v_id FROM offerings WHERE slug = 'riding-lesson';
  INSERT INTO offering_tiers (offering_id,label,description,price_amount,price_unit,note,is_popular,sort_order)
  SELECT v_id, t.label, t.description, t.price, t.unit, t.note, t.popular, t.ord FROM (VALUES
    ('Single Lesson','60-minute private lesson',125,'session',NULL,false,1),
    ('5-Lesson Pack','Five 60-minute private lessons',575,'flat','$115 / lesson — save $50',true,2),
    ('10-Lesson Pack','Ten 60-minute private lessons',1100,'flat','$110 / lesson — save $150',false,3),
    ('1x / Week Monthly','One lesson per week, billed monthly',450,'month',NULL,false,4),
    ('2x / Week Monthly','Two lessons per week, billed monthly',875,'month','Most popular for working professionals',true,5)
  ) AS t(label,description,price,unit,note,popular,ord)
  WHERE NOT EXISTS (SELECT 1 FROM offering_tiers ot WHERE ot.offering_id = v_id AND ot.label = t.label);

  -- Hunter jumper
  SELECT id INTO v_id FROM offerings WHERE slug = 'hunter-jumper';
  INSERT INTO offering_tiers (offering_id,label,description,price_amount,price_unit,note,is_popular,sort_order)
  SELECT v_id, t.label, t.description, t.price, t.unit, t.note, t.popular, t.ord FROM (VALUES
    ('Monthly Training Program','Weekly training sessions + flat days + show prep',395,'month',NULL,true,1)
  ) AS t(label,description,price,unit,note,popular,ord)
  WHERE NOT EXISTS (SELECT 1 FROM offering_tiers ot WHERE ot.offering_id = v_id AND ot.label = t.label);

  -- Horsemanship
  SELECT id INTO v_id FROM offerings WHERE slug = 'horsemanship';
  INSERT INTO offering_tiers (offering_id,label,description,price_amount,price_unit,note,is_popular,sort_order)
  SELECT v_id, t.label, t.description, t.price, t.unit, t.note, t.popular, t.ord FROM (VALUES
    ('Single Class','90-minute group horsemanship class',90,'session',NULL,false,1),
    ('4-Class Pack','Four 90-minute group classes',320,'flat','$80 / class — save $40',true,2)
  ) AS t(label,description,price,unit,note,popular,ord)
  WHERE NOT EXISTS (SELECT 1 FROM offering_tiers ot WHERE ot.offering_id = v_id AND ot.label = t.label);

  -- Horse training
  SELECT id INTO v_id FROM offerings WHERE slug = 'horse-training';
  INSERT INTO offering_tiers (offering_id,label,description,price_amount,price_unit,note,is_popular,sort_order)
  SELECT v_id, t.label, t.description, t.price, t.unit, t.note, t.popular, t.ord FROM (VALUES
    ('Single Session','60-minute professional training session',150,'session',NULL,false,1),
    ('5-Session Pack','Five 60-minute training sessions',700,'flat','$140 / session — save $50',true,2),
    ('10-Session Pack','Ten 60-minute training sessions',1350,'flat','$135 / session — save $150',false,3),
    ('Monthly Program (3x / Week)','Consistent training 3 days per week',1650,'month',NULL,true,4)
  ) AS t(label,description,price,unit,note,popular,ord)
  WHERE NOT EXISTS (SELECT 1 FROM offering_tiers ot WHERE ot.offering_id = v_id AND ot.label = t.label);

  -- Riding & turnout
  SELECT id INTO v_id FROM offerings WHERE slug = 'riding-turnout';
  INSERT INTO offering_tiers (offering_id,label,description,price_amount,price_unit,note,is_popular,sort_order)
  SELECT v_id, t.label, t.description, t.price, t.unit, t.note, t.popular, t.ord FROM (VALUES
    ('Weekly Service','5 days of riding and/or turnout per week',295,'week',NULL,false,1),
    ('Monthly Service','Full month of daily riding and turnout',1095,'month','Best value — includes weekend coverage',true,2)
  ) AS t(label,description,price,unit,note,popular,ord)
  WHERE NOT EXISTS (SELECT 1 FROM offering_tiers ot WHERE ot.offering_id = v_id AND ot.label = t.label);

  -- Hair clipping
  SELECT id INTO v_id FROM offerings WHERE slug = 'hair-clipping';
  INSERT INTO offering_tiers (offering_id,label,description,price_amount,price_unit,note,is_popular,sort_order)
  SELECT v_id, t.label, t.description, t.price, t.unit, t.note, t.popular, t.ord FROM (VALUES
    ('Bridle Path & Ears','Bridle path, ears, muzzle, and face tidying',85,'session',NULL,false,1),
    ('Legs & Face Clip','Legs, face, and bridle path',110,'session',NULL,false,2),
    ('Full Body Clip','Complete body clip for working horses',225,'session',NULL,true,3)
  ) AS t(label,description,price,unit,note,popular,ord)
  WHERE NOT EXISTS (SELECT 1 FROM offering_tiers ot WHERE ot.offering_id = v_id AND ot.label = t.label);

  -- Horse locator
  SELECT id INTO v_id FROM offerings WHERE slug = 'horse-locator';
  INSERT INTO offering_tiers (offering_id,label,description,price_amount,price_unit,note,is_popular,sort_order)
  SELECT v_id, t.label, t.description, t.price, t.unit, t.note, t.popular, t.ord FROM (VALUES
    ('Search Retainer','Curated shortlist of 3–5 horses matched to your criteria',350,'flat','Credited toward brokering fee at purchase',true,1)
  ) AS t(label,description,price,unit,note,popular,ord)
  WHERE NOT EXISTS (SELECT 1 FROM offering_tiers ot WHERE ot.offering_id = v_id AND ot.label = t.label);

  -- Evaluation
  SELECT id INTO v_id FROM offerings WHERE slug = 'evaluation';
  INSERT INTO offering_tiers (offering_id,label,description,price_amount,price_unit,note,is_popular,sort_order)
  SELECT v_id, t.label, t.description, t.price, t.unit, t.note, t.popular, t.ord FROM (VALUES
    ('Pre-Purchase Evaluation','Full evaluation + written report + consultation',275,'session',NULL,true,1),
    ('Lease Evaluation','Evaluation and lease suitability assessment',225,'session',NULL,false,2)
  ) AS t(label,description,price,unit,note,popular,ord)
  WHERE NOT EXISTS (SELECT 1 FROM offering_tiers ot WHERE ot.offering_id = v_id AND ot.label = t.label);

  -- Brokering (percent → modelled with price_min)
  SELECT id INTO v_id FROM offerings WHERE slug = 'brokering';
  INSERT INTO offering_tiers (offering_id,label,description,price_amount,price_unit,price_min,note,is_popular,sort_order)
  SELECT v_id, t.label, t.description, t.price, t.unit, t.pmin, t.note, t.popular, t.ord FROM (VALUES
    ('Purchase Brokering','3% of purchase price (minimum $500) — full service representation',3,'percent',500,'3% of purchase price — min $500',true,1),
    ('Lease Arrangement','Full lease coordination and contract management',425,'flat',NULL,NULL,false,2)
  ) AS t(label,description,price,unit,pmin,note,popular,ord)
  WHERE NOT EXISTS (SELECT 1 FROM offering_tiers ot WHERE ot.offering_id = v_id AND ot.label = t.label);
END $$;
