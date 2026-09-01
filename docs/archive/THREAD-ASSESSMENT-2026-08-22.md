# Thread assessment — 2026-08-22

My own synthesis, for the record, before this thread's context gets left behind. Not a spec, not for the new thread's handoff — just what I actually believe now and why, plus an honest accounting of what's solid and what isn't.

## The arc of this thread

Started as a second opinion on a six-week AI-built codebase, verdict salvage-not-rewrite with one correction: the data model, not the engines, was the real liability. That led to a full UI/UX refactor spec — design system, IA, flow maps, an 8-wave sequence — built on the assumption that the booking-ownership fix (TASK-AUTHORITY) was the one structural defect worth treating as Wave 0. In parallel, a dashboard redesign and five rounds of visual-language iteration moved from boxed, brand-heavy mockups toward an unboxed, content-as-canvas direction. Partway through that visual work you corrected me twice: once for taking mockup inspiration too literally instead of extracting the underlying principle, once for the same failure mode applied to your own verbal examples (lesson counts, specific animations). That correction produced 00-PRODUCT-PHILOSOPHY.md. Then you checked the actual Claude Code output against what you'd asked for and found the account/identity model itself broken in ways that go well past UI — which is where this thread ends.

## The root cause, stated plainly

Every specific defect you named — contract creation requiring pre-existing parties, no deal-party category, the All tab dropping undesignated contacts and excluding horses, rider-only provisioning showing regardless of actual rider status — is the same failure wearing different clothes. Identity and eligibility are modeled as a maintained categorical tag someone has to assign, not a state the system computes from real facts. Anything that doesn't already fit one of a handful of predefined boxes is invisible or blocked. This is also, I now think, the deeper version of the contacts/clients duplication the original second opinion flagged — that assessment scoped it as an ambiguous-ownership-column problem; it's actually an identity-model problem, and the column was one symptom of it.

## What this changes about scope

The original 8-wave sequence treated TASK-AUTHORITY (single ownership column on bookings) as Wave 0 and everything else as downstream UI work. That's no longer right. The account/identity model sits underneath Records, Accounts, Contracts, Deals, Credits, and Provisioning — nearly everything — so it has to be settled first, as its own artifact, and TASK-AUTHORITY gets absorbed into it rather than sitting beside it as a separate fix. The refactor is no longer primarily a UI/UX project with an architecture footnote. It's an identity/data-model project with UI/UX built on top of whatever that model turns out to require.

## Status of this thread's work product

Some of what came out of this thread is model-agnostic and still holds. Some of it was built against the old designation system and is now provisional.

Still holds: 00-PRODUCT-PHILOSOPHY.md (composition over fixed layout, the two-surface dashboard/feed paradigm, the plan/progress substrate, mutual presence, game-not-homework, reliable-not-predictable, no skeuomorphism, and the rule about reading examples for their reasoning rather than their literal content). None of this depended on how accounts are categorized. 05-SURFACE-LANGUAGE.md and 06-COMPONENT-SOURCING.md are visual and motion vocabulary — also model-agnostic. The unboxed-versus-contained register split as a concept holds regardless of what the identity model turns out to be.

Still structurally sound but needs a scope preface (already flagged separately): 01-DESIGN-SYSTEM.md. The primitive set for operate surfaces — Table, DetailDrawer, Commit, the CRUD standard — doesn't change because identity gets rebuilt underneath it. It governs how a table or a form is built, not what data populates it.

Now provisional, don't treat as current truth: 02-IA-LAYOUT-TREE.html, 03-FLOW-MAPS.html, 04-SEQUENCE-AND-RULINGS.md. These mapped 122 surfaces and sequenced waves against the old designation system and the old assumption that booking ownership was the one structural fix needed. Both of those premises just moved. They're a useful record of what existed, not a plan to execute.

Also provisional: DASHBOARD-DESIGN.md and the zone/presence logic in it (`dashboard_presence(designation)`), because it's keyed to the same designation system that's being replaced. The visual and interaction direction in the mockups — unboxed, instruments over charts, data as texture, restrained photography — isn't invalidated by the identity-model finding and can carry forward once there's a surface worth applying it to.

## What I got wrong this thread, on record

I took your mockup references and your verbal examples more literally than intended, more than once, before the correction landed. The fix isn't just noted in the philosophy doc — I'm holding myself to it going into the new thread: an example illustrates the reasoning behind a decision, not the decision itself.

## What's unverified

I confirmed three of your examples directly against the source code this thread: the contract-party creation constraint, the missing deal-party category, and the All-tab filter logic. I did not verify the rider-only provisioning page, the weekly allowance reset, the calendar revenue calculation, or the activation-notice regression — those are your reports, not my findings, and they need a real audit against the current running app rather than being assumed confirmed just because they fit the same pattern.

## What I'd want the new thread to do first

Settle the account/identity model as its own artifact before touching any surface. Then run a genuinely fresh audit — mechanics, flows, pages, surfaces, database — against current reality, not this thread's Aug 20 snapshot. Only after that, re-derive IA, flow maps, and a sequence plan. The visual and philosophy work from this thread is worth carrying forward as reference once there's a data model it can safely sit on top of.
