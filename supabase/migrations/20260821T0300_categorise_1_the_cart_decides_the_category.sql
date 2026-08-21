-- TASK-CATEGORISE §1 — THE CART DECIDES THE CATEGORY.
--
-- OWNER, 2026-08-21: "the mixed inquiry needs to be fixed so it reads the cart
-- contents and everything is properly categorized since that informs the
-- onboarding contents/requirements."
--
-- The category is not a filing label. It selects the LEGAL DOCUMENT SET a person
-- must execute before they set foot on the property, through
-- `category_document_requirements` -> `apply_category_documents`. Today
-- `requests.category` is ONE value chosen from `state.funnel` — which page the
-- visitor happened to be standing on when they submitted (InquiryForm.tsx: the
-- ternary marked "F8 (ASKRIGHT), unchanged and still true"). A visitor who put a
-- riding lesson AND a horse clipping in one cart is filed under one of them and
-- signs one of the two document sets. They arrive uncovered for the other.
--
-- ⚠️ NO `mixed` CATEGORY (owner-approved option (c)). "Mixed" is not a category —
-- it is MORE THAN ONE category. A `mixed` value would need its own document set,
-- which is exactly the wrong shape.
--
-- ⚠️ `requests.category` IS NOT TOUCHED. It keeps its check constraint, keeps its
-- value, and every existing reader (`inbound_queue`, `inquiry_email_payload`,
-- `requests_capture_contact`, the staff drawer) keeps working. This migration
-- WIDENS: it adds the plural set BESIDE the single column.
--
-- WHY A VIEW AND NOT A COLUMN. A stored plural column would need a trigger on
-- `request_selections` to stay in step, and `request_selections` changes after
-- the request is written (states move, §C5c splits an inquiry across two orders).
-- Two writers, two truths, and the drift is invisible because both look
-- populated. A view cannot drift from the rows it reads.

BEGIN;

-- ── 1a ── THE MAP, AS DATA ───────────────────────────────────────────────────
-- `offerings.segment` is already populated for every SKU (43/43, zero NULL).
-- What did not exist is the statement of what a segment MEANS in the two
-- category vocabularies this system already speaks:
--
--   `request_category`    the `requests.category` allowlist — what staff filter
--                         and what the inbound surfaces already display.
--   `onboarding_category` the `category_document_requirements.category`
--                         allowlist — what selects the document set.
--   `onboarding_token`    the STANDING ROLE that category resolves to. It is a
--                         separate column because the two are not the same
--                         string: 'Deal client' resolves to GUEST, and
--                         `apply_category_documents` / `derive_affiliations`
--                         both match the TOKEN. That map lived only in the
--                         browser (`CATEGORY_TOKEN`, src/lib/admin.ts), so the
--                         database could not answer a question the screen could.
--
-- One row per segment per tenant. Both check constraints mirror the live
-- allowlists exactly, so a row that could never resolve cannot be inserted.
CREATE TABLE IF NOT EXISTS segment_categories (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id              uuid NOT NULL REFERENCES organizations(id),
  segment             text NOT NULL,
  request_category    text NOT NULL,
  onboarding_category text NOT NULL,
  onboarding_token    text NOT NULL,
  CONSTRAINT segment_categories_org_segment_key UNIQUE (org_id, segment),
  CONSTRAINT segment_categories_segment_check
    CHECK (segment = ANY (ARRAY['rider','horse','acquisition'])),
  -- mirrors requests_category_check
  CONSTRAINT segment_categories_request_category_check
    CHECK (request_category = ANY (ARRAY['general','lessons','horse_care','acquisition',
                                         'media','partnership','gift'])),
  -- mirrors category_document_requirements_onboarding_check
  CONSTRAINT segment_categories_onboarding_category_check
    CHECK (onboarding_category = ANY (ARRAY['Guest','Rider','Horse owner','Deal client'])),
  -- mirrors groups_group_type_check, minus PARENT_GUARDIAN (never a category)
  CONSTRAINT segment_categories_onboarding_token_check
    CHECK (onboarding_token = ANY (ARRAY['GUEST','RIDER','HORSE_OWNER']))
);

COMMENT ON TABLE segment_categories IS
  'TASK-CATEGORISE: what an offering''s segment means in the two category '
  'vocabularies. Read by the request_categories view (staff filtering) and by '
  'request_onboarding_categories() (the provisioning default). One row per '
  'segment per tenant.';

ALTER TABLE segment_categories ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS segment_categories_staff_read ON segment_categories;
CREATE POLICY segment_categories_staff_read ON segment_categories
  FOR SELECT TO authenticated USING (coalesce(has_staff_access(), false));
