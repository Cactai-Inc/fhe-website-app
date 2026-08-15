-- Owner, 2026-08-14: the 1x Weekly card's title gains "Lesson".
UPDATE offerings SET name = '1x Weekly Lesson'
WHERE service_type = 'RIDING_LESSON' AND name = '1x Weekly';
