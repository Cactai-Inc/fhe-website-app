# Refactor Position — 2026-08-22

My current opinion, authored fresh with everything this thread surfaced. This supersedes 02-IA-LAYOUT-TREE, 03-FLOW-MAPS, 04-SEQUENCE-AND-RULINGS, and DASHBOARD-DESIGN.md as the working position. 00-PRODUCT-PHILOSOPHY.md governs above this; 01-DESIGN-SYSTEM.md and 05-SURFACE-LANGUAGE.md remain the two register specs beneath it.

## 1. Identity and roles

One table of people. A person record is creatable from an email alone — name, phone, everything else accretes over time. No creation surface anywhere in the app may demand more than that to bring a person into existence.

Three platform roles, and only three: customer, employee, admin. Role is the only thing that selects which shell a person gets and what capability tier they hold. Customer gets the member app. Employee gets the staff app scoped to operations and clients. Admin gets the staff app plus money, settings, and platform controls. Within a role, an emphasis (Claire as instructor-emphasis owner, CJ as operations-emphasis owner) changes what the dashboard leads with — never what the person can do.

Everything the app currently stores as a designation becomes one of two things. Organizational labels — vendor, partner — survive as address-book labels that filter lists and nothing else; they never gate a capability or hide a surface. Everything else — client, lead, rider — becomes a computed display state derived at read time from facts: a lead is a person with an inquiry and no purchase, a client is a person with service history, a rider is a person with lesson activity or rider paperwork on file. These render as chips. They are never stored as gates, never assigned by hand, and can never drift from reality because they are re-derived from it.

A deal party is not a category. It is a person record — often just an email — attached to a deal or contract in a party role. The role lives on the deal, where it already exists in the engine, not on the person.

Relationships stay as relationships between person records: guardian and dependent for minors, with the guardian holding signing authority. Horses remain records, not people, but first-class ones — they appear in the directory alongside people, keyed on microchip for dedup as already ruled.

## 2. The requirements engine

The single replacement for designation-driven gating. Every offering — a lesson type, a care service, a lease role, a purchase — declares its requirements: which signed documents, what payment or credit, any prerequisites. One function evaluates a person against an offering's requirements. No surface ever hand-rolls an eligibility check.

Gating happens at the moment of the action, inside the action. Book a lesson with no credit: the booking flow becomes an order flow, then completes the booking. Buy a care service with no waiver on file: the purchase flow presents the waiver for signature, then completes. Nothing is pre-blocked, nothing requires an account to be pre-shaped. Anyone with an account shops, browses, purchases, and schedules freely; the only hard line is that a service is not delivered without its documents and payment, and the app enforces that line exactly where the person is standing when it matters.

This retires provisioning as a stored configuration. The staff account-setup wizard survives in a different form: it is preparation, not permission — choose the services a new person is expected to use, and the system derives and sends the paperwork, sets up invitations, grants purchased credits. Skipping the wizard breaks nothing, because the gates catch everything at action time. Surfaces in a customer's app appear when their state makes them relevant — a horse section when they have a horse, lesson surfaces when they have lesson activity — computed, not toggled.

## 3. App structure

Two primary surfaces for every role, per the philosophy doc: a dashboard, where things get done, and a community feed, where wins get celebrated and people commune. Owners and staff live in both alongside clients.

Beneath those, the operate layer. For staff and admin: Schedule, Records (one directory — people and horses, labels as filters, the All view showing genuinely all), Money (admin), Documents & Deals, Operations, Settings (admin). The old Today area is gone — the dashboard is Today. For customers: Book & Shop, My Schedule, My Horses (when relevant), Documents, Account & Billing. Operate surfaces are stable and reliable in navigation; only relevance-driven sections (My Horses) appear and disappear, and only from computed state.

## 4. The dashboard

Not a layout. A ranked attention feed with a rendering vocabulary. Specified in three parts.

Sources. Each role's dashboard draws attention items from defined sources. Shared across roles: the next scheduled thing, unmet requirements blocking an upcoming event (tomorrow's lesson missing its waiver), money owed in either direction, milestones from the plan substrate, community activity worth surfacing. Instructor emphasis adds: today's lessons each carrying its focus pulled from lesson notes, clients whose next plan is unwritten, celebration prompts, horse workload flags. Operations emphasis adds: verified revenue against target, receivables aging, decisions pending, deals and contracts in flight, new leads, app and rails health. Customer adds: their next booking with its focus, actions required of them, their progress and milestones, their horse's care events, feed highlights.

Ranking. One rule set, server-side, one RPC per role returning the ranked feed: blocking beats time-proximate beats money beats relational beats informational. The surface recomposes when an item is acted on and when underlying data changes. The client renders; it never ranks — so composition is consistent, testable, and the same on every device.

