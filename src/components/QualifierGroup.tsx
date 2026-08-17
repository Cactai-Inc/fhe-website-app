import { useCart } from '../contexts/CartContext';

export interface QualifierOption {
  value: string;
  label: string;
}

interface QualifierGroupProps {
  /** Qualifier key stored in cart state (e.g. "experience"). */
  qualifierKey: string;
  question: string;
  help?: string;
  options: QualifierOption[];
  /** Grid column behaviour. "wide" = 1/2 cols, "compact" = 3/4 cols for short labels. */
  layout?: 'wide' | 'compact';
  /**
   * ASKRIGHT §A3c — this answer was concluded from an earlier one, and the
   * string names which. A derived answer is SHOWN answered, never hidden:
   * "deciding for someone invisibly is not premium — it is a wrong answer they
   * never got to catch." Selecting anything clears the marker and the answer
   * becomes theirs.
   */
  derivedFrom?: string;
}

/**
 * A single-select qualifier question rendered as an accessible radiogroup.
 * Replaces the ad-hoc button groups in the funnels with proper
 * role="radiogroup"/role="radio"/aria-checked semantics and the question as the
 * group's accessible name.
 */
export default function QualifierGroup({
  qualifierKey,
  question,
  help,
  options,
  layout = 'wide',
  derivedFrom,
}: QualifierGroupProps) {
  const { state, setQualifier } = useCart();
  const current = state.qualifierAnswers[qualifierKey];
  const labelId = `q-${qualifierKey}`;

  const gridClass =
    layout === 'compact'
      ? 'grid grid-cols-3 sm:grid-cols-4 gap-3'
      : 'grid grid-cols-1 sm:grid-cols-2 gap-3';
  const optionClass = layout === 'compact' ? 'py-3 px-4 text-center' : 'py-4 px-5 text-left';

  return (
    <div className="bg-white border border-green-800/10 p-8 mb-6">
      <h3 id={labelId} className="font-serif font-medium text-green-800 text-lg mb-2">
        {question}
      </h3>
      {help && <p className="text-sm font-sans text-muted mb-5">{help}</p>}
      {derivedFrom && (
        <p className="text-xs font-sans text-gold-ink mb-4 italic">
          We filled this in from your answer to “{derivedFrom}” — change it if we got it wrong.
        </p>
      )}
      <div role="radiogroup" aria-labelledby={labelId} className={gridClass}>
        {options.map((opt) => {
          const selected = current === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => setQualifier(qualifierKey, opt.value)}
              className={`${optionClass} border text-sm font-sans transition-all duration-200 focus-ring ${
                selected
                  ? 'border-green-800 bg-green-800/5 text-green-900 font-medium'
                  : 'border-green-800/15 bg-white text-secondary hover:border-green-800/40'
              }`}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
