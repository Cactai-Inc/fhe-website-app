import { useCallback, useEffect, useState } from 'react';
import { X } from 'lucide-react';
import {
  contactDossier, updateContactRecord, setContactType,
  CONTACT_TYPE_LABEL, type ContactDossier, type ContactType,
} from '../../lib/api';
import { toErrorMessage } from '../../lib/ops/errors';
import {
  AssignDocumentsModal, ClientHorseRecordsCard, AttachOfferingPanel, PaperworkEditor,
} from './ClientRecordActions';
import { ProvisionClientForm } from './ProvisionClientForm';
import { AgreedLessonSection, type AgreedLesson } from './AgreedLessonPanel';
import { StaffStandingSlotSection } from './StandingSlotPicker';

/**
 * THE CONTACT DOSSIER — every person, one modal.
 *
 * Replaces the account-keyed client page for this purpose. That page took a
 * user_id, so it could not open for the 13 of 19 contacts without a login:
 * counterparties, kiosk signers, leads, and minors on a parent's account. This
 * keys on the contact and resolves to the account only when one exists.
 *
 * Account-only sections render only when `account` is present — the RPC returns
 * null rather than an empty list precisely so the UI can tell "nothing yet" from
 * "does not apply to this person".
 *
 * Layout here is deliberately plain: the owner will review the contents and
 * direct the arrangement. The goal of this pass is that nothing is MISSING and
 * everything editable is editable.
 */

type Tab = 'record' | 'relationships' | 'documents' | 'orders' | 'paperwork' | 'account' | 'activity';

const FIELD_GROUPS: { title: string; fields: [string, string][] }[] = [
  { title: 'Name and contact', fields: [
    ['first_name', 'First name'], ['last_name', 'Last name'],
    ['email', 'Email'],
    ['phone', 'Phone'], ['phone_ext', 'Phone ext.'],
    ['mobile', 'Mobile'], ['mobile_ext', 'Mobile ext.'],
    ['whatsapp', 'WhatsApp'],
    ['date_of_birth', 'Date of birth'],
  ]},
  { title: 'Mailing address', fields: [
    ['address_line1', 'Street'], ['address_line2', 'Apt / suite'],
    ['city', 'City'], ['state', 'State'], ['postal_code', 'ZIP'], ['country', 'Country'],
  ]},
  { title: 'Emergency contacts', fields: [
    ['emergency_contact_1_name', 'Contact 1 name'],
    ['emergency_contact_1_relationship', 'Relationship'],
    ['emergency_contact_1_phone', 'Phone'],
    ['emergency_contact_2_name', 'Contact 2 name'],
    ['emergency_contact_2_relationship', 'Relationship'],
    ['emergency_contact_2_phone', 'Phone'],
  ]},
  { title: 'Riding background', fields: [
    ['riding_experience_years', 'Years riding'], ['jump_experience', 'Jump experience'],
    ['riding_background', 'Background'], ['jump_limitations', 'Limitations'],
  ]},
  { title: 'Notes', fields: [['notes', 'Staff notes']] },
];

