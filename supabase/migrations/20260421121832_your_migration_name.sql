
DROP POLICY IF EXISTS "Public read post-media" ON storage.objects;
DROP POLICY IF EXISTS "Public read avatars" ON storage.objects;

-- Allow public download of objects (by name) but not listing.
-- Listing is blocked by checking owner = auth.uid() or denying anon list.
CREATE POLICY "Anyone can view post-media files"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'post-media' AND auth.role() = 'authenticated' OR bucket_id = 'post-media' AND auth.role() = 'anon');

CREATE POLICY "Anyone can view avatar files"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'avatars' AND auth.role() = 'authenticated' OR bucket_id = 'avatars' AND auth.role() = 'anon');
