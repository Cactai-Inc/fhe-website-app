# Admin nav — pages, merges, and icon assignment

Built from the live nav tables in `AppLayout.tsx` (2026-08-08). Every icon named here was
verified to exist in the installed `lucide-react`. **Lucide has no horse icon** — barn/stable
metaphors are the only equestrian option.

---

## 1. Every page an Admin sees — 30 destinations

**Always present (5)**
Community Feed · Dashboard · Calendar · Catalog · Messages

**Presence-gated personal (5)** — appear only when the admin has content
My Orders · My Documents · My Stable · My Posts · My Saved Items · (+ Account)

**MANAGEMENT (7)**
Inbound · Support · Lessons · Horses · Documents · Deals · Payment review

**PEOPLE (5)**
Leads · Clients · Contacts · Team · Directory

**COMMUNITY (6)**
Activity · Evaluations · Moderation · Field options · Content store · Oversight

**MODULES (4)**
Boarding · Barn Ops · Records · Employees

**SETTINGS (3)**
Branding · Products · Forms

> Superadmin sees a *different* rail — `PLATFORM` only (Organizations, Feature flags,
> Registry, and the admin-only Branding/Products/Forms). That is the rail with eight
> identical `Shield` icons.

---

## 2. Proposed merges — 30 destinations become 16

| Merged page | Absorbs | Why it is one page |
|---|---|---|
| **People** | Leads · Clients · Contacts · Team · Employees | All five are the same record type separated by a marker. One list with filters, not five routes. **Biggest single win.** |
| **Settings** | Branding · Products · Forms · Field options | Configuration surfaces. Sections on one page. |
| **Documents** | Documents · Records · Evaluations | All document artifacts; they differ by kind, not by nature. |
| **Barn** | Horses · Barn Ops · Boarding | One physical operation. Boarding and Barn Ops are already module-gated views of the same animals. |
| **Oversight** | Moderation · Oversight · Activity | All monitoring. Activity is the log the other two act on. |
| **Content** | Content store · Directory | Both are published/reference material. |

**Left alone:** Community Feed, Dashboard, Calendar, Catalog, Messages, Inbound, Support,
Lessons, Deals, Payment review.

**Deals and Payment review stay separate** — a deal is a contract, a payment is money. They
share a record but not a job.

---

## 3. Categorically ideal icon per page — duplicates allowed at this stage

| Page | Ideal |
|---|---|
| Community Feed | `Users` |
| Dashboard | `LayoutDashboard` |
| Calendar | `CalendarDays` |
| Catalog | `ShoppingBag` |
| Messages | `MessageSquare` |
| Inbound | `Inbox` |
| Support | `LifeBuoy` |
| Lessons | `GraduationCap` |
| Barn | `Warehouse` |
| Documents | `FileText` |
| Deals | `Handshake` |
| Payment review | `Receipt` |
| **People** | **`Users`** ← collides with Community Feed |
| Content | `Library` |
| Oversight | `Eye` |
| Settings | `Settings` |

**Exactly one collision** once the merges are applied: `Users`.

---

## 4. Locked pairs — uncontested, one icon each (14)

| Page | Icon |
|---|---|
| Dashboard | `LayoutDashboard` |
| Calendar | `CalendarDays` |
| Catalog | `ShoppingBag` |
| Messages | `MessageSquare` |
| Inbound | `Inbox` |
| Support | `LifeBuoy` |
| Lessons | `GraduationCap` |
| Barn | `Warehouse` |
| Documents | `FileText` |
| Deals | `Handshake` |
| Payment review | `Receipt` |
| Content | `Library` |
| Oversight | `Eye` |
| Settings | `Settings` |

All fourteen are distinguishable at 18px in one colour with no label — the collapsed-rail
test.

---

## 5. Contested — owner decides

Only two pages remain, competing for `Users`.

### Community Feed
| Option | Reads as |
|---|---|
| `Users` | people gathered — the most literal "community" |
| `Megaphone` | broadcast; leans announcements over conversation |
| `Radio` | a channel/feed; abstract but distinctive |
| `Sparkles` | activity/what's new; least literal |

### People
| Option | Reads as |
|---|---|
| `Contact2` | a contact card — the record, not the person |
| `UserSearch` | finding a person; good for a searchable list |
| `Users2` | same metaphor as `Users`, visibly different glyph |
| `UserCog` | managing people; leans administrative |

### DECIDED — owner, 2026-08-08

- **Community Feed → `Users`** (already the live value; no change needed)
- **People → `Contact2`**

The full assignment is now settled:

| | |
|---|---|
| Dashboard | `LayoutDashboard` |
| Calendar | `CalendarDays` |
| Catalog | `ShoppingBag` |
| Messages | `MessageSquare` |
| Inbound | `Inbox` |
| Support | `LifeBuoy` |
| Documents | `FileText` |
| Deals | `Handshake` |
| Payment review | `Receipt` |
| Content | `Library` |
| Oversight | `Eye` |
| Settings | `Settings` |
| Gifts | `Gift` |
| Community Feed | `Users` |
| People | `Contact2` |
| **Lessons** | **custom — jumping horse with rider, from the logo** |
| **Horse care** | **custom — galloping horse** |

**Nothing is blocking on icon choices any more.** What blocks now:

1. **The merges are not implemented.** `People`, `Documents`, `Barn`, `Oversight`, `Content`
   and `Settings` are proposals — the live nav still has 30 destinations. Most of this
   assignment cannot be applied until they exist.
2. **The two custom icons need artwork.** There is no horse asset anywhere in the repo — the
   only mark in code is `public/favicon.svg`, which is the letters `FH`. The owner must
   supply the logo file, and a literal reduction is unlikely to survive 18px (see the note in
   `TASK-MOBILEPASS` about relief failing below ~36px — same class of problem).
3. **`Horse care` is not a page at all.** See the gap recorded 2026-08-08: the services exist
   in the catalog (Exercise, Training, Turnout, clipping) but have no grouping, label or page,
   and `fulfillment_units` — the obligations ledger such a page would read — holds 7 rows
   total, 1 across all 12 recurring offerings.

---

## If the merges are NOT adopted

The exercise gets much harder: 30 destinations need 30 distinct glyphs, and the natural
metaphors run out fast — five people-pages competing for two or three person icons,
four document-pages competing for `FileText`, `ScrollText`, `ClipboardList`, `Archive`.

**That is worth noting as evidence for the merges**, not just as an icon problem: when a nav
cannot be given distinct icons, it is usually telling you the nav has too many entries, not
that the icon set is too small.
