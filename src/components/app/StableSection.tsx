import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ExternalLink } from 'lucide-react';
import {
  SEED_STABLE_HORSES, SEED_STABLE_GEAR, SEED_STABLE_SUPPLIES, SEED_ENABLED,
} from '../../lib/seed';
import {
  listStableHorses, listStableItems,
  type StableHorse, type StableItem, type StableItemOwnerKind,
} from '../../lib/stable';
import { companyContactId } from '../../lib/horses';
import { useAuth } from '../../contexts/AuthContext';
import { AddItemModal } from './StableEditors';
import { Modal } from '../ops/kit/Modal';
import { HorseIntakeForm } from './HorseIntakeForm';
import { PageCreateButton } from './PageCreateButton';

/**
 * MY STABLE — the shared subject content, rendered inline by the Account page
 * and wrapped in a page header by /app/stable (TASK-ACCOUNTSURFACE §2/§3).
 * Moved verbatim out of AccountHub.tsx; not rewritten. Horses, gear and
 * supplies, three independent loads, an add-item modal, and the PLUSPASS
 * "+ Horse" control (via HorseIntakeForm, which owns the microchip-dedup path).
 */

const fmtDate = (s?: string | null) =>
  s ? new Date(s).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : '—';

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-[10px] tracking-widest uppercase text-muted font-semibold mt-5 mb-2.5 first:mt-0">{children}</p>;
}

