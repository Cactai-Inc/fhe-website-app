import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useDocumentTitle } from '../../../lib/hooks';
import { ProvisionClientForm } from '../../../components/app/ProvisionClientForm';
import { AgreedLessonSection, type AgreedLesson } from '../../../components/app/AgreedLessonPanel';

/**
 * NEW CLIENT (/app/ops/accounts/new) — a launch point for the shared
 * ProvisionClientForm (source='new'): configure a fresh account (category,
 * paperwork, offerings, payment) and send the invitation via the canonical spine.
 * Staff account creation lives on Team & access — not here.
 *
 * CLOSEOUT §3.5 (LESSONREQUEST G4): the agreed-time panel now rides along here
 * too, not just on the lead path — a lesson agreed on a phone call that never
 * produced a website inquiry folds into the same one act, so the booking and
 * the invitation cannot half-succeed and the email can name the time.
 */
export default function AccountInvitePage() {
  useDocumentTitle('New client');
  const [agreed, setAgreed] = useState<AgreedLesson | null>(null);
  return (
    <div className="max-w-5xl">
      <Link to="/app/admin"
        className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-green-800 mb-4">
        <ArrowLeft size={14} /> Clients
      </Link>
      <h1 className="font-serif text-2xl text-green-900 mb-1">New client</h1>
      <p className="text-sm text-green-800/70 mb-6">
        Configure the account and send the invitation. We only need their email —
        they'll add their name and details when they activate the account.
      </p>
      <ProvisionClientForm source="new" agreedLesson={agreed}
        scheduling={<AgreedLessonSection onAgreedChange={setAgreed} />} />
    </div>
  );
}
