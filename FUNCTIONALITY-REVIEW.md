# Functionality Review — French Heritage Equestrian
**Date:** June 21, 2026  
**Method:** Source review + tsc + ESLint + cross-reference against design review, accessibility audit, and architectural notes.  
**TSC result:** Clean (0 errors).  
**ESLint result:** 8 errors, 1 warning — all pre-existing, none introduced by this review.

---

## Part A — Confirmed Issues

### ISSUE-01 · SET_FUNNEL wipes the cart silently on funnel switch
**File:** `src/contexts/CartContext.tsx:54`  
**Current:** `case 'SET_FUNNEL': return { ...initialState, funnel: action.funnel };`  
`initialState` has empty `items` and `qualifierAnswers`, so dispatching SET_FUNNEL returns a blank slate.  
**When it fires:** Every `BookRider`, `BookHorse`, and `BookSupport` page calls `setFunnel()` inside a `useEffect` on mount (BookRider:98, BookHorse:95, BookSupport:102). Navigating to any of those routes — including via cross-sell links — triggers the reset immediately.  
**Impact:** A user who completes Rider selections, then follows the "Explore Rider Support" cross-sell link to `/book/support`, loses all Rider selections the moment that page loads. The cross-sell copy ("add these today") is undeliverable.  
**Proposed fix:** Change SET_FUNNEL to preserve `items` and `qualifierAnswers` when the cart is non-empty, or only reset `qualifierAnswers` keyed to the old funnel. The simplest correct behaviour: preserve items across funnel changes; qualifier answers are funnel-specific so clear them, but never clear items silently. Add a `funnelHistory` field so the checkout can display a combined label. If a true "start over" is needed, expose an explicit CLEAR_CART action (already present) and call it deliberately.

---

### ISSUE-02 · Cross-sell links are raw `<a href>` tags that hard-reload the app
**Files:**  
- `src/pages/BookRider.tsx:331` — `<a href="/book/support">Explore Rider Support</a>`  
- `src/pages/BookRider.tsx:345` — `<a href="/book/horse">View Horse Services</a>`  
- `src/pages/BookHorse.tsx:302` — `<a href="/book/support">Learn About Lease Brokering</a>`  
- `src/pages/BookSupport.tsx:361` — `<a href="/book/rider">View Rider Services</a>`  
**Current:** Native `href` anchors. The browser performs a full navigation, discarding React Router's history and the in-memory CartContext state. The cart is lost before the user arrives at the linked page. The linked page then calls `setFunnel()`, which (see ISSUE-01) would also reset items even if the state had survived.  
**Proposed fix:** Replace every `<a href="...">` cross-sell link with React Router `<Link to="...">`. Also address ISSUE-01 so that setFunnel no longer wipes items.

---

### ISSUE-03 · Cross-sell in BookSupport shows horse care to horse-seeking users
**File:** `src/pages/BookSupport.tsx:310–348`  
**Current:** The Review step in BookSupport surfaces HORSE_TRAINING, RIDING_TURNOUT, and HAIR_CLIPPING add-ons unconditionally (with only a light experience filter). A user in the Support funnel is by definition seeking to acquire a horse — they do not yet have one. Recommending training and turnout services for a horse they don't own yet is premature and confusing.  
**Impact:** The cross-sell displays irrelevant services to the primary audience of the Support funnel, undermining trust.  
**Proposed fix:** Gate horse-care cross-sells (HORSE_TRAINING, RIDING_TURNOUT, HAIR_CLIPPING) behind a confirmed-ownership qualifier. These add-ons are appropriate only after the user confirms a horse is acquired or confirmed. The only cross-sell appropriate for the Support funnel review step is RIDING_LESSON (already conditional on `wantsLessons`) and possibly EVALUATION if HORSE_LOCATOR was selected.  
**Dependency:** The qualifier "I now own a horse" is not collected in the Support funnel. Either add it at the end of the qualifier step, or defer the horse-care cross-sell to a post-booking follow-up.

---

