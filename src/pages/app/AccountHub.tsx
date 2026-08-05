import { useEffect, useState } from 'react';
import {
  UserRound, Grid3x3, Bookmark, FileText, Boxes,
  ShoppingBag, Gift, ChevronRight, ExternalLink, X,
} from 'lucide-react';
import { useDocumentTitle } from '../../lib/hooks';
import {
  SEED_STABLE_HORSES, SEED_STABLE_GEAR, SEED_STABLE_SUPPLIES, SEED_ENABLED,
} from '../../lib/seed';
import {
  listStableHorses, listStableItems,
  type StableHorse, type StableItem,
} from '../../lib/stable';
import { AddItemModal } from '../../components/app/StableEditors';
import { HorseIntakeForm } from '../../components/app/HorseIntakeForm';
import { SavedPanel, DocumentsPanel } from '../../components/app/AccountPanels';
import { ProfileAndPreferences } from '../../components/app/profile/ProfileAndPreferences';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';

/**
 * ACCOUNT HUB (/app/account) — the "me" surface for every user type, reached from
 * the avatar menu. Grouped rows: You / Billing & orders / Help. A couple of rows
 * (Profile & preferences, My Stable) expand inline to show the tailored forms the
 * product locked; the rest are entry points to their detail pages. Seed-populated
 * so the structure is visible on the preview. The email-change/auth state machine
 * and full My Stable editing land in the follow-up passes.
 */

type Section = 'profile' | 'stable' | 'saved' | 'documents' | null;

