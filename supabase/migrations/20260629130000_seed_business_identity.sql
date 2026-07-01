/*
  # FHE CRM — Seed Business Identity (migration 20)

  business_config (migration 14) ships as an all-NULL singleton. Seed just the
  business name so generated contracts render the FHE party as "French Heritage
  Equestrian" rather than a blank — nothing more.

  Deliberately NOT stored: the mailing address (private; the website omits it on
  purpose) and the entity formation (we label the party by its business name and
  leave it at that). Only FHE.SIGNATORY_NAME / FHE.SIGNATORY_TITLE appear in the
  contract bodies; signatory_name is set to the business name, signatory_title is
  left blank for the owner to fill.

  Idempotent + non-destructive: only fills fields still NULL.
*/

UPDATE business_config SET
  legal_entity_name = COALESCE(legal_entity_name, 'French Heritage Equestrian'),
  signatory_name    = COALESCE(signatory_name,    'French Heritage Equestrian');
