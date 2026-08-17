/**
 * "IS THIS THE HORSE FROM YOUR INQUIRY?" — CAREPATH §C10b.
 *
 * Owner, 2026-08-16: *"we dont assume the inquiry about horse clipping and the
 * inquiry about evaluation or any of the acquisition services are related to the
 * same horse… we can ask them if it is before asking them to fill it in."*
 *
 * ⚠️ WE ASK. WE NEVER ASSUME. An order can name three different horses, and
 * prefilling a record from the wrong one puts a stranger's breed and age on a
 * legal document.
 *
 *   Yes → prefill the overlapping fields, editable, and say where they came from.
 *   No  → a blank form.
 *
 * ⚠️ ONLY `client_horse` ANSWERS MAY EVER PREFILL. `evaluated_horse` and
 * `sought_horse` describe DIFFERENT ANIMALS — `my_inquiry_answers` returns them
 * under their own subjects and this component reads exactly one.
 *
 * ⚠️ IF THE ORDER CARRIED NO `client_horse` ANSWERS, NOTHING IS ASKED. There is
 * no question to put to someone whose inquiry said nothing about a horse of
 * theirs — including the client who answered "not yet, help me find one", whose
 * answers are filed under `sought_horse` precisely because they describe a horse
 * that does not exist. They go straight to a blank form.
 */
import { useEffect, useState } from 'react';
import { myInquiryAnswers } from '../../lib/api';
import type { HorseIntakePayload } from '../../lib/horses';

/** Inquiry question → the horse-record field it fills. The OVERLAP §C10b names
 *  (age, breed, behaviour, health) and nothing beyond it: a question that has no
 *  faithful home on the record is left for the client to answer here. */
const FIELD_FOR_QUESTION: Record<string, keyof HorseIntakePayload> = {
  'What is the age of the horse?': 'date_of_birth',
  'What breed is the horse?': 'breed',
  'Does the horse have any behaviour issues?': 'behavioral_history',
  'Has the horse had any injuries or current health issues?': 'medical_history',
};

/** What the client said, mapped onto record fields.
 *
 *  ⚠️ AGE IS NOT A DATE OF BIRTH. The inquiry asks "what is the age" and the
 *  record holds a date of birth; deriving one from the other would invent a
 *  birthday we were never told. The age is therefore NOT mapped onto
 *  `date_of_birth` — it is shown to the client in the summary below so they can
 *  fill the real date themselves. Mapping it would have been the kind of quiet
 *  fabrication that ends up merged into a contract. */
export function prefillFromAnswers(
  clientHorse: Record<string, string>,
): { values: Partial<HorseIntakePayload>; shown: [string, string][] } {
  const values: Partial<HorseIntakePayload> = {};
  const shown: [string, string][] = [];
  for (const [question, answer] of Object.entries(clientHorse)) {
    if (!answer || !answer.trim()) continue;
    shown.push([question, answer]);
    const field = FIELD_FOR_QUESTION[question];
    if (!field || field === 'date_of_birth') continue;   // see the note above
    (values as Record<string, string>)[field] = answer;
  }
  return { values, shown };
}

export interface SameHorseAskProps {
  /** Runs once the client has answered. `prefill` is empty on "no". */
  onAnswered: (prefill: Partial<HorseIntakePayload>) => void;
}

export function SameHorseAsk({ onAnswered }: SameHorseAskProps) {
  const [answers, setAnswers] = useState<Record<string, string> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    myInquiryAnswers()
      .then((a) => { if (active) setAnswers(a.client_horse ?? {}); })
      // A failed read must not block the intake — it just means no prefill.
      .catch(() => { if (active) setAnswers({}); })
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, []);

  // Nothing to ask about: no client_horse answers on the inquiry.
  useEffect(() => {
    if (!loading && answers && Object.keys(answers).length === 0) onAnswered({});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, answers]);

  if (loading || !answers || Object.keys(answers).length === 0) return null;

  const { values, shown } = prefillFromAnswers(answers);

  return (
    <div className="mb-6 rounded-lg border border-gold-400/60 bg-gold-50/30 p-5">
      <h3 className="font-serif text-green-800 text-lg mb-1">
        Is this the horse you told us about?
      </h3>
      <p className="text-sm text-muted mb-3">
        When you got in touch you told us this much about a horse. If the horse you are
        adding now is that one, we will fill in what we can — you can change anything.
      </p>
      <dl className="grid grid-cols-1 sm:grid-cols-[minmax(0,16rem)_1fr] gap-x-4 gap-y-1 mb-4">
        {shown.map(([q, a]) => (
          <div key={q} className="contents">
            <dt className="text-xs text-green-800/70 sm:pt-0.5">{q}</dt>
            <dd className="text-sm text-green-900">{a}</dd>
          </div>
        ))}
      </dl>
      <div className="flex flex-wrap gap-3">
        <button type="button" className="btn-primary text-sm" onClick={() => onAnswered(values)}>
          Yes — this is that horse
        </button>
        <button type="button" className="btn-outline-gold text-sm" onClick={() => onAnswered({})}>
          No — this is a different horse
        </button>
      </div>
    </div>
  );
}

export default SameHorseAsk;
