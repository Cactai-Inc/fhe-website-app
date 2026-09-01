/* HARNESS ENTRY for the WHOLE self-serve wizard — TASK-SIGNBOOK.
 *
 * `onboarding-details.tsx` (SIGNDOOR) mounts this same page frozen on its first
 * step. This one WALKS it: the REAL `Onboarding`, in a real Chromium, from the
 * details form through signing, the offering, the time and the request — because
 * CR-98's criterion is an ORDER OF STEPS, and an order is the one thing reading
 * the source cannot prove (D17 / WALK3 F-2). The spec itself got it wrong from
 * the source: it read the `Step` TYPE UNION and reported that signing came after
 * shopping. It never did.
 *
 * ⚠️ THE FIXTURES ARE A LITTLE STATE MACHINE, not constants. `my_onboarding_state`
 * must say MISSING before the signature and EXECUTED after it, or the page can
 * never leave the sign step. `?door=provisioned` starts the same page with an
 * order already on the account — the staff-provisioned door, which must still
 * reach `payment` (NOSTRIP, spec trap 2).
 */
import { createRoot } from 'react-dom/client';
import '../../src/index.css';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import { AuthProvider } from '../../src/contexts/AuthContext';
import { BrandProvider } from '../../src/contexts/BrandProvider';
import Onboarding from '../../src/pages/app/Onboarding';

const params = new URLSearchParams(location.search);
const signPath = params.get('path') ?? 'rider';
/** The staff-provisioned door arrives WITH an order; the self-serve door does not. */
const provisioned = params.get('door') === 'provisioned';

const orgId = '00000000-0000-4000-8000-0000000000aa';
const contactId = '00000000-0000-4000-8000-0000000000c1';
const docId = '00000000-0000-4000-8000-0000000000d1';
const provisionedOrderId = '00000000-0000-4000-8000-0000000000f1';
const evalOfferingId = '00000000-0000-4000-8000-0000000000e1';

/** What the wizard has been told so far. The probe reads this back too. */
const world = {
  signed: false,
  /** The order that exists RIGHT NOW — null until the shop step buys one. */
  orderId: provisioned ? provisionedOrderId : (null as string | null),
  submitted: null as Record<string, unknown> | null,
  held: 0,
};
(window as unknown as { __world: typeof world }).__world = world;

window.__tables = {
  profiles: [{
    user_id: '00000000-0000-4000-8000-000000000001', role: 'CLIENT', org_id: orgId,
    first_name: 'Robin', last_name: 'Fields', contact_id: contactId, is_suspended: false,
  }],
  // fetchOfferings reads this table directly. Two rows, so the evaluation gate
  // (everything else greys out until it is picked) is exercised, not bypassed.
  offerings: [
    {
      id: evalOfferingId, org_id: orgId, name: 'Evaluation Lesson', slug: 'evaluation-lesson',
      segment: 'rider', active: true, config_kind: 'scheduled', unit_count: 1,
      price_amount: 170, price_unit: 'session', service_type: 'RIDING_LESSON',
      sort_order: 1, tagline: null, weekly_frequency: null,
    },
    {
      id: '00000000-0000-4000-8000-0000000000e2', org_id: orgId, name: 'Single Lesson',
      slug: 'single-lesson', segment: 'rider', active: true, config_kind: 'scheduled',
      unit_count: 1, price_amount: 150, price_unit: 'session', service_type: 'RIDING_LESSON',
      sort_order: 2, tagline: 'Once your evaluation is done', weekly_frequency: null,
    },
  ],
  // getOrder / getOrderPayment read `purchases`, and `purchase_items` for the lines.
  purchases: () => (world.orderId
    ? [{
        id: world.orderId, org_id: orgId, status: 'draft', amount: 170, amount_paid: 0,
        payment_status: 'unpaid', payment_method: null, payment_reference: null,
        display_code: 'PUR-000999',
      }]
    : []),
  // The sign step reads the merged body straight off `documents` (getDocument).
  documents: [{
    id: docId, org_id: orgId, title: 'Participant Liability Release',
    status: 'MISSING', workflow_state: 'awaiting_signature',
    merged_body: 'PARTICIPANT LIABILITY RELEASE\n\nThe rider accepts the risks of equestrian activity.',
    contact_id: contactId, template_key: 'RELEASE_PARTICIPANT', display_code: 'DOC-000001',
    template: { version: 1 },
  }],
  purchase_items: () => (world.orderId
    ? [{
        id: '00000000-0000-4000-8000-00000000a001', purchase_id: world.orderId,
        offering_id: evalOfferingId, label: 'Evaluation Lesson',
        price_amount: 170, price_unit: 'session',
      }]
    : []),
};

const profileFor = () => ({
  needed: !world.signed,
  profile_complete: true,
  documents: [{
    document_id: docId, template_key: 'RELEASE_PARTICIPANT',
    title: 'Participant Liability Release',
    status: world.signed ? 'EXECUTED' : 'MISSING',
  }],
  // ⚠️ THE ONE FACT THAT PICKS THE DOOR. Null = self-serve; present = the
  // staff-provisioned entry this page was originally written for.
  purchase: provisioned
    ? { purchase_id: provisionedOrderId, paid: false, label: 'Evaluation Lesson' }
    : null,
  minor: null,
  horse_needed: false,
  prefill: {
    first_name: 'Robin', last_name: 'Fields', phone: '555 010 0100',
    date_of_birth: '1990-04-04', address_street: '1 Lane', address_city: 'Ojai',
    address_state: 'CA', address_zip: '93023',
    emergency_contact_1_name: 'Sam Fields', emergency_contact_1_relationship: 'Spouse',
    emergency_contact_1_phone: '555 010 0101', emergency_contact_2_name: null,
    emergency_contact_2_relationship: null, emergency_contact_2_phone: null,
    riding_experience_years: '5', jump_experience: null, riding_background: null,
  },
  contracts_waiting: [],
  sign_path: signPath,
});

window.__rpcFixtures = {
  my_onboarding_state: () => profileFor(),
  my_name_confirmation_state: { needs_confirmation: false },
  my_standing_categories: [],
  my_standing_slots: [],
  my_nav_presence: {
    orders: false, payments: false, documents: false, stable: false, posts: false, saved: false,
  },
  update_my_onboarding_profile: null,
  generate_my_onboarding_documents: null,
  // The document body the sign step renders before the type-to-sign box.
  contract_document_detail: () => ({
    document: { id: docId, title: 'Participant Liability Release', merged_body: 'THE RELEASE.' },
    fields: [], my_roles: ['CLIENT'],
  }),
  my_document_body: () => ({ id: docId, title: 'Participant Liability Release', merged_body: 'THE RELEASE.' }),
  record_signature: () => { world.signed = true; return null; },
  // SIGNBOOK's own three calls.
  hold_my_document_delivery: () => { world.held += 1; return null; },
  create_my_purchase: () => {
    world.orderId = '00000000-0000-4000-8000-0000000000f2';
    return world.orderId;
  },
  submit_my_booking_request: (a: unknown) => {
    world.submitted = a as Record<string, unknown>;
    return { booking_id: '00000000-0000-4000-8000-0000000000b1', request_id: null, status: 'pending' };
  },
  my_executed_delivery_state: { total: 1, delivered: 1 },
};

createRoot(document.getElementById('root')!).render(
  <HelmetProvider>
    <MemoryRouter initialEntries={['/app/onboarding']}>
      <AuthProvider><BrandProvider>
        <Routes><Route path="/app/onboarding" element={<Onboarding />} /></Routes>
      </BrandProvider></AuthProvider>
    </MemoryRouter>
  </HelmetProvider>,
);
