-- TASK-VERSIONSPINE §2/§3 — the contract template joins the spine, and publishing
-- stops discarding what it replaces.
--
-- Before this: template_editor_publish overwrote contract_templates.body from
-- draft_body and contract_clause_defs.body from each clause's draft_body, THEN
-- bumped contract_templates.version. The previous wording was gone at the moment
-- the number went up. template_version_events recorded that a bump happened and
-- nothing about what it replaced.
--
-- After this: publish writes the new content and then calls the save path, which
-- retains the published state as version N in full — body AND composition — with
-- the previous version already retained from the backfill or from the previous
-- publish. Nothing else in the flow changes: the same lockstep key set, the same
-- draft-conflict refusal, the same D10 guard on HORSE_LEASE_STANDARD, and
-- record_template_version_bump still fires on the version UPDATE, so the re-sign
-- decision queue (pending_version_decisions) is untouched.
--
-- ⚠️ THE FREEZE RULE IS UNAFFECTED, AND MEASURED. A live surface is derived; a
-- signed document is frozen. regenerate_contract_document compares
-- documents.signed_template_version against contract_templates.version and, when
-- they differ on an executed document, returns the STORED merged_body without
-- writing. Bumping the version therefore protects executed paper rather than
-- threatening it. Verified on production 2026-08-26: all 67 executed documents
-- carry a non-null signed_template_version, so none of them falls through the
-- guard.

-- ── SAVE — mints v(max+1) and retains the state whole ──────────────────────
-- p_title / p_body NULL means "keep what the live row already has", so a caller
-- who changed only clauses does not have to restate the flat body.
create or replace function save_contract_template_version(
  p_template_key   text,
  p_title          text default null,
  p_body           text default null,
  p_parent_version integer default null
) returns integer
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_ct     contract_templates%rowtype;
  v_next   integer;
  v_parent integer := p_parent_version;
  v_title  text;
  v_body   text;
begin
  if not is_admin() then raise exception 'admin access required'; end if;

  select * into v_ct from contract_templates
   where template_key = p_template_key for update;
  if not found then raise exception 'unknown template: %', p_template_key; end if;

  v_title := coalesce(nullif(btrim(coalesce(p_title,'')),''), v_ct.title);
  v_body  := coalesce(p_body, v_ct.body);

  -- The outgoing live state must be IN the list before we add to it. The
  -- 20260826T1910 backfill covers every template that existed then; this covers
  -- one created since.
  insert into contract_template_versions
    (template_key, version, title, body, composition, parent_version, edited_by, created_at)
  values (v_ct.template_key, v_ct.version, v_ct.title, v_ct.body,
          capture_contract_template_composition(v_ct.template_key), null, null, v_ct.updated_at)
  on conflict (template_key, version) do nothing;

  select greatest(v_ct.version, coalesce(max(ctv.version), 0)) + 1
    into v_next
    from contract_template_versions ctv where ctv.template_key = p_template_key;

  if v_parent is not null then
    if v_parent = v_next - 1 then
      v_parent := null;                       -- the ordinary case says itself
    elsif v_parent >= v_next then
      raise exception 'a version cannot come from version % — that is not earlier than %', v_parent, v_next;
    elsif not exists (select 1 from contract_template_versions ctv
                       where ctv.template_key = p_template_key and ctv.version = v_parent) then
      raise exception 'template % has no version % to edit from', p_template_key, v_parent;
    end if;
  end if;

  update contract_templates
     set title = v_title, body = v_body, version = v_next, updated_at = now()
   where template_key = p_template_key;

  -- Captured AFTER the caller has written its content changes, which is why the
  -- publish path calls this last.
  insert into contract_template_versions
    (template_key, version, title, body, composition, parent_version, edited_by)
  values (p_template_key, v_next, v_title, v_body,
          capture_contract_template_composition(p_template_key), v_parent, auth.uid());

  return v_next;
end;
$$;

comment on function save_contract_template_version(text,text,text,integer) is
  'TASK-VERSIONSPINE: the ONLY way a contract template version is written. Mints v(max+1) and retains body AND composition (sections/clauses/fields) in full.';

create or replace function contract_template_version_list(p_template_key text)
returns table (
  version        integer,
  parent_version integer,
  is_current     boolean,
  title          text,
  clause_count   integer,
  edited_by      uuid,
  edited_by_name text,
  created_at     timestamptz
)
language sql
stable
security definer
set search_path to 'public'
as $$
  select v.version, v.parent_version, v.version = ct.version as is_current, v.title,
         coalesce(jsonb_array_length(v.composition->'clauses'), 0)::integer as clause_count,
         v.edited_by,
         coalesce(nullif(btrim(coalesce(p.display_name, '')), ''),
                  nullif(btrim(coalesce(p.first_name,'') || ' ' || coalesce(p.last_name,'')), ''),
                  p.email) as edited_by_name,
         v.created_at
    from contract_template_versions v
    join contract_templates ct on ct.template_key = v.template_key
    left join profiles p on p.user_id = v.edited_by
   where v.template_key = p_template_key
     and has_staff_access()
   order by v.version desc
