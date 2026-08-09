/*
  # LEASEFIX 2h — 3.5 is titled "Rider and Other Serious Injuries"

  Owner, 2026-08-09: drop "No" and "History" from the 3.5 title.

  Section 3.5 is one numbered slot served by three mutually exclusive branches,
  only ever one of which renders:

      HORSE.INJURY_HISTORY_PENDING      "Serious Injury History"            (unanswered)
      HORSE.INJURY_HISTORY_NONE         "No Serious Injury History"         (answered NO)
      HORSE.INJURY_HISTORY_DISCLOSED    "Serious Injury History Disclosed"  (answered YES)

  All three are retitled, not just the NONE branch the owner was looking at.
  Dropping "No" is precisely a request that the TITLE stop asserting the answer —
  and "Disclosed" asserts it just as much in the other direction. Leaving the
  siblings alone would mean the section renames itself depending on how the
  question was answered, which is the thing being fixed. The body of each branch
  still says which case applies, so no information is lost from the instrument.

  Reverting the two siblings is a one-line UPDATE if the owner wants the branch
  named in the heading after all.

  Requires PGCLIENTENCODING=UTF8.
*/

UPDATE contract_clause_defs
   SET heading = 'Rider and Other Serious Injuries'
 WHERE template_key IN ('HORSE_LEASE_V2','HORSE_LEASE_STANDARD','HORSE_LEASE_FULL','HORSE_LEASE_SIMPLE')
   AND clause_key IN ('HORSE.INJURY_HISTORY_PENDING',
                      'HORSE.INJURY_HISTORY_NONE',
                      'HORSE.INJURY_HISTORY_DISCLOSED')
   AND heading <> 'Rider and Other Serious Injuries';
