
-- Add status column to posts (approved by default for backward compat)
ALTER TABLE public.posts ADD COLUMN status text NOT NULL DEFAULT 'approved';

-- Drop existing SELECT policy
DROP POLICY "Posts are viewable by everyone" ON public.posts;

-- New policy: only approved posts visible publicly, owners see all their posts
CREATE POLICY "Posts are viewable when approved or by owner"
ON public.posts
FOR SELECT
USING (status = 'approved' OR auth.uid() = user_id);
