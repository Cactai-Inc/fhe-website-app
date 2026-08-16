-- Owner, 2026-08-16: the Evaluation Lesson's gold line, rewritten to say what
-- the extended format actually includes.
UPDATE offerings
   SET note = 'This is an extended format riding lesson that includes time to meet the horses, go over horsemanship practices at our stable, and review your riding evaluation at the end to develop your personalized lesson plan.'
 WHERE service_type = 'RIDING_LESSON' AND name = 'Evaluation Lesson';
