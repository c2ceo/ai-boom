
CREATE TABLE public.post_originals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  original_image_url text,
  original_video_url text,
  original_caption text,
  saved_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(post_id)
);

ALTER TABLE public.post_originals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view originals" ON public.post_originals
  FOR SELECT USING (true);

CREATE POLICY "Service role manages originals" ON public.post_originals
  FOR ALL TO service_role USING (true) WITH CHECK (true);
