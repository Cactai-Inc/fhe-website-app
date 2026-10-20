-- Disclosure reciprocity, phase 3: migrate existing record entries to the settled
-- uniform shape, where `description` is the spine of every section. Old per-section
-- keys (condition / summary / concern / entry) move into `description`; nothing lost.

-- Known conditions: {condition} -> {description, ...}
UPDATE public.horses h SET known_conditions_list = (
  SELECT coalesce(jsonb_agg(
    CASE WHEN e ? 'description' THEN e
         ELSE jsonb_strip_nulls(e - 'condition' || jsonb_build_object('description', e->>'condition')) END), '[]'::jsonb)
  FROM jsonb_array_elements(h.known_conditions_list) e)
WHERE jsonb_array_length(coalesce(known_conditions_list,'[]'::jsonb)) > 0;

-- Medical history: {summary} -> {description}
UPDATE public.horses h SET medical_history_list = (
  SELECT coalesce(jsonb_agg(
    CASE WHEN e ? 'description' THEN e
         ELSE jsonb_strip_nulls(e - 'summary' || jsonb_build_object('description', e->>'summary')) END), '[]'::jsonb)
  FROM jsonb_array_elements(h.medical_history_list) e)
WHERE jsonb_array_length(coalesce(medical_history_list,'[]'::jsonb)) > 0;

-- Behavior: {concern} -> {description}
UPDATE public.horses h SET behavioral_history_list = (
  SELECT coalesce(jsonb_agg(
    CASE WHEN e ? 'description' THEN e
         ELSE jsonb_strip_nulls(e - 'concern' || jsonb_build_object('description', e->>'concern')) END), '[]'::jsonb)
  FROM jsonb_array_elements(h.behavioral_history_list) e)
WHERE jsonb_array_length(coalesce(behavioral_history_list,'[]'::jsonb)) > 0;
