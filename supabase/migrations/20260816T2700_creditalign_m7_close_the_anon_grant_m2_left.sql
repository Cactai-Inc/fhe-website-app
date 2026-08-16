-- TASK CREDITALIGN m7 — close the one anon grant m2 left open.
--
-- Verified with has_function_privilege('anon', …, 'execute') after applying m1-m6:
-- five of the six new functions are correctly false, and `_recurring_allotment` is
-- TRUE. Supabase installs a default EXECUTE grant to anon/authenticated on every new
-- function in `public`, so a function that says nothing about grants is anon-callable.
--
-- It is a pure arithmetic helper with no table access, so nothing leaks — but "anon
-- false on everything new" is the standing rule and an internal helper has no business
-- being reachable from an unauthenticated PostgREST call. REVOKE FROM PUBLIC would not
-- have done it: a direct grant to `anon` survives it, which is why the check is a
-- has_function_privilege() query and not a reading of the REVOKE lines.
REVOKE ALL ON FUNCTION public._recurring_allotment(integer, text, date, date, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public._recurring_allotment(integer, text, date, date, integer) FROM anon;
GRANT EXECUTE ON FUNCTION public._recurring_allotment(integer, text, date, date, integer) TO authenticated, service_role;
