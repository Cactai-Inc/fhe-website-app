-- TASK-VERSIONSPINE §3/§4 — the form version spine, and it is the only way to write one.
--
-- Owner's model: save mints v(x+1); the latest version is the live one; every
-- earlier version is a "non functional fully retained copy"; opening an older
-- version and saving on top of it mints v(max+1) STAMPED WITH WHERE IT CAME FROM.
--
-- ⚠️ WHY THE EXISTING FORM VERSIONING NEEDED REPLACING, NOT EXTENDING.
-- `snapshot_form_definition` implemented the OPPOSITE storage rule to
-- `content_block_versions`: it copied the OUTGOING row into the history and left
-- the incoming one only on the live table, so form_definition_versions held every
-- version EXCEPT the current one. The owner's list must show the current version
-- too ("save mints v2, the list shows v1 and v2"), and content_blocks already
-- stored it that way. The two tables agreed on their COLUMNS and disagreed on
-- their MEANING. This migration settles it on the content_blocks rule — the
-- history holds every version, including the live one — and retires
-- snapshot_form_definition so there is one write path, not two (D18).
--
-- Measured before this ran: max(version) = 1 across all 28 forms and all 28
-- history rows were a same-second backfill with edited_by NULL. No v2 had ever
-- been minted, so no behaviour depended on the old rule.

-- ── SAVE — mints v(max+1) and stamps the parent ─────────────────────────────
create or replace function save_form_definition_version(
  p_form_key       text,
  p_title          text,
  p_audience       text,
  p_purpose        text,
  p_schema         jsonb,
  p_parent_version integer default null
) returns integer
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_fd     form_definitions%rowtype;
  v_next   integer;
  v_parent integer := p_parent_version;
begin
  if not is_admin() then raise exception 'admin only'; end if;
  if nullif(btrim(coalesce(p_title,'')),'') is null then
    raise exception 'a form version needs a title';
  end if;
  if p_schema is null or jsonb_typeof(p_schema->'sections') <> 'array' then
    raise exception 'a form version needs a schema with a sections array';
  end if;

  -- FOR UPDATE serialises minting per form: two saves cannot claim the same number.
  select * into v_fd from form_definitions where form_key = p_form_key for update;
  if not found then raise exception 'unknown form: %', p_form_key; end if;

  -- The outgoing live state must be IN the list before we add to it. Legacy rows
  -- predate this spine, so this is a no-op once a form has been saved through it.
  -- edited_by stays NULL: nobody recorded who authored the state we inherited.
  insert into form_definition_versions (form_key, version, title, audience, purpose, schema, edited_by)
  values (v_fd.form_key, v_fd.version, v_fd.title, v_fd.audience, v_fd.purpose, v_fd.schema, null)
  on conflict (form_key, version) do nothing;

  -- greatest(): the number only ever goes up, even if the live pointer and the
  -- history ever disagreed. Nothing here can produce a number already used.
  select greatest(v_fd.version, coalesce(max(fdv.version), 0)) + 1
    into v_next
    from form_definition_versions fdv where fdv.form_key = p_form_key;

  if v_parent is not null then
    if v_parent = v_next - 1 then
      v_parent := null;                       -- the ordinary case says itself
    elsif v_parent >= v_next then
      raise exception 'a version cannot come from version % — that is not earlier than %', v_parent, v_next;
    elsif not exists (select 1 from form_definition_versions fdv
                       where fdv.form_key = p_form_key and fdv.version = v_parent) then
      raise exception 'form % has no version % to edit from', p_form_key, v_parent;
    end if;
  end if;

  insert into form_definition_versions
    (form_key, version, title, audience, purpose, schema, parent_version, edited_by)
  values (p_form_key, v_next, p_title, p_audience, p_purpose, p_schema, v_parent, auth.uid());

  update form_definitions
     set title = p_title, audience = p_audience, purpose = p_purpose,
         schema = p_schema, version = v_next, updated_at = now()
   where form_key = p_form_key;

  return v_next;
end;
$$;

comment on function save_form_definition_version(text,text,text,text,jsonb,integer) is
  'TASK-VERSIONSPINE: the ONLY way a form version is written. Mints v(max+1), retains it in full, and points the live form at it. p_parent_version records which version was edited when it was not the latest.';

