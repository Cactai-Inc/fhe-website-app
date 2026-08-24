/* EMAILEXTRACT — the email CONTENT layer.
 *
 * D12: "the email templates will use the same concept as a document engine, only
 * difference is the output type." An email template is prose + merge tokens, with
 * the same draft/publish/version lifecycle as a contract template. This file is the
 * runtime half: load a row out of `email_templates` and render it.
 *
 * WHAT MOVED AND WHAT DID NOT — the line is deliberate and load-bearing:
 *   CONTENT  (subject text, body prose, which sentence appears when) -> DATA.
 *            Changing a word is an UPDATE on email_templates.draft_body plus a
 *            publish. No code edit, no deploy. That is the D13 acceptance test.
 *   PLUMBING (who receives it, minor/guardian redirection, idempotency, PDF
 *            rendering, delivery logging, rate limits) -> STAYS IN CODE. It is
 *            control flow over the database, not prose, and it is where every
 *            safety property of these senders lives.
 *
 * The sender's job is now: build a flat token map, render, send. It no longer
 * owns a single word of English.
 *
 * TOKENS ARE THE ONE LIBRARY. Every {{NS.FIELD}} used below has a row in
 * `template_tokens` (dictionary rows, template_id IS NULL) so TASK-TEXTEDIT's
 * picker lists them alongside the document tokens. There is no email-specific
 * token namespace and no second registry — see TASK-TOKENAUDIT's Q1: source_table
 * is documentation, resolution is always the caller's job, so email tokens resolve
 * exactly the way document tokens do (a value map built where the data is).
 *
 * SUBSTITUTION IS RAW, NOT ESCAPED — and that is a preservation decision, not a
 * default. The hand-written senders escaped inconsistently (contract-voided and
 * request-received escape; deliver-documents and notifications-nudge interpolate
 * document titles raw). Escaping inside the renderer would have changed the output
 * of half of them, which this refactor is forbidden to do. So each caller passes a
 * value escaped exactly as it was escaped before, and the escaping policy is a
 * named follow-up rather than a silent behaviour change.
 */
import type { SupabaseClient } from '@supabase/supabase-js';

/** A rendered email: what goes on the wire. */
export interface RenderedEmail {
  subject: string;
  html: string;
  /** Tokens the body asked for that the caller did not supply. Empty = clean
   *  render. Never thrown on — a missing token renders as '' exactly as the old
   *  `${v || ''}` interpolations did — but reported so it cannot rot in silence
   *  (TOKENAUDIT §4 found literal {{…}} frozen into executed documents because
   *  nothing ever noticed). */
  missing: string[];
}

/** Token values. A string is a value; an array is an {{#each}} list; null and
 *  undefined are "absent" (falsey to {{#if}}, '' to {{…}}). */
export type TokenValue = string | number | null | undefined | TokenList;
export type TokenList = Array<Record<string, string | number | null | undefined> | string>;
export type TokenMap = Record<string, TokenValue>;

export interface EmailTemplateRow {
  email_key: string;
  title: string;
  subject: string;
  body: string;
  version: number;
  from_address_rule: string;
  reply_to_rule: string;
}

/* ───────────────────────── the template language ─────────────────────────
 * Three constructs, no more. Anything richer belongs in the authoring tool,
 * not in a string substituter that has to be provably identical to what it
 * replaced.
 *
 *   {{NS.FIELD}}                       value, raw
 *   {{#if NS.FIELD}}A{{else}}B{{/if}}  A when present and non-empty, else B
 *   {{#each NS.LIST}}…{{/each}}        repeat; {{.}} = a scalar item,
 *                                      {{.FIELD}} = a field of an object item
 *
 * Blocks nest. `{{else}}` is optional. An unclosed block is a template bug and
 * throws at render time rather than silently swallowing the rest of the email.
 */

type Node =
  | { t: 'text'; v: string }
  | { t: 'var'; k: string }
  | { t: 'if'; k: string; yes: Node[]; no: Node[] }
  | { t: 'each'; k: string; body: Node[] };

