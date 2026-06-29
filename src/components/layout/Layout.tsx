import { Outlet } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import Header from './Header';
import Footer from './Footer';
import { SITE_URL, BUSINESS } from '../../lib/seo';

// Site-wide LocalBusiness + Organization structured data (anchored by @id so other
// schema can reference it). Appears on every public marketing page.
const ORG_JSONLD = {
  '@context': 'https://schema.org',
  '@type': ['LocalBusiness', 'SportsActivityLocation'],
  '@id': `${SITE_URL}/#business`,
  name: BUSINESS.name,
  legalName: BUSINESS.legalName,
  description: BUSINESS.description,
  url: SITE_URL,
  email: BUSINESS.email,
  telephone: BUSINESS.phone,
  image: BUSINESS.image,
  logo: BUSINESS.logo,
  priceRange: BUSINESS.priceRange,
  address: {
    '@type': 'PostalAddress',
    streetAddress: BUSINESS.streetAddress,
    addressLocality: BUSINESS.addressLocality,
    addressRegion: BUSINESS.addressRegion,
    postalCode: BUSINESS.postalCode,
    addressCountry: BUSINESS.addressCountry,
  },
  geo: { '@type': 'GeoCoordinates', latitude: BUSINESS.latitude, longitude: BUSINESS.longitude },
  areaServed: BUSINESS.areaServed.map((a) => ({ '@type': 'City', name: a })),
  ...(BUSINESS.sameAs.length ? { sameAs: BUSINESS.sameAs } : {}),
};

export default function Layout() {
  return (
    <div className="min-h-screen flex flex-col">
      <Helmet>
        <script type="application/ld+json">{JSON.stringify(ORG_JSONLD)}</script>
      </Helmet>
      <Header />
      <main className="flex-1">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}
