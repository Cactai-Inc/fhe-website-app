/**
 * THE THREE HOOKS EVERY INPUT SURFACE USES (TASK-FIX4).
 *
 * ⚠️ THE DISTINCTION EVERYTHING RESTS ON — persisting a draft and committing a
 * record are DIFFERENT ACTS, and this file keeps them apart on purpose:
 *
 *   `useFormDraft`   PERSISTS what was typed, so a reload, a browser-back, an
 *                    accidental close or a crash loses nothing. **It is not a
 *                    submission and it never reaches the server.**
 *   `useAutoSave`    COMMITS to the record, for the surfaces the owner ruled
 *                    auto-saving (the contact record). Debounced, and ⚠️ it keeps
 *                    the edits in the boxes and the reason on screen when a write
 *                    fails — the one instinct kept from `TASK-FIX2`'s dossier fix.
 *   `useFieldNormalizer`
 *                    normalises ON BLUR, in front of the person, BEFORE either of
 *                    the above stores anything.
 *
 * Owner: *"commits on continue/send/commit/done...etc... not a close button click,
 * no user would input data and click close and expect the form submitted."*
 * **Closing does neither of the first two. That is exactly why it is safe.**
 */
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import {
  clearDraft, getDraftOwner, isBlankSnapshot, omitKeys, readDraft, subscribeDraftOwner,
  sweepExpired, writeDraft,
} from './formDraft';
import { normalizeOnBlur, type NormalizeKind } from './normalize';

/** What the auto-save indicator renders. */
export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

/* ═══ 1 · useFormDraft — reload and browser-back are lossless ═══════════════ */

/**
 * The namespace drafts are written under, and whether the session has settled.
 * ⚠️ Nothing is restored until `resolved` — see the registry note in `formDraft.ts`.
 */
export function useDraftOwner() {
  return useSyncExternalStore(subscribeDraftOwner, getDraftOwner, getDraftOwner);
}

export interface FormDraftOptions {
  /** Override the namespace. Almost never needed — the registry supplies it. */
  owner?: string | null;
  /** Hold the restore back until the form's own initial load has finished. */
  ready?: boolean;
  /** ⚠️ Keys never written to storage — passwords, tokens, anything secret. */
  omit?: readonly string[];
  /** Debounce before persisting. */
  delay?: number;
}

export interface FormDraftHandle {
  status: SaveStatus;
  /** True once a stored draft was put back into the form. */
  restored: boolean;
  /** Write immediately rather than on the debounce (blur, submit, page hide). */
  flush: () => void;
  /** Discard the stored draft. `Clear form` calls this after resetting state. */
  clear: () => void;
}

/**
 * Keep `value` in browser storage under `formKey`, and put it back on mount.
 *
 * ⚠️ `restore` is called AT MOST ONCE per mount, and only with a draft that holds
 * something. It is held in a ref, so passing an inline arrow is fine.
 */
