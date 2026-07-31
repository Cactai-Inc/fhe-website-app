import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, ArrowRight } from 'lucide-react';
import { myMissingRequiredData, type MissingRequiredData } from '../../lib/api';

/**
 * MISSING REQUIRED DATA — the notice a member cannot dismiss.
 *
 * The rule this implements, working backwards from where the data is needed: a
 * document that cannot be completed without a field is the REASON that field is
 * required. So the notice appears only when an assigned document actually
 * depends on the missing value, and it disappears the moment the value is
 * supplied. Nothing to acknowledge, nothing to snooze — it is not a message
 * about the past, it is a live description of what is blocking the paperwork.
 *
 * TWO SEPARATE CARDS, deliberately. Person details live on the Account page and
 * horse details on that horse's page, so a single combined card could only send
 * you to one of them. Each card links to the exact screen its own fields are
 * edited on, which is what makes "click to fill it in now" honest.
 *
 * Nothing here BLOCKS. The member keeps full use of the app; the notice states
 * what the paperwork is waiting on.
 */
export function MissingDataNotice() {
  const [data, setData] = useState<MissingRequiredData | null>(null);

  useEffect(() => {
    let active = true;
    myMissingRequiredData()
      .then((d) => { if (active) setData(d); })
      // Silent on failure: a notice that cannot prove something is missing must
      // not assert that it is.
      .catch(() => { if (active) setData(null); });
    return () => { active = false; };
  }, []);

  if (!data) return null;
  const hasContact = data.contact.length > 0;
  const hasHorses = data.horses.length > 0;
  if (!hasContact && !hasHorses) return null;

  return (
    <div className="flex flex-col gap-3 mb-5">
      {hasContact && (
        <Card
          title="Your paperwork needs a few more details"
          fields={data.contact.map((f) => f.label)}
          to="/app/account"
          cta="Add my details"
        />
      )}
      {data.horses.map((h) => (
        <Card
          key={h.horse_id}
          title={`${h.name}'s record is missing information`}
          fields={h.missing.map((f) => f.label)}
          to={`/app/horses/${h.horse_id}`}
          cta={`Update ${h.name}`}
        />
      ))}
    </div>
  );
}

function Card({
  title, fields, to, cta,
}: {
  title: string; fields: string[]; to: string; cta: string;
}) {
  return (
    <div className="rounded-xl border border-gold-600/50 bg-gold-50 p-4">
      <div className="flex items-start gap-2.5">
        <AlertCircle size={18} className="text-gold-700 shrink-0 mt-0.5" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-gold-900">{title}</p>
          <p className="text-[13px] text-gold-900/90 mt-1">
            Your assigned documents can&apos;t be completed until these are filled in:
          </p>
          <p className="text-[13px] text-gold-900 mt-1.5">
            {/* The field NAMES, not a count — "3 fields missing" makes you go
                hunting; naming them lets you judge whether you can finish now. */}
            {fields.join(' · ')}
          </p>
          <Link to={to}
            className="inline-flex items-center gap-1.5 mt-3 px-3.5 py-2 rounded-lg bg-green-800 text-white text-sm font-medium hover:bg-green-700 focus-ring">
            {cta} <ArrowRight size={14} aria-hidden="true" />
          </Link>
        </div>
      </div>
    </div>
  );
}
