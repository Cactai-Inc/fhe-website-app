import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { fromHere } from '../../lib/linkOrigin';
import { FileText, CalendarDays, ClipboardList, PencilLine, Trash2, Activity, History } from 'lucide-react';
import {
  horsePageDetail, deleteStableHorse, endHorseProvider, endHorseLease,
  setLesseeEntryHidden, horseHiddenLesseeEntries, deleteLesseeEntry, HORSE_FIELD_LABELS,
  type HorsePageDetail, type HorseProvider, type LesseeEntry,
} from '../../lib/horses';
import { useAuth } from '../../contexts/AuthContext';
import { useDocumentTitle } from '../../lib/hooks';
import { ProviderEditor } from './ProviderEditor';
import { LesseeEntryEditor } from './LesseeEntryEditor';
import { DisclosureEntryBoxes } from './DisclosureEntryBoxes';
import { HorseIntakeForm } from './HorseIntakeForm';
import { HealthLog } from './HealthLog';
import { buildRecordEntries } from '../../lib/disclosureMarker';
import { horseDeals, DEAL_TYPE_LABEL, type DealRow } from '../../lib/deals';
import { usePropertyTerm } from '../../contexts/BrandProvider';
import { withArticle } from '../../lib/propertyTerm';
import { toErrorMessage } from '../../lib/ops/errors';

/**
 * HORSE RECORD — the client-facing record for one horse, driven by a horseId prop.
 *
 * ⚠️ ONE COMPONENT, THREE MOUNTS (Part 2 item 1). This is the body that used to
 * live inside HorsePage. It now takes `horseId` and is mounted by:
 *   - the route page `HorsePage` (reads :horseId from the URL and passes it),
 *   - the contract drawer on a wide viewport, and
 *   - the contract modal on a narrow one (RecordPanel).
 * There is no second copy of it and no second copy of the editor.
 *
 * Editing is `HorseIntakeForm` in edit mode — the SAME form the intake and
 * onboarding flows use, which autosaves every field on blur (identity,
 * disclosures, medications, location). There is no save button on the record;
 * the form commits as the author leaves each field. The identity-only
 * `RecordEditor` that used to live here is deleted (one implementation).
 *
 * `onContractRefetch` lets a host (the drawer/modal) learn that a record autosave
 * landed, so the open contract can refetch its detail at once (item 4a).
 */

type Tab = 'record' | 'documents' | 'schedule' | 'history';

const fmtDate = (s?: string | null) =>
  s ? new Date(s).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : '—';
const fmtDateTime = (s?: string | null) =>
  s ? new Date(s).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '—';
const titleCase = (s?: string | null) => (s ? s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) : '');

/** A labeled read-only value; hidden when empty. */
function Detail({ label, value }: { label: string; value?: string | number | null }) {
  const v = value === 0 ? '0' : value;
  if (v === null || v === undefined || v === '') return null;
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wide text-muted mb-0.5">{label}</p>
      <p className="text-sm text-green-900">{String(v)}</p>
    </div>
  );
}

/** A labeled value that also shows a "Needs update" badge when the field is pending.
 *  Unlike Detail, it renders even when empty IF pending, so the gap is visible. */
function DetailP({ label, value, pending }: { label: string; value?: string | number | null; pending?: boolean }) {
  const v = value === 0 ? '0' : value;
  const empty = v === null || v === undefined || v === '';
  if (empty && !pending) return null;
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wide text-muted mb-0.5">
        {label}{pending && <span className="ml-2 text-gold-800 normal-case">Needs update</span>}
      </p>
      <p className="text-sm text-green-900">{empty ? '—' : String(v)}</p>
    </div>
  );
}

/** A narrative list rendered as a labeled bulleted block; hidden when empty. */
function ListDetail({ label, items, field }: { label: string; items: Record<string, unknown>[]; field: string }) {
  const vals = items.map((e) => (typeof e[field] === 'string' ? (e[field] as string) : '')).filter(Boolean);
  if (vals.length === 0) return null;
  return (
    <div className="sm:col-span-2">
      <p className="text-[10px] uppercase tracking-wide text-muted mb-0.5">{label}</p>
      <ul className="flex flex-col gap-1">{vals.map((v, i) => <li key={i} className="text-sm text-green-900">{v}</li>)}</ul>
    </div>
  );
}