Rendering. The unboxed register. An editorial lead sentence that says the one thing that matters most right now. Numbers as instruments — a bespoke gauge or naked serif numeral per datum, never a chart-library default. People as faces. The week as a horizon. Actions as inline text links inside sentences. Celebration moments drawn from a small variant pool so they stay reliable but never predictable. Every displayed figure is tappable through to its ledger source.

Money on any owner surface: verified payments are Revenue; declared or expected amounts display separately and are never summed into it.

The plan substrate that feeds this: goals, focal points, and milestones extracted from lesson notes as structured data. It powers the client's specific story ("today's focus is X, which follows from Y") and, from the same event, the complementary staff-side card — mutual presence, both sides of every win.

## 5. The community feed

One shared feed. Post types kept small for v1: staff posts, photos, event notices, and milestone celebrations auto-drafted from the plan substrate and published with consent — the client's or staff acting with it. Lightweight reactions and comments. Owners and staff participate as themselves. Staff can remove content. Nothing else in v1; the feed earns complexity later.

## 6. Feature and function revisions

The concrete changes that fall out of the model:

New-person creation available inline everywhere a person is needed — contract party, booking, invitation, wizard — email minimum, no designation required.

Contract creation rebuilt on the identity model: inline party add, party roles on the deal, no pre-existing-account requirement. The clause/gate engine underneath is kept; the creation and party UX above it is rebuilt, and the whole system re-verified end to end rather than trusted.

Records: one directory, truly complete. Unlabeled people visible. Horses alongside people. Labels filter; nothing gates.

Booking: schedule-first. Credit evaluated at commit; missing credit becomes an inline order; missing paperwork becomes an inline signature. The person's intent is never rejected, only routed through what it requires.

Memberships and allowances become a real engine with a ledger: explicit grant amounts, explicit reset rule at period end, reinstatement driven by the payment event, current state visible to both the member and staff. The two-per-week allowance is the first case it must serve correctly.

Money: cost tracking enters the model alongside revenue. Every figure anywhere in the app is traceable to ledger rows. The calendar's income figure is either derived transparently from verified payments per day or it is removed — no opaque formulas anywhere.

Activation: ends in a clean success state; error notices appear only on actual failure; verified in a live session, not by code inspection.

## 7. The two registers

Contained register — 01-DESIGN-SYSTEM.md as written, plus a scope preface — governs operate surfaces: tables, forms, settings, CRUD, anything that moves data. Its laws, primitives, Commit tiers, and enforcement stand.

Unboxed register — 05-SURFACE-LANGUAGE.md plus the direction shortlist (instruments not charts, data as texture, shape carries meaning, editorial voice, floating chrome, restrained photography) — governs surfaces you inhabit: dashboard, feed, progress, workspaces.

Every surface declares its register in its spec. Mixing registers on one surface is a defect.

## 8. Data accuracy discipline

Generalized from the booking-ownership fix into a standing principle for every tracked quantity — credits, balances, allowances, horse workload, revenue, costs. One owner table. One write path, through an engine RPC. An audit row on every mutation. A visible ledger surface. Zero-row updates treated as failures everywhere. The live database is authoritative over the migration journal. Any quantity that cannot show its ledger is not considered tracked.

## 9. The database

Over-built and fragmented, confirmed by shape: 144 tables and 605 functions serving a few thousand rows, built by ~130 isolated write-path tasks that each solved locally. The response is consolidation after audit, not demolition. Keep the proven engines — the credits ledger, the contract clause/gate engine, the RLS helper patterns, the provisioning path. Collapse identity into the one-people model. Collapse booking ownership into it. Retire the known orphan features, make the dead crons real or remove them, and eliminate every parallel write path. The exit test: every table either has a reachable surface or a named engine role; everything else is archived out of the live schema.

## 10. Order of operations

Zero: ratify the identity and requirements model (§1–2) as a migration-level spec. Everything inherits from it; nothing precedes it.

One: fresh audit against a current bundle and live schema — runnable-flow census, table reachability, write-path census, figure-traceability census. No prior completion claim is carried forward; live walkthroughs are part of the audit, and "not verified visually" is not accepted as done.

Two: schema consolidation, identity first, staged, with independent adversarial verification per stage.

Three: the requirements engine and the booking–order–credit path on the new model, since it is the spine of daily operation and the membership/allowance fix rides on it.

Four: surfaces, area by area, each in its declared register. The dashboard and feed scaffold early on thin data so the composition engine and plan substrate mature with real use; then Schedule, Records, Money, Documents & Deals, the member app, Operations, Settings.

Throughout: the accuracy discipline of §8, and the verification discipline this codebase has proven it cannot live without.
