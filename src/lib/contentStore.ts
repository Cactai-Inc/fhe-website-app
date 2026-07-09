/* Versioned content/policy store (Slice 5). Slug-keyed content + policy blocks,
 * distinct from the legal contract engine. Bodies carry {{NS.FIELD}} tokens merged
 * at read time; policy blocks log a version-stamped acknowledgment. Admins edit
 * (each save = a new version); everyone in-org reads. RLS is the authority. */
import { supabase } from './supabase';

export type ContentKind = 'content' | 'policy';

export interface ContentBlock {
  slug: string;
  kind: ContentKind;
  title: string;
  version: number;
  body: string;   // already token-merged when fetched via getContentBlock
}

/** Read a block by slug, with {{NS.FIELD}} tokens merged against `context`
 *  (keys like "USER.NAME"). Returns null if the slug doesn't exist in-org. */
export async function getContentBlock(
  slug: string,
  context: Record<string, string> = {},
): Promise<ContentBlock | null> {
  const { data, error } = await supabase.rpc('get_content_block', {
    p_slug: slug,
    p_context: context,
  });
  if (error) throw error;
  return (data as ContentBlock) ?? null;
}

/** Admin publishes a block (creates it, or bumps to a new version). Returns the
 *  new version number. */
export async function upsertContentBlock(
  slug: string,
  title: string,
  body: string,
  kind: ContentKind = 'content',
): Promise<number> {
  const { data, error } = await supabase.rpc('upsert_content_block', {
    p_slug: slug,
    p_title: title,
    p_body: body,
    p_kind: kind,
  });
  if (error) throw error;
  return data as number;
}

/** Acknowledge a policy block at its current version (idempotent). */
export async function acknowledgeContentBlock(slug: string): Promise<void> {
  const { error } = await supabase.rpc('acknowledge_content_block', { p_slug: slug });
  if (error) throw error;
}

export interface ContentBlockRow {
  id: string;
  slug: string;
  kind: ContentKind;
  title: string;
  current_version: number;
  updated_at: string;
}

/** Admin list of all blocks in-org (RLS: read is org-wide; edit is admin). */
export async function listContentBlocks(): Promise<ContentBlockRow[]> {
  const { data, error } = await supabase
    .from('content_blocks')
    .select('id, slug, kind, title, current_version, updated_at')
    .order('slug');
  if (error) throw error;
  return (data ?? []) as ContentBlockRow[];
}

/** The RAW (un-merged) body of a block's current version — for the admin editor,
 *  where tokens must stay literal. */
export async function getContentBlockRaw(blockId: string, version: number): Promise<string> {
  const { data, error } = await supabase
    .from('content_block_versions')
    .select('body')
    .eq('block_id', blockId)
    .eq('version', version)
    .single();
  if (error) throw error;
  return (data?.body as string) ?? '';
}
