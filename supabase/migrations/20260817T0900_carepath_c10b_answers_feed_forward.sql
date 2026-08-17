-- CAREPATH §C10b — THE ANSWERS FEED FORWARD; THEY DO NOT DIE IN THE REQUEST.
--
-- Owner: "we collect the information from them on the acquisition or horse care
-- intake. that information then goes into the form used for an evaluation or a
-- contract, or in the case of horse care it goes into the form for their horse
-- intake form."
--
-- The inquiry answers are the FIRST DRAFT OF THE CLIENT'S FILE, not a one-time
-- filter. This is the reader that makes them retrievable per contact and per
-- subject (test 12d), so a downstream form can populate from them instead of
-- staff re-typing what the client already told us.
--
-- ⚠️ ONLY `client_horse` ANSWERS MAY EVER PREFILL A HORSE (§C10b). An order can
-- name THREE different horses — the one they own or lease (`client_horse`), one
-- being evaluated (`evaluated_horse`), and one they hope to buy
-- (`sought_horse`). The last two describe DIFFERENT ANIMALS. That is why this
-- function returns the answers GROUPED BY SUBJECT rather than as one flat bag:
-- a caller cannot accidentally prefill a horse record from the wrong animal
-- without naming the wrong subject out loud.
--
-- ⚠️ AND IT NEVER RETURNS `client_horse` ANSWERS THAT DESCRIBE A HORSE THEY DO
-- NOT HAVE. When the client answered "not yet — I'd like help finding one",
-- `buildSubmission` files those answers under "Horse we are being asked to
-- find" (ASKRIGHT §A3b). They describe a horse we are searching for, so they
-- are returned under `sought_horse` here, never under `client_horse` — and the
-- horse intake, which only reads `client_horse`, therefore shows a blank form.
-- §C10b: "If the order carried no client_horse answers, ask nothing and show a
-- blank form."
--
-- Answers are addressable keys in `requests.details`, not a notes blob — the
-- notes copy exists only because jsonb does not preserve key order.
CREATE OR REPLACE FUNCTION public.my_inquiry_answers()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_contact uuid := current_contact_id();
  v_details jsonb;
  v_out jsonb := jsonb_build_object();
  k text;
  v text;
  v_subject text;
  v_question text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;
  IF v_contact IS NULL THEN RETURN v_out; END IF;

  -- The client's most recent inquiry that actually carries answers. Their file
  -- is drafted from what they last told us, not from an older submission.
  SELECT r.details INTO v_details
    FROM requests r
   WHERE r.contact_id = v_contact
     AND r.details IS NOT NULL AND r.details <> '{}'::jsonb
   ORDER BY r.created_at DESC
   LIMIT 1;
  IF v_details IS NULL THEN RETURN v_out; END IF;

  -- `buildSubmission` writes "{subject label} — {question}" keys. Split on that
  -- separator and regroup, so the caller asks for a SUBJECT and can never be
  -- handed another animal's answers by accident.
  FOR k, v IN SELECT key, value FROM jsonb_each_text(v_details)
  LOOP
    IF position(' — ' IN k) = 0 THEN
      CONTINUE;   -- the two ⚑ flag rows carry no subject; they are staff prose
    END IF;
    -- The separator is THREE CHARACTERS (space, em dash, space). `substring`
    -- and `position` count characters, not bytes — the em dash's 3-byte UTF-8
    -- encoding is irrelevant here, and treating it as bytes ate the first two
    -- letters of every question.
    v_question := btrim(substring(k FROM position(' — ' IN k) + 3));
    v_subject := CASE btrim(substring(k FROM 1 FOR position(' — ' IN k) - 1))
      WHEN 'About you'                       THEN 'person'
      WHEN 'Your horse'                      THEN 'client_horse'
      WHEN 'Horse being evaluated'           THEN 'evaluated_horse'
      WHEN 'Horse you are looking for'       THEN 'sought_horse'
      -- ⚠️ A horse they do not have yet is NOT their horse.
      WHEN 'Horse we are being asked to find' THEN 'sought_horse'
      ELSE NULL END;
    IF v_subject IS NULL THEN CONTINUE; END IF;
    v_out := jsonb_set(
      v_out, ARRAY[v_subject],
      coalesce(v_out->v_subject, '{}'::jsonb) || jsonb_build_object(v_question, v),
      true);
  END LOOP;

  RETURN v_out;
END;
$function$;

REVOKE ALL ON FUNCTION public.my_inquiry_answers() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_inquiry_answers() TO authenticated, service_role;
