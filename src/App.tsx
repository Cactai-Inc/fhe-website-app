import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import type { ReactNode } from 'react';
import { CartProvider } from './contexts/CartContext';
import { AuthProvider } from './contexts/AuthContext';
import { BrandProvider } from './contexts/BrandProvider';
import ProtectedRoute from './components/ProtectedRoute';
import ScrollToTop from './components/ScrollToTop';
import Layout from './components/layout/Layout';
import AppLayout from './components/app/AppLayout';
import Landing from './pages/Landing';
import About from './pages/About';
import Services from './pages/Services';
import Contact from './pages/Contact';
import Lessons from './pages/Lessons';
import MembershipFunnel from './pages/MembershipFunnel';
import Gift from './pages/Gift';
import Redeem from './pages/Redeem';
import Inquire from './pages/Inquire';
import Release from './pages/Release';
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
import Dashboard from './pages/app/Dashboard';
import Profile from './pages/app/Profile';
import Schedule from './pages/app/Schedule';
import Membership from './pages/app/Membership';
import Orders from './pages/app/Orders';
import Documents from './pages/app/Documents';
import Onboarding from './pages/app/Onboarding';
import BookMore from './pages/app/BookMore';
// Client portal (CP-* wave)
import MyEngagements from './pages/app/MyEngagements';
import MyEngagementDetail from './pages/app/MyEngagementDetail';
import MyBalance from './pages/app/MyBalance';
import MyLessons from './pages/app/MyLessons';
import MyBrokerage from './pages/app/MyBrokerage';
import MyBoarding from './pages/app/MyBoarding';
import Members from './pages/app/Members';
import Chat from './pages/app/Chat';
import Threads from './pages/app/Threads';
import ThreadDetail from './pages/app/ThreadDetail';
import Messages from './pages/app/Messages';
import Content from './pages/app/Content';
import ContentPostDetail from './pages/app/ContentPostDetail';
import Admin from './pages/app/Admin';
// Ops / CRM (staff/admin)
import OpsDashboard from './pages/app/ops/OpsDashboard';
import ContactsPage from './pages/app/ops/ContactsPage';
import HorsesPage from './pages/app/ops/HorsesPage';
import EngagementsPage from './pages/app/ops/EngagementsPage';
import CreateEngagementPage from './pages/app/ops/CreateEngagementPage';
import EngagementDetailPage from './pages/app/ops/EngagementDetailPage';
import DocumentsQueuePage from './pages/app/ops/DocumentsQueuePage';
import DocumentViewerPage from './pages/app/ops/DocumentViewerPage';
import TransactionsPage from './pages/app/ops/TransactionsPage';
import TransactionDetailPage from './pages/app/ops/TransactionDetailPage';
// Ops / CRM — Wave-7 (intake, payments review, module hubs + module pages)
import IntakePage from './pages/app/ops/IntakePage';
import AvailabilityPage from './pages/app/ops/AvailabilityPage';
import PaymentReviewPage from './pages/app/ops/PaymentReviewPage';
import BrokerageHubPage from './pages/app/ops/hubs/BrokerageHubPage';
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

