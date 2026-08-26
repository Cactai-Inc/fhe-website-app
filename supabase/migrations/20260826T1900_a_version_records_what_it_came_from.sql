-- TASK-VERSIONSPINE §1 — parent_version, and the list becomes append-only.
--
-- The owner's model, 2026-08-26: "when an older version is used to create a
-- newer version we should track which version number was edited to create the
-- new version… the information saying it was generated from version 4 will
-- clarify that it doesnt contain things that are unique to version 7."
--
-- THE NUMBER SAYS WHEN. THE PARENT SAYS WHAT IT CAME FROM. Both are needed and
-- neither substitutes for the other.
--
-- parent_version is NULL for the ordinary case — "edited from the version
-- immediately before this one" — so the common path stays free of noise. It is
-- only written when someone opened an older version and saved on top of it.
--
-- ⚠️ THIS COLUMN GOES IN BEFORE ANY EDITOR MINTS ANYTHING. It is the one part of
-- the model that cannot be reconstructed after the fact: once a v8 is saved
-- without recording that it came from v4, that fact is gone permanently.

alter table content_block_versions   add column if not exists parent_version integer;
alter table form_definition_versions add column if not exists parent_version integer;

comment on column content_block_versions.parent_version is
  'The version this one was edited FROM. NULL = the immediately preceding version (the ordinary case). Never points forward.';
comment on column form_definition_versions.parent_version is
  'The version this one was edited FROM. NULL = the immediately preceding version (the ordinary case). Never points forward.';

-- A parent is always an EARLIER version of the same thing. This is what makes
-- the lineage readable: follow parents and you always walk backwards.
alter table content_block_versions   drop constraint if exists content_block_versions_parent_is_earlier;
alter table content_block_versions   add  constraint content_block_versions_parent_is_earlier
  check (parent_version is null or (parent_version >= 1 and parent_version < version));

alter table form_definition_versions drop constraint if exists form_definition_versions_parent_is_earlier;
alter table form_definition_versions add  constraint form_definition_versions_parent_is_earlier
  check (parent_version is null or (parent_version >= 1 and parent_version < version));

-- ── The list is append-only, and the DATABASE is what makes that true ────────
--
-- "Restore" mints a new version from an old one; it does not move a pointer
-- backwards. Nothing in the design ever decreases a version number or removes a
-- row from the list. That is what makes the lineage trustworthy: every version's
-- parent still exists and can still be read.
--
-- Proving that by inspecting the RPCs is a proof about today's code. This trigger
-- makes it a property of the STORE, so a later thread, a stray PostgREST call, or
-- an admin with the ALL policy on content_block_versions cannot violate it either.
-- (content_block_versions carries an admin ALL policy — UPDATE and DELETE were
-- reachable from the client before this.)
--
-- Consistent with D32: nothing is ever removed from the database.
create or replace function version_rows_are_append_only()
returns trigger
language plpgsql
as $$
begin
  raise exception
    'Version history is append-only: % on % is refused. A version is superseded by minting a new one, never by changing or removing a row.',
    tg_op, tg_table_name
    using errcode = 'restrict_violation';
  return null;
end;
$$;

comment on function version_rows_are_append_only() is
  'TASK-VERSIONSPINE: refuses UPDATE and DELETE on any version-history table. The list only ever grows.';

drop trigger if exists content_block_versions_append_only on content_block_versions;
create trigger content_block_versions_append_only
  before update or delete on content_block_versions
  for each row execute function version_rows_are_append_only();

drop trigger if exists form_definition_versions_append_only on form_definition_versions;
create trigger form_definition_versions_append_only
  before update or delete on form_definition_versions
  for each row execute function version_rows_are_append_only();

-- ⚠️ ONE KNOCK-ON, RECORDED DELIBERATELY: content_block_versions.block_id carries
-- ON DELETE CASCADE from content_blocks, so deleting a content block would now
-- raise instead of silently taking its history with it. That is the correct
-- behaviour under D32 (nothing is removed from the database) and it is currently
-- unreachable in any case — content_blocks holds zero rows and no code deletes
-- from it. Retiring a block is a flag, not a DELETE.
