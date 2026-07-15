import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { FileSignature, FileText, CheckCircle2, MessageSquare } from 'lucide-react';
import { useDocumentTitle } from '../../lib/hooks';
import { useAuth } from '../../contexts/AuthContext';
import { myContractDocuments, type MyContractRow } from '../../lib/contracts';

/*
 * ACQUISITION HOME (/app/deal) — the home screen for a buying/selling client.
 * Where their acquisition process stands and their agreements. All agreements
 * live in Documents; this surfaces the ones that need them and links through.
 */
export default function DealHome() {
  useDocumentTitle('Acquisition');
  const { profile } = useAuth();
  const [docs, setDocs] = useState<MyContractRow[] | null>(null);

  useEffect(() => {
    myContractDocuments().then(setDocs).catch(() => setDocs([]));
  }, []);

  const first = profile?.first_name || profile?.display_name || null;
  const toSign = (docs ?? []).filter((d) => d.status !== 'EXECUTED');
  const signed = (docs ?? []).filter((d) => d.status === 'EXECUTED');

  return (
    <div className="max-w-4xl">
      <header className="mb-6">
        <p className="eyebrow">Acquisition</p>
        <h1 className="font-serif text-2xl text-green-900 mt-0.5">
          {first ? `Welcome, ${first}` : 'Your acquisition'}
        </h1>
      </header>

      {toSign.length > 0 && (
        <section className="bg-gold-50 border border-gold-200 rounded-xl p-5 mb-5">
          <p className="font-medium text-gold-900 mb-2">Agreements that need you</p>
          <ul className="flex flex-col gap-2">
            {toSign.map((d) => (
              <li key={d.document_id}>
                <Link to={`/app/contracts/${d.document_id}`} className="flex items-center justify-between gap-3 bg-white border border-green-800/10 rounded-lg px-4 py-2.5 hover:border-green-800/30 focus-ring">
                  <span className="inline-flex items-center gap-2 text-green-900"><FileSignature size={16} className="text-green-700" /> {d.title}</span>
                  <span className="text-xs text-gold-800 font-medium">Review &amp; sign →</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="grid sm:grid-cols-2 gap-3 mb-5">
        <Link to="/app/documents" className="bg-white border border-green-800/10 rounded-xl p-5 hover:border-green-800/30 focus-ring">
          <FileText size={20} className="text-green-700 mb-2" />
          <p className="font-medium text-green-900">Documents</p>
          <p className="text-sm text-muted mt-0.5">Every agreement — to review, sign, or read.</p>
        </Link>
        <Link to="/app/support" className="bg-white border border-green-800/10 rounded-xl p-5 hover:border-green-800/30 focus-ring">
          <MessageSquare size={20} className="text-green-700 mb-2" />
          <p className="font-medium text-green-900">Talk to us</p>
          <p className="text-sm text-muted mt-0.5">Questions about your buy or sell? Reach our team.</p>
        </Link>
      </section>

      {signed.length > 0 && (
        <section>
          <h2 className="font-serif text-lg text-green-900 mb-2">Signed agreements</h2>
          <ul className="flex flex-col gap-2">
            {signed.map((d) => (
              <li key={d.document_id}>
                <Link to={`/app/contracts/${d.document_id}`} className="flex items-center justify-between gap-3 bg-white border border-green-800/10 rounded-lg px-4 py-2.5 hover:border-green-800/30 focus-ring">
                  <span className="inline-flex items-center gap-2 text-green-900"><CheckCircle2 size={16} className="text-green-700" /> {d.title}</span>
                  <span className="text-xs text-muted">Signed</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {docs !== null && docs.length === 0 && (
        <p className="text-sm text-muted">Nothing here yet — your agreements and next steps will appear as your acquisition progresses.</p>
      )}
    </div>
  );
}
