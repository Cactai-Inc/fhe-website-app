-- Owner, 2026-08-15: every weekly card title carries "Lesson(s)".
UPDATE offerings SET name = '2x Weekly Lessons'
WHERE service_type = 'RIDING_LESSON' AND name = '2x Weekly';

UPDATE offerings SET name = '1x Weekly Lesson (With your horse)'
WHERE service_type = 'RIDING_LESSON' AND name = '1x Weekly (With your horse)';

UPDATE offerings SET name = '2x Weekly Lessons (With your horse)'
WHERE service_type = 'RIDING_LESSON' AND name = '2x Weekly (With your horse)';
