import { useCallback, useEffect, useState } from 'react';
import { useParams, useNavigate, useLocation, Link } from 'react-router-dom';
import { fromHere } from '../../lib/linkOrigin';
import { FileText, CalendarDays, ClipboardList, PencilLine, Trash2, Activity, History } from 'lucide-react';
import { useDocumentTitle } from '../../lib/hooks';
import {
  horsePageDetail, deleteStableHorse, updateHorseRecord, endHorseProvider, endHorseLease,
  setLesseeEntryHidden, horseHiddenLesseeEntries, deleteLesseeEntry, HORSE_FIELD_LABELS,
  type HorsePageDetail, type HorseProvider, type LesseeEntry,
} from '../../lib/horses';
import { listHorseBreeds, listHorseColors } from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';
import { ProviderEditor } from '../../components/app/ProviderEditor';
import { LesseeEntryEditor } from '../../components/app/LesseeEntryEditor';
import { DisclosureEntryBoxes } from '../../components/app/DisclosureEntryBoxes';
import { buildRecordEntries } from '../../lib/disclosureMarker';
import { horseDeals, DEAL_TYPE_LABEL, type DealRow } from '../../lib/deals';
import { usePropertyTerm } from '../../contexts/BrandProvider';
import { withArticle } from '../../lib/propertyTerm';
import { toErrorMessage } from '../../lib/ops/errors';
import type { LookupCode } from '../../lib/ops/types';
import { BackControl } from '../../components/app/BackControl';

