import { supabase } from './supabase';
import { assertWrote } from './writeGuard';

/**
 * FILES — the upload spine (TASK-UPLOADS, owner ruling 2026-08-11).
 *
 * *"Files are not ours, they belong to whoever uploads them. so they stay
 * attached to that person. and in our case, the company."*
 *
 * A FILE IS NOT A DOCUMENT. `documents` are FHE's records — generated from
 * tenant templates, signable, evidentiary. A file is the uploader's property;
 * FHE stores it and surfaces it with permission. Nothing here ever writes to
 * `documents`, and nothing here is signable.
 *
 * OWNERSHIP IS A COLUMN, NOT THE UPLOADER. `owner_kind`/`owner_contact_id` say
 * whose file it is; `uploaded_by_user_id` only records who clicked upload. Staff
 * scanning a member's Coggins leaves the MEMBER as owner, and a staff member
 * leaving takes none of the company's files with them.
 *
 * SURFACING IS A REFERENCE, NEVER A COPY. One `files` row; `file_links` rows put
 * it on a deal, a horse, a lesson. There is never a second copy to drift.
 *
 * Storage is the pre-existing PRIVATE `facility-files` bucket — no thirteenth
 * bucket — under a path grammar the RLS policies parse and a table CHECK
 * enforces:
 *
 *     {org_id}/{owner_kind}/{owner_id}/{file_id}-{safe_filename}
 *
 * Reads are short-lived signed URLs. No bucket is ever flipped public.
 */

export const FILES_BUCKET = 'facility-files';

/** 25MB, matching the feed's ceiling — a phone-camera scan of a certificate is
 *  ~2MB, and anything past this reads as a hung spinner rather than an upload. */
export const MAX_FILE_BYTES = 25 * 1024 * 1024;

/** How long a download link stays good. Short by design: the URL is a bearer
 *  token for a private object, so it should not outlive the click. */
const SIGNED_URL_SECONDS = 600;

export type FileOwnerKind = 'contact' | 'org';

/** The surfaces a file can be shown on. Mirrors the `file_links.subject_type`
 *  CHECK — adding a surface is one line there and one here. */
export type FileSubjectType =
  | 'contact' | 'account' | 'deal' | 'contract' | 'document'
  | 'horse' | 'stable' | 'lesson' | 'offering' | 'purchase'
  | 'booking' | 'lead' | 'directory_listing' | 'org';

export interface FileRow {
  id: string;
  org_id: string;
  owner_kind: FileOwnerKind;
  owner_contact_id: string | null;
  bucket_id: string;
  storage_path: string;
  filename: string;
  mime_type: string | null;
  byte_size: number | null;
  title: string | null;
  description: string | null;
  uploaded_by_user_id: string | null;
  created_at: string;
  deleted_at: string | null;
}

export interface FileLinkRow {
  id: string;
  file_id: string;
  subject_type: FileSubjectType;
  subject_id: string;
  created_at: string;
  deleted_at: string | null;
}

/** Strip a filename down to something safe to put in a storage key, keeping it
 *  recognisable. The ORIGINAL name is preserved verbatim in `files.filename` —
 *  this only shapes the object key. */
function safeName(name: string): string {
  const cleaned = name.normalize('NFKD').replace(/[^\w.-]+/g, '-').replace(/-+/g, '-');
  return cleaned.replace(/^-|-$/g, '').slice(-80) || 'file';
}

function guardSize(file: File) {
  if (file.size > MAX_FILE_BYTES) {
    throw new Error(
      `That file is ${(file.size / 1048576).toFixed(0)}MB — please keep uploads under 25MB.`,
    );
  }
}

/** Upload the bytes, then record the row. Both are needed for a file to exist;
 *  if the row fails (RLS, a lost race) the orphaned object is removed so a
 *  half-upload never leaves bytes nobody can see or account for. */
async function putFile(
  args: {
    orgId: string;
    ownerKind: FileOwnerKind;
    ownerId: string;              // contact id, or the org id for org-owned
    ownerContactId: string | null;
    file: File;
    title?: string | null;
    description?: string | null;
  },
): Promise<FileRow> {
  guardSize(args.file);
  const id = crypto.randomUUID();
  const path = `${args.orgId}/${args.ownerKind}/${args.ownerId}/${id}-${safeName(args.file.name)}`;

  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error('Upload timed out — check your connection and try again.')), 60_000));
  const upload = supabase.storage.from(FILES_BUCKET).upload(path, args.file, {
    contentType: args.file.type || 'application/octet-stream',
    upsert: false,
  });
  const { error: upErr } = await Promise.race([upload, timeout]);
  if (upErr) throw upErr;

  try {
    const rows = assertWrote(
      await supabase.from('files').insert({
        id,
        org_id: args.orgId,
        owner_kind: args.ownerKind,
        owner_contact_id: args.ownerContactId,
        bucket_id: FILES_BUCKET,
        storage_path: path,
        filename: args.file.name,
        mime_type: args.file.type || null,
        byte_size: args.file.size,
        title: args.title ?? null,
        description: args.description ?? null,
      }).select(),
      'The file record',
    );
    return rows[0] as FileRow;
  } catch (err) {
    await supabase.storage.from(FILES_BUCKET).remove([path]);
    throw err;
  }
}

