import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Send, ArrowLeft } from 'lucide-react';
import {
  fetchConversation, sendDirectMessage, subscribeToMyDirectMessages,
  listMyConversations, fetchMemberDirectory,
} from '../../lib/community';
import { useDocumentTitle } from '../../lib/hooks';
import { useAuth } from '../../contexts/AuthContext';
import type { DirectMessage, MemberDirectoryEntry } from '../../lib/community-types';

export default function Messages() {
  useDocumentTitle('Messages');
  const { userId: otherId } = useParams<{ userId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [directory, setDirectory] = useState<Record<string, MemberDirectoryEntry>>({});
  const [conversations, setConversations] = useState<string[]>([]);
  const [messages, setMessages] = useState<DirectMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  // Directory (names/avatars) + conversation partners
  useEffect(() => {
    fetchMemberDirectory().then((d) => {
      setDirectory(Object.fromEntries(d.map((m) => [m.user_id, m])));
    }).catch(() => {});
    listMyConversations().then((msgs) => {
      const partners = new Set<string>();
      for (const m of msgs) partners.add(m.sender_id === user?.id ? m.recipient_id : m.sender_id);
      setConversations([...partners]);
    }).catch(() => {});
  }, [user?.id]);

  // Load active conversation
  const loadConversation = useCallback(() => {
    if (!otherId) { setMessages([]); return; }
    fetchConversation(otherId).then(setMessages).catch(() => setMessages([]));
  }, [otherId]);
  useEffect(loadConversation, [loadConversation]);

  // Realtime: new DMs to me — append if part of the open conversation
  useEffect(() => {
    if (!user?.id) return;
    const unsub = subscribeToMyDirectMessages(user.id, (m) => {
      if (m.sender_id === otherId) {
        setMessages((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]));
      }
      // ensure the sender appears in the conversation list
      setConversations((prev) => (prev.includes(m.sender_id) ? prev : [m.sender_id, ...prev]));
    });
    return unsub;
  }, [user?.id, otherId]);

  useEffect(() => { endRef.current?.scrollIntoView({ block: 'end' }); }, [messages]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!draft.trim() || !otherId) return;
    setSending(true);
    const body = draft.trim();
    setDraft('');
    try {
      await sendDirectMessage(otherId, body);
      loadConversation(); // our own send isn't in the recipient-filtered realtime stream
    } catch {
      setDraft(body);
    } finally {
      setSending(false);
    }
  }

  const nameOf = (uid: string) => {
    const m = directory[uid];
    return m?.display_name || m?.first_name || 'Member';
  };

  return (
    <div className="max-w-5xl">
      <p className="eyebrow mb-2">Messages</p>
      <h1 className="heading-section text-green-800 mb-8">Direct messages</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 h-[70vh]">
        {/* Conversation list */}
        <aside className={`md:col-span-1 ${otherId ? 'hidden md:block' : ''}`}>
          <p className="eyebrow mb-3">Conversations</p>
          {conversations.length === 0 ? (
            <p className="text-xs text-muted">
              No messages yet. Start one from the <Link to="/app/members" className="underline">members</Link> page.
            </p>
          ) : (
            <div className="flex flex-col gap-1">
              {conversations.map((uid) => (
                <Link key={uid} to={`/app/messages/${uid}`}
                  className={`px-3 py-2.5 text-sm font-sans rounded-md focus-ring ${
                    uid === otherId ? 'bg-green-800 text-white' : 'text-secondary hover:bg-green-800/[0.06]'
                  }`}>
                  {nameOf(uid)}
                </Link>
              ))}
            </div>
          )}
        </aside>

        {/* Active conversation */}
        <section className={`md:col-span-2 flex flex-col bg-white border border-green-800/10 min-h-0 ${otherId ? '' : 'hidden md:flex'}`}>
          {!otherId ? (
            <p className="text-sm text-muted m-auto p-6">Choose a conversation, or message someone from the members page.</p>
          ) : (
            <>
              <div className="border-b border-green-800/10 px-5 py-3 flex items-center gap-3">
                <button type="button" onClick={() => navigate('/app/messages')} className="md:hidden text-secondary focus-ring" aria-label="Back">
                  <ArrowLeft size={18} />
                </button>
                <p className="font-serif text-green-800">{nameOf(otherId)}</p>
              </div>
              <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-2">
                {messages.length === 0 ? (
                  <p className="text-sm text-muted m-auto">Say hello.</p>
                ) : messages.map((m) => {
                  const mine = m.sender_id === user?.id;
                  return (
                    <div key={m.id} className={`max-w-[80%] ${mine ? 'self-end' : 'self-start'}`}>
                      <div className={`inline-block px-3.5 py-2 text-sm font-sans rounded-2xl ${
                        mine ? 'bg-green-800 text-white' : 'bg-cream-100 text-green-900'
                      }`}>
                        {m.body}
                      </div>
                    </div>
                  );
                })}
                <div ref={endRef} />
              </div>
              <form onSubmit={send} className="border-t border-green-800/10 p-3 flex gap-2">
                <input value={draft} onChange={(e) => setDraft(e.target.value)} className="form-input flex-1"
                  placeholder="Write a message…" aria-label="Message" />
                <button type="submit" disabled={sending || !draft.trim()} className="btn-primary px-5" aria-label="Send">
                  <Send size={16} aria-hidden="true" />
                </button>
              </form>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
