-- Owner ruling 2026-08-14: the 4-Lesson Punch Card's legacy "Popular" badge
-- comes off — the only badges on the lessons page are 1x Weekly "Most Popular"
-- and 2x Weekly "Best Value" (three badges in six cards was clutter).
UPDATE offerings SET is_popular = false
WHERE service_type = 'RIDING_LESSON' AND name = '4-Lesson Punch Card';
