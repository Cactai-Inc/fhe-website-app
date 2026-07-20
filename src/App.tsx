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
import Shop from './pages/Shop';
import Faq from './pages/Faq';
import Services from './pages/Services';
import Contact from './pages/Contact';
import Lessons from './pages/Lessons';
import Gift from './pages/Gift';
import Redeem from './pages/Redeem';
import Release from './pages/Release';
import DocsParticipantFlow from './pages/DocsParticipantFlow';
import BookRider from './pages/BookRider';
import BookHorse from './pages/BookHorse';
import BookSupport from './pages/BookSupport';
import Checkout from './pages/Checkout';
import Confirmation from './pages/Confirmation';
import NotFound from './pages/NotFound';
import Login from './pages/Login';
import Register from './pages/Register';
import RegisterComplete from './pages/RegisterComplete';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import Account from './pages/Account';
import OrderDetail from './pages/OrderDetail';
// Member app
import Home from './pages/app/Home';
import Profile from './pages/app/Profile';
import Schedule from './pages/app/Schedule';
import CalendarPage from './pages/app/CalendarPage';
import Orders from './pages/app/Orders';
import Gifts from './pages/app/Gifts';
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
import AccountHub from './pages/app/AccountHub';
import HorseIntakePage from './pages/app/HorseIntakePage';
import HorsePage from './pages/app/HorsePage';
import CareHome from './pages/app/CareHome';
import DealHome from './pages/app/DealHome';
import VerifyEmailScreen from './components/app/VerifyEmailScreen';
import { verifyWithPassword, verifyWithGoogle } from './lib/emailChange';
import Admin from './pages/app/Admin';
// Ops / CRM (staff/admin)
import OpsHome from './pages/app/OpsHome';
import ContactsPage, { LeadsPage } from './pages/app/ops/ContactsPage';
import HorsesPage from './pages/app/ops/HorsesPage';
import HorseRecordsPage from './pages/app/ops/HorseRecordsPage';
import DocumentsQueuePage from './pages/app/ops/DocumentsQueuePage';
import DocumentViewerPage from './pages/app/ops/DocumentViewerPage';
import ModerationPage from './pages/app/ops/ModerationPage';
import LookupReviewPage from './pages/app/ops/LookupReviewPage';
import SupportPage from './pages/app/ops/SupportPage';
import OversightPage from './pages/app/ops/OversightPage';
import ContentStorePage from './pages/app/ops/ContentStorePage';
// Ops / CRM — Wave-7 (intake, payments review, module hubs + module pages)
import IntakePage from './pages/app/ops/IntakePage';
import TeamPage from './pages/app/ops/TeamPage';
import AccountInvitePage from './pages/app/ops/AccountInvitePage';
import NewContractPage from './pages/app/ops/NewContractPage';
import AdminFormsPage from './pages/app/ops/admin/AdminFormsPage';
import PaymentReviewPage from './pages/app/ops/PaymentReviewPage';
import BoardingHubPage from './pages/app/ops/hubs/BoardingHubPage';
import FacilitiesPage from './pages/app/ops/boarding/FacilitiesPage';
import BoardAgreementsPage from './pages/app/ops/boarding/BoardAgreementsPage';
import BoardChargesPage from './pages/app/ops/boarding/BoardChargesPage';
import BarnopsHubPage from './pages/app/ops/hubs/BarnopsHubPage';
import ResourcesPage from './pages/app/ops/barnops/ResourcesPage';
import ConsumptionLogPage from './pages/app/ops/barnops/ConsumptionLogPage';
import AllocationRulesPage from './pages/app/ops/barnops/AllocationRulesPage';
import LessonsHubPage from './pages/app/ops/hubs/LessonsHubPage';
import LessonPackagesPage from './pages/app/ops/lessons/LessonPackagesPage';
import LessonCreditsPage from './pages/app/ops/lessons/LessonCreditsPage';
import SessionsPage from './pages/app/ops/lessons/SessionsPage';
import RecordsHubPage from './pages/app/ops/hubs/RecordsHubPage';
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
              <Route path="/shop" element={<Shop />} />
              <Route path="/faq" element={<Faq />} />
              <Route path="/services" element={<Services />} />
              <Route path="/contact" element={<Contact />} />
              {/* Old rider-entrance interstitial — folded into the linear
                  funnel; legacy links land straight on the lessons page. */}
              <Route path="/ride" element={<Navigate to="/lessons" replace />} />
              {/* Self-contained funnels, each its own page */}
              <Route path="/lessons" element={<Lessons />} />
              {/* Public /membership join removed (Slice 4): membership is by
                  invitation via the app, not a public funnel. */}
              <Route path="/membership" element={<Navigate to="/lessons" replace />} />
              <Route path="/horse" element={<BookHorse />} />
              <Route path="/acquisition" element={<BookSupport />} />
              {/* Gifting (purchase-as-gift keeps marketing chrome) */}
              <Route path="/gift" element={<Gift />} />
              {/* Legacy paths still resolve */}
              <Route path="/book/rider" element={<BookRider />} />
              <Route path="/book/horse" element={<BookHorse />} />
              <Route path="/book/support" element={<BookSupport />} />
              <Route path="/checkout" element={<Checkout />} />
              <Route path="/confirmation" element={<Confirmation />} />
              <Route path="/login" element={<Login />} />
              {/* legacy links in already-sent emails redirect into the app chrome */}
              <Route path="/register" element={<RedirectWithQuery to="/activate" />} />
              <Route path="/register/complete" element={<RedirectWithQuery to="/activate/complete" />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/reset-password" element={<ResetPassword />} />

              {/* Signed-in but outside the member app */}
              <Route path="/account" element={<ProtectedRoute><Account /></ProtectedRoute>} />
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
              {/* /app index = the Home feed (Slice 3). The old dashboard content
                  moves to a renamed Dashboard page in Slice 4; kept reachable at
                  /app/dashboard meanwhile. */}
              <Route index element={<Home />} />
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
              <Route path="gifts" element={<Gifts />} />
              <Route path="catalog" element={<CatalogPage />} />
              <Route path="checkout" element={<Checkout />} />
              {/* Client portal (CP-*) */}
              <Route path="lessons" element={<MyLessons />} />
              <Route path="profile" element={<Profile />} />
              <Route path="support" element={<Support />} />
              <Route path="account" element={<AccountHub />} />
              {/* Purpose-built client homes (surface model: care / deal) */}
              <Route path="care" element={<CareHome />} />
              <Route path="deal" element={<DealHome />} />
              {/* A4 — client horse-intake opened from a staff request; ?booking=<id> attaches the horse */}
              <Route path="horse-intake" element={<HorseIntakePage />} />
              <Route path="horses/:horseId" element={<ProtectedRoute><HorsePage /></ProtectedRoute>} />
              {/* Negotiated contracts (Update A): owner authoring + counterparty
                  intake→review→sign. Notification links target this route. */}
              <Route path="contracts/:id" element={<ContractPage />} />
              {/* Admin (additionally requires admin) */}
              <Route path="admin" element={<ProtectedRoute requireStaff><Admin /></ProtectedRoute>} />

              {/* Ops / CRM — two-operator model (Slice 5). Servicing subset =
                  requireStaff (trainers + admins); total control = requireStaff. */}
              <Route path="ops" element={<ProtectedRoute requireStaff><OpsHome /></ProtectedRoute>} />
              {/* Servicing subset — trainers + admins */}
              <Route path="ops/contacts" element={<ProtectedRoute requireStaff><ContactsPage /></ProtectedRoute>} />
              <Route path="ops/leads" element={<ProtectedRoute requireStaff><LeadsPage /></ProtectedRoute>} />
              <Route path="ops/horses" element={<ProtectedRoute requireStaff><HorsesPage /></ProtectedRoute>} />
              <Route path="ops/horse-records" element={<ProtectedRoute requireStaff><HorseRecordsPage /></ProtectedRoute>} />
              <Route path="ops/documents" element={<ProtectedRoute requireStaff><DocumentsQueuePage /></ProtectedRoute>} />
              <Route path="ops/documents/:id" element={<ProtectedRoute requireStaff><DocumentViewerPage /></ProtectedRoute>} />
              <Route path="ops/intake" element={<ProtectedRoute requireStaff><IntakePage /></ProtectedRoute>} />
              <Route path="ops/team" element={<ProtectedRoute requireStaff><TeamPage /></ProtectedRoute>} />
              {/* staff can invite clients; the page hides staff account types for non-admins */}
              <Route path="ops/accounts/new" element={<ProtectedRoute requireStaff><AccountInvitePage /></ProtectedRoute>} />
              <Route path="ops/contracts/new" element={<ProtectedRoute requireStaff><NewContractPage /></ProtectedRoute>} />
              {/* ops/availability retired — staff manage availability on the full calendar (Phase 6) */}
              <Route path="ops/availability" element={<Navigate to="/app/calendar" replace />} />
              {/* Total control — admins only */}
              <Route path="ops/moderation" element={<ProtectedRoute requireStaff><ModerationPage /></ProtectedRoute>} />
              <Route path="ops/lookups" element={<ProtectedRoute requireStaff><LookupReviewPage /></ProtectedRoute>} />
              <Route path="ops/support" element={<ProtectedRoute requireStaff><SupportPage /></ProtectedRoute>} />
              <Route path="ops/oversight" element={<ProtectedRoute requireStaff><OversightPage /></ProtectedRoute>} />
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
              <Route path="ops/lessons" element={<ProtectedRoute requireStaff><LessonsHubPage /></ProtectedRoute>} />
              <Route path="ops/lessons/packages" element={<ProtectedRoute requireStaff><LessonPackagesPage /></ProtectedRoute>} />
              <Route path="ops/lessons/credits" element={<ProtectedRoute requireStaff><LessonCreditsPage /></ProtectedRoute>} />
              <Route path="ops/lessons/sessions" element={<ProtectedRoute requireStaff><SessionsPage /></ProtectedRoute>} />
              <Route path="ops/records" element={<ProtectedRoute requireStaff><RecordsHubPage /></ProtectedRoute>} />
              <Route path="ops/records/horses/:horseId/parties" element={<ProtectedRoute requireStaff><HorsePartiesPage /></ProtectedRoute>} />
              <Route path="ops/records/horses/:horseId/health" element={<ProtectedRoute requireStaff><HorseHealthPage /></ProtectedRoute>} />
              <Route path="ops/employees" element={<ProtectedRoute requireStaff><EmployeesHubPage /></ProtectedRoute>} />
              <Route path="ops/employees/staff" element={<ProtectedRoute requireStaff><StaffPage /></ProtectedRoute>} />
              <Route path="ops/employees/schedule" element={<ProtectedRoute requireStaff><SchedulePage /></ProtectedRoute>} />
              {/* Ops admin + superadmin (superadmin pages self-hide behind isSuperAdmin) */}
              <Route path="ops/admin/modules" element={<ProtectedRoute requireSuperAdmin><AdminModulesPage /></ProtectedRoute>} />
              <Route path="ops/admin/registry" element={<ProtectedRoute requireSuperAdmin><AdminRegistryPage /></ProtectedRoute>} />
              <Route path="ops/admin/branding" element={<ProtectedRoute requireAdmin><AdminBrandingPage /></ProtectedRoute>} />
              <Route path="ops/admin/products" element={<ProtectedRoute requireAdmin><AdminProductsPage /></ProtectedRoute>} />
              <Route path="ops/admin/forms" element={<ProtectedRoute requireAdmin><AdminFormsPage /></ProtectedRoute>} />
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
