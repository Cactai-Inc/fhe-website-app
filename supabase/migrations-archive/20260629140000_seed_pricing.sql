/*
  # FHE CRM — Seed Pricing (migration 21)

  Owner-supplied commercial terms:
    - Brokerage commission: 15%, with a $500 minimum (whichever is greater) —
      applies to purchase and sale representation.
    - Lease fees: $250 full lease, $150 half lease (flat, not commission-based),
      so commission_lease_rate stays NULL.

  Adds the two lease-fee columns business_config lacked, then seeds the values
  (COALESCE-guarded — never clobbers an owner edit).
*/

ALTER TABLE business_config ADD COLUMN IF NOT EXISTS lease_full_fee numeric(12,2);  -- full lease, dollars
ALTER TABLE business_config ADD COLUMN IF NOT EXISTS lease_half_fee numeric(12,2);  -- half lease, dollars

UPDATE business_config SET
  commission_purchase_rate = COALESCE(commission_purchase_rate, 15),
  commission_sale_rate     = COALESCE(commission_sale_rate,     15),
  commission_min           = COALESCE(commission_min,           500),
  lease_full_fee           = COALESCE(lease_full_fee,           250),
  lease_half_fee           = COALESCE(lease_half_fee,           150);
