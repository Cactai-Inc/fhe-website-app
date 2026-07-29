import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { MessageSquarePlus, Check, CornerDownRight, Send, Lock } from 'lucide-react';
import {
  contractChangeRequestsList, contractSectionTree, upsertChangeRequest,
  submitChangeRequests, emailSubmittedChangeRequests,
  replyToChangeRequest, agreeChangeRequest, myCommentIdentity,
  type ContractChangeRequestEntry, type SectionTreeNode,
} from '../../lib/contracts';
import { ContractDrawer, DrawerRow } from './ContractDrawer';

/**
 * CHANGE REQUESTS — the single change-request surface (comments and change
 * requests merged into one threaded model backed by `contract_change_requests`).
 *
 * THE MENU is the live section tree: every section AND subsection by its REAL
 * number and title, derived from the contract itself via `contract_section_tree`
 * so it always matches the composed document. Numbering shifts automatically
 * when a section is inserted — nothing here is hardcoded.
 *
 * INTERACTION
 *  • Sections collapsed by default. The chevron on the LEFT expands to show
 *    subsections and flips up when open; clicking it again collapses.
 *  • Clicking anywhere ELSE in the row SELECTS it and opens the request input
 *    for that exact target below it. Selecting another row moves the input.
 *  • AUTOSAVE on blur (adding or removing content) — no cancel/save/send
 *    buttons. A brief transient "Saved" notice confirms each autosave.
 *
 * THREADS ("chat thread, locked on send")
 *  • Before submit the author freely edits their draft (autosaved).
 *  • "Submit for review" LOCKS the threads, notifies + emails the other party
 *    with the five highest-impact requests.
 *  • After submit either party adds entries, each stamped date + time + party.
 *  • A thread closes via the explicit Agreed action.
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

/** A submitted thread: the request, its entries, a reply box and Agreed. */
function Thread({
  root, replies, canAct, onReply, onAgree, busy,
}: {
  root: ContractChangeRequestEntry;
  replies: ContractChangeRequestEntry[];
  canAct: boolean;
  onReply: (id: string, body: string) => Promise<void>;
  onAgree: (id: string) => Promise<void>;
  busy: boolean;
}) {
  const [text, setText] = useState('');
  const closed = !!root.resolved_at;

  return (
    <div>
      <p className="text-[13px] text-green-950 whitespace-pre-line">{root.body}</p>
      <p className="text-[11px] text-muted mt-1 flex items-center gap-1.5 flex-wrap">
        <Lock size={10} aria-hidden="true" />
        {partyOf(root)} · {when(root.submitted_at ?? root.created_at)}
        {closed && <span className="text-green-700">· agreed {root.agreed_at ? when(root.agreed_at) : ''}</span>}
      </p>

      {replies.length > 0 && (
        <div className="mt-2 ml-1 pl-3 border-l-2 border-green-800/10 flex flex-col gap-2">
          {replies.map((r) => (
            <div key={r.id}>
              <CornerDownRight size={12} className="text-muted inline mr-1 align-top mt-0.5" aria-hidden="true" />
              <span className="text-[13px] text-green-950 whitespace-pre-line">{r.body}</span>
              <p className="text-[11px] text-muted mt-0.5">{partyOf(r)} · {when(r.created_at)}</p>
            </div>
          ))}
        </div>
      )}

      {!closed && canAct && (
        <div className="mt-2.5 flex flex-col gap-1.5">
          <textarea rows={2} className="form-input resize-y text-sm" placeholder="Add to this thread…"
            value={text} onChange={(e) => setText(e.target.value)} />
          <div className="flex gap-2">
            <button type="button" className="btn-secondary text-xs" disabled={busy || !text.trim()}
              onClick={() => void onReply(root.id, text.trim()).then(() => setText(''))}>
              Add entry
            </button>
            <button type="button"
              className="inline-flex items-center gap-1 rounded-lg border border-green-700/40 px-3 py-1.5 text-xs font-medium text-green-800 hover:bg-green-50 focus-ring"
              disabled={busy} onClick={() => void onAgree(root.id)}>
              <Check size={12} /> Agreed
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function ContractChangeRequests({
  documentId, canRequest, onChanged, onCount, refreshKey,
}: {
  documentId: string;
  /** False once the document is locked/executed/void — the DB refuses anyway. */
  canRequest: boolean;
  onChanged?: () => void;
  onCount?: (openThreads: number) => void;
  refreshKey?: number;
}) {
  const [tree, setTree] = useState<SectionTreeNode[] | null>(null);
  const [entries, setEntries] = useState<ContractChangeRequestEntry[] | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<string | null>(null);   // target section/clause key
  const [openThread, setOpenThread] = useState<string | null>(null);
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

  const submit = () => run(async () => {
    // The DB creates the dashboard notification (submit_change_requests →
    // contract_notify). This endpoint sends the EMAIL half of the same event,
    // listing the same five highest-impact requests. Email failure must never
    // lose the submission, so it is best-effort.
    const r = await submitChangeRequests(documentId);
    setSelected(null);
    try { await emailSubmittedChangeRequests(documentId); }
    catch { /* the in-app notification already landed */ }
    setNote(`Submitted ${r.submitted} request${r.submitted === 1 ? '' : 's'} — the other party has been notified.`);
    window.setTimeout(() => setNote(null), 5000);
  });

  const toggleExpand = (key: string) =>
    setExpanded((s) => { const n = new Set(s); if (n.has(key)) n.delete(key); else n.add(key); return n; });

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
          <button type="button" className="btn-primary text-xs ml-auto py-1.5" disabled={busy} onClick={submit}>
            <Send size={12} /> Submit for review
          </button>
        )}
      </div>

      {err && <p role="alert" className="form-error mb-2 text-xs">{err}</p>}
      {note && <p className="mb-2 text-[12px] rounded bg-green-50 text-green-900 px-3 py-1.5">{note}</p>}

      {/* OPEN THREADS — locked on send; either party may add entries. */}
      {openThreads.length > 0 && (
        <div className="mb-3">
          <p className="text-[11px] uppercase tracking-wide text-muted mb-1.5">Submitted</p>
          <ContractDrawer accent="requests" openKey={openThread}>
            {openThreads.map((r) => (
              <div key={r.id} data-row-key={r.id}>
                <DrawerRow
                  accent="requests"
                  open={openThread === r.id}
                  onToggle={() => setOpenThread((k) => (k === r.id ? null : r.id))}
                  number={r.annotation_number ? `#${r.annotation_number}` : null}
                  title={r.section_heading ?? 'The whole document'}
                  subtitle={`${partyOf(r)} · ${when(r.submitted_at ?? r.created_at)}`}
                >
                  <Thread
                    root={r}
                    replies={repliesByParent.get(r.id) ?? []}
                    canAct={canRequest}
                    busy={busy}
                    onReply={(id, body) => run(() => replyToChangeRequest(id, body).then(() => {}))}
                    onAgree={(id) => run(() => agreeChangeRequest(id), 'Thread closed — agreed.')}
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
          <ContractDrawer accent="requests" openKey={selected} empty={tree.length === 0}>
            {tree.length === 0 && (
              <p className="text-sm text-muted px-1 py-2">
                This document has no section structure to target.
              </p>
            )}
            {tree.map((s) => {
              const isOpenSection = expanded.has(s.section_key);
              const selectedHere = selected === s.section_key;
              const draft = draftFor.get(s.section_key);
              return (
                <div key={s.section_key} data-row-key={s.section_key}>
                  <div data-drawer-row className={`rounded-lg border ${selectedHere ? 'border-gold-400/60' : 'border-green-800/12'} bg-white`}>
                    <div className="flex items-stretch">
                      {/* LEFT CHEVRON — expands/collapses subsections only. */}
                      {s.subsections.length > 0 ? (
                        <button
                          type="button"
                          aria-label={isOpenSection ? `Collapse section ${s.number}` : `Expand section ${s.number}`}
                          aria-expanded={isOpenSection}
                          onClick={() => toggleExpand(s.section_key)}
                          className="shrink-0 px-2 flex items-center text-muted hover:text-green-800 focus-ring rounded-l-lg"
                        >
                          {isOpenSection
                            ? <ChevronUpIcon />
                            : <ChevronDownIcon />}
                        </button>
                      ) : <span className="w-8 shrink-0" aria-hidden="true" />}

                      {/* THE REST OF THE ROW SELECTS this target. */}
                      <button
                        type="button"
                        onClick={() => setSelected((k) => (k === s.section_key ? null : s.section_key))}
                        aria-pressed={selectedHere}
                        className="flex-1 text-left py-2.5 pr-3 focus-ring rounded-r-lg hover:bg-green-800/[0.03] flex items-baseline gap-2"
                      >
                        <span className="text-[11px] font-medium tabular-nums text-gold-ink shrink-0">{s.number}</span>
                        <span className="text-[13px] text-green-950 font-medium">{s.title}</span>
                        {draft && <span className="ml-auto text-[10px] text-gold-900 bg-gold-50 border border-gold-400/50 rounded px-1.5 py-0.5 shrink-0">draft</span>}
                      </button>
                    </div>

                    {/* the request input for THIS target, right below its row */}
                    {selectedHere && (
                      <div className="px-3 pb-3 border-t border-green-800/10">
                        <RequestInput
                          value={draft?.body ?? ''}
                          onAutosave={autosave(s.section_key)}
                          placeholder={`What should change in ${s.number}. ${s.title}?`}
                        />
                      </div>
                    )}

                    {/* SUBSECTIONS */}
                    {isOpenSection && (
                      <div className="pl-8 pr-2 pb-2 flex flex-col gap-1">
                        {s.subsections.map((sub) => {
                          const selSub = selected === sub.clause_key;
                          const subDraft = draftFor.get(sub.clause_key);
                          return (
                            <div key={sub.clause_key} data-row-key={sub.clause_key}>
                              <button
                                type="button"
                                onClick={() => setSelected((k) => (k === sub.clause_key ? null : sub.clause_key))}
                                aria-pressed={selSub}
                                className={`w-full text-left px-2.5 py-1.5 rounded border focus-ring flex items-baseline gap-2 ${
                                  selSub ? 'border-gold-400/60 bg-gold-50/40' : 'border-transparent hover:bg-green-800/[0.03]'}`}
                              >
                                <span className="text-[11px] tabular-nums text-muted shrink-0">{sub.number}</span>
                                <span className="text-[12px] text-green-950">{sub.title}</span>
                                {subDraft && <span className="ml-auto text-[10px] text-gold-900 shrink-0">draft</span>}
                              </button>
                              {selSub && (
                                <RequestInput
                                  value={subDraft?.body ?? ''}
                                  onAutosave={autosave(sub.clause_key)}
                                  placeholder={`What should change in ${sub.number} ${sub.title}?`}
                                />
                              )}
                            </div>
                          );
                        })}
                      </div>
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
