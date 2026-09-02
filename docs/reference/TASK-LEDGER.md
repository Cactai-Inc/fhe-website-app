# TASK LEDGER — every task that has shipped, one line each

**Started 2026-09-01 by ORCH6, per `CR-96`.** ⚠️ **ORCH writes a line here at every merge, and a
`## VALIDATION` block into that task's own report. An audit that lives only in a merge commit message
or a chat reply is not the record.**

**Verdict vocabulary:** `MERGED` — claims verified, taken as reported · `MERGED, CORRECTED` — merged
with a change ORCH made or reversed, named in the report · `REVERTED` · `OPEN`.

| Task | Date | What changed | Verdict | Commit |
|---|---|---|---|---|
| `TASK-FIX4` | 2026-08-31 | input is never lost; 26 hand-rolled overlays → 1; closing never commits (D34); normalisation on blur; persisted drafts | **MERGED** — counts re-measured on both branches, `normalize_person_name` verified live, 12 failing UI tests identical before and after | `a9ffcdcd` |
| `TASK-FIX5` | 2026-09-01 | one type per folder; `docs/` root is folders only; 566 migrations archived; `DB-SCHEMA.md` + `DB-MAP.md` generated | ⚠️ **MERGED, CORRECTED** — step 8 reversed: the 56 red `test/db` files are back in the run. A green suite missing 72% of its files is a worse signal than an honest red one | `4d9a9351` + the revert |
| `TASK-BACKDATE` | 2026-09-01 | an order and a payment carry the date they really happened; settle from the staff record; backdated settlements send no receipt | **MERGED** — signatures, guard and ACLs verified in production | `71b49d6b` |
| `TASK-CR85` | 2026-09-01 | three nav sections, People dissolved into Community, `StaffNavItems` deleted | **MERGED** — drift did not increase; two spec errors corrected by the thread | `c171689e` |
| `TASK-MODAL2` | 2026-09-01 | no modal closes on click-out or Escape; one centre variant; save state beside the close icon; 16 back controls | **MERGED** — verified in source; the thread caught two contradictions in ORCH's spec | `4c06685d` |
| `TASK-REAPER` | 2026-09-01 | the hold reaper stops calling a function dropped seven weeks ago | **MERGED** — runs clean in production. ⚠️ `anon` EXECUTE on it is ROUTED, not fixed | `d476376f` |
| `TASK-BOOKS1` | 2026-09-01 | comp/discount as a payment disposition at settlement; `nullif` removed from `revenue_summary`; list price on the line; period export | **MERGED** — returned once for rebase (D35 collision, ORCH's fault), unioned with BACKDATE, re-verified in production | `merge task/books1` |
| `TASK-SIGNSTRIP` | 2026-09-01 | the unauthorised catalog block off every `/sign/*` funnel, with its fetch and imports | **MERGED** — grep-clean, gates pass; render not verified by ORCH | `merge task/signstrip` |
| `TASK-SIGNDOOR` | 2026-09-01 | the four funnel doors ask for the email only; name/phone/address/minor move to the first page after auth; the path rides the invitation | **MERGED** — four functions verified live, no `anon`, path-not-in-categories confirmed. ⚠️ Spec trap 3 was wrong; routed to DSNR | `merge task/signdoor` |
| `TASK-ANALYTICS` | 2026-09-01 | Vercel Web Analytics installed and mounted | **MERGED** — owner's snippet used the `/next` entry point; this is Vite+React, so `/react` was used | `merge task/analytics` |
| `TASK-LIFECYCLE` | 2026-09-01 | six booking states, 30+30 horizon, viewer-scoped calendar read, transitions wired to the existing buttons; thread corrected the spec (3 states not 2; 7 more functions) | **VERIFIED** — dispatched as REQCARDS, stood down on the owner's ruling; see `TASK-LIFECYCLE-VERIFICATION.md` | `5b9fed67` |
| `TASK-SIGNBOOK` | 2026-09-01 | wizard ends in a booking request: details→sign→offering→time→send, no payment step; order edited line by line; + unspecced DOOR scope (three-state door, activation link) | **VERIFIED AFTER THE FACT** — thread self-merged and pushed before validation; see `TASK-SIGNBOOK-VERIFICATION.md` | `2fa1f7b9` |
| `VISITMENU-label` | 2026-09-01 | request-received email acquisition label: selling→leasing — the unshipped half of the owner's VISITMENU correction, applied by ORCH under the two-line exception | applied+merged | `61b75a42` |
| `SIGNBOOK-thread session` | 2026-09-01 | the whole sign/contact funnel: booking-request wizard end, door three-states, visit on the contact menu, interests field+render, attribution guard, display-name seed — 8 self-merged pushes on owner instruction, 6 prod migrations | **VERIFIED session-wide by ORCH8** — one false ACL claim (inert), F3 upgraded to 759 live rows; see `TASK-SIGNBOOK-VERIFICATION.md` | `2fa1f7b9`…`759098e8` |
| `TASK-SITECOPY-A` | 2026-09-02 | jumper-only + program-not-barn in public copy; spec corrected (3 inert not 4; criterion 1 unmeetable) | **VERIFIED** | `5e7c7c70` |
| `TASK-SIGNFLOW-D` | 2026-09-02 | /release + /docs/release-participant retired, anon EXECUTE revoked in prod; 10-person usage reported; redirect question OPEN | **VERIFIED** | `e2f3dabf` |
| `TASK-SIGNFLOW-B` | 2026-09-02 | address normalize-on-blur, 4 kinds, 4 doors (4th accepted by ORCH); SIGNFLOW-F queued for 3 remaining writers | **VERIFIED** | `2c3a0492` |
| `TASK-SITECOPY-B` | 2026-09-02 | app self-description via usePropertyTerm, 5 strings, plural-proven; spec premise false (16 consumers existed); barnops wording question routed | **VERIFIED** | `870a0607` |
| `TASK-SIGNFLOW-A` | 2026-09-02 | signature-token resolution centralised, 3 readers wired, executed bodies byte-identical; cursive-period defect routed | **VERIFIED** | `59135079` |
| `TASK-LANDINGSIGNIN` | 2026-09-02 | landing Sign In, pathname-gated, cart-frame shape; two physical deviations accepted | **VERIFIED** | `9891bcd5` |
| `TASK-SIGNFLOW-C` | 2026-09-02 | signing flow green end-to-end (175 refs, .flow-green scope, .btn-sign flip); chooser diff applied by ORCH; semantic-pair collapse to owner checklist | **VERIFIED** | `56be160a` |
