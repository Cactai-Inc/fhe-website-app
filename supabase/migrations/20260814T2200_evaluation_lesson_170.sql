-- Owner, 2026-08-14: Evaluation Lesson price 150 → 170.
UPDATE offerings SET price_amount = 170.00
WHERE service_type = 'RIDING_LESSON' AND name = 'Evaluation Lesson';