-- ── THE LIST — version, parent, who, when ──────────────────────────────────
create or replace function form_version_list(p_form_key text)
returns table (
  version        integer,
  parent_version integer,
  is_current     boolean,
  edited_by      uuid,
  edited_by_name text,
  created_at     timestamptz
)
language sql
stable
security definer
set search_path to 'public'
as $$
  select v.version,
         v.parent_version,
         v.version = fd.version as is_current,
         v.edited_by,
         coalesce(nullif(btrim(coalesce(p.display_name, '')), ''),
                  nullif(btrim(coalesce(p.first_name,'') || ' ' || coalesce(p.last_name,'')), ''),
                  p.email) as edited_by_name,
         v.created_at
    from form_definition_versions v
    join form_definitions fd on fd.form_key = v.form_key
    left join profiles p on p.user_id = v.edited_by
   where v.form_key = p_form_key
     and has_staff_access()
   order by v.version desc
$$;

comment on function form_version_list(text) is
  'TASK-VERSIONSPINE: a form''s version list — v8 · from v4 · who · when. Named _list rather than form_definition_versions() so the function is never confused with the table it reads.';

-- ── OPEN ONE — the retained copy, whole ────────────────────────────────────
create or replace function form_version_at(p_form_key text, p_version integer)
returns table (
  version        integer,
  parent_version integer,
  title          text,
  audience       text,
  purpose        text,
  schema         jsonb,
  is_current     boolean,
  created_at     timestamptz
)
language sql
stable
security definer
set search_path to 'public'
as $$
  select v.version, v.parent_version, v.title, v.audience, v.purpose, v.schema,
         v.version = fd.version as is_current, v.created_at
    from form_definition_versions v
    join form_definitions fd on fd.form_key = v.form_key
   where v.form_key = p_form_key and v.version = p_version
     and has_staff_access()
$$;

comment on function form_version_at(text,integer) is
  'TASK-VERSIONSPINE: one retained form version, in full, for opening it in the editor.';

-- ── RESTORE — which is SAVE with no edits ──────────────────────────────────
-- 🔒 Owner, 2026-08-26: "this is the right move." Restoring v4 mints v9-from-v4.
-- It does NOT move a pointer backwards. Restore and supersede are the same act
-- with a different amount of editing, so this is a call INTO the save path and
-- not a second implementation of it.
create or replace function restore_form_definition_version(p_form_key text, p_version integer)
returns integer
language plpgsql
security definer
set search_path to 'public'
as $$
declare v_row form_definition_versions%rowtype;
begin
  if not is_admin() then raise exception 'admin only'; end if;
  select * into v_row from form_definition_versions
   where form_key = p_form_key and version = p_version;
  if not found then raise exception 'form % has no version %', p_form_key, p_version; end if;

  return save_form_definition_version(
    p_form_key, v_row.title, v_row.audience, v_row.purpose, v_row.schema, p_version);
end;
$$;

comment on function restore_form_definition_version(text,integer) is
  'TASK-VERSIONSPINE: mints a NEW version carrying an old version''s content, stamped "from v<n>". Never moves the pointer backwards, never removes a row.';

-- ── The five mutators now go through the save path, and can edit FROM a version ─
--
-- ⚠️ CREATE OR REPLACE with a new defaulted argument OVERLOADS rather than
-- replaces — this repo has been bitten three times. Every old signature is
-- dropped explicitly below.
--
-- p_from_version is what makes "open v1, change a field, save → v3 · from v1"
-- one act rather than two: the mutation is applied to THAT version's schema, not
-- to the live one, and the resulting version records where it came from.

create or replace function _form_edit_base(p_form_key text, p_from_version integer)
returns table (title text, audience text, purpose text, schema jsonb)
language plpgsql
stable
security definer
set search_path to 'public'
as $$
begin
  if p_from_version is null then
    return query
      select fd.title, fd.audience, fd.purpose, fd.schema
        from form_definitions fd where fd.form_key = p_form_key;
  else
    return query
      select v.title, v.audience, v.purpose, v.schema
        from form_definition_versions v
       where v.form_key = p_form_key and v.version = p_from_version;
  end if;
end;
$$;

comment on function _form_edit_base(text,integer) is
  'TASK-VERSIONSPINE: the content a form edit starts from — the live form, or a named earlier version when the editor opened one.';

drop function if exists add_form_field(text, text, text, text, text, text[]);
create function add_form_field(
  p_form_key text, p_section_heading text, p_key text, p_label text,
  p_type text default 'text', p_options text[] default null,
  p_from_version integer default null
) returns integer
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_base record; v_new jsonb; v_field jsonb;
  v_key text := nullif(btrim(coalesce(p_key,'')),'');
