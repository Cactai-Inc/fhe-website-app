import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { fetchContentPost } from '../../lib/community';
import { useDocumentTitle } from '../../lib/hooks';
import type { ContentPost } from '../../lib/community-types';

export default function ContentPostDetail() {
  const { slug } = useParams<{ slug: string }>();
  const [post, setPost] = useState<ContentPost | null>(null);
  const [loading, setLoading] = useState(true);
  useDocumentTitle(post?.title ?? 'Article');

  useEffect(() => {
    let active = true;
    if (slug) {
      fetchContentPost(slug).then((p) => active && setPost(p)).catch(() => active && setPost(null))
        .finally(() => active && setLoading(false));
    }
    return () => { active = false; };
  }, [slug]);

  if (loading) return <p className="body-text text-muted">Loading…</p>;
  if (!post) {
    return (
      <div className="max-w-2xl">
        <h1 className="heading-section text-green-800 mb-4">Article not found</h1>
        <Link to="/app/content" className="link-underline">Back to content</Link>
      </div>
    );
  }

  return (
    <article className="max-w-2xl">
      <Link to="/app/content" className="inline-flex items-center gap-2 text-sm text-secondary hover:text-green-800 mb-6 focus-ring">
        <ArrowLeft size={16} /> Back to content
      </Link>
      {post.cover_url && <img src={post.cover_url} alt="" className="w-full h-56 object-cover mb-6" />}
      <h1 className="heading-section text-green-800 mb-2">{post.title}</h1>
      <p className="text-xs text-muted mb-8">{new Date(post.created_at).toLocaleDateString()}</p>
      <div className="body-text whitespace-pre-line leading-relaxed">{post.body}</div>
    </article>
  );
}
