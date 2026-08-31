/**
 * PERSISTED FORM DRAFTS — the storage seam that makes reload and browser-back
 * lossless (CR-84 §4 · TASK-FIX4 §6).
 *
 * Owner: *"i was using the word refresh to indicate a reload, i fail to see the
 * distinction between them nor a difference."* He is right, and it is one
 * requirement with one fix: **a reload and a browser-back destroy React state
 * identically, so the draft has to live somewhere that outlives the page.**
 *
 * ══ THE SEAM, AND WHY THIS ONE ═════════════════════════════════════════════
 *
 * **Chosen: `localStorage`, namespaced per signed-in user.**
 *
 * The alternative considered was a server-side `form_drafts` table keyed on
 * `user_id`. It was rejected on three counts, and the first is decisive:
 *
 *  1. ⚠️ **The forms where losing input hurts most have no user to key on.** The
 *     `/sign/*` front door is anonymous — a stranger typing their name, phone and
 *     address has no `auth.uid()` until after they submit. A server-side draft
 *     store cannot hold their work at all, which is exactly the case CR-83 named
 *     ("a back button so data entered isnt lost").
 *  2. A draft is written on a debounce after every input. Server-side that is a
 *     network round-trip per pause, on a form the person is still filling in — and
 *     it fails offline, which is when a draft is worth the most.
 *  3. It would be a new table, new RLS, and a new expiry job, for state that is
 *     definitionally per-device.
 *
 * **THE TRADE-OFF, NAMED: a shared machine keeps the bytes on disk.** A draft
 * written by one person survives their sign-out on that browser. Four mitigations,
 * all implemented here:
 *
 *  - **Namespaced by user id**, so a second person signing in on the same browser
 *    never SEES the first person's draft — they read a different key.
 *  - **`clearOwnerDrafts()` runs on sign-out**, so the common case leaves nothing.
 *  - **A 7-day TTL**, enforced on read and swept on write, so an abandoned draft
 *    on a shared machine expires rather than lingering.
 *  - **Secrets are never written.** `useFormDraft`'s `omit` list is how a password
 *    or a confirmation token stays out of storage, and `LoginSecurityCard` uses it.
 *
 * A person on a genuinely shared, untrusted machine should not be typing their
 * medical contacts into it either; this is the same exposure the browser's own
 * form autofill already has, and it is the price of the anonymous case working.
 */

const PREFIX = 'fhe.draft.';
const VERSION = 1;
/** Drafts older than this are dropped on read and swept on write. */
export const DRAFT_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/** The namespace for a person with no session — the `/sign/*` front door. */
export const ANON_OWNER = 'anon';

type Envelope = { v: number; at: number; data: unknown };

function storage(): Storage | null {
  try {
    // Safari in private mode throws on access, not on use.
    const s = window.localStorage;
    const probe = `${PREFIX}__probe`;
    s.setItem(probe, '1');
    s.removeItem(probe);
    return s;
  } catch {
    return null;
  }
}

export function draftKey(owner: string, formKey: string): string {
  return `${PREFIX}${owner}:${formKey}`;
}

/** Read a draft, or null when absent, expired, foreign-versioned or corrupt. */
export function readDraft<T>(owner: string, formKey: string): T | null {
  const s = storage();
  if (!s) return null;
  const raw = s.getItem(draftKey(owner, formKey));
  if (!raw) return null;
  try {
    const env = JSON.parse(raw) as Envelope;
    if (env.v !== VERSION) { s.removeItem(draftKey(owner, formKey)); return null; }
    if (Date.now() - env.at > DRAFT_TTL_MS) { s.removeItem(draftKey(owner, formKey)); return null; }
    return env.data as T;
  } catch {
    s.removeItem(draftKey(owner, formKey));
    return null;
  }
}

/**
 * Persist a draft. Returns false when storage refused it (private mode, quota) so
 * the caller can show "not saved" rather than claiming a save that never landed —
 * ⚠️ an auto-save indicator that lies is worse than none at all.
 */