// ─── The signed-in member's own files ────────────────────────────────────────

/** Who the caller is, as the two ids the path grammar needs. */
async function myOrgAndContact(): Promise<{ orgId: string; contactId: string }> {
  const [{ data: contactId }, { data: auth }] = await Promise.all([
    supabase.rpc('current_contact_id'),
    supabase.auth.getUser(),
  ]);
  if (!auth.user) throw new Error('Not signed in.');
  if (!contactId) throw new Error('Your account is not linked to a contact record yet.');
  const { data: profile, error } = await supabase
    .from('profiles').select('org_id').eq('user_id', auth.user.id).maybeSingle();
  if (error) throw error;
  if (!profile?.org_id) throw new Error('Your account is not attached to a stable.');
  return { orgId: profile.org_id as string, contactId: contactId as string };
}

/** The caller's own files. RLS does the filtering — `files_owner_rw` matches on
 *  owner_contact_id, so this cannot return anyone else's even if asked. The
 *  owner_kind filter keeps published company material off the personal list. */
export async function listMyFiles(): Promise<FileRow[]> {
  const { data, error } = await supabase
    .from('files')
    .select('*')
    .eq('owner_kind', 'contact')
    .is('deleted_at', null)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as FileRow[];
}

/** One file row plus its resolved owner name, for the staff-wide Files ledger. */
export interface OrgFileRow extends FileRow {
  owner_name: string | null;
}

/** Staff: every file in the tenant, contact-owned or company-owned.
 *  `files_staff_rw` (RLS) already admits any staff member to every row in
 *  their org — no separate RPC needed, unlike the member-scoped reads above
 *  which rely on `files_owner_rw` matching the caller's own contact. */
export async function listOrgFiles(): Promise<OrgFileRow[]> {
  const { data, error } = await supabase
    .from('files')
    .select('*, contacts(first_name, last_name)')
    .is('deleted_at', null)
    .order('created_at', { ascending: false });
  if (error) throw error;
  type Row = FileRow & { contacts: { first_name: string | null; last_name: string | null } | null };
  return ((data ?? []) as Row[]).map((r) => {
    const { contacts, ...rest } = r;
    const name = contacts ? [contacts.first_name, contacts.last_name].filter(Boolean).join(' ') : '';
    return { ...rest, owner_name: r.owner_kind === 'org' ? 'The company' : (name || null) };
  });
}

/** Upload a file the CALLER owns. */
export async function uploadMyFile(file: File, title?: string): Promise<FileRow> {
  const { orgId, contactId } = await myOrgAndContact();
  return putFile({
    orgId, ownerKind: 'contact', ownerId: contactId, ownerContactId: contactId, file,
    title: title?.trim() || null,
  });
}

/** A short-lived link to read a private object. Returns null rather than
 *  throwing when the object is gone or the caller may not read it — the row
 *  still renders, without a download. */
export async function fileDownloadUrl(f: Pick<FileRow, 'bucket_id' | 'storage_path'>): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from(f.bucket_id || FILES_BUCKET)
    .createSignedUrl(f.storage_path, SIGNED_URL_SECONDS);
  if (error) return null;
  return data.signedUrl;
}

/**
 * Remove a file the caller owns.
 *
 * The bytes go — it is the owner's property and "remove" has to mean removed —
 * but the row is SOFT-deleted, so the record that a file was here, and any
 * surfacing history on other records, survives as a tombstone.
 *
 * This is NOT account deletion. Per the owner ruling, what happens to a
 * person's files when their account is deleted is an open question, and nothing
 * in this task cascade-deletes them.
 */
export async function removeMyFile(f: FileRow): Promise<void> {
  assertWrote(
    await supabase.from('files')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', f.id).is('deleted_at', null).select(),
    'Removing the file',
  );
  await supabase.storage.from(f.bucket_id || FILES_BUCKET).remove([f.storage_path]);
}

/** Where one of the caller's files is currently surfaced. Reads through
 *  `file_links_owner_read`, which resolves to "links to files I can see." */
export async function listFileLinks(fileId: string): Promise<FileLinkRow[]> {
  const { data, error } = await supabase
    .from('file_links')
    .select('id, file_id, subject_type, subject_id, created_at, deleted_at')
    .eq('file_id', fileId)
    .is('deleted_at', null);
  if (error) throw error;
  return (data ?? []) as FileLinkRow[];
}

// ─── Company files: the tenant's own, not any staff account's ────────────────

