import { supabase } from './supabase';

/**
 * TASK-SURFACEEDITOR — the data layer for the ONE editor.
 *
 * Owner, 2026-08-26: *"we only need one editor for forms, docs, and ui pages,
 * with all of the editable items listed with their name and when clicked open an
 * editable version of that item… it would be most effective to just render the
 * entire thing that the thing im editing lives on, so if its a menu option on the
 * horse intake form, clicking on the horse intake form from the entry page opens
 * the horse intake form and then i can edit anything on the form, including the
 * menu items."*
 *
 * ⚠️ EVERYTHING HERE IS A WRAPPER OVER A SPINE THAT ALREADY EXISTS. Thread 1
 * (TASK-VERSIONSPINE) built the version store and its save/list/open/restore for
 * forms, content blocks and contract templates; Thread 2 (TASK-CONTRACTOPTIONS)
 * built the five `contract_menu_*` rules and deliberately wrote no TypeScript for
 * them, because "the shape of the seam belongs with the surface that uses it".
 * This file is that seam. It adds no second write path (D18).
 *
 * ⚠️ AND ONE THING IT MUST NOT DO: `contract_menu_set_active` (and its four
 * siblings) ALREADY CALL `save_contract_template_version` — an option edit mints
 * a template version on its own. Nothing here may mint a second one for the same
 * act.
 */

/* ─── CONTRACT OPTION LISTS — Thread 2's five rules, in TypeScript ────────────
 *
 * The rules, in the owner's terms, and each is a refusal or a safeguard rather
 * than a convenience:
 *   deactivate, never delete   — 208 field conditions, 449 clause conditions and
 *                                8 option gates name option values as bare
 *                                strings; removing a row falsifies them silently
 *   relabel freely             — the words move, the code never does
 *   re-coding is REFUSED       — contract_menu_recode exists in order to raise
 *   adding is safe             — new documents and open drafts see it, executed
 *                                paper does not
 */

export interface ContractMenuOption {
  value: string;
  label: string;
  active?: boolean;
  when?: unknown;
}

export interface ContractMenuDependents {
  template_key: string;
  field_key: string;
  code: string;
  label: string | null;
  active: boolean;
  totals: {
    clauses: number;
    fields: number;
    options: number;
    conditions: number;
    documents_open: number;
    documents_frozen: number;
  };
  clauses?: unknown[];
  fields?: unknown[];
  options?: unknown[];
  documents?: unknown[];
}

/** Everything that would be affected by retiring this value: the three condition
 *  sites plus every document holding it, split by whether it can still change. */
export async function contractMenuDependents(
  templateKey: string, fieldKey: string, code: string,
): Promise<ContractMenuDependents> {
  const { data, error } = await supabase.rpc('contract_menu_dependents', {
    p_template_key: templateKey, p_field_key: fieldKey, p_code: code,
  });
  if (error) throw error;
  return data as ContractMenuDependents;
}

export interface ContractMenuSetActiveResult {
  cleared?: { document_id: string; was: string; now: string | null; required: boolean }[];
  reopened?: { document_id: string; blockers_before: number; blockers_after: number }[];
  new_template_version?: number;
  [k: string]: unknown;
}

/** Retire or bring back a value. ⚠️ NOT SYMMETRICAL, and the editor says so:
 *  reactivating restores the OPTION, not the ANSWER. A draft whose selection was
 *  cleared stays unanswered — the old answer is in `contract_change_log`. */
export async function contractMenuSetActive(
  templateKey: string, fieldKey: string, code: string, active: boolean,
): Promise<ContractMenuSetActiveResult> {
  const { data, error } = await supabase.rpc('contract_menu_set_active', {
    p_template_key: templateKey, p_field_key: fieldKey, p_code: code, p_active: active,
  });
  if (error) throw error;
  return data as ContractMenuSetActiveResult;
}

/** The words may change. The code may not — see contractMenuRecode. */
export async function contractMenuRelabel(
  templateKey: string, fieldKey: string, code: string, label: string,
): Promise<unknown> {
  const { data, error } = await supabase.rpc('contract_menu_relabel', {
    p_template_key: templateKey, p_field_key: fieldKey, p_code: code, p_label: label,
  });
  if (error) throw error;
  return data;
}

export async function contractMenuAddValue(
  templateKey: string, fieldKey: string, code: string, label: string,
): Promise<unknown> {
  const { data, error } = await supabase.rpc('contract_menu_add_value', {
    p_template_key: templateKey, p_field_key: fieldKey, p_code: code, p_label: label,
  });
  if (error) throw error;
  return data;
}

/* ─── The fields of a contract template, and their option lists ───────────────
 * Read straight from contract_field_defs: `cfd_read` grants SELECT to staff, and
 * every WRITE goes through the RPCs above. `clause_key` is what puts a field
 * under the clause it appears in, which is the whole point of the surface — a
 * menu means nothing away from the thing it appears on. */
export interface ContractFieldDef {
  field_key: string;
  label: string;
  section: string;
  clause_key: string | null;
  input_kind: string;
  options: ContractMenuOption[] | null;
  sort_order: number;
}

export async function contractTemplateFields(templateKey: string): Promise<ContractFieldDef[]> {
  const { data, error } = await supabase
    .from('contract_field_defs')
    .select('field_key, label, section, clause_key, input_kind, options, sort_order')
    .eq('template_key', templateKey)
    .order('sort_order');
  if (error) throw error;
  return (data ?? []) as ContractFieldDef[];
}