export function ContactDossierModal({
  contactId, onClose, onChanged,
}: {
  contactId: string;
  onClose: () => void;
  /** Fired after any save, so the list behind the modal can refresh. */
  onChanged?: () => void;
}) {
  const [d, setD] = useState<ContactDossier | null>(null);
  const [tab, setTab] = useState<Tab>('record');
  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState<Record<string, unknown>>({});

  const load = useCallback(() => {
    contactDossier(contactId)
      .then((x) => { setD(x); setDirty({}); })
      .catch((e) => setErr(toErrorMessage(e, 'Could not load this record.')));
  }, [contactId]);
  useEffect(load, [load]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const c = (d?.contact ?? {}) as Record<string, unknown>;
  /** TASK-ARCHIVE §3: contact_dossier now admits an archived contact so the
   *  deleted-accounts view has a full record to click through to. The row it
   *  returns carries deleted_at/deleted_by/deleted_reason, so this modal knows
   *  on its own — no caller has to tell it, and no second record view exists.
   *  Archived means READ-ONLY here: update_contact_record and the provisioning /
   *  offering / standing-slot writes all refuse an archived contact at the DB,
   *  and a control that can only fail is worse than no control. Restore the
   *  account (Records › Archived) to edit it again. */
  const archived = Boolean(c.deleted_at);

  async function save() {
    if (Object.keys(dirty).length === 0) return;
    setSaving(true); setErr(null);
    try {
      setD(await updateContactRecord(contactId, dirty));
      setDirty({});
      onChanged?.();
    } catch (e) {
      setErr(toErrorMessage(e, 'Could not save.'));
    } finally { setSaving(false); }
  }

  /* PROMOTION TO AN ACCOUNT, from the record itself. Someone without a login
     still has a full contact record — it simply holds less — and inviting them
     is the natural next step from the screen where you just reviewed them,
     rather than a separate hunt through another page. */
  const [assigning, setAssigning] = useState(false);
  /* PAMELA §A: only a SEND ends this surface's job. A SAVE leaves the form open,
     because the whole point of saving is that staff mean to come back to it. */
  const [invited, setInvited] = useState(false);
  // CLOSEOUT §3.5: the agreed-time panel's derived slot, fed into provisioning.
  const [agreedLesson, setAgreedLesson] = useState<AgreedLesson | null>(null);

  async function file(t: ContactType) {
    setErr(null);
    try { await setContactType(contactId, t); load(); onChanged?.(); }
    catch (e) { setErr(toErrorMessage(e, 'Could not file this contact.')); }
  }

  const val = (k: string) => {
    if (k in dirty) return String(dirty[k] ?? '');
    const v = c[k];
    return v === null || v === undefined ? '' : String(v);
  };
  const set = (k: string) => (v: string) => setDirty((p) => ({ ...p, [k]: v }));

  const name = [c.first_name, c.last_name].filter(Boolean).join(' ')
    || (c.email as string | null) || 'Contact';

  const input = 'w-full px-2.5 py-1.5 rounded-lg border border-green-800/15 text-sm text-green-900 focus-ring bg-white';
  const TABS: [Tab, string, number | null][] = [
    ['record', 'Record', null],
    ['relationships', 'Relationships', (d?.family.dependants.length ?? 0) + (d?.horses.length ?? 0)],
    ['documents', 'Documents', d?.documents.length ?? 0],
    ['orders', 'Orders', d?.orders.length ?? 0],
    ['paperwork', 'Paperwork', null],
    ['account', 'Account', null],
    ['activity', 'Activity', null],
  ];

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-green-950/40 px-4 py-8"
      role="dialog" aria-modal="true" aria-label={`${name} record`} onClick={onClose}>
      <div className="bg-white rounded-2xl border border-green-800/10 w-full max-w-3xl max-h-full flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}>

        <div className="flex items-start gap-3 px-5 py-4 border-b border-green-800/10">
          <div className="min-w-0 flex-1">
            <h2 className="font-serif text-xl text-green-900 truncate">{name}</h2>
            <p className="text-[11.5px] text-muted">
              {(c.display_code as string) ?? '—'}
              {d?.standing.contact_type && ` · ${CONTACT_TYPE_LABEL[d.standing.contact_type as ContactType] ?? d.standing.contact_type}`}
              {d?.account ? ' · has an account' : ' · no account'}
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close"
            className="p-1.5 rounded-lg text-muted hover:bg-green-800/5 focus-ring shrink-0">
            <X size={18} />
          </button>
        </div>

        {err && <p role="alert" className="form-error mx-5 mt-3">{err}</p>}

        {archived && (
          <div className="mx-5 mt-3 rounded-lg border border-gold-600/40 bg-gold-50/60 px-3 py-2.5">
            <p className="text-[12.5px] font-medium text-gold-900">
              Archived {new Date(String(c.deleted_at)).toLocaleString()} — read-only
            </p>
            <p className="text-[11.5px] text-secondary">
              {(c.deleted_reason as string | null) ?? 'No reason recorded.'} Everything below is
              exactly as it stood; nothing was removed to hide the account. Restore it from
              Records › Archived to make changes.
            </p>
          </div>
        )}

        <div className="flex flex-wrap gap-1.5 px-5 py-3 border-b border-green-800/10">
          {TABS.map(([id, label, count]) => (
            <button key={id} type="button" onClick={() => setTab(id)}
              aria-current={tab === id ? 'page' : undefined}
              className={`px-3 py-1.5 rounded-full text-[12.5px] focus-ring ${
                tab === id ? 'bg-green-800 text-white' : 'bg-green-800/10 text-green-800 hover:bg-green-800/20'}`}>
              {label}{count ? ` (${count})` : ''}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto overscroll-contain px-5 py-4">
          {!d ? <p className="text-sm text-muted">Loading…</p> : (
            <>
              {tab === 'record' && (
                <div className="flex flex-col gap-5">
                  <div>
                    <p className="text-[11px] uppercase tracking-wide text-muted mb-1.5">Filed under</p>
                    <div className="flex flex-wrap gap-1.5">
                      {/* DIRECTORY is deprecated (TASK-RECORDS, 2026-08-12) — split into
                          VENDOR and PARTNER. Not offered as a fresh pick, but shown if a
                          contact is already filed there so the picker never hides its own
                          current state. */}
                      {([
                        'LEAD', 'CONTACT', 'VENDOR', 'PARTNER', 'TEAM',
                        ...(d.standing.contact_type === 'DIRECTORY' ? ['DIRECTORY' as const] : []),
                      ] as ContactType[]).map((t) => (
                        <button key={t} type="button" onClick={() => void file(t)}
                          disabled={archived}
                          className={`text-[11px] px-2.5 py-1 rounded-full border focus-ring disabled:opacity-50 disabled:cursor-not-allowed ${
                            d.standing.contact_type === t
                              ? 'border-green-700 bg-green-50 text-green-900 font-medium'
                              : 'border-green-800/25 text-green-800 hover:bg-green-800/10'}`}>
                          {CONTACT_TYPE_LABEL[t]}
                        </button>
                      ))}
                      {d.standing.is_client && (
                        <span className="text-[11px] px-2.5 py-1 rounded-full bg-green-800 text-white">Client</span>
                      )}
                      {d.standing.groups.map((g) => (
                        <span key={g} className="text-[11px] px-2.5 py-1 rounded-full bg-cream-100 text-secondary border border-green-800/10">{g}</span>
                      ))}
                    </div>
                  </div>

                  {FIELD_GROUPS.map((g) => (
                    <div key={g.title}>
                      <p className="text-[11px] uppercase tracking-wide text-muted mb-2">{g.title}</p>
                      <div className="grid sm:grid-cols-2 gap-2.5">
                        {g.fields.map(([k, label]) => (
                          <div key={k} className={k === 'notes' || k === 'riding_background' ? 'sm:col-span-2' : ''}>
                            <label className="block text-[10px] uppercase tracking-wide text-muted mb-1" htmlFor={`f-${k}`}>{label}</label>
                            {k === 'notes' || k === 'riding_background' ? (
                              <textarea id={`f-${k}`} rows={2} className={`${input} resize-y`}
                                disabled={archived}
                                value={val(k)} onChange={(e) => set(k)(e.target.value)} />
                            ) : (
                              <input id={`f-${k}`} className={input}
                                disabled={archived}
                                type={k === 'date_of_birth' ? 'date' : 'text'}
                                value={val(k)} onChange={(e) => set(k)(e.target.value)} />
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {tab === 'relationships' && (
                <div className="flex flex-col gap-5">
                  <Section title="Guardian">
                    {d.family.guardian
                      ? <Row main={d.family.guardian.name} sub={d.family.guardian.email ?? undefined} />
                      : <Empty>No guardian on file.</Empty>}
                  </Section>
                  <Section title="Dependants">
                    {d.family.dependants.length === 0 ? <Empty>None.</Empty>
                      : d.family.dependants.map((x) => (
                        <Row key={x.contact_id} main={x.name}
                          sub={x.date_of_birth ? `born ${x.date_of_birth}` : undefined} />
                      ))}
                  </Section>
                  <Section title="Horses">
                    {d.horses.length === 0 ? <Empty>None.</Empty>
                      : d.horses.map((h) => <Row key={h.horse_id} main={h.name} badge={h.relation} />)}
                  </Section>
                  <Section title="Contract roles">
                    {d.standing.party_roles.length === 0 ? <Empty>Not a party to any contract.</Empty>
                      : <p className="text-sm text-green-900">{d.standing.party_roles.join(', ')}</p>}
                  </Section>
                </div>
              )}

              {tab === 'documents' && (
                <div className="flex flex-col gap-5">
                  {!archived && (
                    <div>
                      <button type="button" className="btn-secondary text-sm"
                        onClick={() => setAssigning(true)}>
                        Assign a document or contract
                      </button>
                    </div>
                  )}
                  <Section title="Documents">
                    {d.documents.length === 0 ? <Empty>None.</Empty>
                      : d.documents.map((x) => (
                        <Row key={x.document_id} main={x.title ?? x.code ?? 'Document'}
                          sub={new Date(x.generated_at).toLocaleDateString()}
                          badge={x.current_status === 'superseded' ? 'superseded' : x.status} />
                      ))}
                  </Section>
                  {/* Horse records sit beside the document list because the
                      horse-care documents cannot be completed without them. */}
                  <ClientHorseRecordsCard contactId={contactId} />
                </div>
              )}

              {tab === 'orders' && (
                <div className="flex flex-col gap-5">
                  {/* SLOTREACH §2 — a weekly plan's standing time lives on the
                      purchase item, so this is where it belongs: beside the orders
                      that carry it. Renders nothing for a contact with no weekly
                      purchase. */}
                  {!archived && (
                    <>
                      <StaffStandingSlotSection
                        contactId={contactId}
                        personName={[c.first_name, c.last_name].filter(Boolean).join(' ') || null}
                      />
                      <AttachOfferingPanel contactId={contactId} onAttached={load} />
                    </>
                  )}
                  <Section title="Orders">
                  {d.orders.length === 0 ? <Empty>None.</Empty>
                    : d.orders.map((o) => (
                      <Row key={o.purchase_id}
                        main={`$${Number(o.amount ?? 0).toFixed(2)}${o.code ? ` · ${o.code}` : ''}`}
                        sub={new Date(o.created_at).toLocaleDateString()}
                        badge={o.payment_status ?? o.status} />
                    ))}
                  </Section>
                </div>
              )}

              {tab === 'paperwork' && <PaperworkEditor contactId={contactId} />}

              {tab === 'account' && (
                d.account ? (
                  <div className="flex flex-col gap-5">
                    {/* SLOTREACH §2 — the standing weekly time sits on the same
                        surface as the agreed lesson below, deliberately adjacent and
                        deliberately distinct: that one books THE lesson agreed on the
                        call, this one sets THE WEEKLY TIME that is theirs. */}
                    {!archived && (
                      <StaffStandingSlotSection
                        contactId={contactId}
                        personName={[c.first_name, c.last_name].filter(Boolean).join(' ') || null}
                      />
                    )}
                    <Section title="Account">
                      <Row main={d.account.display_name ?? '(no display name)'} sub={d.account.role ?? undefined}
                        badge={d.account.is_suspended ? 'suspended' : (d.account.member_status ?? undefined)} />
                    </Section>
                    <Section title="Sign-in">
                      <Row main={d.account.login?.providers.join(', ') || 'no provider on file'}
                        sub={d.account.login?.last_sign_in_at
                          ? `last seen ${new Date(d.account.login.last_sign_in_at).toLocaleString()}`
                          : 'never signed in'} />
                    </Section>
                    {d.posts && (
                      <Section title="Posts">
                        {d.posts.length === 0 ? <Empty>None.</Empty>
                          : d.posts.map((p) => (
                            <Row key={p.id} main={p.body || `(${p.post_type})`}
                              sub={new Date(p.created_at).toLocaleDateString()}
                              badge={p.pulled_down ? 'pulled' : p.published ? 'live' : 'draft'} />
                          ))}
                      </Section>
                    )}
                  </div>
                ) : (
                  <div className="flex flex-col gap-3">
                    {/* SLOTREACH §2 — a contact can hold a weekly purchase before they
                        ever have a login (staff attach the offering, the invitation
                        follows). Their standing time is settable either way. */}
                    {!archived && (
                      <StaffStandingSlotSection
                        contactId={contactId}
                        personName={[c.first_name, c.last_name].filter(Boolean).join(' ') || null}
                      />
                    )}
                    <Empty>
                      This person has no account — they have never signed in. That is
                      normal for a counterparty, a lead, or a minor on a parent&apos;s account.
                      Their contact record is complete in its own right; an account
                      simply adds a login.
                    </Empty>
                    {archived ? (
                      <p className="text-[11.5px] text-muted">
                        Restore this account from Records › Archived before provisioning it.
                      </p>
                    ) : invited ? (
                      <p className="text-sm text-green-800">
                        Invitation sent to {String(c.email)}.
                      </p>
                    ) : !c.email ? (
                      <p className="text-[11.5px] text-muted">
                        Add an email address on the Record tab first — then they can be
                        provisioned and invited from here.
                      </p>
                    ) : (
                      /* THE ONE shared provisioning path (deal plan L11). This modal
                         previously called adminSendInvitation directly with just an
                         email and name, which takes the plain-invite branch: no
                         category, no paperwork, no offerings — so the same person got
                         a materially different account depending on which button
                         staff happened to use. */
                      <ProvisionClientForm source="contact" contactId={contactId}
                        email={(c.email as string | null) ?? undefined}
                        firstName={(c.first_name as string | null) ?? undefined}
                        lastName={(c.last_name as string | null) ?? undefined}
                        agreedLesson={agreedLesson}
                        onProvisioned={(r) => { if (r.inviteStatus !== 'draft') setInvited(true); onChanged?.(); }}
                        /* CLOSEOUT §3.5: a lesson agreed on the phone folds into
                           the same act on every provisioning surface, not just the
                           lead drawer. PAMELA §A: shown only for a rider or a
                           scheduling-shaped order. */
                        scheduling={<AgreedLessonSection onAgreedChange={setAgreedLesson} />} />
                    )}
                  </div>
                )
              )}

              {tab === 'activity' && (
                <div className="flex flex-col gap-5">
                  <Section title="Notifications">
                    {d.notifications.length === 0 ? <Empty>None.</Empty>
                      : d.notifications.map((n) => (
                        <Row key={n.id} main={n.title} sub={new Date(n.created_at).toLocaleString()} />
                      ))}
                  </Section>
                  {d.activity && (
                    <Section title="Audit trail">
                      {d.activity.length === 0 ? <Empty>None.</Empty>
                        : d.activity.map((a) => (
                          <Row key={a.id} main={a.action} sub={`${a.table_name ?? ''} · ${new Date(a.occurred_at).toLocaleString()}`} />
                        ))}
                    </Section>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        <div className="flex items-center gap-2 px-5 py-3 border-t border-green-800/10">
          {Object.keys(dirty).length > 0 && (
            <span className="text-[12px] text-gold-800">
              {Object.keys(dirty).length} unsaved change{Object.keys(dirty).length === 1 ? '' : 's'}
            </span>
          )}
          <div className="ml-auto flex gap-2">
            <button type="button" className="btn-secondary text-sm" onClick={onClose}>Close</button>
            <button type="button" className="btn-primary text-sm"
              disabled={archived || saving || Object.keys(dirty).length === 0} onClick={() => void save()}>
              {saving ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        </div>
      </div>

      {assigning && (
        <AssignDocumentsModal
          contactId={contactId}
          onClose={() => setAssigning(false)}
          onAssigned={() => { setAssigning(false); load(); onChanged?.(); }}
        />
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wide text-muted mb-2">{title}</p>
      <div className="flex flex-col gap-1.5">{children}</div>
    </div>
  );
}

function Row({ main, sub, badge }: { main: string; sub?: string; badge?: string }) {
  return (
    <div className="flex items-baseline gap-2 border-b border-green-800/[0.06] pb-1.5">
      <span className="text-sm text-green-900 min-w-0 flex-1">{main}</span>
      {sub && <span className="text-[11px] text-muted shrink-0">{sub}</span>}
      {badge && (
        <span className="text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full bg-cream-100 text-secondary border border-green-800/10 shrink-0">
          {badge}
        </span>
      )}
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-muted">{children}</p>;
}
