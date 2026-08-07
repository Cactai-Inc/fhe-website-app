import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useDocumentTitle } from '../../lib/hooks';
import { PageCreateButton } from '../../components/app/PageCreateButton';
import { MyPostsContent } from '../../components/app/MyPostsContent';
import { useCreateModalTrigger } from '../../contexts/CreateModalContext';
import { useViewSurfaces } from '../../lib/surfaces';

/**
 * MY POSTS (/app/my-posts) — the poster manages their own community posts: review,
 * edit the text / link / who-can-see, or delete. Reached from Account → My Posts.
 * Media and post type are fixed at creation (re-post to change those); this edits
 * the parts that make sense to change after the fact. The list/edit content itself
 * is MyPostsContent, shared with the Account page's inline panel.
 */
export default function MyPosts() {
  useDocumentTitle('My Posts');
  const navigate = useNavigate();
  const createModal = useCreateModalTrigger();
  const { surfaces } = useViewSurfaces();

  return (
    <div className="max-w-3xl mx-auto">
      <button type="button" onClick={() => navigate('/app/account')}
        className="inline-flex items-center gap-1.5 text-sm text-green-700 hover:text-green-800 mb-3 focus-ring rounded">
        <ArrowLeft size={15} /> Account
      </button>
      <header className="mb-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="eyebrow">Community</p>
            <h1 className="font-serif text-green-800 text-3xl font-semibold mt-0.5">My Posts</h1>
          </div>
          {surfaces.has_feed && createModal && (
            <PageCreateButton label="Post" onClick={() => createModal.openCreate('post_type')} />
          )}
        </div>
        <p className="body-text text-sm text-muted mt-1">Review, edit, or delete anything you’ve posted.</p>
      </header>

      <MyPostsContent />
    </div>
  );
}
