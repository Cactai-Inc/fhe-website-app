-- BOOKWRITE follow-on — making the purchase link real armed a delete cascade.
--
-- bookings.purchase_id was ON DELETE CASCADE. It is the ONLY relational foreign
-- key on bookings that is not SET NULL:
--
--   account_contact_id · account_user_id · contract_id · credit_id · horse_id
--   instructor_user_id · location_id · offering_id · request_id   → SET NULL
--   client_id                                                     → RESTRICT
--   purchase_id                                                   → CASCADE  ← odd one out
--
-- That was harmless for as long as no booking had ever carried a purchase_id:
-- the cascade could never fire. The BOOKWRITE writers now populate it on every
-- lesson and care booking that has an order behind it, so from here on deleting
-- a purchase would silently delete the calendar history that fulfilled it —
-- including completed lessons that actually happened.
--
-- This database has already lost roughly 71 purchases to hard deletes (the
-- display-code sequence reached PUR-000059 with 2 rows surviving, and 6
-- fulfillment units still point at purchase ids that no longer exist). Had
-- bookings carried purchase_id at the time, that same event would have taken
-- real bookings with it.
--
-- Evidence is retained, not cascaded away (D11: nothing is purged; accounts are
-- archived and their records stay visible to the other people who need them).
-- A booking is a record of time that was held and often delivered; it does not
-- stop being true because the order row was removed. Losing the link is
-- acceptable. Losing the booking is not.
--
-- Deletes nothing and repairs no row: this only changes what a FUTURE purchase
-- delete does. fulfillment_units.purchase_id keeps its CASCADE, which is correct
-- — a unit is derived from a purchase_item and has no meaning without it.

ALTER TABLE public.bookings
  DROP CONSTRAINT IF EXISTS bookings_purchase_id_fkey;

ALTER TABLE public.bookings
  ADD CONSTRAINT bookings_purchase_id_fkey
  FOREIGN KEY (purchase_id) REFERENCES public.purchases(id) ON DELETE SET NULL;
