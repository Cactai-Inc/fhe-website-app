import { useMemo } from 'react';
import {
  LayoutDashboard, CalendarDays, ShoppingBag, FileText, ReceiptText,
  MessageSquare, GraduationCap, UserRound, Users, Gift, Boxes,
} from 'lucide-react';
import { Modal } from '../ops/kit/Modal';
import type { StandingCategory } from '../../lib/api';

/**
 * APP OVERVIEW — the tour of the member surface. Shown once on the first login
 * after activation (at the end of onboarding), and reachable afterwards so a
 * member can re-read it any time.
 *
 * Post-D8 content: community access follows the ACCOUNT, so every account
 * holder sees every card here. The one real gate left is ownership — My Stable
 * is for people who actually have a horse on their record. Documents mentions
 * re-signing, because an updated version of an agreement can appear for
 * signature later and members should not be surprised by it.
 */

interface Section {
  icon: typeof LayoutDashboard;
  label: string;
  desc: string;
  /** Shown only to Horse Owners — a real ownership gate, not an access tier. */
  ownerOnly?: boolean;
}

const SECTIONS: Section[] = [
  { icon: LayoutDashboard, label: 'Dashboard', desc: 'Where you land: what needs your attention, and what’s coming up next.' },
  { icon: Users, label: 'Community', desc: 'The member feed — announcements, events, and posts from the barn and other members. Post your own, or list something for sale.' },
  { icon: CalendarDays, label: 'Calendar', desc: 'Your lessons and sessions, plus payments due and anything awaiting confirmation. Book open times straight from the grid.' },
  { icon: MessageSquare, label: 'Messages', desc: 'Direct messages with the barn and with other members.' },
  { icon: FileText, label: 'Documents', desc: 'Every agreement you’ve signed, always available to download. If we update one, the new version appears here for your signature — we’ll walk you to it when you next sign in.' },
  { icon: GraduationCap, label: 'My Lessons', desc: 'Your lesson credits, upcoming sessions, and the history of what you’ve ridden.' },
  { icon: Boxes, label: 'My Stable', desc: 'Your horse’s record — details, health and care history, and the paperwork tied to them.', ownerOnly: true },
  { icon: ShoppingBag, label: 'Catalog', desc: 'Everything we offer. Browse, book, and pay in one place.' },
  { icon: ReceiptText, label: 'Orders', desc: 'What you’ve purchased, what each one covers, and how it was paid — including changing the payment method on anything still open.' },
  { icon: Gift, label: 'Gifts', desc: 'Gift certificates you’ve been given or bought for someone else. Redeem yours here; resend, reschedule, or transfer one you gave.' },
  { icon: UserRound, label: 'Account & settings', desc: 'Your contact details, emergency contacts, notification preferences, and how you sign in.' },
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
        Here’s where everything lives. You can reopen this tour any time from the
        menu under your avatar.
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
