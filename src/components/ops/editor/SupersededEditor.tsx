import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { useDocumentTitle } from '../../../lib/hooks';

/**
 * A ROUTE THAT STILL RESOLVES, FOR AN EDITOR THAT NO LONGER EXISTS SEPARATELY.
 *
 * TASK-SURFACEEDITOR collapsed the forms editor, the menus inventory and the
 * template wording editor into ONE editor at /app/ops/admin/editor. Their routes
 * are kept because a bookmark that 404s tells the person their work is gone; what
 * is NOT kept is a second implementation of the same editing widgets, which is
 * how three screens drift into three meanings of "published" (D12's warning) and
 * how the globalization pass would have inherited a third editing idiom.
 *
 * ⚠️ The one thing this page must never become is a doorway back to a duplicate.
 * There is one editor. This says where it is.
 */
export function SupersededEditor({ was, now }: { was: string; now: string }) {
  useDocumentTitle(was);
  return (
    <div className="max-w-3xl mx-auto py-12 px-4">
      <h1 className="font-serif text-2xl text-green-900 mb-2">{was} moved into the Editor</h1>
      <p className="text-sm text-secondary mb-5">{now}</p>
      <Link to="/app/ops/admin/editor"
        className="btn-primary text-sm inline-flex items-center gap-1.5">
        Open the Editor <ArrowRight size={15} />
      </Link>
    </div>
  );
}
