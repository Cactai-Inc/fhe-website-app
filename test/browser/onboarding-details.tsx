/* HARNESS ENTRY for /app/onboarding, step `details` — TASK-SIGNDOOR.
 *
 * The REAL Onboarding, in a real Chromium, so the claim "the first page after
 * auth asks who is signing up, with no default, on the doors that may carry a
 * minor" is proven by RENDERING it (D17 / WALK3 F-2) — never by reading the
 * constant off the source. This is the post-auth half of what
 * `probe-sign-minor.mjs` used to prove about the door.
 *
 * `?path=` drives `my_onboarding_state().sign_path`, which is the one fact the
 * page uses to decide whether the question belongs on it. `?minor=1` adds an
 * already-attached child, the case where the block must render whatever the door
 * said, so an existing minor can still be corrected or detached.
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
const withMinor = params.get('minor') === '1';
const contactId = '00000000-0000-4000-8000-0000000000c1';

/* A SIGNDOOR signup as it actually arrives: an account with a verified email, a
   contact record with NO NAME (the door never asked), one unsigned release, and
   nothing bought. `needed` + a null purchase is what lands the wizard on
   `details` — the first page after auth. */
window.__tables = {
  profiles: [{
    user_id: '00000000-0000-4000-8000-000000000001', role: 'CLIENT',
    org_id: '00000000-0000-4000-8000-0000000000aa',
    first_name: null, last_name: null, contact_id: contactId, is_suspended: false,
  }],
};
window.__rpcFixtures = {
  my_onboarding_state: {
    needed: true,
    profile_complete: false,
    documents: [{
      document_id: null, template_key: 'RELEASE_PARTICIPANT',
      title: 'Participant Liability Release', status: 'MISSING',
    }],
    purchase: null,
    minor: withMinor
      ? { first_name: 'Existing', last_name: 'Child', dob: '2016-05-04' }
      : null,
    horse_needed: false,
    // The door captured an email address and nothing else, so every field the
    // details form owns arrives blank and the form asks for all of them.
    prefill: {
      first_name: null, last_name: null, phone: null, date_of_birth: null,
      address_street: null, address_city: null, address_state: null, address_zip: null,
      emergency_contact_1_name: null, emergency_contact_1_relationship: null,
      emergency_contact_1_phone: null, emergency_contact_2_name: null,
      emergency_contact_2_relationship: null, emergency_contact_2_phone: null,
      riding_experience_years: null, jump_experience: null, riding_background: null,
    },
    contracts_waiting: [],
    sign_path: signPath,
  },
  my_name_confirmation_state: { needs_confirmation: false },
  my_standing_categories: [],
  my_standing_slots: [],
  my_nav_presence: {
    orders: false, payments: false, documents: false, stable: false, posts: false, saved: false,
  },
  update_my_onboarding_profile: null,
  generate_my_onboarding_documents: null,
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
