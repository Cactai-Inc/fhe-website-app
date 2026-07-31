import { useCallback, useEffect, useState } from 'react';
import { ChevronDown, ChevronRight, Plus, Send } from 'lucide-react';
import {
  contractNotes, createContractNote, renameContractNote, postContractNoteMessage,
  type ContractNote,
} from '../../lib/contracts';

/**
 * CONTRACT NOTES — the third subheader drawer.
 *
 * A note is a titled conversation, not a proposed edit: no resolution lifecycle,
 * nothing about the contract text changes. Each row collapses to its title bar
 * and expands to a plain chat thread between the parties.
 *
 * The title is a text input owned by the author — the default is "Note N" from
 * the DB, and renaming saves on blur so there is no separate save affordance.
 */
export function ContractNotes({ documentId }: { documentId: string }) {
  const [notes, setNotes] = useState<ContractNote[] | null>(null);
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(() => {
    contractNotes(documentId)
      .then(setNotes)
      .catch(() => { setNotes([]); setErr('Could not load notes.'); });
  }, [documentId]);
  useEffect(load, [load]);

  async function addNote() {
    setBusy(true); setErr(null);
    try {
      const id = await createContractNote(documentId);
      // A new note opens straight away — you created it to write in it.
      setOpen((p) => new Set(p).add(id));
      load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not add a note.');
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
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm text-secondary">
          Notes are a place to talk about this contract. They change nothing in it.
        </p>
        <button type="button" className="btn-secondary text-xs shrink-0" disabled={busy}
          onClick={() => void addNote()}>
          <Plus size={13} /> Add a note
        </button>
      </div>

      {err && <p role="alert" className="form-error mb-2">{err}</p>}

      {notes === null ? (
        <p className="text-sm text-muted">Loading…</p>
      ) : notes.length === 0 ? (
        <p className="text-sm text-muted">No notes yet.</p>
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
      {/* Header: click the row to collapse/expand; the title itself stays an
          editable input, so clicking into it does not toggle the row. */}
      <div className="flex items-center gap-2 px-3 py-2 bg-cream-100/40">
        <button type="button" aria-expanded={expanded} aria-label={expanded ? 'Collapse note' : 'Expand note'}
          className="text-green-800 shrink-0 focus-ring rounded" onClick={onToggle}>
          {expanded ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
        </button>
        <input
          className="flex-1 min-w-0 bg-transparent text-sm font-medium text-green-900 px-1 py-0.5 rounded focus-ring"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={() => void saveTitle()}
          onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
          aria-label="Note title"
        />
        <span className="text-[11px] text-muted shrink-0">
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