export function useFormDraft<T extends Record<string, unknown>>(
  formKey: string | null,
  value: T,
  restore: (draft: Partial<T>) => void,
  opts: FormDraftOptions = {},
): FormDraftHandle {
  const { owner, ready = true, omit = [], delay = 400 } = opts;
  const resolvedOwner = useDraftOwner();
  const ns = owner ?? resolvedOwner.owner;
  /* ⚠️ Wait for the session. Reading the `anon` namespace during the loading
     window and arming against it is how a signed-in person's draft would be
     looked for once, in the wrong place, and never again. */
  const canRestore = ready && (owner != null || resolvedOwner.resolved);

  const [status, setStatus] = useState<SaveStatus>('idle');
  const [restored, setRestored] = useState(false);

  const restoreRef = useRef(restore);
  restoreRef.current = restore;
  const valueRef = useRef(value);
  valueRef.current = value;
  const omitRef = useRef(omit);
  omitRef.current = omit;

  /** The namespace the restore attempt has run for. ⚠️ Nothing is written before
   *  it is set: an empty initial form would otherwise overwrite the stored draft
   *  in the gap between mount and restore, which is the draft-eats-itself bug.
   *  Keyed by namespace rather than a boolean so that anon → signed-in re-reads
   *  under the right owner instead of staying armed against the wrong one. */
  const armedFor = useRef<string | null>(null);
  /** The last snapshot actually written, so an unchanged render writes nothing. */
  const lastWritten = useRef<string | null>(null);

  useEffect(() => { sweepExpired(); }, []);

  // ── restore, once ────────────────────────────────────────────────────────
  useEffect(() => {
    if (armedFor.current === ns || !canRestore || !formKey) return;
    armedFor.current = ns;
    const draft = readDraft<Partial<T>>(ns, formKey);
    if (draft && typeof draft === 'object' && !isBlankSnapshot(draft as Record<string, unknown>)) {
      lastWritten.current = JSON.stringify(draft);
      restoreRef.current(draft);
      setRestored(true);
      setStatus('saved');
    }
  }, [ns, formKey, canRestore]);

  const write = useCallback(() => {
    if (armedFor.current !== ns || !formKey) return;
    const snapshot = omitKeys(valueRef.current, omitRef.current);
    const encoded = JSON.stringify(snapshot);
    if (encoded === lastWritten.current) return;
    if (isBlankSnapshot(snapshot as Record<string, unknown>)) {
      // Nothing typed (or everything cleared) — do not leave a husk behind.
      clearDraft(ns, formKey);
      lastWritten.current = encoded;
      setStatus('idle');
      return;
    }
    const ok = writeDraft(ns, formKey, snapshot);
    lastWritten.current = ok ? encoded : null;
    setStatus(ok ? 'saved' : 'error');
  }, [ns, formKey]);

  // ── persist, debounced ───────────────────────────────────────────────────
  const encoded = JSON.stringify(omitKeys(value, omit));
  useEffect(() => {
    if (armedFor.current !== ns || !formKey) return;
    if (encoded === lastWritten.current) return;
    setStatus('saving');
    const t = setTimeout(write, delay);
    return () => clearTimeout(t);
  }, [encoded, write, delay, formKey, ns]);

  /* ⚠️ A RELOAD RIGHT AFTER A KEYSTROKE MUST NOT FALL INSIDE THE DEBOUNCE.
     `pagehide` fires on a reload, a real navigation and a browser-back; `hidden`
     covers the mobile case where a tab is backgrounded and later discarded. Both
     write synchronously, so the last 400ms of typing survives. */
  useEffect(() => {
    const flushNow = () => write();
    const onVisibility = () => { if (document.visibilityState === 'hidden') write(); };
    window.addEventListener('pagehide', flushNow);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('pagehide', flushNow);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [write]);

  /* ⚠️ AND THE CASE `pagehide` DOES NOT COVER — CAUGHT BY THE CHROMIUM PROBE,
     WHICH IS WHY TASK-FIX4 §10 INSISTED ON ONE. A client-side route change (a
     react-router navigation, closing a modal) unmounts this hook WITHOUT any page
     lifecycle event: the document never goes away, so `pagehide` never fires and
     the pending debounce timer is simply cleared. Everything typed since the last
     tick was lost — on the exact gesture people use most.

     `probe-lossless.mjs` failed on it (`last came back as "La buzetta"` instead of
     "Olenik") and a jsdom test could not have: jsdom has no page lifecycle to
     miss. Flushing on unmount closes it. Held in a ref so this runs once, at the
     end, with the current writer. */
  const writeRef = useRef(write);
  writeRef.current = write;
  useEffect(() => () => { writeRef.current(); }, []);

  const clear = useCallback(() => {
    if (formKey) clearDraft(ns, formKey);
    lastWritten.current = null;
    setStatus('idle');
    setRestored(false);
  }, [ns, formKey]);

  return { status, restored, flush: write, clear };
}

/* ═══ 2 · useAutoSave — the record commits itself after input ═══════════════ */

export interface AutoSaveOptions<T> {
  delay?: number;
  enabled?: boolean;
  /** Return true for a value with nothing to write (an empty dirty set). */
  skip?: (value: T) => boolean;
}

export interface AutoSaveHandle {
  status: SaveStatus;
  /** ⚠️ Kept on screen with the edits still in the boxes when a write fails. */
  error: string | null;
  /** Save now — used before an affirmative action, and on unmount. */
  flush: () => Promise<void>;
}

/**
 * Auto-save `value` on a debounce. Owner: *"we should auto-save after input and
 * when normalizing input we do it after the input is normalized."*
 *
 * ⚠️ THE FAILURE HANDLING IS THE POINT. `TASK-FIX2`'s dossier fix got this right —
 * *"if the save fails the record stays open with the edits still in the boxes and
 * the reason on screen"* — and it is the one part of that fix this task keeps.
 * Nothing here ever clears the caller's state; a failed write leaves `error` set
 * and the value untouched.
 */
export function useAutoSave<T>(
  value: T,
  save: (value: T) => Promise<void>,
  opts: AutoSaveOptions<T> = {},
): AutoSaveHandle {
  const { delay = 700, enabled = true, skip } = opts;

  const [status, setStatus] = useState<SaveStatus>('idle');
  const [error, setError] = useState<string | null>(null);

  const saveRef = useRef(save);
  saveRef.current = save;
  const skipRef = useRef(skip);
  skipRef.current = skip;
  const valueRef = useRef(value);
  valueRef.current = value;
  /** Guards against two debounces overlapping into two writes of the same edit. */
  const inflight = useRef<Promise<void> | null>(null);
  const lastSaved = useRef<string | null>(null);

  const run = useCallback(async () => {
    const v = valueRef.current;
    if (skipRef.current?.(v)) return;
    const encoded = JSON.stringify(v);
    if (encoded === lastSaved.current) return;
    if (inflight.current) await inflight.current.catch(() => {});
    setStatus('saving');
    setError(null);
    const p = (async () => {
      try {
        await saveRef.current(v);
        lastSaved.current = encoded;
        setStatus('saved');
      } catch (e) {
        setStatus('error');
        setError(e instanceof Error ? e.message : String(e));
      }
    })();
    inflight.current = p;
    await p;
    inflight.current = null;
  }, []);

  const encoded = JSON.stringify(value);
  useEffect(() => {
    if (!enabled) return;
    if (skipRef.current?.(valueRef.current)) return;
    if (encoded === lastSaved.current) return;
    setStatus('saving');
    const t = setTimeout(() => { void run(); }, delay);
    return () => clearTimeout(t);
  }, [encoded, enabled, delay, run]);

  return { status, error, flush: run };
}

/* ═══ 3 · useFieldNormalizer — on blur, and it never fights a correction ════ */

/**
 * Returns a factory for `onBlur` handlers.
 *
 * ```tsx
 * const normalize = useFieldNormalizer();
 * <input value={first} onChange={(e) => setFirst(e.target.value)}
 *        onBlur={normalize('first_name', 'name', first, setFirst)} />
 * ```
 *
 * ⚠️ It remembers, per `key`, the last value it produced. If normalising what is
 * in the box now would land back on that same value, the person edited our answer
 * on purpose — `La Buzetta` corrected to `La buzetta` — and it is left alone. See
 * `normalizeOnBlur`.
 */
export function useFieldNormalizer() {
  const lastOutput = useRef(new Map<string, string>());
  return useCallback(
    (key: string, kind: NormalizeKind, current: string, apply: (next: string) => void) => () => {
      const next = normalizeOnBlur(kind, current, lastOutput.current.get(key) ?? null);
      if (next === current) return;
      lastOutput.current.set(key, next);
      apply(next);
    },
    [],
  );
}
