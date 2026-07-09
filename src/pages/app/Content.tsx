import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { FileDown, Video, ExternalLink, BookOpen, FileText, ArrowRight } from 'lucide-react';
import { fetchContentPosts, fetchResources, resourceDownloadUrl } from '../../lib/community';
import { useDocumentTitle } from '../../lib/hooks';
import type { ContentPost, ContentResource } from '../../lib/community-types';

function ResourceRow({ r }: { r: ContentResource }) {
  const [resolving, setResolving] = useState(false);
  const Icon = r.kind === 'video' ? Video : r.kind === 'link' ? ExternalLink : FileDown;

  async function open() {
    if (r.url) { window.open(r.url, '_blank', 'noopener,noreferrer'); return; }
    if (r.storage_path) {
      setResolving(true);
      const url = await resourceDownloadUrl(r.storage_path);
      setResolving(false);
      if (url) window.open(url, '_blank', 'noopener,noreferrer');
    }
  }

  return (
    <button type="button" onClick={open}
      className="w-full text-left bg-white border border-green-800/10 p-5 flex items-start gap-3 hover:shadow-md transition-shadow focus-ring">
      <Icon size={18} className="text-gold-ink flex-shrink-0 mt-0.5" aria-hidden="true" />
      <div>
        <p className="text-sm font-sans font-medium text-green-900">{r.title}{resolving ? ' · opening…' : ''}</p>
        {r.description && <p className="text-xs text-muted mt-0.5">{r.description}</p>}
      </div>
    </button>
  );
}

export default function Content() {
  useDocumentTitle('Library');
  const [posts, setPosts] = useState<ContentPost[]>([]);
  const [resources, setResources] = useState<ContentResource[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    Promise.all([fetchContentPosts().catch(() => []), fetchResources().catch(() => [])])
      .then(([p, r]) => { if (!active) return; setPosts(p); setResources(r); })
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, []);

  return (
    <div className="max-w-4xl">
      <p className="eyebrow mb-2">Library</p>
      <h1 className="heading-section text-green-800 mb-6">For the people who keep showing up.</h1>

      {/* Personal docs — the member's own signed/issued documents live in Documents;
          the Library surfaces the link so "saved list + personal docs + content" are
          one place (Slice 4). */}
      <Link to="/app/documents"
        className="bg-white border border-green-800/10 rounded-lg p-5 mb-8 flex items-center gap-3 hover:border-green-800/30">
        <FileText size={18} className="text-gold-ink" aria-hidden="true" />
        <span className="text-sm font-sans font-medium text-green-900">Your documents</span>
        <ArrowRight size={14} className="ml-auto text-muted" aria-hidden="true" />
      </Link>

      {loading ? (
        <p className="body-text text-muted">Loading…</p>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Articles */}
          <section className="lg:col-span-2">
            <h2 className="font-serif font-medium text-green-800 text-xl mb-4">Articles</h2>
            {posts.length === 0 ? (
              <p className="body-text text-muted text-sm">No articles published yet.</p>
            ) : (
              <div className="flex flex-col gap-4">
                {posts.map((p) => (
                  <Link key={p.id} to={`/app/content/${p.slug}`}
                    className="bg-white border border-green-800/10 overflow-hidden hover:shadow-md transition-shadow focus-ring block">
                    {p.cover_url && <img src={p.cover_url} alt="" className="w-full h-40 object-cover" />}
                    <div className="p-5">
                      <h3 className="font-serif font-medium text-green-800 text-lg mb-1 inline-flex items-center gap-2">
                        <BookOpen size={15} className="text-gold-ink" aria-hidden="true" /> {p.title}
                      </h3>
                      {p.excerpt && <p className="text-sm text-secondary line-clamp-2">{p.excerpt}</p>}
                      <p className="text-xs text-muted mt-2">{new Date(p.created_at).toLocaleDateString()}</p>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </section>

          {/* Resource library */}
          <aside>
            <h2 className="font-serif font-medium text-green-800 text-xl mb-4">Resource library</h2>
            {resources.length === 0 ? (
              <p className="body-text text-muted text-sm">No resources yet.</p>
            ) : (
              <div className="flex flex-col gap-3">
                {resources.map((r) => <ResourceRow key={r.id} r={r} />)}
              </div>
            )}
          </aside>
        </div>
      )}
    </div>
  );
}
