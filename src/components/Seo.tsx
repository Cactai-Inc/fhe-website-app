import { Helmet } from 'react-helmet-async';
import { SITE_URL, BUSINESS } from '../lib/seo';

interface SeoProps {
  title: string;
  description: string;
  path: string;          // canonical path, e.g. "/about"
  noindex?: boolean;
  image?: string;
  /**
   * What the LINK PREVIEW says, when that should differ from the search-result
   * description. Sets og:description + twitter:description only; the `<meta
   * name="description">` a search engine reads is untouched.
   *
   * They are separated because they are read by different people in different
   * moods. A meta description is scanned in a list of ten results and has to
   * carry the keywords that got it there. An unfurl card — Slack, iMessage,
   * WhatsApp, LinkedIn, a Notion hover, a Safari preview — is read by one person
   * who has already been handed the link by someone they know, and there the
   * keywords are noise and a human sentence lands.
   *
   * Defaults to `description`, so every page that does not pass it behaves
   * exactly as it did before.
   */
  socialDescription?: string;
  /** Optional Service schema for a service page. */
  service?: string;
  /** Extra JSON-LD objects to include (e.g. BreadcrumbList). */
  jsonLd?: object[];
}

/**
 * Per-page <head>: title, description, canonical, OpenGraph/Twitter, robots,
 * and JSON-LD. Renders in both SSR (prerender) and the client via Helmet.
 */
export default function Seo({
  title, description, path, noindex, image, service, socialDescription, jsonLd = [],
}: SeoProps) {
  const canonical = `${SITE_URL}${path === '/' ? '' : path}`;
  const ogImage = image || BUSINESS.image;
  const social = socialDescription ?? description;

  const graphs: object[] = [...jsonLd];
  if (service) {
    graphs.push({
      '@context': 'https://schema.org',
      '@type': 'Service',
      name: service,
      provider: { '@type': 'LocalBusiness', name: BUSINESS.name, '@id': `${SITE_URL}/#business` },
      areaServed: BUSINESS.areaServed.map((a) => ({ '@type': 'City', name: a })),
      url: canonical,
      description,
    });
  }

  return (
    <Helmet>
      <title>{title}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={canonical} />
      {noindex ? (
        <meta name="robots" content="noindex,nofollow" />
      ) : (
        <meta name="robots" content="index,follow" />
      )}

      {/* OpenGraph */}
      <meta property="og:type" content="website" />
      <meta property="og:site_name" content={BUSINESS.name} />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={social} />
      <meta property="og:url" content={canonical} />
      <meta property="og:image" content={ogImage} />

      {/* Twitter */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={social} />
      <meta name="twitter:image" content={ogImage} />

      {graphs.map((g, i) => (
        <script key={i} type="application/ld+json">{JSON.stringify(g)}</script>
      ))}
    </Helmet>
  );
}