$$;

create or replace function contract_template_version_at(p_template_key text, p_version integer)
returns table (
  version        integer,
  parent_version integer,
  title          text,
  body           text,
  composition    jsonb,
  is_current     boolean,
  created_at     timestamptz
)
language sql
stable
security definer
set search_path to 'public'
as $$
  select v.version, v.parent_version, v.title, v.body, v.composition,
         v.version = ct.version as is_current, v.created_at
    from contract_template_versions v
    join contract_templates ct on ct.template_key = v.template_key
   where v.template_key = p_template_key and v.version = p_version
     and has_staff_access()
$$;

-- ── Writing a retained composition back onto the live authoring tables ──────
--
-- ⚠️ WORDING IS RESTORED; STRUCTURE IS NOT ADDED OR REMOVED. If the retained
-- version has a different SET of sections, clauses or fields than the live
-- template, this REFUSES rather than restoring half of it. A half-restore that
-- silently leaves a clause behind is worse than a refusal that names it, and
-- adding or removing clauses is the authoring engine's job — TASK-SURFACEEDITOR
-- is the thread that gets to lift this.
--
-- draft_body is captured in the snapshot but deliberately NOT restored: an old
-- unpublished draft is not part of the version that was published.
create or replace function _restore_contract_template_composition(
  p_template_key text, p_composition jsonb
) returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_unknown text;
  v_diff    text;
begin
  if p_composition is null then return; end if;

  -- Loud, not silent: if the capture ever grows a column this restore does not
  -- write, say so instead of quietly leaving it behind.
  select string_agg(distinct k, ', ') into v_unknown from (
    select k from (
      select jsonb_object_keys(c) k from jsonb_array_elements(p_composition->'clauses') c
    ) ck where k not in ('template_key','section_key','clause_key','heading','body','clause_type',
                         'sort_order','is_optional','cut_name','conditional_on','guidance',
                         'render_as_subitem','draft_body')
    union all
    select k from (
      select jsonb_object_keys(s) k from jsonb_array_elements(p_composition->'sections') s
    ) sk where k not in ('template_key','section_key','heading','sort_order','is_optional',
                         'cut_name','guidance')
    union all
    select k from (
      select jsonb_object_keys(f) k from jsonb_array_elements(p_composition->'fields') f
    ) fk where k not in ('template_key','field_key','parent_field_key','label','section','owner_role',
                         'input_kind','value_type','options','conditional_on','guidance','required',
                         'is_optional','responsibility','sort_order','format_type','clause_key',
                         'responsibility_kind','closed','default_value')
  ) x;
  if v_unknown is not null then
    raise exception 'this retained version carries composition columns this restore does not write (%). Widen _restore_contract_template_composition before restoring.', v_unknown;
  end if;

  -- Structure must match exactly, in both directions.
  with retained_sections as (select s->>'section_key' k from jsonb_array_elements(p_composition->'sections') s),
       live_sections     as (select section_key k from contract_section_defs where template_key = p_template_key),
       retained_clauses  as (select c->>'clause_key' k from jsonb_array_elements(p_composition->'clauses') c),
       live_clauses      as (select clause_key k from contract_clause_defs where template_key = p_template_key),
       retained_fields   as (select f->>'field_key' k from jsonb_array_elements(p_composition->'fields') f),
       live_fields       as (select field_key k from contract_field_defs where template_key = p_template_key),
       diffs as (
         select 'sections only in the retained version' as lbl, k from (select k from retained_sections except select k from live_sections) a
         union all
         select 'sections only on the live template', k from (select k from live_sections except select k from retained_sections) b
         union all
         select 'clauses only in the retained version', k from (select k from retained_clauses except select k from live_clauses) c
         union all
         select 'clauses only on the live template', k from (select k from live_clauses except select k from retained_clauses) d
         union all
         select 'fields only in the retained version', k from (select k from retained_fields except select k from live_fields) e
         union all
         select 'fields only on the live template', k from (select k from live_fields except select k from retained_fields) f
       )
  select string_agg(lbl || ': ' || ks, '; ')
    into v_diff
    from (select lbl, string_agg(k, ', ' order by k) ks from diffs group by lbl) z;
  if v_diff is not null then
    raise exception 'this version cannot be restored because the template''s structure has changed since — %. Its wording is still retained and readable; restoring structure belongs to the authoring editor.', v_diff;
  end if;

  update contract_section_defs t
     set heading = s.heading, sort_order = s.sort_order, is_optional = s.is_optional,
         cut_name = s.cut_name, guidance = s.guidance
    from jsonb_to_recordset(p_composition->'sections')
      as s(section_key text, heading text, sort_order integer, is_optional boolean,
           cut_name text, guidance text)
   where t.template_key = p_template_key and t.section_key = s.section_key;

  update contract_clause_defs t
     set section_key = c.section_key, heading = c.heading, body = c.body,
         clause_type = c.clause_type, sort_order = c.sort_order, is_optional = c.is_optional,
         cut_name = c.cut_name, conditional_on = c.conditional_on, guidance = c.guidance,
         render_as_subitem = c.render_as_subitem
    from jsonb_to_recordset(p_composition->'clauses')
      as c(clause_key text, section_key text, heading text, body text, clause_type text,
           sort_order integer, is_optional boolean, cut_name text, conditional_on jsonb,
           guidance text, render_as_subitem boolean)
   where t.template_key = p_template_key and t.clause_key = c.clause_key;

  update contract_field_defs t
     set parent_field_key = f.parent_field_key, label = f.label, section = f.section,
         owner_role = f.owner_role, input_kind = f.input_kind, value_type = f.value_type,
         options = f.options, conditional_on = f.conditional_on, guidance = f.guidance,
         required = f.required, is_optional = f.is_optional, responsibility = f.responsibility,
         sort_order = f.sort_order, format_type = f.format_type, clause_key = f.clause_key,
         responsibility_kind = f.responsibility_kind, closed = f.closed,
         default_value = f.default_value
    from jsonb_to_recordset(p_composition->'fields')
      as f(field_key text, parent_field_key text, label text, section text, owner_role text,
           input_kind text, value_type text, options jsonb, conditional_on jsonb, guidance text,
           required boolean, is_optional boolean, responsibility jsonb, sort_order integer,
           format_type text, clause_key text, responsibility_kind text, closed boolean,
           default_value text)
   where t.template_key = p_template_key and t.field_key = f.field_key;
