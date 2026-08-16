/* /sign — TASK ONBOARD §1. The front door of the one signup spine.
 *
 * Owner: "the /sign url opens to a page with options for what a person is signing
 * for. they pick the right one (based on what we tell them)."
 *
 * Until now /sign did not exist at all — only the four deep links /sign/guest,
 * /sign/rider, /sign/horse and /sign/rider+horse, which nothing on the site linked
 * to. This is the page that makes them reachable, and every option is described in
 * terms of what the person is about to DO, so they can self-identify without
 * knowing our vocabulary.
 *
 * The deep links keep working and skip this page entirely.
 *
 * THE FIFTH OPTION IS NOT A FUNNEL. The first four map to standing categories that
 * carry a document set (category_document_requirements holds Guest, Rider and Horse
 * owner — verified, 12 rows) and provision a new client. `deal` does the opposite:
 * the contract already exists and the person is already a party to it; what they
 * lack is an ACCOUNT, without which the document is unreachable. So `deal` CLAIMS —
 * it matches their email to an accountless document party and mints the same
 * CONTRACT invitation staff issue from the contract page, which on activation
 * creates the account and lands them on their document in one flow (§1b).
 */
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import Seo from '../components/Seo';
import { useDocumentTitle } from '../lib/hooks';

interface Choice {
  to: string;
  eyebrow: string;
  title: string;
  /** What this person is signing for, in their words rather than ours. */
  body: string;
  /** The concrete test that tells them this is the right row. */
  pick: string;
}

const CHOICES: Choice[] = [
  {
    to: '/sign/guest',
    eyebrow: 'Visiting',
    title: 'I’m coming to visit',
    body:
      'Watching a lesson, meeting a horse, coming along with someone who rides, or just ' +
      'coming to see the property.',
    pick: 'Pick this if you won’t be riding or handling a horse.',
  },
  {
    to: '/sign/rider',
    eyebrow: 'Riding',
    title: 'I’m here to ride',
    body: 'Lessons and riding time on our horses.',
    pick: 'Pick this if you’ll ride, and the horse is ours.',
  },
  {
    to: '/sign/rider+horse',
    eyebrow: 'Riding · your horse',
    title: 'I’m here to ride, and I have my own horse',
    body: 'Lessons on your own horse, and care services for that horse.',
    pick: 'Pick this if you’ll ride AND your horse will be with us.',
  },
  {
    to: '/sign/horse',
    eyebrow: 'Horse care',
    title: 'My horse needs care',
    body:
      'Boarding, handling, exercise and everyday care for your horse — whether or not ' +
      'you ride here yourself.',
    pick: 'Pick this if this is about your horse and not about you riding.',
  },
  {
    to: '/sign/deal',
    eyebrow: 'A deal with us',
    title: 'I have a contract with you to sign',
    body:
      'A purchase, a sale or a lease that’s already been drawn up — and you need to get ' +
      'to it. We’ll match your email to your contract and set up your account at the ' +
      'same time.',
    pick: 'Pick this if we’ve told you a contract is waiting for you.',
  },
];

export default function SignChoose() {
  useDocumentTitle('Get started');

  return (
    <>
      <Seo
        title="Get started"
        description="Tell us what brings you to French Heritage Equestrian and we’ll set up your account and paperwork."
        path="/sign"
      />
      <section className="bg-cream pt-32 pb-10">
        <div className="container-site max-w-2xl text-center">
          <p className="eyebrow mb-4">Get started</p>
          <h1 className="heading-display text-green-800 text-[clamp(2rem,4.5vw,3.25rem)]">
            What brings you to us?
          </h1>
          <p className="body-text text-secondary mt-4">
            Pick the one that fits. It decides which paperwork we prepare for you — you can
            always add more later, and nothing here is final.
          </p>
        </div>
      </section>

      <section className="bg-cream-50 pb-20">
        <div className="container-site max-w-2xl">
          <ul className="flex flex-col gap-3">
            {CHOICES.map((c) => (
              <li key={c.to}>
                <Link
                  to={c.to}
                  className="group block bg-white border border-green-800/10 p-6 hover:border-green-800/40 focus-ring transition-colors"
                >
                  <p className="eyebrow mb-1.5">{c.eyebrow}</p>
                  <p className="font-serif text-green-800 text-xl leading-tight">{c.title}</p>
                  <p className="body-text text-sm text-secondary mt-2">{c.body}</p>
                  <p className="text-sm text-green-900/70 mt-2">{c.pick}</p>
                  <span className="inline-flex items-center gap-1.5 mt-4 text-[11px] tracking-wide uppercase font-medium text-green-800">
                    Continue <ArrowRight size={14} aria-hidden="true" />
                  </span>
                </Link>
              </li>
            ))}
          </ul>

          <p className="body-text text-sm text-muted text-center mt-8">
            Not sure? <Link to="/contact" className="text-green-800 underline">Ask us</Link> and
            we’ll point you at the right one.
          </p>
        </div>
      </section>
    </>
  );
}