/**
 * Upload a file owned by the ORG and catalogue it in `content_resources`.
 *
 * This is the owner's *"appropriately centralized around the tenant not any
 * individual staff account"* — `owner_kind='org'` with no owning contact, and
 * `uploaded_by_user_id` recording only who clicked. `published` on the
 * content_resources row is what members' visibility turns on; the storage
 * policy reads the same flag, so unpublishing takes the bytes out of reach too.
 */
export async function uploadCompanyResource(args: {
  orgId: string;
  file: File;
  title: string;
  description?: string;
  published: boolean;
}): Promise<FileRow> {
  const row = await putFile({
    orgId: args.orgId,
    ownerKind: 'org',
    ownerId: args.orgId,
    ownerContactId: null,
    file: args.file,
    title: args.title,
    description: args.description ?? null,
  });
  try {
    assertWrote(
      await supabase.from('content_resources').insert({
        org_id: args.orgId,
        title: args.title,
        description: args.description ?? null,
        kind: 'file',
        storage_path: row.storage_path,
        file_id: row.id,
        published: args.published,
      }).select(),
      'The company resource',
    );
  } catch (err) {
    // Roll the file back rather than leave a company file with no catalogue
    // entry — an org file nothing points at is unreachable by design (members
    // read org files only through a published content_resources row).
    await supabase.from('files').update({ deleted_at: new Date().toISOString() }).eq('id', row.id);
    await supabase.storage.from(FILES_BUCKET).remove([row.storage_path]);
    throw err;
  }
  return row;
}

// ─── Lesson media (TASK-LESSONPLAN §3) ───────────────────────────────────────

/**
 * A photo or video from a lesson.
 *
 * OWNERSHIP is the ORG, not Claire's account and not the rider's: the barn took
 * it, and a staff member leaving must not take the record of a lesson with them
 * (the same reasoning `uploadCompanyResource` already applies to company
 * material). The RIDER can still see it — m4 adds one narrow policy for
 * "an org file live-linked to a booking that is mine", which is the only new
 * visibility this task introduces.
 *
 * SURFACING is a `file_links` row with subject_type 'booking' — a reference, not
 * a copy. That subject already existed; nothing about the files spine changes.
 */
export async function uploadLessonMedia(
  bookingId: string,
  file: File,
  title?: string,
): Promise<FileRow> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error('Not signed in.');
  const { data: profile, error: pErr } = await supabase
    .from('profiles').select('org_id').eq('user_id', auth.user.id).maybeSingle();
  if (pErr) throw pErr;
  const orgId = profile?.org_id as string | undefined;
  if (!orgId) throw new Error('Your account is not attached to a stable.');

  const row = await putFile({
    orgId, ownerKind: 'org', ownerId: orgId, ownerContactId: null, file,
    title: title?.trim() || null,
  });

  try {
    assertWrote(
      await supabase.from('file_links')
        .insert({ org_id: orgId, file_id: row.id, subject_type: 'booking', subject_id: bookingId })
        .select(),
      'Attaching the photo to the lesson',
    );
  } catch (err) {
    // An unlinked file on a lesson nobody can reach is worse than no file:
    // undo the upload rather than leave bytes with no subject.
    await supabase.from('files').delete().eq('id', row.id);
    await supabase.storage.from(FILES_BUCKET).remove([row.storage_path]);
    throw err;
  }
  return row;
}

/** One entry of a lesson's media. Server-side RLS decides who may list it —
 *  staff in the org, or the rider whose lesson it is. */
export interface LessonMediaRow {
  file_id: string;
  bucket_id: string;
  storage_path: string;
  filename: string;
  mime_type: string | null;
  title: string | null;
  byte_size: number | null;
  created_at: string;
}

export async function listLessonMedia(bookingId: string): Promise<LessonMediaRow[]> {
  const { data, error } = await supabase.rpc('lesson_media', { p_booking_id: bookingId });
  if (error) throw error;
  return (data ?? []) as LessonMediaRow[];
}

/**
 * D27's ONE scrub exception — content that should never have been captured,
 * destroyed for liability. Not a delete button: it takes a reason, it is logged,
 * and it is the only path in this app that genuinely destroys a record's
 * content. Everything else retires behind a flag (D11, D15, D16).
 *
 * For media the RPC removes the rows and hands back the storage path; the object
 * itself is removed here, the same way every other file path in this app removes
 * an object (Supabase Storage has no SQL-side delete).
 */
export async function scrubLessonContent(args: {
  kind: 'media' | 'answer' | 'objective_note';
  subjectId: string;
  reason: string;
  key?: string;
}): Promise<{ kind: string; scrubbed: number }> {
  const { data, error } = await supabase.rpc('scrub_lesson_content', {
    p_kind: args.kind,
    p_subject: args.subjectId,
    p_reason: args.reason,
    p_key: args.key ?? null,
  });
  if (error) throw error;
  const result = data as { kind: string; scrubbed: number; storage_path?: string; bucket_id?: string };
  if (result.storage_path) {
    await supabase.storage.from(result.bucket_id || FILES_BUCKET).remove([result.storage_path]);
  }
  return result;
}
