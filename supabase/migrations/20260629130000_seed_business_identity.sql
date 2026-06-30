/*
  # FHE CRM — Seed Business Identity from the website brand (migration 20)

  business_config (migration 14) ships as an all-NULL singleton "until the owner
  supplies values". Rather than leave the FHE.* contract tokens blank, seed the
  business-identity fields from the website's single source of truth (src/lib/brand.ts)
  and the mailing address used verbatim in every contract's entity introduction.

  Only the FHE.SIGNATORY_NAME / FHE.SIGNATORY_TITLE tokens actually appear in the
  tokenized contract bodies (signature blocks); the rest fill identity fields for
  completeness. The website does not name a personal signatory, so the signing
  ENTITY is used as a close-enough default — the owner should replace
  signatory_name with the actual authorized signer's name before go-live.

  Idempotent + non-destructive: only fills fields that are still NULL, so a re-run
  (or a later owner edit) is never clobbered. Pricing/commission stay NULL — those
  live on the Rates Card, not the website.
*/

UPDATE business_config SET
  legal_entity_name = COALESCE(legal_entity_name, 'French Heritage Equestrian'),
  entity_formation  = COALESCE(entity_formation,  'California fictitious business name'),
  business_address  = COALESCE(business_address,   '752 Windemere Ct., San Diego, CA 92109'),
  -- close-enough defaults; owner replaces signatory_name with the actual signer
  signatory_name    = COALESCE(signatory_name,    'French Heritage Equestrian'),
  signatory_title   = COALESCE(signatory_title,   'Authorized Representative');
