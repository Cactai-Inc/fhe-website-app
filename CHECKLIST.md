# FHE build checklist — intent vs actual

The single source of truth for what we decided and whether the code actually does it.
Every future chunk updates this file and must be verified (typecheck + grep the wiring
+ eyeball the surface) before an item flips to DONE.

## LANE OWNERSHIP
- **UI/UX (this workstream):** components, pages, client-side wiring to data-access
  functions, visual + interaction surfaces. This is what these files update.
- **Backend (Claude Code):** all database work — migrations, tables, RLS, RPCs, the
  auth state machine backend, seed/real-data plumbing, and verifying policies.
- Where the UI reads/writes data, the item names the client function or RPC it calls
  (the "backend contract" the UI expects). Claude Code owns making those resolve; this
  workstream owns that the UI calls them correctly and renders the result.

Status legend:
- [x] DONE — implemented AND verified in code (compiles; wiring present).
- [~] PARTIAL — structure/read path done; a write path or sub-flow remains.
- [ ] TODO — not built.
- [cc] BACKEND (Claude Code) — the data/DB half of this item; out of UI scope. Listed so
  the UI's expected contract is visible, not as a UI task.

How to verify UI (run from repo root):
- Typecheck: `npx tsc -p tsconfig.app.json --noEmit` (must be clean)
- Build: `npx vite build` (must succeed)
- Wiring spot-checks: grep for the function/route named in each item.

Last verified: full pass — typecheck clean, build succeeds.

---

## 1. App structure / navigation
- [x] App collapses to two rider surfaces: Main (dashboard + community) and Account.
      (Home.tsx = main; AccountHub.tsx = /app/account; both routed in App.tsx.)
- [x] Rider nav = avatar menu only, no rail. (AppLayout: showRail=isStaff → riders false.)
- [x] Instructor/admin = persistent desktop LEFT RAIL for management, always visible
      incl. on Main. (AppLayout <aside> gated by showRail; rail includes Main.)
- [x] Rail collapses into the avatar menu on mobile. (AppLayout: manageItems block under `lg:hidden` in menu; <aside> is `hidden lg:block`.)
- [x] Header: logo mark + wordmark on desktop, mark-only on mobile. (AppLayout header: mark always, wordmark `hidden sm:inline`.)
- [x] Logo taps to Main from anywhere. (Link to="/app".)
- [x] Universal create "+" in header for every user type. (AppLayout create button → CreateModal, not staff-gated.)
- [x] "+" has no outline; extra spacing between header buttons. (borderless; gap-3.)
- [x] Calendar icon stays in the header. (AppLayout calendar button → CalendarModal.)
- [x] Notifications folded into the avatar badge. (bell.count badge on avatar; no separate bell button.)
- [x] Avatar menu holds: Main, Account, Quick access (book/shop/message), Sign out.
- [x] Super-admin platform items (feature flags, registry, organizations, provision)
      gated to SUPER_ADMIN, not admin. (MANAGE_NAV superAdmin flag + visibleManageNav.)
- [ ] Resolve "Book" nav → authenticated state open question. (Deferred.)

## 2. Main page (dashboard + community)
- [x] Dashboard panel above the feed: only Needs-attention (gold) + Coming up. (DashboardPanel.)
- [x] Panel has its own background + drop shadow to stand out. (gradient + shadow classes.)
- [x] No "freshest per category" digest band. (removed.)
- [x] No quick-access on the page (moved to menu). (not present in Home.)
- [x] Heading "Your Dashboard"; feed heading "Your Community". (Home.tsx.)
- [x] Feed = one filterable stream with View + Sort dropdowns (no pill row). (FeedControls.)
- [x] View is single-select, order: All, Social, Discussions, For Sale, Events,
      Articles, Resources, Members. (seed.ts FEED_VIEWS.)
- [x] Sort options depend on the active View. (SORT_OPTIONS keyed by view; resets on view change.)
- [x] For Sale sort = Horses / Gear / Free. (SORT_OPTIONS.for_sale.)
- [x] Per-view new-item COUNT badges; All has no total. (FeedControls badges; all → undefined.)
- [~] Counts = unseen-in-feed (seen when the item appears in viewport, any view).
      UI reads real seen flag from feed_get for social/for-sale. Reference views show
      no badge until a per-item seen-state exists. [cc] per-source seen ledger.