function Row({
  icon: Icon, title, sub, onClick, open,
}: {
  icon: typeof UserRound; title: string; sub?: string; onClick?: () => void; open?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full flex items-center justify-between px-5 py-5 bg-white border border-green-800/10 rounded-xl hover:border-green-800/25 hover:shadow-[0_10px_24px_-16px_rgba(13,33,24,0.25)] transition-all focus-ring text-left"
    >
      <span className="flex items-center gap-4 min-w-0">
        <span className="w-11 h-11 rounded-lg bg-cream-100 grid place-items-center text-green-700 shrink-0"><Icon size={20} /></span>
        <span className="min-w-0">
          <span className="block text-[15px] font-medium text-green-900">{title}</span>
          {sub && <span className="block text-[12.5px] text-muted mt-0.5">{sub}</span>}
        </span>
      </span>
      <ChevronRight size={18} className={`text-muted shrink-0 transition-transform ${open ? 'rotate-90' : ''}`} />
    </button>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-[10px] tracking-widest uppercase text-muted font-semibold mt-5 mb-2.5 first:mt-0">{children}</p>;
}

// ── My Stable (inline, live) ───────────────────────────────────
const fmtDate = (s?: string | null) =>
  s ? new Date(s).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : '—';

function StableSection() {
  const [horses, setHorses] = useState<StableHorse[] | null>(null);
  const [gear, setGear] = useState<StableItem[] | null>(null);
  const [supplies, setSupplies] = useState<StableItem[] | null>(null);
  const [modal, setModal] = useState<'horse' | 'gear' | 'supply' | null>(null);

  const loadHorses = () => listStableHorses().then(setHorses).catch(() => setHorses([]));
  const loadGear = () => listStableItems('gear').then(setGear).catch(() => setGear([]));
  const loadSupplies = () => listStableItems('supply').then(setSupplies).catch(() => setSupplies([]));

  useEffect(() => {
    let active = true;
    listStableHorses().then((h) => active && setHorses(h)).catch(() => active && setHorses([]));
    listStableItems('gear').then((g) => active && setGear(g)).catch(() => active && setGear([]));
    listStableItems('supply').then((s) => active && setSupplies(s)).catch(() => active && setSupplies([]));
    return () => { active = false; };
  }, []);

  // Fall back to seed only when a live list is empty (preview).
  const showHorses = (horses && horses.length > 0)
    ? horses.map((h) => ({ id: h.id, name: h.name, barnName: h.nickname ?? undefined,
        breed: h.breed ?? '', sex: h.sex ?? '', height: h.height_hh ?? '', age: h.age_or_foaling ?? '',
        // no `discipline` — horses has no such column (see StableEditors)
        color: h.color ?? '', discipline: '',
        ownership: h.ownership === 'leased'
          ? (h.lease_end ? `Leased through ${fmtDate(h.lease_end)}` : 'Leased')
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
      <SectionLabel>Horses</SectionLabel>
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
        <button type="button" onClick={() => setModal('horse')} className="text-[12px] text-gold-800 font-semibold text-left px-1">+ Add a horse</button>
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

      {modal === 'horse' && (
        <div className="fixed inset-0 bg-black/40 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={() => setModal(null)}>
          <div className="bg-cream w-full sm:max-w-2xl sm:rounded-2xl flex flex-col max-h-[92dvh] overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-green-800/10 shrink-0">
              <h2 className="font-serif text-green-800 text-lg">Add a horse</h2>
              <button type="button" onClick={() => setModal(null)} aria-label="Close"><X size={20} /></button>
            </div>
            <div className="p-4 sm:p-5 overflow-y-auto pb-8">
              {/* the standardized record intake (spec H.2/H.3 path 2) — creates the
                  real horse record with microchip dedup, then refreshes My Stable */}
              <HorseIntakeForm submitLabel="Add to my stable" onDone={() => { setModal(null); loadHorses(); }} />
            </div>
          </div>
        </div>
      )}
      {modal === 'gear' && <AddItemModal kind="gear" onClose={() => setModal(null)} onDone={loadGear} />}
      {modal === 'supply' && <AddItemModal kind="supply" onClose={() => setModal(null)} onDone={loadSupplies} />}
    </div>
  );
}

export default function AccountHub() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const realName = profile?.display_name
    || [profile?.first_name, profile?.last_name].filter(Boolean).join(' ')
    || 'Your profile';
  useDocumentTitle('Account');
  const [searchParams] = useSearchParams();
  const [open, setOpen] = useState<Section>(() => {
    const s = searchParams.get('section');
    return (s === 'profile' || s === 'stable' || s === 'saved' || s === 'documents') ? s : null;
  });
  const toggle = (s: Section) => setOpen((cur) => (cur === s ? null : s));

  // D8: every account holder sees the full account surface — "guest" is
  // display copy only, never a gate.

  return (
    <div className="max-w-6xl mx-auto">
      <header className="mb-4">
        <p className="eyebrow">Your account</p>
        <h1 className="font-serif text-green-800 text-3xl font-semibold mt-0.5">Account</h1>
      </header>

      <div className="grid lg:grid-cols-2 gap-3">
        <Row icon={UserRound} title="Profile &amp; preferences" sub={`${realName} · profile, account & security`} onClick={() => toggle('profile')} open={open === 'profile'} />
        {open === 'profile' && <div className="lg:col-span-2"><ProfileAndPreferences /></div>}
        <Row icon={Grid3x3} title="My posts" sub="Your posts & listings" onClick={() => navigate('/app/my-posts')} />
        <Row icon={Boxes} title="My lessons" sub="Credits, schedule & your progress" onClick={() => navigate('/app/lessons')} />
        <Row icon={Bookmark} title="Saved items" sub="Articles, listings, and links you kept" onClick={() => toggle('saved')} open={open === 'saved'} />
        {open === 'saved' && <div className="lg:col-span-2"><SavedPanel /></div>}
        <Row icon={FileText} title="Documents" sub="Signed agreements & releases" onClick={() => toggle('documents')} open={open === 'documents'} />
        {open === 'documents' && <div className="lg:col-span-2"><DocumentsPanel /></div>}
        <Row icon={Boxes} title="My Stable" sub="Your horses, gear, and supplies" onClick={() => toggle('stable')} open={open === 'stable'} />
        {open === 'stable' && <div className="lg:col-span-2"><StableSection /></div>}
        <Row icon={ShoppingBag} title="Orders" sub="Your purchases" onClick={() => navigate('/app/orders')} />
        <Row icon={Gift} title="Gifts" sub="Gifts you can use" onClick={() => navigate('/app/gifts')} />
      </div>
    </div>
  );
}
