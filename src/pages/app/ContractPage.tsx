import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  FileText, CheckCircle2, Lock, Send, PenLine, ShieldCheck, RotateCcw,
  MessageSquarePlus, Mail,
} from 'lucide-react';
import { useDocumentTitle } from '../../lib/hooks';
import { useAuth } from '../../contexts/AuthContext';
import {
  contractDocumentDetail, setContractField, requestDocumentChange,
  resolveChangeRequest, advanceWorkflow, lockAndSign, confirmHorseSection,
  reopenHorseSection, setRecipientEditing, inviteCounterparty, composeCostPhrase,
  type ContractDetail, type ContractField,
} from '../../lib/contracts';

/**
 * CONTRACT (/app/contracts/:id) — the negotiated-contract surface (Update A).
 * One page, two postures decided by the caller's relationship to the document:
 *  - OWNER/STAFF authoring: fields grouped by section (cost categories compose
 *    "Lessor 60% / Lessee 40%" phrases), the Lessor horse-confirm control, the
 *    recipient-editing toggle, counterparty invite, workflow advance, sign-last.
 *  - COUNTERPARTY: their intake (can_edit fields only), change requests on DEAL
 *    terms when recipient_editing, the finished document review, sign-first.
 * The engine (RLS + ownership matrix + state machine + re-merge at lock) is the
 * authority — this page only calls its RPCs and renders what detail returns.
 */

const COST_SECTIONS = new Set(['Cost Allocation', 'Insurance']);

function FieldInput({
  f, onSave,
}: { f: ContractField; onSave: (key: string, value: string) => Promise<void> }) {
  const [val, setVal] = useState(f.value ?? '');
  const [saving, setSaving] = useState(false);
  useEffect(() => { setVal(f.value ?? ''); }, [f.value]);

  async function save() {
    if ((f.value ?? '') === val) return;
    setSaving(true);
    try { await onSave(f.field_key, val); } finally { setSaving(false); }
  }

  const base = 'w-full px-3 py-2 rounded-lg border border-green-800/15 text-sm text-green-900 focus-ring disabled:bg-green-800/[0.04] disabled:text-muted';
  if (!f.can_edit) {
    return <p className="text-sm text-green-900 whitespace-pre-line min-h-[1.5rem]">{f.value || <span className="text-muted">—</span>}</p>;
  }
  if (f.value_type === 'longtext') {
    return <textarea rows={3} className={base} value={val} disabled={saving}
      onChange={(e) => setVal(e.target.value)} onBlur={() => void save()} />;
  }
  if (f.value_type === 'date') {
    return <input type="date" className={base} value={val} disabled={saving}
      onChange={(e) => setVal(e.target.value)} onBlur={() => void save()} />;
  }
  if (f.field_key === 'TXN.LEASE_TYPE') {
    return (
      <select className={base} value={val} disabled={saving}
        onChange={(e) => { setVal(e.target.value); void onSave(f.field_key, e.target.value); }}>
        <option value="">Select…</option>
        <option value="Full Lease">Full Lease</option>
        <option value="Partial Lease">Partial Lease</option>
      </select>
    );
  }
  return <input className={base} value={val} disabled={saving}
    onChange={(e) => setVal(e.target.value)} onBlur={() => void save()} />;
}

