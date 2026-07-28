import { useMemo } from 'react';
import {
  LayoutDashboard, CalendarDays, ShoppingBag, FileText, ReceiptText,
  MessageSquare, GraduationCap, UserRound, Users, Gift, Boxes,
} from 'lucide-react';
import { Modal } from '../ops/kit/Modal';
import type { StandingCategory } from '../../lib/api';

/**
 * APP OVERVIEW — the welcome tour shown once, right after a client finishes
 * onboarding (documents signed, payment handled). Lists the app's sections with
 * their purpose so the new member knows where everything is. Category-aware:
 * a guest-only client sees the restricted surface (no community); Riders/Horse
 * Owners see the full set. Closing it lands them on their home (dashboard when
 * they have notifications, else the community feed).
 */

interface Section {
  icon: typeof LayoutDashboard;
  label: string;
  desc: string;
  /** Hidden from a guest-only client (no community/service surfaces). */
  membersOnly?: boolean;
  /** Shown only to Horse Owners. */
  ownerOnly?: boolean;
}

const SECTIONS: Section[] = [
  { icon: LayoutDashboard, label: 'Dashboard', desc: 'Your notifications and anything that needs your attention.' },
  { icon: Users, label: 'Community', desc: 'The member feed — announcements, events, and posts from the barn.', membersOnly: true },
  { icon: ShoppingBag, label: 'Catalog', desc: 'Browse our services and book or purchase what you need.' },
  { icon: CalendarDays, label: 'Calendar', desc: 'Your scheduled lessons and sessions; book open times.', membersOnly: true },
  { icon: GraduationCap, label: 'My Lessons', desc: 'Your lesson credits, upcoming sessions, and history.', membersOnly: true },
  { icon: Boxes, label: 'My Stable', desc: 'Your horse’s details, health, and care records.', ownerOnly: true },
  { icon: FileText, label: 'Documents', desc: 'Every agreement you’ve signed — always available to download.' },
  { icon: ReceiptText, label: 'Orders', desc: 'What you’ve purchased and each order’s payment status.' },
  { icon: Gift, label: 'Gifts', desc: 'Purchase and redeem gift certificates.' },
  { icon: MessageSquare, label: 'Messages', desc: 'Direct messages with the barn and other members.', membersOnly: true },
  { icon: UserRound, label: 'Profile & Preferences', desc: 'Your contact details, emergency contacts, and settings.' },
];

export function AppOverviewModal({
  open, onClose, categories,
}: {
  open: boolean;
  onClose: () => void;
  categories: StandingCategory[];
}) {
  const isOwner = categories.includes('HORSE_OWNER');

  // D8: community access follows the ACCOUNT — every member sees the full
  // tour (the ownerOnly gate for My Stable is a separate, real ownership gate).
  const sections = useMemo(
    () => SECTIONS.filter((s) => {
      if (s.ownerOnly && !isOwner) return false;
      return true;
    }),
    [isOwner],
  );

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Welcome — here’s your home base"
      footer={
        <button type="button" onClick={onClose} className="btn-primary">
          Enter the app
        </button>
      }
    >
      <p className="body-text text-sm text-secondary mb-5">
        You’re all set up. Here’s a quick tour of where everything lives — you can
        always come back to any of these from the menu.
      </p>
      <ul className="space-y-3">
        {sections.map((s) => (
          <li key={s.label} className="flex items-start gap-3">
            <span className="shrink-0 mt-0.5 text-green-700"><s.icon size={18} aria-hidden="true" /></span>
            <span>
              <span className="block text-sm font-medium text-green-900">{s.label}</span>
              <span className="block text-sm text-secondary">{s.desc}</span>
            </span>
          </li>
        ))}
      </ul>
    </Modal>
  );
}