export function StableSection() {
  const { isStaff } = useAuth();
  // D7 — "staff default to company voice": staff land on the business's
  // stable; personal is the opt-out (same convention FeedComposer/CreateModal
  // already use for posting as the company). Non-staff never see the toggle.
  const [asCompany, setAsCompany] = useState(isStaff);
  const ownerKind: StableItemOwnerKind = asCompany ? 'org' : 'contact';
  const [companyId, setCompanyId] = useState<string | null>(null);
  useEffect(() => {
    if (isStaff) companyContactId().then(setCompanyId).catch(() => setCompanyId(null));
  }, [isStaff]);

  const [horses, setHorses] = useState<StableHorse[] | null>(null);
  const [gear, setGear] = useState<StableItem[] | null>(null);
  const [supplies, setSupplies] = useState<StableItem[] | null>(null);
  const [modal, setModal] = useState<'horse' | 'gear' | 'supply' | null>(null);

  const loadHorses = () => listStableHorses(asCompany).then(setHorses).catch(() => setHorses([]));
  const loadGear = () => listStableItems('gear', ownerKind).then(setGear).catch(() => setGear([]));
  const loadSupplies = () => listStableItems('supply', ownerKind).then(setSupplies).catch(() => setSupplies([]));

  useEffect(() => {
    let active = true;
    setHorses(null); setGear(null); setSupplies(null);
    listStableHorses(asCompany).then((h) => active && setHorses(h)).catch(() => active && setHorses([]));
    listStableItems('gear', ownerKind).then((g) => active && setGear(g)).catch(() => active && setGear([]));
    listStableItems('supply', ownerKind).then((s) => active && setSupplies(s)).catch(() => active && setSupplies([]));
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [asCompany]);

  // Fall back to seed only when a live list is empty (preview).
  const showHorses = (horses && horses.length > 0)
    ? horses.map((h) => ({ id: h.id, name: h.name, barnName: h.nickname ?? undefined,
        breed: h.breed ?? '', sex: h.sex ?? '', height: h.height_hh ?? '', age: h.age_or_foaling ?? '',
        // no `discipline` — horses has no such column (see StableEditors)
        color: h.color ?? '', discipline: '',
        ownership: h.ownership === 'leased'
          /* CLOSEOUT §1.4 (owner-ruled): a NULL lease end is an EVERGREEN lease
             running until terminated — deliberate, never a blank. */
          ? (h.lease_end ? `Leased through ${fmtDate(h.lease_end)}` : 'Leased — evergreen')
          : 'Owned',
        location: h.location }))
    : (SEED_ENABLED ? SEED_STABLE_HORSES : []);

  const showGear = (gear && gear.length > 0)
    ? gear.map((g) => ({ id: g.id, name: g.name, detail: g.detail ?? undefined, vendor: g.vendor?.name, vendorUrl: g.vendor?.url ?? '#' }))
    : (SEED_ENABLED ? SEED_STABLE_GEAR : []);

  const showSupplies = (supplies && supplies.length > 0)
    ? supplies.map((s) => ({ id: s.id, name: s.name, detail: s.detail ?? undefined, vendor: s.vendor?.name, vendorUrl: s.vendor?.url ?? '#' }))
    : (SEED_ENABLED ? SEED_STABLE_SUPPLIES : []);

  return (
    <div className="mt-2.5 mb-1 p-4 bg-cream-100/60 border border-green-800/10 rounded-xl">
      {/* D7 — act as company. Staff only; a non-staff member has no other
          stable to switch to. */}
      {isStaff && (
        <div className="inline-flex rounded-full bg-green-800/10 p-0.5 mb-3">
          {([
            { key: true, label: 'The business' },
            { key: false, label: 'My own' },
          ] as const).map((opt) => (
            <button
              key={String(opt.key)}
              type="button"
              aria-pressed={asCompany === opt.key}
              onClick={() => setAsCompany(opt.key)}
              className={`px-3 py-1 rounded-full text-xs font-medium ${
                asCompany === opt.key ? 'bg-green-800 text-white' : 'text-green-800'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
      <div className="flex items-center justify-between gap-3">
        <SectionLabel>Horses</SectionLabel>
        <PageCreateButton label="Horse" onClick={() => setModal('horse')} />
      </div>
      <div className="flex flex-col gap-2.5">
        {showHorses.map((h) => (
          <Link key={h.id} to={`/app/horses/${h.id}`}
            className="block bg-white border border-green-800/10 rounded-xl p-4 hover:border-green-800/30 focus-ring transition-colors">
            <div className="flex items-center gap-3">
              <div className="w-14 h-14 rounded-lg bg-gradient-to-br from-green-50 to-gold-50 shrink-0" />
              <div className="min-w-0">
                <p className="font-serif text-green-800 text-lg font-semibold leading-tight">
                  {h.name}{h.barnName && <span className="text-muted font-sans text-sm font-normal"> · "{h.barnName}"</span>}
                </p>
                <p className="text-[11.5px] text-muted">{[h.breed, h.sex, h.height, h.age, h.color].filter(Boolean).join(' · ')}</p>
                <p className="text-[11px] text-gold-800 font-semibold mt-0.5">{[h.ownership, h.discipline, h.location].filter(Boolean).join(' · ')}</p>
              </div>
            </div>
          </Link>
        ))}
      </div>

      <SectionLabel>Gear</SectionLabel>
      <div className="flex flex-col gap-2">
        {showGear.map((g) => (
          <div key={g.id} className="flex items-center justify-between bg-white border border-green-800/10 rounded-xl px-3.5 py-2.5">
            <div className="min-w-0">
              <p className="text-[13px] font-medium text-green-900 truncate">{g.name}</p>
              {g.detail && <p className="text-[11px] text-muted">{g.detail}</p>}
            </div>
            {g.vendor && (
              <a href={g.vendorUrl} className="inline-flex items-center gap-1 text-[11px] text-gold-800 font-semibold shrink-0 ml-3">
                <ExternalLink size={12} /> {g.vendor}
              </a>
            )}
          </div>
        ))}
        <button type="button" onClick={() => setModal('gear')} className="text-[12px] text-gold-800 font-semibold text-left px-1">+ Add gear</button>
      </div>

      <SectionLabel>Supplies</SectionLabel>
      <div className="flex flex-col gap-2">
        {showSupplies.map((s) => (
          <div key={s.id} className="flex items-center justify-between bg-white border border-green-800/10 rounded-xl px-3.5 py-2.5">
            <div className="min-w-0">
              <p className="text-[13px] font-medium text-green-900 truncate">{s.name}</p>
              {s.detail && <p className="text-[11px] text-muted">{s.detail}</p>}
            </div>
            {s.vendor && (
              <a href={s.vendorUrl} className="inline-flex items-center gap-1 text-[11px] text-gold-800 font-semibold shrink-0 ml-3">
                <ExternalLink size={12} /> {s.vendor}
              </a>
            )}
          </div>
        ))}
        <button type="button" onClick={() => setModal('supply')} className="text-[12px] text-gold-800 font-semibold text-left px-1">+ Add a supply</button>
      </div>

      {/* ⚠️ TASK-FIX4 §3 — converged. Fourteen intake fields behind a backdrop that
          used to close on a stray click; that is CR-68a's own incident. */}
      {modal === 'horse' && (
        <Modal open onClose={() => setModal(null)} title="Add a horse"
          variant="sheet" size="lg" panelClassName="bg-cream">
          {/* the standardized record intake (spec H.2/H.3 path 2) — creates the
              real horse record with microchip dedup, then refreshes My Stable.
              ownerContactId (staff-only, already supported by this form) is
              the company's contact when adding to the business's stable. */}
          <HorseIntakeForm
            submitLabel={asCompany ? 'Add to the business stable' : 'Add to my stable'}
            ownerContactId={asCompany ? (companyId ?? undefined) : undefined}
            onDone={() => { setModal(null); loadHorses(); }}
          />
        </Modal>
      )}
      {modal === 'gear' && <AddItemModal kind="gear" ownerKind={ownerKind} onClose={() => setModal(null)} onDone={loadGear} />}
      {modal === 'supply' && <AddItemModal kind="supply" ownerKind={ownerKind} onClose={() => setModal(null)} onDone={loadSupplies} />}
    </div>
  );
}