- [x] Same two dropdowns on desktop AND mobile. (FeedControls is responsive, one component.)
- [x] Adaptive per-view layouts: Members→roster, For Sale→square grid,
      Articles→reading list, Resources→listing cards, else→cards. (CommunityFeed.)
- [x] Members roster has tap-to-contact buttons. (ContactButtons in CommunityFeed.)
- [x] Tap-to-contact launches external clients (mail/WhatsApp/SMS/call). Real hrefs
      (mailto:/wa.me/sms:/tel:) from contact fields, only for allowed+present methods.
      (src/lib/contact.ts + ContactButtons in CommunityFeed.) [cc] widen directory RPC
      to expose members' shared contact fields (UI falls back to seed for now).
- [x] Feed federates real sources per view. (communityFeed.ts fetchViewCards.)
- [x] Create/shop happen in modals over the page. (CreateModal overlays; header +.)

## 3. Create flow
- [x] Two-step: destination → (community post) post type → minimal per-type form. (CreateModal.)
- [x] Post types: Social / For Sale / Event / Discussion. (POST_TYPES.)
- [x] Upload-one-media + description; discussions need no media. (needsMedia logic.)
- [x] Submits wired: Social/For-Sale→feed_post_create+upload; Discussion→createThread;
      Event→proposeEvent. (verified by grep.)
- [x] "paste-social-link-to-generate-a-post" concept is dead. (not present.)
- [~] Booking / shop / message from create → route to their pages (real flows there).
      Routes wired; those destination flows are the repo's existing pages.

## 4. Calendar
- [x] In header, opens a modal. (CalendarModal.)
- [x] Aggregates everything with a date regardless of RSVP. (lessons+events live.)
- [~] Includes payments/billing due, confirmations, expirations. Kinds + rendering DONE;
      live payment/expiration/confirmation sources = seed now, real wiring TODO.

## 5. Account (the "me" surface)
- [x] Reached from avatar menu; grouped You / Billing & orders / Help. (AccountHub.)
- [x] Contact info: Email (always), Mobile, WhatsApp — each with hide-from-community;
      Mobile/WhatsApp with Text/Call checkboxes. (ProfileSection.)
- [x] No extra "Phone" label; fields are Email/Mobile/WhatsApp. (labels correct.)
- [x] Social accounts are a SEPARATE section: TikTok/Instagram/Facebook/LinkedIn. (ProfileSection socials.)
- [x] Notification preferences (payment reminder 3-days etc.). (ProfileSection notifications.)
- [x] Login & security rows: change email, password. (ProfileSection.)
- [x] Old feed view-shape preference removed (obsolete). (not present.)
- [x] My posts (manage view) — distinct from Directory read-only view. (row present.)
- [x] Saved items row. [x] Documents row. (present.)
- [x] My Stable: horses, gear, supplies; reads LIVE rows. (StableSection + stable.ts.)
- [x] Stable items can link a vendor (click-through). (vendor link rendered.)
- [x] Membership includes monthly / annual / pay-as-you-go. (seed + SORT copy; membership row.)
- [x] Gifts in Account. (row present.)
- [x] Billing / Orders / Payment method rows. (present.)
- [x] Support row; Sign out here and in avatar menu. (present.)
- [~] Every "add" uses a purpose-built form (horse/gear/vendor/gift/payment). Horse/
      gear/supply/vendor Add forms + writes DONE (StableEditors.tsx). Gift/payment
      forms = TODO (§7).
- [cc] My Stable backend. CORRECTED (see HANDOFF-horse-records.md): use the EXISTING
      horse records table — do NOT create stable_horses/stable_horse_parties. Horses,
      the horse intake form, the horse account section, and the listing<->record wiring
      are the OTHER (agreements) thread's domain; owner/lessee/lessor party data on the
      record controls account visibility + listing rights (admins/instructors exempt).
      KEEP from my work: vendors + stable_items (gear/supply). stable.ts horse fns
      re-point to the existing table filtered by party; vendor/item fns unchanged.
