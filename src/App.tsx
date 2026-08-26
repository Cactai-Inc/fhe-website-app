import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import type { ReactNode } from 'react';
import { CartProvider } from './contexts/CartContext';
import { AuthProvider } from './contexts/AuthContext';
import { BrandProvider } from './contexts/BrandProvider';
import ProtectedRoute from './components/ProtectedRoute';
import ScrollToTop from './components/ScrollToTop';
import Layout from './components/layout/Layout';
import { ActivateShell } from './components/app/ActivateShell';
import { Navigate as RRNavigate, useLocation as useRRLocation } from 'react-router-dom';

/** Redirect preserving ?token=… so links in already-sent emails keep working. */
function RedirectWithQuery({ to }: { to: string }) {
  const loc = useRRLocation();
  return <RRNavigate to={{ pathname: to, search: loc.search }} replace />;
}
import AppLayout from './components/app/AppLayout';
import Landing from './pages/Landing';
import About from './pages/About';
import Story from './pages/Story';
// Shop (the public catalog) is hidden — see the /shop route below. The page
// file is untouched; restoring it is this import plus one route line.
import Faq from './pages/Faq';
import Services from './pages/Services';
import Contact from './pages/Contact';
import Lessons from './pages/Lessons';
import SignStart from './pages/SignStart';
import SignChoose from './pages/SignChoose';
import Gift from './pages/Gift';
import Redeem from './pages/Redeem';
import Release from './pages/Release';
import DocsParticipantFlow from './pages/DocsParticipantFlow';
/* BookRider import removed with the CLOSEOUT §3.6 redirect below; the file
   stays in the repo (redirect, do not delete). */
