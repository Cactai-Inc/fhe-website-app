import { useCart } from '../contexts/CartContext';
import { boundText } from '../lib/questionSets';

interface QualifierTextProps {
  /** Answer key in the SAME store `QualifierGroup` writes to — there is one
   *  answer store, and this is its free-text sibling, not a second one. */
  qualifierKey: string;
  question: string;
  /** Multi-line for the "anything else" boxes, single-line for breed and age. */
  multiline?: boolean;
  placeholder?: string;
  /** Renders as a quiet follow-up rather than its own titled card — the text
   *  box that appears under a Yes. */
  variant?: 'card' | 'inline';
}

/**
 * The free-text answer, sibling to `QualifierGroup`.
 *
 * ASKRIGHT §A5: the owner's new sets need typed answers — "problem areas
 * and/or specific goals", "any notes or special requests", "anything else they
 * want us to know", plus the horse's breed and age. `QualifierGroup` is
 * single-select only, so this is the other half of the pair; between them they
 * express every question the owner wrote.
 *
 * NEVER REQUIRED. These are "anything else" boxes and a required one blocks a
 * sale. Length is trimmed and bounded here, before the answer can travel to
 * `submit_public_request`.
 */
export default function QualifierText({
  qualifierKey,
  question,
  multiline = false,
  placeholder,
  variant = 'card',
}: QualifierTextProps) {
  const { state, setQualifier } = useCart();
  const value = state.qualifierAnswers[qualifierKey] ?? '';
  const fieldId = `q-${qualifierKey}`;
  const derivedFrom = state.answerOrigins[qualifierKey];

  const field = multiline ? (
    <textarea
      id={fieldId}
      rows={4}
      value={value}
      placeholder={placeholder}
      onChange={(e) => setQualifier(qualifierKey, boundText(e.target.value))}
      className="form-input resize-none"
    />
  ) : (
    <input
      id={fieldId}
      type="text"
      value={value}
      placeholder={placeholder}
      onChange={(e) => setQualifier(qualifierKey, boundText(e.target.value))}
      className="form-input"
    />
  );

  if (variant === 'inline') {
    return (
      <div className="mt-4">
        <label className="form-label" htmlFor={fieldId}>{question}</label>
        {field}
      </div>
    );
  }

  return (
    <div className="bg-white border border-green-800/10 p-8 mb-6">
      <label
        htmlFor={fieldId}
        className="block font-serif font-medium text-green-800 text-lg mb-2"
      >
        {question}
      </label>
      {derivedFrom && (
        <p className="text-xs font-sans text-gold-ink mb-4 italic">
          We filled this in from your answer to “{derivedFrom}” — change it if we got it wrong.
        </p>
      )}
      {field}
    </div>
  );
}
