DROP POLICY IF EXISTS "Anyone can view media" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload media" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own media" ON storage.objects;
CREATE POLICY "Users can list their own media" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'media' AND (auth.uid())::text = (storage.foldername(name))[1]);
CREATE POLICY "Users can upload to their own media folder" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'media' AND (auth.uid())::text = (storage.foldername(name))[1]);
CREATE POLICY "Users can update their own media" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'media' AND (auth.uid())::text = (storage.foldername(name))[1])
  WITH CHECK (bucket_id = 'media' AND (auth.uid())::text = (storage.foldername(name))[1]);