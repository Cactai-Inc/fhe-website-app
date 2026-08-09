import { useDocumentTitle } from '../../lib/hooks';
import { GiftsContent } from '../../components/app/GiftsContent';

/**
 * MY GIFTS (/app/gifts). The content itself is GiftsContent, shared with the
 * Account page's inline panel.
 */
export default function Gifts() {
  useDocumentTitle('My Gifts');
  return (
    <div className="max-w-3xl mx-auto">
      <p className="eyebrow mb-2">My Gifts</p>
      <h1 className="heading-section text-green-800 mb-8">Gifts you can use.</h1>
      <GiftsContent />
    </div>
  );
}
