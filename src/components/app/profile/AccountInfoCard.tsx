import { useEffect, useState } from 'react';
import { Lock, MapPin, ShieldAlert } from 'lucide-react';
import {
  getMyAccountInfo, saveMyAccountInfo, type MyAccountInfo,
  STAFF_PREFERRED_CONTACT_LABELS, type StaffPreferredContact,
} from '../../../lib/contact';
import { toErrorMessage } from '../../../lib/ops/errors';
import { SectionCard } from './SectionCard';

type FieldKey = keyof Omit<MyAccountInfo, 'emergency_contact_1' | 'emergency_contact_2'>;

function Field({
  label, value, onCommit, type = 'text', hint,
}: {
  label: string; value: string; onCommit: (v: string) => void;
  type?: string; hint?: string;
}) {
  const [local, setLocal] = useState(value);
  useEffect(() => setLocal(value), [value]);
  return (
    <div>
      <label className="form-label">{label}</label>
      <input
        type={type}
        className="form-input"
        value={local}
        onChange={(e) => setLocal(e.target.value)}
        onBlur={() => { if (local !== value) onCommit(local); }}
      />
      {hint && <p className="form-hint mt-1">{hint}</p>}
    </div>
  );
}

const cell = 'w-full px-3 py-2 rounded-lg border border-green-800/15 text-sm text-green-900 placeholder:text-muted focus-ring';

/**
 * SECTION 3 — ACCOUNT INFORMATION (internal-only). Owner spec 2026-08-05
 * (TASK-PROFILE). Every field here lives on `contacts` and is excluded from
 * `member_directory` and from any other member's read by construction —
 * `contacts_select` RLS is own-row-or-staff only (proven live in
 * TASK-PROFILE-REPORT.md with a simulated other-member session).
 *
 * Emergency contact is READ-ONLY: it displays what the signed onboarding
 * release captured (contacts.emergency_contact_1/2_* — also the source the
 * CLIENT.EMERGENCY_CONTACT_* document merge tokens read from), never a second
 * editable copy.
 */
