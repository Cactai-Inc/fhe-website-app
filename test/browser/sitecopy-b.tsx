/* HARNESS ENTRY for TASK-SITECOPY-B — the five sentences in which the app
 * describes ITSELF, rendered in a real Chromium.
 *
 * ⚠️ WHY A BROWSER AND NOT A GREP. The claim under test is not "the source no
 * longer contains 'barn'" — that is trivially checkable and proves nothing (D17).
 * The claim is that five sentences COMPOSE correctly out of the tenant's own
 * property-term shape, including when that shape is PLURAL ("the stables ARE"),
 * and composed prose is exactly what reading source gets wrong.
 *
 * THREE REAL SURFACES, mounted as the app mounts them:
 *   ?view=confirmation&state=ok|fail|pending  the real Confirmation page. The
 *       three SendLine states are forced through the REAL receipt in
 *       sessionStorage, which is the only thing that decides them.
 *   ?view=order                                the real OrderDetail at /order/:id,
 *       which renders the real OrderPayment (surface 1 of 2 — surface 2 is the
 *       real Onboarding, walked by probe-sitecopy-b.mjs through SIGNBOOK's own
 *       onboarding-flow harness, unmodified).
 *   ?view=activation&reached=N                 the real ActivationOrderPanel as
 *       Onboarding mounts it. `reached` is returned by report_order_incorrect,
 *       so the sentence is reached by CLICKING the real control, not by prop.
 *
 * ?term=stables installs a PLURAL property term through the real seam
 * (my_property_term → AuthContext → BrandProvider → usePropertyTerm), so the
 * substitution proof runs through the mechanism rather than around it.
 */
import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import '../../src/index.css';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import { AuthProvider } from '../../src/contexts/AuthContext';
import { BrandProvider } from '../../src/contexts/BrandProvider';
import Confirmation from '../../src/pages/Confirmation';
import OrderPayment from '../../src/components/order/OrderPayment';
import OrderDetail from '../../src/pages/OrderDetail';
import { ActivationOrderPanel } from '../../src/components/app/ActivationOrderPanel';
import { getOrder, getOrderPayment } from '../../src/lib/api';
import type { Order, OrderItem, Payment } from '../../src/lib/types';

const params = new URLSearchParams(location.search);
const view = params.get('view') ?? 'confirmation';
const state = params.get('state') ?? 'ok';
const reached = Number(params.get('reached') ?? '3');
const plural = params.get('term') === 'stables';

const ORDER_ID = '00000000-0000-4000-8000-0000000000f1';

/* THE RECEIPT IS THE REAL ONE — same key, same shape, same reader
   (src/lib/inquiryReceipt.ts). `sends.staff` is what picks ok / fail / pending,
   and `null` is a genuine third state, not a missing value. */
sessionStorage.setItem('fhe-inquiry-receipt-v1', JSON.stringify({
  requestId: 'req-harness-1',
  contactMethod: 'text',
  items: [{ name: 'Riding Lessons', price: 150, unit: 'per_session', priceOnEnquiry: false }],
  answers: { 'Who is riding?': 'Me' },
  notes: '', availability: '', subtotal: 150,
  sends: { staff: state === 'ok' ? true : state === 'fail' ? false : null, buyer: null },
}));

window.__tables = {
  /* getOrder + getOrderPayment both read `purchases`; awaiting_payment is what
     opens OrderDetail's payment section. */
  purchases: () => [{
    id: ORDER_ID, display_code: 'PUR-000901', status: 'awaiting_payment',
    amount: 150, unique_amount: 150.07, payment_status: 'unpaid',
    payment_method: null, payment_reference: null, client_reported_method: null,
    created_at: '2026-09-02T10:00:00Z',
  }],
  purchase_items: () => [{
    id: 'item-1', purchase_id: ORDER_ID, label: 'Riding Lessons',
    price_amount: 150, quantity: 1, unit: 'per_session', kind: 'single',
  }],
  bookings: () => [],
  profiles: () => [{
    user_id: '00000000-0000-4000-8000-000000000001', role: 'USER',
    org_id: '00000000-0000-4000-8000-0000000000aa',
    first_name: 'Harness', last_name: 'Rider', contact_id: null, is_suspended: false,
  }],
};

window.__rpcFixtures = {
  /* The count the panel reports is the RPC's own answer, so the probe drives the
     count the same way production does. */
  report_order_incorrect: { recipients: reached },
  my_modules: ['mod.lessons'],
  my_hidden_pages: [],
  my_standing_slots: [],
  ...(plural
    ? {
      /* U16, a PLURAL tenant word: "the stables". This is the whole point of the
         shape — a bare string cannot carry it. */
      my_property_term: { key: 'STABLES', term: 'stables', article: 'the', plural: true, preposition: 'at' },
    }
    : {}),
};

/** The `payment` step's own mount, lifted out so the retired surface renders with
 *  the order it would have had.
 *  (react-refresh wants components in an exported module; a probe harness entry is
 *  a script with a side effect and has no HMR story, so the rule does not apply.) */
// eslint-disable-next-line react-refresh/only-export-components
function RetiredOnboardingPayment() {
  const [order, setOrder] = useState<(Order & { items: OrderItem[] }) | null>(null);
  const [payment, setPayment] = useState<Payment | null>(null);
  useEffect(() => {
    void Promise.all([getOrder(ORDER_ID), getOrderPayment(ORDER_ID)])
      .then(([o, p]) => { setOrder(o); setPayment(p); });
  }, []);
  if (!order) return <p className="body-text text-muted text-sm">Preparing your payment…</p>;
  return <OrderPayment order={order} payment={payment} onChange={() => {}} />;
}

const body =
  view === 'order'
    ? (
      <MemoryRouter initialEntries={[`/order/${ORDER_ID}`]}>
        <Routes><Route path="/order/:id" element={<OrderDetail />} /></Routes>
      </MemoryRouter>
    )
    : view === 'retired-onboarding-payment'
      ? (
        /* ⚠️ THE SECOND SURFACE IN THE SPEC'S TRAP 4 IS NOT REACHABLE TODAY.
           `Onboarding.tsx` mounts this same component at :2256 under
           `step === 'payment'`, and NOTHING sets that step any more — TASK-SIGNBOOK
           removed `enterPayment`, its only router (Onboarding.tsx:649-653), because
           CR-98 moved payment after staff approval. The markup is deliberately KEPT
           (NOSTRIP/D32) for TASK-REQCARDS. So this mounts it with exactly the props
           Onboarding passes, which proves the SENTENCE is right the day something
           routes there again — it does not, and must not, claim the step is reachable. */
        <MemoryRouter initialEntries={['/app/onboarding']}>
          <div className="min-h-screen bg-cream p-8">
            <RetiredOnboardingPayment />
          </div>
        </MemoryRouter>
      )
    : view === 'activation'
      ? (
        <MemoryRouter initialEntries={['/app/onboarding']}>
          <div className="min-h-screen bg-cream p-8">
            <ActivationOrderPanel purchaseId={ORDER_ID} onContinue={() => {}} />
          </div>
        </MemoryRouter>
      )
      : (
        <MemoryRouter initialEntries={['/confirmation']}>
          <Routes><Route path="/confirmation" element={<Confirmation />} /></Routes>
        </MemoryRouter>
      );

createRoot(document.getElementById('root')!).render(
  <HelmetProvider>
    <AuthProvider><BrandProvider>{body}</BrandProvider></AuthProvider>
  </HelmetProvider>,
);
