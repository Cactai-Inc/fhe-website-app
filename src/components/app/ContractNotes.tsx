import { useCallback, useEffect, useState } from 'react';
import { ChevronDown, ChevronRight, Plus, Send } from 'lucide-react';
import {
  contractNotes, createContractNote, renameContractNote, postContractNoteMessage,
  type ContractNote,
} from '../../lib/contracts';

/**
 * CONTRACT COMMENTS — the third subheader drawer.
 *
 * A comment is a titled conversation, not a proposed edit: no resolution lifecycle,
 * nothing about the contract text changes. Each row collapses to its title bar
 * and expands to a plain chat thread between the parties.
 *
 * The title is a text input owned by the author — the default is "Comment N" from
 * the DB, and renaming saves on blur so there is no separate save affordance.
 */
export function ContractNotes({
  documentId, refreshKey = 0,
}: {
  documentId: string;
  /** Bumped by the page when a realtime event says notes changed, so the other
   *  party's message appears without a refresh. */
  refreshKey?: number;
}) {
  const [notes, setNotes] = useState<ContractNote[] | null>(null);
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(() => {
    contractNotes(documentId)
      .then(setNotes)
      .catch(() => { setNotes([]); setErr('Could not load comments.'); });
  }, [documentId]);
  useEffect(load, [load, refreshKey]);

  /* The starter note is created SERVER-SIDE by the seed_contract_note trigger on
     document insert (20260731100000). It used to be seeded here, by whichever
     browser first opened an empty drawer — with realtime on, two parties opening
     a fresh contract together would both see an empty list and both seed. The
     trigger removes the race instead of guarding against it. */

  async function addNote() {
    setBusy(true); setErr(null);
    try {
      const id = await createContractNote(documentId);
      // A new comment opens straight away — you created it to write in it.
      setOpen((p) => new Set(p).add(id));
      load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not add a comment.');
    } finally { setBusy(false); }
  }

  function toggle(id: string) {
    setOpen((p) => {
      const n = new Set(p);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  }

  return (
    <div>
      {/* Action on the LEFT in its own bordered wrapper, so it reads as a
          defined control rather than floating at the far edge of the drawer. */}
      <div className="mb-3">
        <div className="inline-flex rounded-lg border border-green-800/15 bg-cream-100/50 p-1.5 mb-2">
          <button type="button" className="btn-secondary text-xs" disabled={busy}
            onClick={() => void addNote()}>
            <Plus size={13} /> Add a comment
          </button>
        </div>
        <p className="text-sm text-secondary">
          Comments are a great way to chat about this contract. Each one is its own
          chat thread designed to keep things focused and centrally located. Use as
          many as you need and label them anything you want. You can use Requests to
          chat about specific contract sections, its layout mirrors the exact
          contract layout you see below.
        </p>
      </div>

      {err && <p role="alert" className="form-error mb-2">{err}</p>}

      {notes === null ? (
        <p className="text-sm text-muted">Loading…</p>
      ) : notes.length === 0 ? (
        <p className="text-sm text-muted">No comments yet.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {notes.map((n) => (
            <NoteRow key={n.id} note={n} expanded={open.has(n.id)}
              onToggle={() => toggle(n.id)} onChanged={load} />
          ))}
        </div>
      )}
    </div>
  );
}

function NoteRow({
  note, expanded, onToggle, onChanged,
}: {
  note: ContractNote;
  expanded: boolean;
  onToggle: () => void;
  onChanged: () => void;
}) {
  const [title, setTitle] = useState(note.title);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => { setTitle(note.title); }, [note.title]);

  async function saveTitle() {
    const t = title.trim();
    if (t === '' || t === note.title) { setTitle(note.title); return; }
    try { await renameContractNote(note.id, t); onChanged(); }
    catch { setTitle(note.title); }
  }

  async function send() {
    const body = draft.trim();
    if (body === '' || sending) return;
    setSending(true);
    try { await postContractNoteMessage(note.id, body); setDraft(''); onChanged(); }
    finally { setSending(false); }
  }

  return (
    <div className="rounded-lg border border-green-800/12 bg-white overflow-hidden">
      {/* HEADER (rebuilt 2026-07-31). Previously the title input spanned the whole
          header, leaving only a tiny chevron to open the thread — so the obvious
          gesture (click the row) did nothing, and the discoverable one was a
          14px arrow.
          Now: the title is a SELF-SIZING input that is only as wide as its text,
          so clicking the words edits the name; everything else in the header —
          including the empty space beside it — opens the thread. */}
      <div
        role="button"
        tabIndex={0}
        aria-expanded={expanded}
        onClick={onToggle}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onToggle(); } }}
        className="flex items-center gap-2 px-3 py-2 bg-cream-100/40 cursor-pointer hover:bg-cream-100/70 focus-ring"
      >
        <span className="text-green-800 shrink-0" aria-hidden="true">
          {expanded ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
        </span>
        <input
          // stopPropagation: clicking the TEXT edits it rather than toggling.
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => {
            e.stopPropagation();
            if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
          }}
          // Width tracks the content so the field never spans the header and
          // never clips the name.
          size={Math.max(8, Math.min(title.length + 1, 44))}
          className="bg-transparent text-sm font-medium text-green-900 px-1.5 py-0.5 rounded border border-transparent hover:border-green-800/15 focus:border-green-800/30 focus-ring"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={() => void saveTitle()}
          aria-label="Comment title"
        />
        <span className="text-[11px] text-muted ml-auto shrink-0">
          {note.messages.length} {note.messages.length === 1 ? 'message' : 'messages'}
        </span>
      </div>

      {expanded && (
        <div className="px-3 py-3 border-t border-green-800/10">
          {note.messages.length === 0 ? (
            <p className="text-[12.5px] text-muted mb-3">Nothing here yet — start the conversation.</p>
          ) : (
            <div className="flex flex-col gap-2 mb-3">
              {note.messages.map((m) => (
                <div key={m.id} className={`max-w-[85%] rounded-lg px-3 py-2 ${
                  m.mine ? 'ml-auto bg-green-800/10' : 'bg-cream-100/60'}`}>
                  <p className="text-[11px] text-muted mb-0.5">
                    {m.mine ? 'You' : m.author} · {new Date(m.created_at).toLocaleString()}
                  </p>
                  <p className="text-sm text-green-900 whitespace-pre-line">{m.body}</p>
                </div>
              ))}
            </div>
          )}

          <div className="flex items-end gap-2">
            <textarea rows={2} value={draft} onChange={(e) => setDraft(e.target.value)}
              placeholder="Write a message…"
              className="form-input resize-y text-sm flex-1"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); void send(); }
              }} />
            <button type="button" className="btn-primary text-xs shrink-0"
              disabled={sending || draft.trim() === ''} onClick={() => void send()}>
              <Send size={13} /> Send
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
