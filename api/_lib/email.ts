/* Server-only transactional email helpers. Resolves per-tenant brand identity
 * (from-name, legal footer, public contact) from the value registry so one config
 * write propagates to every email a tenant sends, then dispatches via the provider.
 *
 * NEVER import into client code — this reaches config_values / business_config with
 * the service-role admin client (RLS-bypassing), scoped explicitly to the target
 * orgId (mirrors generate_document's per-engagement org scoping — the isolation
 * posture: current_org() is unavailable to a server function, so we scope by orgId).
 */
import type { SupabaseClient } from '@supabase/supabase-js';

export interface TenantEmailIdentity {
  /** Display name for the From header, resolved from BRAND.NAME (registry). */
  fromName: string;
  /** The From email address (env-configured; NOT a hardcoded tenant address). */
  fromEmail: string;
  /** Rendered legal/contact footer built from ORG.* + CONTACT.* registry values. */
  footer: string;
  /** The tenant's public contact email (CONTACT.EMAIL), if set. */
  contactEmail: string | null;
}

/** Resolve a single config_values row for a tenant (org-scoped, no current_org()). */
async function resolveConfigValue(
  db: SupabaseClient,
  orgId: string,
  namespace: string,
  key: string,
): Promise<string | null> {
  const { data } = await db
    .from('config_values')
    .select('value_text')
    .eq('org_id', orgId)
    .eq('namespace', namespace)
    .eq('key', key)
    .maybeSingle();
  return (data?.value_text as string | undefined) ?? null;
}

/**
 * Resolve the tenant-branded email identity (from-name, legal footer, contact) for
 * an org from the value registry. Brand name comes from config_values ns BRAND;
 * public contact from ns CONTACT; the legal entity name / address from the typed
 * business_config singleton for that org. Every read is scoped to orgId, so a
 * config write for one tenant never bleeds into another's mail.
 */
export async function resolveTenantEmailIdentity(
  db: SupabaseClient,
  orgId: string,
): Promise<TenantEmailIdentity> {
  const [brandName, contactEmail, contactPhone, contactUrl] = await Promise.all([
    resolveConfigValue(db, orgId, 'BRAND', 'NAME'),
    resolveConfigValue(db, orgId, 'CONTACT', 'EMAIL'),
    resolveConfigValue(db, orgId, 'CONTACT', 'PHONE'),
    resolveConfigValue(db, orgId, 'CONTACT', 'URL'),
  ]);

  // Typed legal fields live in business_config (single source of truth), scoped to org.
  const { data: cfg } = await db
    .from('business_config')
    .select('legal_entity_name, business_address')
    .eq('org_id', orgId)
    .maybeSingle();

  const legalName = (cfg?.legal_entity_name as string | undefined) || brandName || null;

  const fromName = brandName || legalName || 'Notifications';

  // From email: env-configured, never a hardcoded tenant address (§15 static audit).
  // A per-tenant override may live in config_values ns CONTACT key FROM_EMAIL.
  const configuredFrom = await resolveConfigValue(db, orgId, 'CONTACT', 'FROM_EMAIL');
  const fromEmail = configuredFrom || process.env.TRANSACTIONAL_FROM_EMAIL || '';

  const footer = buildFooter({ legalName, contactEmail, contactPhone, contactUrl });

  return { fromName, fromEmail, footer, contactEmail };
}

/** Build the {{ORG.*}} legal/contact footer from the resolved registry values. */
export function buildFooter(parts: {
  legalName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  contactUrl: string | null;
}): string {
  const lines: string[] = [];
  if (parts.legalName) lines.push(parts.legalName);
  const contact: string[] = [];
  if (parts.contactEmail) contact.push(parts.contactEmail);
  if (parts.contactPhone) contact.push(parts.contactPhone);
  if (parts.contactUrl) contact.push(parts.contactUrl);
  if (contact.length) lines.push(contact.join(' · '));
  return lines.join('\n');
}

export interface EmailAttachment {
  filename: string;
  /** Raw file bytes. */
  content: Uint8Array;
  /** MIME type, e.g. 'application/pdf'. */
  contentType: string;
}

export interface SendProviderInput {
  to: string;
  fromName: string;
  fromEmail: string;
  subject: string;
  html: string;
  /** Optional file attachments (e.g. signed-document PDFs). */
  attachments?: EmailAttachment[];
}

export interface SendProviderResult {
  ok: boolean;
  messageId: string | null;
  error?: string;
}

