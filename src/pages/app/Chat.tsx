import { useEffect, useRef, useState } from 'react';
import { Send } from 'lucide-react';
import {
  fetchChannels, fetchChannelMessages, sendChannelMessage, subscribeToChannel,
} from '../../lib/community';
import { useDocumentTitle } from '../../lib/hooks';
import { useAuth } from '../../contexts/AuthContext';
import type { Channel, ChannelMessage } from '../../lib/community-types';

function authorName(m: ChannelMessage): string {
  return m.author?.display_name || m.author?.first_name || 'Member';
}

export default function Chat() {
  useDocumentTitle('Chat Board');
  const { user } = useAuth();
  const [channels, setChannels] = useState<Channel[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChannelMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  // Load channels
  useEffect(() => {
    let active = true;
    fetchChannels().then((c) => {
      if (!active) return;
      setChannels(c);
      if (c.length) setActiveId((cur) => cur ?? c[0].id);
    }).catch(() => {});
    return () => { active = false; };
  }, []);

  // Load messages + subscribe when the active channel changes
  useEffect(() => {
    if (!activeId) return;
    let active = true;
    fetchChannelMessages(activeId).then((m) => active && setMessages(m)).catch(() => active && setMessages([]));
    const unsub = subscribeToChannel(activeId, (m) => {
      setMessages((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]));
    });
    return () => { active = false; unsub(); };
  }, [activeId]);

  // Autoscroll
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' });
  }, [messages]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!draft.trim() || !activeId) return;
    setSending(true);
    const body = draft.trim();
    setDraft('');
    try {
      await sendChannelMessage(activeId, body);
      // Realtime echoes our own insert back; no optimistic add needed.
    } catch {
      setDraft(body); // restore on failure
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="max-w-5xl">
      <p className="eyebrow mb-2">The rail</p>
      <h1 className="heading-section text-green-800 mb-8">Chat board</h1>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 h-[70vh]">
        {/* Channels */}
        <aside className="md:col-span-1">
          <p className="eyebrow mb-3">Channels</p>
          <div className="flex md:flex-col gap-2 overflow-x-auto">
            {channels.length === 0 && <p className="text-xs text-muted">No channels yet.</p>}
            {channels.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setActiveId(c.id)}
                className={`text-left px-3 py-2 text-sm font-sans rounded-md whitespace-nowrap focus-ring ${
                  activeId === c.id ? 'bg-green-800 text-white' : 'text-secondary hover:bg-green-800/[0.06]'
                }`}
              >
                # {c.name}
              </button>
            ))}
          </div>
        </aside>

        {/* Messages */}
        <section className="md:col-span-3 flex flex-col bg-white border border-green-800/10 min-h-0">
          <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-3">
            {messages.length === 0 ? (
              <p className="text-sm text-muted m-auto">Be the first to say hello.</p>
            ) : (
              messages.map((m) => {
                const mine = m.author_id === user?.id;
                return (
                  <div key={m.id} className={`max-w-[80%] ${mine ? 'self-end text-right' : 'self-start'}`}>
                    {!mine && <p className="text-[11px] text-muted mb-0.5">{authorName(m)}</p>}
                    <div className={`inline-block px-3.5 py-2 text-sm font-sans rounded-2xl ${
                      mine ? 'bg-green-800 text-white' : 'bg-cream-100 text-green-900'
                    }`}>
                      {m.body}
                    </div>
                  </div>
                );
              })
            )}
            <div ref={endRef} />
          </div>

          <form onSubmit={send} className="border-t border-green-800/10 p-3 flex gap-2">
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              className="form-input flex-1"
              placeholder="Message the group…"
              disabled={!activeId}
              aria-label="Message"
            />
            <button type="submit" disabled={sending || !draft.trim() || !activeId}
              className="btn-primary px-5" aria-label="Send">
              <Send size={16} aria-hidden="true" />
            </button>
          </form>
        </section>
      </div>
    </div>
  );
}
