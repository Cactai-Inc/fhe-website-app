import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { FileText, Check } from 'lucide-react';
import { fetchMyDocuments } from '../../lib/api';
import { useDocumentTitle } from '../../lib/hooks';
import type { OrderDocument } from '../../lib/types';

const DOC_TITLE: Record<string, string> = {
  liability_waiver: 'Liability Waiver & Release',
  lesson_policy: 'Lesson & Cancellation Policy',
  training_agreement: 'Training Services Agreement',
  care_agreement: 'Horse Care Services Agreement',
  brokering_agreement: 'Brokering Engagement Agreement',
};
const titleFor = (t: string) => DOC_TITLE[t] ?? t.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

export default function Documents() {
  useDocumentTitle('Your Documents');
  const [docs, setDocs] = useState<(OrderDocument & { order_created_at?: string })[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    fetchMyDocuments().then((d) => active && setDocs(d)).catch(() => active && setDocs([]))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, []);

  return (
    <div className="max-w-3xl">
      <p className="eyebrow mb-2">Your documents</p>
      <h1 className="heading-section text-green-800 mb-8">Everything you've agreed to.</h1>

      {loading ? (
        <p className="body-text text-muted">Loading…</p>
      ) : docs.length === 0 ? (
        <p className="body-text text-muted text-sm">No documents yet. They'll appear here as you complete orders.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {docs.map((d) => (
            <div key={d.id} className="bg-white border border-green-800/10 p-5 flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <FileText size={18} className="text-gold-ink flex-shrink-0 mt-0.5" aria-hidden="true" />
                <div>
                  <p className="text-sm font-sans font-medium text-green-900">{titleFor(d.document_type)}</p>
                  {d.agreed_at ? (
                    <p className="text-xs text-green-700 mt-1 inline-flex items-center gap-1">
                      <Check size={12} aria-hidden="true" />
                      Agreed by {d.signer_name} · {new Date(d.agreed_at).toLocaleDateString()}
                    </p>
                  ) : (
                    <p className="text-xs text-muted mt-1">Not yet agreed</p>
                  )}
                </div>
              </div>
              <Link to={`/order/${d.order_id}`} className="link-underline whitespace-nowrap">View order</Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