### ISSUE-04 · Brokering fee shown as flat $500; billing unit is actually a percentage
**File:** `src/lib/services.ts:283–295` and `src/pages/Checkout.tsx:288–298`  
**Current:** BROKERING's "Purchase Brokering" tier has `price: 500, unit: 'flat'`. The description says "3% of purchase price (minimum $500)" but formatPrice renders it as "$500". The checkout's Estimated Total includes this as a flat $500 line item.  
**Impact:** A buyer purchasing a $30,000 horse would owe $900 (3%), not $500. Displaying "$500" misrepresents the fee and could create a pricing dispute.  
**Proposed fix:**  
1. Add a `'percent'` unit type (already defined in `PriceUnit` at `services.ts:4`) and a separate `minPrice` field to the tier.  
2. In the Estimated Total section, detect percentage-unit items and render them as "3% of purchase price (est. $500 min)" rather than including them in the numeric sum.  
3. Add a note below the Estimated Total when any percentage item is in the cart: "Brokering fee is 3% of the final purchase price (minimum $500); the estimate above reflects the minimum."  
**Note:** The `'percent'` unit is already in the type but the corresponding `formatPrice` case (`return \`${price}% of sale price\``) is not being reached because the tier uses `unit: 'flat'`. This is a data error, not a missing feature.

---

### ISSUE-05 · Cart is in-memory only — a page refresh drops all state
**Files:** `src/contexts/CartContext.tsx` (entire provider)  
**Current:** `useReducer` with no persistence. Any hard refresh, back/forward navigation to an external page, or accidental reload drops the user to an empty cart. This affects any step in the booking funnel and the checkout page.  
**Impact:** A user who navigates away during checkout loses their selection and must start over with no indication of what happened.  
**Proposed fix (scope: sessionStorage):** Wrap the reducer so state is saved to `sessionStorage` on every dispatch and rehydrated on provider mount. This survives refreshes within a browser session and clears automatically when the tab is closed. No backend required. **Flagged as future enhancement unless clean implementation is feasible** — the CartProvider is a single file and the change is contained.

---

### ISSUE-06 · "Services" and "Book" in the nav both route to `/services`
**File:** `src/components/layout/Header.tsx:6–10`  
**Current:**  
```
{ label: 'Our Story', href: '/about' },
{ label: 'Services', href: '/services' },
{ label: 'Book', href: '/services' },
```  
Two nav labels, one destination. A visitor clicking "Book" expecting to enter a booking flow lands on the same Services page they would reach via "Services."  
**Proposed fix:** Owner decision required. Options: (a) remove "Book" from the nav and rely on the "Book Now" CTA button in the top-right; (b) make "Book" deep-link to `/book/rider` (or to a funnel-chooser) if a specific funnel is desired. **Do not implement a guess** — flag for owner.

---

### ISSUE-07 · No 404 route — unknown paths redirect silently to Home
**File:** `src/App.tsx:28`  
**Current:** `<Route path="*" element={<Navigate to="/" replace />} />`  
A mistyped URL or a stale external link silently drops the user at the homepage with no explanation.  
**Proposed fix:** Replace the catch-all Navigate with a dedicated NotFound component. Render a branded 404 page with a link back to Home and to Services.

---

### ISSUE-08 · Focus not managed on step transitions or route changes
**Files:** BookRider (`handleNext`:110–117, `handleBack`:119–126), BookHorse (same pattern), BookSupport (same pattern), `src/App.tsx` (no ScrollRestoration or focus hook).  
**Current:** Step advances call `window.scrollTo({ top: 0, behavior: 'smooth' })` but do not move keyboard focus. Focus stays on the "Continue" button after step advance, meaning the next screen's heading is never announced to screen readers.  
**Proposed fix:** After advancing to a new step, move focus to the step's `<h1>` using a `ref` and `ref.current.focus()`. The heading needs `tabIndex={-1}` to be programmatically focusable. On route changes, apply the same pattern in a `useEffect` keyed on `location.pathname`.

---

### ISSUE-09 · Cart indicator and "Book Now" hidden below `sm` breakpoint
**File:** `src/components/layout/Header.tsx:74–93`  
**Current:**  
- Cart link: `className="hidden sm:flex ..."` — invisible on mobile.  
- Book Now button: `className="hidden sm:inline-flex ..."` — invisible on mobile.  
A mobile user mid-booking has no header access to their cart count or a direct booking entry point. The mobile menu includes a "Book Now" link but no cart indicator.  
**Proposed fix:** Add a cart indicator to the mobile menu when `itemCount > 0`. Alternatively, include the cart icon in the mobile header alongside the hamburger. The Book Now link in the mobile menu already exists (`src/components/layout/Header.tsx:121–126`), so only the cart indicator needs to be added for the mid-booking mobile case.

---

