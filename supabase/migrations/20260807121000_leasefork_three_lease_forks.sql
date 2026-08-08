/*
  # TASK LEASEFORK — Phase 2: the three lease forks

  Creates three byte-identical forks of HORSE_LEASE_V2 via
  clone_contract_template() (20260807120000). No content changes: the forks exist so
  that content work can happen on a fork without touching the template currently
  signing real leases.

    HORSE_LEASE_STANDARD  Horse Lease Agreement — Standard        (insurance gates land here)
    HORSE_LEASE_FULL      Horse Lease Agreement — Comprehensive
    HORSE_LEASE_SIMPLE    Horse Lease Agreement — Simple          (trimmed later, once specced)

  HORSE_LEASE_V2 is NOT modified, renamed, or deactivated. It keeps id
  2ccc055b-f6fc-4af3-b25d-4f74f8246643, stays active, and remains the default for
  start_lease_contract_v2. The 4 documents that reference it by template_id
  (one EXECUTED, two AWAITING_SIGNATURE — one of which is a live negotiation — and
  one VOID) are untouched: a clone mints a new id, so nothing re-points.

  Each fork inherits contract_kind = 'HORSE_LEASE', so all three appear to a picker
  that filters on kind + active + not-deleted. The retired flat `HORSE_LEASE`
  template also carries that kind but is active=false and soft-deleted
  (2026-08-02), so such a picker excludes it.

  NOT replay-safe by design: clone_contract_template refuses an existing target key,
  so re-running this file raises rather than duplicating. That is the intended
  behaviour, and matches the hand-maintained-journal convention in CLAUDE.md.

  Requires PGCLIENTENCODING=UTF8 — the titles contain em dashes.
*/

SELECT clone_contract_template('HORSE_LEASE_V2', 'HORSE_LEASE_STANDARD', 'Horse Lease Agreement — Standard');
SELECT clone_contract_template('HORSE_LEASE_V2', 'HORSE_LEASE_FULL',     'Horse Lease Agreement — Comprehensive');
SELECT clone_contract_template('HORSE_LEASE_V2', 'HORSE_LEASE_SIMPLE',   'Horse Lease Agreement — Simple');
