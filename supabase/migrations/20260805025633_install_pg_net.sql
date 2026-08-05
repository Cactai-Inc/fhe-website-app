-- Pin pg_net into migration history. It is already installed live (added
-- out-of-band between 2026-08-02 and 2026-08-04) but no migration recorded it,
-- so history and prod had diverged. This statement is a no-op against prod —
-- that is the point: idempotent alignment, not a live install.
create extension if not exists pg_net;