import BookHorse from './pages/BookHorse';
import BookSupport from './pages/BookSupport';
import Checkout from './pages/Checkout';
import Questions from './pages/Questions';
import Confirmation from './pages/Confirmation';
import NotFound from './pages/NotFound';
import Login from './pages/Login';
import Register from './pages/Register';
import RegisterComplete from './pages/RegisterComplete';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import Account, { ACCOUNT_PAGE_RETIRED } from './pages/Account';
import OrderDetail from './pages/OrderDetail';
// Member app
import Home from './pages/app/Home';
import DashboardHome from './pages/app/DashboardHome';
import MyPosts from './pages/app/MyPosts';
import Schedule from './pages/app/Schedule';
import CalendarPage from './pages/app/CalendarPage';
import Orders from './pages/app/Orders';
import MyPayments from './pages/app/MyPayments';
import Gifts from './pages/app/Gifts';
import Stable from './pages/app/Stable';
import CatalogPage from './pages/app/CatalogPage';
import Documents from './pages/app/Documents';
import Onboarding from './pages/app/Onboarding';
// Client portal (CP-* wave)
import MyLessons from './pages/app/MyLessons';
import ThreadDetail from './pages/app/ThreadDetail';
import MemberProfile from './pages/app/MemberProfile';
import Messages from './pages/app/Messages';
import ContentPostDetail from './pages/app/ContentPostDetail';
// Slice 4 — purpose-built dashboards + community/library surfaces
import Support from './pages/app/Support';
import ContractPage from './pages/app/ContractPage';
import ContractIntake from './pages/app/ContractIntake';
import AccountHub from './pages/app/AccountHub';
import HorseIntakePage from './pages/app/HorseIntakePage';
import AcquisitionIntakePage from './pages/app/AcquisitionIntakePage';
import EvaluationsPage from './pages/app/EvaluationsPage';
import EvaluationReportsPage from './pages/app/ops/EvaluationReportsPage';
import HorsePage from './pages/app/HorsePage';
import CareHome from './pages/app/CareHome';
import DealHome from './pages/app/DealHome';
import VerifyEmailScreen from './components/app/VerifyEmailScreen';
import { verifyWithPassword, verifyWithGoogle } from './lib/emailChange';
// TASK-RECORDS (2026-08-12): Admin (Clients), LeadsPage and DirectoryPage no
// longer mount their own routes — they are tabs inside RecordsPage now.
// Imported there, not here.
import RecordsPage from './pages/app/RecordsPage';
// Ops / CRM (staff/admin)
import OpsHome from './pages/app/OpsHome';
import InstructorHomePreview from './pages/app/ops/InstructorHomePreview';
import ContactsPage, { CONTACTS_PAGE_RETIRED } from './pages/app/ops/ContactsPage';
import HorsesPage, { HORSES_PAGE_RETIRED } from './pages/app/ops/HorsesPage';
import HorseRecordsPage, { HORSE_RECORDS_STANDALONE_RETIRED } from './pages/app/ops/HorseRecordsPage';
import DocumentsQueuePage, { DOCUMENTS_QUEUE_STANDALONE_RETIRED } from './pages/app/ops/DocumentsQueuePage';
import DocumentViewerPage from './pages/app/ops/DocumentViewerPage';
import ModerationPage from './pages/app/ops/ModerationPage';
import LookupReviewPage from './pages/app/ops/LookupReviewPage';
import SupportPage from './pages/app/ops/SupportPage';
import OversightPage from './pages/app/ops/OversightPage';
import ActivityPage from './pages/app/ops/ActivityPage';
import ContentStorePage from './pages/app/ops/ContentStorePage';
// Ops / CRM — Wave-7 (intake, payments review, module hubs + module pages)
import IntakePage, { INTAKE_PAGE_RETIRED, IntakeRetiredRedirect } from './pages/app/ops/IntakePage';
import TeamPage from './pages/app/ops/TeamPage';
import AccountInvitePage from './pages/app/ops/AccountInvitePage';
import NewContractPage from './pages/app/ops/NewContractPage';
import DealsPage, { DEALS_STANDALONE_RETIRED } from './pages/app/ops/DealsPage';
import DealPage from './pages/app/ops/DealPage';
import AdminFormsPage from './pages/app/ops/admin/AdminFormsPage';
import AdminMenusPage from './pages/app/ops/admin/AdminMenusPage';
import AdminPageVisibilityPage from './pages/app/ops/admin/AdminPageVisibilityPage';
import NavGroupCardsPage from './pages/app/ops/NavGroupCardsPage';
import PaymentReviewPage from './pages/app/ops/PaymentReviewPage';
import BoardingHubPage from './pages/app/ops/hubs/BoardingHubPage';
import FacilitiesPage from './pages/app/ops/boarding/FacilitiesPage';
import BoardAgreementsPage from './pages/app/ops/boarding/BoardAgreementsPage';
import BoardChargesPage from './pages/app/ops/boarding/BoardChargesPage';
import BarnopsHubPage from './pages/app/ops/hubs/BarnopsHubPage';
import ResourcesPage from './pages/app/ops/barnops/ResourcesPage';
import ConsumptionLogPage from './pages/app/ops/barnops/ConsumptionLogPage';
import AllocationRulesPage from './pages/app/ops/barnops/AllocationRulesPage';
import LessonsHubPage, { LESSONS_HUB_STANDALONE_RETIRED } from './pages/app/ops/hubs/LessonsHubPage';
import LessonPackagesPage from './pages/app/ops/lessons/LessonPackagesPage';
import LessonCreditsPage from './pages/app/ops/lessons/LessonCreditsPage';
import SessionsPage from './pages/app/ops/lessons/SessionsPage';
import LessonPlansPage from './pages/app/ops/lessons/LessonPlansPage';
import RecordsHubPage, { RECORDS_HUB_RETIRED } from './pages/app/ops/hubs/RecordsHubPage';
import HorsePartiesPage from './pages/app/ops/records/HorsePartiesPage';
import HorseHealthPage from './pages/app/ops/records/HorseHealthPage';
import EmployeesHubPage from './pages/app/ops/hubs/EmployeesHubPage';
import StaffPage from './pages/app/ops/employees/StaffPage';
import SchedulePage from './pages/app/ops/employees/SchedulePage';
// Ops admin + superadmin (Wave-7 tail)
import AdminModulesPage from './pages/app/ops/admin/AdminModulesPage';
import AdminRegistryPage from './pages/app/ops/admin/AdminRegistryPage';
import AdminBrandingPage from './pages/app/ops/admin/AdminBrandingPage';
import AdminProductsPage from './pages/app/ops/admin/AdminProductsPage';
import AdminTemplatesPage from './pages/app/ops/admin/AdminTemplatesPage';
import AdminTemplateEditorPage from './pages/app/ops/admin/AdminTemplateEditorPage';
/* ── REVIEW SECTION (temporary — TASK-REVIEWNAV, owner 2026-08-11/12) ────────
   The section EMPTIES OUT as pages are accepted; when src/lib/reviewSection.ts
   is empty, delete these two imports, the five `ops/review*` routes below, and
   src/pages/app/ops/review/. See that file's header for the full procedure. */
