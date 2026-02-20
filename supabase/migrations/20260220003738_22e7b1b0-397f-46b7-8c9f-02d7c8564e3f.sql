
DROP POLICY "Posts are viewable when approved or by owner" ON public.posts;

CREATE POLICY "Posts are viewable when approved, pending review, or by owner"
ON public.posts FOR SELECT
USING (
  status = 'approved'
  OR status = 'pending_review'
  OR auth.uid() = user_id
);