/**
 * HORSE PAGE (/app/horses/:horseId) — the client-facing record for one horse, with
 * tabs for everything tied to it: the Record (read-only, with Edit), Documents,
 * Schedule, and Activity (lesson/training reports + purchases). One read
 * (horse_page_detail) feeds every tab.
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
  const spots = (loc.keeping_spots ?? []).map((s) => `${s.term} ${s.value}`.trim()).filter(Boolean).join(' · ');
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

export default function HorsePage() {
  const { horseId } = useParams<{ horseId: string }>();
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

  useDocumentTitle(detail?.record.nickname || detail?.record.registered_name || 'Horse');

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

  if (error) return <div className="max-w-3xl mx-auto"><p role="alert" className="form-error">{error}</p></div>;
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
    <div className="max-w-4xl">
      {/* ⚠️ TASK-MODAL2 D5 — the record tabs below hold editable fields. */}
      <BackControl to="/app/account" label="My stable" className="mb-4" />

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

      {/* Editing shows a prefilled editor for the core record fields (update_horse_record).
          Locations, medications, and the lease are edited from their own surfaces. */}
      {editing ? (
        <RecordEditor horseId={horseId!} record={r} onCancel={() => setEditing(false)}
          onSaved={() => { setEditing(false); void load(); }} />
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
                      ? <ProviderEditor horseId={horseId!} onAdded={() => void load()} onClose={() => setAddingProvider(false)} />
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
                        ? <LesseeEntryEditor horseId={horseId!} onAdded={() => void load()} onClose={() => setAddingLesseeEntry(false)} />
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
      <div className={full ? 'flex flex-col gap-3' : 'grid sm:grid-cols-3 gap-x-6 gap-y-3'}>{children}</div>
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

/** A prefilled editor for the core record fields, saved via update_horse_record.
 *  (Locations, medications, and lease are edited from their own surfaces.) */
/* ⚠️ THESE TWO LIVED INSIDE `RecordEditor` AND THAT IS WHY YOU COULD ONLY TYPE
   ONE CHARACTER AT A TIME.

   Owner, 2026-08-25: *"when i click the edit button and i click something to
   edit, i can only type one character and i need to click again to be able to
   type another one."*

   `const T = (...) => …` inside a component body creates a BRAND-NEW FUNCTION on
   every render. React identifies an element by its `type` — a reference compare —
   so a new function is a DIFFERENT COMPONENT: it unmounts the old subtree and
   mounts a fresh one. Typing a character called `setF`, which re-rendered
   `RecordEditor`, which minted new `T` and `L`, which threw away the real `<input>`
   DOM node and built another. The browser's focus went with the node it was on.
   One keystroke per click, exactly as reported.

   Defined at module scope they have ONE stable identity for the life of the
   module, so React updates the existing input in place and focus survives. This
   is the only fix — `useCallback` would not help, because its deps must include
   the form state that changes on every keystroke.

   ⚠️ DO NOT MOVE THESE BACK INSIDE A COMPONENT, and do not define a new one
   inline "just for this form". See docs/reports/P1-CONTRACT-SHIP-REPORT.md. */
function RecordField({
  label, value, onChange, area,
}: {
  label: string; value: string; onChange: (v: string) => void; area?: boolean;
}) {
  return (
    <div className={area ? 'sm:col-span-2' : ''}>
      <label className="block text-[10px] uppercase tracking-wide text-muted mb-1">{label}</label>
      {area
        ? <textarea rows={2} className={`${RECORD_INPUT} resize-y`} value={value} onChange={(e) => onChange(e.target.value)} />
        : <input className={RECORD_INPUT} value={value} onChange={(e) => onChange(e.target.value)} />}
    </div>
  );
}

/** A lookup-backed select. Keeps an unrecognised current value as an option so
 *  editing an unrelated field cannot silently change breed/colour. */
function RecordSelect({
  label, value, onChange, opts, toCode,
}: {
  label: string; value: string; onChange: (v: string) => void;
  opts: LookupCode[]; toCode: (o: LookupCode[], v: string) => string;
}) {
  const known = opts.some((o) => o.code === value || o.display_name.toLowerCase() === value.toLowerCase());
  return (
    <div>
      <label className="block text-[10px] uppercase tracking-wide text-muted mb-1">{label}</label>
      <select className={RECORD_INPUT} value={toCode(opts, value)} onChange={(e) => onChange(e.target.value)}>
        <option value="">—</option>
        {!known && value && <option value={value}>{value} (not in list)</option>}
        {opts.map((o) => <option key={o.code} value={o.code}>{o.display_name}</option>)}
      </select>
    </div>
  );
}

const RECORD_INPUT = 'w-full px-3 py-2 rounded-lg border border-green-800/15 text-sm text-green-900 placeholder:text-muted focus-ring bg-white';

/** The edit form, as data — so the grid below is one map rather than 22 hand-placed
 *  elements, and adding a field is adding a row. `opts` names the lookup a field is
 *  backed by; absent means free text. */
const TEXT_FIELDS: { k: string; label: string; area?: boolean; opts?: 'breeds' | 'colors' }[] = [
  { k: 'nickname', label: 'Nickname' },
  { k: 'registered_name', label: 'Name on Registration Certificate' },
  { k: 'breed', label: 'Breed', opts: 'breeds' },
  { k: 'color', label: 'Color', opts: 'colors' },
  { k: 'markings', label: 'Markings', area: true },
  { k: 'sex', label: 'Sex' },
  { k: 'height', label: 'Height' },
  { k: 'fair_market_value', label: 'Fair market value' },
  { k: 'registration_number', label: 'Registration #' },
  { k: 'registration_org', label: 'Registration org' },
  { k: 'microchip_id', label: 'Microchip' },
  { k: 'passport_number', label: 'Passport #' },
  { k: 'passport_country', label: 'Passport country' },
];

function RecordEditor({
  horseId, record, onCancel, onSaved,
}: {
  horseId: string;
  record: HorsePageDetail['record'];
  onCancel: () => void;
  onSaved: () => void;
}) {
  const [f, setF] = useState<Record<string, string>>({
    nickname: record.nickname ?? '', registered_name: record.registered_name ?? '',
    breed: record.breed ?? '', color: record.color ?? '', markings: record.markings ?? '',
    sex: record.sex ?? '', height: record.height ?? '',
    registration_number: record.registration_number ?? '', registration_org: record.registration_org ?? '',
    microchip_id: record.microchip_id ?? '', passport_number: record.passport_number ?? '',
    passport_country: record.passport_country ?? '',
    fair_market_value: record.fair_market_value != null ? String(record.fair_market_value) : '',
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const set = (k: string) => (v: string) => setF((p) => ({ ...p, [k]: v }));

  // breed/color are FK-constrained to horse_breeds(code) / horse_colors(code),
  // but horse_page_detail returns their DISPLAY NAMES (it coalesces through the
  // lookup). Free-text inputs seeded from a display name therefore wrote
  // 'Thoroughbred' into a column that only accepts 'THOROUGHBRED', and the FK
  // rejected the ENTIRE patch — every "Save changes" on a horse with a breed or
  // colour set failed. Load the lookups and round-trip through codes.
  const [breeds, setBreeds] = useState<LookupCode[]>([]);
  const [colors, setColors] = useState<LookupCode[]>([]);
  useEffect(() => {
    let active = true;
    void Promise.all([listHorseBreeds(), listHorseColors()])
      .then(([b, c]) => { if (active) { setBreeds(b); setColors(c); } })
      .catch(() => { /* selects fall back to the current value only */ });
    return () => { active = false; };
  }, []);

  /** Map whatever the record gave us (a display name, or already a code) onto
   *  the lookup's code. Unmatched values pass through so a legacy free-text
   *  value is never silently blanked — the FK will still reject it loudly. */
  const toCode = (opts: LookupCode[], v: string): string => {
    if (!v) return '';
    const hit = opts.find((o) => o.code === v)
      ?? opts.find((o) => o.display_name.toLowerCase() === v.toLowerCase());
    return hit?.code ?? v;
  };

  async function save() {
    setBusy(true); setErr(null);
    try {
      await updateHorseRecord(horseId, {
        ...f,
        breed: toCode(breeds, f.breed),
        color: toCode(colors, f.color),
      });
      onSaved();
    }
    catch (e) { setErr(toErrorMessage(e, 'Could not save changes.')); setBusy(false); }
  }

  return (
    <section className="bg-white border border-green-800/10 rounded-xl p-5">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-serif text-green-800 text-lg">Edit record</h2>
        <button type="button" onClick={onCancel} className="text-xs text-muted underline">Cancel</button>
      </div>
      <p className="text-[12px] text-muted mb-4">Location, care providers, medications, histories, and the lease are edited from their own sections on the record.</p>
      {err && <p role="alert" className="form-error mb-3">{err}</p>}
      <div className="grid sm:grid-cols-2 gap-3">
        {TEXT_FIELDS.map((fd) => (fd.opts
          ? (
            <RecordSelect key={fd.k} label={fd.label} value={f[fd.k]} onChange={set(fd.k)}
              opts={fd.opts === 'breeds' ? breeds : colors} toCode={toCode} />
          ) : (
            <RecordField key={fd.k} label={fd.label} value={f[fd.k]} onChange={set(fd.k)} area={fd.area} />
          )
        ))}
      </div>
      <div className="flex justify-end gap-2 mt-4">
        <button type="button" className="btn-secondary text-sm" onClick={onCancel}>Cancel</button>
        <button type="button" className="btn-primary text-sm" disabled={busy} onClick={() => void save()}>Save changes</button>
      </div>
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