GRANT SELECT ON segment_categories TO authenticated, service_role;

-- Seeded for every tenant. `acquisition` -> 'Deal client', which CATEGORY_TOKEN
-- resolves to GUEST: the owner ruled (PARTYROLE, 2026-08-17) that a deal client
-- is your client arriving at the property and signs what any guest signs.
INSERT INTO segment_categories
       (org_id, segment, request_category, onboarding_category, onboarding_token)
SELECT o.id, m.segment, m.request_category, m.onboarding_category, m.onboarding_token
  FROM organizations o
  CROSS JOIN (VALUES
    ('rider',       'lessons',     'Rider',       'RIDER'),
    ('horse',       'horse_care',  'Horse owner', 'HORSE_OWNER'),
    ('acquisition', 'acquisition', 'Deal client', 'GUEST')
  ) AS m(segment, request_category, onboarding_category, onboarding_token)
ON CONFLICT (org_id, segment) DO NOTHING;

-- ── 1b ── REPAIR THE CART LINES THAT CANNOT BE READ ──────────────────────────
-- 7 of the 9 production `request_selections` rows carry `offering_id IS NULL`
-- and the offering's UUID in `offering_slug`. That is ASKRIGHT F3: the checkout
-- sent the UUID under the `offering_slug` key while `submit_public_request`
-- matched on `o.slug` alone, so the lookup never matched and the fallback INSERT
-- wrote the unresolved payload. The WRITE path was fixed by ASKRIGHT; these rows
-- predate it and are still unreadable, so for them the cart decides nothing.
--
-- Match on the id the column actually holds, and restore both columns.
UPDATE request_selections rs
   SET offering_id = o.id,
       offering_slug = o.slug
  FROM offerings o
 WHERE rs.offering_id IS NULL
   AND rs.offering_slug ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
   AND o.id = rs.offering_slug::uuid
   AND o.org_id = rs.org_id;

-- ── 1c ── THE DERIVED SET, BESIDE THE SINGLE COLUMN ──────────────────────────
-- One row per (request, category) in the `requests.category` vocabulary, with
-- provenance. A request appears under EVERY category its cart touches, and also
-- under the value the funnel stored.
--
-- ⚠️ IT UNIONS THE STORED COLUMN DELIBERATELY. §4 of the task: "A derived filter
-- cannot under-count — that is why this option was chosen." Keeping the stored
-- value in the membership means no request can vanish from a filter it appears
-- under today, including the 9 kiosk rows that carry no selections at all. The
-- flags say which source claimed it, so nothing is hidden.
--
-- ⚠️ EVERY LINE COUNTS HERE, whatever its state. This view answers "what did this
-- inquiry touch", which a declined line still did. The provisioning default is
-- the narrower question and is asked separately, in 1d.
--
-- The offering join accepts the id OR either form of the slug — the same three
-- keys `submit_public_request` resolves. 1b repaired every row that needed it;
-- this keeps the read side honest if a future writer forgets `offering_id`
-- again, because a filter that under-counts is the defect this task exists for.
CREATE OR REPLACE VIEW request_categories
WITH (security_invoker = true) AS
  SELECT request_id, org_id, category,
         bool_or(from_cart)   AS from_cart,
         bool_or(from_funnel) AS from_funnel
    FROM (
      SELECT r.id AS request_id, r.org_id, sc.request_category AS category,
             true AS from_cart, false AS from_funnel
        FROM requests r
        JOIN request_selections rs ON rs.request_id = r.id
        JOIN offerings o
          ON o.org_id = r.org_id
         AND (o.id = rs.offering_id
              OR (rs.offering_id IS NULL
                  AND (o.slug = rs.offering_slug OR o.id::text = rs.offering_slug)))
        JOIN segment_categories sc ON sc.org_id = r.org_id AND sc.segment = o.segment
      UNION ALL
      SELECT r.id, r.org_id, r.category, false, true
        FROM requests r
       WHERE r.category IS NOT NULL
    ) s
   GROUP BY request_id, org_id, category;

COMMENT ON VIEW request_categories IS
  'TASK-CATEGORISE: the PLURAL category membership of an inquiry — every '
  'category its cart touches, plus the single value the funnel stored. Beside '
  'requests.category, never instead of it. Staff category filters read this.';

GRANT SELECT ON request_categories TO authenticated, service_role;