- [x] Vendor model: pick from Resources directory OR add new via same form, optional
      share-back to Resources. (VendorPicker in StableEditors: select existing OR add
      new via addVendor with "Add to community Resources" toggle.) [cc] vendors table +
      Resources reading the shared rows.

## 6. Roles / tenancy
- [x] Rider = USER; Instructor = MANAGER/EMPLOYEE; Admin = ADMIN; Super = SUPER_ADMIN.
      (AuthContext role derivation.)
- [x] Instructor sees Main + servicing rail; Admin adds tenant-admin pages; Super adds
      platform layer. (visibleManageNav adminOnly/superAdmin filters.)
- [x] This deployment is a TENANT — platform mgmt is super-admin only. (superAdmin gate.)
- [x] Admin can promote an activated user to Instructor (role bump). (adminSetRole + Admin Role dropdown.)
- [cc] RLS must allow admin UPDATE of profiles.role (or add SECURITY DEFINER
      admin_set_role). UI contract: adminSetRole(userId, role) in src/lib/admin.ts.

## 7. Explicitly NOT done yet (next chunks, in suggested order)
- [x] My Stable Add/Edit modals (write): addStableHorse/addStableItem/addVendor +
      vendor-from-Resources picker with share-back. (StableEditors.tsx — DONE this chunk.
      Edit/delete of existing rows still TODO; Add + vendor share-back done.)
- [x] Tap-to-contact real hrefs (mailto/wa.me/sms/tel) — DONE (contact.ts).
- [ ] Per-item seen-state for discussions/events/articles → real unseen badges there.
- [x] Email-change UI: @gmail / "Google-hosted" checkbox branch; Google path = re-auth
      panel (no verification email); non-Google path = set password (clear text, shown,
      matched) + "verification sent, check spam" state; standalone /verify-email screen
      to finish. (EmailChangeModal.tsx + VerifyEmailScreen.tsx; wired from AccountHub;
      /verify-email routed.) Seams marked "⇢ WIRE". [cc] pending current/new/old columns,
      tokens, atomic promotion, Google detection, and connecting the 3 seam callbacks.
- [x] Gifts UI: list of gifts given w/ status, resend / reschedule / transfer / claim-
      link actions (GiftsPanel in AccountPanels.tsx; expands from Account). Actions are
      "⇢ WIRE" seams. [cc] gift/credit records + action endpoints.
- [x] Saved items UI (SavedPanel: articles/listings/links w/ empty state) + Documents-
      as-paper (DocumentsPanel + PaperViewer: sheet w/ shadow, page edges, page breaks,
      pager). Both expand from Account. [cc] saved records + real document sources.
- [ ] Calendar UI already renders all kinds; [cc] real payment/expiration/confirmation
      sources to replace seed.
- [x] Instructor & admin management: admins land on the full tenant OpsDashboard
      (KPIs + module launcher, already in repo); trainers land on a purpose-built
      servicing home (InstructorHome: today's + upcoming lessons, quick servicing
      actions, client/request counts). Role split via OpsHome at /app/ops. The deeper
      ops pages (contacts/horses/engagements/intake/availability/lessons/etc.) are the
      repo's existing built pages, reached through the rail.
- [x] Seed teardown SQL: supabase/migrations/20260710040000_seed_data_teardown.sql —
      idempotent, marker-based demo-row removal to run after testing. [cc] to apply.
- [ ] For-Sale "Free" as first-class (flag/price=0) instead of gear w/ empty price.
- [ ] Retire seed.ts once [cc] sources return real rows (flip SEED_ENABLED=false, then
      delete). Seed is a UI-side preview fallback only.

## 8. Cross-cutting rules to keep honoring
- [x] Warm light theme; green as ink/accent; gold warmth. (uses repo tokens.)
- [x] Mobile: framed, single scroll, no nested scroll regions. (shell = one main scroll.)
- [x] Documents render as paper (shadow, page edges, page breaks, pager). (PaperViewer.)
- [x] No surface shows the same "latest" twice. (pages folded into feed filters.)
- [x] One nav pattern (avatar menu); desktop/mobile differ by density + logo + rail.
