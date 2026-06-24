import { BrowserRouter, Routes, Route } from 'react-router-dom';
import type { ReactNode } from 'react';
import { CartProvider } from './contexts/CartContext';
import { AuthProvider } from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/layout/Layout';
import AppLayout from './components/app/AppLayout';
import Landing from './pages/Landing';
import About from './pages/About';
import RiderEntrance from './pages/RiderEntrance';
import Contact from './pages/Contact';
import Lessons from './pages/Lessons';
import MembershipFunnel from './pages/MembershipFunnel';
import Gift from './pages/Gift';
import Redeem from './pages/Redeem';
import BookRider from './pages/BookRider';
import BookHorse from './pages/BookHorse';
import BookSupport from './pages/BookSupport';
import Checkout from './pages/Checkout';
import Confirmation from './pages/Confirmation';
import NotFound from './pages/NotFound';
import Login from './pages/Login';
import Register from './pages/Register';
import Account from './pages/Account';
import OrderDetail from './pages/OrderDetail';
// Member app
import Dashboard from './pages/app/Dashboard';
import Profile from './pages/app/Profile';
import Schedule from './pages/app/Schedule';
import Membership from './pages/app/Membership';
import Orders from './pages/app/Orders';
import Documents from './pages/app/Documents';
import Members from './pages/app/Members';
import Chat from './pages/app/Chat';
import Threads from './pages/app/Threads';
import ThreadDetail from './pages/app/ThreadDetail';
import Messages from './pages/app/Messages';
import Content from './pages/app/Content';
import ContentPostDetail from './pages/app/ContentPostDetail';
import Admin from './pages/app/Admin';

export function AppRoutes() {
  return (
    <AuthProvider>
      <CartProvider>
        <Routes>
            {/* Public marketing + inquiry (marketing chrome) */}
            <Route element={<Layout />}>
              <Route path="/" element={<Landing />} />
              <Route path="/about" element={<About />} />
              <Route path="/contact" element={<Contact />} />
              {/* Rider entrance — what "Come ride with us" opens into */}
              <Route path="/ride" element={<RiderEntrance />} />
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

              {/* Signed-in but outside the member app */}
              <Route path="/account" element={<ProtectedRoute><Account /></ProtectedRoute>} />
              <Route path="/order/:id" element={<ProtectedRoute><OrderDetail /></ProtectedRoute>} />
            </Route>

            {/* Gift reveal — full-screen immersive, no site chrome */}
            <Route path="/redeem" element={<Redeem />} />

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
              <Route path="orders" element={<Orders />} />
              <Route path="membership" element={<Membership />} />
              <Route path="profile" element={<Profile />} />
              {/* Admin (additionally requires admin) */}
              <Route path="admin" element={<ProtectedRoute requireAdmin><Admin /></ProtectedRoute>} />
            </Route>

            {/* Branded 404 */}
            <Route element={<Layout />}>
              <Route path="*" element={<NotFound />} />
            </Route>
        </Routes>
      </CartProvider>
    </AuthProvider>
  );
}

/** Browser entry: client-side router. */
export default function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  );
}

/** Server entry helper: lets the prerender wrap routes in a StaticRouter. */
export function AppWithRouter({ router }: { router: (children: ReactNode) => ReactNode }) {
  return router(<AppRoutes />);
}
