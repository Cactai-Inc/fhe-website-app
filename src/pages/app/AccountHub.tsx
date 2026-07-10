import { useEffect, useState } from 'react';
import {
  UserRound, Grid3x3, Bookmark, FileText, Boxes, CreditCard, BadgeCheck,
  ShoppingBag, Gift, LifeBuoy, ChevronRight, ExternalLink, Mail, Smartphone,
  MessageSquare, Instagram, Facebook, Linkedin, Music2, Check,
} from 'lucide-react';
import { useDocumentTitle } from '../../lib/hooks';
import {
  SEED_STABLE_HORSES, SEED_STABLE_GEAR, SEED_STABLE_SUPPLIES, SEED_ENABLED,
} from '../../lib/seed';
import {
  listStableHorses, listStableItems,
  type StableHorse, type StableItem,
} from '../../lib/stable';
import { AddHorseModal, AddItemModal } from '../../components/app/StableEditors';
import { EmailChangeModal } from '../../components/app/EmailChangeModal';
import { GiftsPanel, SavedPanel, DocumentsPanel } from '../../components/app/AccountPanels';
import { useAuth } from '../../contexts/AuthContext';
import { getMyContactPrefs, saveMyContactPrefs, type MyContactPrefs } from '../../lib/contact';
import { startGoogleChange, startPasswordChange } from '../../lib/emailChange';
import { listBillingSchedules, nextDue } from '../../lib/billing';
import { useNavigate } from 'react-router-dom';

/**
 * ACCOUNT HUB (/app/account) — the "me" surface for every user type, reached from
 * the avatar menu. Grouped rows: You / Billing & orders / Help. A couple of rows
 * (Profile & preferences, My Stable) expand inline to show the tailored forms the
 * product locked; the rest are entry points to their detail pages. Seed-populated
 * so the structure is visible on the preview. The email-change/auth state machine
 * and full My Stable editing land in the follow-up passes.
 */

type Section = 'profile' | 'stable' | 'saved' | 'documents' | 'gifts' | null;

