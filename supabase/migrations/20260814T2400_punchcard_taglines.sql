-- Owner, 2026-08-14: punch-card descriptions — "to be used within N days of purchase".
UPDATE offerings SET tagline = '4 riding lessons to be used within 60 days of purchase'
WHERE service_type = 'RIDING_LESSON' AND name = '4-Lesson Punch Card';

UPDATE offerings SET tagline = '8 riding lessons to be used within 120 days of purchase'
WHERE service_type = 'RIDING_LESSON' AND name = '8-Lesson Punch Card';