/** A record disclosure section rendered with the SAME boxed component the contract
 *  and PDF use, built from the raw record list via the shared field-order spec. */
function RecordDisclosure({ label, section, items }: { label: string; section: string; items: Record<string, unknown>[] }) {
  const entries = buildRecordEntries(section, items);
  if (entries.length === 0) return null;
  return (
    <div className="sm:col-span-2">
      <p className="text-[11px] uppercase tracking-wide text-gold-800 font-semibold mb-1">{label}</p>
      <DisclosureEntryBoxes entries={entries} />
    </div>
  );
}

function composeLocation(loc: HorsePageDetail['record']['current_location']) {
  if (!loc?.name) return null;
  const addr = [loc.address_line1, loc.city, [loc.state, loc.postal].filter(Boolean).join(' ')].filter(Boolean).join(', ');
  // The structured keeping spots, plus the free-text sub-location (item 5a) —
  // both describe where on the property the horse is kept.
  const spots = [
    ...(loc.keeping_spots ?? []).map((s) => `${s.term} ${s.value}`.trim()),
    loc.sub_location ?? '',
  ].filter(Boolean).join(' · ');
  return [loc.name, addr, spots].filter(Boolean).join(' — ');
}

const PROVIDER_LABEL: Record<HorseProvider['type'], string> = {
  VET: 'Veterinarian', FARRIER: 'Farrier', TRAINER: 'Trainer', GROOM: 'Groom',
  CARE_GIVER: 'Care giver', EMERGENCY_CONTACT: 'Emergency contact', OTHER: 'Other',
};
function providerLine(p: HorseProvider): string {
  return [p.name, p.business_name, p.phone, p.email].filter(Boolean).join(' · ');
}

const LESSEE_KIND_LABEL: Record<LesseeEntry['kind'], string> = {
  note: 'Note', provider: 'Provider', medical_history: 'Medical history', behavioral: 'Behavioral',
  known_condition: 'Known condition', injury: 'Injury', training: 'Training', competition: 'Competition',
  location_note: 'Location note',
};
/** A lessee entry's one-line content, from whatever text key its kind uses. */
function lesseeEntryLine(e: LesseeEntry): string {
  const d = e.data as Record<string, unknown>;
  const pick = (k: string) => (typeof d[k] === 'string' ? (d[k] as string) : '');
  if (e.kind === 'provider') return [pick('name'), pick('business_name'), pick('phone'), pick('email')].filter(Boolean).join(' · ');
  if (e.kind === 'injury') return [pick('date'), pick('person_type'), pick('description'), pick('outcome')].filter(Boolean).join(' · ');
  return pick('text') || pick('summary') || pick('concern') || pick('condition') || pick('entry') || pick('note') || JSON.stringify(d);
}

export interface HorseRecordProps {
  horseId: string;
  /** TRUE when mounted inside the contract drawer/modal — tightens the outer width
   *  so the record sits inside a panel rather than the page's own column. */
  inPanel?: boolean;
  /** Called after each record autosave lands (item 4a) — the host (drawer/modal)
   *  refetches the open contract so the change shows without a manual refresh. */
  onContractRefetch?: () => void;
}

