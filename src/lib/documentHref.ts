/**
 * DOCUMENT HREF — one rule for which viewer a document opens in.
 *
 * TASK-PAGEMERGE (DUPECENSUS 2.7): a document with a `contract_id` is
 * authored/signed at the full contract page; one without is a flat document
 * shown by the read-only viewer. `DocumentQueueTable` already applied this
 * rule inline and correctly; `Admin.tsx` sent every document to the read-only
 * viewer regardless, so the SAME document opened differently depending on
 * which page you clicked it from. One function, three call sites.
 */
export function documentHref(row: { id: string; contract_id: string | null }): string {
  return row.contract_id ? `/app/contracts/${row.id}` : `/app/ops/documents/${row.id}`;
}
