/*
  # Add contact preference fields to bookings

  Adds the preferred contact method and free-text preferred times captured on the
  checkout/inquiry form. Both are nullable so existing rows remain valid.

  1. Changes
     - bookings.contact_method   text, one of 'text' | 'call' | 'email' (nullable)
     - bookings.preferred_times  text, free-text availability (nullable)
*/

ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS contact_method text
    CHECK (contact_method IN ('text', 'call', 'email')),
  ADD COLUMN IF NOT EXISTS preferred_times text;
