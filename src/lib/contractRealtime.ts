import { useEffect, useRef, useState } from 'react';
import { supabase } from './supabase';

/**
 * CONTRACT REAL-TIME — live updates for everyone looking at the same contract.
 *
 * The problem this solves: notes, change requests and field edits all persisted
 * immediately, but the other party saw none of it without a page refresh. Two
 * people reviewing together — very likely on a phone call — were each reading a
 * stale copy of the other's work.
 *
 * Sequencing (lock the document to one party at a time) was considered and
 * rejected: it serialises a conversation that is naturally simultaneous.
 *
 * Mechanism: Supabase postgres_changes, the same one the community chat already
 * uses (subscribeToChannel in ./community.ts). RLS is evaluated per subscriber,
 * so a party receives events only for documents they are a party to.
 */

/** Which surface changed. The page maps this onto what to reload. */
export type ContractEvent =
  | 'notes'      // a thread created/renamed, or a message posted
  | 'requests'   // a change request opened, replied to, resolved
  | 'history'    // an edit recorded in the change log
  | 'fields'     // a field value saved
  | 'document';  // workflow state moved (sent for review, locked, signed)

/**
 * Subscribe to every change on one contract document.
 *
 * `onEvent` fires with the surface that changed. It is deliberately coarse — the
 * caller re-reads that surface rather than trying to patch a row in place. For
 * append-only data (notes, requests, history) a refetch is simple and always
 * correct; for fields, see the focus guard in ContractPage.
 */
export function subscribeToContract(
  documentId: string,
  onEvent: (e: ContractEvent) => void,
): () => void {
  const channel = supabase
    .channel(`contract-${documentId}`)
    .on('postgres_changes',
      { event: '*', schema: 'public', table: 'contract_notes', filter: `document_id=eq.${documentId}` },
      () => onEvent('notes'))
    // note messages carry note_id, not document_id, so they cannot be filtered
    // server-side by document. The subscription is per-document anyway and the
    // caller refetches, so an occasional extra refetch is harmless.
    .on('postgres_changes',
      { event: '*', schema: 'public', table: 'contract_note_messages' },
      () => onEvent('notes'))
    .on('postgres_changes',
      { event: '*', schema: 'public', table: 'contract_change_requests', filter: `document_id=eq.${documentId}` },
      () => onEvent('requests'))
    .on('postgres_changes',
      { event: '*', schema: 'public', table: 'contract_change_log', filter: `document_id=eq.${documentId}` },
      () => onEvent('history'))
    .on('postgres_changes',
      { event: '*', schema: 'public', table: 'contract_fields', filter: `document_id=eq.${documentId}` },
      () => onEvent('fields'))
    .on('postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'documents', filter: `id=eq.${documentId}` },
      () => onEvent('document'))
    .subscribe();

  return () => { void supabase.removeChannel(channel); };
}

export interface ContractViewer {
  name: string;
  /** Distinguishes two tabs of the same person from two different people. */
  key: string;
}

/**
 * Who else is looking at this contract right now.
 *
 * Uses the same presence channel pattern as the direct-messages page. Returns
 * everyone EXCEPT the caller, so the result is literally "who else is here".
 */
export function useContractPresence(
  documentId: string | undefined,
  me: { key: string; name: string } | null,
): ContractViewer[] {
  const [others, setOthers] = useState<ContractViewer[]>([]);
  // Kept in a ref so a changing display name does not tear down the channel.
  const meRef = useRef(me);
  meRef.current = me;

  useEffect(() => {
    if (!documentId || !me?.key) { setOthers([]); return; }
    const myKey = me.key;

    const channel = supabase.channel(`contract-presence-${documentId}`, {
      config: { presence: { key: myKey } },
    });

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState() as Record<string, Array<{ name?: string }>>;
        const list: ContractViewer[] = [];
        for (const [key, metas] of Object.entries(state)) {
          if (key === myKey) continue;      // "who ELSE is here"
          list.push({ key, name: metas[0]?.name || 'Someone' });
        }
        setOthers(list);
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          void channel.track({ name: meRef.current?.name ?? 'Someone' });
        }
      });

    return () => { void supabase.removeChannel(channel); };
    // me.name deliberately omitted: it rides in via meRef, so a rename does not
    // tear down and rebuild the channel.
  }, [documentId, me?.key]);

  return others;
}
