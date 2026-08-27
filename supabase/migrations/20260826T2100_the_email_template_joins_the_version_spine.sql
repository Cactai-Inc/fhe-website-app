-- TASK-SURFACEEDITOR §4 — the FOURTH IDIOM ends: email templates join the spine.
--
-- TASK-ONEEDITOR §5: "THREE IDIOMS BECOME ONE, so email_templates' draft/publish
-- model is either migrated or explicitly exempted. Leaving it as a fourth is the
-- outcome to avoid."  This migrates it.
--
-- ⚠️ WHAT MADE THE DECISION EASY, AND IT WAS NOT IN ANY BRIEF: `email_templates`
-- HAS NO USER INTERFACE AT ALL. Six RPCs exist (email_template_list / _get /
-- _save_draft / _publish / _discard_draft / _set_active) and, measured on this
-- branch, ZERO TypeScript callers — nothing in src/ so much as names the table.
-- 24 templates, `version` already up to 4, and every one of those bumps
-- overwrote a subject and a body and kept nothing. So the owner cannot change a
-- single word the system emails, which is D13 exactly, and the store had no
-- shipped editor to disturb by putting it on the spine.
--
-- THE SHAPE IS THE CONTRACT-TEMPLATE ONE, deliberately: draft -> publish, and
-- PUBLISH is what mints the version. That is already how the owner edits
-- document wording (template_editor_publish -> save_contract_template_version),
-- so an email now behaves like the document it is (D12 taxonomy: "correspondence
-- emails are documents with a delivery channel").
--
-- ⚠️ AND THE SAME LOSS APPLIES AS FOR CONTRACT TEMPLATES: 9 of the 24 are past
-- v1 and their earlier subjects and bodies are gone. The backfill starts each
-- history AT ITS CURRENT NUMBER — MAIL_INVITE has a v4 and no v1-v3, and never
-- will. This stops the loss from here; it does not undo it.

-- ── The history table ───────────────────────────────────────────────────────
create table if not exists email_template_versions (
  id             uuid primary key default gen_random_uuid(),
  template_id    uuid not null references email_templates(id) on delete restrict,
  email_key      text not null,
  version        integer not null,
  parent_version integer,
  title          text not null,
  subject        text not null,
  body           text not null,
  edited_by      uuid,
  created_at     timestamptz not null default now(),
  unique (template_id, version),
  constraint email_template_versions_parent_is_earlier
    check (parent_version is null or (parent_version >= 1 and parent_version < version))
);

comment on table email_template_versions is
  'TASK-SURFACEEDITOR: the retained history of every email template. Append-only; the history holds EVERY version including the live one (TASK-VERSIONSPINE §5.1''s settled storage rule).';
comment on column email_template_versions.parent_version is
  'The version this one was edited FROM. NULL = the immediately preceding version (the ordinary case). Never points forward.';

create index if not exists email_template_versions_key_idx
  on email_template_versions (email_key, version desc);

-- Same append-only guard as the other three histories. Restore mints forward;
-- nothing lowers a number or removes a row (D32).
drop trigger if exists email_template_versions_append_only on email_template_versions;
create trigger email_template_versions_append_only
  before update or delete on email_template_versions
  for each row execute function version_rows_are_append_only();

-- SELECT only, and admin-only to match email_template_get: every write goes
-- through a SECURITY DEFINER function, so PostgREST cannot mint a version with
-- no parent and a number the save path never agreed to (the hole TASK-VERSIONSPINE
-- closed on content_block_versions).
alter table email_template_versions enable row level security;
drop policy if exists etv_admin_read on email_template_versions;
create policy etv_admin_read on email_template_versions
  for select to authenticated using (is_admin());

revoke insert, update, delete on email_template_versions from authenticated, anon;
grant select on email_template_versions to authenticated;

-- ── Backfill: no template starts with an empty history ──────────────────────
-- Deleted rows included, for the same reason retired contract templates keep
-- theirs (D16/D32): a retired template is the definition of what was already sent.
insert into email_template_versions (template_id, email_key, version, parent_version, title, subject, body, edited_by, created_at)
select e.id, e.email_key, e.version, null, e.title, e.subject, e.body, null, e.updated_at
  from email_templates e
 where not exists (
   select 1 from email_template_versions v
    where v.template_id = e.id and v.version = e.version);

-- ── The one save path ───────────────────────────────────────────────────────
create or replace function save_email_template_version(
  p_email_key      text,
  p_title          text default null,
  p_subject        text default null,
  p_body           text default null,
  p_parent_version integer default null
) returns integer
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_row    email_templates%rowtype;
  v_next   integer;
  v_parent integer := p_parent_version;
begin
  if not coalesce(is_admin(), false) then
    raise exception 'Email template editing is admin-only';
  end if;

  select * into v_row from email_templates
   where email_key = p_email_key and deleted_at is null
   for update;
  if not found then raise exception 'Email template % not found', p_email_key; end if;

  -- greatest(live, max(history)) + 1 under the row lock: two concurrent saves
  -- cannot claim the same number and no path can produce one already used.
  select greatest(v_row.version, coalesce(max(v.version), 0)) + 1
    into v_next
    from email_template_versions v where v.template_id = v_row.id;

  if v_parent is not null then
    if v_parent = v_next - 1 then
      v_parent := null;                       -- the ordinary case says itself
    elsif v_parent >= v_next then
      raise exception 'a version cannot come from version % — that is not earlier than %', v_parent, v_next;
    elsif not exists (select 1 from email_template_versions v
                       where v.template_id = v_row.id and v.version = v_parent) then
      raise exception 'Email template % has no version % to edit from', p_email_key, v_parent;
    end if;
  end if;

  update email_templates
     set title   = coalesce(p_title,   title),
         subject = coalesce(p_subject, subject),
         body    = coalesce(p_body,    body),
         version = v_next,
         updated_at = now()
   where id = v_row.id
  returning * into v_row;

  insert into email_template_versions
    (template_id, email_key, version, parent_version, title, subject, body, edited_by)
  values
    (v_row.id, v_row.email_key, v_next, v_parent, v_row.title, v_row.subject, v_row.body, auth.uid());

  return v_next;
end;
$$;

comment on function save_email_template_version(text,text,text,text,integer) is
  'TASK-SURFACEEDITOR: the ONLY way an email template version is written. Mints v(max+1) and stamps p_parent_version when an older version was the one being edited.';

-- ── Publish delegates. One write path (D18). ────────────────────────────────
-- It used to bump `version` itself and keep nothing. It now hands the draft to
-- the save path, which retains what it replaces.
create or replace function email_template_publish(p_email_key text)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_row     email_templates%rowtype;
  v_version integer;
begin
  if not coalesce(is_admin(), false) then
    raise exception 'Email template editing is admin-only';
  end if;

  select * into v_row from email_templates
   where email_key = p_email_key and deleted_at is null;
  if not found then raise exception 'Email template % not found', p_email_key; end if;

  if v_row.draft_subject is null and v_row.draft_body is null then
    raise exception 'Nothing to publish for % — no draft changes exist.', p_email_key;
  end if;

  v_version := save_email_template_version(
    p_email_key,
    null,
    coalesce(v_row.draft_subject, v_row.subject),
    coalesce(v_row.draft_body,    v_row.body),
    null);

  update email_templates
     set draft_subject = null, draft_body = null
   where id = v_row.id;

  return jsonb_build_object('email_key', p_email_key, 'new_version', v_version);
end;
$$;

-- ── The list, one version, and restore ──────────────────────────────────────
create or replace function email_template_version_list(p_email_key text)
returns table (
  version        integer,
  parent_version integer,
  is_current     boolean,
  subject        text,
  edited_by      uuid,
  edited_by_name text,
  created_at     timestamptz
)
language sql
stable
security definer
set search_path to 'public'
as $$
  select v.version, v.parent_version, v.version = e.version as is_current,
         v.subject, v.edited_by,
         coalesce(nullif(btrim(coalesce(p.display_name, '')), ''),
                  nullif(btrim(coalesce(p.first_name,'') || ' ' || coalesce(p.last_name,'')), ''),
                  p.email) as edited_by_name,
         v.created_at
    from email_template_versions v
    join email_templates e on e.id = v.template_id
    left join profiles p on p.user_id = v.edited_by
   where e.email_key = p_email_key and is_admin()
   order by v.version desc
$$;

create or replace function email_template_version_at(p_email_key text, p_version integer)
returns table (
  version        integer,
  parent_version integer,
  is_current     boolean,
  title          text,
  subject        text,
  body           text,
  created_at     timestamptz
)
language sql
stable
security definer
set search_path to 'public'
as $$
  select v.version, v.parent_version, v.version = e.version as is_current,
         v.title, v.subject, v.body, v.created_at
    from email_template_versions v
    join email_templates e on e.id = v.template_id
   where e.email_key = p_email_key and v.version = p_version and is_admin()
$$;

-- Restore is SAVE with no editing — the same call, never a second path, and it
-- mints forward: restoring v1 when v4 exists produces v5 · from v1 (TASK-ONEEDITOR §5).
create or replace function restore_email_template_version(p_email_key text, p_version integer)
returns integer
language plpgsql
security definer
set search_path to 'public'
as $$
declare v_title text; v_subject text; v_body text;
begin
  if not coalesce(is_admin(), false) then
    raise exception 'Email template editing is admin-only';
  end if;
  select v.title, v.subject, v.body into v_title, v_subject, v_body
    from email_template_versions v
    join email_templates e on e.id = v.template_id
   where e.email_key = p_email_key and v.version = p_version;
  if not found then raise exception 'Email template % has no version %', p_email_key, p_version; end if;

  return save_email_template_version(p_email_key, v_title, v_subject, v_body, p_version);
end;
$$;

comment on function restore_email_template_version(text,integer) is
  'TASK-SURFACEEDITOR: mints a NEW version carrying an old version''s wording, stamped "from v<n>". Never moves the pointer backwards.';

grant execute on function save_email_template_version(text,text,text,text,integer) to authenticated;
grant execute on function email_template_version_list(text) to authenticated;
grant execute on function email_template_version_at(text,integer) to authenticated;
grant execute on function restore_email_template_version(text,integer) to authenticated;
