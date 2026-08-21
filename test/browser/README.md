# test/browser — rendering the real page in a real browser

**Why this exists.** `TASK-CONTRACTWALK` reported the horse-confirmation control as
"reachable and clearly labelled". It was read off the source, and it was false: the
control could not render at all, and no lease could be locked or signed because of it
(WALK3 F-2). D17 is the standing rule that came out of that — **a green function call is
not a shipped feature**. This harness is how a claim about reach gets checked: by putting
the actual page in an actual Chromium and clicking the actual control.

It also caught a defect jsdom could not. `jsdom` accepts any string as an
`<input type="date">` value and fires events the browser would not, so the date-save bug
(WALK3 F-1) **passed** under jsdom and **failed** in Chromium.

## What it is

The **real `ContractPage`**, with its real components, router and providers, running
against RPC payloads captured from a **real Postgres** — PGlite loaded with this repo's own
schema (see `test/db/contractsend_field_roundtrip.test.ts`, which produced them). Only the
network layer is substituted: `test/browser/supabase-shim.ts` replaces `src/lib/supabase.ts`
via a `resolveId` hook in `test/browser/vite.config.ts`, serves those payloads, applies
field writes to its own copy (persisted in `sessionStorage`, so values survive a full page
reload), and logs every `rpc()` call to `window.__rpc` — the same evidence a network log
gives, but assertable.

It is **not** a substitute for a walk against production. It proves reach, rendering and
wiring. It cannot prove RLS, delivery, or anything about real data.

## Running it

```bash
# 1. serve the harness (leave running)
VITE_SUPABASE_URL=https://example.supabase.co VITE_SUPABASE_ANON_KEY=anon \
  npx vite --config test/browser/vite.config.ts --port 5199 --strictPort

# 2. in another shell
node test/browser/probe-field-roundtrip.mjs      # every input_kind saves — 18/18
node test/browser/probe-horse-confirmation.mjs   # the horse control renders and fires
```

Chromium comes from `/opt/pw-browsers`; `playwright` is a dev-time dependency of the probes
only (`npm i -D playwright --no-save`), deliberately not added to `package.json` so a normal
install stays lean.

## Reading a result

`probe-field-roundtrip.mjs` prints one line per `input_kind`. Each kind has its own recipe
because each control genuinely differs — a date is typed, a yes/no is a pair of buttons, a
week grid is day pills, an `add_text` is a button that reveals an input. A single generic
"fill the box" sweep reports eight false failures.

A `gate` in a recipe presets a field value before load. A control behind an unmet
conditional renders as a deliberate non-interactive preview (`pointer-events-none`) because
the composer drops its line — accepting input there would be a lie. Opening the gate is part
of reaching the control, not a way around the test.

One trap worth knowing: `scrollIntoViewIfNeeded()` parks the target under the sticky
toolbar, which then intercepts the click and reports `<div> intercepts pointer events`.
That reads exactly like a broken control. Centring the element instead (`centre()`) is what
distinguishes a genuine overlay from this artifact.
