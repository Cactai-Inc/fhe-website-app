import { useEffect } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { useCart } from '../contexts/CartContext';
import QuestionSections from '../components/QuestionSections';
import { cartHasQuestions } from '../lib/questionSets';
import { useDocumentTitle } from '../lib/hooks';

/**
 * PAGE 2, FOR A VISITOR WHO DID NOT COME THROUGH A FUNNEL THAT HAS ONE.
 *
 * Owner, 2026-08-16: "since the lessons page doesnt use a page 2 it goes
 * straight to the form — if there are horse care or acquisition items in the
 * cart and they click the continue button from the lessons page it needs to
 * still show the page 2 for the questions related to the other services before
 * the form is shown."
 *
 * THE QUESTIONS PAGE IS CONDITIONAL ON CONTENT, NOT ON ENTRY POINT. Nothing
 * here knows or cares which page the visitor came from: it renders when the
 * cart holds something that asks, and redirects straight through to the form
 * when it does not. A lessons-only order never sees it because lessons has no
 * question set — not because `/lessons` is special-cased anywhere.
 *
 * It mounts the SAME `QuestionSections` engine the horse and acquisition
 * funnels mount at their own step 2. One engine, three entry points.
 */
export default function Questions() {
  useDocumentTitle('A Few Questions');
  const { state } = useCart();
  const navigate = useNavigate();

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  // Nothing chosen at all — there is nothing to ask about.
  if (state.items.length === 0) return <Navigate to="/lessons" replace />;
  // Nothing in the cart asks anything: this page has no reason to exist for
  // this order, so it never appears between the selection and the form.
  if (!cartHasQuestions(state.items)) return <Navigate to="/checkout" replace />;

  return (
    <div className="min-h-screen bg-cream pt-24 pb-20">
      <div className="container-site max-w-3xl">
        <Link
          to="/lessons"
          className="inline-flex items-center gap-2 text-sm font-sans text-secondary hover:text-green-800 transition-colors mb-6 focus-ring"
        >
          <ArrowLeft size={16} />
          Back to Selection
        </Link>

        <p className="eyebrow mb-3">Tell us more</p>
        <h1 className="heading-section text-green-800 mb-3">A Few Questions</h1>
        <p className="body-text mb-10">
          A little context about what you have chosen, so the right person can pick
          up the conversation already knowing your situation.
        </p>

        <QuestionSections />

        <div className="flex items-center justify-between mt-8 pt-8 border-t border-green-800/10">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="inline-flex items-center gap-2 text-sm font-sans text-secondary hover:text-green-800 transition-colors focus-ring"
          >
            <ArrowLeft size={16} />
            Previous
          </button>
          <button type="button" onClick={() => navigate('/checkout')} className="btn-primary">
            Continue to Submit Inquiry
            <ArrowRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
