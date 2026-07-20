import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  Send, ArrowLeft, PenSquare, Search, Trash2, Pencil, Check, X, MoreVertical, ExternalLink,
} from 'lucide-react';
import {
  fetchConversation, sendDirectMessage, subscribeToMyDirectMessages,
  fetchMemberDirectory, dmListConversations, dmMarkConversationRead,
  dmEditMessage, dmDeleteMessage, dmHideConversation, joinConversationPresence,
} from '../../lib/community';
import { useDocumentTitle } from '../../lib/hooks';
import { useAuth } from '../../contexts/AuthContext';
import type { DirectMessage, DmConversation, MemberDirectoryEntry } from '../../lib/community-types';

/**
 * MESSAGES — a modern two-pane messenger. Left: conversation list (avatar, name,
 * last-message preview, timestamp, unread) + a "New message" member picker. Right:
 * the thread with a person header (→ profile), read/edited/sent metadata, per-message
 * edit + delete, presence + "typing…", and delete-conversation. Realtime throughout.
 */

function initials(name: string): string {
  const p = name.trim().split(/\s+/);
  return ((p[0]?.[0] ?? '') + (p[1]?.[0] ?? '')).toUpperCase() || 'M';
}
function timeLabel(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  const days = Math.floor((now.getTime() - d.getTime()) / 86400000);
  if (days < 7) return d.toLocaleDateString(undefined, { weekday: 'short' });
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}
function fullStamp(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}
function dayKey(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
}

function Avatar({ name, url, size = 40 }: { name: string; url?: string | null; size?: number }) {
  if (url) return <img src={url} alt="" style={{ width: size, height: size }} className="rounded-full object-cover shrink-0" />;
  return (
    <span style={{ width: size, height: size }}
      className="rounded-full bg-green-100 text-green-800 grid place-items-center font-serif font-semibold shrink-0"
    >{initials(name)}</span>
  );
}

