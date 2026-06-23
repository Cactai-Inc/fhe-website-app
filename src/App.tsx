import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { CartProvider } from './contexts/CartContext';
import Layout from './components/layout/Layout';
import Landing from './pages/Landing';
import About from './pages/About';
import Services from './pages/Services';
import BookRider from './pages/BookRider';
import BookHorse from './pages/BookHorse';
import BookSupport from './pages/BookSupport';
import Checkout from './pages/Checkout';
import Confirmation from './pages/Confirmation';

export default function App() {
  return (
    <BrowserRouter>
      <CartProvider>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<Landing />} />
            <Route path="/about" element={<About />} />
            <Route path="/services" element={<Services />} />
            <Route path="/book/rider" element={<BookRider />} />
            <Route path="/book/horse" element={<BookHorse />} />
            <Route path="/book/support" element={<BookSupport />} />
            <Route path="/checkout" element={<Checkout />} />
            <Route path="/confirmation" element={<Confirmation />} />
            {/* Fallback */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </CartProvider>
    </BrowserRouter>
  );
}