export function writeDraft(owner: string, formKey: string, data: unknown): boolean {
  const s = storage();
  if (!s) return false;
  const env: Envelope = { v: VERSION, at: Date.now(), data };
  try {
    s.setItem(draftKey(owner, formKey), JSON.stringify(env));
    return true;
  } catch {
    // Quota. Sweep the expired ones and try once more before giving up.
    sweepExpired();
    try {
      s.setItem(draftKey(owner, formKey), JSON.stringify(env));
      return true;
    } catch {
      return false;
    }
  }
}

export function clearDraft(owner: string, formKey: string): void {
  storage()?.removeItem(draftKey(owner, formKey));
}

/** Every draft belonging to one person. Called on sign-out. */
export function clearOwnerDrafts(owner: string): void {
  const s = storage();
  if (!s) return;
  const head = `${PREFIX}${owner}:`;
  for (const k of Object.keys(s)) if (k.startsWith(head)) s.removeItem(k);
}

/** Drop every draft past its TTL, whoever it belongs to. */
export function sweepExpired(): void {
  const s = storage();
  if (!s) return;
  const now = Date.now();
  for (const k of Object.keys(s)) {
    if (!k.startsWith(PREFIX)) continue;
    try {
      const env = JSON.parse(s.getItem(k) ?? '') as Envelope;
      if (env.v !== VERSION || now - env.at > DRAFT_TTL_MS) s.removeItem(k);
    } catch {
      s.removeItem(k);
    }
  }
}

/** Drop the listed keys from a snapshot before it is persisted. */
export function omitKeys<T extends Record<string, unknown>>(value: T, omit: readonly string[]): Partial<T> {
  if (omit.length === 0) return value;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value)) if (!omit.includes(k)) out[k] = v;
  return out as Partial<T>;
}

/** True when a snapshot holds nothing worth restoring — all blank, all false, all empty. */
export function isBlankSnapshot(value: Record<string, unknown>): boolean {
  return Object.values(value).every(
    (v) =>
      v === '' || v === null || v === undefined || v === false ||
      (Array.isArray(v) && v.length === 0),
  );
}

/* ── WHO THE DRAFTS BELONG TO ───────────────────────────────────────────────
   ⚠️ A MODULE REGISTRY, NOT A REACT CONTEXT, AND DELIBERATELY. Every input
   surface needs the namespace, and threading `useAuth()` through 20 dialogs
   would (a) couple each one to the auth context — which throws outside its
   provider, so a component test could no longer render a dialog on its own —
   and (b) be 20 chances to forget. `AuthProvider` publishes here once; every
   `useFormDraft` reads it.

   `resolved` matters: on the first paint the session is still loading, so the
   owner is not yet KNOWN to be anonymous. Restoring during that window would
   read the `anon` namespace, find nothing, and then never look again — a
   signed-in person would silently lose their draft. `useFormDraft` waits. */

type OwnerState = { owner: string; resolved: boolean };

let ownerState: OwnerState = { owner: ANON_OWNER, resolved: false };
const ownerListeners = new Set<(s: OwnerState) => void>();

export function getDraftOwner(): OwnerState {
  return ownerState;
}

/** Called by `AuthProvider` once the session settles, and on every change. */
export function setDraftOwner(userId: string | null): void {
  const next: OwnerState = { owner: userId ?? ANON_OWNER, resolved: true };
  if (next.owner === ownerState.owner && ownerState.resolved) return;
  ownerState = next;
  for (const fn of ownerListeners) fn(next);
}

export function subscribeDraftOwner(fn: (s: OwnerState) => void): () => void {
  ownerListeners.add(fn);
  return () => { ownerListeners.delete(fn); };
}

/** Test seam — put the registry back to its pre-boot state. */
export function resetDraftOwner(): void {
  ownerState = { owner: ANON_OWNER, resolved: false };
}