/** Composer for cost/insurance *_COST fields: responsibility + split → phrase. */
function CostComposer({
  f, onSave,
}: { f: ContractField; onSave: (key: string, value: string) => Promise<void> }) {
  const parsed = useMemo(() => {
    const v = f.value ?? '';
    if (/^Lessee 100%$/i.test(v)) return { resp: 'Lessee' as const, pct: 0 };
    if (/^Lessor 100%$/i.test(v)) return { resp: 'Lessor' as const, pct: 100 };
    const m = v.match(/Lessor\s+(\d+)%/i);
    if (m) return { resp: 'Split' as const, pct: Number(m[1]) };
    return { resp: '' as const, pct: 50 };
  }, [f.value]);
  const [resp, setResp] = useState<'Lessor' | 'Lessee' | 'Split' | ''>(parsed.resp);
  const [pct, setPct] = useState(parsed.pct || 50);
  useEffect(() => { setResp(parsed.resp); setPct(parsed.pct || 50); }, [parsed.resp, parsed.pct]);

  if (!f.can_edit) {
    return <p className="text-sm text-green-900">{f.value || <span className="text-muted">— (omitted)</span>}</p>;
  }
  function apply(r: typeof resp, p: number) {
    void onSave(f.field_key, composeCostPhrase(r, p));
  }
  return (
    <div className="flex items-center gap-2">
      <select
        className="px-2 py-1.5 rounded-lg border border-green-800/15 text-sm focus-ring"
        value={resp}
        onChange={(e) => {
          const r = e.target.value as typeof resp;
          setResp(r);
          if (r === '') void onSave(f.field_key, '');
          else apply(r, pct);
        }}
      >
        <option value="">Omit</option>
        <option value="Lessor">Lessor</option>
        <option value="Lessee">Lessee</option>
        <option value="Split">Split</option>
      </select>
      {resp === 'Split' && (
        <>
          <input type="number" min={0} max={100} value={pct}
            className="w-20 px-2 py-1.5 rounded-lg border border-green-800/15 text-sm focus-ring"
            onChange={(e) => setPct(Number(e.target.value))}
            onBlur={() => apply('Split', pct)} />
          <span className="text-xs text-muted">% Lessor</span>
        </>
      )}
      {f.value && <span className="text-xs text-green-700 font-medium">{f.value}</span>}
    </div>
  );
}

