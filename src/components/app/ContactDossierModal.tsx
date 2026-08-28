import { useCallback, useEffect, useState } from 'react';
import { X } from 'lucide-react';
import {
  contactDossier, updateContactRecord, setContactType,
  listLookupOptionsAll, addLookupValue,
  CONTACT_TYPE_LABEL, type ContactDossier, type ContactType,
} from '../../lib/api';
import { toErrorMessage } from '../../lib/ops/errors';
import type { LookupCode } from '../../lib/ops/types';
import {
  AssignDocumentsModal, ClientHorseRecordsCard, AttachOfferingPanel, PaperworkEditor,
} from './ClientRecordActions';
import { ProvisionClientForm } from './ProvisionClientForm';
import { TAG_LABEL, TAG_REASON } from '../../lib/admin';
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
    /* ⚠️ ONE MOBILE NUMBER (INTAKE 2026-08-24). `phone` and `mobile` were never
       two facts — owner: "there is no difference with mobile." `phone` is the
       column with the data (21 contacts vs 2) so it keeps the data and gets the
       honest label; `mobile`, `mobile_ext` and `phone_ext` leave this editor
       (columns retained, D32 — `mobile`'s two values were folded into `phone`,
       and both ext columns were empty on every contact). */
    ['phone', 'Mobile number'],
    ['text_only_phone', 'Texts-only number'],
    ['preferred_contact', 'Preferred contact'],
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

const dossierInput = 'w-full px-2.5 py-1.5 rounded-lg border border-green-800/15 text-sm text-green-900 focus-ring bg-white disabled:bg-cream-100 disabled:text-muted';
const OTHER = '__other__';

/**
 * ORIGIN / CHANNEL SELECT (TASK-ORIGIN §4/§6) — a constrained dropdown over a
 * `lookup_options` vocabulary, plus the same "Other (enter manually)…" escape
 * HorseIntakeForm's SelectOrOther already established as how a menu grows
 * (owner, 2026-08-25): typing a value there ADDS it via `addLookupValue`, the
 * one write path, rather than storing loose text. No N/A here — unlike a
 * horse record's fields, "not recorded yet" already has an honest state
 * (NULL / the blank option), so there is nothing separate to mark absent.
 *
 * ⚠️ T4: options are fetched UNFILTERED by `active` (`listLookupOptionsAll`),
 * not the active-only `listLookupOptions` every other vocabulary picker uses.
 * A record can hold a code that was later switched off, and the dropdown
 * still must render its real name — filtering active-only at fetch time is
 * exactly the trap that makes HorseRecordsPage's breed/color columns fall
 * back to a raw code for a retired value. The SELECT's OFFERED options are
 * still active-only (plus whatever the record already holds), same idiom.
 */
