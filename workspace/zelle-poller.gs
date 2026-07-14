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
        memo: parsed.memo,
        confirmation: parsed.confirmation,
        pending: parsed.pending,
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
 * Best-effort parse of a bank Zelle notification. Tuned to the Bank of America
 * "Zelle payment" emails (see the samples in SETUP.md), which expose: the
 * sender NAME ("Your Zelle payment from MARY RICHARDSON" / "From MARY
 * RICHARDSON"), the Amount ("$500.00"), a "Message" memo the payer typed
 * ("Pedro"), and a "Confirmation" code ("99ckoboiv"). There is NO payer email
 * or phone in these emails, so name + memo are the identity signals.
 *
 * `pending` is TRUE for the "pending review / we're reviewing / attempted to
 * send" emails — the money is NOT deposited yet, so the server queues (never
 * auto-confirms) those; the later "deposited" email confirms.
 *
 * Returns { sender, amount, reference, memo, confirmation, pending }.
 */
function parseZelle_(subject, body) {
  var text = (subject || '') + '\n' + (body || '');

  // Amount, e.g. "$500.00"
  var amount = null;
  var amtMatch = text.match(/\$\s?([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]{2})?)/);
  if (amtMatch) amount = parseFloat(amtMatch[1].replace(/,/g, ''));

  // Sender name — "payment from NAME" or a "From: NAME" table row. Case-
  // sensitive on the NAME (uppercase-initial words) so it stops at trailing
  // lowercase words like "is pending"; matches both "from" and "From".
  var sender = null;
  var m = text.match(/[Ff]rom[\s:]+([A-Z][A-Za-z.'-]+(?:\s+[A-Z][A-Za-z.'-]+){0,3})/);
  if (m) sender = m[1].trim();

  // Memo — the "Message" row (what the payer typed, e.g. "Pedro").
  var memo = null;
  var memoMatch = text.match(/\bMessage\b\s*[:\n]\s*([^\n]{1,80})/i);
  if (memoMatch) memo = memoMatch[1].trim();

  // Confirmation code, e.g. "99ckoboiv".
  var confirmation = null;
  var confMatch = text.match(/\bConfirmation\b\s*[:\n]\s*([A-Za-z0-9]{6,})/i);
  if (confMatch) confirmation = confMatch[1].trim();

  // Explicit FH-code reference, if the payer used one (memo passthrough).
  var reference = null;
  var refMatch = text.match(/\b(FH-[A-Z0-9]{4,6})\b/);
  if (refMatch) reference = refMatch[1];

  // Under-review emails are NOT deposits — flag so the server never confirms.
  var pending = /pending review|we['’]?re reviewing|we are reviewing|attempted to send/i.test(text);

  return {
    sender: sender, amount: amount, reference: reference,
    memo: memo, confirmation: confirmation, pending: pending,
  };
}