### ISSUE-10 · Estimated Total sums incompatible billing cadences
**File:** `src/pages/Checkout.tsx:284–299`; `src/lib/services.ts` (tier definitions)  
**Current:** `subtotal` (CartContext:140) is a plain sum of all `item.price` values regardless of unit. A cart containing a "$125 / session" lesson, a "$1,095 / month" turnout service, and a "$500 (min, actually 3%)" brokering fee renders as a single dollar total that is arithmetically meaningless.  
**Related:** See ISSUE-04 for the brokering percentage specifically.  
**Proposed fix:**  
1. In the checkout order summary, group items by billing unit and add a sub-label per group (e.g., "Per session", "Per month", "Flat fee").  
2. Show unit-specific subtotals rather than one blended total.  
3. Replace the "Estimated Total" label with "Estimated Costs" and a disclosure note that items billed on different schedules are listed separately.  
4. The brokering percentage item should be excluded from any numeric subtotal (see ISSUE-04).

---

### ISSUE-11 · Document title is "Vite + React + TS" on every route
**File:** `index.html:6`  
**Current:** `<title data-default>Vite + React + TS</title>` — never updated per route.  
**Impact:** Every browser tab shows the same non-descriptive title. Screen readers announce it on page load. Search engines see no meaningful title on any page.  
**Proposed fix:** Set a per-route title using `document.title` in a `useEffect` keyed on route, or install a lightweight hook (`useDocumentTitle`). Suggested titles:  
- `/` → "French Heritage Equestrian — San Diego"  
- `/about` → "Our Story — French Heritage Equestrian"  
- `/services` → "Services — French Heritage Equestrian"  
- `/book/rider` → "Rider Services — French Heritage Equestrian"  
- `/book/horse` → "Horse Services — French Heritage Equestrian"  
- `/book/support` → "Rider Support — French Heritage Equestrian"  
- `/checkout` → "Complete Your Booking — French Heritage Equestrian"  
- `/confirmation` → "Booking Received — French Heritage Equestrian"

---

### ISSUE-12 · Footer email: display text and mailto href differ
**File:** `src/components/layout/Footer.tsx:76–79`  
**Current:**  
```
href="mailto:hello@frenchheritagequestrian.com"
>
  hello@frenchheritage.com
```  
The visible text is `hello@frenchheritage.com`; the link target is `hello@frenchheritagequestrian.com`. One or both is wrong. Neither has been confirmed as the real address.  
**Action required:** Owner must supply the correct address. Do not guess. Both values need to be updated to match. Flag for owner before publishing.

---

### ISSUE-13 · Phone placeholder `(619) 555-0000` used throughout
**Files and lines:**  
- `src/components/layout/Footer.tsx:67,70` — footer contact section  
- `src/pages/Confirmation.tsx:33,34` — post-booking confirmation  
- `src/pages/Checkout.tsx:198` — phone field placeholder text (safe to leave as UI hint, but the other two are displayed as real contact info)  
**Action required:** Owner must supply the real phone number. The Footer and Confirmation instances display the number as real contact info and must be updated before publishing. The Checkout placeholder is a UX hint and can remain a placeholder format, but should use a non-555 area code.

---