// ── New-message member picker ───────────────────────────────────────────────
function NewMessageModal({ members, onPick, onClose }: {
  members: MemberDirectoryEntry[]; onPick: (id: string) => void; onClose: () => void;
}) {
  const [q, setQ] = useState('');
  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const list = members.filter((m) => (m.display_name || m.first_name || '').trim());
    if (!needle) return list.slice(0, 50);
    return list.filter((m) => (m.display_name || m.first_name || '').toLowerCase().includes(needle)).slice(0, 50);
  }, [members, q]);

  return (
    <div className="fixed inset-0 z-50 bg-green-900/40 flex items-start justify-center p-4 pt-[10vh]" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl max-h-[70vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-green-800/10">
          <h2 className="font-serif text-lg text-green-900">New message</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="text-green-800/60 hover:text-green-900 text-xl leading-none">×</button>
        </div>
        <div className="px-4 py-3 border-b border-green-800/10">
          <div className="flex items-center gap-2 px-3 py-2 bg-cream-100 rounded-lg">
            <Search size={15} className="text-muted shrink-0" />
            <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search members…"
              className="bg-transparent flex-1 text-sm outline-none" aria-label="Search members" />
          </div>
        </div>
        <div className="overflow-y-auto p-2">
          {filtered.length === 0 ? (
            <p className="text-sm text-muted text-center py-6">No members found.</p>
          ) : filtered.map((m) => {
            const name = m.display_name || m.first_name || 'Member';
            return (
              <button key={m.user_id} type="button" onClick={() => onPick(m.user_id)}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-cream-100 text-left focus-ring">
                <Avatar name={name} url={m.avatar_url} size={36} />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-green-900 truncate">{name}</p>
                  {m.riding_level && <p className="text-[11px] text-muted truncate">{m.riding_level}</p>}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── One message bubble (with edit/delete for my own) ────────────────────────
function MessageBubble({ m, mine, onEdit, onDelete }: {
  m: DirectMessage; mine: boolean; onEdit: (id: string, body: string) => Promise<void>; onDelete: (id: string) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(m.body);
  const [menu, setMenu] = useState(false);
  const deleted = !!m.deleted_at;

  async function saveEdit() {
    const body = draft.trim();
    if (!body || body === m.body) { setEditing(false); return; }
    await onEdit(m.id, body);
    setEditing(false);
  }

  return (
    <div className={`group max-w-[80%] ${mine ? 'self-end items-end' : 'self-start items-start'} flex flex-col`}>
      <div className="flex items-center gap-1.5">
        {mine && !deleted && !editing && (
          <div className="relative opacity-0 group-hover:opacity-100 transition-opacity">
            <button type="button" onClick={() => setMenu((v) => !v)} aria-label="Message actions"
              className="p-1 text-muted hover:text-green-800 focus-ring rounded"><MoreVertical size={15} /></button>
            {menu && (
              <div className="absolute right-0 top-6 z-10 bg-white border border-green-800/10 rounded-lg shadow-md py-1 w-32" onMouseLeave={() => setMenu(false)}>
                <button type="button" onClick={() => { setDraft(m.body); setEditing(true); setMenu(false); }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs text-secondary hover:bg-cream-100"><Pencil size={13} /> Edit</button>
                <button type="button" onClick={() => { onDelete(m.id); setMenu(false); }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs text-red-600 hover:bg-red-50"><Trash2 size={13} /> Delete</button>
              </div>
            )}
          </div>
        )}
        {editing ? (
          <div className="flex items-center gap-1.5">
            <input value={draft} onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') setEditing(false); }}
              className="form-input text-sm py-1.5" autoFocus aria-label="Edit message" />
            <button type="button" onClick={saveEdit} aria-label="Save" className="p-1.5 text-green-700 hover:bg-green-50 rounded focus-ring"><Check size={15} /></button>
            <button type="button" onClick={() => setEditing(false)} aria-label="Cancel" className="p-1.5 text-muted hover:bg-cream-100 rounded focus-ring"><X size={15} /></button>
          </div>
        ) : (
          <div className={`inline-block px-3.5 py-2 text-sm font-sans rounded-2xl ${
            deleted ? 'bg-cream-100 text-muted italic'
              : mine ? 'bg-green-800 text-white' : 'bg-cream-100 text-green-900'}`}>
            {deleted ? 'This message was deleted' : m.body}
          </div>
        )}
      </div>
      {/* metadata: sent · edited · read */}
      {!editing && (
        <p className="text-[10px] text-muted mt-0.5 px-1">
          {fullStamp(m.created_at)}
          {m.edited_at && !deleted && <> · edited {fullStamp(m.edited_at)}</>}
          {mine && m.read_at && !deleted && <> · Read {fullStamp(m.read_at)}</>}
        </p>
      )}
    </div>
  );
}

export default function Messages() {
  useDocumentTitle('Messages');
  const { userId: otherId } = useParams<{ userId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [directory, setDirectory] = useState<Record<string, MemberDirectoryEntry>>({});
  const [members, setMembers] = useState<MemberDirectoryEntry[]>([]);
  const [conversations, setConversations] = useState<DmConversation[]>([]);
  const [messages, setMessages] = useState<DirectMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [picking, setPicking] = useState(false);
  const [otherOnline, setOtherOnline] = useState(false);
  const [otherTyping, setOtherTyping] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const presenceRef = useRef<ReturnType<typeof joinConversationPresence> | null>(null);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refreshConversations = useCallback(() => {
    dmListConversations().then(setConversations).catch(() => {});
  }, []);

  // Directory (names/avatars) + conversation list
  useEffect(() => {
    fetchMemberDirectory().then((d) => {
      setMembers(d);
      setDirectory(Object.fromEntries(d.map((m) => [m.user_id, m])));
    }).catch(() => {});
    refreshConversations();
  }, [refreshConversations]);

  // Load active conversation + mark it read
  const loadConversation = useCallback(() => {
    if (!otherId) { setMessages([]); return; }
    fetchConversation(otherId).then((msgs) => {
      setMessages(msgs);
      dmMarkConversationRead(otherId).then(refreshConversations).catch(() => {});
    }).catch(() => setMessages([]));
  }, [otherId, refreshConversations]);
  useEffect(loadConversation, [loadConversation]);

  // Realtime inbound DMs
  useEffect(() => {
    if (!user?.id) return;
    const unsub = subscribeToMyDirectMessages(user.id, (m) => {
      if (m.sender_id === otherId) {
        setMessages((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]));
        dmMarkConversationRead(otherId).catch(() => {});
      }
      refreshConversations();
    });
    return unsub;
  }, [user?.id, otherId, refreshConversations]);

  // Presence + typing for the open conversation
  useEffect(() => {
    setOtherOnline(false); setOtherTyping(false);
    if (!user?.id || !otherId) return;
    const p = joinConversationPresence(user.id, otherId, {
      onPresence: setOtherOnline,
      onTyping: setOtherTyping,
    });
    presenceRef.current = p;
    return () => { p.unsubscribe(); presenceRef.current = null; };
  }, [user?.id, otherId]);

  useEffect(() => { endRef.current?.scrollIntoView({ block: 'end' }); }, [messages, otherTyping]);

  function onDraftChange(v: string) {
    setDraft(v);
    presenceRef.current?.setTyping(true);
    if (typingTimer.current) clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => presenceRef.current?.setTyping(false), 1500);
  }

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!draft.trim() || !otherId) return;
    setSending(true);
    const body = draft.trim();
    setDraft('');
    presenceRef.current?.setTyping(false);
    try {
      await sendDirectMessage(otherId, body);
      loadConversation();
      refreshConversations();
    } catch {
      setDraft(body);
    } finally {
      setSending(false);
    }
  }

  async function editMessage(id: string, body: string) {
    await dmEditMessage(id, body);
    setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, body, edited_at: new Date().toISOString() } : m)));
    refreshConversations();
  }
  async function deleteMessage(id: string) {
    await dmDeleteMessage(id);
    setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, deleted_at: new Date().toISOString(), body: '' } : m)));
    refreshConversations();
  }
  async function deleteConversation(uid: string) {
    if (!confirm('Delete this conversation? It will be removed from your list.')) return;
    await dmHideConversation(uid);
    if (otherId === uid) navigate('/app/messages');
    refreshConversations();
  }

  const nameOf = (uid: string) => {
    const m = directory[uid];
    return m?.display_name || m?.first_name || 'Member';
  };
  const avatarOf = (uid: string) => directory[uid]?.avatar_url ?? null;

  function startWith(id: string) {
    setPicking(false);
    navigate(`/app/messages/${id}`);
  }

  // Group messages by day for date separators
  const grouped = useMemo(() => {
    const out: { day: string; items: DirectMessage[] }[] = [];
    for (const m of messages) {
      const day = dayKey(m.created_at);
      const last = out[out.length - 1];
      if (last && last.day === day) last.items.push(m);
      else out.push({ day, items: [m] });
    }
    return out;
  }, [messages]);

  return (
    <div className="w-full max-w-6xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-serif text-green-800 text-3xl font-semibold">Messages</h1>
        <button type="button" onClick={() => setPicking(true)} className="btn-primary text-sm">
          <PenSquare size={15} /> New message
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-0 h-[72vh] bg-white border border-green-800/10 rounded-2xl overflow-hidden">
        {/* Conversation list */}
        <aside className={`md:col-span-1 border-r border-green-800/10 overflow-y-auto ${otherId ? 'hidden md:block' : ''}`}>
          {conversations.length === 0 ? (
            <div className="p-6 text-center">
              <p className="text-sm text-muted mb-3">No conversations yet.</p>
              <button type="button" onClick={() => setPicking(true)} className="btn-secondary text-sm">
                <PenSquare size={14} /> Start one
              </button>
            </div>
          ) : (
            <div className="flex flex-col">
              {conversations.map((c) => {
                const name = c.display_name || c.first_name || 'Member';
                const active = c.user_id === otherId;
                return (
                  <div key={c.user_id} className={`group relative flex items-center gap-3 px-3 py-3 cursor-pointer border-b border-green-800/[0.06] ${
                    active ? 'bg-green-800/[0.06]' : 'hover:bg-cream-100'}`}
                    onClick={() => navigate(`/app/messages/${c.user_id}`)}>
                    <Avatar name={name} url={c.avatar_url} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className={`text-sm truncate ${c.unread > 0 ? 'font-semibold text-green-900' : 'font-medium text-green-900'}`}>{name}</p>
                        <span className="text-[10px] text-muted shrink-0">{timeLabel(c.last_at)}</span>
                      </div>
                      <p className={`text-xs truncate ${c.unread > 0 ? 'text-green-900 font-medium' : 'text-muted'}`}>
                        {c.last_body === null ? <span className="italic">Message deleted</span>
                          : <>{c.last_mine && 'You: '}{c.last_body}</>}
                      </p>
                    </div>
                    {c.unread > 0 && (
                      <span className="min-w-[1.15rem] h-[1.15rem] px-1 grid place-items-center bg-gold-600 text-white text-[10.5px] font-semibold rounded-full">{c.unread > 9 ? '9+' : c.unread}</span>
                    )}
                    <button type="button" onClick={(e) => { e.stopPropagation(); deleteConversation(c.user_id); }}
                      aria-label="Delete conversation"
                      className="opacity-0 group-hover:opacity-100 transition-opacity p-1 text-muted hover:text-red-600 focus-ring rounded">
                      <Trash2 size={14} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </aside>

        {/* Active conversation */}
        <section className={`md:col-span-2 flex flex-col min-h-0 ${otherId ? '' : 'hidden md:flex'}`}>
          {!otherId ? (
            <div className="m-auto text-center p-6">
              <p className="text-sm text-muted">Choose a conversation, or start a new one.</p>
            </div>
          ) : (
            <>
              <div className="border-b border-green-800/10 px-4 py-3 flex items-center gap-3">
                <button type="button" onClick={() => navigate('/app/messages')} className="md:hidden text-secondary focus-ring" aria-label="Back">
                  <ArrowLeft size={18} />
                </button>
                <Avatar name={nameOf(otherId)} url={avatarOf(otherId)} size={38} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-serif text-green-900 truncate">{nameOf(otherId)}</p>
                    {otherOnline && <span className="w-2 h-2 rounded-full bg-green-500 shrink-0" title="Online" />}
                  </div>
                  <p className="text-[11px] text-muted">
                    {otherTyping ? 'typing…' : otherOnline ? 'Online' : 'Offline'}
                  </p>
                </div>
                <Link to={`/app/members/${otherId}`} className="text-xs text-green-700 hover:text-green-900 inline-flex items-center gap-1 focus-ring rounded px-2 py-1">
                  Profile <ExternalLink size={13} />
                </Link>
              </div>

              <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-2">
                {messages.length === 0 ? (
                  <p className="text-sm text-muted m-auto">Say hello.</p>
                ) : grouped.map((g) => (
                  <div key={g.day} className="flex flex-col gap-2">
                    <div className="flex items-center justify-center my-2">
                      <span className="text-[10px] uppercase tracking-wide text-muted bg-cream-100 px-3 py-1 rounded-full">{g.day}</span>
                    </div>
                    {g.items.map((m) => (
                      <MessageBubble key={m.id} m={m} mine={m.sender_id === user?.id} onEdit={editMessage} onDelete={deleteMessage} />
                    ))}
                  </div>
                ))}
                {otherTyping && (
                  <div className="self-start inline-flex items-center gap-1 px-3.5 py-2 bg-cream-100 rounded-2xl">
                    <span className="w-1.5 h-1.5 bg-muted rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-1.5 h-1.5 bg-muted rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-1.5 h-1.5 bg-muted rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                )}
                <div ref={endRef} />
              </div>

              <form onSubmit={send} className="border-t border-green-800/10 p-3 flex gap-2">
                <input value={draft} onChange={(e) => onDraftChange(e.target.value)} className="form-input flex-1"
                  placeholder="Write a message…" aria-label="Message" />
                <button type="submit" disabled={sending || !draft.trim()} className="btn-primary px-5" aria-label="Send">
                  <Send size={16} aria-hidden="true" />
                </button>
              </form>
            </>
          )}
        </section>
      </div>

      {picking && <NewMessageModal members={members} onPick={startWith} onClose={() => setPicking(false)} />}
    </div>
  );
}
