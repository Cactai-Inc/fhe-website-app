# Project Handoff — French Heritage Equestrian

Context snapshot so any new session (or another machine) can continue without
re-deriving. Pair this with the commit history (`git log`), `SETUP.md` (external
wiring) and `SETUP-REMOTE.md` (multi-device dev).

## What this is
A production platform for French Heritage Equestrian — a family-run hunter/jumper
barn + rider community in coastal San Diego (Carmel Creek Ranch). Two faces:
1. **Public marketing site** (stripped, emotional, lead-gen) — prerendered for SEO.
2. **Members community web-app** (`/app`) + **admin panel** (`/app/admin`).

## Stack
Vite + React 18 (SPA) · react-router v7 · Tailwind · Supabase (Postgres + RLS +
Auth + Realtime + Storage) · Vercel serverless functions in `/api` · prerender via
`react-dom/server` + `react-helmet-async` (scripts/prerender.mjs). **No Next.js.**

## Information architecture (current, post-redesign)
- `/` **Homepage = front door.** Stripped bare: landing video (poster until
  `/public/hero.mp4` added) + hero "California days were made for this" + "Come
  ride with us" invitation → `/ride` + two alt-service entries (→ `/horse`,
  `/acquisition`). Header: Contact + **Book a Lesson** CTA. **No sign-in in header.**
- `/ride` **Rider Entrance** = seed-planting journey: welcome hero + "Book a
  Lesson"/"Learn more" scroll + community/setting/foundation sections + split CTA
  (Book a Lesson / Membership). Content is a trimmed first pass — OWNER WANTS TO
  MASSAGE THIS COPY TOGETHER.
- `/lessons` = price/quantity catalog (single/5/10-pack + add-ons: evaluation+plan,
  horsemanship). Transactional. Leads to `/checkout`.
- `/membership` = features/benefits catalog (weekly/monthly plan cards + included
  extras + service discounts) ending in **request-to-join inquiry** (invite-only;
  recurring Stripe billing deferred).
- `/horse`, `/acquisition` = standalone funnels (reuse BookHorse/BookSupport).
- `/about` = SEO story page, linked from all funnels. `/contact` = contact form.
- `/gift` = buy-as-a-gift (any item). `/redeem?code=…` = full-screen gift reveal
  with placeholder animated "open" element (`components/gift/GiftReveal.tsx` — art
  is a drop-in swap). Gifting applies to almost everything, not just lessons.
- Footer holds the **discreet member sign-in** (invite-only).
- `/app/*` member app (gated to active membership): dashboard, profile, schedule,
  membership, orders, documents, members directory, real-time chat, threads, DMs,
  members-only content (articles + resource library). `/app/admin` (admin-gated):
  members mgmt, moderation, post announcements/events/content, **send invitations**.

## Backend (Supabase)
Migrations in `supabase/migrations/` (apply in order; see SETUP.md):
- platform: profiles, offerings/tiers, requests, invitations, availability_slots,
  orders/items, qualifier_answers, order_documents, bookings_v2, payments,
  payment_notifications. Helpers `is_admin()`, `owns_order()`, `validate_invitation()`.
- community: memberships, groups, announcements, channels+messages, threads+posts,
  direct_messages, content_posts/resources, events+rsvps, moderation. `is_active_member()`.
  Realtime publication on chat/DM/threads/announcements.
- gifts: `gifts` table + `open_gift()` / `redeem_gift()` RPCs + unlock_gate.
RLS on every table. `/api` functions: stripe-create-session, stripe-webhook,
zelle-reconcile, admin-send-invitation (+ `_lib/`).

## Placeholder / not-yet-wired (important)
- **Videos**: posters only. Drop `/public/{hero,ride,lessons,membership}.mp4` (+`.webm`).
- **Pricing/plans**: placeholders in `src/lib/catalog.ts` — owner to set real numbers.
- **Business address/geo** in `src/lib/seo.ts` (BUSINESS) is placeholder — set before launch.
- **Payments**: Stripe/Zelle code exists but keys/fulfillment not connected.
- **Gift fulfillment**: records + reveal flow built; real code-generation + payment
  on gift purchase not yet wired (currently logs a request). Gift reveal animation art = drop-in.
- **Membership billing**: request-to-join only; recurring Stripe subs deferred.
- Old `Services.tsx` / `BookRider.tsx` are unused by current routes (left in place).

## Verification status
typecheck (app + api) clean · lint 0 errors · build + prerender green. Pages
verified via headless screenshots (home, /ride, /lessons, /membership, /redeem).

## Open decisions / next steps
1. Massage `/ride` copy with owner.
2. Real lesson prices + membership plans/pricing.
3. Wire gift fulfillment (code gen + payment) and the reveal animation art.
4. Decide gift unlock gate: immediate booking vs. required intro call.
5. Real business address/geo + Google Business Profile for local SEO.
6. Connect Stripe + Zelle + email provider (see SETUP.md).
7. Recurring membership billing (later).

## Working agreement (learned)
- SHOW renders (headless screenshots) at each milestone — don't build blind.
- Confirm IA/scope before large builds; the owner course-corrects on specifics.
- Git author is `Cactai-Inc <admin@cactai.io>` (global + repo-local). Remote:
  github.com/Cactai-Inc/fhe-website-app.
