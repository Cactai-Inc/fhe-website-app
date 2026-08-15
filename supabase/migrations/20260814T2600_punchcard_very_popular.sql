-- Owner, 2026-08-14: the 4-Lesson Punch Card badge returns as "Very Popular"
-- (renders uppercase like its neighbors: VERY POPULAR / MOST POPULAR / BEST VALUE).
UPDATE offerings SET badge_label = 'Very Popular'
WHERE service_type = 'RIDING_LESSON' AND name = '4-Lesson Punch Card';
