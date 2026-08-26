-- TASK-VERSIONSPINE §2 — contract_templates gets the history table it never had.
--
-- contract_templates carries a `version` integer and NO history table, so today
-- `template_editor_publish` overwrites the body from the draft and bumps the
-- number. THE PREVIOUS WORDING IS DISCARDED. `template_version_events` records
-- that a bump happened (from_version → to_version, and whether past signers must
-- re-sign) but it holds no content, so it cannot answer "what did v2 say?".
--
-- Measured on production 2026-08-26: 9 of 26 templates are already past v1
-- (5 at v2, 4 at v3), and template_version_events carries 12 bump rows. Every one
-- of those earlier bodies is already gone and cannot be recovered — this table
-- stops the loss from here forward, it does not undo it. Backfilled histories
-- therefore START at the template's current number, and v1..v(n-1) are absent by
-- fact, not by omission. See TASK-VERSIONSPINE-REPORT.md §"what was already lost".
--
-- ⚠️ THE BODY IS NOT WHERE THE WORDING LIVES FOR HALF OF THESE. Four templates are
-- clause-composed (HORSE_LEASE_V2 / _SIMPLE / _FULL at 163 clauses each,
-- HORSE_SALE_V2 at 76, HORSE_BILL_OF_SALE at 36) and their `body` column holds a
-- 23-character placeholder. Their real wording is contract_clause_defs.body, and
-- `template_editor_publish` overwrites THAT from draft_body. A version row that
-- retained only `body` would retain nothing for exactly the templates the owner
-- edits most. So a version also retains the COMPOSITION — sections, clauses and
-- fields — which is what makes it a "fully retained copy" rather than a receipt.

-- ── The composition, captured whole ─────────────────────────────────────────
-- to_jsonb(row) rather than a column list on purpose: TASK-CONTRACTOPTIONS is
-- about to add an `active` flag inside contract_field_defs.options, and a
-- hand-written column list would silently stop retaining the thing that changed.
-- id and created_at are dropped — they identify the live row, not the content.
create or replace function capture_contract_template_composition(p_template_key text)
returns jsonb
language sql
stable
security definer
set search_path to 'public'
as $$
  select jsonb_build_object(
    'sections', coalesce((
      select jsonb_agg(to_jsonb(s) - 'id' - 'created_at' order by s.sort_order, s.section_key)
        from contract_section_defs s where s.template_key = p_template_key), '[]'::jsonb),
    'clauses', coalesce((
      select jsonb_agg(to_jsonb(c) - 'id' - 'created_at' order by c.section_key, c.sort_order, c.clause_key)
        from contract_clause_defs c where c.template_key = p_template_key), '[]'::jsonb),
    'fields', coalesce((
      select jsonb_agg(to_jsonb(f) - 'id' - 'created_at' order by f.sort_order, f.field_key)
        from contract_field_defs f where f.template_key = p_template_key), '[]'::jsonb)
  )
$$;

comment on function capture_contract_template_composition(text) is
  'TASK-VERSIONSPINE: the full authored composition of a template — sections, clauses, fields — as one jsonb, for retention in contract_template_versions. Whole-row capture so new columns are retained without a migration.';

-- ── The history table, on the shape the other two already share ─────────────
create table if not exists contract_template_versions (
  id             uuid primary key default gen_random_uuid(),
  template_key   text not null,
  version        integer not null,
  title          text not null,
  body           text,
  composition    jsonb,
  parent_version integer,
  edited_by      uuid references profiles(user_id),
  created_at     timestamptz not null default now(),
  constraint contract_template_versions_key_version_key unique (template_key, version),
  constraint contract_template_versions_parent_is_earlier
    check (parent_version is null or (parent_version >= 1 and parent_version < version))
);

comment on table contract_template_versions is
  'One row per contract template version, retained in full. The latest is the live one; every earlier version is a non-functional fully retained copy. Append-only.';
comment on column contract_template_versions.parent_version is
  'The version this one was edited FROM. NULL = the immediately preceding version (the ordinary case). Never points forward.';
comment on column contract_template_versions.composition is
  'sections / clauses / fields as they stood at this version. NULL only for a template that has no composition rows at all.';

create index if not exists contract_template_versions_key_idx
  on contract_template_versions (template_key, version desc);

alter table contract_template_versions enable row level security;

-- Read is staff; there is NO write policy, deliberately. Every write goes through
-- the SECURITY DEFINER save path, which is what makes it the only way in.
-- (This follows form_definition_versions, not content_block_versions — the latter
-- carries an admin ALL policy that made its history directly writable, which is
-- the hole 20260826T1900's append-only trigger closes.)
drop policy if exists ctv_staff_read on contract_template_versions;
create policy ctv_staff_read on contract_template_versions
  for select to authenticated using (has_staff_access());

-- Same append-only guarantee as the other two histories.
drop trigger if exists contract_template_versions_append_only on contract_template_versions;
create trigger contract_template_versions_append_only
  before update or delete on contract_template_versions
  for each row execute function version_rows_are_append_only();

-- ── Backfill: no template starts with an empty history ──────────────────────
-- Every template, including the four retired ones (D16/D32 — a retired template
-- is kept, because it is the definition of every document executed under it).
-- created_at is the row's updated_at: the closest true statement about when this
-- content became current. edited_by is NULL — nobody recorded who did it.
insert into contract_template_versions (template_key, version, title, body, composition, parent_version, edited_by, created_at)
select ct.template_key, ct.version, ct.title, ct.body,
       capture_contract_template_composition(ct.template_key),
       null, null, ct.updated_at
  from contract_templates ct
on conflict (template_key, version) do nothing;
