import { useEffect, useState } from 'react';
import { Plus, Check } from 'lucide-react';
import { listStableHorses, type StableHorse } from '../../lib/stable';
import { HorseIntakeForm } from './HorseIntakeForm';

/*
 * Horse-care purchase step — pick the horse(s) this service is for. Horses with
 * no Care Release on file will have one generated + queued to sign when the order
 * proceeds (the parent calls ensure_horse_documents per selected horse). If the
 * client has no horses, they add one inline (which also generates its documents),
 * and it becomes selectable without leaving checkout.
 */
export function HorseCareSelect({
  selected, onChange,
}: {
  selected: string[];
  onChange: (ids: string[]) => void;
}) {
  const [horses, setHorses] = useState<StableHorse[] | null>(null);
  const [adding, setAdding] = useState(false);

  const load = () => listStableHorses().then(setHorses).catch(() => setHorses([]));
  useEffect(() => { void load(); }, []);

  const toggle = (id: string) =>
    onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);

  return (
    <div className="bg-white border border-green-800/10 p-6 mb-6">
      <h3 className="font-serif font-medium text-green-800 text-lg mb-1">Which horse is this for?</h3>
      <p className="body-text text-sm mb-4">
        Select the horse(s) this service is for. If a horse doesn’t have a Horse-Care Liability
        Release on file yet, we’ll prepare one for you to sign — your service begins once it’s signed.
      </p>

      {horses === null ? (
        <p className="text-sm text-muted">Loading your horses…</p>
      ) : (
        <div className="flex flex-col gap-2">
          {horses.map((h) => {
            const on = selected.includes(h.id);
            return (
              <button key={h.id} type="button" onClick={() => toggle(h.id)}
                className={`flex items-center justify-between gap-3 rounded-lg border px-4 py-2.5 text-left focus-ring transition-colors ${
                  on ? 'border-green-700 bg-green-50' : 'border-green-800/15 bg-white hover:border-green-800/30'
                }`}>
                <span className="text-sm text-green-900">{h.name}{h.barn_name && h.barn_name !== h.name ? ` · ${h.barn_name}` : ''}</span>
                <span className={`w-5 h-5 rounded grid place-items-center ${on ? 'bg-green-700 text-white' : 'border border-green-800/20'}`}>
                  {on && <Check size={13} />}
                </span>
              </button>
            );
          })}

          {adding ? (
            <div className="border border-green-800/15 rounded-lg p-4 mt-1">
              <HorseIntakeForm submitLabel="Save my horse" onDone={(id) => {
                setAdding(false);
                void load().then(() => onChange([...selected, id]));
              }} />
            </div>
          ) : (
            <button type="button" onClick={() => setAdding(true)}
              className="inline-flex items-center gap-1.5 text-sm text-green-800 hover:text-green-700 mt-1 self-start">
              <Plus size={15} /> Add a horse
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default HorseCareSelect;
