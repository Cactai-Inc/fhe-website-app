/*
  # Lease v2 — signature block uses the recognized "Signature:" format

  The V2 signature block used "Lessee: {{SIG…}}  Date: {{SIG…}}" on one line, which
  the PDF/email signature-styling regexes (which match "Signature:" / "By
  (signature):" line prefixes) don't recognize — so signed names rendered in plain
  body font instead of the signature style. Restructure to the same per-line format
  the flat templates use (LESSOR/LESSEE roles) so signed names render styled in the
  PDF and email, consistent with every other FHE document.
*/
UPDATE contract_clause_defs
   SET body = E'IN WITNESS WHEREOF, the parties have executed this Agreement as of the date first written above.\n\nLESSEE\nSignature: {{SIG.LESSEE.NAME}}\nPrinted Name: {{LESSEE.PRINTED_NAME}}\nDate: {{SIG.LESSEE.DATE}}\n\nLESSOR (OWNER)\nSignature: {{SIG.LESSOR.NAME}}\nPrinted Name: {{LESSOR.PRINTED_NAME}}\nDate: {{SIG.LESSOR.DATE}}'
 WHERE template_key='HORSE_LEASE_V2' AND clause_key='SIGNATURES.BLOCK';
