-- CAREPATH §C1d — two data fixes, owner-ruled 2026-08-17.
--
-- 1. ONLY THREE SERVICES ARE PRICE-ON-INQUIRY. Owner: "evaluation, search, and
--    acquisition assistance are not to be priced online, in the catalog in app,
--    only priced on inquiry. everything else has a price."
--
--    Clear price_amount to NULL (never 0 — the public surface renders
--    "Price on inquiry" from a NULL, and 0 would print "$0") on every offering
--    in HORSE_EVALUATION / HORSE_FINDER / HORSE_PURCHASE_ASSISTANCE.
--
--    ⚠️ The task named three rows (Lease Evaluation 225, Pre-Purchase
--    Evaluation 275, Search Retainer 350). TWO MORE were found in the same
--    three service types and are cleared by the same rule, because the rule is
--    "every offering in these services", not "these three rows":
--      • Lease Arrangement  — 425.00 flat
--      • Purchase Brokering — 3.00 percent with a 500.00 price_min
--    `price_min` is cleared on the percent row too: it is the "minimum shown"
--    the public summary prints, so leaving it would keep a number online for a
--    service the owner just said carries none. All five rows are INACTIVE
--    today, so nothing a visitor can reach changes; every one of them is
--    editable again in the catalog editor (D13).
--
--    NOTHING ELSE IS REPRICED. The owner says some other numbers are wrong but
--    has supplied no corrections; he edits those himself.
--
-- 2. OWN-HORSE LESSONS MUST TRIGGER THE HORSE DOCUMENTS — today they do not.
--    derive_affiliations grants HORSE_OWNER on `seg = 'horse'`, but the three
--    "(With your horse)" lesson SKUs carry segment 'rider', so a client riding
--    their OWN horse never receives the horse liability release or the vet
--    authorisation — precisely the paperwork that buyer needs. Owner: "or
--    lessons with their horse in the initial order."
--
--    ⚠️ THE GRANT IS A DOCUMENT TRIGGER, NOT A DESCRIPTION OF REALITY (§C10a).
--    Granting HORSE_OWNER to someone with no horse yet is correct and
--    deliberate — it is what summons the horse intake and the horse
--    auth/liability documents. It is NOT changed to require a horse; that was
--    considered and rejected by the owner.
--
--    ⚠️ `horse_included` is 4 false / 9 true / 30 NULL — so the test is
--    `= false`, EXPLICITLY, never `!= true`, or every NULL offering would start
--    summoning horse documents.
--
--    ⚠️ AND IT IS SCOPED TO segment='rider'. `horse-finder` also carries
--    horse_included = false; an unscoped test would hand HORSE_OWNER (and the
--    horse documents) to an acquisition-only buyer, which is the exact deal
--    client §C10a says must receive NONE of them. The predicate below is
--    therefore byte-for-byte the one `my_onboarding_state` already uses to
--    decide `horse_needed`, so the affiliation and the horse step can no longer
--    disagree about the same order.

-- ── 1. price-on-inquiry ─────────────────────────────────────────────────────
UPDATE offerings
   SET price_amount = NULL,
       price_min    = NULL
 WHERE service_type IN ('HORSE_EVALUATION', 'HORSE_FINDER', 'HORSE_PURCHASE_ASSISTANCE')
   AND (price_amount IS NOT NULL OR price_min IS NOT NULL);

-- ── 2. own-horse lessons summon the horse documents ─────────────────────────
CREATE OR REPLACE FUNCTION public.derive_affiliations(p_contact_id uuid)
 RETURNS text[]
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH ex AS (
    SELECT bool_or(t.template_key = 'RELEASE_PARTICIPANT') AS sig_rider,
           bool_or(t.template_key = 'RELEASE_HORSE_CARE')  AS sig_care,
           bool_or(t.template_key = 'HORSE_EMERGENCY_VET') AS sig_vet,
           bool_or(t.template_key = 'RELEASE_GENERAL')     AS sig_guest
      FROM documents d
      JOIN contract_templates t ON t.id = d.template_id
     WHERE d.contact_id = p_contact_id AND d.status = 'EXECUTED' AND d.deleted_at IS NULL
  ),
  -- THE ADMIN'S DECISION. Matched on invitations.contact_id only — never on
  -- email, because two staff identities share one inbox on this tenant and an
  -- email match would hand one person's category to another.
  inv AS (
    SELECT DISTINCT upper(btrim(c)) AS cat
      FROM invitations i, unnest(coalesce(i.categories, '{}'::text[])) c
     WHERE i.contact_id = p_contact_id
       AND i.deleted_at IS NULL
       AND coalesce(i.status, '') NOT IN ('revoked', 'superseded')
       AND btrim(c) <> ''
  ),
  -- THE PURCHASE. segment rider -> RIDER, segment horse -> HORSE_OWNER;
  -- inquire-only lines and voided purchases are not a purchase.
  --
  -- CAREPATH §C1d.2: `own_horse` is the third fact this CTE now carries — a
  -- lesson the client rides THEIR OWN horse in. Same predicate as
  -- my_onboarding_state's horse_needed, so the documents and the horse intake
  -- step are triggered by exactly the same orders.
  pur AS (
    SELECT DISTINCT lower(coalesce(o.segment, '')) AS seg,
           (lower(coalesce(o.segment, '')) = 'rider' AND o.horse_included = false) AS own_horse
      FROM purchases p
      JOIN purchase_items pi ON pi.purchase_id = p.id
      JOIN offerings o       ON o.id = pi.offering_id
     WHERE p.buyer_contact_id = p_contact_id
       AND coalesce(p.status, '') <> 'void'
       AND p.deleted_at IS NULL
       AND coalesce(o.config_kind, '') <> 'inquire'
  )
  SELECT (
    SELECT array_agg(g ORDER BY g) FROM (
      -- GUEST: the visitor release is the affiliation (2026-08-04). Without
      -- this, signing the general release granted NO affiliation at all, so a
      -- visitor had documents on file and no category to hang them on. It is
      -- additive: a guest who later signs a participant release simply gains
      -- RIDER alongside it.
      SELECT 'GUEST'::text AS g
       WHERE (SELECT sig_guest FROM ex)
          OR EXISTS (SELECT 1 FROM inv WHERE cat = 'GUEST')
      UNION
      SELECT 'RIDER'::text AS g
       WHERE (SELECT sig_rider FROM ex)
          OR EXISTS (SELECT 1 FROM inv WHERE cat = 'RIDER')
          OR EXISTS (SELECT 1 FROM pur WHERE seg = 'rider')
      UNION
      SELECT 'HORSE_OWNER'
       WHERE (SELECT (sig_care AND sig_vet) FROM ex)
          OR EXISTS (SELECT 1 FROM horses h
                      WHERE h.current_owner_contact_id = p_contact_id AND h.deleted_at IS NULL)
          OR EXISTS (SELECT 1 FROM inv WHERE cat = 'HORSE_OWNER')
          OR EXISTS (SELECT 1 FROM pur WHERE seg = 'horse')
          -- §C1d.2 — a lesson on their own horse is a horse-related purchase.
          OR EXISTS (SELECT 1 FROM pur WHERE own_horse)
      UNION
      SELECT 'PARENT_GUARDIAN' WHERE EXISTS (
        SELECT 1 FROM document_parties dp
         WHERE dp.contact_id = p_contact_id AND dp.party_role = 'GUARDIAN')
    ) s
  );
$function$;