export function AccountInfoCard() {
  const [info, setInfo] = useState<MyAccountInfo | null>(null);
  const [usesDifferentTextsNumber, setUsesDifferentTextsNumber] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    getMyAccountInfo().then((d) => {
      setInfo(d);
      setUsesDifferentTextsNumber(!!d?.texts_phone);
    }).catch(() => setInfo(null));
  }, []);

  async function commit<K extends FieldKey>(key: K, value: MyAccountInfo[K]) {
    setInfo((prev) => (prev ? { ...prev, [key]: value } : prev));
    setErr(null);
    try {
      await saveMyAccountInfo({ [key]: value });
    } catch (e) {
      setErr(toErrorMessage(e, 'Could not save that change.'));
    }
  }

  if (!info) {
    return (
      <SectionCard icon={Lock} title="Account information" badge="Staff only">
        <p className="text-sm text-muted">Loading…</p>
      </SectionCard>
    );
  }

  const staffOptions = (Object.keys(STAFF_PREFERRED_CONTACT_LABELS) as StaffPreferredContact[])
    .filter((v) => v === 'none'
      || (v === 'phone_call' && !!info.phone)
      || (v === 'text' && !!(info.mobile_number || info.texts_phone))
      || (v === 'email' && !!info.correspondence_email));

  const ec1 = info.emergency_contact_1;
  const ec2 = info.emergency_contact_2;
  const hasEc1 = !!(ec1.name || ec1.phone || ec1.relationship);
  const hasEc2 = !!(ec2.name || ec2.phone || ec2.relationship);

  return (
    <SectionCard icon={Lock} title="Account information" badge="Visible only to French Heritage staff">
      <div className="flex flex-col gap-5">
        {err && (
          <p role="alert" className="form-error flex items-center gap-1.5 bg-red-50 border border-red-200 rounded-lg px-3.5 py-2.5">
            <ShieldAlert size={14} className="shrink-0" /> {err}
          </p>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="First name" value={info.first_name ?? ''} onCommit={(v) => commit('first_name', v || null)} />
          <Field label="Last name" value={info.last_name ?? ''} onCommit={(v) => commit('last_name', v || null)} />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Contact phone (for calls)" type="tel" value={info.phone ?? ''} onCommit={(v) => commit('phone', v || null)} />
          <Field label="Mobile number" type="tel" value={info.mobile_number ?? ''} onCommit={(v) => commit('mobile_number', v || null)} />
        </div>

        <div>
          <label className="inline-flex items-center gap-2 text-[12.5px] text-green-900">
            <input
              type="checkbox" className="accent-green-700"
              checked={usesDifferentTextsNumber}
              onChange={(e) => {
                setUsesDifferentTextsNumber(e.target.checked);
                if (!e.target.checked) void commit('texts_phone', null);
              }}
            />
            I use a different number for texts
          </label>
          {usesDifferentTextsNumber && (
            <div className="mt-2">
              <Field label="Texts number" type="tel" value={info.texts_phone ?? ''} onCommit={(v) => commit('texts_phone', v || null)} />
            </div>
          )}
        </div>

        <Field
          label="Correspondence email" type="email"
          value={info.correspondence_email ?? ''}
          onCommit={(v) => commit('correspondence_email', v || null)}
          hint="Used for company correspondence — except access emails (password reset, login-email-change notices, legal documents), which always go to your login email."
        />

        <div>
          <p className="text-[12px] font-medium text-green-900 flex items-center gap-1.5 mb-2"><MapPin size={14} className="text-green-700" /> Mailing address</p>
          <div className="flex flex-col gap-2">
            <input className={cell} placeholder="Street address" value={info.address_line1 ?? ''}
              onChange={(e) => setInfo({ ...info, address_line1: e.target.value })}
              onBlur={(e) => commit('address_line1', e.target.value || null)} />
            <input className={cell} placeholder="Apartment, suite (optional)" value={info.address_line2 ?? ''}
              onChange={(e) => setInfo({ ...info, address_line2: e.target.value })}
              onBlur={(e) => commit('address_line2', e.target.value || null)} />
            <div className="grid grid-cols-2 sm:grid-cols-[2fr_1fr_1fr] gap-2">
              <input className={cell} placeholder="City" value={info.city ?? ''}
                onChange={(e) => setInfo({ ...info, city: e.target.value })}
                onBlur={(e) => commit('city', e.target.value || null)} />
              <input className={cell} placeholder="State" value={info.state ?? ''}
                onChange={(e) => setInfo({ ...info, state: e.target.value })}
                onBlur={(e) => commit('state', e.target.value || null)} />
              <input className={cell} placeholder="ZIP" value={info.postal_code ?? ''}
                onChange={(e) => setInfo({ ...info, postal_code: e.target.value })}
                onBlur={(e) => commit('postal_code', e.target.value || null)} />
            </div>
          </div>
        </div>

        <div>
          <p className="text-[12px] font-medium text-green-900 mb-2">Zelle ID</p>
          <p className="text-[11.5px] text-muted -mt-1 mb-2">Used to match your Zelle payments to your orders.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Zelle phone" type="tel" value={info.zelle_phone ?? ''} onCommit={(v) => commit('zelle_phone', v || null)} />
            <Field label="Zelle email" type="email" value={info.zelle_email ?? ''} onCommit={(v) => commit('zelle_email', v || null)} />
          </div>
        </div>

        <Field
          label="Date of birth" type="date" value={info.date_of_birth ?? ''}
          onCommit={(v) => commit('date_of_birth', v || null)}
          hint="Internal only — drives minor-protection rules on this record."
        />

        <div>
          <p className="text-[12px] font-medium text-green-900 mb-2">Emergency contact</p>
          <p className="text-[11.5px] text-muted -mt-1 mb-2">
            From your signed onboarding paperwork — shown here for reference, not editable.
          </p>
          {!hasEc1 && !hasEc2 ? (
            <p className="text-sm text-muted bg-cream-100/60 border border-green-800/10 rounded-xl px-3.5 py-3">None on file.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {hasEc1 && (
                <div className="bg-cream-100/60 border border-green-800/10 rounded-xl px-3.5 py-3 text-[13px] text-green-900">
                  {[ec1.name, ec1.relationship, ec1.phone].filter(Boolean).join(' · ') || 'On file'}
                </div>
              )}
              {hasEc2 && (
                <div className="bg-cream-100/60 border border-green-800/10 rounded-xl px-3.5 py-3 text-[13px] text-green-900">
                  {[ec2.name, ec2.relationship, ec2.phone].filter(Boolean).join(' · ') || 'On file'}
                </div>
              )}
            </div>
          )}
        </div>

        <div>
          <label className="form-label" htmlFor="staff_preferred_contact">Preferred contact method (for our staff)</label>
          <select
            id="staff_preferred_contact" className="form-input w-full text-sm"
            value={info.staff_preferred_contact}
            onChange={(e) => commit('staff_preferred_contact', e.target.value as StaffPreferredContact)}
          >
            {staffOptions.map((v) => <option key={v} value={v}>{STAFF_PREFERRED_CONTACT_LABELS[v]}</option>)}
          </select>
        </div>
      </div>
    </SectionCard>
  );
}
