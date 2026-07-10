-- SLICE 5 — versioned content/policy store. A slug-keyed store for policy + content
-- blocks (welcome copy, orientation, policy blurbs) that are DISTINCT from the legal
-- contract engine (contract_templates). Each block is versioned; editing publishes a
-- new version (old versions kept). Bodies carry {{NS.FIELD}} tokens merged at read
-- time against a caller-supplied context. When a block is a POLICY, a member's
-- acknowledgment is logged against the exact version they saw.
--
--   content_blocks           — the slug-keyed block (current pointer + kind)
--   content_block_versions   — every published version of a block's body
--   content_acknowledgments  — version-logged member acknowledgments (policies)

CREATE TABLE IF NOT EXISTS public.content_blocks (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id       uuid NOT NULL REFERENCES organizations(id),
  slug         text NOT NULL,
  kind         text NOT NULL DEFAULT 'content' CHECK (kind IN ('content', 'policy')),
  title        text NOT NULL,
  current_version int NOT NULL DEFAULT 1,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, slug)
);

CREATE TABLE IF NOT EXISTS public.content_block_versions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  block_id    uuid NOT NULL REFERENCES content_blocks(id) ON DELETE CASCADE,
  version     int NOT NULL,
  body        text NOT NULL,          -- may contain {{NS.FIELD}} tokens
  edited_by   uuid REFERENCES profiles(user_id),
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (block_id, version)
);

CREATE TABLE IF NOT EXISTS public.content_acknowledgments (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  block_id    uuid NOT NULL REFERENCES content_blocks(id),
  version     int NOT NULL,           -- the exact version acknowledged
  user_id     uuid NOT NULL REFERENCES profiles(user_id),
  acknowledged_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (block_id, version, user_id)
);

ALTER TABLE public.content_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_block_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_acknowledgments ENABLE ROW LEVEL SECURITY;

-- blocks + versions: everyone in-org reads; admins manage
DROP POLICY IF EXISTS content_blocks_read ON public.content_blocks;
CREATE POLICY content_blocks_read ON public.content_blocks
  FOR SELECT USING (org_id = current_org());
DROP POLICY IF EXISTS content_blocks_admin ON public.content_blocks;
CREATE POLICY content_blocks_admin ON public.content_blocks
  FOR ALL USING (org_id = current_org() AND is_admin())
  WITH CHECK (org_id = current_org() AND is_admin());

DROP POLICY IF EXISTS content_versions_read ON public.content_block_versions;
CREATE POLICY content_versions_read ON public.content_block_versions
  FOR SELECT USING (EXISTS (SELECT 1 FROM content_blocks b WHERE b.id = block_id AND b.org_id = current_org()));
DROP POLICY IF EXISTS content_versions_admin ON public.content_block_versions;
CREATE POLICY content_versions_admin ON public.content_block_versions
  FOR ALL USING (EXISTS (SELECT 1 FROM content_blocks b WHERE b.id = block_id AND b.org_id = current_org() AND is_admin()))
  WITH CHECK (EXISTS (SELECT 1 FROM content_blocks b WHERE b.id = block_id AND b.org_id = current_org() AND is_admin()));

-- acknowledgments: a member reads/writes their own; admins read all in-org
DROP POLICY IF EXISTS content_ack_own ON public.content_acknowledgments;
CREATE POLICY content_ack_own ON public.content_acknowledgments
  FOR SELECT USING (user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM content_blocks b WHERE b.id = block_id AND b.org_id = current_org() AND is_admin()));
DROP POLICY IF EXISTS content_ack_insert ON public.content_acknowledgments;
CREATE POLICY content_ack_insert ON public.content_acknowledgments
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- ── upsert a block: creates it (version 1) or publishes a new version ──
CREATE OR REPLACE FUNCTION public.upsert_content_block(
  p_slug  text,
  p_title text,
  p_body  text,
  p_kind  text DEFAULT 'content'
)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_org   uuid := current_org();
  v_block content_blocks%ROWTYPE;
  v_next  int;
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'admin access required';
  END IF;
  IF p_kind NOT IN ('content', 'policy') THEN
    RAISE EXCEPTION 'kind must be content or policy';
  END IF;

  SELECT * INTO v_block FROM content_blocks WHERE org_id = v_org AND slug = p_slug;

  IF NOT FOUND THEN
    INSERT INTO content_blocks (org_id, slug, kind, title, current_version)
    VALUES (v_org, p_slug, p_kind, p_title, 1)
    RETURNING * INTO v_block;
    v_next := 1;
  ELSE
    v_next := v_block.current_version + 1;
    UPDATE content_blocks
       SET current_version = v_next, title = p_title, kind = p_kind, updated_at = now()
     WHERE id = v_block.id;
  END IF;

  INSERT INTO content_block_versions (block_id, version, body, edited_by)
  VALUES (v_block.id, v_next, p_body, auth.uid());

  RETURN v_next;
END;
$$;

-- ── read a block by slug, MERGED. p_context is a jsonb map of "NS.FIELD" → value;
--    every {{NS.FIELD}} token in the current version's body is replaced. Unmatched
--    tokens are left as-is (visible, so a missing merge is obvious, not silent). ──
CREATE OR REPLACE FUNCTION public.get_content_block(
  p_slug    text,
  p_context jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_org   uuid := current_org();
  v_block content_blocks%ROWTYPE;
  v_body  text;
  v_key   text;
  v_val   text;
BEGIN
  SELECT * INTO v_block FROM content_blocks WHERE org_id = v_org AND slug = p_slug;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  SELECT body INTO v_body FROM content_block_versions
   WHERE block_id = v_block.id AND version = v_block.current_version;

  -- token merge: replace each {{NS.FIELD}} for keys present in the context
  FOR v_key, v_val IN SELECT key, value FROM jsonb_each_text(p_context) LOOP
    v_body := replace(v_body, '{{' || v_key || '}}', COALESCE(v_val, ''));
  END LOOP;

  RETURN jsonb_build_object(
    'slug', v_block.slug,
    'kind', v_block.kind,
    'title', v_block.title,
    'version', v_block.current_version,
    'body', v_body
  );
END;
$$;

-- ── acknowledge a policy block at its current version (idempotent per version) ──
CREATE OR REPLACE FUNCTION public.acknowledge_content_block(p_slug text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_org   uuid := current_org();
  v_block content_blocks%ROWTYPE;
BEGIN
  SELECT * INTO v_block FROM content_blocks WHERE org_id = v_org AND slug = p_slug;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'block not found';
  END IF;

  INSERT INTO content_acknowledgments (block_id, version, user_id)
  VALUES (v_block.id, v_block.current_version, auth.uid())
  ON CONFLICT (block_id, version, user_id) DO NOTHING;
END;
$$;

GRANT EXECUTE ON FUNCTION public.upsert_content_block(text, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_content_block(text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.acknowledge_content_block(text) TO authenticated;
