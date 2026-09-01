-- SLICE 4 — member "host an event" (community). Members cannot publish events
-- (events INSERT is admin-only), so hosting is a PROPOSAL: this SECURITY DEFINER
-- RPC inserts an UNPUBLISHED event in the member's org. Operators review + publish
-- it from the ops side (existing events_admin policy). Riding-gated at the app layer;
-- also enforced here (a caller with no riding purchase cannot propose).
CREATE OR REPLACE FUNCTION public.propose_community_event(
  p_title       text,
  p_starts_at   timestamptz,
  p_ends_at     timestamptz DEFAULT NULL,
  p_location    text DEFAULT NULL,
  p_description text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_org   uuid := current_org();
  v_id    uuid;
  v_cats  text[] := my_purchase_categories();
BEGIN
  IF v_org IS NULL THEN
    RAISE EXCEPTION 'no org context';
  END IF;
  -- riding is the community qualifier; operators may always propose
  IF NOT ('riding' = ANY(v_cats)) AND NOT has_staff_access() THEN
    RAISE EXCEPTION 'community events are for riders';
  END IF;
  IF p_title IS NULL OR btrim(p_title) = '' THEN
    RAISE EXCEPTION 'title required';
  END IF;
  IF p_starts_at IS NULL THEN
    RAISE EXCEPTION 'start time required';
  END IF;

  INSERT INTO events (title, description, starts_at, ends_at, location, published, org_id)
  VALUES (btrim(p_title), p_description, p_starts_at, p_ends_at, p_location, false, v_org)
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.propose_community_event(text, timestamptz, timestamptz, text, text) TO authenticated;