function Row({
  icon: Icon, title, sub, onClick, open,
}: {
  icon: typeof UserRound; title: string; sub?: string; onClick?: () => void; open?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full flex items-center justify-between px-4 py-4 bg-white border border-green-800/10 rounded-xl hover:border-green-800/20 focus-ring text-left"
    >
      <span className="flex items-center gap-3.5 min-w-0">
        <span className="w-9 h-9 rounded-lg bg-cream-100 grid place-items-center text-green-700 shrink-0"><Icon size={18} /></span>
        <span className="min-w-0">
          <span className="block text-[13.5px] font-medium text-green-900">{title}</span>
          {sub && <span className="block text-[11.5px] text-muted mt-0.5">{sub}</span>}
        </span>
      </span>
      <ChevronRight size={18} className={`text-muted shrink-0 transition-transform ${open ? 'rotate-90' : ''}`} />
    </button>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-[10px] tracking-widest uppercase text-muted font-semibold mt-5 mb-2.5 first:mt-0">{children}</p>;
}

// ── Contact + preferences (inline form; live-wired to profiles contact prefs) ──
function ContactCheckbox({ label, on, onToggle }: { label: string; on: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-[11.5px] font-medium ${
        on ? 'bg-green-50 border-green-300 text-green-800' : 'border-green-800/15 text-secondary'
      }`}
    >
      <span className={`w-3.5 h-3.5 rounded grid place-items-center border ${on ? 'bg-green-700 border-green-700 text-white' : 'border-green-800/30'}`}>
        {on && <Check size={10} />}
      </span>
      {label}
    </button>
  );
}

function ContactField({
  icon: Icon, label, placeholder, hideable = true,
  value, onValue, readOnly,
  hidden, onHidden,
  checks,
}: {
  icon: typeof Mail; label: string; placeholder: string; hideable?: boolean;
  value: string; onValue?: (v: string) => void; readOnly?: boolean;
  hidden: boolean; onHidden: (v: boolean) => void;
  checks?: { label: string; on: boolean; onToggle: () => void }[];
}) {
  return (
    <div className="bg-white border border-green-800/10 rounded-xl p-3.5">
      <div className="flex items-center gap-2 mb-2">
        <Icon size={15} className="text-green-700" />
        <span className="text-[12px] font-medium text-green-900">{label}</span>
        {hideable && (
          <label className="ml-auto inline-flex items-center gap-1.5 text-[10.5px] text-muted">
            <input type="checkbox" className="accent-green-700" checked={hidden}
              onChange={(e) => onHidden(e.target.checked)} /> Hide from community
          </label>
        )}
      </div>
      <input
        className="w-full px-3 py-2 rounded-lg border border-green-800/15 text-sm text-green-900 placeholder:text-muted focus-ring"
        placeholder={placeholder}
        value={value}
        readOnly={readOnly}
        onChange={onValue ? (e) => onValue(e.target.value) : undefined}
      />
      {checks && (
        <div className="flex gap-2 mt-2.5">
          {checks.map((c) => <ContactCheckbox key={c.label} label={c.label} on={c.on} onToggle={c.onToggle} />)}
        </div>
      )}
    </div>
  );
}

function SocialField({
  icon: Icon, label, placeholder, value, onValue,
}: {
  icon: typeof Instagram; label: string; placeholder: string;
  value: string; onValue: (v: string) => void;
}) {
  return (
    <div className="flex items-center gap-2.5 bg-white border border-green-800/10 rounded-xl px-3.5 py-2.5">
      <Icon size={16} className="text-green-700 shrink-0" />
      <span className="text-[12px] font-medium text-green-900 w-20 shrink-0">{label}</span>
      <input className="flex-1 min-w-0 px-2.5 py-1.5 rounded-lg border border-green-800/15 text-sm text-green-900 placeholder:text-muted focus-ring"
        placeholder={placeholder} value={value} onChange={(e) => onValue(e.target.value)} />
    </div>
  );
}

function ProfileSection() {
  const { user } = useAuth();
  const [emailOpen, setEmailOpen] = useState(false);
  const [prefs, setPrefs] = useState<MyContactPrefs | null>(null);

  useEffect(() => {
    getMyContactPrefs().then(setPrefs).catch(() => { /* section renders empty */ });
  }, []);

  // Update local state immediately; persist the single changed field (best-effort).
  function set<K extends keyof MyContactPrefs>(key: K, value: MyContactPrefs[K]) {
    setPrefs((p) => (p ? { ...p, [key]: value } : p));
    if (key !== 'email') saveMyContactPrefs({ [key]: value }).catch(() => { /* keep UI state */ });
  }

  const p = prefs;
  return (
    <div className="mt-2.5 mb-1 p-4 bg-cream-100/60 border border-green-800/10 rounded-xl">
      <SectionLabel>Contact information</SectionLabel>
      <p className="text-[11.5px] text-muted -mt-1.5 mb-2.5">Always visible to French Heritage. Choose what the community sees.</p>
      <div className="flex flex-col gap-2.5">
        <ContactField icon={Mail} label="Email" placeholder="claire@example.com" hideable readOnly
          value={p?.email ?? user?.email ?? ''}
          hidden={p?.hide_email ?? false} onHidden={(v) => set('hide_email', v)} />
        <ContactField icon={Smartphone} label="Mobile" placeholder="(760) 555-0148"
          value={p?.mobile ?? ''} onValue={(v) => set('mobile', v || null)}
          hidden={p?.hide_mobile ?? false} onHidden={(v) => set('hide_mobile', v)}
          checks={[
            { label: 'Text', on: p?.allow_sms ?? true, onToggle: () => set('allow_sms', !(p?.allow_sms ?? true)) },
            { label: 'Call', on: p?.allow_call ?? true, onToggle: () => set('allow_call', !(p?.allow_call ?? true)) },
          ]} />
        <ContactField icon={MessageSquare} label="WhatsApp" placeholder="(760) 555-0148"
          value={p?.whatsapp ?? ''} onValue={(v) => set('whatsapp', v || null)}
          hidden={p?.hide_whatsapp ?? false} onHidden={(v) => set('hide_whatsapp', v)}
          checks={[
            { label: 'Text', on: p?.allow_whatsapp ?? true, onToggle: () => set('allow_whatsapp', !(p?.allow_whatsapp ?? true)) },
          ]} />
      </div>

      <SectionLabel>Social accounts</SectionLabel>
      <div className="flex flex-col gap-2">
        <SocialField icon={Music2} label="TikTok" placeholder="@handle"
          value={p?.social_tiktok ?? ''} onValue={(v) => set('social_tiktok', v || null)} />
        <SocialField icon={Instagram} label="Instagram" placeholder="@handle"
          value={p?.social_instagram ?? ''} onValue={(v) => set('social_instagram', v || null)} />
        <SocialField icon={Facebook} label="Facebook" placeholder="profile URL"
          value={p?.social_facebook ?? ''} onValue={(v) => set('social_facebook', v || null)} />
        <SocialField icon={Linkedin} label="LinkedIn" placeholder="profile URL"
          value={p?.social_linkedin ?? ''} onValue={(v) => set('social_linkedin', v || null)} />
      </div>

      <SectionLabel>Notifications</SectionLabel>
      <div className="flex flex-col gap-2">
        <label className="flex items-center justify-between bg-white border border-green-800/10 rounded-xl px-3.5 py-2.5">
          <span className="text-[12.5px] text-green-900">Payment reminder 3 days before</span>
          <input type="checkbox" checked={p?.payment_reminders ?? true}
            onChange={(e) => set('payment_reminders', e.target.checked)}
            className="accent-green-700 w-4 h-4" />
        </label>
        {['Replies to my discussions', 'Event reminders', 'New member welcomes'].map((n) => (
          <label key={n} className="flex items-center justify-between bg-white border border-green-800/10 rounded-xl px-3.5 py-2.5">
            <span className="text-[12.5px] text-green-900">{n}</span>
            <input type="checkbox" defaultChecked className="accent-green-700 w-4 h-4" />
          </label>
        ))}
      </div>

      <SectionLabel>Login &amp; security</SectionLabel>
      <div className="flex flex-col gap-2">
        <Row icon={UserRound} title="Change email address" sub="Verified before it takes effect" onClick={() => setEmailOpen(true)} />
        <Row icon={BadgeCheck} title="Password" sub="Set or change your password" />
        <Row icon={UserRound} title="Name, photo & bio" sub="Edit your public identity" onClick={() => { window.location.assign('/app/profile'); }} />
      </div>

      {emailOpen && (
        <EmailChangeModal
          currentEmail={p?.email ?? user?.email ?? ''}
          onClose={() => setEmailOpen(false)}
          seams={{ startGoogleChange, startPasswordChange }}
        />
      )}
    </div>
  );
}

// ── My Stable (inline, live) ───────────────────────────────────
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
    ? horses.map((h) => ({ id: h.id, name: h.name, barnName: h.barn_name ?? undefined,
        breed: h.breed ?? '', sex: h.sex ?? '', height: h.height_hh ?? '', age: h.age_or_foaling ?? '',
        color: h.color ?? '', discipline: h.discipline ?? '', ownership: h.ownership === 'leased' ? 'Leased' : 'Owned',
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
          <div key={h.id} className="bg-white border border-green-800/10 rounded-xl p-4">
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
          </div>
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

      {modal === 'horse' && <AddHorseModal onClose={() => setModal(null)} onDone={loadHorses} />}
      {modal === 'gear' && <AddItemModal kind="gear" onClose={() => setModal(null)} onDone={loadGear} />}
      {modal === 'supply' && <AddItemModal kind="supply" onClose={() => setModal(null)} onDone={loadSupplies} />}
    </div>
  );
}

export default function AccountHub() {
  const { profile, membership } = useAuth();
  const navigate = useNavigate();
  const realName = profile?.display_name
    || [profile?.first_name, profile?.last_name].filter(Boolean).join(' ')
    || 'Your profile';
  const membershipSub = membership?.status === 'active'
    ? `${membership.tier ?? 'Member'} · active`
    : 'Not active yet';
  const [nextPaymentSub, setNextPaymentSub] = useState('Payments & recurring billing');
  useEffect(() => {
    listBillingSchedules()
      .then((rows) => {
        const active = rows.filter((r) => r.active);
        if (active.length === 0) return;
        const soonest = active
          .map((r) => nextDue(r.start_date, r.cadence))
          .sort((a, b) => a.getTime() - b.getTime())[0];
        setNextPaymentSub(`Next payment ${soonest.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`);
      })
      .catch(() => {});
  }, []);

  useDocumentTitle('Account');
  const [open, setOpen] = useState<Section>(null);
  const toggle = (s: Section) => setOpen((cur) => (cur === s ? null : s));

  return (
    <div className="max-w-2xl mx-auto">
      <header className="mb-4">
        <p className="eyebrow">Your account</p>
        <h1 className="font-serif text-green-800 text-3xl font-semibold mt-0.5">Account</h1>
      </header>

      <SectionLabel>You</SectionLabel>
      <div className="flex flex-col gap-2.5">
        <Row icon={UserRound} title="Profile &amp; preferences" sub={`${realName} · contact, socials, notifications`} onClick={() => toggle('profile')} open={open === 'profile'} />
        {open === 'profile' && <ProfileSection />}
        <Row icon={Grid3x3} title="My posts" sub="Your posts & listings" />
        <Row icon={Boxes} title="My lessons" sub="Credits, schedule & your progress" onClick={() => navigate('/app/lessons')} />
        <Row icon={Bookmark} title="Saved items" sub="Articles, listings, and links you kept" onClick={() => toggle('saved')} open={open === 'saved'} />
        {open === 'saved' && <SavedPanel />}
        <Row icon={FileText} title="Documents" sub="Signed agreements & releases" onClick={() => toggle('documents')} open={open === 'documents'} />
        {open === 'documents' && <DocumentsPanel />}
        <Row icon={Boxes} title="My Stable" sub="Your horses, gear, and supplies" onClick={() => toggle('stable')} open={open === 'stable'} />
        {open === 'stable' && <StableSection />}
      </div>

      <SectionLabel>Billing &amp; orders</SectionLabel>
      <div className="flex flex-col gap-2.5">
        <Row icon={CreditCard} title="Billing" sub={nextPaymentSub} onClick={() => navigate('/app/balance')} />
        <Row icon={BadgeCheck} title="Membership" sub={membershipSub} />
        <Row icon={ShoppingBag} title="Orders & payment method" sub="Past orders · Zelle" onClick={() => navigate('/app/orders')} />
        <Row icon={Gift} title="Gifts" sub="Things you've gifted · resend, transfer" onClick={() => toggle('gifts')} open={open === 'gifts'} />
        {open === 'gifts' && <GiftsPanel />}
      </div>

      <SectionLabel>Help</SectionLabel>
      <div className="flex flex-col gap-2.5">
        <Row icon={LifeBuoy} title="Support" sub="Get help with anything" onClick={() => navigate('/app/support')} />
      </div>
    </div>
  );
}
