/**
 * CLIENT-PORTAL data seam (lane 1: member engagements + self-signing).
 *
 * Thin, typed wrappers over the member-facing reads and the one member write
 * (record_signature). RLS is the authoritative fence — every query here runs as
 * the logged-in member and only ever sees client-scoped rows:
 *
 *   - engagements / engagement_parties: client reads own
 *     (20260629030000, engagements_select / engagement_parties_select) inside
 *     the tenant boundary (20260629190000).
 *   - documents / signatures: owner-scoped via caller_owns_document
 *     (20260629050000).
 *   - engagement_stages: client reads stages of an engagement they own
 *     (20260630060000) — module-gated, so a mod.brokerage-off tenant simply
 *     returns no rows.
 *   - contract_templates: global read-active (20260629040000) — used only to
 *     map documents.template_id → template_key for the required-signing-set
 *     display.
 *   - record_signature (20260702000000): verifies the caller IS the party
 *     (profiles.contact_id = party row's contact_id) or tenant staff.
 *
 * This seam only shapes calls; it never widens access.
 */
import { supabase } from '../supabase';
import type {
  DocumentRow,
  Engagement,
  EngagementStage,
  PartyRole,
} from './types';

/** One person on an engagement, as the client may read them. */
export interface MyEngagementParty {
  id: string;
  engagement_id: string;
  contact_id: string;
  party_role: PartyRole;
  is_signer: boolean;
  signer_order: number | null;
}

/** getMyEngagement() rollup: the row plus its client-visible children. */
export interface MyEngagementDetail extends Engagement {
  stages: EngagementStage[];
  documents: DocumentRow[];
  parties: MyEngagementParty[];
}

/** A document the member is a signer party on, with their signed state. */
export interface SignableDocument {
  document: DocumentRow;
  /** The member's OWN party role on the document's engagement. */
  party_role: PartyRole;
  /** True once the member's (document, role) signature is sealed. */
  signed: boolean;
}

/** The caller's contact id (profiles.contact_id), or null when not linked. */
export async function myContactId(): Promise<string | null> {
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth?.user?.id;
  if (!uid) return null;
  const { data, error } = await supabase
    .from('profiles')
    .select('contact_id')
    .eq('user_id', uid)
    .maybeSingle();
  if (error) throw error;
  return (data?.contact_id as string | null) ?? null;
}

/** The member's own engagements, newest first (RLS: client reads own). */
export async function listMyEngagements(): Promise<Engagement[]> {
  const { data, error } = await supabase
    .from('engagements')
    .select('*')
    .is('deleted_at', null)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as Engagement[];
}

/** One of the member's engagements with stages, documents, and parties. */
export async function getMyEngagement(id: string): Promise<MyEngagementDetail | null> {
  const { data, error } = await supabase
    .from('engagements')
    .select('*')
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;

  const [stages, documents, parties] = await Promise.all([
    supabase
      .from('engagement_stages')
      .select('*')
      .eq('engagement_id', id)
      .is('deleted_at', null)
      .order('effective_from'),
    supabase
      .from('documents')
      .select('*')
      .eq('engagement_id', id)
      .is('deleted_at', null)
      .order('generated_at', { ascending: false }),
    supabase
      .from('engagement_parties')
      .select('id, engagement_id, contact_id, party_role, is_signer, signer_order')
      .eq('engagement_id', id)
      .order('signer_order', { ascending: true, nullsFirst: false }),
  ]);
  if (stages.error) throw stages.error;
  if (documents.error) throw documents.error;
  if (parties.error) throw parties.error;

  return {
    ...(data as Engagement),
    stages: (stages.data ?? []) as EngagementStage[],
    documents: (documents.data ?? []) as DocumentRow[],
    parties: (parties.data ?? []) as MyEngagementParty[],
  };
}

/** contract_templates id → template_key (global read-active rows). */
export async function templateKeysById(): Promise<Record<string, string>> {
  const { data, error } = await supabase
    .from('contract_templates')
    .select('id, template_key');
  if (error) throw error;
  return Object.fromEntries(
    ((data ?? []) as { id: string; template_key: string }[]).map((t) => [t.id, t.template_key]),
  );
}

/**
 * Documents the member personally signs: every non-void document on an
 * engagement where THEY are a signer party, tagged with their party role and
 * whether their signature is already sealed. Derived from engagement_parties
 * (the roster source — signatures rows only exist AFTER a sign).
 */
export async function listMySignableDocuments(): Promise<SignableDocument[]> {
  const contactId = await myContactId();
  if (!contactId) return [];

  const parties = await supabase
    .from('engagement_parties')
    .select('engagement_id, party_role')
    .eq('contact_id', contactId)
    .eq('is_signer', true);
  if (parties.error) throw parties.error;
  const roleByEngagement = new Map(
    ((parties.data ?? []) as { engagement_id: string; party_role: PartyRole }[]).map((p) => [
      p.engagement_id,
      p.party_role,
    ]),
  );
  if (roleByEngagement.size === 0) return [];

  const docs = await supabase
    .from('documents')
    .select('*')
    .in('engagement_id', [...roleByEngagement.keys()])
    .is('deleted_at', null)
    .neq('status', 'VOID')
    .order('generated_at', { ascending: false });
  if (docs.error) throw docs.error;
  const documents = (docs.data ?? []) as DocumentRow[];
  if (documents.length === 0) return [];

  const sigs = await supabase
    .from('signatures')
    .select('document_id, party_role, signed_at')
    .in('document_id', documents.map((d) => d.id))
    .eq('signer_contact_id', contactId)
    .is('deleted_at', null);
  if (sigs.error) throw sigs.error;
  const sealed = new Set(
    ((sigs.data ?? []) as { document_id: string; party_role: string; signed_at: string | null }[])
      .filter((s) => s.signed_at)
      .map((s) => `${s.document_id}:${s.party_role}`),
  );

  return documents.map((document) => {
    const party_role = roleByEngagement.get(document.engagement_id) as PartyRole;
    return { document, party_role, signed: sealed.has(`${document.id}:${party_role}`) };
  });
}

/**
 * Member self-sign: seal MY typed signature on a document where I am the
 * party. Server-side `record_signature` (20260702000000) verifies the caller's
 * contact matches the party row — a member can never sign for someone else.
 *
 * `esignConsent` (20260703110000): the UI's "sign electronically" checkbox —
 * when true the server logs a separate esign_consents row alongside the
 * signature. Defaults false so pre-checkbox callers keep their behavior.
 * ip/user-agent are captured server-side from the request headers.
 */
export async function signMyDocument(
  documentId: string,
  partyRole: PartyRole,
  typedName: string,
  esignConsent = false,
): Promise<void> {
  const { error } = await supabase.rpc('record_signature', {
    p_document_id: documentId,
    p_party_role: partyRole,
    p_typed_name: typedName,
    p_ip: null,
    p_esign_consent: esignConsent,
  });
  if (error) throw error;
}
