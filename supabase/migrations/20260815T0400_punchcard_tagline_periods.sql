-- Owner, 2026-08-15: standardize card punctuation — every description ends
-- with a period (the punch cards were the two holdouts).
UPDATE offerings SET tagline = '4 riding lessons to be used within 60 days of purchase.'
WHERE service_type = 'RIDING_LESSON' AND name = '4-Lesson Punch Card';

UPDATE offerings SET tagline = '8 riding lessons to be used within 120 days of purchase.'
WHERE service_type = 'RIDING_LESSON' AND name = '8-Lesson Punch Card';
