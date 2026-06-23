# French Heritage Equestrian

A fully-featured production-grade equestrian business website for French Heritage Equestrian, a family-owned and operated equestrian business located at Carmel Creek Ranch in San Diego, CA.

---

## Overview

French Heritage Equestrian offers three lines of service, each with its own booking funnel, smart cross-sell logic, and tailored add-on recommendations:

1. **Rider Services** — Horseback riding lessons, hunter jumper training, horsemanship classes
2. **Horse Services** — Hands-on horse training, riding & turnout, hair clipping
3. **Rider Support** — Horse locator, pre-purchase/lease evaluations, purchase/lease brokering

---

## Pages

| Route | Page | Description |
|---|---|---|
| `/` | Landing | Hero, three service pillars, location/atmosphere, CTA |
| `/about` | About | Facility overview, our story, guiding principles, philosophy |
| `/services` | Services Overview | Choose your service path |
| `/book/rider` | Rider Booking Funnel | Multi-step: select lessons/training → qualifier questions → smart add-ons |
| `/book/horse` | Horse Booking Funnel | Multi-step: select horse care → reason/duration → smart add-ons |
| `/book/support` | Support Booking Funnel | Multi-step: select acquisition services → experience/intent → smart add-ons |
| `/checkout` | Checkout | Order review + contact form → Supabase submission |
| `/confirmation` | Confirmation | Booking received confirmation page |

---

## Smart Add-On Logic

The purchasing funnel uses qualifier answers to present only contextually relevant add-ons:

### Rider Funnel (`/book/rider`)
- Presents: riding lessons, hunter jumper training, horsemanship classes
- Qualifies: does user own/lease a horse?
  - **Yes** → shows horse training cross-sell (not clipping)
  - **No / school horses** → qualifies interest in buying/leasing → shows rider support link
- Never shows: hair clipping

### Horse Funnel (`/book/horse`)
- Presents: horse training, riding & turnout, hair clipping
- Qualifies: reason (traveling, injured, regular care, etc.) + duration
  - **Traveling / injured** → adds lease brokering suggestion, clipping
  - **Turnout only** → suggests training add-on
- Never shows: riding lessons

### Support Funnel (`/book/support`)
- Presents: horse locator, evaluation, brokering
- Qualifies: experience level, how many horses, interest in lessons
  - **First horse / returning** → shows training, turnout, and clipping
  - **Interested in lessons** → shows rider services link
  - **Not interested in lessons** → no lessons cross-sell shown

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18 + TypeScript + Vite |
| Styling | Tailwind CSS v3 (custom brand tokens) |
| Routing | React Router v6 |
| Backend / Database | Supabase (PostgreSQL) |
| Icons | Lucide React |
| Photography | Pexels (real equestrian photography) |

---

## Brand

- **Company Font:** Big Caslon → Cormorant Garamond (web fallback)
- **Body Font:** Inter
- **Brand Green:** `#143321`
- **Brand Gold:** `#BA9935`
- **Cream Background:** `#faf8f4`
- **Target Demographic:** Mid-career professional women; equestrian hobbyists, lifelong enthusiasts

---

## Database Schema

### `bookings`
Stores booking requests from the purchasing funnel. No auth required — open write, no read for anon.

| Column | Type | Description |
|---|---|---|
| `id` | uuid | Primary key |
| `created_at` | timestamptz | Submission timestamp |
| `first_name` | text | Customer first name |
| `last_name` | text | Customer last name (optional) |
| `email` | text | Contact email |
| `phone` | text | Contact phone |
| `funnel_type` | text | `rider` / `horse` / `support` |
| `selected_services` | jsonb | Array of selected service tiers |
| `qualifier_answers` | jsonb | Map of funnel qualifier answers |
| `subtotal` | numeric | Estimated total |
| `notes` | text | Optional customer notes |
| `status` | text | `pending` / `confirmed` / `cancelled` |

### `inquiries`
Stores general contact form submissions.

| Column | Type | Description |
|---|---|---|
| `id` | uuid | Primary key |
| `first_name` / `last_name` | text | Submitter name |
| `email` / `phone` | text | Contact details |
| `message` | text | Free-text inquiry |
| `replied` | boolean | Internal reply tracking flag |

---

## Project Structure

```
src/
├── components/
│   └── layout/
│       ├── Header.tsx     # Fixed nav, transparent on hero, solid on scroll
│       ├── Footer.tsx     # Three-column footer with nav + contact
│       └── Layout.tsx     # Outlet wrapper
├── contexts/
│   └── CartContext.tsx    # Cart state, funnel type, qualifier answers
├── lib/
│   ├── supabase.ts        # Supabase client + typed helpers
│   └── services.ts        # Service catalog with pricing tiers
├── pages/
│   ├── Landing.tsx        # Landing page
│   ├── About.tsx          # About page
│   ├── Services.tsx       # Service path chooser
│   ├── BookRider.tsx      # Rider booking funnel
│   ├── BookHorse.tsx      # Horse booking funnel
│   ├── BookSupport.tsx    # Rider support funnel
│   ├── Checkout.tsx       # Checkout + Supabase submission
│   └── Confirmation.tsx   # Post-submission confirmation
├── App.tsx                # Router + CartProvider
├── index.css              # Global styles, Tailwind, Google Fonts
└── main.tsx               # Entry point
```

---

## Facility

**Carmel Creek Ranch**
San Diego, CA
2.5 miles from Torrey Pines Beach

Fully licensed and insured equestrian business. Stables situated along beautiful walking trails with direct access to San Diego's finest hiking trailheads. Soothing ocean breeze year-round.
