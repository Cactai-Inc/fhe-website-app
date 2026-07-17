-- Seed the new horse-field vocabularies into lookup_options. These were free-text;
-- they now get a starter option list + the "Other" escape (captured for review).

INSERT INTO public.lookup_options (lookup_key, code, display_name, sort_order) VALUES
  -- registration organizations (sport-horse / breed registries commonly seen)
  ('horse_registration_org','USEF','US Equestrian (USEF)',10),
  ('horse_registration_org','USHJA','US Hunter Jumper Assoc. (USHJA)',20),
  ('horse_registration_org','USDF','US Dressage Federation (USDF)',30),
  ('horse_registration_org','FEI','Fédération Équestre Internationale (FEI)',40),
  ('horse_registration_org','KWPN','KWPN (Dutch Warmblood)',50),
  ('horse_registration_org','HANOVERIAN','Hanoverian Verband',60),
  ('horse_registration_org','OLDENBURG','Oldenburg (GOV)',70),
  ('horse_registration_org','HOLSTEINER','Holsteiner Verband',80),
  ('horse_registration_org','SELLE_FRANCAIS','Selle Français Stud Book',90),
  ('horse_registration_org','JOCKEY_CLUB','The Jockey Club (Thoroughbred)',100),
  ('horse_registration_org','AQHA','American Quarter Horse Assoc. (AQHA)',110),
  ('horse_registration_org','ARABIAN','Arabian Horse Assoc. (AHA)',120),
  ('horse_registration_org','NONE','Not registered',900),

  -- passport countries (common; the "Other" escape covers the rest)
  ('horse_passport_country','US','United States',10),
  ('horse_passport_country','FR','France',20),
  ('horse_passport_country','DE','Germany',30),
  ('horse_passport_country','NL','Netherlands',40),
  ('horse_passport_country','BE','Belgium',50),
  ('horse_passport_country','GB','United Kingdom',60),
  ('horse_passport_country','IE','Ireland',70),
  ('horse_passport_country','CA','Canada',80),
  ('horse_passport_country','ES','Spain',90),
  ('horse_passport_country','IT','Italy',100),
  ('horse_passport_country','NONE','No passport',900),

  -- markings (the common set; horses often have several — the field stays a single
  -- select-or-other for now, "Other" captures compound descriptions)
  ('horse_markings','NONE','None',10),
  ('horse_markings','STAR','Star',20),
  ('horse_markings','STRIPE','Stripe',30),
  ('horse_markings','SNIP','Snip',40),
  ('horse_markings','BLAZE','Blaze',50),
  ('horse_markings','STAR_STRIPE','Star and stripe',60),
  ('horse_markings','SOCK','Sock(s)',70),
  ('horse_markings','STOCKING','Stocking(s)',80),
  ('horse_markings','CORONET','Coronet(s)',90)
ON CONFLICT (lookup_key, code) DO NOTHING;
