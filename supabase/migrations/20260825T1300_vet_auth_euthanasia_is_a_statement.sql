/* CR-69 — the Emergency Vet Authorization states the euthanasia position; it does
   not ask the client to choose it.

   Owner, 2026-08-25: "the authorisation in the emergency vet auth is not a choice
   though correct? I instructed that to be added to the vet auth as a statement of
   'we will follow this approach'" and then, on being shown the live text:
   "remove that, there is no choice, item 7 covers it."

   Section 7's OWN FIRST LINE already states the position — "COMPANY may not
   authorize euthanasia without CLIENT approval" IS the old Option B. The document
   stated the policy and then asked the client to pick it. The intake block that fed
   the two checkboxes was removed the same day, so leaving them would render
   "select ONE (required)" above two permanently empty boxes.

   The {{HORSE.EUTHANASIA_A}} / _B tokens are left defined and unused (D32). */
UPDATE contract_templates
   SET body = replace(body,
E'CLIENT must select ONE of the following (required):\n[ {{HORSE.EUTHANASIA_A}} ]  Option A — I AUTHORIZE the attending veterinarian to perform humane euthanasia if, in the veterinarian\'s professional judgment, it is necessary to relieve the Horse\'s suffering and I cannot be reached in time.\n[ {{HORSE.EUTHANASIA_B}} ]  Option B — I DO NOT AUTHORIZE euthanasia without my express consent. Every reasonable effort must be made to reach me or my emergency contact before any such decision, except where required by law.\n\n',
E'Every reasonable effort will be made to reach CLIENT, or CLIENT\'s emergency contact, before any such decision is taken, except where required by law.\n\n'),
       updated_at = now()
 WHERE template_key = 'HORSE_EMERGENCY_VET'
   AND deleted_at IS NULL
   AND body LIKE '%CLIENT must select ONE of the following (required):%';
