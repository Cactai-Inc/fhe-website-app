/*
# French Heritage Equestrian — Bookings & Inquiries Schema

## Summary
Creates two tables to support the website's purchasing funnel and contact form.

## New Tables

### 1. `bookings`
Stores completed booking requests submitted through the three-path purchasing funnel.
- `id` — UUID primary key
- `created_at` — Timestamp of submission
- `first_name` / `last_name` — Customer name (last_name optional)
- `email` — Contact email (required)
- `phone` — Contact phone (required)
- `funnel_type` — Which service path: 'rider' | 'horse' | 'support'
- `selected_services` — JSONB array of services, tiers, quantities, and prices
- `qualifier_answers` — JSONB map of funnel qualifier question answers
- `subtotal` — Numeric total before tax
- `notes` — Optional free-text notes from customer
- `status` — Booking status: 'pending' | 'confirmed' | 'cancelled'

### 2. `inquiries`
Stores general contact form submissions from the site.
- `id` — UUID primary key
- `created_at` — Timestamp of submission
- `first_name` / `last_name` — Submitter name (last_name optional)
- `email` — Contact email (required)
- `phone` — Optional phone number
- `message` — Free-text inquiry message (required)
- `replied` — Boolean flag for internal tracking of whether staff has replied

## Security
- RLS enabled on both tables.
- Anonymous (unauthenticated) users can INSERT only — they cannot read, update, or delete their own or others' submissions (intentionally restrictive; staff reads via Supabase dashboard with service role).
- No user_id: this is a public-facing contact/booking form, no auth required.
*/

-- ============================================================
-- bookings
-- ============================================================
CREATE TABLE IF NOT EXISTS bookings (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at    timestamptz NOT NULL DEFAULT now(),
  first_name    text NOT NULL,
  last_name     text,
  email         text NOT NULL,
  phone         text NOT NULL,
  funnel_type   text NOT NULL CHECK (funnel_type IN ('rider', 'horse', 'support')),
  selected_services jsonb NOT NULL DEFAULT '[]',
  qualifier_answers jsonb NOT NULL DEFAULT '{}',
  subtotal      numeric(10, 2) NOT NULL DEFAULT 0,
  notes         text,
  status        text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'cancelled'))
);

ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_insert_bookings" ON bookings;
CREATE POLICY "anon_insert_bookings" ON bookings
  FOR INSERT TO anon, authenticated
  WITH CHECK (true);

-- ============================================================
-- inquiries
-- ============================================================
CREATE TABLE IF NOT EXISTS inquiries (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at  timestamptz NOT NULL DEFAULT now(),
  first_name  text NOT NULL,
  last_name   text,
  email       text NOT NULL,
  phone       text,
  message     text NOT NULL,
  replied     boolean NOT NULL DEFAULT false
);

ALTER TABLE inquiries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_insert_inquiries" ON inquiries;
CREATE POLICY "anon_insert_inquiries" ON inquiries
  FOR INSERT TO anon, authenticated
  WITH CHECK (true);

-- ============================================================
-- Indexes for admin reporting
-- ============================================================
CREATE INDEX IF NOT EXISTS bookings_created_at_idx ON bookings (created_at DESC);
CREATE INDEX IF NOT EXISTS bookings_status_idx ON bookings (status);
CREATE INDEX IF NOT EXISTS bookings_funnel_type_idx ON bookings (funnel_type);
CREATE INDEX IF NOT EXISTS inquiries_created_at_idx ON inquiries (created_at DESC);
CREATE INDEX IF NOT EXISTS inquiries_replied_idx ON inquiries (replied);
