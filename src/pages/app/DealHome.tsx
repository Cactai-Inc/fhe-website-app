import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { fromHere } from '../../lib/linkOrigin';
import { FileSignature, FileText, CheckCircle2, MessageSquare } from 'lucide-react';
import { useDocumentTitle } from '../../lib/hooks';
import { useAuth } from '../../contexts/AuthContext';
import { myDocuments, type MyDocumentRow } from '../../lib/api';

/*
 * ACQUISITION HOME (/app/deal) — the home screen for a buying/selling client.
 * Where their acquisition process stands and their agreements. All agreements
 * live in Documents; this surfaces the ones that need them and links through.
 *
 * COUNTFIX 1.4 — ONE READER, ONE DEFINITION. This page used to call
 * `my_contract_documents()`, a second definition of "the member's documents".
 * Against `/app/documents` it read 5 vs 11 for one account and 0 vs 6 for three
 * others, so three members saw "nothing here yet" while their Documents page
 * listed six, six and four. It also had no void filter, so both of cjzigs@'s
 * VOIDED leases were rendered under "Agreements that need you" — the page was
 * asking a member to sign two dead documents.
 *
 * It now reads `my_documents()` — the one definition of a member's documents —
 * and filters it to `is_contract`. The count here is deliberately NARROWER than
 * `/app/documents`, and the page says so in words: a subset is honest, an
 * unexplained different number is not.
 */
export default function DealHome() {
  useDocumentTitle('Acquisition');
  const { profile } = useAuth();
  const location = useLocation();
  const [rows, setRows] = useState<MyDocumentRow[] | null>(null);

  useEffect(() => {
    myDocuments().then(setRows).catch(() => setRows([]));
  }, []);

  const first = profile?.first_name || profile?.display_name || null;

  // The contract subset of the member's own documents. `assigned` placeholders
  // have no document yet (and no contract fields), so they never appear here.
  const docs = (rows ?? []).filter((d) => d.is_contract && d.document_id);
  const toSign = docs.filter((d) => d.kind !== 'executed');
  const signed = docs.filter((d) => d.kind === 'executed');
  const totalDocs = (rows ?? []).length;

  return (
    <div className="max-w-4xl mx-auto">
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
                <Link to={`/app/contracts/${d.document_id}`} state={fromHere(location)} className="flex items-center justify-between gap-3 bg-white border border-green-800/10 rounded-lg px-4 py-2.5 hover:border-green-800/30 focus-ring">
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
                  <span className="text-xs text-muted">{d.superseded ? 'Signed · superseded' : 'Signed'}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* COUNTFIX 1.4: this page shows the CONTRACT subset. When it is empty but
          the member has documents, say which is which — never let two numbers
          that mean different things sit unexplained on two screens. */}
      {rows !== null && docs.length === 0 && (
        <p className="text-sm text-muted">
          {totalDocs > 0 ? (
            <>
              No negotiable agreements yet — your acquisition paperwork will appear here as it
              progresses. Your other {totalDocs} document{totalDocs === 1 ? '' : 's'} {totalDocs === 1 ? 'is' : 'are'} in{' '}
              <Link to="/app/documents" className="link-underline">Documents</Link>.
            </>
          ) : (
            <>Nothing here yet — your agreements and next steps will appear as your acquisition progresses.</>
          )}
        </p>
      )}
    </div>
  );
}
