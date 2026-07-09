/* Slice 3 — feed-media storage bucket (public-read; authenticated write).
   Feed images/videos. Public-read keeps feed rendering simple (posts are
   member-gated at the app layer). Authenticated users upload to their own folder. */
INSERT INTO storage.buckets (id, name, public)
  VALUES ('feed-media', 'feed-media', true)
  ON CONFLICT (id) DO UPDATE SET public = true;

DROP POLICY IF EXISTS feed_media_read ON storage.objects;
CREATE POLICY feed_media_read ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'feed-media');

DROP POLICY IF EXISTS feed_media_write ON storage.objects;
CREATE POLICY feed_media_write ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'feed-media' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS feed_media_update ON storage.objects;
CREATE POLICY feed_media_update ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'feed-media' AND (storage.foldername(name))[1] = auth.uid()::text);
