import { Link, Navigate, useParams, useNavigate } from 'react-router-dom';
import { Fence, Boxes, Building2, ArrowLeft } from 'lucide-react';
import { useDocumentTitle } from '../../lib/hooks';
import HorseRecordsPage from './ops/HorseRecordsPage';
import ResourcesPage from './ops/barnops/ResourcesPage';
import ConsumptionLogPage from './ops/barnops/ConsumptionLogPage';
import FacilitiesPage from './ops/boarding/FacilitiesPage';
import { ContactDossierModal } from '../../components/app/ContactDossierModal';
import { useState } from 'react';

/**
 * MY STABLE (/app/my-stable) — FHE's own operation, three doors (owner
 * 2026-09-12): Horses · Supplies · Property. This is the staff/business surface,
 * FHE-only content — distinct from the member-side "My Stable" card. Each door is
 * its own sub-page; a main→sub nav (CR-114) sits at the top: door cards on the
 * hub, and a sub-nav strip on each door so you can move between them.
 *
 * ⚠️ The full Supplies LEDGER system (FIFO lots, consumption ledger, the billing
 * resolver, per-horse consumption cards — TASK-SUPPLIES) is a separate ruled
 * build. This hub wires the doors to the surfaces that exist today so the
 * structure and navigation the owner asked for are real now; the Supplies door
 * lands on the current resources + consumption surfaces, which that build
 * replaces in place.
 */

type Door = 'horses' | 'supplies' | 'property';
const DOORS: { id: Door; label: string; icon: typeof Fence; blurb: string }[] = [
  { id: 'horses', label: 'Horses', icon: Fence, blurb: 'The horses on the ranch — records, health, parties and relationships.' },
  { id: 'supplies', label: 'Supplies', icon: Boxes, blurb: 'Feed, bedding, medical and consumables — stock, usage and cost.' },
  { id: 'property', label: 'Property', icon: Building2, blurb: 'Durable goods and the physical property — the tackroom, stalls and gear.' },
];

function SubNav({ active }: { active: Door }) {
  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 mb-4">
      <div className="mb-3">
        <Link to="/app/my-stable"
          className="inline-flex items-center gap-1.5 text-sm text-green-800 hover:text-green-900 focus-ring rounded">
          <ArrowLeft size={16} /> My Stable
        </Link>
      </div>
      {/* CR-114 — buttons on desktop, dropdown on mobile. */}
      <nav className="hidden sm:flex flex-wrap gap-1.5" aria-label="My Stable">
        {DOORS.map((d) => (
          <Link key={d.id} to={`/app/my-stable/${d.id}`}
            aria-current={active === d.id ? 'page' : undefined}
            className={`px-4 py-2 rounded-full text-sm font-medium focus-ring ${
              active === d.id ? 'bg-green-800 text-white' : 'bg-green-800/10 text-green-800 hover:bg-green-800/20'}`}>
            {d.label}
          </Link>
        ))}
      </nav>
      <MobileDoorSelect active={active} />
    </div>
  );
}

function MobileDoorSelect({ active }: { active: Door }) {
  const navigate = useNavigate();
  return (
    <select className="form-input sm:hidden" aria-label="My Stable section" value={active}
      onChange={(e) => navigate(`/app/my-stable/${e.target.value}`)}>
      {DOORS.map((d) => <option key={d.id} value={d.id}>{d.label}</option>)}
    </select>
  );
}

/** The hub — three door cards. */
function StableHub() {
  useDocumentTitle('My Stable');
  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6">
      <header className="mb-5">
        <p className="eyebrow">My Stable</p>
        <h1 className="font-serif text-green-800 text-3xl font-semibold mt-0.5">The ranch, ours to run.</h1>
      </header>
      <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
        {DOORS.map((d) => (
          <Link key={d.id} to={`/app/my-stable/${d.id}`}
            className="bg-white border border-green-800/10 rounded-xl p-5 hover:border-green-800/30 hover:shadow-[0_10px_24px_-16px_rgba(13,33,24,0.25)] transition-all focus-ring">
            <span className="w-11 h-11 rounded-lg bg-cream-100 grid place-items-center text-green-700 mb-3"><d.icon size={20} /></span>
            <p className="text-[15px] font-medium text-green-900">{d.label}</p>
            <p className="text-[12.5px] text-muted mt-1">{d.blurb}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}

export default function MyStablePage() {
  const { door } = useParams<{ door?: string }>();
  const [crossContact, setCrossContact] = useState<string | null>(null);

  if (!door) return <StableHub />;
  if (!DOORS.some((d) => d.id === door)) return <Navigate to="/app/my-stable" replace />;

  return (
    <div className="pb-10">
      <SubNav active={door as Door} />
      {door === 'horses' && <HorseRecordsPage onOpenContact={setCrossContact} />}
      {door === 'supplies' && (
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col gap-8">
          <ResourcesPage />
          <ConsumptionLogPage />
        </div>
      )}
      {door === 'property' && <FacilitiesPage />}

      {crossContact && (
        <ContactDossierModal contactId={crossContact} onClose={() => setCrossContact(null)} />
      )}
    </div>
  );
}
