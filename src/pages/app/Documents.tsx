import { useDocumentTitle } from '../../lib/hooks';
import { DocumentsContent } from '../../components/app/DocumentsContent';

/**
 * MY DOCUMENTS (/app/documents). The content itself is DocumentsContent,
 * shared with the Account page's inline panel — see that file for the
 * self-sign, email-a-copy, and paper-reading behavior.
 */
export default function Documents() {
  useDocumentTitle('My Documents');
  return (
    <div className="max-w-3xl mx-auto">
      <p className="eyebrow mb-2">My Documents</p>
      <h1 className="heading-section text-green-800 mb-8">Everything you've agreed to.</h1>
      <DocumentsContent />
    </div>
  );
}
