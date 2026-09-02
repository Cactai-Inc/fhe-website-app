import { useCallback, useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { Link } from 'react-router-dom';
import {
  contactDossier, updateContactRecord, setContactType,
  listLookupOptionsAll, addLookupValue,
  CONTACT_TYPE_LABEL, type ContactDossier, type ContactType,
} from '../../lib/api';
import { supabase } from '../../lib/supabase';
import { toErrorMessage } from '../../lib/ops/errors';
import { useAutoSave, useFieldNormalizer } from '../../lib/formState';
import { normalizeKindForField } from '../../lib/normalize';
import type { LookupCode } from '../../lib/ops/types';
import {
  AssignDocumentsModal, ClientHorseRecordsCard, AttachOfferingPanel, PaperworkEditor,
} from './ClientRecordActions';
import {
  TAG_LABEL, TAG_REASON,
  adminSetSuspended, adminAccountAction, adminHardDeleteClient,
} from '../../lib/admin';
import { AutoSaveIndicator } from '../ops/kit/AutoSaveIndicator';
import { StaffStandingSlotSection } from './StandingSlotPicker';
import { ClientInvitationSection } from './ClientInvitationSection';
import { fetchClientStandingSlots } from '../../lib/ops/api-calendar';
import { markOrderPaid } from '../../lib/ops/api-payments';
import { asRecordedDate, barnToday } from '../../lib/recordedDate';
import { RecordedDateField } from './RecordedDateField';
import { orderStatusLabel } from '../../lib/orderStatus';

/**
 * THE CONTACT RECORD — every person, one surface, at every stage of their life.
 *
 * ⚠️ TASK-FIX2 §3. This is now THE record surface, and `Records › Clients`
 * (`Admin.tsx`) opens it for all 24 people on that list — where before it opened
 * a second, account-keyed view that 17 of the 24 could not render at all
 * (`Admin.tsx:1018`/`:1033` gated the tab rail and body on
 * `selected.kind === 'account'`). AR2 F3: five surfaces rendered a person and the
 * most complete one was unreachable from the list everybody uses. The rule that
 * decided which one you got was never anything about the person — it was which
 * tab you happened to click through.
 *
 * WHAT CAME ACROSS FROM THE RETIRED LAYOUT, so nothing was lost with it:
 * the invitation lifecycle in full (`ClientInvitationSection` — AR2 F5 items
 * 9–14, which exist nowhere else), the provisioning form and its agreed-lesson
 * picker at every stage rather than only before an invitation goes out, Bookings,
 * Payments, Messages, the sign-in detail, and suspend / reinstate / remove /
 * archive / hard delete.
 *
 * ⚠️⚠️ THE CLOSE BEHAVIOUR CHANGED IN TASK-FIX4, DELIBERATELY, ON A FIX THAT HAD
 * ALREADY SHIPPED. READ THIS BEFORE TOUCHING IT AGAIN.
 *
 * THREE BEHAVIOURS, IN ORDER, AND EACH FIXED THE ONE BEFORE IT:
 *   1. **Originally**: a backdrop click or Escape DESTROYED unsaved edits, and
 *      there was a Save button. The owner reported losing data to it.
 *   2. **TASK-FIX2** (2026-08-29, shipped): every exit ran through
 *      `requestClose`, which called `commit()` and only then closed. It solved
 *      accidental-close by trading a data-loss bug for an unintended-write bug —
 *      ⚠️ **clicking the X SUBMITTED the form.**
 *   3. **TASK-FIX4** (2026-08-31): ⚠️ **closing does NOTHING.** Owner:
 *      *"commits on continue/send/commit/done...etc... not a close button click,
 *      no user would input data and click close and expect the form submitted."*
 *   4. **TASK-MODAL2** (this, same day, CR-93): ⚠️ **closing is now also HARDER
 *      TO REACH BY ACCIDENT.** 3 left Escape as an exit; the owner withdrew it
 *      along with click-out for every dialog in the app — *"you cant determine
 *      which ones the user can reopen and which ones they cant."* ⚠️ **4 does
 *      not change what closing DOES** (still nothing) — only what counts as a
 *      close. The X and the footer `Close` button, and nothing else.
 *
 * **What makes 3 safe is that it is not a return to 1.** ⚠️ Persisting a draft and
 * committing a record are different acts. Edits now AUTO-SAVE to the record after
 * input (`useAutoSave` below), so by the time anyone closes, the work is already
 * in. Closing is not the mechanism that saves it, and it is not a submission.
 *
 * ⚠️ **WHAT WAS KEPT FROM THE FIX2 VERSION, because the instinct was right:**
 * *"if the save fails the record stays open with the edits still in the boxes and
 * the reason on screen."* That now lives in `ops/kit/Modal`'s `error` prop and in
 * `useAutoSave`, so every dialog inherits it rather than this one owning it.
 *
 * ⚠️ **A RECORD EDITED BETWEEN BEHAVIOURS 2 AND 3 IS UNAFFECTED.** Under 2 the
 * write happened on close; under 3 it happens ~700ms after the last keystroke.
 * Both reach `update_contact_record` with the same patch, so nothing written
 * under the old behaviour is now unwritten, and nothing is pending. The one real
 * difference is a record where someone typed and then closed FAST — under 2 the
 * close awaited the write; under 3 the auto-save may still be in flight, which is
 * why `commit()` is flushed on unmount below.
 *
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

type Tab = 'record' | 'relationships' | 'bookings' | 'documents' | 'orders'
  | 'paperwork' | 'account' | 'activity';

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

  const normalize = useFieldNormalizer();

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

  /** Commit whatever is in `dirty`. Returns false when the write was refused, so
   *  the caller can decide not to close. Archived records are read-only — the DB
   *  refuses `update_contact_record` on one, and a control that can only fail is
   *  worse than no control. */
  const commit = useCallback(async (): Promise<boolean> => {
    if (archived || Object.keys(dirty).length === 0) return true;
    setSaving(true); setErr(null);
    try {
      setD(await updateContactRecord(contactId, dirty));
      setDirty({});
      onChanged?.();
      return true;
    } catch (e) {
      setErr(toErrorMessage(e, 'Could not save — your changes are still here.'));
      return false;
    } finally { setSaving(false); }
  }, [archived, dirty, contactId, onChanged]);

  /* ⚠️ AUTO-SAVE AFTER INPUT — and after normalisation, so what is stored is what
     the person can see (CR-83). This is what replaces commit-on-close: the record
     is written ~700ms after the last keystroke, so closing has nothing left to do
     and does not need to be a submission. On a failed write `save.error` holds the
     reason, the dialog stays open, and `dirty` is untouched — the edits are still
     in the boxes. */
  const save = useAutoSave(dirty, async () => { await commit(); }, {
    enabled: !archived,
    skip: (d) => Object.keys(d).length === 0,
  });

  /* ⚠️ THE ONE THING CLOSING STILL DOES: flush a write that is mid-debounce.
     That is not a commit-on-close — it is finishing the auto-save that the last
     keystroke already started, and it is what stops "typed, then closed fast"
     from being the one case that loses anything. Held in a ref so the unmount
     cleanup never closes over a stale `dirty`. */
  const flushRef = useRef<() => Promise<void>>(async () => {});
  flushRef.current = save.flush;
  useEffect(() => () => { void flushRef.current(); }, []);

  const requestClose = () => { onClose(); };

  /* ⚠️ TASK-MODAL2 D1 — ESCAPE NO LONGER CLOSES THIS RECORD, AND THE LISTENER IS
     GONE RATHER THAN NEUTERED. FIX4 kept Escape deliberately, on the reasoning
     that it is a keystroke nobody presses by accident. The owner overruled the
     whole category on 2026-08-31 — *"just make all modals only close on click of
     button or link"* — because whether a dismissal is recoverable is not
     something the surface can know. This file is the ONE deliberate non-adopter
     of `ops/kit/Modal`, so it obeys the RULE by hand: the X in the header and the
     `Close` button in the footer are the two ways out, and there are no others. */

  /* PROMOTION TO AN ACCOUNT, from the record itself. Someone without a login
     still has a full contact record — it simply holds less — and inviting them
     is the natural next step from the screen where you just reviewed them,
     rather than a separate hunt through another page.

     ⚠️ AR2 F8: this used to be `const [invited, setInvited] = useState(false)`,
     never seeded from the record, so the Account tab offered a bare "Send
     invitation" to anyone with an email and no login — INCLUDING Pamela, whose
     link went out on 2026-08-25 — and `adminSendInvitation` defaults to
     `mode: 'new'`, which leaves the prior link working. The act minted a second
     live claim link with no warning. `ClientInvitationSection` derives the state
     from `adminInvitationHistory` instead, and carries Admin.tsx's two-press
     resend-vs-regenerate distinction (D19). */
  const [assigning, setAssigning] = useState(false);
  /** Bumped after an attach so the standing-slot section re-reads and the newly
   *  sold weekly plan appears with its question already open (TASK-FIX2 §2). */
  const [ordersKey, setOrdersKey] = useState(0);
  /** What the last settlement on the Orders tab did — including, deliberately,
   *  whether a receipt went out. TASK-BACKDATE R6. */
  const [orderNote, setOrderNote] = useState<string | null>(null);

  /* Which of this person's recurring purchase items already have a day and time.
     Read from `client_standing_slots` — the same staff-gated read the picker below
     uses, so the badge on an order line and the picker under it can never
     disagree about whether a plan has been placed. */
  const [slotChosen, setSlotChosen] = useState<Map<string, boolean>>(new Map());
  useEffect(() => {
    let alive = true;
    fetchClientStandingSlots(contactId)
      .then((rows) => {
        if (alive) setSlotChosen(new Map(rows.map((r) => [r.purchase_item_id, r.chosen])));
      })
      .catch(() => { if (alive) setSlotChosen(new Map()); });
    return () => { alive = false; };
  }, [contactId, ordersKey]);

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
  /* ⚠️ ONE TAB SET, EVERY STAGE (TASK-FIX2 §3). Every tab renders for every
     person; a section inside one is absent only when its OWN data is absent, the
     way `StaffStandingSlotSection` already behaves. Nothing here asks "do they
     have a login?" to decide WHICH SURFACE you see — that question was
     `Admin.tsx`'s and it is what left 17 of 24 people looking at nothing. */
  const TABS: [Tab, string, number | null][] = [
    ['record', 'Record', null],
    ['relationships', 'Relationships', (d?.family.dependants.length ?? 0) + (d?.horses.length ?? 0)],
    ['bookings', 'Bookings', null],
    ['documents', 'Documents', d?.documents.length ?? 0],
    ['orders', 'Orders', d?.orders.length ?? 0],
    ['paperwork', 'Paperwork', null],
    ['account', 'Account', null],
    ['activity', 'Activity', null],
  ];

  return (
    /* ⚠️ TASK-FIX4 §3 — the backdrop no longer closes this record. It is the most
       field-dense surface in the app; a stray click beside it was CR-68a. This
       one keeps its hand-rolled shell deliberately (see the note at the top of
       the file): it is a fixed-height, tab-railed record surface, not a box
       around a form. What it shares with every converged dialog is the RULES,
       not the markup — and ⚠️ TASK-MODAL2 applies all of them here by hand: no
       backdrop close, no Escape close (D1), and the save state in the header
       beside Close, reading `Saved` (D3). */
    <div className="fixed inset-0 z-50 grid place-items-center bg-green-950/40 px-4 py-8"
      role="dialog" aria-modal="true" aria-label={`${name} record`}>
      {/* ⚠️ ONE SIZE, ALWAYS (owner, 2026-08-25): "keep it one size dont change it
          based on the contents when i switch tabs it is constantly resizing and it
          stays center aligned which makes it really uncomfortable." `max-h-full` let
          the height follow the tab's content, so every tab change re-centred the box
          under the cursor. A fixed height holds still; the body scrolls instead. */}
      {/* AR2 F14: `dvh`, not `vh`. On iOS `vh` measures the chrome-less viewport, so
          the footer went under the browser bar on the owner's working device —
          the repo's newer overlays (Modal, CreateModal, HorseRecordsPage, the
          add-horse sheet two files away) all use `dvh` already. */}
      <div className="bg-white rounded-2xl border border-green-800/10 w-full max-w-3xl h-[85dvh] flex flex-col overflow-hidden"
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
          {/* ⚠️ THE INDICATOR IS NOT OPTIONAL. With no Save button and no
              commit-on-close, it is the only thing telling the person their
              typing was kept — *"we need to show auto-save so the user knows the
              inputs are saved."*
              ⚠️ TASK-MODAL2 D3 — IT SITS HERE, BESIDE THE CLOSE ICON, and it
              reads `Saved`. It used to pass `savedLabel="Saved to the record"`;
              the owner named the word — *"a green checkmark with the word saved
              in green (light green)"* — so the custom label is gone. This is the
              same position `ops/kit/Modal` now renders it in, reached by hand
              because this surface keeps its own shell. */}
          <AutoSaveIndicator status={save.status} />
          <button type="button" onClick={requestClose} aria-label="Close"
            className="p-1.5 rounded-lg text-muted hover:bg-green-800/5 focus-ring shrink-0">
            <X size={18} />
          </button>
        </div>

        {(err ?? save.error) && <p role="alert" className="form-error mx-5 mt-3">{err ?? save.error}</p>}

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
                              /* ⚠️ TASK-FIX4 §4 — *"yes staff-entered inputs
                                 normalize too"* (owner, 2026-08-31). The KIND is
                                 derived from the field name, so a new name/phone/
                                 email row added to FIELD_GROUPS is normalised
                                 without anyone remembering to wire it. */
                              <input id={`f-${k}`} className={input}
                                disabled={archived}
                                type={k === 'date_of_birth' ? 'date' : 'text'}
                                value={val(k)} onChange={(e) => set(k)(e.target.value)}
                                onBlur={(() => {
                                  const kind = normalizeKindForField(k);
                                  return kind ? normalize(k, kind, val(k), set(k)) : undefined;
                                })()} />
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

              {/* ⚠️ TASK-FIX2 §3 — BOOKINGS AND PAYMENTS CAME ACROSS FROM THE
                  RETIRED LAYOUT. They were `Admin.tsx` tabs keyed on
                  `admin_client_bookings(p_user_id)` / a `buyer_user_id` filter, so
                  they existed only for the 7 people with a login. `bookings` carries
                  `account_contact_id` (staff RLS is `has_staff_access()`), and
                  `purchases` carries `buyer_contact_id` on every live row, so both
                  read off the CONTACT and work at every stage. */}
              {tab === 'bookings' && (
                <ContactSessionsTab contactId={contactId} />
              )}

              {tab === 'documents' && (
                <div className="flex flex-col gap-5">
                  {!archived && (
                    <div className="flex flex-wrap items-center gap-3">
                      <button type="button" className="btn-secondary text-sm"
                        onClick={() => setAssigning(true)}>
                        Assign a document or contract
                      </button>
                      {/* Carried across from the retired `PendingClientView`'s
                          "Associated items" header, which was the only place on a
                          person's record that could start a contract for them. */}
                      <Link to="/app/ops/contracts/new"
                        className="text-sm text-green-800 underline hover:text-green-900 focus-ring">
                        New contract
                      </Link>
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
                    {orderNote && (
                      <p role="status" className="text-[11.5px] text-green-900 border border-green-800/15 bg-green-50/50 px-2.5 py-1.5">
                        {orderNote}
                      </p>
                    )}
                    {d.orders.length === 0 ? <Empty>None.</Empty>
                      : d.orders.map((o) => (
                        <div key={o.purchase_id} className="flex flex-col gap-1.5">
                          <Row
                            main={`$${Number(o.amount ?? 0).toFixed(2)}${o.code ? ` · ${o.code}` : ''}`}
                            /* ⚠️ TASK-BACKDATE R6 — THE DATE, AFTERWARDS. The row
                               showed only when the order was raised. `paid_at` is
                               the date the money is recognised on, and after a
                               backfill it is routinely a different month from
                               `created_at` — so showing one and not the other is
                               how a settled order looks unsettled. */
                            sub={o.paid_at
                              ? `Ordered ${new Date(o.created_at).toLocaleDateString()} · paid ${new Date(o.paid_at).toLocaleDateString()}`
                              : `Ordered ${new Date(o.created_at).toLocaleDateString()}`}
                            badge={orderStatusLabel({ status: o.status, current_status: o.current_status })} />
                          {(o.items ?? []).map((it) => (
                            <div key={it.item_id}
                              className={`flex items-baseline gap-2 pl-4 text-sm ${it.voided_at ? 'text-muted line-through' : 'text-green-900'}`}>
                              <span className="min-w-0 flex-1">
                                {it.label ?? 'Offering'}
                                {(it.quantity ?? 1) > 1 ? ` × ${it.quantity}` : ''}
                              </span>
                              {/* ⚠️ TASK-FIX2 §2 — THE TELL. D23: a recurring purchase
                                  gives a standing weekly slot, not a credit balance,
                                  so a recurring line with no chosen day is an order
                                  that delivered nothing. It used to look identical to
                                  one that had been placed. It does not any more. */}
                              {!it.voided_at && it.config_kind === 'recurring'
                                && !slotChosen.get(it.item_id) && (
                                <span className="shrink-0 rounded-full border border-gold-500 bg-gold-50 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-gold-900">
                                  no day chosen yet
                                </span>
                              )}
                              <span className="text-[11px] text-muted shrink-0">
                                ${Number(it.price_amount ?? 0).toFixed(2)}
                                {it.price_unit ? ` / ${it.price_unit}` : ''}
                              </span>
                            </div>
                          ))}
                          {/* ⚠️ TASK-BACKDATE R3 — THE DOOR. Every order that
                              still owes money can be settled from right here,
                              through the same `markOrderPaid` seam Payment
                              review uses. `draft` is INCLUDED: production held
                              one ($880, PUR-000302) that no surface in the app
                              could settle. A void order is not money owed. */}
                          {!archived && o.payment_status !== 'paid' && o.status !== 'void' && (
                            <SettleOrderControl order={o} onSettled={(m) => {
                              setOrderNote(m); load(); setOrdersKey((k) => k + 1);
                            }} />
                          )}
                        </div>
                      ))}
                    {!archived && (
                      <AttachOfferingPanel contactId={contactId}
                        onAttached={() => { load(); setOrdersKey((k) => k + 1); }} />
                    )}
                  </Section>

                  {/* SLOTREACH §2 — a weekly plan's standing time lives on the
                      purchase item, so this is where it belongs: beside the orders
                      that carry it. Renders nothing for a contact with no weekly
                      purchase.

                      ⚠️ TASK-FIX2 §2: `refreshKey` is why selling a weekly plan and
                      placing it are now ONE act. Five of six live recurring plans
                      have an empty `config` — including a PAID $880 that placed
                      nothing — because `attach_offerings_to_client` writes an order
                      line and takes no schedule. It still does; what changed is that
                      the moment it lands, this section re-reads and the plan's
                      unanswered day-and-time question is on screen. Same single
                      writer (`set_my_standing_schedule`), no second scheduler. */}
                  {!archived && (
                    <StaffStandingSlotSection
                      key={ordersKey}
                      contactId={contactId}
                      personName={[c.first_name, c.last_name].filter(Boolean).join(' ') || null}
                    />
                  )}
                </div>
              )}

              {tab === 'paperwork' && <PaperworkEditor contactId={contactId} />}

              {/* ⚠️ TASK-FIX2 §3 — THE ACCOUNT TAB IS NOW STAGE-DEPENDENT CONTENT,
                  NOT A STAGE-DEPENDENT SURFACE. It used to fork on `d.account` into
                  two entirely different screens, one of which held a bare "Send
                  invitation" that could mint a second live link. Every block below
                  renders when its OWN fact exists: the standing time when a weekly
                  plan exists, the sign-in detail when there is a login, the
                  invitation lifecycle when a link has been issued, the provisioning
                  form when it has not. */}
              {tab === 'account' && (
                <div className="flex flex-col gap-5">
                  {/* SLOTREACH §2 — the standing weekly time sits beside the agreed
                      lesson below, deliberately adjacent and deliberately distinct:
                      that one books THE lesson agreed on the call, this one sets THE
                      WEEKLY TIME that is theirs. A contact can hold a weekly purchase
                      before they ever have a login. */}
                  {!archived && (
                    <StaffStandingSlotSection
                      key={ordersKey}
                      contactId={contactId}
                      personName={[c.first_name, c.last_name].filter(Boolean).join(' ') || null}
                    />
                  )}

                  {d.account ? (
                    <>
                      {/* ⚠️ THE ACCOUNT'S NAME IS THE PERSON'S NAME. Owner,
                          2026-09-01: *"even though her name is listed her account
                          shows 'no display name' under account name."*

                          `profiles.display_name` is the COMMUNITY handle — the
                          social layer's field, set by the member themselves, and
                          nothing populates it at provisioning because nothing
                          should. It is not the account's name, and printing
                          "(no display name)" where the account's name belongs told
                          staff a record was broken when it was complete: Casey
                          Caddell's profile and contact both carry her name.

                          So the row shows who the account IS, and the handle only
                          when they have chosen one. */}
                      <Section title="Account">
                        <Row
                          main={[c.first_name, c.last_name]
                            .map((v) => (typeof v === 'string' ? v.trim() : ''))
                            .filter(Boolean).join(' ')
                            || d.account.display_name
                            || (typeof c.email === 'string' ? c.email : '')
                            || 'This account'}
                          sub={[d.account.role, d.account.display_name ? `“${d.account.display_name}”` : null]
                            .filter(Boolean).join(' · ') || undefined}
                          badge={d.account.is_suspended ? 'suspended' : (d.account.member_status ?? undefined)} />
                      </Section>
                      <Section title="Sign-in">
                        <Row main={d.account.login?.providers.length
                            ? d.account.login.providers.join(', ')
                            : 'password'}
                          sub={d.account.login?.last_sign_in_at
                            ? `last seen ${new Date(d.account.login.last_sign_in_at).toLocaleString()}`
                            : 'never signed in'} />
                        <Row main="Email verified"
                          sub={d.account.login?.email_confirmed_at
                            ? new Date(d.account.login.email_confirmed_at).toLocaleDateString()
                            : 'not yet'} />
                        <Row main="Account created"
                          sub={new Date(d.account.created_at).toLocaleDateString()} />
                      </Section>
                      {/* Messages had no home but `Admin.tsx`'s retired tab. The
                          thread itself lives on /app/messages; this is the door to
                          it, on the record. */}
                      <Section title="Messages">
                        <Link to={`/app/messages/${d.account.user_id}`}
                          className="text-sm text-green-800 underline hover:text-green-900 focus-ring">
                          Open the message thread with {name}
                        </Link>
                      </Section>
                      {d.posts && (
                        <Section title="Posts">
                          {d.posts.length === 0 ? <Empty>None.</Empty>
                            : d.posts.map((pp) => (
                              <Row key={pp.id} main={pp.body || `(${pp.post_type})`}
                                sub={new Date(pp.created_at).toLocaleDateString()}
                                badge={pp.pulled_down ? 'pulled' : pp.published ? 'live' : 'draft'} />
                            ))}
                        </Section>
                      )}
                    </>
                  ) : (
                    <Empty>
                      This person has no account — they have never signed in. That is
                      normal for a counterparty, a lead, or a minor on a parent&apos;s account.
                      Their contact record is complete in its own right; an account
                      simply adds a login.
                    </Empty>
                  )}

                  {/* THE ONE shared provisioning path, and the whole invitation
                      lifecycle, at every stage (AR2 F5 items 1–14). */}
                  <ClientInvitationSection
                    contactId={contactId}
                    email={(c.email as string | null) ?? null}
                    firstName={(c.first_name as string | null) ?? null}
                    lastName={(c.last_name as string | null) ?? null}
                    archived={archived}
                    onChanged={() => { load(); onChanged?.(); }} />

                  <AccountDangerZone
                    contactId={contactId}
                    userId={d.account?.user_id ?? null}
                    isSuspended={d.account?.is_suspended ?? false}
                    archived={archived}
                    onChanged={() => { load(); onChanged?.(); }}
                    onGone={() => { onChanged?.(); onClose(); }} />
                </div>
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

        {/* ⚠️ STILL NO SAVE BUTTON, AND TASK-FIX4 REMOVED THE LAST TRACE OF ONE.
            This bar used to read *"N changes — saved when you close"* over a
            button labelled *"Save and close"* — accurate under the FIX2
            behaviour and a promise the app must no longer make. Edits are
            written after input; the indicator in the header says so; and the
            control here does exactly one thing, which is close. */}
        <div className="flex items-center gap-2 px-5 py-3 border-t border-green-800/10">
          <span className="text-[12px] text-gold-800">
            {saving ? 'Saving…'
              : Object.keys(dirty).length > 0
                ? `${Object.keys(dirty).length} change${Object.keys(dirty).length === 1 ? '' : 's'} saving…`
                : ''}
          </span>
          <div className="ml-auto flex gap-2">
            <button type="button" className="btn-secondary text-sm"
              onClick={() => { setDirty({}); setErr(null); }}
              disabled={archived || Object.keys(dirty).length === 0}>
              Clear unsaved edits
            </button>
            <button type="button" className="btn-primary text-sm" onClick={requestClose}>
              Close
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

/**
 * ⚠️ TASK-FIX2 §3 — SESSIONS AND PAYMENTS, KEYED ON THE PERSON.
 *
 * `Admin.tsx`'s Bookings tab called `admin_client_bookings(p_user_id)` and its
 * Payments tab filtered `purchases` on `buyer_user_id` OR `buyer_contact_id`; both
 * tabs only rendered under `selected.kind === 'account'`, so neither existed for
 * the 17 of 24 people without a login — including every one of the four recurring
 * buyers whose sessions Claire most needs to look at. `bookings.account_contact_id`
 * and `purchases.buyer_contact_id` are set on every live row by the provisioning
 * spine, and both tables' staff RLS is `has_staff_access()`, so this reads the same
 * facts off the contact and works at every stage.
 */
function ContactSessionsTab({ contactId }: { contactId: string }) {
  const [sessions, setSessions] = useState<{
    id: string; starts_at: string; kind: string; status: string; notes: string | null;
  }[] | null>(null);
  const [payments, setPayments] = useState<{
    id: string; amount: number | null; payment_method: string | null;
    payment_reference: string | null; payment_status: string | null; created_at: string;
  }[] | null>(null);

  useEffect(() => {
    let alive = true;
    void supabase.from('bookings')
      .select('id, starts_at, kind, status, notes')
      .eq('account_contact_id', contactId)
      .order('starts_at', { ascending: false })
      .limit(100)
      .then(({ data }) => { if (alive) setSessions(data ?? []); });
    void supabase.from('purchases')
      .select('id, amount, payment_method, payment_reference, payment_status, created_at')
      .eq('buyer_contact_id', contactId)
      .eq('payment_status', 'paid')
      .order('created_at', { ascending: false })
      .then(({ data }) => { if (alive) setPayments(data ?? []); });
    return () => { alive = false; };
  }, [contactId]);

  const upcoming = (sessions ?? []).filter((b) => new Date(b.starts_at) >= new Date());
  const past = (sessions ?? []).filter((b) => new Date(b.starts_at) < new Date());

  return (
    <div className="flex flex-col gap-5">
      <Section title="Upcoming">
        {sessions === null ? <Empty>Loading…</Empty>
          : upcoming.length === 0 ? <Empty>Nothing on the calendar.</Empty>
          : upcoming.map((b) => (
            <Row key={b.id} main={new Date(b.starts_at).toLocaleString()}
              sub={b.notes ?? undefined} badge={b.status} />
          ))}
      </Section>
      <Section title="Past">
        {sessions === null ? <Empty>Loading…</Empty>
          : past.length === 0 ? <Empty>None yet.</Empty>
          : past.slice(0, 30).map((b) => (
            <Row key={b.id} main={new Date(b.starts_at).toLocaleString()}
              sub={b.notes ?? undefined} badge={b.status} />
          ))}
      </Section>
      <Section title="Payments received">
        {payments === null ? <Empty>Loading…</Empty>
          : payments.length === 0 ? <Empty>No payments recorded.</Empty>
          : payments.map((pm) => (
            <Row key={pm.id}
              main={`$${Number(pm.amount ?? 0).toFixed(2)} · ${pm.payment_method ?? 'method not recorded'}${pm.payment_reference ? ` · ${pm.payment_reference}` : ''}`}
              sub={new Date(pm.created_at).toLocaleDateString()}
              badge={pm.payment_status ?? undefined} />
          ))}
      </Section>
    </div>
  );
}

/**
 * ⚠️ TASK-FIX2 §3 — SUSPEND / REINSTATE / REMOVE / ARCHIVE / HARD DELETE.
 *
 * Carried across verbatim from the retired `Admin.tsx` layout, wording included,
 * because these five acts had no other home. Two notes that must survive the move:
 *
 *  • ARCHIVE (D32) is the retention-safe act — `archive_contact` plus a suspended
 *    login, reversible from Records › Archived. TASK-ARCHIVE fixed this from a
 *    version that severed `profiles.contact_id` with no way back; do not reopen it.
 *  • HARD DELETE is D32's acknowledged exception, kept only as the owner's own
 *    manually-confirmed act. It is offered on every kind, including a bare
 *    contact, behind a typed DELETE. ⚠️ AR2 F15 flags it precisely so nobody
 *    SPREADS it — this is the one surface it belongs on.
 */
function AccountDangerZone({
  contactId, userId, isSuspended, archived, onChanged, onGone,
}: {
  contactId: string;
  userId: string | null;
  isSuspended: boolean;
  archived: boolean;
  onChanged: () => void;
  /** The person is no longer on this list — close the record behind us. */
  onGone: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [hardConfirm, setHardConfirm] = useState('');
  const [err, setErr] = useState<string | null>(null);

  async function act(fn: () => Promise<unknown>, gone = false) {
    setErr(null);
    try { await fn(); if (gone) onGone(); else onChanged(); }
    catch (e) { setErr(toErrorMessage(e, 'Could not update the account.')); }
  }

  return (
    <div>
      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open}
        className="px-3.5 py-2 rounded-lg text-xs font-medium border border-red-300 text-red-700 hover:bg-red-50 focus-ring">
        Suspend / Remove / Delete
      </button>
      {err && <p role="alert" className="form-error mt-2">{err}</p>}
      {open && (
        <div className="mt-3 border border-red-200 rounded-lg p-4 bg-red-50/40 flex flex-col gap-3">
          {userId && (
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-medium text-green-900">Suspend — blocks their login</p>
                <p className="text-[12px] text-muted">They stay on every list and keep every record; they simply cannot sign in.</p>
              </div>
              <button type="button" disabled={archived}
                onClick={() => void act(() => adminSetSuspended(userId, !isSuspended))}
                className="px-3.5 py-2 rounded-lg text-xs font-medium border border-green-800/20 text-green-800 hover:bg-white focus-ring shrink-0 disabled:opacity-40">
                {isSuspended ? 'Reinstate' : 'Suspend'}
              </button>
            </div>
          )}
          <div className="flex flex-wrap items-start justify-between gap-3 border-t border-red-200 pt-3">
            <div className="min-w-0">
              <p className="text-sm font-medium text-green-900">Remove — reversible</p>
              <p className="text-[12px] text-muted">Deactivates the account. Login is blocked; you can reactivate any time. Nothing is deleted.</p>
            </div>
            <span className="flex gap-2 shrink-0">
              <button type="button" onClick={() => void act(() => adminAccountAction(contactId, 'remove'))}
                className="px-3.5 py-2 rounded-lg text-xs font-medium border border-green-800/20 text-green-800 hover:bg-white focus-ring">
                Remove
              </button>
              <button type="button" onClick={() => void act(() => adminAccountAction(contactId, 'unremove'))}
                className="px-3.5 py-2 rounded-lg text-xs font-medium border border-green-800/20 text-green-800 hover:bg-white focus-ring">
                Reactivate
              </button>
            </span>
          </div>
          <div className="flex flex-wrap items-start justify-between gap-3 border-t border-red-200 pt-3">
            <div className="min-w-0">
              <p className="text-sm font-medium text-green-900">Archive — keep the data</p>
              <p className="text-[12px] text-muted">Hides them from Records, the pickers and every roster. All history, signed documents and orders are preserved and stay visible to anyone who shares them. Find them again — and restore them — in Records › Archived.</p>
            </div>
            <button type="button" disabled={archived}
              onClick={() => void act(() => adminAccountAction(contactId, 'soft'), true)}
              className="px-3.5 py-2 rounded-lg text-xs font-medium border border-red-300 text-red-700 hover:bg-white focus-ring shrink-0 disabled:opacity-40">
              Archive
            </button>
          </div>
          <div className="border-t border-red-200 pt-3">
            <p className="text-sm font-medium text-red-700">Hard delete — nuclear, irreversible</p>
            <p className="text-[12px] text-muted mb-2">
              Erases all traces: the login and their records. Refused if a signed agreement references them.
              Type <span className="font-mono font-semibold">DELETE</span> to enable.
            </p>
            <div className="flex items-center gap-2">
              <input value={hardConfirm} onChange={(e) => setHardConfirm(e.target.value)}
                placeholder="DELETE"
                className="px-3 py-2 rounded-lg border border-red-300 text-sm focus-ring w-32" />
              <button type="button" disabled={hardConfirm !== 'DELETE'}
                onClick={() => void act(() => adminHardDeleteClient(contactId), true)}
                className="px-3.5 py-2 rounded-lg text-xs font-medium bg-red-600 text-white hover:bg-red-700 focus-ring disabled:opacity-40 disabled:cursor-not-allowed">
                Hard delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * ⚠️ TASK-BACKDATE R3 — SETTLING AN ORDER FROM THE PERSON'S OWN RECORD.
 *
 * WHAT WAS TRUE. `markOrderPaid` had exactly ONE call site in the entire app —
 * `PaymentReviewPage.tsx:153`. Marking an order paid worked once, AT
 * PROVISIONING, because `p_mark_paid` is an argument of CREATING the order, and
 * never again from the screen staff actually have open. Staff looking at a
 * client's record could see the $880 they owed and could not take the money.
 * It was never a permission problem — `mark_purchase_paid` allows
 * `has_staff_access()` and the nav row exists. It was a REACH problem.
 *
 * ⚠️ AND IT IS NOT A SECOND WRITE PATH (D18). This calls `markOrderPaid`, the
 * same exported function Payment review calls, which posts to the same
 * `/api/orders-mark-paid`, which calls the same `mark_purchase_paid` (or
 * `confirm_payment_claim` when a claim is open). If it did not go through that
 * seam it would not ship. There is one settlement spine and this is a second
 * DOOR onto it, not a second engine.
 *
 * ⚠️ D19 — IT STATES ITSELF BEFORE IT ACTS. The date it will be recorded
 * against is on screen before either button, and what that date costs (no
 * receipt for a backdated payment) is on screen with it.
 */
function SettleOrderControl({ order, onSettled }: {
  order: ContactDossier['orders'][number];
  onSettled: (message: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [paidOn, setPaidOn] = useState(barnToday());
  const [working, setWorking] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const claimPending = order.client_claim_status === 'pending';

  async function settle(method: 'zelle' | 'cash') {
    setWorking(true); setErr(null);
    try {
      const r = await markOrderPaid(order.purchase_id, method, undefined, undefined,
        asRecordedDate(paidOn));
      const asOf = r.recordedAt ? ` Recorded as of ${r.recordedAt}.` : '';
      onSettled(
        r.status === 'already_paid' ? 'That order was already marked paid.'
          : r.receipt.sent ? `Marked paid (${method}) — receipt sent.${asOf}`
          : r.receipt.reason === 'backdated'
            ? `Marked paid (${method}).${asOf} No receipt was sent — this money arrived before today.`
            : `Marked paid (${method}) — receipt NOT sent (${r.receipt.reason ?? 'unknown reason'}).${asOf}`,
      );
      setOpen(false); setPaidOn(barnToday());
    } catch (e) {
      setErr(toErrorMessage(e, 'Could not mark this order paid.'));
    } finally { setWorking(false); }
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)}
        className="self-start border border-green-800/40 text-green-900 text-[11.5px] font-medium px-2 py-0.5 hover:bg-green-50 focus-ring">
        Mark paid
      </button>
    );
  }
  return (
    <div className="border border-green-800/15 bg-cream-100/40 p-3 flex flex-col gap-2">
      <RecordedDateField value={paidOn} onChange={setPaidOn} kind="payment" />
      {claimPending && (
        <p className="text-[11.5px] text-gold-900">
          {order.client_reported_method === 'cash' ? 'Cash' : 'Zelle'} — the client has
          already reported this payment. Settling here CONFIRMS their claim, as they
          reported it; the method chosen below is not the one recorded.
        </p>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" disabled={working} onClick={() => void settle('zelle')}
          className="btn-secondary text-xs py-1 px-3">{working ? 'Marking…' : 'Zelle'}</button>
        <button type="button" disabled={working} onClick={() => void settle('cash')}
          className="btn-secondary text-xs py-1 px-3">{working ? 'Marking…' : 'Cash'}</button>
        <button type="button" onClick={() => setOpen(false)} className="text-xs text-muted px-2">Cancel</button>
      </div>
      {err && <p role="alert" className="form-error text-xs">{err}</p>}
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
