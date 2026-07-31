import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { MessageSquarePlus, Check, CornerDownRight, Send, Eye, RotateCcw, Pencil } from 'lucide-react';
import {
  contractChangeRequestsList, contractSectionTree, upsertChangeRequest,
  submitChangeRequests, emailSubmittedChangeRequests,
  replyToChangeRequest, myCommentIdentity,
  markChangeRequestSeen, editChangeRequestEntry,
  resolveChangeRequestThread, reopenChangeRequest,
  type ContractChangeRequestEntry, type SectionTreeNode,
} from '../../lib/contracts';
import { ContractDrawer, DrawerRow } from './ContractDrawer';
import { NotifyConfirmModal } from './NotifyConfirmModal';

/**
 * CHANGE REQUESTS — the single change-request surface (comments and change
 * requests merged into one threaded model backed by `contract_change_requests`).
 *
 * THE MENU is the live section tree: every section AND subsection by its REAL
 * number and title, derived from the contract itself via `contract_section_tree`
 * so it always matches the composed document. Numbering shifts automatically
 * when a section is inserted — nothing here is hardcoded.
 *
 * INTERACTION (owner-final — ONE CLICK, ONE RESULT)
 *  • Every row is collapsed by default and is ONE control. Clicking anywhere on
 *    a section row — chevron included, it is not a separate tab stop — OPENS
 *    that row; clicking again closes it. There is no separate "select" gesture.
 *  • An OPEN SECTION shows, in order: (a) the request input for the WHOLE
 *    section, then (b) its subsection rows, each collapsed. The subsection list
 *    is NEVER gated on the section's input having content.
 *  • A SUBSECTION row opens the same way and reveals its own input. Opening one
 *    does not collapse its parent.
 *  • OPEN STATE IS ONE PERSISTENT SET of row keys covering sections AND
 *    subsections, so closing a parent leaves its children exactly as they were
 *    and reopening it restores them.
 *  • AUTOSAVE on blur (adding or removing content) — no cancel/save/send
 *    buttons. A brief transient "Saved" notice confirms each autosave.
 *
 * THREADS — THE NOTIFY MODEL (this REPLACES the old "locked on send" behaviour)
 *  • "Notify" numbers the drafts and notifies + emails the other party with the
 *    five highest-impact requests. NOTIFYING FREEZES NOTHING.
 *  • A request stays editable by its author until the OTHER PARTY SEES IT. Seen
 *    is recorded when that party CLICKS THE ROW to expand its contents — never
 *    on collapsed render, and never for the author viewing their own entry.
 *  • Each entry carries an author stamp (date + time + party, as of its LAST
 *    EDIT) and, once viewed, a "Seen" stamp (date + time + party).
 *  • Resolving is a SOFT close: either party can Reopen, which returns the
 *    request to the open set and blocks locking again.
 */

function when(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
    });
  } catch { return ''; }
}

function partyOf(e: { author_label: string | null; author_role: string | null }): string {
  const role = e.author_role
    ? e.author_role.charAt(0) + e.author_role.slice(1).toLowerCase()
    : null;
  return role ? `${e.author_label ?? 'A party'} (${role})` : (e.author_label ?? 'A party');
}

/** The autosaving request input for one target. No buttons — blur commits. */
function RequestInput({
  value, onAutosave, disabled, placeholder,
}: {
  value: string;
  onAutosave: (body: string) => Promise<void>;
  disabled?: boolean;
  placeholder: string;
}) {
  const [text, setText] = useState(value);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const committed = useRef(value);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => { setText(value); committed.current = value; }, [value]);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  // AUTOSAVE on blur — commits an addition OR a removal.
  const commit = async () => {
    const next = text.trim();
    if (next === committed.current.trim()) return;
    setBusy(true); setErr(null);
    try {
      await onAutosave(next);
      committed.current = next;
      setSaved(true);
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setSaved(false), 1800);   // transient notice
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'That did not save.');
      setText(committed.current);
    } finally { setBusy(false); }
  };

  return (
    <div className="mt-2">
      <textarea
        rows={3}
        className="form-input resize-y text-sm w-full"
        placeholder={placeholder}
        value={text}
        disabled={disabled || busy}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => void commit()}
      />
      <div className="h-4 mt-1">
        {err
          ? <p role="alert" className="text-[11px] text-red-700">{err}</p>
          : busy
            ? <p className="text-[11px] text-muted">Saving…</p>
            : saved
              ? <p className="text-[11px] text-green-700">Saved</p>
              : <p className="text-[11px] text-muted">Saves automatically when you click away.</p>}
      </div>
    </div>
  );
}

