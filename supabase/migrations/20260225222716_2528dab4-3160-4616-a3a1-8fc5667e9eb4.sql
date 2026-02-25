
-- Create remixes table to track AI remix usage
CREATE TABLE public.remixes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  remix_type TEXT NOT NULL CHECK (remix_type IN ('video', 'song', 'business_idea', 'summary')),
  result_text TEXT,
  result_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.remixes ENABLE ROW LEVEL SECURITY;

-- Users can view their own remixes
CREATE POLICY "Users can view their own remixes"
ON public.remixes FOR SELECT
USING (auth.uid() = user_id);

-- Users can create their own remixes
CREATE POLICY "Users can create their own remixes"
ON public.remixes FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Index for counting daily usage
CREATE INDEX idx_remixes_user_daily ON public.remixes (user_id, created_at);
CREATE INDEX idx_remixes_post ON public.remixes (post_id);

-- Function to get today's remix count for a user
CREATE OR REPLACE FUNCTION public.get_daily_remix_count(p_user_id UUID)
RETURNS INTEGER
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COUNT(*)::INTEGER
  FROM remixes
  WHERE user_id = p_user_id
    AND created_at >= (now() AT TIME ZONE 'UTC')::date;
$$;
