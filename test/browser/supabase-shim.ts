/* HARNESS SHIM for src/lib/supabase.ts — aliased in by harness.vite.config.ts.
 * Serves the RPC payloads captured from a REAL Postgres (PGlite, running the
 * repo's own schema) so the real ContractPage can be mounted in a real browser
 * without a production backend. Every rpc() call is logged to window.__rpc, so a
 * probe can assert what the page did and did not call — the same evidence
 * WALK3's network log provided. */
import payloads from '../ui/fixtures/contractsend-rpc-payloads.json';

declare global {
  interface Window { __rpc: { name: string; args: unknown }[] }
}
window.__rpc = [];

const ADMIN_USER = { id: '00000000-0000-4000-8000-000000000001', email: 'ops@fhe.test' };
const PROFILE = {
  user_id: ADMIN_USER.id, role: 'ADMIN', org_id: '00000000-0000-4000-8000-0000000000aa',
  first_name: 'Ops', last_name: 'Staff', contact_id: null, is_suspended: false,
};

const P = payloads as Record<string, unknown>;

/** RPCs the page fires that the capture does not cover. Empty is the honest
 *  answer for all of them: the page's own .catch() fallbacks treat them so. */
const EMPTY: Record<string, unknown> = {
  mark_document_opened: null, regenerate_contract_document: null,
  my_wall_state: { walled: false }, my_name_confirmation_state: null,
  contract_change_requests_list: [], contract_notes_for_document: [],
  contract_comments_list: [], contract_change_log_list: [], contract_event_log: [],
  pending_notify_summary: null, document_changes_since_signature: [],
  my_modules: [], config_value: null, current_contact_id: null,
};

function result(data: unknown) {
  return Promise.resolve({ data, error: null });
}

/* STATEFUL WRITES. The captured payload is the document's opening state; field
   writes are applied to it so a re-read of contract_document_detail returns what
   was just saved. Without this the harness could never show a value SURVIVING a
   reload, and conditional fields could never be reached at all — their gate is
   another field's value, so a stateless mock leaves every gated control disabled
   forever. Mirrors what set_contract_field does server-side (verified against
   the real function in test/db/diag_contractsend). */
type Field = { field_key: string; value: string | null; structured: unknown };
/* Persisted in sessionStorage so state survives a FULL PAGE RELOAD — that is the
   whole point of the round-trip test: type a value, reload the page, the value is
   still there. Reset with sessionStorage.clear(). */
const KEY = 'harness-contract-detail';
const stored = sessionStorage.getItem(KEY);
if (stored) P.contract_document_detail = JSON.parse(stored);
const detail = P.contract_document_detail as { fields: Field[] };
function persist() { sessionStorage.setItem(KEY, JSON.stringify(P.contract_document_detail)); }
function writeField(key: string, patch: Partial<Field>) {
  const f = detail.fields.find((x) => x.field_key === key);
  if (f) { Object.assign(f, patch); persist(); }
}

export const supabase = {
  rpc(name: string, args?: unknown) {
    window.__rpc.push({ name, args });
    const a = (args ?? {}) as Record<string, unknown>;
    if (name === 'set_contract_field') {
      writeField(a.p_field_key as string, { value: a.p_value as string });
      return result({ value: a.p_value });
    }
    if (name === 'set_field_structured') {
      writeField(a.p_field_key as string, { structured: a.p_structured });
      return result(null);
    }
    if (name === 'confirm_horse_section') {
      (P.contract_document_detail as { document: Record<string, unknown> })
        .document.horse_section_confirmed_at = new Date().toISOString();
      persist();
      return result(null);
    }
    if (name in P) return result(P[name]);
    if (name in EMPTY) return result(EMPTY[name]);
    return result(null);
  },
  from(table: string) {
    const row = table === 'profiles' ? PROFILE : table === 'members' ? { status: 'active' } : null;
    const chain: Record<string, unknown> = {};
    for (const m of ['select', 'eq', 'in', 'order', 'limit', 'is', 'neq', 'not', 'filter']) {
      chain[m] = () => chain;
    }
    chain.maybeSingle = () => result(row);
    chain.single = () => result(row);
    chain.then = (res: (v: unknown) => unknown) => result([]).then(res);
    return chain;
  },
  auth: {
    getSession: () => Promise.resolve({ data: { session: { user: ADMIN_USER } }, error: null }),
    getUser: () => Promise.resolve({ data: { user: ADMIN_USER }, error: null }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
    signOut: () => Promise.resolve({ error: null }),
  },
  channel() {
    const ch: Record<string, unknown> = {};
    ch.on = () => ch;
    ch.subscribe = () => ch;
    ch.track = () => Promise.resolve('ok');
    ch.presenceState = () => ({});
    ch.unsubscribe = () => Promise.resolve('ok');
    return ch;
  },
  removeChannel: () => Promise.resolve('ok'),
  storage: { from: () => ({ upload: () => result(null), getPublicUrl: () => ({ data: { publicUrl: '' } }) }) },
};

export type FunnelType = 'rider' | 'horse' | 'support';
export type ContactMethod = 'text' | 'call' | 'email';
export interface SelectedService {
  offeringId: string; offeringName: string; serviceType: string | null; price: number; unit: string;
}