import ReviewIndexPage from './pages/app/ops/review/ReviewIndexPage';
import {
  ReviewContactsPage, ReviewIntakePage, ReviewContactDossier, ReviewContactForm,
} from './pages/app/ops/review/ReviewMounts';
import ProvisionTenantPage from './pages/app/ops/superadmin/ProvisionTenantPage';
import OrganizationsPage from './pages/app/ops/superadmin/OrganizationsPage';
import TenantDetailPage from './pages/app/ops/superadmin/TenantDetailPage';

export function AppRoutes() {
  return (
    <AuthProvider>
      <BrandProvider>
        <CartProvider>
          <Routes>
            {/* Landing — its own naked nav + no footer, so it renders bare
                (outside the shared Layout header/footer chrome). */}
            <Route path="/" element={<Landing />} />
            {/* Account activation lives in APP chrome, not the website (owner). */}
            <Route path="/activate" element={<ActivateShell><Register /></ActivateShell>} />
            <Route path="/activate/complete" element={<ActivateShell><RegisterComplete /></ActivateShell>} />

            {/* Public marketing + inquiry (marketing chrome) */}
            <Route element={<Layout />}>
              <Route path="/about" element={<About />} />
              <Route path="/story" element={<Story />} />
              {/* Owner, 2026-08-16: "hide this catalog externally for now."
                  A web visitor should be funnelled to the thing they came for,
                  not handed a browsable list that invites comparison — the
                  catalog stays right for in-app use, where someone already knows
                  what they want. The route REDIRECTS rather than 404s so any
                  existing link or bookmark lands on the rider funnel, and Shop
                  stays mounted in the bundle so un-hiding is one line. */}
              <Route path="/shop" element={<Navigate to="/lessons" replace />} />
              <Route path="/faq" element={<Faq />} />
              <Route path="/services" element={<Services />} />
              <Route path="/contact" element={<Contact />} />
              {/* Old rider-entrance interstitial — folded into the linear
                  funnel; legacy links land straight on the lessons page. */}
              <Route path="/ride" element={<Navigate to="/lessons" replace />} />
              {/* Self-contained funnels, each its own page */}
              <Route path="/lessons" element={<Lessons />} />
              {/* TASK C — public self-onboarding funnels (/sign/guest, /sign/rider,
                  /sign/horse, /sign/rider+horse); ':path' also captures the
                  percent-encoded rider%2Bhorse form.
                  ONBOARD §1: /sign itself is the chooser those four hang off. It
                  did not exist, and nothing on the site linked to the deep links,
                  so the whole funnel was unreachable. Deep links skip the chooser. */}
              <Route path="/sign" element={<SignChoose />} />
              <Route path="/sign/:path" element={<SignStart />} />
              {/* Public /membership join removed (Slice 4): membership is by
                  invitation via the app, not a public funnel. */}
              <Route path="/membership" element={<Navigate to="/lessons" replace />} />
              <Route path="/horse" element={<BookHorse />} />
              <Route path="/acquisition" element={<BookSupport />} />
              {/* Gifting (purchase-as-gift keeps marketing chrome) */}
              <Route path="/gift" element={<Gift />} />
              {/* Legacy paths still resolve */}
              {/* CLOSEOUT §3.6: /book/rider is RETIRED behind a redirect (not
                  deleted — old links and search results keep landing somewhere
                  real). It was orphaned — nothing on the site links to it — and
                  its question-page shape contradicts the no-questions-page
                  ruling; /lessons is the live rider funnel. */}
              <Route path="/book/rider" element={<Navigate to="/lessons" replace />} />
              <Route path="/book/horse" element={<BookHorse />} />
              <Route path="/book/support" element={<BookSupport />} />
              {/* ASKRIGHT §A0 — page 2 for a cart whose visitor did not come
                  through a funnel that has one (the /lessons cross-entry case).
                  It redirects straight to /checkout when nothing in the cart
                  asks anything, so the questions page is conditional on CONTENT
                  and never on entry point. */}
              <Route path="/questions" element={<Questions />} />
              <Route path="/checkout" element={<Checkout />} />
              <Route path="/confirmation" element={<Confirmation />} />
              <Route path="/login" element={<Login />} />
              {/* legacy links in already-sent emails redirect into the app chrome */}
              <Route path="/register" element={<RedirectWithQuery to="/activate" />} />
              <Route path="/register/complete" element={<RedirectWithQuery to="/activate/complete" />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/reset-password" element={<ResetPassword />} />

              {/* Signed-in but outside the member app */}
              {/* TASK-PAGEMERGE: retired — its one real capability (2FA) is now
                  ported to /app/account's My Login section. */}
              <Route path="/account" element={ACCOUNT_PAGE_RETIRED
                ? <Navigate to="/app" replace />
                : <ProtectedRoute><Account /></ProtectedRoute>} />
              <Route path="/order/:id" element={<ProtectedRoute><OrderDetail /></ProtectedRoute>} />
            </Route>

            {/* Gift reveal — full-screen immersive, no site chrome */}
            <Route path="/redeem" element={<Redeem />} />
            {/* /inquire retired — the unified intake lives on /contact (Phase 5) */}
            <Route path="/inquire" element={<Navigate to="/contact" replace />} />
            <Route path="/release" element={<Release />} />
            <Route path="/release/:releaseKey" element={<Release />} />
            {/* Guided participant document set — one info form, 4 docs signed in sequence */}
            <Route path="/docs/release-participant" element={<DocsParticipantFlow />} />

            {/* Email-change verification landing — standalone, no chrome */}
            <Route path="/verify-email" element={<VerifyEmailScreen seams={{ verifyWithPassword, verifyWithGoogle }} />} />

            {/* Member community app (its own chrome, member-gated) */}
            <Route
              path="/app"
              element={
                <ProtectedRoute requireMember>
                  <AppLayout />
                </ProtectedRoute>
              }
            >
              {/* /app index = Community (the front door on sign-in). The dashboard
                  (priority actions + notifications) is its own page at /app/dashboard. */}
              <Route index element={<Home />} />
              <Route path="dashboard" element={<DashboardHome />} />
              {/* Slice 4 — purpose-built dashboards for non-rider purchase categories */}
              <Route path="schedule" element={<Schedule />} />
              <Route path="calendar" element={<CalendarPage />} />
              {/* Slice 4 — Community hub (front door) + its surfaces */}
              <Route path="threads/:id" element={<ThreadDetail />} />
              <Route path="members/:userId" element={<MemberProfile />} />
              <Route path="messages" element={<Messages />} />
              <Route path="messages/:userId" element={<Messages />} />
              {/* Slice 4 — Library = the conformed Content page (articles + resources
                  + personal docs link). /app/content kept as an alias. */}
              <Route path="content/:slug" element={<ContentPostDetail />} />
              <Route path="documents" element={<Documents />} />
              {/* Rider onboarding (provisioned invite → details → sign → confirmation) */}
              <Route path="onboarding" element={<Onboarding />} />
              {/* Flow D — returning member books more (BOOKING_FLOWS_PLAN §2 Flow D) */}
              {/* /app/book retired — booking lives on the full calendar (Phase 6) */}
              <Route path="book" element={<Navigate to="/app/calendar" replace />} />
              <Route path="orders" element={<Orders />} />
              <Route path="payments" element={<MyPayments />} />
              <Route path="gifts" element={<Gifts />} />
              <Route path="catalog" element={<CatalogPage />} />
              <Route path="checkout" element={<Checkout />} />
              {/* Client portal (CP-*) */}
              <Route path="lessons" element={<MyLessons />} />
              {/* TASK-PROFILE (2026-08-05): /app/profile dissolved — its fields
                  (name/photo/bio, riding level) and its duplicate sign-in card
                  now live in the consolidated Profile & Preferences surface at
                  /app/account. See docs/reports/TASK-PROFILE-REPORT.md. */}
              <Route path="support" element={<Support />} />
              <Route path="account" element={<AccountHub />} />
              <Route path="my-posts" element={<MyPosts />} />
              {/* TASK-ACCOUNTSURFACE §2 (2026-08-07): My Stable's real route —
                  it previously only existed as /app/account?section=stable,
                  which AccountHub now redirects here instead of pre-opening. */}
              <Route path="stable" element={<Stable />} />
              {/* Purpose-built client homes (surface model: care / deal) */}
              <Route path="care" element={<CareHome />} />
              <Route path="deal" element={<DealHome />} />
              {/* A4 — client horse-intake opened from a staff request; ?booking=<id> attaches the horse */}
              <Route path="horse-intake" element={<HorseIntakePage />} />
              {/* Phase 4 — acquisition intake (Find-a-Horse criteria / Evaluation facts) a purchase unlocks */}
              <Route path="acquisition-intake" element={<AcquisitionIntakePage />} />
              {/* Phase 4 — the client's delivered horse-evaluation reports (read / download / email / share) */}
              <Route path="evaluations" element={<EvaluationsPage />} />
              <Route path="horses/:horseId" element={<ProtectedRoute><HorsePage /></ProtectedRoute>} />
              {/* Negotiated contracts (Update A): owner authoring + counterparty
                  intake→review→sign. Notification links target this route. */}
              <Route path="contracts/:id" element={<ContractPage />} />
              {/* P1 ITEM 2 — the gate between claiming an account and reading the
                  contract it carried. It forwards to the document when nothing is
                  missing, so it is safe to route through unconditionally. */}
              <Route path="contracts/:id/start" element={<ContractIntake />} />
              {/* TASK-RECORDS (2026-08-12): Records — Leads · Clients · Partners ·
                  Vendors · Horses, one tab strip over independent renderers.
                  Supersedes TASK-ONEPEOPLE. /app/records bare = the All tab. */}
              <Route path="records" element={<ProtectedRoute requireStaff><RecordsPage /></ProtectedRoute>} />
              <Route path="records/:tab" element={<ProtectedRoute requireStaff><RecordsPage /></ProtectedRoute>} />
              {/* RETIRED 2026-08-12 (TASK-RECORDS): the Clients page folded into
                  Records as its own tab. RedirectWithQuery preserves ?open=<id>,
                  which DashboardPanel and DocumentQueueTable both still send. */}
              <Route path="admin" element={<RedirectWithQuery to="/app/records/clients" />} />

              {/* Ops / CRM — two-operator model (Slice 5). Servicing subset =
                  requireStaff (trainers + admins); total control = requireStaff. */}
              <Route path="ops" element={<ProtectedRoute requireStaff><OpsHome /></ProtectedRoute>} />
              {/* ADMINSWEEP Phase 2 — InstructorHome renders only for non-admin
                  staff, and no such account exists in production, so the owner
                  could not look at it before ruling on it. This mounts the real
                  component behind a preview banner. NOT a second landing page:
                  no nav entry, nothing links here, reached by URL only. See
                  ops/InstructorHomePreview.tsx for why it is not a role fake. */}
              <Route path="ops/preview/instructor-home" element={<ProtectedRoute requireStaff><InstructorHomePreview /></ProtectedRoute>} />
              {/* Servicing subset — trainers + admins */}
              {/* The four person-pages, each defined by contacts.contact_type.
                  /ops/contacts kept its path (the people we serve); the rolodex
                  moves to its own /ops/directory rather than sharing one. */}
              {/* RETIRED 2026-08-10 (TASK-ROSTER, reaffirmed TASK-ROSTERCARD):
                  the Clients page won and now shows every contact. Route
                  redirects rather than 404s so old links land on the winning
                  page; flip the boolean to restore. Target repointed 2026-08-12
                  (TASK-RECORDS) to the Clients tab directly — /app/admin itself
                  now just redirects here too, so this avoids a double hop. */}
              <Route path="ops/contacts" element={CONTACTS_PAGE_RETIRED
                ? <Navigate to="/app/records/clients" replace />
                : <ProtectedRoute requireStaff><ContactsPage /></ProtectedRoute>} />
              {/* RETIRED 2026-08-12 (TASK-RECORDS): DIRECTORY split into VENDOR
                  and PARTNER — zero rows, so this redirects to the nearer of
                  the two (most of the old blurb — farriers/vets/suppliers —
                  reads as Vendor; Partner is the narrower new category). */}
              <Route path="ops/directory" element={<Navigate to="/app/records/vendors" replace />} />
              <Route path="ops/leads" element={<RedirectWithQuery to="/app/records/leads" />} />
              {/* RETIRED 2026-08-15 (owner: "we dont need horses as its own page
                  if we have horses on the records page") — a third, orphaned
                  horse-roster implementation, never linked from any nav. */}
              <Route path="ops/horses" element={HORSES_PAGE_RETIRED
                ? <Navigate to="/app/records/horses" replace />
                : <ProtectedRoute requireStaff><HorsesPage /></ProtectedRoute>} />
              {/* RETIRED 2026-08-15 (owner) — HorseRecordsPage is unchanged and
                  still IS the Records "Horses" tab; only this standalone entry
                  point + its nav row go away. */}
              <Route path="ops/horse-records" element={HORSE_RECORDS_STANDALONE_RETIRED
                ? <Navigate to="/app/records/horses" replace />
                : <ProtectedRoute requireStaff><HorseRecordsPage /></ProtectedRoute>} />
              {/* RETIRED 2026-08-15 (owner: "documents… should be added to
                  the records page") — unchanged component, now Records'
                  own "Documents" tab. */}
              <Route path="ops/documents" element={DOCUMENTS_QUEUE_STANDALONE_RETIRED
                ? <Navigate to="/app/records/documents" replace />
                : <ProtectedRoute requireStaff><DocumentsQueuePage /></ProtectedRoute>} />
              <Route path="ops/documents/:id" element={<ProtectedRoute requireStaff><DocumentViewerPage /></ProtectedRoute>} />
              {/* RETIRED 2026-08-11 (TASK-LEADCLEAN): the owner ruled the
                  dashboard is the surface and Inbound goes away. The nav item
                  was already gone; this closes the route. Redirects rather than
                  404s so the notification links that still point here land on
                  the lead's drawer (the `request` param is carried through);
                  flip the boolean to restore the page. */}
              <Route path="ops/intake" element={INTAKE_PAGE_RETIRED
                ? <IntakeRetiredRedirect />
                : <ProtectedRoute requireStaff><IntakePage /></ProtectedRoute>} />
              <Route path="ops/team" element={<ProtectedRoute requireStaff><TeamPage /></ProtectedRoute>} />
              {/* staff can invite clients; the page hides staff account types for non-admins */}
              <Route path="ops/accounts/new" element={<ProtectedRoute requireStaff><AccountInvitePage /></ProtectedRoute>} />
              <Route path="ops/contracts/new" element={<ProtectedRoute requireStaff><NewContractPage /></ProtectedRoute>} />
              {/* RETIRED 2026-08-15 (owner: "deals… should be added to the
                  records page") — unchanged component, now Records' own
                  "Deals" tab. */}
              <Route path="ops/deals" element={DEALS_STANDALONE_RETIRED
                ? <Navigate to="/app/records/deals" replace />
                : <ProtectedRoute requireStaff><DealsPage /></ProtectedRoute>} />
              <Route path="ops/deals/:dealId" element={<ProtectedRoute requireStaff><DealPage /></ProtectedRoute>} />
              {/* ops/availability retired — staff manage availability on the full calendar (Phase 6) */}
              <Route path="ops/availability" element={<Navigate to="/app/calendar" replace />} />
              {/* Total control — admins only */}
              <Route path="ops/moderation" element={<ProtectedRoute requireStaff><ModerationPage /></ProtectedRoute>} />
              <Route path="ops/lookups" element={<ProtectedRoute requireStaff><LookupReviewPage /></ProtectedRoute>} />
              <Route path="ops/support" element={<ProtectedRoute requireStaff><SupportPage /></ProtectedRoute>} />
              <Route path="ops/oversight" element={<ProtectedRoute requireStaff><OversightPage /></ProtectedRoute>} />
              <Route path="ops/activity" element={<ProtectedRoute requireStaff><ActivityPage /></ProtectedRoute>} />
              <Route path="ops/evaluations" element={<ProtectedRoute requireStaff><EvaluationReportsPage /></ProtectedRoute>} />
              <Route path="ops/content" element={<ProtectedRoute requireStaff><ContentStorePage /></ProtectedRoute>} />
              <Route path="ops/payments/review" element={<ProtectedRoute requireStaff><PaymentReviewPage /></ProtectedRoute>} />
              {/* Wave-7: module hubs + module pages (module-gated inside via ModuleGate) */}
              <Route path="ops/boarding" element={<ProtectedRoute requireStaff><BoardingHubPage /></ProtectedRoute>} />
              <Route path="ops/boarding/facilities" element={<ProtectedRoute requireStaff><FacilitiesPage /></ProtectedRoute>} />
              <Route path="ops/boarding/agreements" element={<ProtectedRoute requireStaff><BoardAgreementsPage /></ProtectedRoute>} />
              <Route path="ops/boarding/charges" element={<ProtectedRoute requireStaff><BoardChargesPage /></ProtectedRoute>} />
              <Route path="ops/barnops" element={<ProtectedRoute requireStaff><BarnopsHubPage /></ProtectedRoute>} />
              <Route path="ops/barnops/resources" element={<ProtectedRoute requireStaff><ResourcesPage /></ProtectedRoute>} />
              <Route path="ops/barnops/consumption" element={<ProtectedRoute requireStaff><ConsumptionLogPage /></ProtectedRoute>} />
              <Route path="ops/barnops/allocation-rules" element={<ProtectedRoute requireStaff><AllocationRulesPage /></ProtectedRoute>} />
              {/* Lessons = servicing surface (trainers + admins) */}
              {/* RETIRED 2026-08-15 (owner: "lessons… is really a records
                  ledger so it should be added to the records page") —
                  unchanged component, now Records' own "Lessons" tab. */}
              <Route path="ops/lessons" element={LESSONS_HUB_STANDALONE_RETIRED
                ? <Navigate to="/app/records/lessons" replace />
                : <ProtectedRoute requireStaff><LessonsHubPage /></ProtectedRoute>} />
              <Route path="ops/lessons/packages" element={<ProtectedRoute requireStaff><LessonPackagesPage /></ProtectedRoute>} />
              <Route path="ops/lessons/credits" element={<ProtectedRoute requireStaff><LessonCreditsPage /></ProtectedRoute>} />
              <Route path="ops/lessons/sessions" element={<ProtectedRoute requireStaff><SessionsPage /></ProtectedRoute>} />
              {/* LESSONPLAN — the plan roster + editor. Registered in
                  pageRegistry.ts too, so it is reachable from the nav and not
                  only by typing the URL (D17). */}
              <Route path="ops/lessons/plans" element={<ProtectedRoute requireStaff><LessonPlansPage /></ProtectedRoute>} />
              {/* TASK-PAGEMERGE: RecordsHubPage's own roster is retired (a third
                  listing of the same horses); its two lane routes below are
                  unaffected and keep resolving. */}
              <Route path="ops/records" element={RECORDS_HUB_RETIRED
                ? <Navigate to="/app/records/horses" replace />
                : <ProtectedRoute requireStaff><RecordsHubPage /></ProtectedRoute>} />
              <Route path="ops/records/horses/:horseId/parties" element={<ProtectedRoute requireStaff><HorsePartiesPage /></ProtectedRoute>} />
              <Route path="ops/records/horses/:horseId/health" element={<ProtectedRoute requireStaff><HorseHealthPage /></ProtectedRoute>} />
              <Route path="ops/employees" element={<ProtectedRoute requireStaff><EmployeesHubPage /></ProtectedRoute>} />
              <Route path="ops/employees/staff" element={<ProtectedRoute requireStaff><StaffPage /></ProtectedRoute>} />
              <Route path="ops/employees/schedule" element={<ProtectedRoute requireStaff><SchedulePage /></ProtectedRoute>} />
              {/* ── REVIEW SECTION (temporary — TASK-REVIEWNAV) ───────────────
                  Review-ONLY routes: the four implementations in DUPECENSUS's
                  manifest that could not otherwise be reached. requireAdmin,
                  matching the admin-only nav group — no other route in the app
                  points here, and none of these is a second home for a live
                  page. ⚠ NEITHER RETIREMENT CONSTANT WAS FLIPPED: /app/ops/
                  contacts and /app/ops/intake still redirect above, untouched;
                  these mount the components instead. Delete this block, its two
                  imports and the pages/app/ops/review/ folder to remove. */}
              <Route path="ops/review" element={<ProtectedRoute requireAdmin><ReviewIndexPage /></ProtectedRoute>} />
              <Route path="ops/review/contacts" element={<ProtectedRoute requireAdmin><ReviewContactsPage /></ProtectedRoute>} />
              <Route path="ops/review/intake" element={<ProtectedRoute requireAdmin><ReviewIntakePage /></ProtectedRoute>} />
              <Route path="ops/review/contact-dossier" element={<ProtectedRoute requireAdmin><ReviewContactDossier /></ProtectedRoute>} />
              <Route path="ops/review/contact-form" element={<ProtectedRoute requireAdmin><ReviewContactForm /></ProtectedRoute>} />
              {/* ── end REVIEW SECTION ───────────────────────────────────────── */}
              {/* Ops admin + superadmin (superadmin pages self-hide behind isSuperAdmin) */}
              <Route path="ops/admin/modules" element={<ProtectedRoute requireSuperAdmin><AdminModulesPage /></ProtectedRoute>} />
              <Route path="ops/admin/registry" element={<ProtectedRoute requireSuperAdmin><AdminRegistryPage /></ProtectedRoute>} />
              <Route path="ops/admin/branding" element={<ProtectedRoute requireAdmin><AdminBrandingPage /></ProtectedRoute>} />
              <Route path="ops/admin/products" element={<ProtectedRoute requireAdmin><AdminProductsPage /></ProtectedRoute>} />
              <Route path="ops/admin/forms" element={<ProtectedRoute requireAdmin><AdminFormsPage /></ProtectedRoute>} />
              {/* Every dropdown list in the app and its contents — the 5 shared
                  vocabularies plus the 119 option lists living inside form schemas. */}
              <Route path="ops/admin/menus" element={<ProtectedRoute requireAdmin><AdminMenusPage /></ProtectedRoute>} />
              {/* TASK-TEXTEDIT — edit template wording without SQL (D13). */}
              <Route path="ops/admin/templates" element={<ProtectedRoute requireAdmin><AdminTemplatesPage /></ProtectedRoute>} />
              <Route path="ops/admin/templates/:templateKey" element={<ProtectedRoute requireAdmin><AdminTemplateEditorPage /></ProtectedRoute>} />
              {/* TASK-PAGEVIS — where the tenant hides individual pages. requireAdmin,
                  matching its Settings siblings. This route is never gated by page
                  visibility itself: set_page_hidden refuses to hide it, so the way back
                  always exists. */}
              <Route path="ops/admin/pages" element={<ProtectedRoute requireAdmin><AdminPageVisibilityPage /></ProtectedRoute>} />
              {/* Owner, 2026-08-15: Settings/Modules reached from the Account
                  page as cards, each opening a real page whose own content is
                  the SETTINGS_GROUP/MODULES_GROUP items as cards — reusing
                  manageNavGroups(), the same function the sidebar renders
                  from, so this can never drift from what the nav shows. */}
              <Route path="ops/settings" element={<ProtectedRoute requireStaff>
                <NavGroupCardsPage groupKey="settings" heading="Settings" description="Configuration for how the barn runs." />
              </ProtectedRoute>} />
              <Route path="ops/modules" element={<ProtectedRoute requireStaff>
                <NavGroupCardsPage groupKey="modules" heading="Modules" description="The optional features enabled for this tenant." />
              </ProtectedRoute>} />
              <Route path="ops/superadmin/provision" element={<ProtectedRoute requireSuperAdmin><ProvisionTenantPage /></ProtectedRoute>} />
              <Route path="ops/superadmin/organizations" element={<ProtectedRoute requireSuperAdmin><OrganizationsPage /></ProtectedRoute>} />
              <Route path="ops/superadmin/organizations/:id" element={<ProtectedRoute requireSuperAdmin><TenantDetailPage /></ProtectedRoute>} />
            </Route>

            {/* Branded 404 */}
            <Route element={<Layout />}>
              <Route path="*" element={<NotFound />} />
            </Route>
          </Routes>
        </CartProvider>
      </BrandProvider>
    </AuthProvider>
  );
}

/** Browser entry: client-side router. */
export default function App() {
  return (
    <BrowserRouter>
      <ScrollToTop />
      <AppRoutes />
    </BrowserRouter>
  );
}

/** Server entry helper: lets the prerender wrap routes in a StaticRouter. */
export function AppWithRouter({ router }: { router: (children: ReactNode) => ReactNode }) {
  return router(<AppRoutes />);
}