-- ── 1d ── THE PROVISIONING DEFAULT ───────────────────────────────────────────
-- The onboarding categories an inquiry implies, in the display vocabulary the
-- provision form and `category_document_requirements` both use.
--
-- ⚠️ THIS IS THE MOST DANGEROUS FUNCTION IN THE TASK, and the reason it takes a
-- contact. `apply_category_documents` DELETES every requirement outside the
-- wanted set — the mechanism that destroyed a boarder's paperwork during
-- PARTYROLE. A DERIVED default introduces a narrowing risk that hand-picked
-- categories did not have: a boarder who inquires about a riding lesson derives
-- {Rider}, and provisioning on that alone would strip HORSE_EMERGENCY_VET and
-- RELEASE_HORSE_CARE from someone whose horse is on the property.
--
-- So the default is a UNION, computed here once rather than in each caller: the
-- cart's categories PLUS the categories the contact already holds. The cart can
-- only ever ADD. Staff can still uncheck anything — §2: the derivation is the
-- default, not a cage — and a deliberate narrowing is a deliberate act, not a
-- side effect of reading a cart.
--
-- A category counts as "already held" when the contact holds EVERY template that
-- category requires (ALL, not ANY: COMPANY_POLICIES alone must not conjure
-- 'Horse owner'), or when their standing affiliation says so. Both sources are
-- read because they answer at different moments — requirements exist from the
-- invitation, groups only after the documents are executed.
--
-- Dead lines are excluded from the CART half only. `declined`, `withdrawn` and
-- `not_a_booking` are each a deliberate staff act meaning this line is not
-- happening, and paperwork for a service that will not happen is not a default.
CREATE OR REPLACE FUNCTION request_onboarding_categories(
  p_request_id   uuid,
  p_contact_id   uuid    DEFAULT NULL,
  p_include_held boolean DEFAULT true
) RETURNS text[]
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_org     uuid;
  v_contact uuid;
  v_cats    text[];
BEGIN
  IF NOT (coalesce(auth.role(), '') = 'service_role'
          OR coalesce(has_staff_access(), false)) THEN
    RAISE EXCEPTION 'not authorized to read request categories';
  END IF;

  SELECT r.org_id, coalesce(p_contact_id, r.contact_id)
    INTO v_org, v_contact
    FROM requests r WHERE r.id = p_request_id;
  IF v_org IS NULL THEN
    RETURN ARRAY[]::text[];
  END IF;

  SELECT coalesce(array_agg(DISTINCT c ORDER BY c), ARRAY[]::text[]) INTO v_cats
  FROM (
    -- the cart
    SELECT sc.onboarding_category AS c
      FROM request_selections rs
      JOIN offerings o
        ON o.org_id = v_org
       AND (o.id = rs.offering_id
            OR (rs.offering_id IS NULL
                AND (o.slug = rs.offering_slug OR o.id::text = rs.offering_slug)))
      JOIN segment_categories sc ON sc.org_id = v_org AND sc.segment = o.segment
     WHERE rs.request_id = p_request_id
       AND rs.state NOT IN ('declined','withdrawn','not_a_booking')

    UNION

    -- what this person already holds: every requirement of the category is on
    -- file. Never narrows; only ever keeps what apply_category_documents would
    -- otherwise delete.
    SELECT cdr.category
      FROM (SELECT DISTINCT category FROM category_document_requirements
             WHERE org_id = v_org) cdr
     WHERE p_include_held AND v_contact IS NOT NULL
       AND EXISTS (SELECT 1 FROM category_document_requirements x
                    WHERE x.org_id = v_org AND x.category = cdr.category)
       AND NOT EXISTS (
             SELECT 1 FROM category_document_requirements x
              WHERE x.org_id = v_org AND x.category = cdr.category
                AND NOT EXISTS (
                      SELECT 1 FROM contact_required_documents crd
                       WHERE crd.contact_id = v_contact
                         AND crd.template_key = x.template_key))

    UNION

    -- and what their standing affiliation says, once documents are executed
    SELECT CASE g.group_type WHEN 'RIDER' THEN 'Rider'
                             WHEN 'HORSE_OWNER' THEN 'Horse owner' END
      FROM groups g
     WHERE p_include_held AND v_contact IS NOT NULL
       AND g.contact_id = v_contact AND g.group_type IN ('RIDER','HORSE_OWNER')
  ) s
  WHERE c IS NOT NULL;

  RETURN v_cats;
END;
$function$;

COMMENT ON FUNCTION request_onboarding_categories(uuid, uuid, boolean) IS
  'TASK-CATEGORISE §2: the onboarding categories an inquiry implies — the cart''s '
  'categories UNION the ones the contact already holds, so a derived default can '
  'only ever ADD documents. Staff override it; it never overrides staff.';

REVOKE ALL ON FUNCTION request_onboarding_categories(uuid, uuid, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION request_onboarding_categories(uuid, uuid, boolean)
  TO authenticated, service_role;

COMMIT;
