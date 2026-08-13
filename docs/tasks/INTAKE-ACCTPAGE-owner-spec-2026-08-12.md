# INTAKE — ACCTPAGE — the owner's account-page spec, captured verbatim

**Status: QUEUED, NOT AUTHORED.** Owner, 2026-08-12: *"add that to the list, do not do it now."*
This file is the full-fidelity capture. The measured TASK spec gets authored when the owner
opens this lane — after FLOWTRACE reports, per the standing hold.

**The surface:** `src/pages/app/AccountHub.tsx` (located by its copy strings; the only file
containing "Here's everything that's yours" and "visible to community").

---

## THE OWNER'S WORDS — 2026-08-12, verbatim

> updates to the account page for users:
>
> 1. Remove "Here's everything that's yours"
> 2. set the padding between "ACCOUNT" and the cards to a comfortable amount
> 3. when a card is clicked, have the card itself (the clicked element) extend to full width as
>    the content is revealed in the space below.
> 4. change the arrow icon shown when the card is expanded to a left arrow, right now its a down
>    arrow.
> 5. Move the edit profile button to the top right of the card, inside the header, to the right
>    of the badge with "visible to community", and change the badge text to "your member
>    profile", and remove the word profile from the edit button.
> 6. we got rid of the mint green for the avatar and we got rid of it globally, the badge for
>    preferred contact method should not be a badge it should be a mention under the preferred
>    method listed below that simply says "Preferred" then move the "member since" text up into a
>    badge in place of the badge that says "prefers...". We dont need the avatar to be shown, we
>    need the name large and in charge, with their designation (category) shown as it is now,
>    Horse Owner for CJ cjzigs@icloud.com test account, and these should be stacked with the
>    horse name listed next to the horse owner designation. so it would say "RIDER" and below
>    that it would say "HORSE OWNER" and below that it would say "My Stable - Beau, Peeps, Tiz"
>    Clicking the name of the horse should open the public profile for that horse, which should
>    list their public information: color, breed, age, how long ive owned the horse, specialties,
>    experience, name, nickname, location, photo, and any photos anyone has posted to the
>    community feed with that horse in it (tagged manually but either owner or poster).
> 7. Account information: Rename the Contact Phone (for calls) to "Mobile Number" (rename is
>    probably the right approach due to wiring of the contact number vs mobile number field
>    instead of just moving the mobile number field over into that position, but worth tracing
>    the wiring for both fields first). Then hide the mobile number field behind the checkbox and
>    change the text thats shown above it so it says "Preferred number for texting". then move
>    the field below the contact (renamed to mobile number). Show their email in the spot to the
>    right of the main phone number labeled Account Email (used for login and company
>    correspondence) Then using the same checkbox approach, allow them to add another email for
>    correspondence purposes. the checkbox should be shwon directly below the info its creating
>    an alternate version of, so phone under phone and email under email, instead of a checkbox
>    lets us a small + icon and make it a button that turns that space into the input field. this
>    stacks phone and email in a column and places phone and email columns next to each other.
>    the mailing address shouldnt be full width, its too wide on desktop and it uses rounded
>    corners on its fields where the others above and below it are square corners, i like th
>    square corners so lets stick with that. Date of birth doesnt need to be a full width field
>    on desktop either, and the zelle phone and email belong up in the section at the top above
>    the mailing address with the other phone and emails, birthdate should be listed directly
>    below that. to the right of the birthdate is the selection menue for contact preference, and
>    the nthe two emergency contacts can be listed as half width row cards with square corners
>    below the address field.
>
> Lets implement these changes first, then we can move on to the other cards sequentially, also,
> the sequence listing order for the cards on the account page should be reevaluated and revised
> as our final task on this page before we call it locked.

---

## NOTES FOR THE FUTURE SPEC AUTHOR — capture only, nothing here is settled

- **Sequencing the owner set:** these two cards (member profile + Account information) FIRST,
  then the other cards **sequentially**, then a final resequencing pass on card order — and only
  then is the page **locked**. That is at least three stages; do not collapse them into one task.
- **Item 7 explicitly orders a wiring trace before the rename** — contact-phone vs mobile-number
  fields. TASK-PROFILE (2026-08-05, commit 15e4ed3) added internal-only `contacts` columns; that
  report is the starting point for the trace.
- **Item 6 contains a buried feature, not a tweak:** a **public horse profile page** (color,
  breed, age, ownership duration, specialties, experience, name, nickname, location, photo)
  **plus community-feed photos manually tagged with the horse by owner or poster** — horse
  tagging on feed posts likely does not exist and must be measured. The spec author should
  surface this to the owner as its own scope decision before folding it into a card-styling
  task.
- **Item 6 also asserts mint green was removed globally** — verify the avatar surface actually
  complies before writing the spec ("verify the gate column" lesson).
- **Contended file risk:** `AccountHub.tsx` was ACCOUNTSURFACE's file (task/accountsurface,
  68310fc+02efb58). Confirm that branch is fully merged before any thread touches it again.
