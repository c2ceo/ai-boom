
-- Add views_count column to posts
ALTER TABLE public.posts ADD COLUMN views_count integer NOT NULL DEFAULT 0;

-- Allow anyone to increment views via the existing increment_count RPC (already SECURITY DEFINER)
-- No additional policy needed since increment_count is a SECURITY DEFINER function