/**
 * Dispatch an email via the configured transport. Priority (owner decision,
 * 2026-07-01 — see GOOGLE_SMTP_SETUP.md):
 *   1. Google Workspace SMTP (GMAIL_SMTP_USER + GMAIL_SMTP_PASS) — the launch
 *      transport; the domain's SPF/DKIM already live on Google.
 *   2. Resend (RESEND_API_KEY) — dormant; revisit when multi-tenant email
 *      (other barns' own from-domains) arrives.
 * Returns { ok, messageId } — never throws on a provider failure, so callers can
 * map a failed send to a 5xx without an uncaught error crashing the function.
 */
export async function sendViaProvider(input: SendProviderInput): Promise<SendProviderResult> {
  const smtpUser = process.env.GMAIL_SMTP_USER;
  const smtpPass = process.env.GMAIL_SMTP_PASS;
  const resendKey = process.env.RESEND_API_KEY;
  if (!smtpUser && !resendKey) {
    return { ok: false, messageId: null, error: 'email provider not configured' };
  }
  if (!input.fromEmail) return { ok: false, messageId: null, error: 'no from address resolved' };
  if (smtpUser && smtpPass) return sendViaGoogleSmtp(input, smtpUser, smtpPass);
  return sendViaResend(input, resendKey as string);
}

/** Google Workspace SMTP transport (nodemailer). NOTE: Gmail rewrites the From
 * header to the authenticated account unless fromEmail is that account or one of
 * its configured aliases — see GOOGLE_SMTP_SETUP.md. */
async function sendViaGoogleSmtp(
  input: SendProviderInput,
  user: string,
  pass: string,
): Promise<SendProviderResult> {
  try {
    const { default: nodemailer } = await import('nodemailer');
    const port = Number(process.env.GMAIL_SMTP_PORT || 465);
    const transporter = nodemailer.createTransport({
      host: process.env.GMAIL_SMTP_HOST || 'smtp.gmail.com',
      port,
      secure: port === 465,
      auth: { user, pass },
    });
    const info = await transporter.sendMail({
      from: `${input.fromName} <${input.fromEmail}>`,
      to: input.to,
      subject: input.subject,
      html: input.html,
      attachments: (input.attachments ?? []).map((a) => ({
        filename: a.filename,
        content: Buffer.from(a.content),
        contentType: a.contentType,
      })),
    });
    return { ok: true, messageId: info.messageId ?? null };
  } catch (err) {
    return { ok: false, messageId: null, error: err instanceof Error ? err.message : 'smtp send failed' };
  }
}

/** Resend HTTP transport (dormant at launch; kept for multi-tenant from-domains). */
async function sendViaResend(input: SendProviderInput, key: string): Promise<SendProviderResult> {
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: `${input.fromName} <${input.fromEmail}>`,
        to: input.to,
        subject: input.subject,
        html: input.html,
        ...(input.attachments && input.attachments.length > 0
          ? {
              attachments: input.attachments.map((a) => ({
                filename: a.filename,
                content: Buffer.from(a.content).toString('base64'),
              })),
            }
          : {}),
      }),
    });
    if (!res.ok) {
      let detail = `provider responded ${res.status}`;
      try {
        const body = (await res.json()) as { message?: string };
        if (body?.message) detail = String(body.message);
      } catch {
        /* non-JSON error body */
      }
      return { ok: false, messageId: null, error: detail };
    }
    const body = (await res.json().catch(() => ({}))) as { id?: string };
    return { ok: true, messageId: body?.id ?? null };
  } catch (err) {
    return { ok: false, messageId: null, error: err instanceof Error ? err.message : 'send failed' };
  }
}

export interface TransactionalTemplate {
  subject: string;
  body: string; // inner HTML/text; footer is appended
}

/** Minimal built-in template registry. {{ORG.*}} footer is appended by the handler. */
export function renderTemplate(
  template: string,
  vars: Record<string, unknown>,
  fromName: string,
): TransactionalTemplate {
  const v = (k: string): string => (vars?.[k] == null ? '' : String(vars[k]));
  switch (template) {
    case 'signup':
      return {
        subject: `Welcome to ${fromName}`,
        body: `<p>Welcome${v('name') ? `, ${v('name')}` : ''} — your account is ready.</p>`,
      };
    case 'contract_executed':
      return {
        subject: `Your contract is executed`,
        body: `<p>Your document ${v('documentTitle') || 'contract'} has been fully executed.</p>`,
      };
    case 'receipt':
      return {
        subject: `Your receipt from ${fromName}`,
        body: `<p>We received your payment${v('amount') ? ` of ${v('amount')}` : ''}. Thank you.</p>`,
      };
    case 'dunning':
      return {
        subject: `Payment reminder`,
        body: `<p>You have an outstanding balance${v('amount') ? ` of ${v('amount')}` : ''}.</p>`,
      };
    default:
      return {
        subject: v('subject') || `A message from ${fromName}`,
        body: v('body') || `<p>${v('message')}</p>`,
      };
  }
}
