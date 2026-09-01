-- ─────────────────────────────────────────────────────────────────────────────
-- DROP THE SUPERSEDED ASSIGNMENT RPCs (2026-07-30)
--
-- Cleanup of my own work, not of anything pre-existing.
--
-- Earlier today I built a population-wide "require this document from everyone
-- who is behind" sweep. The owner's actual requirement turned out to be a PROMPT
-- on each version bump — all / choose-who / no-one — which shipped as
-- resolve_version_decision(). The sweep was a replacement built alongside the
-- thing it should have been, and leaving both would mean two ways to create the
-- same obligations with different semantics. That divergence is precisely what
-- this consolidation exists to remove, so the superseded ones go.
--
-- Verified before dropping: none is referenced by any other function, view or
-- trigger, and none has a frontend caller (their client wrappers were removed in
-- the same pass).
--
--   require_document_from_all(text)          superseded by resolve_version_decision
--   template_reassignment_candidates()       superseded by pending_version_decisions
--   assign_document_to_contact(uuid, text)   duplicated set_contact_required_documents,
--                                            the existing per-person checkbox control
--
-- KEPT: require_resign_from(text, uuid[]) — resolve_version_decision calls it
-- server-side for both the ALL and SELECTED answers. It is the primitive, not a
-- parallel path.
-- ─────────────────────────────────────────────────────────────────────────────

DROP FUNCTION IF EXISTS public.require_document_from_all(text);
DROP FUNCTION IF EXISTS public.template_reassignment_candidates();
DROP FUNCTION IF EXISTS public.assign_document_to_contact(uuid, text);