export default function ContractPage() {
  const { id } = useParams<{ id: string }>();
  useDocumentTitle('Contract');
  const { isStaff } = useAuth();
  const [detail, setDetail] = useState<ContractDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [signName, setSignName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('');
  const [crFieldKey, setCrFieldKey] = useState<string | null>(null);
  const [crText, setCrText] = useState('');
  const [showBody, setShowBody] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      setDetail(await contractDocumentDetail(id));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load the contract.');
    }
  }, [id]);
  useEffect(() => { void load(); }, [load]);

  const doc = detail?.document;
  const myRoles = detail?.my_roles ?? [];
  const isOwnerSide = isStaff || (doc?.is_originator ?? false);
  const isLessor = myRoles.includes('LESSOR');
  const state = doc?.workflow_state ?? 'editable';
  const editablePhase = state === 'editable' || state === 'editing';
  const horseConfirmed = !!doc?.horse_section_confirmed_at;
  const iSigned = (detail?.signatures ?? []).some(
    (s) => s.signed_at && myRoles.includes(s.party_role));
  const counterpartySigned = (detail?.signatures ?? []).some((s) => s.signed_at);
  // the seats an outside party can be invited into (not mine, not the company's)
  const invitableRoles = Array.from(new Set((detail?.signatures ?? [])
    .map((s) => s.party_role)
    .filter((r) => !myRoles.includes(r) && r !== 'FHE' && r !== 'COMPANY')));

  const sections = useMemo(() => {
    const by = new Map<string, ContractField[]>();
    for (const f of detail?.fields ?? []) {
      const k = f.section || 'Terms';
      (by.get(k) ?? by.set(k, []).get(k)!).push(f);
    }
    return Array.from(by.entries());
  }, [detail?.fields]);

  async function act(fn: () => Promise<unknown>, okMsg?: string) {
    setError(null); setNote(null);
    try {
      await fn();
      if (okMsg) setNote(okMsg);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'That action failed.');
    }
  }

  const saveField = useCallback(async (key: string, value: string) => {
    try {
      await setContractField(id!, key, value);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save that field.');
    }
  }, [id, load]);

  if (error && !detail) return <p role="alert" className="form-error">{error}</p>;
  if (!detail || !doc) return <p className="body-text text-muted text-sm">Loading the contract…</p>;

  const STATE_LABEL: Record<string, string> = {
    editable: 'In progress', editing: 'Being edited', in_review: 'In review',
    locked: 'Ready to sign', executed: 'Executed', void: 'Void',
  };

  return (
    <div className="max-w-3xl">
      <div className="flex items-start justify-between gap-3 mb-1">
        <h1 className="font-serif text-2xl text-green-900 flex items-center gap-2">
          <FileText size={22} className="text-gold-ink" /> {doc.title}
        </h1>
        <span className={`text-xs font-sans px-2.5 py-1 rounded-full whitespace-nowrap ${
          state === 'executed' ? 'bg-green-800 text-white'
          : state === 'locked' ? 'bg-gold-50 text-gold-ink' : 'bg-green-800/10 text-green-800'
        }`}>
          {STATE_LABEL[state] ?? state}
        </span>
      </div>
      <p className="text-sm text-muted mb-5">
        {isOwnerSide
          ? 'You are authoring this contract. Fill the terms, confirm the horse information, share, then sign last.'
          : 'Complete your information below, review the finished document, and sign.'}
      </p>

      {error && <p role="alert" className="form-error mb-3">{error}</p>}
      {note && <p className="mb-3 rounded px-4 py-2 text-sm bg-green-50 text-green-900">{note}</p>}

      {/* Executed: the sealed document */}
      {state === 'executed' && (
        <div className="bg-white border border-green-800/10 rounded-lg p-6 mb-6">
          <p className="inline-flex items-center gap-2 text-green-800 font-medium text-sm mb-3">
            <CheckCircle2 size={16} /> Executed{doc.execution_hash ? ` · ${doc.execution_hash.slice(0, 12)}…` : ''}
          </p>
          <div className="prose-sm max-h-[70vh] overflow-y-auto whitespace-pre-line text-[13px] leading-relaxed text-green-950 bg-cream-100/50 border border-green-800/10 rounded p-5">
            {doc.merged_body}
          </div>
        </div>
      )}

      {/* Owner-side controls */}
      {isOwnerSide && editablePhase && (
        <div className="bg-white border border-green-800/10 rounded-lg p-4 mb-5 flex flex-wrap items-center gap-3">
          <label className="inline-flex items-center gap-2 text-sm text-secondary">
            <input type="checkbox" checked={doc.recipient_editing}
              onChange={(e) => void act(() => setRecipientEditing(id!, e.target.checked))} />
            Counterparty may suggest changes
          </label>
          <div className="flex items-center gap-2 ml-auto flex-wrap">
            <input type="email" placeholder="counterparty@email.com" value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              className="px-3 py-1.5 rounded-lg border border-green-800/15 text-sm focus-ring w-52" />
            {/* which seat they're invited into — derived from the contract's parties */}
            <select value={inviteRole || invitableRoles[0] || ''} aria-label="Invite as"
              onChange={(e) => setInviteRole(e.target.value)}
              className="px-2 py-1.5 rounded-lg border border-green-800/15 text-sm bg-white focus-ring">
              {(invitableRoles.length ? invitableRoles : ['LESSOR']).map((r) => (
                <option key={r} value={r}>{r.charAt(0) + r.slice(1).toLowerCase()}</option>
              ))}
            </select>
            <button type="button" className="btn-outline-gold text-xs"
              disabled={!inviteEmail}
              onClick={() => void act(
                () => inviteCounterparty(id!, inviteRole || invitableRoles[0] || 'LESSOR', inviteEmail),
                'Invitation sent.')}>
              <Mail size={13} /> Invite
            </button>
          </div>
        </div>
      )}

      {/* Field sections */}
      {state !== 'executed' && sections.map(([section, fields]) => {
        const isHorse = section === 'Horse';
        const anyEditable = fields.some((f) => f.can_edit);
        // counterparty intake: show only sections with something for them (or filled)
        if (!isOwnerSide && !anyEditable && !fields.some((f) => f.value)) return null;
        return (
          <section key={section} className="bg-white border border-green-800/10 rounded-lg p-5 mb-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-serif text-green-800">{section}</h2>
              {isHorse && (
                horseConfirmed ? (
                  <span className="inline-flex items-center gap-1.5 text-xs text-green-700">
                    <ShieldCheck size={14} /> Confirmed accurate
                    {(isLessor || isStaff) && editablePhase && (
                      <button type="button" className="underline text-muted ml-2"
                        onClick={() => void act(() => reopenHorseSection(id!))}>
                        <RotateCcw size={11} className="inline" /> reopen
                      </button>
                    )}
                  </span>
                ) : (isLessor || isStaff) && editablePhase ? (
                  <button type="button" className="btn-outline-gold text-xs"
                    onClick={() => void act(() => confirmHorseSection(id!), 'Horse information confirmed.')}>
                    <ShieldCheck size={13} /> I reviewed the horse info — it's accurate
                  </button>
                ) : (
                  <span className="text-xs text-muted">Awaiting Lessor confirmation</span>
                )
              )}
            </div>
            <div className="grid sm:grid-cols-2 gap-x-5 gap-y-3">
              {fields.map((f) => (
                <div key={f.field_key} className={f.value_type === 'longtext' ? 'sm:col-span-2' : ''}>
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className="text-[11.5px] font-medium text-secondary">{f.label ?? f.field_key}</span>
                    {f.required && <span className="text-red-700 text-xs">*</span>}
                    {/* counterparty change-request affordance on DEAL fields */}
                    {!isOwnerSide && doc.recipient_editing && f.owner_role === 'DEAL'
                      && !f.can_edit && editablePhase && (
                      <button type="button" className="text-muted hover:text-gold-ink" title="Request a change"
                        onClick={() => { setCrFieldKey(f.field_key); setCrText(''); }}>
                        <MessageSquarePlus size={13} />
                      </button>
                    )}
                  </div>
                  {COST_SECTIONS.has(section) && f.field_key.endsWith('_COST')
                    ? <CostComposer f={f} onSave={saveField} />
                    : <FieldInput f={f} onSave={saveField} />}
                </div>
              ))}
            </div>
          </section>
        );
      })}

      {/* change-request composer */}
      {crFieldKey && (
        <div className="bg-gold-50 border border-gold-400/30 rounded-lg p-4 mb-4">
          <p className="text-sm font-medium text-green-900 mb-2">Request a change to {crFieldKey}</p>
          <textarea rows={2} className="w-full px-3 py-2 rounded-lg border border-green-800/15 text-sm focus-ring"
            value={crText} onChange={(e) => setCrText(e.target.value)}
            placeholder="What should this say instead, and why?" />
          <div className="flex gap-2 mt-2">
            <button type="button" className="btn-primary text-xs" disabled={!crText.trim()}
              onClick={() => void act(async () => {
                await requestDocumentChange(id!, crFieldKey, crText.trim());
                setCrFieldKey(null);
              }, 'Change request sent.')}>
              Send request
            </button>
            <button type="button" className="btn-secondary text-xs" onClick={() => setCrFieldKey(null)}>Cancel</button>
          </div>
        </div>
      )}

      {/* open change requests */}
      {(detail.open_change_requests.length > 0) && state !== 'executed' && (
        <section className="bg-white border border-gold-400/40 rounded-lg p-5 mb-4">
          <h2 className="font-serif text-green-800 mb-3">Open change requests</h2>
          <div className="flex flex-col gap-3">
            {detail.open_change_requests.map((cr) => (
              <div key={cr.id} className="border border-green-800/10 rounded p-3">
                <p className="text-xs text-muted mb-1">
                  #{cr.annotation_number} · {cr.target_field_key ?? cr.target_section ?? 'general'}
                  {cr.current_value ? ` · currently "${cr.current_value}"` : ''}
                </p>
                <p className="text-sm text-green-900 mb-2">{cr.requested_change}</p>
                {isOwnerSide && (
                  <div className="flex gap-2">
                    <button type="button" className="btn-primary text-xs"
                      onClick={() => void act(() => resolveChangeRequest(cr.id, true, null), 'Change accepted.')}>
                      Accept
                    </button>
                    <button type="button" className="btn-secondary text-xs"
                      onClick={() => void act(() => resolveChangeRequest(cr.id, false), 'Change rejected.')}>
                      Reject
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* document preview (pre-executed) */}
      {state !== 'executed' && doc.merged_body && (
        <section className="bg-white border border-green-800/10 rounded-lg p-5 mb-4">
          <button type="button" className="font-serif text-green-800 underline-offset-4 hover:underline"
            onClick={() => setShowBody((v) => !v)}>
            {showBody ? 'Hide' : 'Review'} the document text
          </button>
          {showBody && (
            <div className="mt-3 max-h-[60vh] overflow-y-auto whitespace-pre-line text-[13px] leading-relaxed text-green-950 bg-cream-100/50 border border-green-800/10 rounded p-5">
              {doc.merged_body}
            </div>
          )}
        </section>
      )}

      {/* workflow + signing */}
      {state !== 'executed' && state !== 'void' && (
        <section className="bg-white border border-green-800/10 rounded-lg p-5">
          <h2 className="font-serif text-green-800 mb-3">Next steps</h2>
          <div className="flex flex-wrap items-center gap-2 mb-4">
            {isOwnerSide && editablePhase && (
              <>
                <button type="button" className="btn-secondary text-xs"
                  onClick={() => void act(() => advanceWorkflow(id!, 'in_review'), 'Sent for review.')}>
                  <Send size={13} /> Send for review
                </button>
                <button type="button" className="btn-outline-gold text-xs"
                  onClick={() => void act(() => advanceWorkflow(id!, 'locked'), 'Locked — the final document is ready to sign.')}>
                  <Lock size={13} /> Lock for signing
                </button>
              </>
            )}
            {isOwnerSide && state === 'in_review' && (
              <>
                <button type="button" className="btn-secondary text-xs"
                  onClick={() => void act(() => advanceWorkflow(id!, 'editable'))}>
                  Back to editing
                </button>
                <button type="button" className="btn-outline-gold text-xs"
                  onClick={() => void act(() => advanceWorkflow(id!, 'locked'), 'Locked — ready to sign.')}>
                  <Lock size={13} /> Lock for signing
                </button>
              </>
            )}
            {isOwnerSide && state === 'locked' && !counterpartySigned && (
              <button type="button" className="btn-secondary text-xs"
                onClick={() => void act(() => advanceWorkflow(id!, 'editable'), 'Reopened for corrections.')}>
                <RotateCcw size={13} /> Withdraw / correct
              </button>
            )}
          </div>

          {/* signing: counterparty first when they owe input; owner reviews + signs last */}
          {state === 'locked' && myRoles.length > 0 && !iSigned && (
            <div className="border-t border-green-800/10 pt-4">
              <p className="text-sm text-secondary mb-2">
                Sign as <strong>{myRoles[0]}</strong> — typing your full legal name is your signature.
              </p>
              <div className="flex gap-2">
                <input value={signName} onChange={(e) => setSignName(e.target.value)}
                  placeholder="Full legal name"
                  className="px-3 py-2 rounded-lg border border-green-800/15 text-sm focus-ring w-64" />
                <button type="button" className="btn-primary text-sm" disabled={!signName.trim()}
                  onClick={() => void act(() => lockAndSign(id!, myRoles[0], signName.trim()), 'Signed.')}>
                  <PenLine size={14} /> Sign
                </button>
              </div>
            </div>
          )}
          {iSigned && (
            <p className="text-sm text-green-700 inline-flex items-center gap-1.5">
              <CheckCircle2 size={15} /> You've signed — awaiting the remaining signature.
            </p>
          )}

          {/* signature status */}
          {detail.signatures.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-3">
              {detail.signatures.map((s) => (
                <span key={s.party_role} className={`text-xs px-2.5 py-1 rounded-full ${
                  s.signed_at ? 'bg-green-800/10 text-green-800' : 'bg-cream-100 text-muted border border-green-800/10'
                }`}>
                  {s.party_role}: {s.signed_at ? `signed${s.typed_name ? ` — ${s.typed_name}` : ''}` : 'pending'}
                </span>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