function OriginChannelSelect({
  label, lookupKey, value, onChange, disabled,
}: {
  label: string;
  lookupKey: string;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  const [options, setOptions] = useState<LookupCode[] | null>(null);
  useEffect(() => {
    listLookupOptionsAll(lookupKey).then(setOptions).catch(() => setOptions([]));
  }, [lookupKey]);

  const known = options ?? [];
  const isKnown = !!value && known.some((o) => o.code === value);
  const isOther = !!value && !isKnown;
  const [otherOpen, setOtherOpen] = useState(isOther);
  const selectValue = otherOpen || isOther ? OTHER : (isKnown ? value : '');
  const selectable = known.filter((o) => o.active || o.code === value);

  return (
    <div>
      <label className="block text-[10px] uppercase tracking-wide text-muted mb-1">{label}</label>
      <select className={dossierInput} disabled={disabled || !options}
        value={selectValue}
        onChange={(e) => {
          if (e.target.value === OTHER) { setOtherOpen(true); onChange(''); }
          else { setOtherOpen(false); onChange(e.target.value); }
        }}>
        <option value="">{options ? 'Not recorded' : 'Loading…'}</option>
        <option value={OTHER}>Other (enter manually)…</option>
        {selectable.map((o) => <option key={o.code} value={o.code}>{o.display_name}</option>)}
      </select>
      {(otherOpen || isOther) && !disabled && (
        <input className={`${dossierInput} mt-1.5`} value={isKnown ? '' : (value ?? '')}
          placeholder="Type it — it joins the list"
          onChange={(e) => onChange(e.target.value)}
          onBlur={(e) => {
            const v = e.target.value.trim();
            if (!v) return;
            // Same engine as HorseIntakeForm's escape: adds it to the
            // vocabulary and stores the CODE, so the roster's filter and the
            // editor's list agree with whatever this saves.
            void addLookupValue(lookupKey, v)
              .then((r) => {
                setOptions((prev) => [...(prev ?? []), { code: r.code, display_name: r.display_name, active: true, sort_order: 900 }]);
                onChange(r.code);
                setOtherOpen(false);
              })
              .catch(() => {});
          }} />
      )}
    </div>
  );
}

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
      {/* ⚠️ ONE SIZE, ALWAYS (owner, 2026-08-25): "keep it one size dont change it
          based on the contents when i switch tabs it is constantly resizing and it
          stays center aligned which makes it really uncomfortable." `max-h-full` let
          the height follow the tab's content, so every tab change re-centred the box
          under the cursor. A fixed height holds still; the body scrolls instead. */}
      <div className="bg-white rounded-2xl border border-green-800/10 w-full max-w-3xl h-[85vh] flex flex-col overflow-hidden"
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
                      {/* ⚠️ DERIVED TAGS, AND THEY SAY WHY (OFFERINGDOCS 2026-08-24).
                          These are applied automatically — by a purchase, a horse,
                          a file, or a contract — and never ticked by anyone. They
                          used to render as raw tokens (HORSE_OWNER, and now
                          DEAL_PARTY), which reads as a system value rather than a
                          fact about a person. The reason rides in the tooltip
                          because a tag nobody can account for is a tag nobody
                          trusts — the same rule CATEGORISE applied to prefills. */}
                      {d.standing.groups.map((g) => (
                        <span key={g} title={TAG_REASON[g] ?? 'derived from their record'}
                          className="text-[11px] px-2.5 py-1 rounded-full bg-cream-100 text-secondary border border-green-800/10 cursor-help">
                          {TAG_LABEL[g] ?? g}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* TASK-ORIGIN §1/§6 — ORIGIN and CHANNEL are not the same
                      question and do not share a field. Beside the standing
                      fields, on the record he is already reviewing — not a
                      separate data-entry screen. */}
                  <div>
                    <p className="text-[11px] uppercase tracking-wide text-muted mb-2">Where they came from</p>
                    <div className="grid sm:grid-cols-2 gap-2.5">
                      <OriginChannelSelect label="Client origin" lookupKey="client_origin"
                        disabled={archived} value={val('client_origin')} onChange={set('client_origin')} />
                      <OriginChannelSelect label="Contact channel" lookupKey="contact_channel"
                        disabled={archived} value={val('contact_channel')} onChange={set('contact_channel')} />
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
                  {/* ⚠️ THE ORDER COMES FIRST (owner, 2026-08-25): "the order should be
                      the first thing on the page not the last". It was last, under a
                      standing-time editor for a plan the reader had not been shown yet.
                      Its line items sit under it, and the way to add another sits under
                      THEM — so the shape of the section reads in the order the work
                      happens. */}
                  <Section title="Orders">
                    {d.orders.length === 0 ? <Empty>None.</Empty>
                      : d.orders.map((o) => (
                        <div key={o.purchase_id} className="flex flex-col gap-1.5">
                          <Row
                            main={`$${Number(o.amount ?? 0).toFixed(2)}${o.code ? ` · ${o.code}` : ''}`}
                            sub={new Date(o.created_at).toLocaleDateString()}
                            badge={o.payment_status ?? o.status} />
                          {(o.items ?? []).map((it) => (
                            <div key={it.item_id}
                              className={`flex items-baseline gap-2 pl-4 text-sm ${it.voided_at ? 'text-muted line-through' : 'text-green-900'}`}>
                              <span className="min-w-0 flex-1">
                                {it.label ?? 'Offering'}
                                {(it.quantity ?? 1) > 1 ? ` × ${it.quantity}` : ''}
                              </span>
                              <span className="text-[11px] text-muted shrink-0">
                                ${Number(it.price_amount ?? 0).toFixed(2)}
                                {it.price_unit ? ` / ${it.price_unit}` : ''}
                              </span>
                            </div>
                          ))}
                        </div>
                      ))}
                    {!archived && <AttachOfferingPanel contactId={contactId} onAttached={load} />}
                  </Section>

                  {/* SLOTREACH §2 — a weekly plan's standing time lives on the
                      purchase item, so this is where it belongs: beside the orders
                      that carry it. Renders nothing for a contact with no weekly
                      purchase. */}
                  {!archived && (
                    <StaffStandingSlotSection
                      contactId={contactId}
                      personName={[c.first_name, c.last_name].filter(Boolean).join(' ') || null}
                    />
                  )}
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
