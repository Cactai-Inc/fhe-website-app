# TASK-SIGNFLOW-D — REPORT

**Thread `FHE-TASK-SIGNFLOW-D` · `wt-1` · branch `task/signflow-d` · merge-base `c23dc022`.**
⚠️ **`origin/main` has moved to `a65243ad` since checkout (D41/D42 role-model commits — no file
overlap with this branch).**

**CLNR: not clean — see §CLNR below. Nothing was moved; every finding is drift I must NOT fix.**

---

## 1. THE HEADLINE

**Phase 1 measured everything and the one surviving STOP condition did not fire. Phase 2 ran in full.**
`/release`, `/release/:releaseKey` and `/docs/release-participant` are gone; `api/sign-release.ts`,
`Release.tsx` and `DocsParticipantFlow.tsx` are deleted; the Review page's dead slot D is gone.
🔒 **THE PRIZE IS CLOSED: `anon` no longer holds EXECUTE on `sign_release` or `sign_general_release`
in production — proved from `pg_proc.proacl` before and after. No unauthenticated caller can write a
contact, a client or an EXECUTED document any more.**
⚠️ **THE ONE THING THE OWNER SHOULD READ BEFORE THIS MERGES: the participant flow was used by TEN
REAL PEOPLE, most recently 2026-08-15 — 17 days ago, not "once in July".** The ruling was explicit
and reaffirmed ("we dont have a situation where a person without an account signs documents on an
ipad or any other way"), §6 struck usage as a gate, and no document was touched (D32) — so this is
reported, not acted on. **But "we dont use" and "40 executed documents since 13 July" are different
sentences, and §10.1 of the spec asked for exactly this distinction.**

---

## 2. CRITERION BY CRITERION AGAINST "THE TEST THIS MUST PASS"

### Phase 1

#### 1 · All five §4 measurements, each with its query and its output

🔒 **THE SPEC'S BIGGEST PREMISE WAS WRONG, IN OUR FAVOUR: production SQL IS available from a pool
worktree.** §4.2 said *"DSNR could not run this — the repo's `.env` carries only `VITE_SUPABASE_URL`
and `VITE_SUPABASE_ANON_KEY`."* **`.env.db` carries a full production Postgres URL** and
`psql "$(cat .env.db)"` connects as `postgres`. **Every count below is measured against production,
not inherited.** (`CLAUDE.md` § Migration convention documents `.env.db`; the spec looked at `.env`.)

**§4.1 — are the routes reachable in production right now?**
```
$ for p in /release /release/general /docs/release-participant /sign /sign/guest; do
    curl -s -o /tmp/body.html -w "%{http_code}" "https://www.frenchheritageequestrian.com$p"; done
/release                  -> HTTP 200  bytes=9474
/release/general          -> HTTP 200  bytes=9474
/docs/release-participant -> HTTP 200  bytes=9474
/sign                     -> HTTP 200  bytes=9474
/sign/guest               -> HTTP 200  bytes=9474
```
⚠️ **THE SPEC'S TEST CANNOT WORK AS WRITTEN, AND §10.7 INHERITS THE PROBLEM. This is an SPA: every
path returns HTTP 200 and the SAME 9,474-byte `index.html` shell.** A live route and a retired one
are byte-identical over HTTP. **"404" in this task means the app's branded `NotFound` SCREEN
(`src/App.tsx:521`, `<Route path="*" element={<NotFound />} />`), never an HTTP 404.**

**So reachability was proved from the DEPLOYED BUNDLE instead** — no form was submitted:
```
$ curl -s .../assets/index-B5KF9vyk.js -o bundle.js && ls -la bundle.js
-rw-r--r-- 2525045 bundle.js
"/docs/release-participant" -> 2      "release/:releaseKey" -> 1
"sign-release"              -> 1      "sign/guest"          -> 1
```
**All three routes were live and shipping today.**

**§4.2 — has anything ever been signed through them, in production?**

🔒 **THE ATTRIBUTOR, AND WHY IT IS SOUND: `signatures.method = 'KIOSK_TYPED'`.**
The spec asked for `origin`/`channel`/actor-stamp. **`documents` has no `origin` or `channel` column**
(`\d public.documents`, 41 columns, checked). **`sign_release`'s own body writes the discriminator:**
```
sign_release, line 214-215 of pg_get_functiondef:
  INSERT INTO signatures (…, method) VALUES (…, 'KIOSK_TYPED')
```
**And it is the ONLY writer of that value anywhere in the database:**
```sql
select p.proname, count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and pg_get_functiondef(p.oid) ilike '%KIOSK_TYPED%' group by 1;
 sign_release | 1        -- and nothing else
```
🔒 **THEREFORE THE TEMPLATE KEYS NEVER HAD TO CARRY THE ATTRIBUTION.** `/app/onboarding` and the
contract page sign through `record_signature`, which writes `method='TYPED'`. The two methods
separate the kiosk from onboarding exactly, with no overlap and no inference:
```
 method      | count |             first             |             last
-------------+-------+-------------------------------+------------------------------
 TYPED       |    41 | 2026-07-10 13:21:45-07        | 2026-09-01 20:46:38-07
 KIOSK_TYPED |    40 | 2026-07-13 21:34:45-07        | 2026-08-15 19:58:59-07
```

**WHAT THE 40 ARE:**
```sql
select ct.template_key, count(*), min(s.signed_at)::date, max(s.signed_at)::date
from signatures s join documents d on d.id=s.document_id
left join contract_templates ct on ct.id=d.template_id
where s.method='KIOSK_TYPED' group by 1;
 HUMAN_EMERGENCY_MEDICAL | 10 | 2026-07-13 | 2026-08-15
 RELEASE_PARTICIPANT     | 10 | 2026-07-13 | 2026-08-15
 FACILITY_RULES          | 10 | 2026-07-13 | 2026-08-15
 COMPANY_POLICIES        | 10 | 2026-07-13 | 2026-08-15
```
```sql
-- ten distinct signers, four documents each, one sitting each
 audreyslater702@gmail.com | 4 | 2026-07-13     brian@brianolenik.com   | 4 | 2026-07-26
 elishou@gmail.com         | 4 | 2026-07-14     melanie619@hotmail.com  | 4 | 2026-07-28
 ashlanalexis22@gmail.com  | 4 | 2026-07-16     mrober0618@gmail.com    | 4 | 2026-08-02
 rkthicklin@gmail.com      | 4 | 2026-07-18     rachel@vyrtupilates.com | 4 | 2026-08-14
 serenalee1732@gmail.com   | 4 | 2026-07-25     kitgarcin@gmail.com     | 4 | 2026-08-15
```
🔒 **TWO FACTS THE SPEC DID NOT ANTICIPATE:**
1. ⚠️ **ZERO `RELEASE_GENERAL` — the single-document `/release` kiosk has produced NOTHING, EVER.**
   Every kiosk signature in the database came through `/docs/release-participant`. **The route the
   Review page warned was DESTRUCTIVE was, in fact, never used to sign anything.**
2. ⚠️ **These are real people on real dates, not test data**, and the most recent is **2026-08-15,
   seventeen days ago.** The owner's answer to *"used once in July or used last week?"* is **"used
   two weeks ago, ten times since mid-July."**

**All 40 documents are EXECUTED and every one of them stays (D32). This task removed no row.**

**THE "35 DELIVERY ROWS" — RE-COUNTED, AND F3 WAS WRONG:**
```sql
select dd.channel, count(*), min(delivered_at)::date, max(delivered_at)::date
from document_deliveries dd
where dd.document_id in (select document_id from signatures where method='KIOSK_TYPED')
group by 1;
 EMAIL | 28 | 2026-07-28 | 2026-08-15        -- 107 delivery rows exist in total
```
🔒 **28, not 35.** `FLOW-MAP.md:24` carried an unmeasured number, exactly as the spec suspected.
**Corrected in the FLOW-MAP itself as part of §7.6.**

**§4.3 — what breaks if the pages go? NOTHING. Every module traced; not one has a second live consumer.**

| module | queried for other consumers | verdict |
|---|---|---|
| `src/pages/Release.tsx` + `RELEASE_OPTIONS` | `grep -rn RELEASE_OPTIONS src api scripts` → 5 hits, **all inside Release.tsx itself** | GOES |
| `src/pages/DocsParticipantFlow.tsx` | only `App.tsx:32,240` | GOES |
| `fetchReleasePreview`·`signRelease`·`SignReleaseInput`·`SignReleaseResult`·`ReleaseTemplateKey`·`ReleasePreview` | only the two pages. **`src/lib/ops/types.ts` re-exports NONE of them** (spec §7.5's warning checked and negative); `src/lib/ops/index.ts` does not re-export `api-public` | GO |
| `fetchIntakeRequirements` (same file) | `PublicIntakeForm.tsx:4`, `InquiryForm.tsx:33` | 🔒 **STAYS — so the FILE stays, trimmed** |
| `api/sign-release.ts` | `grep -rn "sign-release" src api` → the only POST is `api-public.ts:170` | GOES |
| 🔒 `api/deliver-documents` | `SendCopiesMenu.tsx:39` **and** `Onboarding.tsx:78,1229-1240` | 🔒 **STAYS — PROVED, NOT ASSUMED** |
| the `hold_set` path *through* it | the hold is CLOSED at `deliver-documents.ts:486` for **every** held set, onboarding's included | **STAYS — there is nothing kiosk-only inside it to separate** |
| `open_document_delivery_hold` | `Onboarding.tsx:21,627` via `holdMyDocumentDelivery()`; **widened FOR onboarding** by `20260901T1420_signbook…:26,80` | **STAYS** |
| `sign_release` / `sign_general_release` | ⚠️ `sign_general_release` has **ZERO code callers** — comment references only | **NOT DROPPED (D32). Grants revoked only** |

🔒 **THE STOP CONDITION DID NOT FIRE.** The spec named `api/deliver-documents` as the likeliest —
and the separation turned out to need no surgery at all, because the kiosk-only half was one
`db.rpc('open_document_delivery_hold', … 'participant-flow')` call **inside `api/sign-release.ts`**,
which is deleted whole. `deliver-documents` is untouched by this branch.

**§4.4 — does `/sign/` cover every scenario? YES, WITH NO GAP.** From production, not from a document:
```sql
select path, template_key from sign_path_document_requirements order by path, template_key;
 guest       | COMPANY_POLICIES · FACILITY_RULES · RELEASE_GENERAL
 horse       | COMPANY_POLICIES · FACILITY_RULES · HORSE_EMERGENCY_VET · RELEASE_HORSE_CARE · RELEASE_PARTICIPANT
 rider       | COMPANY_POLICIES · FACILITY_RULES · HUMAN_EMERGENCY_MEDICAL · RELEASE_PARTICIPANT
 rider+horse | COMPANY_POLICIES · FACILITY_RULES · HORSE_EMERGENCY_VET · HUMAN_EMERGENCY_MEDICAL · RELEASE_HORSE_CARE · RELEASE_PARTICIPANT
```
| kiosk document key | the `/sign/` funnel that produces it | proof |
|---|---|---|
| `RELEASE_GENERAL` | **`/sign/guest`** | `20260824T1210_offeringdocs_sign_paths_and_tags_stop_deciding.sql:53`; applied by `api/sign-start.ts:401` (`apply_sign_path_documents`) |
| `RELEASE_PARTICIPANT` | **`/sign/rider`, `/sign/horse`, `/sign/rider+horse`** | same |
| `FACILITY_RULES` | **all four funnels** | same |
| `COMPANY_POLICIES` | **all four funnels** | same |
| `HUMAN_EMERGENCY_MEDICAL` | **`/sign/rider`, `/sign/rider+horse`** | same |
🔒 **`/sign/rider`'s set is EXACTLY the four documents the kiosk ever produced.** **No key is
unproduced. There is NOTHING here for `TASK-SIGNFLOW-E`.**

**§4.5 — is a link in the wild?** The repo proves nothing links to either (§2, re-run below).
⚠️ **But ten people reached `/docs/release-participant` between 13 July and 15 August, so a link
DOES exist somewhere outside this repository** — an email that was sent, a text, a QR code, a note
in someone's phone. **A printed sign, a laminated card or a past email cannot be seen from here.**
The owner ruled it: a retired URL 404s. **§9 below says what that costs and what I recommend.**

**§2 re-run (the spec's own premises, re-verified):**
```
$ grep -n "release" src/App.tsx
31: import Release …   32: import DocsParticipantFlow …
237,238,240: the three <Route>s — NO auth wrapper on any     ✅ spec correct
$ grep -rn "'/release|\"/release|release-participant" src api supabase scripts
… the 3 routes + reviewSection.ts:283 + comment-only hits    ✅ spec correct
   ⚠️ one addition the spec missed: Release.tsx:235 is a <Link to="/release"> — a SELF-link
     inside the retired page, so it goes with the file. Harmless either way.
$ grep -rn "release-participant|/release" supabase/ | grep -v migrations-archive
(zero)                                                       ✅ spec correct
```

#### 2 · §4.4's answer — **done above. No key is missing. Nothing for `TASK-SIGNFLOW-E`.**

#### 3 · The STOP condition — **did not fire.** `git diff --stat` is NOT empty, which is the correct outcome.

### Phase 2

#### 4 · `grep -rn "release-participant\|Release.tsx\|DocsParticipantFlow" src api` — every remaining hit, and why

```
src/App.tsx:235,236                    the RETIRED comment §7.1 leaves in place, in the file's own
                                       /inquire-retired idiom. INTENTIONAL.
src/lib/ops/api-public.ts:15           the RETIRED note in the trimmed file's header. INTENTIONAL.
src/components/ops/documents/          ⚠️ STALE COMMENT naming a deleted file:
  MergedBodyView.tsx:28                "confirmation (Release.tsx), which has its own container styling."
src/lib/contact.ts:184                 ⚠️ STALE COMMENT naming deleted files:
                                       "flow (DocsParticipantFlow / Onboarding, via sign-release.ts)"
```
⚠️ **THE LAST TWO ARE NOT MINE TO EDIT.** `TASK-ROLE.md` §5 — *touch only the files your spec says
you own; need a change elsewhere, report the diff and ORCH applies it.* Neither file is in my spec,
and `MergedBodyView.tsx` is plausibly in `TASK-SIGNFLOW-A`'s path. **The exact edits, for ORCH:**
- `src/components/ops/documents/MergedBodyView.tsx:28` → *"confirmation (the retired release kiosk,
  removed 2026-09-01), which had its own container styling."*
- `src/lib/contact.ts:184` → *"flow (Onboarding) and read back"* — drop `DocsParticipantFlow / … via
  sign-release.ts`.
- `api/deliver-document.ts:10` (a third one, outside this grep's pattern) → it cites
  *"in-process, from api/sign-release.ts"*; that file no longer exists.

**Neither breaks anything: they are prose, not imports — `typecheck`, `typecheck:api` and `build`
are all clean.**

#### 5 · 🔒 `pg_proc.proacl` — BEFORE AND AFTER, pasted

**BEFORE (production, immediately before applying):**
```
sign_general_release(text,text,text,text,uuid,boolean)
  => {postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}
sign_release(text,…,text)   -- 26 params
  => {postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}
```
**APPLY** — `supabase/migrations/20260902T0010_the_retired_kiosk_closes_the_last_anonymous_signing_door.sql`,
dry-run inside `BEGIN; \i …; ROLLBACK;` first, then applied: `REVOKE REVOKE GRANT GRANT`.

**AFTER (production):**
```
sign_general_release => {postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}
sign_release         => {postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}

select has_function_privilege('anon', p.oid, 'EXECUTE') …
 sign_release          anon_can_execute = false
 sign_general_release  anon_can_execute = false
```
🔒 **NO `anon`. And re-verified a second time immediately before writing this report (D35 — a green
check from an hour ago is not evidence):**
```
record_signature             anon=false authenticated=true service_role=true
open_document_delivery_hold  anon=false authenticated=true service_role=true
sign_release                 anon=false authenticated=true service_role=true
sign_general_release         anon=false authenticated=true service_role=true
```
**The three traps the spec named were all avoided:** both roles named explicitly (a bare
`REVOKE … FROM PUBLIC` would have left `anon`'s direct grant standing); **no `DROP`/`CREATE`** — the
function bodies are untouched, so no ACL reset and no Supabase default-privilege re-grant; and the
result is proved from `proacl`, never from the absence of an error.

⚠️ **`/app/onboarding` signing — WHAT I CAN AND CANNOT PROVE.** I can prove the machinery it depends
on is untouched: `record_signature` and `open_document_delivery_hold` hold identical ACLs before and
after (above); `api/deliver-documents` is not in this diff at all; the most recent `TYPED` signature
is **2026-09-01 20:46**, i.e. onboarding's writer was working on the same code the day this ran, and
nothing this branch changes is on its path. ⚠️ **I CANNOT sign a real document end to end — no
worktree has a staff or member login and I will not simulate one.** **That is checklist item 4 for
the owner, and it is the one most likely to be skipped, so it is stated first among the signing items.**

#### 6 · typecheck · typecheck:api · lint · build
```
npm run typecheck       0 errors
npm run typecheck:api   0 errors
npm run lint            0 errors, 45 warnings
npm run build           ✓ built in 4.11s — prerendered 10 routes, sitemap + robots written
```
⚠️ **On the warning count: `CLAUDE.md` documents 48, measured on `main` 2026-08-26 — a week stale, so
45 is not a delta I can claim credit for.** What I CAN prove is the one warning this change removed:
`eslint` on `origin/main`'s `Release.tsx` in isolation → *1 warning* (`react-refresh/only-export-components`
at `:43`, the `RELEASE_OPTIONS` export beside a component). **No new warning was introduced.**

🔒 **AND THE BUILD IS THE REAL PROOF THE ROUTES ARE GONE — from the built bundle, not from the source:**
```
$ B=dist/assets/index-3ELW33IQ.js
"docs/release-participant" -> 0     "release/:releaseKey" -> 0
"api/sign-release"         -> 0     "sign/guest"          -> 1   ← the incumbent survives
$ grep -c release dist/sitemap.xml dist/robots.txt   ->  0, 0
```
**`npm run test:db` was not run: it is red at baseline and proves nothing (`TASK-ROLE.md` §3).**

#### 7 · `/release`, `/release/general`, `/docs/release-participant` 404 in production
⚠️ **NOT YET, AND IT CANNOT BE — THIS BRANCH IS NOT PUSHED AND `TASK` DOES NOT PUSH.** Production
still serves the old bundle until ORCH merges and Vercel deploys. **What is proved now:** the routes
are absent from the source, absent from the freshly built bundle (above), and the catch-all
`<Route path="*" element={<NotFound />} />` (`src/App.tsx:521`) sits in the same `<Routes>` inside a
`<Layout>`, so both paths land on the branded 404 screen. ⚠️ **And remember §4.1: it will still be
HTTP 200 with a 404 SCREEN. Do not test this with `curl -I`.** **Owner checklist items 1-2.**

⚠️ **ONE CONSEQUENCE OF SEQUENCE, STATED PLAINLY: the migration is already live and the code is not.**
Between now and the deploy, anyone opening the old participant link gets a *failed to sign* error
rather than a clean 404. **That window is the price of proving the ACL from production, the surface
is one the owner has ruled unused, and no data is at risk — but ORCH should know it exists and merge
rather than sit on this.**

#### 8 · `/sign`, `/sign/guest`, `/sign/rider`, `/sign/horse`, `/sign/rider+horse` and the deal branch still work, logged out
**Owner checklist items 5-8. Not verified by me — no renders.** What is proved: nothing in this diff
touches `SignChoose.tsx`, `SignStart.tsx`, `api/sign-start.ts` or
`sign_path_document_requirements`; `"sign/guest"` survives in the built bundle; and the four funnels'
document sets are the production rows pasted in §4.4.

#### 9 · `/app/onboarding` signs a document and the executed copy still arrives by email
**Owner checklist item 4 — see the note under criterion 5. THE ONE MOST LIKELY TO BE SKIPPED.**

#### 10 · The Review page has no dead slot D
`src/lib/reviewSection.ts` — the `slot: 'D' … to: '/release'` entry is deleted; **A, B and C are NOT
renumbered.** `grep -n "'/release" src/lib/reviewSection.ts` → no hits. **Owner checklist item 9.**

---

## 3. THE REACH (D17/D19)

**This task REMOVES reach; it adds none.** After merge the only public signing door is **`/sign`**
(`src/pages/SignChoose.tsx`), whose five rows are the funnels `/sign/guest`, `/sign/rider`,
`/sign/rider+horse`, `/sign/horse` and `/sign/deal` (`SignChoose.tsx:38-80`), plus the four deep
links directly. A person then activates an account and signs at `/app/onboarding`.
**What a stranger with an old kiosk link now clicks: nothing. They get the branded 404**
(`src/App.tsx:521`). **That is the design, per the owner's ruling — and §9 is where I say what I
think it costs.**

**THE TELL (D19):** the retirement states itself in three places a future reader will actually hit —
the comment where the routes were (`src/App.tsx:235`), the header of the trimmed seam file
(`src/lib/ops/api-public.ts:13-20`), and the migration's own preamble, which quotes the migration it
supersedes. **UNDO:** `git revert` any of the five commits independently; the grant is restored with
`GRANT EXECUTE … TO anon`. **Nothing is destroyed.**

## 3b. §2c's THREE QUESTIONS (D39)

⚠️ **This task CAPTURES nothing — it is a removal, and the three questions are asked of stored
values. Answered anyway, because the removal changes where an existing capture lands:**
1. **CAPTURE → WHERE IS IT SEEN?** The kiosk's capture (a signed release from a walk-in) **now
   happens through `/sign` → invitation → `/app/onboarding`**, and it is seen in the same places
   every other onboarding signature is: the person's documents, `document_deliveries`, and the staff
   surfaces that read them. ⚠️ **The kiosk was in fact the WORSE surface on exactly this axis:
   `FLOW-MAP` F3 recorded that `/release` "alerts nobody" — a walk-in signer produced a document no
   staff member was told about.** **Retiring it improves the answer to question 1.**
2. **SEEN → WHERE IS IT ACTED ON?** `/sign` submissions produce an invitation and a `requests` row
   through `api/sign-start.ts`, which is the alerting spine. The kiosk's `/release` half produced
   neither.
3. **WHAT ELSE DOES THIS OUTCOME NEED THAT NOBODY ASKED FOR?** 🔒 **One thing, and I am naming it
   before this is called done: a walk-in standing at the property with no account.** The owner has
   ruled that this situation does not exist, so I have not built anything — **but the honest gap in
   §3 of my spec is real and I am not papering over it: the flow went from "sign here now" to "give
   us your email, open it on your phone, make an account, then sign."** If that ever bites, the
   answer is an entry point into `/sign`, not a resurrection of the kiosk. **See §9.**

---

## 4. FLAGGED, NOT FIXED — one line each (CR-94)

- **`authenticated` still holds EXECUTE on `sign_release` and `sign_general_release` and nothing
  calls either — a two-line `REVOKE` closes the last door on both.** (Deliberately out of scope; see §5.)
- **`release_preview` and `general_release_preview` keep an `anon` EXECUTE grant and now have ZERO
  callers** — `fetchReleasePreview` was their only one and is deleted.
- **~450 functions in `public` are `anon`-executable**, most of them triggers and internals; the two
  this task closed were the write path, but the surface is much larger than two functions.
- **`src/lib/ops/api-releases.ts` has no consumers anywhere in `src/`** — an orphan seam file,
  unrelated to this task.
- **The `/sign` funnels' `HORSE_EMERGENCY_VET` has no kiosk equivalent** — noted only because it is
  the one key in the four funnels the kiosk never produced; that is correct, not a gap.

---

## 5. WHAT I DECIDED THAT THE SPEC DID NOT

1. 🔒 **The migration re-GRANTs to `service_role` ONLY, and leaves `authenticated`'s pre-existing
   direct grant standing.** §7.3 said *"re-`GRANT`s to the roles that must keep it"* and named
   `anon, PUBLIC` as the revoke target. **Nothing calls either function as `authenticated`** — so
   revoking it would arguably be right, and I chose not to, because it is subtractive beyond the
   spec's letter while three other threads are live, and a subtractive change nobody asked for is
   how `NOSTRIP` happened. **Flagged in §4 as a one-line follow-up instead.**
2. **The migration is dated `20260902T0010`, not `20260901`.** It was written after midnight and
   must sort after `20260901T2330`. **The task, the ruling and the report are all 2026-09-01 work.**
3. **`src/lib/reviewSection.ts`'s section question said *"Five capture surfaces, three writers"*.**
   It was **already wrong before I touched it** (four entries listed, and the "five" traces to
   `TASK-REVIEWNAV-REPORT.md:368` which also lists four). Removing slot D made it worse. **Rewritten
   to "Three capture surfaces, two writers"** — three entries, and two remaining `record_signature`
   RPC call sites (`src/lib/api.ts:1502`, `src/lib/ops/api-client.ts:143`) once `sign_release`'s door
   closes. **The spec said not to renumber the slots; it said nothing about the sentence above them,
   and leaving a count that is now off by two is the same class of stale fact as the dead link.**
4. **The `App.tsx` routes were REMOVED, not redirected.** §9 asks me to *recommend* a redirect and
   explicitly not to build one, so the routes fall through to the 404 as specified.
5. **The three stale comments in files I do not own were left in place and handed to ORCH** rather
   than fixed (criterion 4 above).

## 6. WHERE THE SPEC WAS WRONG

1. 🔒 **§4.2's central premise — "DSNR could not run this; the repo's `.env` carries only
   `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`" — is WRONG.** `.env.db` in every pool worktree
   is a full production Postgres URL, and `CLAUDE.md` § Migration convention says so. **Every §4.2
   count in this report is measured. The spec expected a hypothesis and could have had a number.**
2. ⚠️ **§4.1 and §10.7 ask for an HTTP status that cannot mean what they want.** The site is an SPA:
   every path returns 200 with an identical shell. **A future spec must ask for the rendered screen
   or a bundle grep, not a status code.**
3. **§4.2's attribution worry was unnecessary.** It warned that the five template keys are also
   signed through `/app/onboarding` and asked me to find `origin`/`channel`/an actor stamp.
   **`signatures.method` already separates them perfectly, `sign_release` is its sole writer, and no
   inference was needed.**
4. ⚠️ **`FLOW-MAP.md:24`'s "35 delivery rows" is wrong — it is 28.** The spec suspected this and was
   right to.
5. **§7.1 says the imports are at `:31-32` and it is correct** — but §2's table cites only `:31`.
6. **The spec's §3 table says `/release` "SIGNS documents, immediately".** True of the code; **false
   of the history — `/release` has never signed anything.** Only `/docs/release-participant` ever did.
7. **§2's "exactly one non-route hit in shipped code" missed `Release.tsx:235`'s `<Link to="/release">`.**
   Self-referential and removed with the file, so it changed nothing.

## 7. THE NUMBERS

| | |
|---|---|
| `npm run typecheck` | **0 errors** |
| `npm run typecheck:api` | **0 errors** |
| `npm run lint` | **0 errors, 45 warnings** (documented baseline 48, measured 2026-08-26 and stale; the 1 warning this change removed is proved above) |
| `npm run build` | **✓ 4.11s**, 10 routes prerendered, sitemap + robots written |
| `npm run test:db` | **not run — red at baseline, proves nothing** |
| diff vs merge-base `c23dc022` | **11 files, +212 / −1318** |
| commits | 7, each independently revertable |

## 8. THE OWNER'S RENDER CHECKLIST

⚠️ **Nothing below is verified by me. Run these AFTER ORCH merges and Vercel deploys — the code is
not in production yet, though the database grant already is.**
🔒 **Items 4 and 9 are the two that catch a real regression. Item 4 is the one that gets skipped.**

**On your phone, signed out, in a private tab:**
1. Open `frenchheritageequestrian.com/release` → **you should see the branded 404 page.** ⚠️ **The
   HTTP status will still say 200 — this is a single-page app; judge it by the SCREEN, not the code.**
2. Same for `/release/general` and `/docs/release-participant` → **branded 404, both.**
3. Open `/sign` → the five choices render. Tap **"I'm here to ride"** → the form loads, and
   submitting a real email still sends you the invitation.

**Then, signed IN as a member with pending documents (this is the important one):**
4. 🔒 **Open `/app/onboarding` and sign a document all the way through. Confirm the executed copy
   arrives by email with the PDF attached.** ⚠️ **This is the item that would catch a shared-delivery
   regression, and it is the one most likely to be skipped. Please do not skip it.**

**Back signed out, on your phone:**
5. `/sign/guest` → loads and submits.
6. `/sign/rider` → loads and submits.
7. `/sign/horse` → loads and submits.
8. `/sign/rider+horse` → loads and submits (the URL carries a literal `+`).

**Signed in as staff, on a laptop:**
9. Review nav → **Signature capture** → **there is no "Signing D · public kiosk" row**, and A, B and
   C are still A, B and C.
10. `/app/documents` for one of the ten kiosk signers (e.g. `kitgarcin@gmail.com`) → **their four
    executed releases are still there.** Nothing was removed from the database.

## 9. THE TELL, AND MY RECOMMENDATION ON THE REDIRECT (spec §9)

⚠️ **THE PERSON THIS IS VISIBLE TO IS A STRANGER WITH AN OLD LINK, AND THEY GET A 404 WITH NO
EXPLANATION.** They will not know the flow moved; they will conclude the paperwork link is broken.

🔒 **I RECOMMEND THE REDIRECT — `/release` and `/docs/release-participant` → `/sign` — and I have not
built it, because §9 says it is a product decision.** The reason is not tidiness: **ten real people
used that link between 13 July and 15 August, and it came from somewhere outside this repository.**
Whatever carried it — an email, a text, a QR code on a clipboard — is still out there, and the next
person to follow it is someone actively trying to give the business their signed paperwork. A 404
turns that into a phone call; a redirect to `/sign` turns it into the new flow, which asks the same
person for the same four documents. **It is one `<Route … element={<Navigate to="/sign" replace />} />`,
and `App.tsx:234` already does exactly this for the retired `/inquire`.**
⚠️ **The argument against it is real too: a redirect keeps a retired URL semi-alive forever, and the
owner's ruling was that a retired URL 404s.** **It is his call, and it belongs with the same
conversation as the entry points into `/sign` he described** — *"different ways of getting there to
accommodate the various scenarios/places/events a client would be served with the link to it."*

## CLNR — the zeroth-act sweep

**NOT clean, and I moved nothing.** Every item below is pre-existing drift, and three live threads
(`SITECOPY-A` on `wt-2`, `SIGNFLOW-B` on `wt-3`, plus whoever holds the canonical checkout) make
moving files unsafe. **Reported to ORCH, not fixed** (§3.6 of `CLNR-ROLE.md`):
- **§2b resumability: PASS for every role** — `docs/method/` holds `ORCHESTRATOR.md`, `DISCO-ROLE.md`,
  `DSNR-ROLE.md`, `TASK-ROLE.md`, `CLNR-ROLE.md`, `RNR-ROLE.md`, `CODR-PROFILE.md`; `docs/orch/BOARD.md`
  answers "what is the state"; my own spec was findable from my identifier alone.
- **`docs/` root: 0 loose files. ✅**
- ⚠️ **Five folders exist that `§2a` does not name:** `contract-content/`, `contract-exports/`,
  `proposed/`, `staged/`, `ui-orders/`. **And `docs/tests/` — which §2a DOES name — does not exist.**
- ⚠️ **163 of 165 `*REPORT.md` files carry no `## VALIDATION` block**, which §2c calls a finding: it
  means self-reported "done"s were merged unchecked. **This is a big number and ORCH should decide
  whether it is a real backlog or a convention that changed.**
- **~40 merged `task/*` branches are still on the remote**, several hundred commits behind.
- **The shared workspace root holds `orchestration.zip`, `v2authoringbrief.md` and five non-repo
  folders** beside the three pool worktrees.

## 10. TEARDOWN CENSUS

- **No servers, no browsers, no scratch worktrees started.** The build ran once and exited; `dist/`
  is gitignored and left in the tree.
- `psql` ran only as short one-shot commands — **no session left open.**
- **Worktree `wt-1` is still held by branch `task/signflow-d`, deliberately** — it is this task's
  claim and ORCH merges from it.
```
$ git worktree list
…/fhe-website-app  c23dc022 [main]
…/wt-1             6c341118 [task/signflow-d]   ← this thread
…/wt-2             b4d8c607 (detached HEAD)
…/wt-3             14140564 (detached HEAD)
$ ps -x | grep -E "vite|node.*dev|chrome" | grep -v grep
  → no vite, no dev server, no headless browser. The only matches are the OWNER'S OWN
    processes, none started by me: Chrome + VS Code, and FIVE `claude` native-binary
    sessions (pids 2151, 30198, 30206, 30221, 94551) — the parallel threads.
```

---

**Report by `FHE-TASK-SIGNFLOW-D`, 2026-09-01 (written past midnight, 2026-09-02).**
**Next station: `ORCH` — verify these claims and write `TASK-SIGNFLOW-D-VERIFICATION.md` beside this file.**