begin
  if not is_admin() then raise exception 'admin only'; end if;
  if v_key is null or nullif(btrim(coalesce(p_label,'')),'') is null then
    raise exception 'a field needs a key and a label';
  end if;
  select * into v_base from _form_edit_base(p_form_key, p_from_version);
  if v_base.schema is null then
    raise exception 'unknown form % (version %)', p_form_key, p_from_version;
  end if;
  if exists (select 1 from jsonb_array_elements(v_base.schema->'sections') s,
                          jsonb_array_elements(s->'fields') f where f->>'key' = v_key)
  then raise exception 'form % already has a field called %', p_form_key, v_key; end if;
  if not exists (select 1 from jsonb_array_elements(v_base.schema->'sections') s
                  where s->>'heading' = p_section_heading)
  then raise exception 'no section "%" on form %', p_section_heading, p_form_key; end if;

  v_field := jsonb_build_object('key', v_key, 'label', btrim(p_label),
                                'type', coalesce(nullif(btrim(coalesce(p_type,'')),''), 'text'))
    || case when p_options is not null and array_length(p_options,1) is not null
            then jsonb_build_object('options', to_jsonb(p_options)) else '{}'::jsonb end;

  select jsonb_build_object('sections', jsonb_agg(
           case when s->>'heading' = p_section_heading
                then jsonb_set(s, '{fields}', (s->'fields') || v_field)
                else s end order by sec_i)) into v_new
    from jsonb_array_elements(v_base.schema->'sections') with ordinality as q(s, sec_i);

  return save_form_definition_version(
    p_form_key, v_base.title, v_base.audience, v_base.purpose, v_new, p_from_version);
end;
$$;

drop function if exists edit_form_field(text, text, text, text, text);
create function edit_form_field(
  p_form_key text, p_field_key text, p_label text default null,
  p_type text default null, p_new_key text default null,
  p_from_version integer default null
) returns integer
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_base record; v_new jsonb;
  v_key text := nullif(btrim(coalesce(p_new_key,'')),'');
begin
  if not is_admin() then raise exception 'admin only'; end if;
  select * into v_base from _form_edit_base(p_form_key, p_from_version);
  if v_base.schema is null then
    raise exception 'unknown form % (version %)', p_form_key, p_from_version;
  end if;
  if not exists (
    select 1 from jsonb_array_elements(v_base.schema->'sections') s,
                  jsonb_array_elements(s->'fields') f where f->>'key' = p_field_key
  ) then raise exception 'no field % on form %', p_field_key, p_form_key; end if;
  if v_key is not null and v_key <> p_field_key and exists (
    select 1 from jsonb_array_elements(v_base.schema->'sections') s,
                  jsonb_array_elements(s->'fields') f where f->>'key' = v_key
  ) then raise exception 'form % already has a field called %', p_form_key, v_key; end if;

  select jsonb_build_object('sections', jsonb_agg(sec order by sec_i)) into v_new
    from (
      select sec_i, jsonb_set(s, '{fields}', (
               select jsonb_agg(
                        case when f->>'key' <> p_field_key then f
                        else f
                             || case when nullif(btrim(coalesce(p_label,'')),'') is not null
                                     then jsonb_build_object('label', btrim(p_label)) else '{}'::jsonb end
                             || case when nullif(btrim(coalesce(p_type,'')),'') is not null
                                     then jsonb_build_object('type', btrim(p_type)) else '{}'::jsonb end
                             || case when v_key is not null
                                     then jsonb_build_object('key', v_key) else '{}'::jsonb end
                        end order by f_i)
                 from jsonb_array_elements(s->'fields') with ordinality as t(f, f_i))) as sec
        from jsonb_array_elements(v_base.schema->'sections') with ordinality as q(s, sec_i)
    ) x;

  return save_form_definition_version(
    p_form_key, v_base.title, v_base.audience, v_base.purpose, v_new, p_from_version);
end;
$$;

