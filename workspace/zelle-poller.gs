/**
 * French Heritage Equestrian — Zelle notification poller (Google Apps Script)
 *
 * Approach A from architecture-flow-spec.md: poll Gmail for labeled Zelle
 * notifications every minute and POST the parsed details to the Vercel
 * reconciliation endpoint, then relabel as processed so each is sent once.
 *
 * SETUP (see SETUP.md for full steps):
 *  1. In Gmail, create a filter matching the bank's Zelle "received money" emails
 *     and apply the label `ZelleIncoming`. Create a `ZelleProcessed` label too.
 *  2. Paste this into script.google.com (signed in as the inbox owner).
 *  3. Set Script Properties: RECONCILE_URL and INGEST_SECRET (Project Settings →
 *     Script properties), matching the Vercel env (ZELLE_INGEST_SECRET).
 *  4. Add a time-driven trigger on `pollZelle` to run every minute.
 */

function getProp_(key) {
  var v = PropertiesService.getScriptProperties().getProperty(key);
  if (!v) throw new Error('Missing script property: ' + key);
  return v;
}

function pollZelle() {
  var incoming = GmailApp.getUserLabelByName('ZelleIncoming');
  var processed = GmailApp.getUserLabelByName('ZelleProcessed');
  if (!incoming || !processed) {
    Logger.log('Labels ZelleIncoming / ZelleProcessed must exist.');
    return;
  }

  var url = getProp_('RECONCILE_URL');
  var secret = getProp_('INGEST_SECRET');

  // Limit to recent threads to keep each run small.
  var threads = incoming.getThreads(0, 20);
  threads.forEach(function (thread) {
    var messages = thread.getMessages();
    messages.forEach(function (msg) {
      var parsed = parseZelle_(msg.getSubject(), msg.getPlainBody());
      if (!parsed.amount) return; // skip if we couldn't read an amount

      var payload = {
        sender: parsed.sender,
        amount: parsed.amount,
        reference: parsed.reference,
        rawSubject: msg.getSubject(),
        rawBody: msg.getPlainBody().slice(0, 4000),
        sourceInbox: Session.getActiveUser().getEmail(),
      };

      var res = UrlFetchApp.fetch(url, {
        method: 'post',
        contentType: 'application/json',
        headers: { 'x-fhe-secret': secret },
        payload: JSON.stringify(payload),
        muteHttpExceptions: true,
      });

      Logger.log('Posted notification, status ' + res.getResponseCode());
    });

    // Relabel the whole thread so it is not sent again.
    thread.removeLabel(incoming);
    thread.addLabel(processed);
  });
}

/**
 * Best-effort parse of a bank Zelle notification. The exact wording varies by
 * bank; adjust the regexes to match your bank's "received money" email.
 * Returns { sender, amount (number), reference (memo) }.
 */
function parseZelle_(subject, body) {
  var text = (subject || '') + '\n' + (body || '');

  // Amount, e.g. "$350.07"
  var amount = null;
  var amtMatch = text.match(/\$\s?([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]{2})?)/);
  if (amtMatch) amount = parseFloat(amtMatch[1].replace(/,/g, ''));

  // Sender name, e.g. "from John Smith"
  var sender = null;
  var senderMatch = text.match(/from\s+([A-Z][A-Za-z.'-]+(?:\s+[A-Z][A-Za-z.'-]+){0,2})/);
  if (senderMatch) sender = senderMatch[1];

  // Reference/memo, e.g. "FH-7K2Q" (memo passthrough depends on the bank).
  var reference = null;
  var refMatch = text.match(/\b(FH-[A-Z0-9]{4,6})\b/);
  if (refMatch) reference = refMatch[1];

  return { sender: sender, amount: amount, reference: reference };
}