export function HorseRecord({ horseId, inPanel = false, onContractRefetch }: HorseRecordProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const propertyTerm = usePropertyTerm();
  const { isStaff } = useAuth();
  const [detail, setDetail] = useState<HorsePageDetail | null>(null);
  const [deals, setDeals] = useState<Pick<DealRow, 'id' | 'display_code' | 'deal_type' | 'status' | 'created_at'>[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('record');
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [showProviderHistory, setShowProviderHistory] = useState(false);
  const [showLocationHistory, setShowLocationHistory] = useState(false);
  const [addingProvider, setAddingProvider] = useState(false);
  const [addingLesseeEntry, setAddingLesseeEntry] = useState(false);
  const [hiddenLessee, setHiddenLessee] = useState<LesseeEntry[] | null>(null);

  // The route page owns the document title; a drawer/modal mount must not touch it.
  useDocumentTitle(inPanel ? undefined : (detail?.record.nickname || detail?.record.registered_name || 'Horse'));

  const load = useCallback(async () => {
    if (!horseId) return;
    try { setDetail(await horsePageDetail(horseId)); setError(null); }
    catch (e) {
      const raw = toErrorMessage(e, '');
      // 3d: never surface raw database denial text — a friendly state instead.
      setError(/not authorized|unknown horse/i.test(raw)
        ? `This horse record isn't available on your account. If you believe it should be, ask ${withArticle(propertyTerm)} to add you as a party on the record.`
        : 'Could not load this horse.');
    }
  }, [horseId, propertyTerm]);
  useEffect(() => { void load(); }, [load]);
  // the deals this horse is part of — reciprocal link, best-effort (a viewer
  // without deal visibility simply sees none)
  useEffect(() => {
    if (!horseId) return;
    horseDeals(horseId).then(setDeals).catch(() => setDeals([]));
  }, [horseId]);

  /** A record autosave landed: refresh what we show, and tell the host so the
   *  open contract refetches (item 4a). Field edits flow to HORSE.* tokens
   *  through the DB sync trigger; the contract's own realtime subscription also
   *  echoes, but the host refetch makes the change show at once on this tab. */
  const onAutosaved = useCallback(() => {
    void load();
    onContractRefetch?.();
  }, [load, onContractRefetch]);

  async function onDelete() {
    if (!horseId) return;
    if (!window.confirm('Remove this horse from your stable? This cannot be undone.')) return;
    setBusy(true);
    try { await deleteStableHorse(horseId); navigate('/app/account'); }
    catch (e) { setError(toErrorMessage(e, 'Could not remove the horse.')); setBusy(false); }
  }

  async function onEndProvider(id: string) {
    if (!window.confirm('End this provider? It stays in the history, dated today.')) return;
    try { await endHorseProvider(id); await load(); } catch (e) { setError(toErrorMessage(e, 'Could not end the provider.')); }
  }
  async function onEndLease() {
    if (!horseId) return;
    if (!window.confirm('End this lease? The lessee comes off the record (kept in history) and ownership reverts. Review the providers and location afterward.')) return;
    try { await endHorseLease(horseId); await load(); } catch (e) { setError(toErrorMessage(e, 'Could not end the lease.')); }
  }
  async function onHideLesseeEntry(id: string) {
    if (!window.confirm('Hide this lessee entry from your view? It is never deleted and the lessee keeps it.')) return;
    try { await setLesseeEntryHidden(id, true); await load(); } catch (e) { setError(toErrorMessage(e, 'Could not hide the entry.')); }
  }
  async function onRevealHidden() {
    if (!horseId) return;
    try { setHiddenLessee(await horseHiddenLesseeEntries(horseId)); } catch (e) { setError(toErrorMessage(e, 'Could not load hidden entries.')); }
  }
  async function onUnhideLesseeEntry(id: string) {
    try { await setLesseeEntryHidden(id, false); setHiddenLessee(null); await load(); } catch (e) { setError(toErrorMessage(e, 'Could not un-hide the entry.')); }
  }

  if (error) return <div className={inPanel ? '' : 'max-w-3xl mx-auto'}><p role="alert" className="form-error">{error}</p></div>;
  if (!detail) return <p className="body-text text-muted text-sm">Loading the horse…</p>;

  const r = detail.record;
  const name = r.nickname || r.registered_name || 'Horse';
  const meds = detail.medications.filter((m) => m.kind === 'MEDICATION');
  const supplements = detail.medications.filter((m) => m.kind === 'SUPPLEMENT');

  const TABS: { id: Tab; label: string; icon: typeof FileText; count?: number }[] = [
    { id: 'record', label: 'Record', icon: ClipboardList },
    { id: 'documents', label: 'Documents', icon: FileText, count: detail.documents.length },
    { id: 'schedule', label: 'Schedule', icon: CalendarDays, count: detail.schedule.length },
    { id: 'history', label: 'Activity', icon: Activity, count: detail.sessions.length + detail.purchases.length },
  ];

  return (
    <div className={inPanel ? '' : 'max-w-4xl'}>
      <div className="flex items-start justify-between gap-3 mb-1">
        <div>
          <h1 className="font-serif text-2xl text-green-900">{name}</h1>
          {r.registered_name && r.registered_name !== name && <p className="text-sm text-muted">Registered name: {r.registered_name}</p>}
        </div>
        {!editing && (
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => { setEditing(true); setTab('record'); }}
              className="btn-outline-gold text-xs"><PencilLine size={13} /> Edit</button>
            <button type="button" onClick={() => void onDelete()} disabled={busy}
              className="text-xs text-red-700 hover:bg-red-50 rounded px-3 py-1.5 focus-ring inline-flex items-center gap-1.5">
              <Trash2 size={13} /> Remove
            </button>
          </div>
        )}
      </div>
      <p className="text-sm text-green-800/70 mb-5">
        {[titleCase(r.breed), titleCase(r.sex), r.color].filter(Boolean).join(' · ') || 'Horse record'}
      </p>

      {/* Editing is the full intake form in edit mode: identity, disclosures,
          medications and location, every field autosaving as the author leaves
          it. No save button — the record commits itself. */}
      {editing ? (
        <section className="bg-white border border-green-800/10 rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-serif text-green-800 text-lg">Edit record</h2>
            <button type="button" onClick={() => { setEditing(false); void load(); }} className="text-xs text-muted underline">Done</button>
          </div>
          <p className="text-[12px] text-muted mb-4">Your changes save as you go. Close when you’re finished.</p>
          <HorseIntakeForm horseId={horseId} hideSubmit onAutosaved={onAutosaved}
            onDone={() => { setEditing(false); void load(); }} />
        </section>
      ) : (
        <>
          {/* Tabs */}
          <div className="flex gap-1 border-b border-green-800/10 mb-5 overflow-x-auto">
            {TABS.map((t) => (
              <button key={t.id} type="button" onClick={() => setTab(t.id)}
                className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-sans whitespace-nowrap border-b-2 -mb-px focus-ring ${
                  tab === t.id ? 'border-gold-500 text-green-900 font-medium' : 'border-transparent text-muted hover:text-green-800'}`}>
                <t.icon size={14} /> {t.label}
                {t.count !== undefined && t.count > 0 && (
                  <span className="text-[10px] bg-green-800/10 text-green-800 rounded-full px-1.5 py-0.5 tabular-nums">{t.count}</span>
                )}
              </button>
            ))}
          </div>

          {tab === 'record' && (
            <div className="flex flex-col gap-5">
              {(r.pending_fields?.length ?? 0) > 0 && (
                <div className="rounded-xl border border-gold-400/60 bg-gold-50 p-4">
                  <p className="text-[11px] tracking-wide uppercase text-gold-900 font-semibold mb-1">Pending information</p>
                  <p className="text-sm text-gold-900/90">These fields were marked to add later and still need an update: {r.pending_fields.map((k) => HORSE_FIELD_LABELS[k] ?? k).join(', ')}.</p>
                </div>
              )}

              <Card title="Identity">
                <DetailP label="Name" value={r.nickname} />
                <DetailP label="Registered name" value={r.registered_name} pending={r.pending_fields?.includes('registered_name')} />
                <DetailP label="Breed" value={r.breed} />
                <DetailP label="Color" value={r.color} />
                <DetailP label="Markings" value={r.markings} pending={r.pending_fields?.includes('markings')} />
                <DetailP label="Sex" value={titleCase(r.sex)} />
                <DetailP label="Date of birth" value={fmtDate(r.date_of_birth)} pending={r.pending_fields?.includes('date_of_birth')} />
                <DetailP label="Height" value={r.height} />
                <DetailP label="Registration #" value={r.registration_number} pending={r.pending_fields?.includes('registration_number')} />
                <DetailP label="Registration org" value={r.registration_org} />
                <DetailP label="Microchip" value={r.microchip_id} pending={r.pending_fields?.includes('microchip_id')} />
                <DetailP label="Passport #" value={r.passport_number} pending={r.pending_fields?.includes('passport_number')} />
                <DetailP label="Passport country" value={r.passport_country} />
                <DetailP label="Fair market value" value={r.fair_market_value != null ? `$${Number(r.fair_market_value).toLocaleString()}` : null} pending={r.pending_fields?.includes('fair_market_value')} />
              </Card>

              <Card title="Location">
                <Detail label="Currently at" value={composeLocation(r.current_location)} />
                {r.current_location?.notes && <Detail label="Finding it" value={r.current_location.notes} />}
                <Detail label="Owner" value={r.owner_name} />
                {/* item 5a — the owner's contact, on the card beside their name. */}
                {(r.owner_email || r.owner_phone) && (
                  <Detail label="Owner contact"
                    value={[r.owner_phone, r.owner_email].filter(Boolean).join(' · ')} />
                )}
                {r.lessee_name && (
                  detail.viewer_is_lessee
                    ? <Detail label="Your lease" value={`You lease this horse${r.lease_end ? ` through ${fmtDate(r.lease_end)}` : ' — evergreen (until terminated)'}`} />
                    : <Detail label="Leased to" value={`${r.lessee_name}${r.lease_end ? ` (through ${fmtDate(r.lease_end)})` : ' — evergreen (until terminated)'}`} />
                )}
                {detail.location_history.length > 0 && (
                  <div className="sm:col-span-2">
                    <button type="button" onClick={() => setShowLocationHistory((v) => !v)} className="inline-flex items-center gap-1 text-xs text-gold-800 underline">
                      <History size={12} /> {showLocationHistory ? 'Hide' : 'View'} previous locations
                    </button>
                    {showLocationHistory && (
                      <ul className="mt-2 flex flex-col gap-1">
                        {detail.location_history.map((h) => (
                          <li key={h.id} className="text-[13px] text-secondary">
                            {[h.name, h.address_line1, h.city].filter(Boolean).join(', ')}
                            <span className="text-muted"> — until {fmtDate(h.end_on)}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
                {isStaff && r.lessee_name && (
                  <div className="sm:col-span-2">
                    <button type="button" onClick={() => void onEndLease()} className="text-xs text-red-700 hover:bg-red-50 rounded px-3 py-1.5 focus-ring">End lease</button>
                  </div>
                )}
              </Card>

              {detail.lease && (
                <Card title="Lease" full>
                  {detail.viewer_is_lessee
                    ? <Detail label="Term" value={`You lease this horse${detail.lease.lease_end ? ` through ${fmtDate(detail.lease.lease_end)}` : ' — evergreen (until terminated)'}`} />
                    : <Detail label="Term" value={`Leased to ${detail.lease.lessee_name}${detail.lease.lease_end ? ` (through ${fmtDate(detail.lease.lease_end)})` : ' — evergreen (until terminated)'}`} />}
                  <Detail label="Lease type" value={titleCase(detail.lease.lease_type)} />
                  {detail.lease.days_used && (<div><p className="text-[10px] uppercase tracking-wide text-muted mb-0.5">Reserved days</p><p className="text-sm text-green-900 whitespace-pre-line">{detail.lease.days_used}</p></div>)}
                  {detail.lease.schedule_terms && (<div><p className="text-[10px] uppercase tracking-wide text-muted mb-0.5">Additional schedule terms</p><p className="text-sm text-green-900 whitespace-pre-line">{detail.lease.schedule_terms}</p></div>)}
                </Card>
              )}

              <Card title="Current providers" full>
                {detail.providers.length === 0 && <p className="text-sm text-muted">No providers on file yet.</p>}
                {detail.providers.map((p) => (
                  <div key={p.id} className="flex items-start justify-between gap-3 border-b border-green-800/5 pb-2 last:border-0">
                    <div>
                      <p className="text-[10px] uppercase tracking-wide text-muted mb-0.5">
                        {PROVIDER_LABEL[p.type]}{p.role_label ? ` — ${p.role_label}` : p.role ? ` — ${p.role}` : ''}
                        {!p.linked && p.type !== 'OTHER' && <span className="ml-2 text-gold-800">Unlinked</span>}
                      </p>
                      <p className="text-sm text-green-900">{providerLine(p) || '—'}</p>
                    </div>
                    {isStaff && (
                      <button type="button" onClick={() => void onEndProvider(p.id)} className="text-[11px] text-muted hover:text-red-700 underline shrink-0 mt-1">End</button>
                    )}
                  </div>
                ))}
                {detail.provider_history.length > 0 && (
                  <div className="sm:col-span-2">
                    <button type="button" onClick={() => setShowProviderHistory((v) => !v)} className="inline-flex items-center gap-1 text-xs text-gold-800 underline">
                      <History size={12} /> {showProviderHistory ? 'Hide' : 'View'} provider history
                    </button>
                    {showProviderHistory && (
                      <ul className="mt-2 flex flex-col gap-1">
                        {detail.provider_history.map((p) => (
                          <li key={p.id} className="text-[13px] text-secondary">
                            {PROVIDER_LABEL[p.type]}: {providerLine(p)}
                            <span className="text-muted"> — ended {fmtDate(p.ended_at)}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
                {isStaff && (
                  <div className="sm:col-span-2">
                    {addingProvider
                      ? <ProviderEditor horseId={horseId} onAdded={() => void load()} onClose={() => setAddingProvider(false)} />
                      : <button type="button" onClick={() => setAddingProvider(true)} className="text-xs text-gold-800 border border-dashed border-gold-400 rounded-lg px-3 py-1.5 hover:bg-gold-50 focus-ring">＋ Add provider</button>}
                  </div>
                )}
              </Card>

              {(meds.length > 0 || supplements.length > 0) && (
                <Card title="Medications & supplements" full>
                  <MedList label="Medications" items={meds} />
                  <MedList label="Supplements" items={supplements} />
                </Card>
              )}

              {(r.known_conditions_list.length > 0 || r.medical_history_list.length > 0 || r.behavioral_history_list.length > 0 || r.injuries_to_horse.length > 0 || !!r.injuries_to_humans || r.training_history_list.length > 0 || r.competition_history_list.length > 0) && (
                <Card title="Health & disclosures" full>
                  <RecordDisclosure label="Known conditions" section="KNOWN_CONDITIONS" items={r.known_conditions_list} />
                  <RecordDisclosure label="Medical history" section="MEDICAL_HISTORY" items={r.medical_history_list} />
                  <RecordDisclosure label="Known behaviors" section="BEHAVIORAL_HISTORY" items={r.behavioral_history_list} />
                  <RecordDisclosure label="Injuries to the horse" section="INJURIES_TO_HORSE" items={r.injuries_to_horse} />
                  {!!r.injuries_to_humans && (
                    <div className="sm:col-span-2">
                      <p className="text-[11px] uppercase tracking-wide text-gold-800 font-semibold mb-1">Injuries caused to humans</p>
                      <p className="text-[13px] text-green-950">{r.injuries_to_humans === 'YES' ? 'Yes' : r.injuries_to_humans === 'NO' ? 'No' : 'Unknown'}</p>
                    </div>
                  )}
                  <ListDetail label="Training history" items={r.training_history_list} field="entry" />
                  <ListDetail label="Competition history" items={r.competition_history_list} field="entry" />
                </Card>
              )}

              {(detail.lessee_entries.length > 0 || detail.viewer_is_lessee || detail.lessee_hidden_count > 0) && (
                <Card title={detail.viewer_is_lessee ? 'My entries for this horse' : 'From the lessee'} full>
                  <p className="sm:col-span-2 text-[11px] text-muted -mt-1">
                    {detail.viewer_is_lessee
                      ? 'Your own records for this horse. They don’t change the owner’s record; the owner sees them marked as yours.'
                      : 'Entries the lessee recorded on their own layer. They do not change the owner’s record above.'}
                  </p>
                  {detail.lessee_entries.map((e) => (
                    <div key={e.id} className="sm:col-span-2 flex items-start justify-between gap-3 border-b border-green-800/5 pb-2 last:border-0">
                      <div>
                        <p className="text-[10px] uppercase tracking-wide text-muted mb-0.5">
                          {LESSEE_KIND_LABEL[e.kind]}{!detail.viewer_is_lessee && <> · <span className="text-gold-800 normal-case">Added by {e.author ?? 'the lessee'}</span></>}
                        </p>
                        <p className="text-sm text-green-900">{lesseeEntryLine(e)}</p>
                      </div>
                      {!detail.viewer_is_lessee && !!r.owner_name && (
                        <button type="button" onClick={() => void onHideLesseeEntry(e.id)} className="text-[11px] text-muted hover:text-red-700 underline shrink-0 mt-1">Hide</button>
                      )}
                      {detail.viewer_is_lessee && (
                        <button type="button" onClick={() => void deleteLesseeEntry(e.id).then(() => load())} className="text-[11px] text-muted hover:text-red-700 underline shrink-0 mt-1">Remove</button>
                      )}
                    </div>
                  ))}
                  {/* current lessee: add to their own layer */}
                  {detail.viewer_is_lessee && (
                    <div className="sm:col-span-2">
                      {addingLesseeEntry
                        ? <LesseeEntryEditor horseId={horseId} onAdded={() => void load()} onClose={() => setAddingLesseeEntry(false)} />
                        : <button type="button" onClick={() => setAddingLesseeEntry(true)} className="text-xs text-gold-800 border border-dashed border-gold-400 rounded-lg px-3 py-1.5 hover:bg-gold-50 focus-ring">＋ Add my own entry</button>}
                    </div>
                  )}
                  {/* owner: hidden entries count + reveal / un-hide */}
                  {!detail.viewer_is_lessee && detail.lessee_hidden_count > 0 && (
                    <div className="sm:col-span-2">
                      {hiddenLessee === null ? (
                        <button type="button" onClick={() => void onRevealHidden()} className="text-xs text-gold-800 underline">
                          Reveal {detail.lessee_hidden_count} hidden lessee {detail.lessee_hidden_count === 1 ? 'entry' : 'entries'}
                        </button>
                      ) : (
                        <div className="mt-2 flex flex-col gap-1">
                          <p className="text-[10px] uppercase tracking-wide text-muted">Hidden entries</p>
                          {hiddenLessee.map((e) => (
                            <div key={e.id} className="flex items-start justify-between gap-3 text-[13px] text-secondary">
                              <span>{LESSEE_KIND_LABEL[e.kind]} · {lesseeEntryLine(e)} <span className="text-muted">— {e.author}</span></span>
                              <button type="button" onClick={() => void onUnhideLesseeEntry(e.id)} className="text-[11px] text-gold-800 underline shrink-0">Un-hide</button>
                            </div>
                          ))}
                          <button type="button" onClick={() => setHiddenLessee(null)} className="self-start text-[11px] text-muted underline">Collapse</button>
                        </div>
                      )}
                    </div>
                  )}
                </Card>
              )}

              {/* HEALTH LOG (fix round 3, item 6) — below the disclosure sections,
                  visible to staff, the owner, and an active lessee; editable by the
                  same. Nothing in it feeds any contract or disclosure. */}
              <HealthLog horseId={horseId} />
            </div>
          )}

          {tab === 'documents' && deals.length > 0 && (
            /* reciprocal link (deal plan L8): the deals this horse is part of.
               A deal is the envelope its documents live in, so it sits above them. */
            <div className="mb-3">
              <p className="text-[10.5px] tracking-wide uppercase text-muted font-semibold mb-1.5">Deals</p>
              <ListCard empty="">
                {deals.map((d) => (
                  <Link key={d.id} to={`/app/ops/deals/${d.id}`} state={fromHere(location)}
                    className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-cream-100/50 focus-ring">
                    <span className="min-w-0">
                      <span className="block text-sm font-medium text-green-900 truncate">
                        {DEAL_TYPE_LABEL[d.deal_type]} deal
                      </span>
                      <span className="block text-[11px] text-muted">
                        {d.display_code ? `${d.display_code} · ` : ''}{fmtDate(d.created_at)}
                      </span>
                    </span>
                    <span className="text-[11px] px-2 py-0.5 rounded-full bg-gold-50 text-gold-900 whitespace-nowrap">
                      {titleCase(d.status)}
                    </span>
                  </Link>
                ))}
              </ListCard>
            </div>
          )}

          {tab === 'documents' && (
            <ListCard empty="No documents for this horse yet.">
              {detail.documents.map((d) => (
                <Link key={d.id} to={`/app/contracts/${d.id}`} state={fromHere(location)}
                  className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-cream-100/50 focus-ring">
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-green-900 truncate">{d.title}</span>
                    <span className="block text-[11px] text-muted">{d.display_code ? `${d.display_code} · ` : ''}{fmtDate(d.created_at)}</span>
                  </span>
                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-green-800/10 text-green-800 whitespace-nowrap">{titleCase(d.workflow_state || d.status)}</span>
                </Link>
              ))}
            </ListCard>
          )}

          {tab === 'schedule' && (
            <ListCard empty="No appointments scheduled for this horse.">
              {detail.schedule.map((s) => (
                <div key={s.id} className="flex items-center justify-between gap-3 px-4 py-3">
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-green-900">{titleCase(s.kind) || 'Appointment'}</span>
                    <span className="block text-[11px] text-muted">{fmtDateTime(s.starts_at)}{s.location ? ` · ${s.location}` : ''}</span>
                  </span>
                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-green-800/10 text-green-800 whitespace-nowrap">{titleCase(s.status)}</span>
                </div>
              ))}
            </ListCard>
          )}

          {tab === 'history' && (
            <div className="flex flex-col gap-5">
              <ListCard title="Sessions & reports" empty="No lesson or training reports for this horse yet.">
                {detail.sessions.map((s) => (
                  <div key={s.id} className="px-4 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm font-medium text-green-900">
                        {s.offering || titleCase(s.kind) || 'Session'}
                      </span>
                      <span className="text-[11px] text-muted whitespace-nowrap">{fmtDate(s.starts_at)}</span>
                    </div>
                    {s.activities && s.activities.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {s.activities.map((a, j) => (
                          <span key={j} className="text-[10px] bg-green-800/8 text-green-800 rounded px-1.5 py-0.5">{a}</span>
                        ))}
                      </div>
                    )}
                    {s.report && <p className="text-[12.5px] text-secondary mt-1.5 whitespace-pre-line">{s.report}</p>}
                    {s.location && <p className="text-[11px] text-muted mt-1">{s.location}</p>}
                  </div>
                ))}
              </ListCard>
              <ListCard title="Purchases" empty="No purchases associated with this horse.">
                {detail.purchases.map((p) => (
                  <div key={p.id} className="px-4 py-3 flex items-center justify-between gap-3">
                    <span className="min-w-0">
                      <span className="block text-sm font-medium text-green-900">
                        {p.amount != null ? `$${Number(p.amount).toLocaleString()}` : 'Purchase'}
                        {p.display_code && <span className="text-muted font-normal text-[11px]"> · {p.display_code}</span>}
                      </span>
                      <span className="block text-[11px] text-muted">
                        {fmtDate(p.paid_at || p.created_at)}{p.notes ? ` · ${p.notes}` : ''}
                      </span>
                    </span>
                    <span className="text-[11px] px-2 py-0.5 rounded-full bg-green-800/10 text-green-800 whitespace-nowrap">
                      {titleCase(p.payment_status || p.status)}
                    </span>
                  </div>
                ))}
              </ListCard>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Card({ title, children, full }: { title: string; children: React.ReactNode; full?: boolean }) {
  return (
    <section className="bg-white border border-green-800/10 rounded-xl p-5">
      <h2 className="font-serif text-green-800 mb-3">{title}</h2>
      <div className={full ? 'flex flex-col gap-3' : 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-3'}>{children}</div>
    </section>
  );
}

function ListCard({ title, empty, children }: { title?: string; empty: string; children: React.ReactNode }) {
  const items = Array.isArray(children) ? children.filter(Boolean) : children;
  const isEmpty = Array.isArray(items) ? items.length === 0 : !items;
  return (
    <section className="bg-white border border-green-800/10 rounded-xl overflow-hidden">
      {title && <h2 className="font-serif text-green-800 px-4 pt-4 pb-2">{title}</h2>}
      {isEmpty ? (
        <p className="text-sm text-muted px-4 py-6 text-center">{empty}</p>
      ) : (
        <div className="divide-y divide-green-800/8">{children}</div>
      )}
    </section>
  );
}

function MedList({ label, items }: { label: string; items: HorsePageDetail['medications'] }) {
  if (!items.length) return null;
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wide text-muted mb-1">{label}</p>
      <ul className="flex flex-col gap-1">
        {items.map((m, i) => (
          <li key={i} className="text-sm text-green-900">
            <span className="font-medium">{m.name}</span>
            {[m.dosage, m.instructions, m.order_units && m.days_supply ? `${m.order_units} (${m.days_supply}d)` : m.order_units,
              m.cost ? `${m.cost}/order` : null].filter(Boolean).map((p, j) => <span key={j} className="text-secondary"> · {p}</span>)}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default HorseRecord;
