# TASK PARTYJOURNEY — the whole path, email link to signature

**Owner spec, 2026-08-09, captured near-verbatim.** This is a product flow, not a defect.
It is LARGE — expect to break it into phases and stop for owner review between them.

Depends on `TASK-INVITELINK` (one link to the document, auth as an interstitial, the token as
a claim on a party slot). Read that first; it is the front door to everything here.

---

## Why both cases exist

> "The only way a person is on a contract as a party with the linked info from their profile
> is that they are in the system. But we also need to be able to send a contract to a person
> without an account — invite someone to claim this party."

**Scenario A — the rider.** Someone signs up as a client to take lessons, introduced by a
horse owner, and will lease that owner's horse to ride in lessons. The owner asks FHE to
handle the contract. The rider is assigned the **Rider documents (4)**: medical
authorisation, policies, rules, liability release.

**Scenario B — the horse owner.** FHE finds a horse for a rider already in the community. The
owner is NOT in the system. FHE does the evaluation, helps negotiate basic terms, builds the
contract for both parties, and sends it to the owner. The owner is assigned the **Horse Owner
documents (4)**: veterinary authorisation, policies, rules, liability release.

**Same experience, different workload.** The rider opens the contract and finds fields only
the horse owner can complete — until that happens there is little for them to contribute,
unless FHE already had the information and configured it before sending.

---

## 1. Entry — three doors, one destination

They click the link in the email and land in one of:

- **A** — an existing browser with an active session
- **B** — the login page
- **C** — the activation page (create a login)

All three end in the same place: **the contracts page with their contract open, and a modal
over it.**

## 2. The welcome modal

Shows a welcome notice, introduces the contract and the UI, and — **if they have documents to
complete** — tells them to go to the dashboard once they have finished reviewing the contract.

### For a horse owner who is NOT in the system: three pages, not closable

The modal **cannot be dismissed**. They advance with **Next**:

1. Welcome / introduction
2. **Capture their personal information**
3. **Horse intake fields**

Then **Continue** — the modal closes and the contract is shown **with all their information
already in it.**

## 3. In the contract

- **Every area they are responsible for is HIGHLIGHTED.** This does not exist yet and must be
  built.
- They review, make selections, and ideally complete all their required sections in this one
  visit.
- They **send themselves a copy** — a PDF draft for their records.
- Then they click through to the dashboard.

## 4. The dashboard

- **Newly activated account** → treat it as a first login and show the **app overview modal**.
- **Otherwise** → the dashboard with a modal listing their **remaining documents**.

## 5. The document set

- Clicking any document opens it to review and sign.
- **A button at the bottom advances to the next document in the set.**
- **A tracker at the top** shows the current document by name, then each remaining document
  **in the order they will be presented**. The order is set by the system, based on the
  document currently being viewed.
- They advance through all of them. At the exit they click **Continue**, and **one email**
  sends copies of all the documents together. (The contract PDF was already emailed
  separately.)
- After that they are free to explore the rest of the app.

## 6. What has to be built for assignment

**The ability to assign additional documents to a party** — the Rider set or the Horse Owner
set — at the point the contract is sent.

Assignment already exists as `contact_required_documents` (see `CLAUDE.md`); what is missing
is choosing a set for a party while sending a contract.

## 7. Completion detection and the hand-back

> "The only thing we need to figure out is how we can auto detect when a party has completed
> all their required sections and alert the other party automatically."

- **Detect** when a party has completed every section required of them.
- **Automatically notify the other party** with a status update and a link to the document.
- That link is again the straight path — **login if needed, then the contract open on load**.
- **Their sections are highlighted.**
- **If all they need to do is sign**, a banner at the top instructs them to review the
  document carefully before signing.
- **Anything changed since their last viewing is highlighted in a DIFFERENT colour** from
  their assigned sections.

## 8. After signature

Auto-generate the PDF.

---

## The owner's two questions — ANSWERED FROM THE CODE

> "Do the comments and requests threaded messages get added as PDF pages that follow the end
> of the contract pages? Can we add a separate set of choices to the send modal where they can
> send a copy of those things to themselves or someone else?"

**Today: no, and this is by design.** There is **no server-side PDF generator**. The PDF comes
from the browser's own print dialog — the document viewer adds a `printing` class to `<body>`,
calls `window.print()`, and removes it after. While that class is set, **only the
`.print-document` subtree prints**: the title/reference header, the merged contract body and
the executed-signature summary. Everything else is visibility-hidden, and `.print-hidden`
collapses screen chrome so it leaves no blank pages.

Comments and requests live in subheader drawers **outside `.print-document`**, so they are
excluded.

**Both asks are buildable:**

- **Threads as trailing pages** — render them as `.print-only` blocks appended inside
  `.print-document` after the contract body, so they follow the contract pages.
- **Send-modal choices** — an additional set of options for sending the threads, to
  themselves or to someone else.

**But note what this means for §8.** "Auto-generate the PDF after signature" cannot use the
print dialog — that requires a person and a browser. **Automatic PDF generation is a
server-side capability this app does not have**, and it is a prerequisite for §8 and for the
one-email document set in §5. Size that before promising it.

---

## Phasing — proposed, owner to confirm

Do not attempt this in one pass.

1. **Entry + welcome modal** (depends on `INVITELINK`)
2. **The unknown-horse-owner capture flow** — the 3-page non-dismissable modal
3. **Responsibility highlighting** in the contract
4. **Document assignment** at send time
5. **The document set journey** — tracker, advance, single email
6. **Completion detection + hand-back notification**
7. **Change highlighting since last view**
8. **Server-side PDF** — prerequisite for auto-generation; may need to come earlier

## Constraints

- `ClauseDocument.tsx` is FROZEN — highlighting will need a scoped exception, granted by the
  orchestrator, not assumed.
- Sarah's document `704c8d2d-…` is a LIVE NEGOTIATION — read-only, never write.
- Own git worktree, never `~/Desktop`.
