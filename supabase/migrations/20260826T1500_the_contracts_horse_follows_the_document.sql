-- THE CONTRACT'S HORSE FOLLOWS THE DOCUMENT'S. THERE WERE TWO COLUMNS.
--
-- Owner, 2026-08-26: "deals is one time set and forget for the horse and the
-- appended horse name added to the deal name. i changed the lessor and horse and
-- only the lessor is updated on the deal card shown on the deals page."
--
-- He is describing a symptom of something larger. THE HORSE IS STORED TWICE:
--
--   documents.horse_id   ← what the contract page edits (attach_horse_to_document)
--   contracts.horse_id   ← written ONLY at creation, by create_deal and the three
--                          start_* functions, and NEVER UPDATED AFTERWARDS
--
-- On the live lease the two disagreed outright: contracts.horse_id said "Tiz
-- Love" while documents.horse_id said "Sundance". The deal card reads the
-- CONTRACT's copy, which is why the horse looked frozen; `party_summary` is
-- computed live from contract_parties, which is why the lessor updated. One card,
-- two sources, one of them stale.
--
-- ⚠️ AND THE DEAL CARD IS THE LEAST OF IT. FOURTEEN functions read
-- contracts.horse_id, including:
--
--   client_can_read_horse       AN ACCESS CHECK — a stale horse here means the
--                               previous horse's owner may still read it, and the
--                               new one may not
--   horse_active_lease_doc      which lease is live on a horse
--   generate_lease_availability which horse's calendar gets the slots
--   lease_reminder_sweep        who gets reminded about which animal
--   deal_detail / deal_record_export / horse_deals / list_deals
--
-- Rather than repoint fourteen readers — and miss the fifteenth — the column is
-- made to FOLLOW. `documents.horse_id` is the one a person edits, so it is the
-- authority, and the contract's copy is kept in step by trigger.

BEGIN;

CREATE OR REPLACE FUNCTION public.trg_contract_horse_follows_document()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  -- Only a document that IS this contract's own, and only a real horse: clearing
  -- a document's horse must not silently blank the contract's, because an addendum
  -- with no horse is not a statement that the contract has none.
  IF NEW.contract_id IS NOT NULL AND NEW.horse_id IS NOT NULL THEN
    UPDATE contracts c
       SET horse_id = NEW.horse_id, updated_at = now()
     WHERE c.id = NEW.contract_id
       AND c.horse_id IS DISTINCT FROM NEW.horse_id;
  END IF;
  RETURN NULL;
END;
$function$;

DROP TRIGGER IF EXISTS documents_contract_horse_follows_trg ON public.documents;
CREATE TRIGGER documents_contract_horse_follows_trg
  AFTER INSERT OR UPDATE OF horse_id ON public.documents
  FOR EACH ROW EXECUTE FUNCTION trg_contract_horse_follows_document();

-- Backfill the disagreement that already exists.
UPDATE contracts c
   SET horse_id = d.horse_id, updated_at = now()
  FROM documents d
 WHERE d.contract_id = c.id
   AND d.deleted_at IS NULL
   AND d.horse_id IS NOT NULL
   AND c.horse_id IS DISTINCT FROM d.horse_id;

COMMIT;
