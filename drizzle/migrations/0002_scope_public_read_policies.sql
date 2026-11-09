CREATE OR REPLACE FUNCTION public.can_view_user(_target uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT _target = auth.uid()
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.user_id = _target AND p.is_private = false)
    OR EXISTS (SELECT 1 FROM follows f WHERE f.follower_id = auth.uid() AND f.following_id = _target);
$$;

CREATE OR REPLACE FUNCTION public.can_view_post(_post uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM posts po WHERE po.id = _post
      AND (po.user_id = auth.uid()
        OR (po.status IN ('approved','pending_review') AND public.can_view_user(po.user_id)))
  );
$$;

DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON public.profiles;
CREATE POLICY "Profiles visible when public, own, or followed" ON public.profiles
  FOR SELECT USING (public.can_view_user(user_id));

DROP POLICY IF EXISTS "Follows are viewable by everyone" ON public.follows;
CREATE POLICY "Follows visible to participants or for visible accounts" ON public.follows
  FOR SELECT USING (auth.uid() = follower_id OR auth.uid() = following_id OR public.can_view_user(following_id));

DROP POLICY IF EXISTS "Likes are viewable by everyone" ON public.likes;
CREATE POLICY "Likes visible on viewable posts" ON public.likes
  FOR SELECT USING (auth.uid() = user_id OR public.can_view_post(post_id));

DROP POLICY IF EXISTS "Comments are viewable by everyone" ON public.comments;
CREATE POLICY "Comments visible on viewable posts" ON public.comments
  FOR SELECT USING (auth.uid() = user_id OR public.can_view_post(post_id));

DROP POLICY IF EXISTS "Votes are viewable by everyone" ON public.post_votes;
CREATE POLICY "Votes visible on viewable posts" ON public.post_votes
  FOR SELECT USING (auth.uid() = user_id OR public.can_view_post(post_id));

DROP POLICY IF EXISTS "Anyone can view originals" ON public.post_originals;
CREATE POLICY "Originals visible on viewable posts" ON public.post_originals
  FOR SELECT USING (public.can_view_post(post_id));