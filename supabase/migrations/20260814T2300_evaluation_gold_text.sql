-- Owner, 2026-08-14: Evaluation Lesson gold line describes the extended format.
UPDATE offerings SET note = 'Extended lesson format includes time for horsemanship overview and riding evaluation for future lesson planning'
WHERE service_type = 'RIDING_LESSON' AND name = 'Evaluation Lesson';
