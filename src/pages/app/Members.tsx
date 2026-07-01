import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { MessageSquare } from 'lucide-react';
import { fetchMemberDirectory } from '../../lib/community';
import { useDocumentTitle } from '../../lib/hooks';
import { useAuth } from '../../contexts/AuthContext';
import type { MemberDirectoryEntry } from '../../lib/community-types';

const LEVEL_LABEL: Record<string, string> = {
  newcomer: 'New to riding', returning: 'Returning rider',
  committed: 'Riding regularly', experienced: 'Experienced',
};

export default function Members() {
  useDocumentTitle('Members');
  const { user } = useAuth();
  const [members, setMembers] = useState<MemberDirectoryEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    fetchMemberDirectory().then((m) => active && setMembers(m)).catch(() => active && setMembers([]))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, []);

  return (
    <div className="max-w-4xl">
      <p className="eyebrow mb-2">The community</p>
      <h1 className="heading-section text-green-800 mb-8">Who's at the rail.</h1>

      {loading ? (
        <p className="body-text text-muted">Loading…</p>
      ) : members.length === 0 ? (
        <p className="body-text text-muted text-sm">The directory is just getting started.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {members.map((m) => {
            const name = m.display_name || m.first_name || 'Member';
            const initial = name.charAt(0).toUpperCase();
            const isMe = m.user_id === user?.id;
            return (
              <div key={m.user_id} className="bg-white border border-green-800/10 p-5 flex flex-col">
                <div className="flex items-center gap-3 mb-3">
                  {m.avatar_url ? (
                    <img src={m.avatar_url} alt="" className="w-12 h-12 rounded-full object-cover" />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-green-800 text-white flex items-center justify-center font-serif text-lg">
                      {initial}
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="font-serif text-green-800 truncate">{name}{isMe && ' (you)'}</p>
                    {m.riding_level && <p className="text-xs text-muted">{LEVEL_LABEL[m.riding_level] ?? m.riding_level}</p>}
                  </div>
                </div>
                {m.bio && <p className="text-xs text-secondary leading-relaxed mb-3 line-clamp-3">{m.bio}</p>}
                {!isMe && (
                  <Link to={`/app/messages/${m.user_id}`} className="link-underline mt-auto self-start">
                    <MessageSquare size={12} aria-hidden="true" /> Message
                  </Link>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
