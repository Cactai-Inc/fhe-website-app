import { useCallback, useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { FileText, CalendarDays, ClipboardList, PencilLine, Trash2, ArrowLeft, Activity } from 'lucide-react';
import { useDocumentTitle } from '../../lib/hooks';
import { horsePageDetail, deleteStableHorse, updateHorseRecord, type HorsePageDetail } from '../../lib/horses';

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

function composeLocation(loc: HorsePageDetail['record']['home_location'], barn?: string | null, stall?: string | null) {
  if (!loc?.name) return null;
  const addr = [loc.address_line1, loc.city, [loc.state, loc.postal].filter(Boolean).join(' ')].filter(Boolean).join(', ');
  const bs = [barn, stall].filter(Boolean).join(' · ');
  return [loc.name, addr, bs].filter(Boolean).join(' — ');
}

export default function HorsePage() {
  const { horseId } = useParams<{ horseId: string }>();
  const navigate = useNavigate();
  const [detail, setDetail] = useState<HorsePageDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('record');
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);

  useDocumentTitle(detail?.record.nickname || detail?.record.registered_name || 'Horse');

  const load = useCallback(async () => {
    if (!horseId) return;
    try { setDetail(await horsePageDetail(horseId)); setError(null); }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not load this horse.'); }
  }, [horseId]);
  useEffect(() => { void load(); }, [load]);

  async function onDelete() {
    if (!horseId) return;
    if (!window.confirm('Remove this horse from your stable? This cannot be undone.')) return;
    setBusy(true);
    try { await deleteStableHorse(horseId); navigate('/app/account'); }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not remove the horse.'); setBusy(false); }
  }

  if (error) return <div className="max-w-3xl"><p role="alert" className="form-error">{error}</p></div>;
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
      <Link to="/app/account" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-green-800 mb-4">
        <ArrowLeft size={14} /> My stable
      </Link>

      <div className="flex items-start justify-between gap-3 mb-1">
        <div>
          <h1 className="font-serif text-2xl text-green-900">{name}</h1>
          {r.registered_name && r.registered_name !== name && <p className="text-sm text-muted">{r.registered_name}</p>}
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
              <Card title="Identity">
                <Detail label="Nickname" value={r.nickname} />
                <Detail label="Registered name" value={r.registered_name} />
                <Detail label="Breed" value={r.breed} />
                <Detail label="Color" value={r.color} />
                <Detail label="Markings" value={r.markings} />
                <Detail label="Sex" value={titleCase(r.sex)} />
                <Detail label="Date of birth" value={fmtDate(r.date_of_birth)} />
                <Detail label="Height" value={r.height} />
                <Detail label="Registration #" value={r.registration_number} />
                <Detail label="Registration org" value={r.registration_org} />
                <Detail label="Microchip" value={r.microchip_id} />
                <Detail label="Passport #" value={r.passport_number} />
                <Detail label="Passport country" value={r.passport_country} />
                <Detail label="Fair market value" value={r.fair_market_value != null ? `$${Number(r.fair_market_value).toLocaleString()}` : null} />
              </Card>

              <Card title="Location">
                <Detail label="Home" value={composeLocation(r.home_location, r.home_barn, r.home_stall)} />
                <Detail label="Currently at" value={composeLocation(r.current_location, r.current_barn, r.current_stall)} />
                <Detail label="Owner" value={r.owner_name} />
                {r.lessee_name && <Detail label="Leased to" value={`${r.lessee_name}${r.lease_end ? ` (through ${fmtDate(r.lease_end)})` : ''}`} />}
              </Card>

              <Card title="Care team">
                <Detail label="Veterinarian" value={[r.vet_name, r.vet_business_name, r.vet_phone].filter(Boolean).join(' · ')} />
                <Detail label="Farrier" value={[r.farrier_name, r.farrier_phone].filter(Boolean).join(' · ')} />
                <Detail label="Trainer" value={r.home_trainer} />
                <Detail label="Care giver" value={r.home_care_giver} />
                <Detail label="Groom" value={r.home_groom} />
              </Card>

              {(meds.length > 0 || supplements.length > 0) && (
                <Card title="Medications & supplements" full>
                  <MedList label="Medications" items={meds} />
                  <MedList label="Supplements" items={supplements} />
                </Card>
              )}

              {(r.medical_history || r.behavioral_history || r.known_conditions || r.training_history || r.competition_history) && (
                <Card title="Health & history" full>
                  <Detail label="Medical history" value={r.medical_history} />
                  <Detail label="Behavioral concerns" value={r.behavioral_history} />
                  <Detail label="Known conditions" value={r.known_conditions} />
                  <Detail label="Training history" value={r.training_history} />
                  <Detail label="Competition history" value={r.competition_history} />
                </Card>
              )}
            </div>
          )}

          {tab === 'documents' && (
            <ListCard empty="No documents for this horse yet.">
              {detail.documents.map((d) => (
                <Link key={d.id} to={`/app/contracts/${d.id}`}
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
    vet_name: record.vet_name ?? '', vet_phone: record.vet_phone ?? '',
    farrier_name: record.farrier_name ?? '', farrier_phone: record.farrier_phone ?? '',
    medical_history: record.medical_history ?? '', behavioral_history: record.behavioral_history ?? '',
    known_conditions: record.known_conditions ?? '', training_history: record.training_history ?? '',
    competition_history: record.competition_history ?? '',
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const set = (k: string) => (v: string) => setF((p) => ({ ...p, [k]: v }));
  const input = 'w-full px-3 py-2 rounded-lg border border-green-800/15 text-sm text-green-900 placeholder:text-muted focus-ring bg-white';

  async function save() {
    setBusy(true); setErr(null);
    try { await updateHorseRecord(horseId, f); onSaved(); }
    catch (e) { setErr(e instanceof Error ? e.message : 'Could not save changes.'); setBusy(false); }
  }
  const T = ({ label, k, area }: { label: string; k: string; area?: boolean }) => (
    <div className={area ? 'sm:col-span-2' : ''}>
      <label className="block text-[10px] uppercase tracking-wide text-muted mb-1">{label}</label>
      {area
        ? <textarea rows={2} className={`${input} resize-y`} value={f[k]} onChange={(e) => set(k)(e.target.value)} />
        : <input className={input} value={f[k]} onChange={(e) => set(k)(e.target.value)} />}
    </div>
  );

  return (
    <section className="bg-white border border-green-800/10 rounded-xl p-5">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-serif text-green-800 text-lg">Edit record</h2>
        <button type="button" onClick={onCancel} className="text-xs text-muted underline">Cancel</button>
      </div>
      <p className="text-[12px] text-muted mb-4">Location, medications, and lease are edited from their own sections.</p>
      {err && <p role="alert" className="form-error mb-3">{err}</p>}
      <div className="grid sm:grid-cols-2 gap-3">
        <T label="Nickname" k="nickname" /><T label="Registered name" k="registered_name" />
        <T label="Breed" k="breed" /><T label="Color" k="color" />
        <T label="Markings" k="markings" /><T label="Sex" k="sex" />
        <T label="Height" k="height" /><T label="Fair market value" k="fair_market_value" />
        <T label="Registration #" k="registration_number" /><T label="Registration org" k="registration_org" />
        <T label="Microchip" k="microchip_id" />
        <T label="Passport #" k="passport_number" /><T label="Passport country" k="passport_country" />
        <T label="Veterinarian" k="vet_name" /><T label="Vet phone" k="vet_phone" />
        <T label="Farrier" k="farrier_name" /><T label="Farrier phone" k="farrier_phone" />
        <T label="Medical history" k="medical_history" area />
        <T label="Behavioral concerns" k="behavioral_history" area />
        <T label="Known conditions" k="known_conditions" area />
        <T label="Training history" k="training_history" area />
        <T label="Competition history" k="competition_history" area />
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