/* ─── CONTRACT TEMPLATE VERSIONS — Thread 1 built these and nothing called them ─ */

export interface TemplateVersion {
  version: number;
  parent_version: number | null;
  is_current: boolean;
  title: string;
  clause_count: number;
  edited_by: string | null;
  edited_by_name: string | null;
  created_at: string;
}

export async function templateVersionList(templateKey: string): Promise<TemplateVersion[]> {
  const { data, error } = await supabase.rpc('contract_template_version_list', {
    p_template_key: templateKey,
  });
  if (error) throw error;
  return (data ?? []) as TemplateVersion[];
}

export interface TemplateVersionDetail {
  version: number;
  parent_version: number | null;
  title: string;
  body: string | null;
  composition: {
    sections?: { section_key: string; heading: string | null }[];
    clauses?: { clause_key: string; heading: string | null; body: string; section_key: string }[];
    fields?: { field_key: string; label: string; options: ContractMenuOption[] | null }[];
  } | null;
  is_current: boolean;
  created_at: string;
}

export async function templateVersionAt(
  templateKey: string, version: number,
): Promise<TemplateVersionDetail | null> {
  const { data, error } = await supabase.rpc('contract_template_version_at', {
    p_template_key: templateKey, p_version: version,
  });
  if (error) throw error;
  return ((data ?? [])[0] as TemplateVersionDetail | undefined) ?? null;
}

/** Mints a NEW version carrying an old one's wording, stamped "from v<n>".
 *  ⚠️ REFUSES, NAMING WHAT DIFFERS, when clauses have been added or removed since
 *  that version — a half-restore that silently leaves a clause behind is worse
 *  than a refusal. The four lease templates sit one clause ahead of their
 *  retained v3 (D33) and will refuse until the next publish mints v4. That is
 *  correct behaviour, and the editor states it in words. */
export async function restoreTemplateVersion(templateKey: string, version: number): Promise<number> {
  const { data, error } = await supabase.rpc('restore_contract_template_version', {
    p_template_key: templateKey, p_version: version,
  });
  if (error) throw error;
  return data as number;
}

/* ─── EMAIL TEMPLATES — the store that had six RPCs and no screen ─────────────
 * TASK-SURFACEEDITOR's migration put it on the same spine as the other three:
 * draft -> publish, and PUBLISH is what mints the version, exactly as it already
 * works for document wording. */

export interface EmailTemplateRow {
  email_key: string;
  title: string;
  description: string | null;
  category: string;
  subject: string;
  version: number;
  active: boolean;
  transactional: boolean;
  recipient_note: string | null;
  from_address_rule: string;
  reply_to_rule: string;
  has_unpublished: boolean;
  updated_at: string;
}

export async function emailTemplateList(): Promise<EmailTemplateRow[]> {
  const { data, error } = await supabase.rpc('email_template_list');
  if (error) throw error;
  return (data ?? []) as EmailTemplateRow[];
}

export interface EmailTemplateDetail extends EmailTemplateRow {
  body: string;
  draft_subject: string | null;
  draft_body: string | null;
}

export async function emailTemplateGet(emailKey: string): Promise<EmailTemplateDetail> {
  const { data, error } = await supabase.rpc('email_template_get', { p_email_key: emailKey });
  if (error) throw error;
  return data as EmailTemplateDetail;
}

/** Passing text equal to the live wording clears the draft — the same rule the
 *  document editor uses, so "I typed it back" is not a pending change. */
export async function emailTemplateSaveDraft(
  emailKey: string, subject: string | null, body: string | null,
): Promise<{ email_key: string; has_unpublished: boolean }> {
  const { data, error } = await supabase.rpc('email_template_save_draft', {
    p_email_key: emailKey, p_subject: subject, p_body: body,
  });
  if (error) throw error;
  return data as { email_key: string; has_unpublished: boolean };
}

export async function emailTemplatePublish(emailKey: string): Promise<{ new_version: number }> {
  const { data, error } = await supabase.rpc('email_template_publish', { p_email_key: emailKey });
  if (error) throw error;
  return data as { new_version: number };
}

export async function emailTemplateDiscardDraft(emailKey: string): Promise<unknown> {
  const { data, error } = await supabase.rpc('email_template_discard_draft', { p_email_key: emailKey });
  if (error) throw error;
  return data;
}

export interface EmailVersion {
  version: number;
  parent_version: number | null;
  is_current: boolean;
  subject: string;
  edited_by: string | null;
  edited_by_name: string | null;
  created_at: string;
}

export async function emailVersionList(emailKey: string): Promise<EmailVersion[]> {
  const { data, error } = await supabase.rpc('email_template_version_list', { p_email_key: emailKey });
  if (error) throw error;
  return (data ?? []) as EmailVersion[];
}

export interface EmailVersionDetail {
  version: number;
  parent_version: number | null;
  is_current: boolean;
  title: string;
  subject: string;
  body: string;
  created_at: string;
}

export async function emailVersionAt(
  emailKey: string, version: number,
): Promise<EmailVersionDetail | null> {
  const { data, error } = await supabase.rpc('email_template_version_at', {
    p_email_key: emailKey, p_version: version,
  });
  if (error) throw error;
  return ((data ?? [])[0] as EmailVersionDetail | undefined) ?? null;
}

export async function restoreEmailVersion(emailKey: string, version: number): Promise<number> {
  const { data, error } = await supabase.rpc('restore_email_template_version', {
    p_email_key: emailKey, p_version: version,
  });
  if (error) throw error;
  return data as number;
}