drop function if exists remove_form_field(text, text);
create function remove_form_field(
  p_form_key text, p_field_key text, p_from_version integer default null
) returns integer
language plpgsql
security definer
set search_path to 'public'
as $$
declare v_base record; v_new jsonb;
begin
  if not is_admin() then raise exception 'admin only'; end if;
  select * into v_base from _form_edit_base(p_form_key, p_from_version);
  if v_base.schema is null then
    raise exception 'unknown form % (version %)', p_form_key, p_from_version;
  end if;
  if not exists (select 1 from jsonb_array_elements(v_base.schema->'sections') s,
                              jsonb_array_elements(s->'fields') f where f->>'key' = p_field_key)
  then raise exception 'no field % on form %', p_field_key, p_form_key; end if;

  select jsonb_build_object('sections', jsonb_agg(sec order by sec_i)) into v_new
    from (
      select sec_i, jsonb_set(s, '{fields}',
               coalesce((select jsonb_agg(f order by f_i)
                           from jsonb_array_elements(s->'fields') with ordinality as t(f, f_i)
                          where f->>'key' <> p_field_key), '[]'::jsonb)) as sec
        from jsonb_array_elements(v_base.schema->'sections') with ordinality as q(s, sec_i)
    ) x;

  return save_form_definition_version(
    p_form_key, v_base.title, v_base.audience, v_base.purpose, v_new, p_from_version);
end;
$$;

drop function if exists set_form_field_options(text, text, text[]);
create function set_form_field_options(
  p_form_key text, p_field_key text, p_options text[], p_from_version integer default null
) returns integer
language plpgsql
security definer
set search_path to 'public'
as $$
declare v_base record; v_new jsonb;
begin
  if not is_admin() then raise exception 'admin only'; end if;
  if p_options is null or array_length(p_options, 1) is null then
    raise exception 'a menu needs at least one option';
  end if;
  select * into v_base from _form_edit_base(p_form_key, p_from_version);
  if v_base.schema is null then
    raise exception 'unknown form % (version %)', p_form_key, p_from_version;
  end if;

  select jsonb_build_object('sections', jsonb_agg(sec order by sec_i)) into v_new
    from (
      select sec_i, jsonb_set(s, '{fields}', (
               select jsonb_agg(
                        case when f->>'key' = p_field_key and f ? 'options'
                             then jsonb_set(f, '{options}', to_jsonb(p_options))
                             else f end order by f_i)
                 from jsonb_array_elements(s->'fields') with ordinality as t(f, f_i))) as sec
        from jsonb_array_elements(v_base.schema->'sections') with ordinality as q(s, sec_i)
    ) x;

  return save_form_definition_version(
    p_form_key, v_base.title, v_base.audience, v_base.purpose, v_new, p_from_version);
end;
$$;

-- set_form_required keeps returning the NUMBER OF FIELDS STAMPED, which is what
-- its caller documents; only its write path changes.
drop function if exists set_form_required(text, jsonb);
create function set_form_required(
  p_form_key text, p_required jsonb, p_from_version integer default null
) returns integer
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_base record; v_out jsonb := '{"sections": []}'::jsonb;
  sec jsonb; fld jsonb; new_fields jsonb; v_n integer := 0;
begin
  if not is_admin() then raise exception 'admin access required'; end if;
  select * into v_base from _form_edit_base(p_form_key, p_from_version);
  if v_base.schema is null then
    raise exception 'unknown form: % (version %)', p_form_key, p_from_version;
  end if;

  for sec in select * from jsonb_array_elements(v_base.schema -> 'sections') loop
    new_fields := '[]'::jsonb;
    for fld in select * from jsonb_array_elements(sec -> 'fields') loop
      if p_required ? (fld ->> 'key') then
        fld := jsonb_set(fld, '{required}', p_required -> (fld ->> 'key'));
        v_n := v_n + 1;
      end if;
      new_fields := new_fields || fld;
    end loop;
    v_out := jsonb_set(v_out, '{sections}',
      (v_out -> 'sections') || jsonb_set(sec, '{fields}', new_fields));
  end loop;

  perform save_form_definition_version(
    p_form_key, v_base.title, v_base.audience, v_base.purpose, v_out, p_from_version);
  return v_n;
end;
$$;

-- ── The list of forms now carries its version, so a surface can show it ────
drop function if exists admin_form_definitions();
create function admin_form_definitions()
returns table (form_key text, title text, audience text, purpose text, schema jsonb, version integer)
language sql
stable
security definer
set search_path to 'public'
as $$
  select fd.form_key, fd.title, fd.audience, fd.purpose, fd.schema, fd.version
  from form_definitions fd
  where fd.active and has_staff_access()
  order by fd.audience, fd.title
$$;

-- ── Retired: the old snapshot-the-outgoing-row helper ──────────────────────
-- Every caller now routes through save_form_definition_version. Leaving this in
-- place would leave a second way to write a version that stamps no parent and
-- returns a number the caller is trusted to apply — exactly the second write path
-- beside a correct engine that D18 exists to stop. It has no TypeScript caller.
drop function if exists snapshot_form_definition(text);
