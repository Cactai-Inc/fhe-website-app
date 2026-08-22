import { useCallback, useEffect, useMemo, useState } from 'react';
import { Archive, RotateCcw, Search } from 'lucide-react';
import { PageLayout } from '../../../components/app/PageLayout';
import { ContactDossierModal } from '../../../components/app/ContactDossierModal';
import { useAuth } from '../../../contexts/AuthContext';
import { useDocumentTitle } from '../../../lib/hooks';
import { useToast } from '../../../lib/ops';
import { toErrorMessage } from '../../../lib/ops/errors';
import {
  archivedContacts, unarchiveContact, CONTACT_TYPE_LABEL,
  type ArchivedContact, type ContactType,
} from '../../../lib/api';

/**
 * ARCHIVED ACCOUNTS — the deleted-accounts view (TASK-ARCHIVE §3).
 *
 * Owner, 2026-08-22: "deleting an account doesn't remove the information from
 * the system so just make sure it retains visibility for the contracts even
 * though the account is not visible to users and its only visible to me in the
 * deleted accounts view which probably needs to be built."
 *
 * THE ONE SURFACE IN THE APP THAT SHOWS `deleted_at IS NOT NULL` CONTACTS.
 * Everywhere else — Records, the pickers, every roster, and now the contacts
 * table itself via a RESTRICTIVE RLS policy — they are gone. Here they are all
 * there, with who archived them, when, and why, and with the count of what is
 * still attached to them: documents, executed documents, signatures, the
 * contracts they are a party to, orders, horses. Those counts are the claim the
 * whole feature makes (D32) — nothing was destroyed to hide the account, so
 * they are never zero just because someone was archived.
 *
 * Clicking a row opens THE SAME dossier every other person-surface opens; there
 * is no second record view for archived people, because there is no second
 * record. The dossier reads `deleted_at` off the contact and freezes its own
 * editing controls.
 *
 * Admin-gated in `archived_contacts()` and again on the route. D26: both owners
 * carry ADMIN, so this is filed as a Records tab rather than granted narrowly —
 * the emphasis is Business Operations, the capability is not exclusive to it.
 */
export default function ArchivedAccountsPage() {
  useDocumentTitle('Archived accounts');
  const toast = useToast();
  const { isAdmin } = useAuth();
  const [rows, setRows] = useState<ArchivedContact[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [dossier, setDossier] = useState<string | null>(null);
  const [restoring, setRestoring] = useState<string | null>(null);

  const load = useCallback(() => {
    setError(null);
    archivedContacts()
      .then(setRows)
      .catch((e) => { setRows([]); setError(toErrorMessage(e, 'Could not load archived accounts.')); });
  }, []);
  useEffect(load, [load]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q || !rows) return rows ?? [];
    return rows.filter((r) => [
      r.first_name, r.last_name, r.email, r.display_code, r.reason, r.archived_by_name,
    ].some((v) => (v ?? '').toLowerCase().includes(q)));
  }, [rows, query]);

  async function restore(r: ArchivedContact) {
    setRestoring(r.contact_id);
    try {
      await unarchiveContact(r.contact_id);
      toast.success('Restored — they are back in Records.');
      load();
    } catch (e) {
      toast.error(toErrorMessage(e, 'Could not restore that account.'));
    } finally { setRestoring(null); }
  }

  if (!isAdmin) {
    return (
      <PageLayout name="Archived accounts">
        <p className="text-sm text-muted">This view is for account administrators.</p>
      </PageLayout>
    );
  }

  return (
    <PageLayout
      name="Archived accounts"
      description="Accounts hidden from Records and from every picker and roster. Nothing was deleted to hide them — their documents, signatures, contracts and orders are all still here, and anyone who shares a document with them still sees it unchanged. Open a row to read the full record, or put the account back."
      width="wide"
    >
      <div className="relative mb-4 max-w-sm">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
        <input value={query} onChange={(e) => setQuery(e.target.value)}
          placeholder="Search name, email, reason…" aria-label="Search archived accounts"
          className="w-full pl-9 pr-3 py-2 rounded-lg border border-green-800/20 text-sm focus-ring" />
      </div>

      {error && <p role="alert" className="form-error mb-4">{error}</p>}

      {rows === null ? (
        <p className="text-sm text-muted">Loading…</p>
      ) : shown.length === 0 ? (
        <div className="rounded-xl border border-green-800/10 bg-cream-100/50 p-6 text-center">
          <Archive size={20} className="mx-auto mb-2 text-muted" />
          <p className="text-sm text-muted">
            {rows.length === 0
              ? 'No accounts have been archived.'
              : 'No archived account matches that search.'}
          </p>
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {shown.map((r) => {
            const name = [r.first_name, r.last_name].filter(Boolean).join(' ').trim()
              || r.email || 'Unnamed contact';
            return (
              <li key={r.contact_id}
                className="rounded-xl border border-green-800/10 bg-white p-4">
                <div className="flex flex-wrap items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <button type="button" onClick={() => setDossier(r.contact_id)}
                      className="font-medium text-green-900 hover:underline focus-ring text-left">
                      {name}
                    </button>
                    <p className="text-[11.5px] text-muted">
                      {r.display_code ?? '—'}
                      {r.contact_type && ` · ${CONTACT_TYPE_LABEL[r.contact_type as ContactType] ?? r.contact_type}`}
                      {r.email && ` · ${r.email}`}
                      {r.had_login && ' · had a login'}
                    </p>
                  </div>
                  <button type="button" disabled={restoring === r.contact_id}
                    onClick={() => void restore(r)}
                    className="px-3.5 py-2 rounded-lg text-xs inline-flex items-center gap-1.5 border border-green-800/20 text-green-800 hover:bg-green-50 focus-ring disabled:opacity-40">
                    <RotateCcw size={13} />
                    {restoring === r.contact_id ? 'Restoring…' : 'Restore'}
                  </button>
                </div>

                <p className="text-[12px] text-secondary mt-2">
                  Archived {new Date(r.archived_at).toLocaleString()}
                  {r.archived_by_name && ` by ${r.archived_by_name}`}
                </p>
                <p className="text-sm text-green-900 bg-cream-100/60 rounded-lg p-2.5 mt-1.5 whitespace-pre-line">
                  {r.reason ?? 'No reason recorded.'}
                </p>

                {/* Still there. This row is the evidence the feature works. */}
                <div className="flex flex-wrap gap-1.5 mt-2.5">
                  <Kept n={r.executed_document_count} one="executed document" many="executed documents" />
                  <Kept n={r.signature_count} one="signature" many="signatures" />
                  <Kept n={r.party_document_count} one="contract as a party" many="contracts as a party" />
                  <Kept n={r.document_count} one="document" many="documents" />
                  <Kept n={r.order_count} one="order" many="orders" />
                  <Kept n={r.horse_count} one="horse" many="horses" />
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {dossier && (
        <ContactDossierModal contactId={dossier} onClose={() => setDossier(null)} onChanged={load} />
      )}
    </PageLayout>
  );
}

/** A retained-record count. Zero is not shown — the point of the strip is what
 *  survived, and an empty strip says "nothing was attached to them" clearly. */
function Kept({ n, one, many }: { n: number; one: string; many: string }) {
  if (!n) return null;
  return (
    <span className="text-[11px] px-2.5 py-1 rounded-full bg-green-800/10 text-green-800">
      {n} {n === 1 ? one : many} kept
    </span>
  );
}