### ISSUE-14 · Hero parallax drops the `scale-110` once scrolling starts
**File:** `src/pages/Landing.tsx:46–52, 61`  
**Current:**  
```jsx
<div ref={heroRef} className="absolute inset-0 scale-110" style={...}>
```  
```js
heroRef.current.style.transform = `translateY(${window.scrollY * 0.3}px)`;
```  
The Tailwind class `scale-110` sets `transform: scaleX(1.1) scaleY(1.1)` via CSS. The inline `style.transform` assignment from the scroll handler replaces the entire transform property with a translateY-only value, dropping the scale. After the first scroll event, the image reverts to scale-100 and can reveal background edges.  
**Proposed fix:** Compose both transforms in the scroll handler:  
```js
heroRef.current.style.transform = `scale(1.1) translateY(${window.scrollY * 0.3}px)`;
```  
Remove `scale-110` from the className (it will be in the inline style from the first render cycle, but for the brief initial paint before the scroll handler fires, set a default in the element's `style` prop instead).

---

### ISSUE-15 · No `prefers-reduced-motion` handling
**Files:**  
- `src/pages/Landing.tsx:46–53` — hero parallax scroll handler  
- `src/index.css:166–190` — `animate-fade-up`, `animate-fade-in` keyframe animations (no media query guard)  
- `src/pages/BookRider.tsx:99`, `BookHorse.tsx:96`, `BookSupport.tsx:103` — `window.scrollTo({ behavior: 'smooth' })`  
- `index.html` → `src/index.css:34` — `html { scroll-behavior: smooth; }`  
**Current:** All animations and the parallax run unconditionally. Users who have set "Reduce Motion" in their OS/browser get no accommodation.  
**Proposed fix:**  
1. In the parallax effect, check `window.matchMedia('(prefers-reduced-motion: reduce)').matches` before attaching the scroll listener. If true, skip the listener entirely and leave the image static.  
2. In `index.css`, wrap the `animate-fade-up` and `animate-fade-in` keyframes in `@media (prefers-reduced-motion: no-preference)`. When reduced motion is preferred, these classes should produce no animation (opacity 1, no transform).  
3. In `index.css`, change `html { scroll-behavior: smooth; }` to `@media (prefers-reduced-motion: no-preference) { html { scroll-behavior: smooth; } }`.  
4. In the step navigation handlers, guard `window.scrollTo({ behavior: 'smooth' })` with the same media query check.

---

### ISSUE-16 · Accessibility: tier cards and qualifier buttons expose no selection state
**Files:** `src/pages/BookRider.tsx:58–83` (tier cards), `src/pages/BookRider.tsx:193–202` (qualifier buttons); same pattern in BookHorse and BookSupport.  
**Current:** These are `<button>` elements with visual-only selection indication (border, background). No `aria-pressed`, no `role="radio"` with `aria-checked`, no `role="radiogroup"` grouping the options per question or per service. A screen reader user cannot determine what is selected.  
**Proposed fix:**  
- Tier card buttons: add `role="radio"` and `aria-checked={selected}`. Wrap the set of tiers for each service in a `<div role="radiogroup" aria-label={service.name}>`.  
- Qualifier option buttons: same pattern — `role="radio"`, `aria-checked`, wrapped in a `<div role="radiogroup" aria-labelledby={questionHeadingId}>`.  
- Note: the visual single-select behaviour (TOGGLE_ITEM replaces the existing tier for a service) matches radio semantics correctly.

---

### ISSUE-17 · Accessibility: form errors not linked to fields, not announced
**File:** `src/pages/Checkout.tsx:44–85, 136–202, 230–235`  
**Current:**  
- Errored inputs get `border-red-400` class but no `aria-invalid="true"` and no `aria-describedby` pointing to the error message.  
- Error message paragraphs (e.g., line 149) have no `id` to be referenced.  
- The submit-error banner (line 231) has no `role="alert"` and is not in an `aria-live` region.  
- On failed validation, focus stays on the submit button; no focus move to the first error or an error summary.  
**Proposed fix:**  
1. Add a unique `id` to each error message (e.g., `id="first_name-error"`).  
2. Add `aria-invalid={!!errors.first_name}` and `aria-describedby="first_name-error"` to each errored input (conditional on the error existing).  
3. Add `role="alert"` to the submit-error banner so it is announced immediately when it appears.  
4. On `validate()` returning false, `useRef` to find the first errored input and call `.focus()` on it after state settles.  
5. Add `aria-required="true"` to the three required inputs.

---

### ISSUE-18 · Accessibility: step indicator has no `aria-current`
**Files:** `src/pages/BookRider.tsx:135–148`, same in BookHorse:136–149, BookSupport:143–156.  
**Current:** The step indicator renders `<div>` elements with visual-only active state. No `aria-current="step"` on the active step.  
**Proposed fix:** Add `aria-current={i === step ? 'step' : undefined}` to the active step div.

---

### ISSUE-19 · Accessibility: mobile menu toggle missing `aria-expanded` and `aria-controls`
**File:** `src/components/layout/Header.tsx:97–103`  
**Current:**  
```jsx
<button className="md:hidden text-white p-1" onClick={() => setOpen((v) => !v)} aria-label="Toggle menu">
```  
No `aria-expanded` reflecting open state. No `aria-controls` pointing at the menu. No Escape-to-close. No focus management when opening.  
**Proposed fix:**  
1. Add `aria-expanded={open}` and `aria-controls="mobile-menu"` to the toggle button.  
2. Add `id="mobile-menu"` to the mobile menu div (line 109).  
3. Add a `useEffect` listening for `keydown` Escape when `open === true`, calling `setOpen(false)`.

---

### ISSUE-20 · Accessibility: "Remove item" label is generic
**File:** `src/pages/Checkout.tsx:271–276`  
**Current:** `aria-label="Remove item"` on the X button. When multiple items are in the cart, all remove buttons have identical accessible names.  
**Proposed fix:** Make the label specific: `aria-label={\`Remove ${item.tierLabel}\`}`.

---

### ISSUE-21 · Accessibility: remove button touch target too small
**File:** `src/pages/Checkout.tsx:271`  
**Current:** `<button className="text-green-800/30 hover:text-red-400 transition-colors">`. The icon is 14px (`<X size={14} />`), no padding. Touch target is approximately 14×14px, well under the 44×44px minimum.  
**Proposed fix:** Add `p-2` to the button className (gives a ~30px target — still under minimum, but a meaningful improvement). For full compliance, use `p-3` or add a `min-w-[44px] min-h-[44px]` class.

---

### ISSUE-22 · ESLint errors: unused imports and `any` casts
**Files:**  
- `src/pages/BookSupport.tsx:6–9` — `HORSE_LOCATOR`, `EVALUATION`, `BROKERING`, `RIDING_LESSON` imported but never used in the file.  
- `src/pages/BookRider.tsx:302`, `BookHorse.tsx:268`, `BookSupport.tsx:301`, `Checkout.tsx:269` — `as any` casts on `item.unit`.  
**Proposed fix:** Remove the four unused imports from BookSupport. For the `as any` casts, widen the cast to `as PriceUnit` (the correct type, already imported from `services`).

---

## Part B — Architectural Dependency (Not Implemented)

### DEP-01 · Purchase flow vs. booking request flow
The site operates entirely as a booking request flow (no payment, no auth). The business intent is to eventually enable direct purchase for a small number of offerings that can be transacted without a prior consultation (e.g., a single intro lesson).  
**Blocked on:** Owner confirmation of which specific SKUs are purchasable without a meeting.  
**Status:** Flagged, not implemented. No purchase UI, auth gate, or Stripe integration should be added until the purchasable SKU list is confirmed.  
**When unblocked:** The correct model is — unauthenticated browsing, booking request for most services, direct purchase only for confirmed SKUs, account creation offered post-confirmation pre-filled from checkout form data.

---

## Part C — Items Flagged but Working Correctly

- **Cart `toSelectedServices()`** — Correctly maps cart items to the SelectedService payload expected by `submitBooking`. No issue.
- **Form autocomplete attributes** — `given-name`, `family-name`, `email`, `tel` are all correctly set. No issue.
- **Empty cart guard in Checkout** — Line 88–102 redirects to Services when cart is empty and funnel is null. The condition is slightly permissive (a user with `funnel` set but 0 items can reach checkout), but this is a minor edge case and the submit button is disabled in that state.
- **Checkout uses React Router `Link` correctly** — "Back to Selection" and "Add or modify services" use `<Link to="...">`, not `<a href>`. No reload issue here.
- **Label association in the form** — `htmlFor` and `id` match on all four form inputs. Screen readers can identify the fields. The gap is the missing `aria-invalid`/`aria-describedby` pairing on errors (ISSUE-17), not the base label association.
- **TypeScript compilation** — `tsc --noEmit` exits clean. No type errors.
- **`BROKERING.tiers[0].unit` type** — Technically `'flat'` in the data, which is incorrect (it should be `'percent'`). This is documented as ISSUE-04 (a data error, not a type system error).

---

## Phase 3 Implementation Order

Priority order for fixes:

1. **ISSUE-02** — Convert cross-sell `<a href>` to `<Link to>` (5 lines, no risk)
2. **ISSUE-01** — Fix SET_FUNNEL cart wipe (1-line reducer change + add funnelHistory)
3. **ISSUE-07** — Add 404 page (new component + 1-line route change)
4. **ISSUE-11** — Per-page document titles (useEffect in each page)
5. **ISSUE-14** — Fix hero parallax scale composition
6. **ISSUE-15** — prefers-reduced-motion guards
7. **ISSUE-16** — ARIA roles on tier cards and qualifier buttons
8. **ISSUE-17** — Form error accessibility
9. **ISSUE-18** — Step indicator `aria-current`
10. **ISSUE-19** — Mobile menu `aria-expanded`, `aria-controls`, Escape key
11. **ISSUE-20** — Specific remove button labels
12. **ISSUE-21** — Remove button touch target
13. **ISSUE-22** — ESLint errors (unused imports, `as any`)
14. **ISSUE-04** — Brokering fee display (billing unit data + checkout total)
15. **ISSUE-10** — Checkout total grouped by billing cadence
16. **ISSUE-05** — sessionStorage cart persistence
17. **ISSUE-08** — Focus management on step/route transition
18. **ISSUE-09** — Mobile cart indicator

**Deferred (owner input required):**
- ISSUE-06 — Nav "Book" vs "Services" duplicate destination
- ISSUE-12 — Email address mismatch
- ISSUE-13 — Phone placeholder
- DEP-01 — Purchase flow architecture
