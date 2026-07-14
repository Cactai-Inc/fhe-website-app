import { useEffect, useState } from 'react';
import { SlidersHorizontal } from 'lucide-react';
import { useToast } from '../../../lib/ops';
import { toErrorMessage } from '../../../lib/ops/errors';
import {
  INTAKE_FIELDS,
  getIntakeRequirements,
  setIntakeRequirement,
} from '../../../lib/ops/api-intake';

/**
 * Owner control for the unified public form: which OPTIONAL fields a BOOKING
 * submission requires. First name, last name, and email are always required and
 * not shown here. Toggling a field writes intake_requirements(channel='booking')
 * — the public checkout/booking form reads the same config and enforces it. Only
 * the booking channel is configurable; contact/inquiry stay at the base three.
 */
export function BookingFieldsSettings() {
  const [open, setOpen] = useState(false);
  const [req, setReq] = useState<Record<string, boolean>>({});
  const [loaded, setLoaded] = useState(false);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const toast = useToast();

  useEffect(() => {
    if (!open || loaded) return;
    getIntakeRequirements('booking')
      .then((r) => {
        setReq(r);
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, [open, loaded]);

  async function toggle(key: string, next: boolean) {
    setSavingKey(key);
    // optimistic
    setReq((prev) => ({ ...prev, [key]: next }));
    try {
      await setIntakeRequirement('booking', key, next);
    } catch (e) {
      setReq((prev) => ({ ...prev, [key]: !next }));
      toast.error(toErrorMessage(e, 'Could not save that setting.'));
    } finally {
      setSavingKey(null);
    }
  }

  return (
    <div className="mb-5 border border-green-800/10 rounded-lg bg-white">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between gap-2 px-4 py-3 text-sm font-sans text-green-800"
        aria-expanded={open}
      >
        <span className="inline-flex items-center gap-2">
          <SlidersHorizontal size={16} aria-hidden="true" />
          Booking form — required fields
        </span>
        <span className="text-green-800/60">{open ? 'Hide' : 'Configure'}</span>
      </button>
      {open && (
        <div className="px-4 pb-4">
          <p className="text-xs text-green-800/70 mb-3">
            First name, last name, and email are always required. Choose what else
            a <span className="font-medium">booking request</span> must include.
          </p>
          <ul className="flex flex-col gap-2">
            {INTAKE_FIELDS.map((f) => (
              <li key={f.key} className="flex items-center justify-between gap-3">
                <span className="text-sm text-green-900">{f.label}</span>
                <label className="inline-flex items-center gap-2 text-xs text-green-800/70">
                  <input
                    type="checkbox"
                    checked={req[f.key] === true}
                    disabled={!loaded || savingKey === f.key}
                    onChange={(e) => void toggle(f.key, e.target.checked)}
                  />
                  Required
                </label>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export default BookingFieldsSettings;
