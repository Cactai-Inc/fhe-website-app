-- TASK-LESSONREQUEST §L3 — the activation email names the agreed time, at the top.
--
-- OWNER RULING, 2026-08-17, asked before building §L3:
--   *"One message, one link, and the agreed date and time in writing at the top.
--   A second email is a second thing that can fail independently — and this
--   project has already lost two leads to a send that couldn't report failure.
--   Option 3 leaves the client with nothing in writing until they activate,
--   which is how no-shows happen after a friendly phone call."*
--
-- So: NO second email, and NO new template. The invitation that already goes out
-- in the one act carries the slot. `MSG.AGREED_TIME` is empty for every
-- invitation that has no lesson attached — a plain client invite, a staff
-- invite, a resend — and the {{#if}} makes that block simply not exist, so this
-- changes nothing for any existing send.
--
-- Appended as DATA (D13): the barn can re-word, move or delete this block in the
-- Templates editor without a developer. Guarded so a re-run cannot add it twice.

-- The block is PREPENDED, not appended — "at the top" is the owner's word, and
-- it is the first thing that should be true when the message opens.
UPDATE email_templates
   SET body = $add$
      {{#if MSG.AGREED_TIME}}<p style="margin:0 0 14px;padding:12px 14px;border-left:3px solid #1f4d36;background:#f4f7f4"><strong>Your first lesson is booked for {{MSG.AGREED_TIME}}.</strong><br/>That is the time we agreed on the phone — if anything about it has changed, just reply and we will move it.</p>{{/if}}$add$ || body,
       version = version + 1,
       updated_at = now()
 WHERE email_key = 'INVITATION'
   AND body NOT LIKE '%MSG.AGREED_TIME%';
