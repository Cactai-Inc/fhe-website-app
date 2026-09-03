# TASK-SIGNFLOW-H — VERIFICATION (ORCH, 2026-09-03)
**Verdict: VERIFIED AND MERGED** (57cf8098). **Re-checked in production by ORCH:** the composer body
carries the `v_has_sig` exemption; `proacl` unchanged (no anon); zero unsigned bodies currently
render "Signature: ."; the live lease body is untouched (md5 unchanged) and recomposes on its next
normal open — exactly the constraint CR-101·A1 set. The thread's rolled-back dry-run shows all four
signature-block lines ending at the token while ordinary token lines keep their period.
**Two deviations, both accepted:** migration dated 09-03 (day of writing); a second anchor guard
(exactly-once) added to the in-place-rewrite idiom — an improvement, recorded.
**Owed:** `test/db` snapshot regeneration (the new assertion is RED until then — TESTREPAIR-shaped,
queued with CLNR-REPO-STATE). **Owner:** open the Pamela lease once; the four lines drop their period
by the normal path.