export function AppRoutes() {
  return (
    <AuthProvider>
      <BrandProvider>
        <CartProvider>
          <Routes>
            {/* Public marketing + inquiry (marketing chrome) */}
            <Route element={<Layout />}>
              <Route path="/" element={<Landing />} />
              <Route path="/about" element={<About />} />
              <Route path="/services" element={<Services />} />
              <Route path="/contact" element={<Contact />} />
              {/* Old rider-entrance interstitial — folded into the linear
                  funnel; legacy links land straight on the lessons page. */}
              <Route path="/ride" element={<Navigate to="/lessons" replace />} />
              {/* Self-contained funnels, each its own page */}
              <Route path="/lessons" element={<Lessons />} />
              <Route path="/membership" element={<MembershipFunnel />} />
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
              <Route path="/register" element={<Register />} />
              <Route path="/register/complete" element={<RegisterComplete />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/reset-password" element={<ResetPassword />} />

              {/* Signed-in but outside the member app */}
              <Route path="/account" element={<ProtectedRoute><Account /></ProtectedRoute>} />
              <Route path="/order/:id" element={<ProtectedRoute><OrderDetail /></ProtectedRoute>} />
            </Route>

            {/* Gift reveal — full-screen immersive, no site chrome */}
            <Route path="/redeem" element={<Redeem />} />
            <Route path="/inquire" element={<Inquire />} />
            <Route path="/release" element={<Release />} />
            <Route path="/release/:releaseKey" element={<Release />} />

            {/* Member community app (its own chrome, member-gated) */}
            <Route
              path="/app"
              element={
                <ProtectedRoute requireMember>
                  <AppLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<Dashboard />} />
              <Route path="schedule" element={<Schedule />} />
              <Route path="chat" element={<Chat />} />
              <Route path="threads" element={<Threads />} />
              <Route path="threads/:id" element={<ThreadDetail />} />
              <Route path="messages" element={<Messages />} />
              <Route path="messages/:userId" element={<Messages />} />
              <Route path="members" element={<Members />} />
              <Route path="content" element={<Content />} />
              <Route path="content/:slug" element={<ContentPostDetail />} />
              <Route path="documents" element={<Documents />} />
              {/* Rider onboarding (provisioned invite → details → sign → confirmation) */}
              <Route path="onboarding" element={<Onboarding />} />
              {/* Flow D — returning member books more (BOOKING_FLOWS_PLAN §2 Flow D) */}
              <Route path="book" element={<BookMore />} />
              <Route path="orders" element={<Orders />} />
              {/* Client portal (CP-*) */}
              <Route path="engagements" element={<MyEngagements />} />
              <Route path="engagements/:id" element={<MyEngagementDetail />} />
              <Route path="balance" element={<MyBalance />} />
              <Route path="lessons" element={<MyLessons />} />
              <Route path="brokerage" element={<MyBrokerage />} />
              <Route path="boarding" element={<MyBoarding />} />
              <Route path="membership" element={<Membership />} />
              <Route path="profile" element={<Profile />} />
              {/* Admin (additionally requires admin) */}
              <Route path="admin" element={<ProtectedRoute requireAdmin><Admin /></ProtectedRoute>} />

              {/* Ops / CRM (staff — gated to admin for launch) */}
              <Route path="ops" element={<ProtectedRoute requireAdmin><OpsDashboard /></ProtectedRoute>} />
              <Route path="ops/contacts" element={<ProtectedRoute requireAdmin><ContactsPage /></ProtectedRoute>} />
              <Route path="ops/horses" element={<ProtectedRoute requireAdmin><HorsesPage /></ProtectedRoute>} />
              <Route path="ops/engagements" element={<ProtectedRoute requireAdmin><EngagementsPage /></ProtectedRoute>} />
              <Route path="ops/engagements/new" element={<ProtectedRoute requireAdmin><CreateEngagementPage /></ProtectedRoute>} />
              <Route path="ops/engagements/:id" element={<ProtectedRoute requireAdmin><EngagementDetailPage /></ProtectedRoute>} />
              <Route path="ops/documents" element={<ProtectedRoute requireAdmin><DocumentsQueuePage /></ProtectedRoute>} />
              <Route path="ops/documents/:id" element={<ProtectedRoute requireAdmin><DocumentViewerPage /></ProtectedRoute>} />
              <Route path="ops/transactions" element={<ProtectedRoute requireAdmin><TransactionsPage /></ProtectedRoute>} />
              <Route path="ops/transactions/:id" element={<ProtectedRoute requireAdmin><TransactionDetailPage /></ProtectedRoute>} />
              {/* Wave-7: intake + payments review (core) */}
              <Route path="ops/intake" element={<ProtectedRoute requireAdmin><IntakePage /></ProtectedRoute>} />
              <Route path="ops/availability" element={<ProtectedRoute requireAdmin><AvailabilityPage /></ProtectedRoute>} />
              <Route path="ops/payments/review" element={<ProtectedRoute requireAdmin><PaymentReviewPage /></ProtectedRoute>} />
              {/* Wave-7: module hubs + module pages (module-gated inside via ModuleGate) */}
              <Route path="ops/brokerage" element={<ProtectedRoute requireAdmin><BrokerageHubPage /></ProtectedRoute>} />
              <Route path="ops/boarding" element={<ProtectedRoute requireAdmin><BoardingHubPage /></ProtectedRoute>} />
              <Route path="ops/boarding/facilities" element={<ProtectedRoute requireAdmin><FacilitiesPage /></ProtectedRoute>} />
              <Route path="ops/boarding/agreements" element={<ProtectedRoute requireAdmin><BoardAgreementsPage /></ProtectedRoute>} />
              <Route path="ops/boarding/charges" element={<ProtectedRoute requireAdmin><BoardChargesPage /></ProtectedRoute>} />
              <Route path="ops/barnops" element={<ProtectedRoute requireAdmin><BarnopsHubPage /></ProtectedRoute>} />
              <Route path="ops/barnops/resources" element={<ProtectedRoute requireAdmin><ResourcesPage /></ProtectedRoute>} />
              <Route path="ops/barnops/consumption" element={<ProtectedRoute requireAdmin><ConsumptionLogPage /></ProtectedRoute>} />
              <Route path="ops/barnops/allocation-rules" element={<ProtectedRoute requireAdmin><AllocationRulesPage /></ProtectedRoute>} />
              <Route path="ops/lessons" element={<ProtectedRoute requireAdmin><LessonsHubPage /></ProtectedRoute>} />
              <Route path="ops/lessons/packages" element={<ProtectedRoute requireAdmin><LessonPackagesPage /></ProtectedRoute>} />
              <Route path="ops/lessons/credits" element={<ProtectedRoute requireAdmin><LessonCreditsPage /></ProtectedRoute>} />
              <Route path="ops/records" element={<ProtectedRoute requireAdmin><RecordsHubPage /></ProtectedRoute>} />
              <Route path="ops/records/horses/:horseId/parties" element={<ProtectedRoute requireAdmin><HorsePartiesPage /></ProtectedRoute>} />
              <Route path="ops/records/horses/:horseId/health" element={<ProtectedRoute requireAdmin><HorseHealthPage /></ProtectedRoute>} />
              <Route path="ops/employees" element={<ProtectedRoute requireAdmin><EmployeesHubPage /></ProtectedRoute>} />
              <Route path="ops/employees/staff" element={<ProtectedRoute requireAdmin><StaffPage /></ProtectedRoute>} />
              <Route path="ops/employees/schedule" element={<ProtectedRoute requireAdmin><SchedulePage /></ProtectedRoute>} />
              {/* Ops admin + superadmin (superadmin pages self-hide behind isSuperAdmin) */}
              <Route path="ops/admin/modules" element={<ProtectedRoute requireAdmin><AdminModulesPage /></ProtectedRoute>} />
              <Route path="ops/admin/registry" element={<ProtectedRoute requireAdmin><AdminRegistryPage /></ProtectedRoute>} />
              <Route path="ops/admin/branding" element={<ProtectedRoute requireAdmin><AdminBrandingPage /></ProtectedRoute>} />
              <Route path="ops/admin/products" element={<ProtectedRoute requireAdmin><AdminProductsPage /></ProtectedRoute>} />
              <Route path="ops/superadmin/provision" element={<ProtectedRoute requireAdmin><ProvisionTenantPage /></ProtectedRoute>} />
              <Route path="ops/superadmin/organizations" element={<ProtectedRoute requireAdmin><OrganizationsPage /></ProtectedRoute>} />
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
