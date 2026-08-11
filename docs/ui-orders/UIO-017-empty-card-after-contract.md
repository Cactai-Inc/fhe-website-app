# UIO-017 — an empty card renders below the end of the contract

**Status:** READY
**Owner request, 2026-08-10:** *"remove the empty card below the end of the contract"*

## This order describes a SYMPTOM. Diagnose before you change anything.

Your own standing rule applies here: **enumerate before theorising.** The contract reload bug
took three attempts because two confident diagnoses came before anyone listed the call sites.

## The lead — verify it, do not assume it

`src/pages/app/ContractPage.tsx:1899`:

```jsx
<section id="contract-signatures"
         className="bg-white border border-green-800/10 rounded-xl p-6 scroll-mt-16 mt-6">
```

It renders immediately after `<ClauseDocument>` (line 1709), and its **card chrome —
background, border, radius, padding — is unconditional**. With the signing freeze in force
there are no signatures anywhere in the system, so if its contents are conditional and its
wrapper is not, it renders as an empty white box exactly where the owner says one is.

**That is a hypothesis with a plausible mechanism, not a finding.** Confirm what actually
renders empty before touching it. If it is a different element, fix that one and say so.

## The fix, once you have confirmed the cause

The wrapper must not render when it has no content. **Gate the wrapper, not just its
children** — an empty card is precisely what "children are conditional, chrome is not" looks
like.

**Do not hide it with CSS.** `:empty`, zero height, or `display:none` on a populated-later
element are workarounds; not rendering it is the fix. That distinction is already in your
standing rules.

## Files
- `src/pages/app/ContractPage.tsx`

## Do NOT
- **`ClauseDocument.tsx` is STOP-AND-PROPOSE.** If the empty element turns out to live inside
  it, do not edit it — report with a minimal proposed diff and wait for the orchestrator.
- Do not change the signatures section's content, ordering, or `scroll-mt-16` anchor. The
  anchor is a scroll target and something links to it.
- Do not remove the section outright — it must still appear once signatures exist. **The
  signing freeze means you cannot see it populated**, so reason about the populated case
  explicitly and say in your report how you satisfied yourself it still renders.

## Verification
State what you verified and what you could not. A populated render is **not** currently
observable — do not claim it.
