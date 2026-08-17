import { useEffect, useMemo } from 'react';
import { useCart } from '../contexts/CartContext';
import QualifierGroup from './QualifierGroup';
import QualifierText from './QualifierText';
import {
  assembleSections,
  answerKey,
  detailKey,
  derivationsFor,
  visibleOptions,
  type QuestionDef,
} from '../lib/questionSets';

/**
 * PAGE 2 — assembled on the click, from the cart.
 *
 * Owner, 2026-08-16: "page 2 is truly a dynamic page that is made to order so
 * to speak constructed on the click based on the selections made. and the
 * system needs to hold the information so its not asking the same information
 * when they pick a lesson, an evaluation, and a horse training offering in the
 * same order."
 *
 * There is no static step-2 page for any funnel and no per-funnel JSX branch —
 * three hand-written branches is how the defect this replaces was born. This
 * one component renders whatever the cart implies, and is mounted identically
 * by the horse funnel, the acquisition funnel and the standalone questions page
 * a lessons visitor reaches when their cart holds something that asks.
 */
export default function QuestionSections() {
  const { state, setDerivedQualifier, withdrawDerived } = useCart();
  const answers = state.qualifierAnswers;

  const sections = useMemo(() => assembleSections(state.items), [state.items]);

  // §A3c — the implications, re-evaluated whenever an answer changes. A derived
  // answer follows its source until the visitor edits it and never afterwards;
  // both halves of that are enforced in the reducer, not here.
  useEffect(() => {
    for (const d of derivationsFor(sections, answers)) {
      if (d.value === null) withdrawDerived(d.key);
      else setDerivedQualifier(d.key, d.value, d.because);
    }
  }, [sections, answers, setDerivedQualifier, withdrawDerived]);

  if (sections.length === 0) return null;

  return (
    <div className="flex flex-col gap-2">
      {sections.map((section) => {
        const visible = section.questions.filter((q) => !q.showWhen || q.showWhen(answers));
        if (visible.length === 0) return null;
        return (
          <section key={section.key} aria-label={section.title} className="mb-4">
            <h2 className="eyebrow mb-4">{section.title}</h2>
            {visible.map((q) => (
              <Question key={answerKey(q)} q={q} />
            ))}
          </section>
        );
      })}
    </div>
  );
}

/** One question, dispatched to the single-select component or its free-text
 *  sibling. These are the only two answer components; a Yes/No follow-up box is
 *  the same free-text sibling in its inline variant. */
function Question({ q }: { q: QuestionDef }) {
  const { state } = useCart();
  const answers = state.qualifierAnswers;
  const key = answerKey(q);
  const derivedFrom = state.answerOrigins[key];

  if (q.kind === 'choice') {
    const current = answers[key];
    const showsDetail = !!current && (q.detailWhen ?? []).includes(current);
    return (
      <div>
        <QualifierGroup
          qualifierKey={key}
          question={q.question}
          // No help line, no subtitle, no parenthetical: the owner's wording is
          // the whole of the visible text, and "the hint is in the answers".
          options={visibleOptions(q, answers)}
          layout={q.layout}
          derivedFrom={derivedFrom}
        />
        {showsDetail && (
          <div className="-mt-4 mb-6 bg-white border border-t-0 border-green-800/10 px-8 pb-8">
            <QualifierText
              qualifierKey={detailKey(q)}
              question="Tell us more"
              placeholder={q.detailPlaceholder}
              variant="inline"
            />
          </div>
        )}
      </div>
    );
  }

  return (
    <QualifierText
      qualifierKey={key}
      question={q.question}
      multiline={q.kind === 'long_text'}
      placeholder={q.placeholder}
    />
  );
}