const TAG_RE = /\{\{\s*(#if|#each|else|\/if|\/each)?\s*([A-Za-z0-9_.]*)\s*\}\}/g;

/** Parse a template body into nodes. Single pass, explicit stack. */
function parse(src: string): Node[] {
  const root: Node[] = [];
  const stack: Array<{ node: Node; target: 'yes' | 'no' | 'body' }> = [];
  let cursor = 0;

  const out = (): Node[] => {
    if (stack.length === 0) return root;
    const top = stack[stack.length - 1];
    if (top.node.t === 'if') return top.target === 'no' ? top.node.no : top.node.yes;
    if (top.node.t === 'each') return top.node.body;
    return root;
  };

  TAG_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = TAG_RE.exec(src)) !== null) {
    if (m.index > cursor) out().push({ t: 'text', v: src.slice(cursor, m.index) });
    cursor = m.index + m[0].length;
    const kind = m[1];
    const key = m[2];

    if (kind === '#if') {
      const node: Node = { t: 'if', k: key, yes: [], no: [] };
      out().push(node);
      stack.push({ node, target: 'yes' });
    } else if (kind === '#each') {
      const node: Node = { t: 'each', k: key, body: [] };
      out().push(node);
      stack.push({ node, target: 'body' });
    } else if (kind === 'else') {
      const top = stack[stack.length - 1];
      if (!top || top.node.t !== 'if') throw new Error('{{else}} outside an {{#if}}');
      top.target = 'no';
    } else if (kind === '/if' || kind === '/each') {
      const top = stack.pop();
      const want = kind === '/if' ? 'if' : 'each';
      if (!top || top.node.t !== want) throw new Error(`unbalanced {{${kind}}}`);
    } else {
      out().push({ t: 'var', k: key });
    }
  }
  if (cursor < src.length) out().push({ t: 'text', v: src.slice(cursor) });
  if (stack.length > 0) throw new Error('unclosed {{#if}} / {{#each}} block');
  return root;
}

function scalar(v: unknown): string {
  return v == null ? '' : String(v);
}

function truthy(v: TokenValue): boolean {
  if (v == null) return false;
  if (Array.isArray(v)) return v.length > 0;
  return String(v) !== '';
}

function emit(nodes: Node[], vars: TokenMap, item: unknown, missing: Set<string>): string {
  let out = '';
  for (const n of nodes) {
    if (n.t === 'text') {
      out += n.v;
    } else if (n.t === 'var') {
      if (n.k === '.') {
        out += scalar(item);
      } else if (n.k.startsWith('.')) {
        const field = n.k.slice(1);
        const rec = (item ?? {}) as Record<string, unknown>;
        if (!(field in rec)) missing.add(n.k);
        out += scalar(rec[field]);
      } else {
        if (!(n.k in vars)) missing.add(n.k);
        const v = vars[n.k];
        out += Array.isArray(v) ? '' : scalar(v);
      }
    } else if (n.t === 'if') {
      const present = n.k in vars || n.k.startsWith('.');
      const v = n.k.startsWith('.')
        ? ((item ?? {}) as Record<string, TokenValue>)[n.k.slice(1)]
        : vars[n.k];
      if (!present) missing.add(n.k);
      out += emit(truthy(v) ? n.yes : n.no, vars, item, missing);
    } else {
      if (!(n.k in vars)) missing.add(n.k);
      const list = vars[n.k];
      if (Array.isArray(list)) for (const el of list) out += emit(n.body, vars, el, missing);
    }
  }
  return out;
}

/** Render one template string. Exported for the subject line and for the
 *  byte-identity harness, which renders without touching the database. */
/**
 * HTML-escape a value before it goes into a rendered template.
 *
 * ⚠️ THIS IS THE THIRD COPY OF THESE THREE REPLACEMENTS in api/ — the other two
 * are private functions in `notifications-nudge.ts` and `paymentRequest.ts`. It
 * is exported from here, beside the renderer every caller already imports, so a
 * fourth is never needed. The two incumbents are left alone deliberately: they
 * are byte-identical and rewriting a working mail path to save six lines is not
 * worth the risk. Point new callers here.
 */
export function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function renderTemplateString(src: string, vars: TokenMap): { text: string; missing: string[] } {
  const missing = new Set<string>();
  const text = emit(parse(src), vars, undefined, missing);
  return { text, missing: Array.from(missing) };
}

/** Render a loaded row (subject + body) against one token map. */
export function renderEmail(tpl: Pick<EmailTemplateRow, 'subject' | 'body'>, vars: TokenMap): RenderedEmail {
  const s = renderTemplateString(tpl.subject, vars);
  const b = renderTemplateString(tpl.body, vars);
  return { subject: s.text, html: b.text, missing: Array.from(new Set([...s.missing, ...b.missing])) };
}

/* ───────────────────────── loading ───────────────────────── */

/** Load a published email template by key. Returns null when the key is absent
 *  or deactivated — the caller decides whether that is fatal (a document copy)
 *  or skippable (a best-effort digest). No template is ever invented here. */
export async function loadEmailTemplate(
  db: SupabaseClient,
  emailKey: string,
): Promise<EmailTemplateRow | null> {
  const { data, error } = await db
    .from('email_templates')
    .select('email_key, title, subject, body, version, from_address_rule, reply_to_rule')
    .eq('email_key', emailKey)
    .eq('active', true)
    .is('deleted_at', null)
    .maybeSingle();
  if (error) {
    console.error('email template load failed', { emailKey, error: error.message });
    return null;
  }
  return (data as EmailTemplateRow | null) ?? null;
}

/** Load + render in one step. Returns null when the template is missing, so a
 *  caller can fall through to its own failure path rather than mailing a blank. */
export async function renderEmailTemplate(
  db: SupabaseClient,
  emailKey: string,
  vars: TokenMap,
): Promise<RenderedEmail | null> {
  const tpl = await loadEmailTemplate(db, emailKey);
  if (!tpl) {
    console.error('email template not found or inactive', { emailKey });
    return null;
  }
  const out = renderEmail(tpl, vars);
  if (out.missing.length > 0) {
    console.error('email template rendered with unresolved tokens', { emailKey, missing: out.missing });
  }
  return out;
}
