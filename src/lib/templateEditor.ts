import { supabase } from './supabase';

/**
 * TEXTEDIT — the template wording editor's data layer
 * (docs/tasks/TASK-TEXTEDIT-edit-template-wording-without-sql.md).
 *
 * Every write goes through a SECURITY DEFINER RPC guarded by is_admin() —
 * contract_clause_defs grants SELECT only to authenticated, so there is no
 * direct-table write path from the browser and there must never be one.
 *
 * Drafts never touch live text: saves write draft_body, publish copies
 * draft -> body and bumps contract_templates.version by 1 (the existing
 * record_template_version_bump trigger records the event and drives the
 * re-sign prompt). The three live lease keys (HORSE_LEASE_V2 / _SIMPLE /
 * _FULL) are byte-identical by design (D10) and every RPC mirrors them;
 * `updated_keys` / `published_keys` in the results say when that happened
 * so the UI can state it rather than do it silently.
 */

export interface TemplateEditorListRow {
  template_key: string;
  title: string;
  short_label: string | null;
  version: number;
  active: boolean;
  is_composed: boolean;
  clause_count: number;
  draft_clause_count: number;
  has_flat_draft: boolean;
  body_empty: boolean;
  has_unpublished: boolean;
  lockstep_keys: string[];
  locked_reason: string | null;
  updated_at: string;
}

export interface TemplateEditorClause {
  clause_id: string;
  section_key: string;
  section_heading: string | null;
  section_sort: number | null;
  clause_key: string;
  heading: string | null;
  body: string;
  draft_body: string | null;
  clause_type: string | null;
  is_optional: boolean;
  sort_order: number;
}

export interface TemplateEditorToken {
  id: string;
  template_id: string | null;
  template_key: string | null;
  namespace: string;
  field: string;
  token: string;
  kind: string | null;
  source_table: string | null;
  source_column: string | null;
  computed: boolean;
  required: boolean;
  party_scoped: boolean;
  notes: string | null;
  source_live: boolean;
}

export interface SaveDraftResult {
  cleared: boolean;
  updated_keys: string[];
  rows: number;
}

export interface PublishResult {
  published_keys: string[];
  clause_rows_published: number;
  flat_bodies_published: number;
  new_versions: Record<string, number>;
}

export interface DiscardResult {
  keys: string[];
  clause_drafts_discarded: number;
  flat_drafts_discarded: number;
}

export interface FlatTemplateBody {
  template_key: string;
  title: string;
  body: string | null;
  draft_body: string | null;
  version: number;
  active: boolean;
}

export async function templateEditorList(): Promise<TemplateEditorListRow[]> {
  const { data, error } = await supabase.rpc('template_editor_list');
  if (error) throw error;
  return (data ?? []) as TemplateEditorListRow[];
}

export async function templateEditorClauses(templateKey: string): Promise<TemplateEditorClause[]> {
  const { data, error } = await supabase.rpc('template_editor_clauses', { p_template_key: templateKey });
  if (error) throw error;
  return (data ?? []) as TemplateEditorClause[];
}

export async function templateEditorTokens(): Promise<TemplateEditorToken[]> {
  const { data, error } = await supabase.rpc('template_editor_tokens');
  if (error) throw error;
  return (data ?? []) as TemplateEditorToken[];
}

/** Passing null (or text equal to the live body) clears the draft. */
export async function saveClauseDraft(clauseId: string, draft: string | null): Promise<SaveDraftResult> {
  const { data, error } = await supabase.rpc('template_editor_save_clause_draft', {
    p_clause_id: clauseId, p_draft: draft,
  });
  if (error) throw error;
  return data as SaveDraftResult;
}

export async function saveFlatDraft(templateKey: string, draft: string | null): Promise<{ cleared: boolean }> {
  const { data, error } = await supabase.rpc('template_editor_save_flat_draft', {
    p_template_key: templateKey, p_draft: draft,
  });
  if (error) throw error;
  return data as { cleared: boolean };
}

export async function discardTemplateDrafts(templateKey: string): Promise<DiscardResult> {
  const { data, error } = await supabase.rpc('template_editor_discard_drafts', { p_template_key: templateKey });
  if (error) throw error;
  return data as DiscardResult;
}

export async function publishTemplate(templateKey: string): Promise<PublishResult> {
  const { data, error } = await supabase.rpc('template_editor_publish', { p_template_key: templateKey });
  if (error) throw error;
  return data as PublishResult;
}

/** Flat templates only: the current live body + any draft. Read via the
 *  contract_templates_read_active policy, whose is_admin() arm covers the
 *  editor's need to see inactive rows too. */
export async function flatTemplateBody(templateKey: string): Promise<FlatTemplateBody | null> {
  const { data, error } = await supabase
    .from('contract_templates')
    .select('template_key, title, body, draft_body, version, active')
    .eq('template_key', templateKey)
    .is('deleted_at', null)
    .maybeSingle();
  if (error) throw error;
  return data as FlatTemplateBody | null;
}
