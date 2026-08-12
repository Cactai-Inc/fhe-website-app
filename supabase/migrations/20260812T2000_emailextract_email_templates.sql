-- EMAILEXTRACT — the email content table (TASK-EMAILEXTRACT, plan item 10).
--
-- D12: "the email templates will use the same concept as a document engine, only
-- difference is the output type … Emails get their own SECTION inside Templates,
-- not their own engine."  This is that section's storage: ONE engine (prose +
-- {{tokens}} + draft/publish/version), THREE content tables — contract_templates
-- for documents, form_definitions for forms, email_templates for correspondence.
--
-- WHY NOT ROWS INSIDE contract_templates — the task asked for evidence, so:
--   1. CHECK contract_templates_parties_present requires cardinality(party_namespaces) > 0.
--      An email has no parties. Satisfying it means writing a party namespace that is a lie.
--   2. documents.template_id and contract_requirements.template_key are FOREIGN KEYS into it.
--      An email row is then a generatable document and an assignable requirement.
--   3. 69 database functions and 5 frontend read sites read contract_templates. Two proven:
--      staff_assignable_templates() filters on (active AND body IS NOT NULL AND no section
--      defs) — every email row passes, so staff would be offered "Invitation" as a document
--      to assign a contact for signature. template_editor_list() has NO content filter at
--      all — every email would appear in the CONTRACT wording editor.
--   4. RLS policy contract_templates_read_active grants SELECT to anon for every active row.
--      The staff-notification bodies (request-received, support-received, the ops digests)
--      would become world-readable.
--   5. It has one body column. An email needs subject + body + a from-address rule at
--      minimum — columns that would be NULL on all 22 contract rows.
-- A sibling table is the pattern TEMPLATE-ENGINES-DELTA already blesses ("One archive page
-- reads both tables. One surface, two sources"). What it FORBIDS is a unified table that
-- absorbs the others; this absorbs nothing and moves nothing.
--
-- Lifecycle columns mirror contract_templates exactly (body / draft_body / version / active)
-- so TASK-TEXTEDIT's editor extends to emails instead of growing a second publish system.
-- Deliberately NOT reused: record_template_version_bump. That trigger writes
-- template_version_events to drive the re-sign prompt for people who signed an older
-- version. Nobody signs an email.

CREATE TABLE IF NOT EXISTS public.email_templates (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Stable machine key. The sender names this; it is never derived from the title.
  email_key         text NOT NULL UNIQUE,
  -- Owner-facing name and one-line explanation of when this email goes out.
  title             text NOT NULL,
  description       text,
  -- Grouping for the Templates > Emails list.
  category          text NOT NULL DEFAULT 'GENERAL',
  -- Published content.
  subject           text NOT NULL DEFAULT '',
  body              text NOT NULL DEFAULT '',
  -- Unpublished edits. NULL = no pending change (same convention as
  -- contract_templates.draft_body).
  draft_subject     text,
  draft_body        text,
  -- Which From address the transport uses. Preserves a real difference between the
  -- senders today; it is NOT free-text, so no one can point an email at an arbitrary
  -- address from the editor.
  --   tenant             identity.fromEmail (the tenant's configured address)
  --   invite             INVITE_FROM_EMAIL env override, else identity.fromEmail
  --   tenant_or_recipient identity.fromEmail, falling back to the destination inbox
  from_address_rule text NOT NULL DEFAULT 'tenant',
  --   none               no Reply-To header
  --   submitter          reply goes to the person who submitted the form
  reply_to_rule     text NOT NULL DEFAULT 'none',
  -- Documentation only: who this reaches, in words. Recipient SELECTION stays in
  -- code — it is database control flow (party sets, guardian redirection for minors,
  -- idempotency, rate limits), not prose, and moving it would move the safety
  -- properties too.
  recipient_note    text,
  -- true = the person asked for it or it completes something they started.
  -- false = we are telling them something (digests, sweeps, ops alerts).
  transactional     boolean NOT NULL DEFAULT true,
  version           integer NOT NULL DEFAULT 1,
  active            boolean NOT NULL DEFAULT true,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  deleted_at        timestamptz,
  deleted_by        uuid REFERENCES public.profiles(user_id) ON DELETE SET NULL,
  CONSTRAINT email_templates_from_rule_check
    CHECK (from_address_rule IN ('tenant', 'invite', 'tenant_or_recipient')),
  CONSTRAINT email_templates_reply_rule_check
    CHECK (reply_to_rule IN ('none', 'submitter'))
);

CREATE INDEX IF NOT EXISTS email_templates_active_idx
  ON public.email_templates (active) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS email_templates_category_idx
  ON public.email_templates (category);

DROP TRIGGER IF EXISTS email_templates_set_updated_at ON public.email_templates;
CREATE TRIGGER email_templates_set_updated_at
  BEFORE UPDATE ON public.email_templates
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS audit_email_templates ON public.email_templates;
CREATE TRIGGER audit_email_templates
  AFTER INSERT OR UPDATE OR DELETE ON public.email_templates
  FOR EACH ROW EXECUTE FUNCTION public.audit_row_change();

ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;

-- Staff read, admin write. NOT anon-readable: several of these bodies are internal
-- ops correspondence, which is the fourth reason they do not belong in
-- contract_templates. The senders run on the service-role client and bypass RLS.
DROP POLICY IF EXISTS email_templates_staff_read ON public.email_templates;
CREATE POLICY email_templates_staff_read ON public.email_templates
  FOR SELECT TO authenticated
  USING (coalesce(public.has_staff_access(), false));

DROP POLICY IF EXISTS email_templates_admin_write ON public.email_templates;
CREATE POLICY email_templates_admin_write ON public.email_templates
  FOR ALL TO authenticated
  USING (coalesce(public.is_admin(), false))
  WITH CHECK (coalesce(public.is_admin(), false));

REVOKE ALL ON public.email_templates FROM anon;
GRANT SELECT ON public.email_templates TO authenticated;
GRANT ALL ON public.email_templates TO service_role;

-- ── the editor's data layer ────────────────────────────────────────────────
-- Same four verbs, same semantics, same return shapes as TASK-TEXTEDIT's
-- template_editor_* family, so the Emails section of the Templates surface is a
-- second list over the same interaction, not a second editor.
-- TASK-TEXTEDIT owns the UI; EMAILEXTRACT owns these rows.

CREATE OR REPLACE FUNCTION public.email_template_list()
RETURNS TABLE(
  email_key text, title text, description text, category text,
  subject text, version integer, active boolean,
  transactional boolean, recipient_note text,
  from_address_rule text, reply_to_rule text,
  has_unpublished boolean, updated_at timestamptz
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT e.email_key, e.title, e.description, e.category,
         e.subject, e.version, e.active,
         e.transactional, e.recipient_note,
         e.from_address_rule, e.reply_to_rule,
         (e.draft_body IS NOT NULL OR e.draft_subject IS NOT NULL) AS has_unpublished,
         e.updated_at
    FROM email_templates e
   WHERE e.deleted_at IS NULL
     AND coalesce(is_admin(), false)
   ORDER BY e.category, e.title;
$$;

/* The editable content of one email: what is live, and what is drafted over it. */
CREATE OR REPLACE FUNCTION public.email_template_get(p_email_key text)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE v jsonb;
BEGIN
  IF NOT coalesce(is_admin(), false) THEN
    RAISE EXCEPTION 'Email template editing is admin-only';
  END IF;
  SELECT to_jsonb(x) INTO v FROM (
    SELECT e.email_key, e.title, e.description, e.category,
           e.subject, e.body, e.draft_subject, e.draft_body,
           e.version, e.active, e.transactional, e.recipient_note,
           e.from_address_rule, e.reply_to_rule, e.updated_at
      FROM email_templates e
     WHERE e.email_key = p_email_key AND e.deleted_at IS NULL
  ) x;
  IF v IS NULL THEN RAISE EXCEPTION 'Email template % not found', p_email_key; END IF;
  RETURN v;
END;
$$;

/* Save a draft. Passing content identical to what is published CLEARS the draft
   rather than storing a no-op change — same rule as template_editor_save_flat_draft,
   so "has unpublished changes" never lies. */
CREATE OR REPLACE FUNCTION public.email_template_save_draft(
  p_email_key text, p_subject text, p_body text
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_subject text;
  v_body    text;
  v_ds      text;
  v_db      text;
BEGIN
  IF NOT coalesce(is_admin(), false) THEN
    RAISE EXCEPTION 'Email template editing is admin-only';
  END IF;

  SELECT e.subject, e.body INTO v_subject, v_body
    FROM email_templates e WHERE e.email_key = p_email_key AND e.deleted_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'Email template % not found', p_email_key; END IF;

  v_ds := CASE WHEN p_subject IS NULL OR p_subject = v_subject THEN NULL ELSE p_subject END;
  v_db := CASE WHEN p_body    IS NULL OR p_body    = v_body    THEN NULL ELSE p_body    END;

  UPDATE email_templates
     SET draft_subject = v_ds, draft_body = v_db
   WHERE email_key = p_email_key AND deleted_at IS NULL;

  RETURN jsonb_build_object(
    'email_key', p_email_key,
    'has_unpublished', (v_ds IS NOT NULL OR v_db IS NOT NULL));
END;
$$;

CREATE OR REPLACE FUNCTION public.email_template_discard_draft(p_email_key text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE v_n integer;
BEGIN
  IF NOT coalesce(is_admin(), false) THEN
    RAISE EXCEPTION 'Email template editing is admin-only';
  END IF;
  UPDATE email_templates SET draft_subject = NULL, draft_body = NULL
   WHERE email_key = p_email_key AND deleted_at IS NULL
     AND (draft_subject IS NOT NULL OR draft_body IS NOT NULL);
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN jsonb_build_object('discarded', v_n > 0);
END;
$$;

/* Publish: draft -> live, version +1. The next send picks it up on its next read;
   nothing is cached and no deploy is involved. That is the whole point of the task. */
CREATE OR REPLACE FUNCTION public.email_template_publish(p_email_key text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE v_version integer;
BEGIN
  IF NOT coalesce(is_admin(), false) THEN
    RAISE EXCEPTION 'Email template editing is admin-only';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM email_templates
     WHERE email_key = p_email_key AND deleted_at IS NULL
       AND (draft_subject IS NOT NULL OR draft_body IS NOT NULL)
  ) THEN
    RAISE EXCEPTION 'Nothing to publish for % — no draft changes exist.', p_email_key;
  END IF;

  UPDATE email_templates
     SET subject       = coalesce(draft_subject, subject),
         body          = coalesce(draft_body, body),
         draft_subject = NULL,
         draft_body    = NULL,
         version       = version + 1
   WHERE email_key = p_email_key AND deleted_at IS NULL
  RETURNING version INTO v_version;

  RETURN jsonb_build_object('email_key', p_email_key, 'new_version', v_version);
END;
$$;

/* Turn an email off / back on. Retirement is a boolean, never a delete — the
   standing rule everywhere else in this codebase. */
CREATE OR REPLACE FUNCTION public.email_template_set_active(p_email_key text, p_active boolean)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  IF NOT coalesce(is_admin(), false) THEN
    RAISE EXCEPTION 'Email template editing is admin-only';
  END IF;
  UPDATE email_templates SET active = p_active
   WHERE email_key = p_email_key AND deleted_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'Email template % not found', p_email_key; END IF;
  RETURN jsonb_build_object('email_key', p_email_key, 'active', p_active);
END;
$$;

REVOKE ALL ON FUNCTION public.email_template_list() FROM public, anon;
REVOKE ALL ON FUNCTION public.email_template_get(text) FROM public, anon;
REVOKE ALL ON FUNCTION public.email_template_save_draft(text, text, text) FROM public, anon;
REVOKE ALL ON FUNCTION public.email_template_discard_draft(text) FROM public, anon;
REVOKE ALL ON FUNCTION public.email_template_publish(text) FROM public, anon;
REVOKE ALL ON FUNCTION public.email_template_set_active(text, boolean) FROM public, anon;

GRANT EXECUTE ON FUNCTION public.email_template_list() TO authenticated;
GRANT EXECUTE ON FUNCTION public.email_template_get(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.email_template_save_draft(text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.email_template_discard_draft(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.email_template_publish(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.email_template_set_active(text, boolean) TO authenticated;

