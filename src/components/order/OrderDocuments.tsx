import { useState } from 'react';
import { Check, FileText } from 'lucide-react';
import { signOrderDocument } from '../../lib/api';
import type { OrderDocument } from '../../lib/types';

/** Placeholder document body text keyed by document_type. Real content is a later
 *  pass (architecture-flow-spec defers document content + per-offering mapping). */
const DOC_TITLE: Record<string, string> = {
  liability_waiver: 'Liability Waiver & Release',
  lesson_policy: 'Lesson & Cancellation Policy',
  training_agreement: 'Training Services Agreement',
  care_agreement: 'Horse Care Services Agreement',
  brokering_agreement: 'Brokering Engagement Agreement',
};

function titleFor(type: string): string {
  return DOC_TITLE[type] ?? type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function DocumentCard({ doc, onSigned }: { doc: OrderDocument; onSigned: () => void }) {
  const [name, setName] = useState(doc.signer_name ?? '');
  const [agreed, setAgreed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const signed = !!doc.agreed_at;

  async function handleSign() {
    if (!name.trim() || !agreed) return;
    setSubmitting(true);
    try {
      await signOrderDocument(doc.id, name.trim());
      onSigned();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="bg-white border border-green-800/10 p-6 mb-4">
      <div className="flex items-start gap-3 mb-4">
        <FileText size={18} className="text-gold-ink flex-shrink-0 mt-0.5" aria-hidden="true" />
        <div>
          <h3 className="font-serif font-medium text-green-800 text-lg">{titleFor(doc.document_type)}</h3>
          <p className="text-xs font-sans text-muted mt-1">
            Please read, type your full name, and check the box to agree. Your agreement is recorded
            with a timestamp.
          </p>
        </div>
      </div>

      {/* Placeholder document body — real content is a later pass. */}
      <div className="bg-cream/60 border border-green-800/10 p-4 mb-5 max-h-40 overflow-y-auto text-xs font-sans text-secondary leading-relaxed">
        The full text of this agreement will appear here. By typing your name and checking the box
        below, you acknowledge that you have read and agree to the terms of the
        {' '}{titleFor(doc.document_type).toLowerCase()} as provided by French Heritage Equestrian.
      </div>

      {signed ? (
        <p className="inline-flex items-center gap-2 text-sm font-sans text-green-700">
          <Check size={15} aria-hidden="true" />
          Agreed by {doc.signer_name} on {new Date(doc.agreed_at!).toLocaleDateString()}
        </p>
      ) : (
        <>
          <div className="mb-4">
            <label className="form-label" htmlFor={`sign-${doc.id}`}>Type your full name</label>
            <input
              id={`sign-${doc.id}`}
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="form-input"
              placeholder="Full legal name"
              autoComplete="name"
            />
          </div>
          <label className="flex items-start gap-3 mb-5 cursor-pointer">
            <input
              type="checkbox"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              className="mt-1 w-4 h-4 accent-green-800"
            />
            <span className="text-sm font-sans text-secondary">
              I have read and agree to this {titleFor(doc.document_type).toLowerCase()}.
            </span>
          </label>
          <button
            type="button"
            onClick={handleSign}
            disabled={!name.trim() || !agreed || submitting}
            className="btn-primary"
          >
            {submitting ? 'Recording…' : 'Agree & Continue'}
          </button>
        </>
      )}
    </div>
  );
}

export default function OrderDocuments({
  documents,
  onSigned,
}: {
  documents: OrderDocument[];
  onSigned: () => void;
}) {
  return (
    <div className="mb-8">
      <h2 className="font-serif font-medium text-green-800 text-xl mb-5">Documents to review</h2>
      {documents.map((doc) => (
        <DocumentCard key={doc.id} doc={doc} onSigned={onSigned} />
      ))}
    </div>
  );
}
