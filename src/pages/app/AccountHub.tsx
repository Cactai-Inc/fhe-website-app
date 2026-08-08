import { useState } from 'react';
import {
  UserRound, Bell, ShieldCheck, Grid3x3, GraduationCap, Bookmark, FileText, Boxes,
  ShoppingBag, Gift, ChevronRight,
} from 'lucide-react';
import { useDocumentTitle } from '../../lib/hooks';
import { SavedPanel } from '../../components/app/AccountPanels';
import { StableSection } from '../../components/app/StableSection';
import { MyPostsContent } from '../../components/app/MyPostsContent';
import { MyLessonsContent } from '../../components/app/MyLessonsContent';
import { OrdersContent } from '../../components/app/OrdersContent';
import { GiftsContent } from '../../components/app/GiftsContent';
import { DocumentsContent } from '../../components/app/DocumentsContent';
import {
  MyProfileContent, MyPreferencesContent, MyLoginContent,
} from '../../components/app/profile/ProfileAndPreferences';
import { useAuth } from '../../contexts/AuthContext';
import { Navigate, useSearchParams } from 'react-router-dom';

/**
 * ACCOUNT HUB (/app/account) — the "me" surface for every user type, reached from
 * the avatar menu. TASK-ACCOUNTSURFACE (2026-08-07): every row now expands in
 * place — the nav-vs-account rule is "anything reached from the NAV opens its
 * own page; anything on the ACCOUNT page expands in place," so this page never
 * navigates anywhere itself. Ten sections, each "My"-prefixed except Account
 * itself (§4); Profile & preferences split into My Profile / My Preferences /
 * My Login, so the page gained two sections. Row order is TODAY'S RELATIVE
 * ORDER, preserved per the task's instruction not to invent one — the two new
 * profile-derived rows are placed where the single old row used to be, since
 * there is no "before" position to preserve for content that didn't exist as
 * its own row before. The owner still needs to rank all ten (see the Phase 2
 * report).
 */

type Section =
  | 'profile' | 'preferences' | 'login'
  | 'posts' | 'lessons' | 'saved' | 'documents' | 'stable' | 'orders' | 'gifts'
  | null;

const SECTION_VALUES: readonly string[] = [
  'profile', 'preferences', 'login', 'posts', 'lessons', 'saved', 'documents', 'stable', 'orders', 'gifts',
];

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

export default function AccountHub() {
  const { profile, isStaff } = useAuth();
  const realName = profile?.display_name
    || [profile?.first_name, profile?.last_name].filter(Boolean).join(' ')
    || 'Your profile';
  useDocumentTitle('Account');
  const [searchParams] = useSearchParams();
  const sectionParam = searchParams.get('section');
  const [open, setOpen] = useState<Section>(() =>
    (SECTION_VALUES.includes(sectionParam ?? '') ? sectionParam : null) as Section);
  const toggle = (s: Section) => setOpen((cur) => (cur === s ? null : s));

  // D8: every account holder sees the full account surface — "guest" is
  // display copy only, never a gate.

  // §2: My Stable now has a real route. Old /app/account?section=stable links
  // (the only way to reach it before this task) redirect there instead of
  // pre-opening this page's panel, so "My Stable" and "Account" stop being
  // the same destination. The row's own click-to-expand still works below —
  // this only concerns the query-param entry point.
  if (sectionParam === 'stable') {
    return <Navigate to="/app/stable" replace />;
  }

  return (
    <div className="max-w-6xl mx-auto">
      <header className="mb-4">
        <p className="eyebrow">Your account</p>
        <h1 className="font-serif text-green-800 text-3xl font-semibold mt-0.5">Account</h1>
      </header>

      <div className="grid lg:grid-cols-2 gap-3">
        <Row icon={UserRound} title="My Profile" sub={`${realName} · profile, account & security`} onClick={() => toggle('profile')} open={open === 'profile'} />
        {open === 'profile' && <div className="lg:col-span-2"><MyProfileContent /></div>}

        {/* Owner, 2026-08-08: for STAFF the Account page is the COMPANY, not a
            person — Profile (public + internal) and Login apply; everything else
            does not. Company documents, the stable and posts belong in a business
            section instead, and gifts are a company product rather than something
            an admin holds personally.

            REMOVED, NOT DELETED. Every section below still builds and is one
            boolean from returning — this is the seam where a per-tenant module
            flag goes when the platform offers personal-account features to other
            tenants who do want them. */}
        {!isStaff && (
          <>
        <Row icon={Bell} title="My Preferences" sub="How the community can reach you" onClick={() => toggle('preferences')} open={open === 'preferences'} />
        {open === 'preferences' && <div className="lg:col-span-2"><MyPreferencesContent /></div>}

          </>
        )}

        <Row icon={ShieldCheck} title="My Login" sub="Sign-in email, password & Google" onClick={() => toggle('login')} open={open === 'login'} />
        {open === 'login' && <div className="lg:col-span-2"><MyLoginContent /></div>}

        {!isStaff && (
          <>

        <Row icon={Grid3x3} title="My Posts" sub="Your posts & listings" onClick={() => toggle('posts')} open={open === 'posts'} />
        {open === 'posts' && <div className="lg:col-span-2"><MyPostsContent /></div>}

        <Row icon={GraduationCap} title="My Lessons" sub="Credits, schedule & your progress" onClick={() => toggle('lessons')} open={open === 'lessons'} />
        {open === 'lessons' && <div className="lg:col-span-2"><MyLessonsContent /></div>}

        <Row icon={Bookmark} title="My Saved Items" sub="Articles, listings, and links you kept" onClick={() => toggle('saved')} open={open === 'saved'} />
        {open === 'saved' && <div className="lg:col-span-2"><SavedPanel /></div>}

        <Row icon={FileText} title="My Documents" sub="Signed agreements & releases" onClick={() => toggle('documents')} open={open === 'documents'} />
        {open === 'documents' && <div className="lg:col-span-2"><DocumentsContent /></div>}

        <Row icon={Boxes} title="My Stable" sub="Your horses, gear, and supplies" onClick={() => toggle('stable')} open={open === 'stable'} />
        {open === 'stable' && <div className="lg:col-span-2"><StableSection /></div>}

        <Row icon={ShoppingBag} title="My Orders" sub="Your purchases" onClick={() => toggle('orders')} open={open === 'orders'} />
        {open === 'orders' && <div className="lg:col-span-2"><OrdersContent /></div>}

        <Row icon={Gift} title="My Gifts" sub="Gifts you can use" onClick={() => toggle('gifts')} open={open === 'gifts'} />
        {open === 'gifts' && <div className="lg:col-span-2"><GiftsContent /></div>}
          </>
        )}
      </div>
    </div>
  );
}