/** THE UNSEEN DOT — a SHAPE, not a colour alone, so the signal survives for
 *  colour-blind and greyscale viewers; the aria-label carries it for screen
 *  readers. Sized and toned to stay legible against the LIGHTENED (has-content)
 *  row it always sits on. */
function UnseenDot({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span
      role="status"
      aria-label={`${count} unseen change request${count === 1 ? '' : 's'}`}
      className="shrink-0 inline-block w-2 h-2 rounded-full bg-gold-600 ring-2 ring-gold-200"
    />
  );
}

/** The AUTHOR stamp (date + time + party, as of the entry's LAST EDIT) and, once
 *  a non-author has viewed it, the SEEN stamp beside it. */
function Stamps({ e }: { e: ContractChangeRequestEntry }) {
  const seen = e.seen_by ?? [];
  return (
    <p className="text-[11px] text-muted mt-1 flex items-center gap-x-2 gap-y-0.5 flex-wrap">
      <span>
        {partyOf(e)} · {when(e.edited_at ?? e.submitted_at ?? e.created_at)}
        {e.edited_at && <span className="text-muted"> (edited)</span>}
      </span>
      {seen.length > 0 ? (
        seen.map((s) => (
          <span key={s.contact_id} className="inline-flex items-center gap-1 text-green-700">
            <Eye size={10} aria-hidden="true" />
            Seen by {s.label ?? 'the other party'}
            {s.role ? ` (${s.role.charAt(0)}${s.role.slice(1).toLowerCase()})` : ''} · {when(s.seen_at)}
          </span>
        ))
      ) : (
        <span className="inline-flex items-center gap-1 text-gold-900">
          <Pencil size={10} aria-hidden="true" /> Not yet seen — you can still edit
        </span>
      )}
    </p>
  );
}

