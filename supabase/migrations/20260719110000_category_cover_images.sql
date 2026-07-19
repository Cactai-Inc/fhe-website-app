-- Category cover images (served from the app's public/reference-images dir).
UPDATE public.service_types SET cover_image_url = '/reference-images/cover-hair-clipping.jpg' WHERE code = 'HORSE_CLIPPING';
UPDATE public.service_types SET cover_image_url = '/reference-images/cover-horsemanship.jpg'  WHERE code = 'HORSEMANSHIP_TRAINING';
