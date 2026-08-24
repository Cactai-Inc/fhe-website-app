-- TASK-OFFERINGDOCS — two defects found while testing the trigger move.
--
-- ── 1. A THIRD WRITER, FIRING ON A DRAFT CART ────────────────────────────────
-- `attach_first_purchase_policies` is a trigger on purchase_items INSERT that
-- hardcodes 'COMPANY_POLICIES' and assigns it the moment a line lands in a cart.
-- It is precisely what the owner rejected today: "they select something from the
-- catalog and instantly get routed to a set of docs." It is also the MEDIA_RELEASE
-- class again — a template key living in a function body, bypassing
-- service_type_document_requirements entirely, so it would keep assigning Company
-- Policies for a service the owner had deliberately unmapped.
--
-- Nothing is lost: COMPANY_POLICIES is seeded for all 12 mapped service types, so
-- it still arrives — at approval, with everything else, from the table the owner
-- can edit. The trigger goes; the function stays installed (D32).
DROP TRIGGER IF EXISTS purchase_items_first_purchase_policies ON purchase_items;

COMMENT ON FUNCTION public.attach_first_purchase_policies() IS
  'RETIRED 2026-08-24 (OFFERINGDOCS): fired on purchase_items INSERT and assigned '
  'a hardcoded COMPANY_POLICIES to a DRAFT cart, before any staff approval. '
  'Superseded by service_type_document_requirements + trg_documents_when_order_opens. '
  'Function retained, trigger removed.';

-- ── 2. MY OWN OVERLOAD ───────────────────────────────────────────────────────
-- 20260824T1600 added a defaulted second parameter to apply_offering_documents
-- with CREATE OR REPLACE, which does not replace — it OVERLOADS. Two functions
-- now answer to one name and a single-argument call is ambiguous. This is exactly
-- the trap TASK-PAMELA's p_send migration went out of its way to avoid by
-- dropping the old signature first, walked into two migrations later.
DROP FUNCTION IF EXISTS public.apply_offering_documents(uuid);
