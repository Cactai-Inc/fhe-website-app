-- TASK-VERSIONSPINE §1/§3 — content blocks join the same spine.
--
-- content_blocks + content_block_versions already stored versions the way the
-- owner's model needs (the history holds EVERY version, including the live one),
-- which is why this migration is small: it adds the parent stamp, the list, the
-- open and the restore, and leaves the storage rule alone. The FORM side was the
-- one that had to change.
--
-- ⚠️ Both tables hold ZERO ROWS, and /app/ops/content is routed with no
-- pageRegistry entry, so this whole store is built and undriven. Bringing it onto
-- the spine now costs almost nothing and stops it becoming the fourth idiom the
-- moment TASK-SURFACEEDITOR gives page copy somewhere to live.

create or replace function save_content_block_version(
  p_slug           text,
  p_title          text,
  p_body           text,
  p_kind           text default 'content',
  p_parent_version integer default null
) returns integer
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_org    uuid := current_org();
  v_block  content_blocks%rowtype;
  v_next   integer;
  v_parent integer := p_parent_version;
begin
  if not is_admin() then raise exception 'admin access required'; end if;
  if p_kind not in ('content', 'policy') then
    raise exception 'kind must be content or policy';
  end if;
  if nullif(btrim(coalesce(p_title,'')),'') is null then
    raise exception 'a content block needs a title';
  end if;

  select * into v_block from content_blocks
   where org_id = v_org and slug = p_slug for update;

  if not found then
    if v_parent is not null then
      raise exception 'content block % does not exist, so it has no version % to come from', p_slug, v_parent;
    end if;
    insert into content_blocks (org_id, slug, kind, title, current_version)
    values (v_org, p_slug, p_kind, p_title, 1)
    returning * into v_block;
    v_next := 1;
  else
    select greatest(v_block.current_version, coalesce(max(cbv.version), 0)) + 1
      into v_next
      from content_block_versions cbv where cbv.block_id = v_block.id;

    if v_parent is not null then
      if v_parent = v_next - 1 then
        v_parent := null;                     -- the ordinary case says itself
      elsif v_parent >= v_next then
        raise exception 'a version cannot come from version % — that is not earlier than %', v_parent, v_next;
      elsif not exists (select 1 from content_block_versions cbv
                         where cbv.block_id = v_block.id and cbv.version = v_parent) then
        raise exception 'content block % has no version % to edit from', p_slug, v_parent;
      end if;
    end if;

    update content_blocks
       set current_version = v_next, title = p_title, kind = p_kind, updated_at = now()
     where id = v_block.id;
  end if;

  insert into content_block_versions (block_id, version, body, parent_version, edited_by)
  values (v_block.id, v_next, p_body, v_parent, auth.uid());

  return v_next;
end;
$$;

comment on function save_content_block_version(text,text,text,text,integer) is
  'TASK-VERSIONSPINE: the ONLY way a content block version is written. Mints v(max+1) and stamps p_parent_version when an older version was the one being edited.';

-- The shipped editor keeps its entry point; it now delegates rather than
-- writing a version itself, so there is one write path (D18).
create or replace function upsert_content_block(
  p_slug text, p_title text, p_body text, p_kind text default 'content'
) returns integer
language sql
security definer
set search_path to 'public'
as $$
  select save_content_block_version(p_slug, p_title, p_body, p_kind, null)
$$;

comment on function upsert_content_block(text,text,text,text) is
  'TASK-VERSIONSPINE: kept as the editor''s entry point; delegates to save_content_block_version so a version is written in exactly one place.';

create or replace function content_block_version_list(p_slug text)
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
  select v.version, v.parent_version, v.version = b.current_version as is_current,
         v.edited_by,
         coalesce(nullif(btrim(coalesce(p.display_name, '')), ''),
                  nullif(btrim(coalesce(p.first_name,'') || ' ' || coalesce(p.last_name,'')), ''),
                  p.email) as edited_by_name,
         v.created_at
    from content_block_versions v
    join content_blocks b on b.id = v.block_id
    left join profiles p on p.user_id = v.edited_by
   where b.org_id = current_org() and b.slug = p_slug
   order by v.version desc
$$;

create or replace function content_block_version_at(p_slug text, p_version integer)
returns table (
  version        integer,
  parent_version integer,
  title          text,
  body           text,
  kind           text,
  is_current     boolean,
  created_at     timestamptz
)
language sql
stable
security definer
set search_path to 'public'
as $$
  select v.version, v.parent_version, b.title, v.body, b.kind,
         v.version = b.current_version as is_current, v.created_at
    from content_block_versions v
    join content_blocks b on b.id = v.block_id
   where b.org_id = current_org() and b.slug = p_slug and v.version = p_version
$$;

-- ⚠️ content_blocks keeps title and kind on the LIVE ROW ONLY — they are not in
-- the version table, so restoring an old version restores its BODY and leaves the
-- current title in place. That is a real limitation of the existing shape, not a
-- decision: widening content_block_versions to carry title/kind belongs with
-- TASK-SURFACEEDITOR, which is the thread that will finally put rows in here.
create or replace function restore_content_block_version(p_slug text, p_version integer)
returns integer
language plpgsql
security definer
set search_path to 'public'
as $$
declare v_body text; v_title text; v_kind text;
begin
  if not is_admin() then raise exception 'admin access required'; end if;
  select v.body, b.title, b.kind into v_body, v_title, v_kind
    from content_block_versions v
    join content_blocks b on b.id = v.block_id
   where b.org_id = current_org() and b.slug = p_slug and v.version = p_version;
  if not found then raise exception 'content block % has no version %', p_slug, p_version; end if;

  return save_content_block_version(p_slug, v_title, v_body, v_kind, p_version);
end;
$$;

comment on function restore_content_block_version(text,integer) is
  'TASK-VERSIONSPINE: mints a NEW version carrying an old version''s body, stamped "from v<n>". Never moves the pointer backwards.';