end;
$$;

-- ── RESTORE — which is SAVE with no edits ──────────────────────────────────
create or replace function restore_contract_template_version(
  p_template_key text, p_version integer
) returns integer
language plpgsql
security definer
set search_path to 'public'
as $$
declare v_row contract_template_versions%rowtype;
begin
  if not is_admin() then raise exception 'admin access required'; end if;
  if p_template_key = 'HORSE_LEASE_STANDARD' then
    raise exception 'HORSE_LEASE_STANDARD is archived (D10) and no longer receives content updates.';
  end if;
  select * into v_row from contract_template_versions
   where template_key = p_template_key and version = p_version;
  if not found then raise exception 'template % has no version %', p_template_key, p_version; end if;

  perform _restore_contract_template_composition(p_template_key, v_row.composition);
  return save_contract_template_version(p_template_key, v_row.title, v_row.body, p_version);
end;
$$;

comment on function restore_contract_template_version(text,integer) is
  'TASK-VERSIONSPINE: mints a NEW version carrying an old version''s wording, stamped "from v<n>". Never moves the pointer backwards. Refuses when the template''s structure has changed since that version.';

-- ── Publish now retains what it replaces ───────────────────────────────────
create or replace function template_editor_publish(p_template_key text)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_keys      text[];
  v_conflicts text;
  v_clauses   integer := 0;
  v_flat      integer := 0;
  v_versions  jsonb := '{}'::jsonb;
  v_key       text;
  v_new       integer;
begin
  if not is_admin() then
    raise exception 'Template editing is admin-only';
  end if;
  if p_template_key = 'HORSE_LEASE_STANDARD' then
    raise exception 'HORSE_LEASE_STANDARD is archived (D10) and no longer receives content updates.';
  end if;

  v_keys := template_editor_lockstep_keys(p_template_key);

  select string_agg(clause_key, ', ') into v_conflicts
  from (
    select clause_key from contract_clause_defs
    where template_key = any (v_keys) and draft_body is not null
    group by clause_key having count(distinct draft_body) > 1
  ) conflicting;
  if v_conflicts is not null then
    raise exception 'Conflicting drafts across the lease set for clause(s): %. Resolve before publishing.', v_conflicts;
  end if;

  -- Clause wording: apply each drafted clause_key to every key in the set.
  update contract_clause_defs c
     set body = d.draft, draft_body = null
    from (
      select clause_key, min(draft_body) as draft
      from contract_clause_defs
      where template_key = any (v_keys) and draft_body is not null
      group by clause_key
    ) d
   where c.template_key = any (v_keys) and c.clause_key = d.clause_key;
  get diagnostics v_clauses = row_count;

  -- Flat body.
  update contract_templates
     set body = draft_body, draft_body = null
   where template_key = any (v_keys) and draft_body is not null and deleted_at is null;
  get diagnostics v_flat = row_count;

  if v_clauses = 0 and v_flat = 0 then
    raise exception 'Nothing to publish for % — no draft changes exist.', p_template_key;
  end if;

  -- Version +1 on every key published, THROUGH THE SAVE PATH, so the published
  -- state is retained instead of only counted. The AFTER UPDATE OF version
  -- trigger still records the template_version_events row; documents are never
  -- touched.
  foreach v_key in array v_keys loop
    if exists (select 1 from contract_templates
                where template_key = v_key and deleted_at is null) then
      v_new := save_contract_template_version(v_key, null, null, null);
      v_versions := v_versions || jsonb_build_object(v_key, v_new);
    end if;
  end loop;

  return jsonb_build_object('published_keys', to_jsonb(v_keys),
                            'clause_rows_published', v_clauses,
                            'flat_bodies_published', v_flat,
                            'new_versions', v_versions);
end;
$$;