/** An entry body that its author may still edit, because nobody else has seen it. */
function EditableBody({
  entry, onSave, busy,
}: {
  entry: ContractChangeRequestEntry;
  onSave: (id: string, body: string) => Promise<void>;
  busy: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(entry.body);
  useEffect(() => { setText(entry.body); }, [entry.body]);

  // can_edit comes from the DB: author AND not yet seen. Same rule the Notify
  // modal's copy promises — both read the one server-side predicate.
  if (!entry.can_edit) {
    return <p className="text-[13px] text-green-950 whitespace-pre-line">{entry.body}</p>;
  }

  if (!editing) {
    return (
      <p className="text-[13px] text-green-950 whitespace-pre-line">
        {entry.body}{' '}
        <button type="button" onClick={() => setEditing(true)}
          className="text-[11px] text-gold-900 underline underline-offset-2 hover:text-gold-800 focus-ring rounded">
          Edit
        </button>
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-1.5">
      <textarea rows={3} className="form-input resize-y text-sm" value={text}
        onChange={(e) => setText(e.target.value)} />
      <div className="flex gap-2">
        <button type="button" className="btn-primary text-xs" disabled={busy || !text.trim()}
          onClick={() => void onSave(entry.id, text.trim()).then(() => setEditing(false))}>
          Save
        </button>
        <button type="button" className="btn-secondary text-xs" disabled={busy}
          onClick={() => { setText(entry.body); setEditing(false); }}>
          Cancel
        </button>
      </div>
    </div>
  );
}

/** A notified thread: the request, its entries, a reply box, and the SOFT close
 *  (Resolve / Reopen — either party, always reversible). */
function Thread({
  root, replies, canAct, onReply, onResolve, onReopen, onEdit, busy,
}: {
  root: ContractChangeRequestEntry;
  replies: ContractChangeRequestEntry[];
  canAct: boolean;
  onReply: (id: string, body: string) => Promise<void>;
  onResolve: (id: string) => Promise<void>;
  onReopen: (id: string) => Promise<void>;
  onEdit: (id: string, body: string) => Promise<void>;
  busy: boolean;
}) {
  const [text, setText] = useState('');
  const closed = !!root.resolved_at;

  return (
    <div>
      <EditableBody entry={root} onSave={onEdit} busy={busy} />
      <Stamps e={root} />
      {closed && (
        <p className="text-[11px] text-green-700 mt-0.5">
          Resolved {root.agreed_at ? when(root.agreed_at) : ''} — either party can reopen it.
        </p>
      )}
      {!closed && root.reopened_at && (
        <p className="text-[11px] text-gold-900 mt-0.5">Reopened {when(root.reopened_at)}</p>
      )}

      {replies.length > 0 && (
        <div className="mt-2 ml-1 pl-3 border-l-2 border-green-800/10 flex flex-col gap-2">
          {replies.map((r) => (
            <div key={r.id}>
              <CornerDownRight size={12} className="text-muted inline mr-1 align-top mt-0.5" aria-hidden="true" />
              <span className="text-[13px] text-green-950 whitespace-pre-line">
                <EditableBody entry={r} onSave={onEdit} busy={busy} />
              </span>
              <Stamps e={r} />
            </div>
          ))}
        </div>
      )}

      {canAct && (
        <div className="mt-2.5 flex flex-col gap-1.5">
          {!closed && (
            <textarea rows={2} className="form-input resize-y text-sm" placeholder="Add to this thread…"
              value={text} onChange={(e) => setText(e.target.value)} />
          )}
          <div className="flex gap-2 flex-wrap">
            {!closed && (
              <>
                <button type="button" className="btn-secondary text-xs" disabled={busy || !text.trim()}
                  onClick={() => void onReply(root.id, text.trim()).then(() => setText(''))}>
                  Add entry
                </button>
                <button type="button"
                  className="inline-flex items-center gap-1 rounded-lg border border-green-700/40 px-3 py-1.5 text-xs font-medium text-green-800 hover:bg-green-50 focus-ring"
                  disabled={busy} onClick={() => void onResolve(root.id)}>
                  <Check size={12} /> Resolve
                </button>
              </>
            )}
            {closed && (
              <button type="button"
                className="inline-flex items-center gap-1 rounded-lg border border-gold-400/60 px-3 py-1.5 text-xs font-medium text-gold-900 hover:bg-gold-50 focus-ring"
                disabled={busy} onClick={() => void onReopen(root.id)}>
                <RotateCcw size={12} /> Reopen
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function ContractChangeRequests({
  documentId, canRequest, onChanged, onCount, refreshKey, inDrawer = false,
}: {
  documentId: string;
  /** False once the document is locked/executed/void — the DB refuses anyway. */
  canRequest: boolean;
  onChanged?: () => void;
  onCount?: (openThreads: number) => void;
  refreshKey?: number;
  /** Rendered inside the contract subheader's drawer, which already scrolls. */
  inDrawer?: boolean;
}) {
  const [tree, setTree] = useState<SectionTreeNode[] | null>(null);
  const [entries, setEntries] = useState<ContractChangeRequestEntry[] | null>(null);
  /* ONE OPEN-STATE STRUCTURE for the whole tree. It holds BOTH section keys and
     subsection clause keys, and a row's membership is independent of its
     parent's: closing a section removes only the section's own key, so its
     children keep theirs and come back exactly as they were on reopen. */
  const [open, setOpen] = useState<Set<string>>(new Set());
  /* The row the user opened LAST — the drawer's scroll/measure cue only, never a
     styling or gating input. Cleared when that row is closed again. */
  const [lastOpened, setLastOpened] = useState<string | null>(null);
  const [openThread, setOpenThread] = useState<string | null>(null);
  const [notifyModal, setNotifyModal] = useState(false);
  const [myContactId, setMyContactId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const load = useCallback(() => {
    contractChangeRequestsList(documentId).then(setEntries).catch(() => setEntries([]));
  }, [documentId]);
  useEffect(() => { load(); }, [load, refreshKey]);
  useEffect(() => { contractSectionTree(documentId).then(setTree).catch(() => setTree([])); }, [documentId]);
  useEffect(() => { myCommentIdentity(documentId).then(setMyContactId).catch(() => setMyContactId(null)); }, [documentId]);

  const { roots, repliesByParent, draftFor } = useMemo(() => {
    const all = entries ?? [];
    const roots = all.filter((e) => !e.parent_request_id);
    const repliesByParent = new Map<string, ContractChangeRequestEntry[]>();
    for (const e of all) {
      if (e.parent_request_id) {
        const list = repliesByParent.get(e.parent_request_id) ?? [];
        list.push(e);
        repliesByParent.set(e.parent_request_id, list);
      }
    }
    // my unsubmitted draft, keyed by target section
    const draftFor = new Map<string, ContractChangeRequestEntry>();
    for (const r of roots) {
      if (!r.submitted_at && r.author_contact_id && r.author_contact_id === myContactId) {
        draftFor.set(r.target_section ?? '', r);
      }
    }
    return { roots, repliesByParent, draftFor };
  }, [entries, myContactId]);

  /* ── THE TWO ROW SIGNALS (orthogonal — neither may mask the other) ────────
     1. HAS-CONTENT SHADING (persistent, "where is there activity"): every row
        renders slightly DARKER than before by default; a row that CONTAINS one
        or more change requests LIGHTENS to stand out from the empty rows around
        it. Independent of who has read what.
     2. UNSEEN DOT (transient, per-viewer, "what's new"): a row holding a change
        request THIS viewer has not seen shows a dot. Seen is per-viewer state
        read off `seen_by`; a viewer NEVER sees their OWN authored entry as
        unseen. Expanding the row fires mark_change_request_seen, the reload
        rewrites seen_by, and the dot clears for that viewer only.
     3. OPEN STATE (border-gold-400/60) is the THIRD signal. It used to be a
        separate "selected" concept; now that one click both opens a row and
        makes it the active input target, open IS selected, so the gold ring is
        driven straight off the open set — same styling, one fewer variable. */

  /** Requests targeting one exact section/clause key. */
  const requestsByTarget = useMemo(() => {
    const m = new Map<string, ContractChangeRequestEntry[]>();
    for (const r of roots) {
      const k = r.target_section ?? '';
      const list = m.get(k) ?? [];
      list.push(r);
      m.set(k, list);
    }
    return m;
  }, [roots]);

  /** Unseen BY THIS VIEWER: notified, not mine, and no seen_by row for me.
   *  A draft (never notified) is not "unseen" — nobody was told about it yet. */
  const isUnseenByMe = useCallback((e: ContractChangeRequestEntry): boolean => {
    if (!e.submitted_at) return false;
    if (e.author_contact_id && e.author_contact_id === myContactId) return false; // never my own
    return !(e.seen_by ?? []).some((s) => s.contact_id === myContactId);
  }, [myContactId]);

  /** Roll a target's own requests up with its subsections', so a COLLAPSED
   *  parent still reports what its children hold. */
  const signalsFor = useCallback((keys: string[]) => {
    let has = false;
    let unseen = 0;
    for (const k of keys) {
      for (const r of requestsByTarget.get(k) ?? []) {
        has = true;
        const thread = [r, ...(repliesByParent.get(r.id) ?? [])];
        unseen += thread.filter(isUnseenByMe).length;
      }
    }
    return { has, unseen };
  }, [requestsByTarget, repliesByParent, isUnseenByMe]);

  // every notified thread, resolved or not — resolution is a SOFT close, so a
  // resolved thread stays visible and reopenable rather than disappearing.
  const notifiedThreads = roots.filter((r) => r.submitted_at);
  // only UNRESOLVED ones block locking (contract_lock_blockers counts these)
  const openThreads = roots.filter((r) => r.submitted_at && !r.resolved_at);
  const myDrafts = roots.filter((r) => !r.submitted_at && r.author_contact_id === myContactId);

  useEffect(() => { onCount?.(openThreads.length); }, [openThreads.length, onCount]);

  async function run(fn: () => Promise<void>, msg?: string) {
    setBusy(true); setErr(null);
    try { await fn(); load(); onChanged?.(); if (msg) { setNote(msg); window.setTimeout(() => setNote(null), 3500); } }
    catch (e) { setErr(e instanceof Error ? e.message : 'That action failed.'); }
    finally { setBusy(false); }
  }

  const autosave = (sectionKey: string) => async (body: string) => {
    await upsertChangeRequest(documentId, sectionKey || null, body);
    load(); onChanged?.();
  };

  const notify = () => run(async () => {
    // The DB creates the dashboard notification (submit_change_requests →
    // contract_notify). This endpoint sends the EMAIL half of the same event,
    // listing the same five highest-impact requests. Email failure must never
    // lose the notification, so it is best-effort.
    const r = await submitChangeRequests(documentId);
    // The drafts just became notified threads; close the tree back to its
    // resting state so the reader's eye goes to the Notified list above.
    setOpen(new Set());
    setLastOpened(null);
    setNotifyModal(false);
    try { await emailSubmittedChangeRequests(documentId); }
    catch { /* the in-app notification already landed */ }
    setNote(
      `Notified — ${r.submitted} request${r.submitted === 1 ? '' : 's'} sent. `
      + 'You can still edit each one until the other party sees it.');
    window.setTimeout(() => setNote(null), 6000);
  });

  /* THE SEEN TRIGGER — the reader CLICKED THIS ROW to expand its contents.
     That click IS the genuine view: no scroll observation, no dwell time, and
     nothing at all recorded while the row sits collapsed in the list. The DB
     skips entries this caller authored, so opening your own request never
     freezes it. Failures are swallowed — a seen stamp must never block reading. */
  const openThreadRow = (root: ContractChangeRequestEntry) => {
    const next = openThread === root.id ? null : root.id;
    setOpenThread(next);
    if (next === null) return;
    const ids = [root.id, ...(repliesByParent.get(root.id) ?? []).map((r) => r.id)]
      .filter((id) => {
        const e = (entries ?? []).find((x) => x.id === id);
        return e && e.author_contact_id !== myContactId && !e.is_frozen;
      });
    if (ids.length === 0) return;
    markChangeRequestSeen(ids).then(() => load()).catch(() => { /* never block reading */ });
  };

  /* THE ONE ROW GESTURE — sections and subsections alike. It flips exactly ONE
     key: a parent's close never touches its children's keys, which is what makes
     reopening restore them. `lastOpened` follows the reveal so the drawer scrolls
     to it; closing a row that was the last-opened one clears the cue. */
  const toggleRow = (key: string) =>
    setOpen((s) => {
      const n = new Set(s);
      if (n.has(key)) { n.delete(key); setLastOpened((k) => (k === key ? null : k)); }
      else { n.add(key); setLastOpened(key); }
      return n;
    });

  /* Opening a TREE row. `bodyKeys` are the targets whose CONTENTS this click
     actually puts on screen.
     SEEN stays honest: a tree row renders only the viewer's OWN draft input for
     that target — a counterparty's entries live in the Notified drawer above and
     are revealed there, by openThreadRow. So there is normally nothing here for
     this viewer to have "seen", and we only call through when a genuine reveal
     turns up an entry that is notified, authored by someone else, and not
     already seen — the same three predicates openThreadRow applies. Closing a
     row reveals nothing and never marks. */
  const revealRow = (key: string, bodyKeys: string[]) => {
    const wasOpen = open.has(key);
    toggleRow(key);
    if (wasOpen) return;                       // a close is not a reveal
    const ids: string[] = [];
    for (const k of bodyKeys) {
      for (const r of requestsByTarget.get(k) ?? []) {
        for (const e of [r, ...(repliesByParent.get(r.id) ?? [])]) {
          if (isUnseenByMe(e) && !e.is_frozen) ids.push(e.id);
        }
      }
    }
    if (ids.length === 0) return;
    markChangeRequestSeen(ids).then(() => load()).catch(() => { /* never block reading */ });
  };

  if (tree === null || entries === null) {
    return <p className="text-sm text-muted">Loading…</p>;
  }

  return (
    <section>
      <div className="flex items-center gap-2 mb-2">
        <MessageSquarePlus size={15} className="text-gold-ink" aria-hidden="true" />
        <h3 className="font-serif text-green-800 text-sm">Change requests</h3>
        <span className="text-[11px] text-muted">
          {openThreads.length > 0 ? `${openThreads.length} open` : myDrafts.length > 0 ? `${myDrafts.length} draft` : 'none yet'}
        </span>
        {myDrafts.length > 0 && canRequest && (
          <button type="button" className="btn-primary text-xs ml-auto py-1.5" disabled={busy}
            onClick={() => setNotifyModal(true)}>
            <Send size={12} /> Notify
          </button>
        )}
      </div>

      {/* The confirmation modal builds its copy from pending_notify_summary —
          the same DB function whose predicates the write paths enforce. */}
      {notifyModal && (
        <NotifyConfirmModal
          documentId={documentId}
          busy={busy}
          onCancel={() => setNotifyModal(false)}
          onConfirm={notify}
        />
      )}

      {err && <p role="alert" className="form-error mb-2 text-xs">{err}</p>}
      {note && <p className="mb-2 text-[12px] rounded bg-green-50 text-green-900 px-3 py-1.5">{note}</p>}

      {/* NOTIFIED THREADS — open and resolved. Clicking a row expands it, and
          THAT CLICK is what records "seen" for the non-author. Resolved threads
          stay listed so either party can reopen them. */}
      {notifiedThreads.length > 0 && (
        <div className="mb-3">
          <p className="text-[11px] uppercase tracking-wide text-muted mb-1.5">Notified</p>
          <ContractDrawer accent="requests" openKey={openThread} unbounded={inDrawer}>
            {notifiedThreads.map((r) => (
              <div key={r.id} data-row-key={r.id}>
                <DrawerRow
                  accent="requests"
                  open={openThread === r.id}
                  onToggle={() => openThreadRow(r)}
                  number={r.annotation_number ? `#${r.annotation_number}` : null}
                  title={r.section_heading ?? 'The whole document'}
                  subtitle={`${partyOf(r)} · ${when(r.edited_at ?? r.submitted_at ?? r.created_at)}`
                    + (r.resolved_at ? ' · resolved' : '')}
                >
                  <Thread
                    root={r}
                    replies={repliesByParent.get(r.id) ?? []}
                    canAct={canRequest}
                    busy={busy}
                    onReply={(id, body) => run(() => replyToChangeRequest(id, body).then(() => {}))}
                    onResolve={(id) => run(() => resolveChangeRequestThread(id).then(() => {}),
                      'Resolved — either party can reopen it.')}
                    onReopen={(id) => run(() => reopenChangeRequest(id).then(() => {}),
                      'Reopened — this request is open again.')}
                    onEdit={(id, body) => run(() => editChangeRequestEntry(id, body).then(() => {}), 'Saved.')}
                  />
                </DrawerRow>
              </div>
            ))}
          </ContractDrawer>
        </div>
      )}

      {/* THE SECTION TREE — real numbers + titles, derived live. */}
      {canRequest ? (
        <>
          <p className="text-[11px] uppercase tracking-wide text-muted mb-1.5">
            Choose what to request a change to
          </p>
          <ContractDrawer accent="requests" openKey={lastOpened} empty={tree.length === 0} unbounded={inDrawer}>
            {tree.length === 0 && (
              <p className="text-sm text-muted px-1 py-2">
                This document has no section structure to target.
              </p>
            )}
            {tree.map((s) => {
              const isOpenSection = open.has(s.section_key);
              const draft = draftFor.get(s.section_key);
              // ROLLUP: the section's own key PLUS every subsection key, so a
              // collapsed parent still shows what its children hold.
              const sig = signalsFor([s.section_key, ...s.subsections.map((x) => x.clause_key)]);
              return (
                <div key={s.section_key} data-row-key={s.section_key}>
                  <div
                    data-drawer-row
                    data-has-requests={sig.has || undefined}
                    data-unseen={sig.unseen > 0 || undefined}
                  >
                    {/* SECTION HEADER — a disclosure and nothing more (owner spec
                        2026-07-31): no input of its own. Styled after the Change-
                        history group header: the number, the title, and a count,
                        with no tile chrome, so the numbered ITEM rows beneath are
                        what stand out. */}
                    <button
                      type="button"
                      onClick={() => revealRow(s.section_key, [s.section_key])}
                      aria-expanded={isOpenSection}
                      className="w-full text-left py-1 pr-2 focus-ring rounded flex items-baseline gap-2"
                    >
                      <span className="shrink-0 w-4 self-center flex justify-center text-muted" aria-hidden="true">
                        {isOpenSection ? <ChevronUpIcon /> : <ChevronDownIcon />}
                      </span>
                      <span className="text-[12px] tabular-nums font-semibold text-gold-ink shrink-0">{s.number}.</span>
                      <span className="text-[12px] text-green-900 font-medium">{s.title}</span>
                      <span className="text-[11px] text-muted">
                        {s.subsections.length} item{s.subsections.length === 1 ? '' : 's'}
                      </span>
                      <UnseenDot count={sig.unseen} />
                      {draft && <span className="ml-auto text-[10px] text-gold-900 shrink-0">draft</span>}
                    </button>

                    {/* OPEN SECTION — its numbered items, and nothing else.
                        A section header is a DISCLOSURE ONLY (owner spec
                        2026-07-31): it carries no input of its own. Requests
                        belong to the numbered items (1.1, 2.4, 12.12 …), which is
                        where a reader looks for them. The old section-level box
                        sat above a collapsed 1.1 and was the worst case when a
                        section held a single item — an empty field with the real
                        target hidden beneath it.
                        The items are NOT indented: mirroring the contract's own
                        outline bought nothing here and only narrowed the input. */}
                    {isOpenSection && (
                      <>
                        {s.subsections.length > 0 && (
                          <div className="px-2 pb-2 pt-1.5 border-t border-green-800/10 flex flex-col gap-1.5">
                            {s.subsections.map((sub) => {
                              const isOpenSub = open.has(sub.clause_key);
                              const subDraft = draftFor.get(sub.clause_key);
                              const subSig = signalsFor([sub.clause_key]);
                              return (
                                <div key={sub.clause_key} data-row-key={sub.clause_key}
                                  data-has-requests={subSig.has || undefined}
                                  data-unseen={subSig.unseen > 0 || undefined}>
                                  {/* Restyled 2026-07-31 to the Change-history row
                                      design (owner preference): numbered chip,
                                      title, chevron, content beneath. Same
                                      primitive, so the two drawers now read as one
                                      system rather than two dialects. */}
                                  <DrawerRow
                                    accent="requests"
                                    open={isOpenSub}
                                    onToggle={() => revealRow(sub.clause_key, [sub.clause_key])}
                                    number={sub.number}
                                    title={sub.title}
                                    subtitle={
                                      subSig.has || subDraft ? (
                                        <span className="inline-flex items-center gap-2">
                                          {subSig.has && <span>{subSig.unseen > 0 ? `${subSig.unseen} unseen` : 'has requests'}</span>}
                                          {subDraft && <span className="text-gold-900">draft saved</span>}
                                        </span>
                                      ) : undefined
                                    }
                                  >
                                    <RequestInput
                                      value={subDraft?.body ?? ''}
                                      onAutosave={autosave(sub.clause_key)}
                                      placeholder={`What should change in ${sub.number} ${sub.title}?`}
                                    />
                                  </DrawerRow>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </ContractDrawer>
        </>
      ) : (
        <p className="text-sm text-muted">
          This document is no longer open to change requests.
        </p>
      )}
    </section>
  );
}

/* Local chevrons keep the tree row markup flat (the shared DrawerRow renders its
   own chevron on the right; the tree needs one on the LEFT). */
function ChevronDownIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}
function ChevronUpIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m18 15-6-6-6 6" />
    </svg>
  );
}

export default ContractChangeRequests;
